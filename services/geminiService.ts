
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

const SAFETY_SETTINGS_BLOCK_NONE = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
];

// NEW: Detect people in the image with Bounding Boxes
export const detectPeople = async (
    file: File,
    apiKey: string,
    addLog: (level: LogLevel, title: string, details?: any) => void
): Promise<Array<{ description: string, box_2d?: number[] }>> => {
    await new Promise(resolve => setTimeout(resolve, 0));
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = await fileToGenerativePart(file);

    addLog(LogLevel.INFO, `Scanning for people in ${file.name}`);

    const prompt = `
        Analyze this image and identify all distinct human subjects.
        Return a JSON list of objects.
        Each object must have:
        - "description": A unique visual description (e.g. "man in red hat").
        - "box_2d": A bounding box [ymin, xmin, ymax, xmax] normalized to 0-1000 scale.

        If there are NO people, return an empty list [].
        
        Example:
        [
          {"description": "woman in blue", "box_2d": [100, 100, 900, 500]},
          {"description": "child in front", "box_2d": [500, 400, 800, 600]}
        ]
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
                responseMimeType: 'application/json',
                safetySettings: SAFETY_SETTINGS_BLOCK_NONE
            }
        });

        addLog(LogLevel.GEMINI_RESPONSE, `Scan Response for ${file.name}`, response.text);
        
        const text = response.text || "[]";
        // Clean markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const people = JSON.parse(jsonStr);
        
        if (Array.isArray(people)) {
            // Validate structure
            return people.map(p => ({
                description: p.description || String(p),
                box_2d: Array.isArray(p.box_2d) && p.box_2d.length === 4 ? p.box_2d : undefined
            }));
        }
        return [];
    } catch (e: any) {
        addLog(LogLevel.ERROR, `Failed to detect people: ${e.message}`);
        // Fallback to text only if JSON parsing fails but we have some result, or empty if total failure
        return []; 
    }
};

export const generateLineArtTask = async (
  file: File, 
  apiKey: string,
  taskType: TaskType,
  gender: string,
  detailLevel: string,
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
  
  let detailInstruction = "";
  if (detailLevel === 'Low') {
    detailInstruction = "DETAIL LEVEL: LOW / SIMPLIFIED. Use fewer lines. Focus on the main silhouette and major shapes. Omit fine textures, small folds, and minor details. Create a clean, minimalist look.";
  } else if (detailLevel === 'High') {
    detailInstruction = "DETAIL LEVEL: HIGH / INTRICATE. Maximize detail. Capture every texture, fold, strand of hair, and surface nuance. Use intricate linework. Create a dense, highly detailed illustration.";
  } else {
    // Medium / Default
    detailInstruction = "DETAIL LEVEL: MEDIUM / BALANCED. Capture essential details while maintaining clarity. Standard professional line art.";
  }

  const styleInstruction = "Style: Strict BLACK AND WHITE line art. NO gray fills. NO colored surfaces. NO shading. Pure white background.";
  const orientationInstruction = "Orientation: Ensure the generated image is UPRIGHT and vertically aligned, correcting any rotation from the input image.";
  const allAgesInstruction = "Subject: The subject may be of any age. Create a respectful, general-purpose figure study.";
  const cyberneticInstruction = "CYBERNETICS: If the subject has cybernetic limbs, prosthetics, or mechanical body parts, PRESERVE THEM EXACTLY. Do not convert them to biological skin. Treat them as part of the subject's anatomy.";
  const bodyTypeInstruction = "BODY TYPE: Natural, realistic proportions. Do NOT exaggerate muscles. Do NOT create hyper-muscular or superhero physiques. Keep the anatomy lean and natural.";
  
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
    - ${detailInstruction}
    - ${cyberneticInstruction}
    - ${bodyTypeInstruction}

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
    - ${detailInstruction}
    - ${cyberneticInstruction}
    - ${bodyTypeInstruction}

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
    - ${detailInstruction}
    - ${cyberneticInstruction}
    - ${bodyTypeInstruction}
    
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
    - ${detailInstruction}
    - ${cyberneticInstruction}
    - ${bodyTypeInstruction}
    
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
    - ${detailInstruction}
    
    Technical Requirements:
    - ${orientationInstruction}
    - Output: PNG image with an Alpha Channel (Transparency).
    - Style: Clean, precise black lines matching the style of the original.
    - Background: MUST be transparent.
    - Content: Only the environment (rooms, nature, buildings, furniture). NO PEOPLE.
  `;

  const promptNude = `
    You are an expert anatomical artist doing a FIGURE STUDY.
    Task: Draw the subject as a neutral ANATOMICAL FIGURE or BASE MESH (Nude/No Clothes) to capture the pure pose.
    
    CRITICAL REQUIREMENTS:
    - ${targetInstruction}
    - CLOTHING: REMOVE ALL CLOTHING. Draw the bare skin surface and muscle structure.
    - ${cyberneticInstruction}
    - SAFETY/MODESTY: This is an artistic anatomy study. DO NOT draw explicit genitalia or sexual features. Use "Barbie/Ken doll" smooth surfaces for private areas. The goal is POSE REFERENCE, not adult content.
    - POSE: Copy the EXACT pose, hands, fingers, and facial expression of the subject.
    - FULL BODY: Ensure the drawing is FULL BODY. If feet/legs are cropped in the photo, you MUST reconstruct them to show the full standing/sitting figure.
    - FACE/HANDS: Keep facial details (eyes, nose, mouth) and hands distinct and accurate.
    
    Context:
    - ${allAgesInstruction}
    - ${genderInstruction}
    - ${detailInstruction}
    - ${bodyTypeInstruction}

    Technical Requirements:
    - ${orientationInstruction}
    - Output: PNG image with a SOLID WHITE background.
    - ${styleInstruction}
    - Background: Pure White (#FFFFFF).
  `;

  const promptNudeOpposite = `
    You are an expert anatomical artist doing a FIGURE STUDY from the OPPOSITE ANGLE.
    Task: Draw the subject as a neutral ANATOMICAL FIGURE (Nude/No Clothes) from the 180-degree REVERSE VIEW.
    
    CRITICAL INSTRUCTION:
    - Analyze input view -> Generate COMPLEMENTARY view (Front->Back, Back->Front, Left->Right).
    - CLOTHING: REMOVE ALL CLOTHING. Draw the bare skin surface and muscle structure.
    - ${cyberneticInstruction}
    - SAFETY/MODESTY: Non-explicit anatomical study. No genitalia. Use smooth mannequin surfaces.
    - POSE: Keep the exact limb positioning and stance, just viewed from the other side.
    - FULL BODY: MUST be full body. Invent missing legs/feet if needed.
    
    Context:
    - ${targetInstruction}
    - ${allAgesInstruction}
    - ${genderInstruction}
    - ${detailInstruction}
    - ${bodyTypeInstruction}
    
    Technical Requirements:
    - ${orientationInstruction}
    - Output: PNG image with a SOLID WHITE background.
    - ${styleInstruction}
    - Background: Pure White (#FFFFFF).
  `;

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
      case 'nude':
          prompt = promptNude;
          taskName = personDescription ? `Body Pose/Nude (${personDescription})` : "Body Pose/Nude";
          break;
      case 'nude-opposite':
          prompt = promptNudeOpposite;
          taskName = personDescription ? `Opposite Body/Nude (${personDescription})` : "Opposite Body/Nude";
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
    config: { safetySettings: SAFETY_SETTINGS_BLOCK_NONE }
  });

  addLog(LogLevel.INFO, `Starting generation for ${file.name} [${taskName}] with ${detailLevel} detail`);
  onStatusUpdate?.(`Generating ${taskName}...`);

  try {
      const response = await ai.models.generateContent(createPayload(prompt));
      
      let url = extractImageFromResponse(response, `${file.name} (${taskName})`, addLog);
      
      // Special post-processing for model types
      // Updated to include 'nude' and 'nude-opposite' in the auto-crop logic
      if (['model', 'model-full', 'backside', 'nude', 'nude-opposite'].includes(taskType)) {
         onStatusUpdate?.(`Auto-cropping ${taskName}...`);
         url = await cropToContent(url, 10);
      }

      return { type: taskType, url };

  } catch (error: any) {
      addLog(LogLevel.WARN, `Failed to generate ${taskName}: ${error.message}`);
      throw error;
  }
};
