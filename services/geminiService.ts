

import { GoogleGenAI } from "@google/genai";
import { LogLevel, GeneratedImage, TaskType } from "../types";

// Helper to encode file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to convert Base64 string to Blob URL
const base64ToBlobUrl = (base64Data: string, mimeType: string): string => {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
};

// Helper to sanitize log data (remove huge base64 strings)
const sanitizeForLog = (data: any): any => {
  if (!data) return data;
  try {
    const str = JSON.stringify(data, (key, value) => {
      if (typeof value === 'string' && value.length > 1000) {
        return `<Large String (${value.length} chars) Omitted>`;
      }
      return value;
    });
    return JSON.parse(str);
  } catch (e) {
    return "Unable to sanitize data";
  }
};

// Helper to crop image to content (non-white pixels) with padding
// Optimized to be non-blocking for large images by processing in chunks
const cropToContent = async (imageUrl: string, padding: number = 10): Promise<string> => {
  if (typeof window === 'undefined') return imageUrl; // Safety check for SSR

  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(imageUrl); return; }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      
      let minX = width, minY = height, maxX = 0, maxY = 0;
      let found = false;

      // Process in chunks to avoid blocking the UI thread
      // REDUCED CHUNK SIZE for better responsiveness
      const CHUNK_SIZE = 50; 
      let currentY = 0;

      const processChunk = () => {
        const endY = Math.min(currentY + CHUNK_SIZE, height);
        
        for (let y = currentY; y < endY; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // const a = data[i + 3];

            // If pixel is not white (allow some noise tolerance)
            if (r < 250 || g < 250 || b < 250) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              found = true;
            }
          }
        }

        currentY = endY;

        if (currentY < height) {
          // Schedule next chunk with a slight delay to yield to main thread
          setTimeout(processChunk, 0);
        } else {
          // Finished processing all rows
          finalizeCrop();
        }
      };

      const finalizeCrop = () => {
        if (!found) {
          resolve(imageUrl); // Return original if empty or pure white
          return;
        }

        const contentWidth = maxX - minX + 1;
        const contentHeight = maxY - minY + 1;
        
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = contentWidth + (padding * 2);
        croppedCanvas.height = contentHeight + (padding * 2);
        const croppedCtx = croppedCanvas.getContext('2d');
        
        if (!croppedCtx) { resolve(imageUrl); return; }

        // Fill white first
        croppedCtx.fillStyle = '#FFFFFF';
        croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);

        // Draw content
        croppedCtx.drawImage(
          canvas, 
          minX, minY, contentWidth, contentHeight, 
          padding, padding, contentWidth, contentHeight
        );

        // Use toBlob for async, non-blocking export
        croppedCanvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve(imageUrl);
          }
        }, 'image/png');
      };

      // Start processing
      setTimeout(processChunk, 0);
    };

    img.onerror = () => resolve(imageUrl); // Fallback
    img.src = imageUrl; 
  });
};

const extractImageFromResponse = (response: any, logTitle: string, addLog: any): string => {
    // Sanitize log to avoid storing massive base64 strings in memory/state
    addLog(LogLevel.GEMINI_RESPONSE, `Generate Content Response: ${logTitle}`, sanitizeForLog(response));

    const candidate = response.candidates?.[0];
    
    if (!candidate) {
      throw new Error(`No candidates received from Gemini for ${logTitle}.`);
    }

    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      const reason = candidate.finishReason;
      addLog(LogLevel.WARN, `Gemini finished with reason: ${reason} for ${logTitle}`);
      
      if (reason === "SAFETY") {
        throw new Error(`Generation blocked by safety settings for ${logTitle}.`);
      }
      throw new Error(`Gemini finished with non-success reason: ${reason}`);
    }

    const parts = candidate.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error(`No content parts received from Gemini for ${logTitle} (FinishReason: ${candidate.finishReason}).`);
    }

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        // Convert to Blob URL immediately to keep React state light and UI responsive
        return base64ToBlobUrl(part.inlineData.data, mimeType);
      }
    }

    const textPart = parts.find((p: any) => p.text);
    if (textPart) {
        throw new Error(`Gemini returned text instead of an image for ${logTitle}: ${textPart.text.substring(0, 100)}...`);
    }
    
    throw new Error(`Gemini did not return a valid image for ${logTitle}.`);
};

// NEW: Detect people in the image
export const detectPeople = async (
    file: File,
    apiKey: string,
    addLog: (level: LogLevel, title: string, details?: any) => void
): Promise<string[]> => {
    await new Promise(resolve => setTimeout(resolve, 0));
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = await fileToGenerativePart(file);

    addLog(LogLevel.INFO, `Scanning for people in ${file.name}`);

    const prompt = `
        Analyze this image and identify all distinct human subjects.
        Return a JSON list of strings, where each string is a unique, visual description of one person to distinguish them from others (e.g. "the man in the red shirt on the left", "the child sitting in the front").
        
        If there are NO people, return an empty list [].
        If there is only ONE person, return ["the person"].
        
        Example Output:
        ["the woman in the blue dress", "the man wearing a hat"]
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: file.type, data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: 'application/json'
            }
        });

        addLog(LogLevel.GEMINI_RESPONSE, `Scan Response for ${file.name}`, response.text);
        
        const text = response.text || "[]";
        // Clean markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const people = JSON.parse(jsonStr);
        
        if (Array.isArray(people)) {
            return people.map(p => String(p));
        }
        return [];
    } catch (e: any) {
        addLog(LogLevel.ERROR, `Failed to detect people: ${e.message}`);
        return ["the person"]; // Fallback to at least one person if scan fails but we are in a flow that expects people
    }
};

export const generateLineArtTask = async (
  file: File, 
  apiKey: string,
  taskType: TaskType,
  gender: string,
  addLog: (level: LogLevel, title: string, details?: any) => void,
  onStatusUpdate?: (message: string) => void,
  personDescription?: string // Optional target
): Promise<GeneratedImage> => {
  
  // Yield to UI to allow initial status render
  await new Promise(resolve => setTimeout(resolve, 0));

  const ai = new GoogleGenAI({ apiKey });
  
  onStatusUpdate?.(`Encoding image data...`);
  const base64Data = await fileToGenerativePart(file);
  const modelName = 'gemini-2.5-flash-image';

  // --- Prompts ---
  
  const genderInstruction = gender !== 'As-is' 
    ? `IMPORTANT: Depict the subject as ${gender.toUpperCase()}. Adjust anatomy, facial features, and body proportions to clearly match this gender.` 
    : "";

  const styleInstruction = "Style: Strict BLACK AND WHITE line art. NO gray fills. NO colored surfaces. NO shading. Pure white background.";
  const orientationInstruction = "Orientation: Ensure the generated image is UPRIGHT and vertically aligned, correcting any rotation from the input image.";
  const allAgesInstruction = "Subject: The subject may be of any age. Create a respectful, general-purpose figure study.";
  
  const strictPoseInstruction = `
    CRITICAL POSE ADHERENCE:
    - You must trace the EXACT pose of the original subject.
    - Do not change the position of HANDS, FEET, FINGERS, or HEAD TILT.
    - Retain the exact Hairstyle and Facial Expression.
    - Do not halluncinate new gestures.
  `;

  // Specific targeting for multi-person support
  const targetInstruction = personDescription 
    ? `TARGET SUBJECT: Focus ONLY on "${personDescription}". Ignore other people in the image.` 
    : "";

  const promptFull = `
    You are an expert technical illustrator creating a high-fidelity line art reproduction.
    Task: Convert the provided image into a high-detail line art drawing.
    
    Context:
    - This is an artistic tool for sketching and drawing based on photos.
    - ${allAgesInstruction}
    - ${genderInstruction}

    Technical Requirements:
    - ${orientationInstruction}
    - Output: PNG image with an Alpha Channel (Transparency).
    - ${styleInstruction}
    - Content: Capture all details: characters, background, objects, textures.
    - ${strictPoseInstruction}
    - Background: MUST be transparent. Do not render white pixels for the background.
    - Return ONLY the image.
  `;

  const promptModel = `
    You are an expert anatomical artist.
    Task: Extract the specific character as a clean MANNEQUIN-STYLE line art figure.
    
    Context:
    - ${targetInstruction}
    - ${allAgesInstruction}
    - ${genderInstruction}

    Technical Requirements:
    - ${orientationInstruction}
    - Output: PNG image with a SOLID WHITE background. NO transparency.
    - ${styleInstruction}
    - Background: Pure White (#FFFFFF).
    - COLOR REMOVAL: The output must be strictly black lines on white.

    Content:
    - Isolate the character completely.
    - ${strictPoseInstruction}
    - CLOTHING REMOVAL / SIMPLIFICATION: Focus on the BODY CONTOUR and ANATOMICAL STRUCTURE. 
    - Treat clothing as minimal or non-existent to reveal the pose (like a drawing base mesh or mannequin). 
    - Do NOT draw detailed clothing patterns or textures.
    - Maintain modesty (smooth mannequin surface) where appropriate, but ensure the limb structure and pose are perfectly clear for sketching reference.
  `;

  const promptModelFull = `
    You are an expert artist.
    Task: Create a COMPLETE FULL BODY line art of the main character, even if the original image is cropped.
    
    Context:
    - The user provided an image where the character might be missing feet, legs, or other parts.
    - You MUST INVENT and DRAW the missing parts to show the character standing or posing naturally.
    - ${allAgesInstruction}
    - ${genderInstruction}
    
    Technical Requirements:
    - ${orientationInstruction}
    - Output: PNG image with a SOLID WHITE background.
    - ${styleInstruction}
    - The figure must be complete from HEAD to TOE.
    - Maintain the pose of the visible parts, and extend it naturally for the missing parts.
  `;

  const promptOpposite = `
    You are a conceptual artist and technical draftsman.
    Task: Create a line art drawing of the subject as seen from the DIRECT OPPOSITE ANGLE (180-degree rotation).
    
    CRITICAL INSTRUCTION:
    - Analyze the input image to determine the current viewing angle (Front, Back, Left, Right).
    - Generate the COMPLEMENTARY view:
      * If Input is FRONT view -> Generate BACK view.
      * If Input is BACK view -> Generate FRONT view.
      * If Input is LEFT profile -> Generate RIGHT profile.
      * If Input is RIGHT profile -> Generate LEFT profile.
    
    Context:
    - You must hallucinate/invent the hidden details (e.g., face if seeing back, backpack if seeing front) based on the visible cues.
    - ${targetInstruction}
    - ${allAgesInstruction}
    - ${genderInstruction}
    
    Pose Requirements:
    - STAY STRICT WITH THE POSE. The limb positioning, head tilt, and stance must be identical to the original, just viewed from the opposite side.
    - Do not change the action or gesture.
    - CLOTHING REMOVAL / SIMPLIFICATION: Like the front view, simplify clothing to show the ANATOMICAL STRUCTURE and POSE. Create a clean figure study/mannequin style.
    
    Technical Requirements:
    - ${orientationInstruction}
    - Output: PNG image with a SOLID WHITE background.
    - ${styleInstruction}
    - No background scenery. Just the figure isolated.
  `;

  const promptBackground = `
    You are an expert background artist for animation.
    Task: Create a line art of the BACKGROUND ONLY.
    
    Context:
    - Remove ALL humans, characters, and animals.
    - INTELLIGENTLY FILL IN the missing parts where the characters used to be, reconstructing the scene behind them.
    
    Technical Requirements:
    - ${orientationInstruction}
    - Output: PNG image with an Alpha Channel (Transparency).
    - Style: Clean, precise black lines matching the style of the original.
    - Background: MUST be transparent.
    - Content: Only the environment (rooms, nature, buildings, furniture). NO PEOPLE.
  `;

  const safetySettings = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
  ];

  let prompt = promptFull;
  let taskName = "Full Line Art";
  
  switch (taskType) {
      case 'full': 
          prompt = promptFull; 
          taskName = "Full Line Art";
          break;
      case 'model': 
          prompt = promptModel; 
          taskName = personDescription ? `Character Extraction (${personDescription})` : "Character Extraction";
          break;
      case 'background': 
          prompt = promptBackground; 
          taskName = "Background";
          break;
      case 'model-full': 
          prompt = promptModelFull; 
          taskName = "Body Reconstruction";
          break;
      case 'backside':
          prompt = promptOpposite;
          taskName = personDescription ? `Opposite View (${personDescription})` : "Opposite View";
          break;
      case 'scan-people':
          throw new Error("Scan task should not call generateLineArtTask");
  }

  const createPayload = (promptStr: string) => ({
    model: modelName,
    contents: {
      parts: [
        { inlineData: { mimeType: file.type, data: base64Data } },
        { text: promptStr }
      ]
    },
    config: { safetySettings }
  });

  addLog(LogLevel.INFO, `Starting generation for ${file.name} [${taskName}]`);
  onStatusUpdate?.(`Generating ${taskName}...`);

  try {
      const response = await ai.models.generateContent(createPayload(prompt));
      
      let url = extractImageFromResponse(response, `${file.name} (${taskName})`, addLog);
      
      // Special post-processing for model types
      if (taskType === 'model' || taskType === 'model-full' || taskType === 'backside') {
         onStatusUpdate?.(`Auto-cropping ${taskName}...`);
         url = await cropToContent(url, 10);
      }

      return { type: taskType, url };

  } catch (error: any) {
      addLog(LogLevel.WARN, `Failed to generate ${taskName}: ${error.message}`);
      throw error;
  }
};

export const generateAnalysisReport = async (
  file: File,
  apiKey: string,
  errorHistory: string[],
  addLog: (level: LogLevel, title: string, details?: any) => void,
  onStatusUpdate?: (message: string) => void
): Promise<GeneratedImage> => {
  
  await new Promise(resolve => setTimeout(resolve, 0));
  const ai = new GoogleGenAI({ apiKey });
  
  onStatusUpdate?.("Encoding image for analysis...");
  const base64Data = await fileToGenerativePart(file);
  const modelName = 'gemini-2.5-flash';

  const analysisPrompt = `
    You are Google Cloud Vision, a powerful image analysis tool.
    Analyze the provided image and generate a detailed structured report in Markdown format.
    
    The user has been trying to generate a line art version of this image but it failed multiple times.
    Here is the history of errors encountered:
    ${errorHistory.map(e => `- ${e}`).join('\n')}

    Please provide a comprehensive analysis containing:
    1.  **Image Labels**: A list of entities, objects, and concepts detected.
    2.  **Object Detection**: List of objects and their approximate locations/prominence.
    3.  **Safe Search Analysis**: A detailed breakdown of why this image might be triggering safety filters (Likelihood of Adult, Medical, Violence, Racy content). Be specific but professional.
    4.  **Text Detection**: Any text found in the image.
    5.  **Error Analysis**: Based on the image content and the error history, explain why the line art generation might be failing.

    Return ONLY the Markdown text. Do not wrap in markdown code blocks. The content should be the markdown itself.
  `;

  addLog(LogLevel.INFO, `Starting fallback analysis for ${file.name}`);
  onStatusUpdate?.("Generating Cloud Vision Analysis Report...");

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { mimeType: file.type, data: base64Data } },
          { text: analysisPrompt }
        ]
      },
      config: {
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
        ]
      }
    });

    addLog(LogLevel.GEMINI_RESPONSE, `Analysis Report Response`, sanitizeForLog(response));
    const text = response.text || "No analysis generated.";
    
    // Create Markdown file
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    onStatusUpdate?.("Report generated.");

    return { type: 'report', url: url };

  } catch (error: any) {
    addLog(LogLevel.ERROR, `Analysis failed for ${file.name}: ${error.message}`);
    throw error;
  }
};