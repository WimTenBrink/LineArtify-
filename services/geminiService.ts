
import { GoogleGenAI } from "@google/genai";
import { LogLevel, GeneratedImage } from "../types";

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

// Helper to check if the character is cropped
const checkIfCropped = async (
  ai: GoogleGenAI, 
  base64Data: string, 
  mimeType: string,
  addLog: any
): Promise<boolean> => {
  try {
    const prompt = `
      Analyze the main character in this image.
      Is the character's FULL BODY visible from head to toe?
      
      Return JSON: { "isCropped": boolean }
      
      Set isCropped to TRUE if:
      - The feet are cut off.
      - The legs are cut off.
      - The head is cut off.
      - It is a portrait/bust shot.
      
      Set isCropped to FALSE if:
      - The entire body is visible (even if sitting or crouching, as long as whole body is in frame).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    const text = response.text;
    addLog(LogLevel.INFO, "Cropping Check Response", text);
    
    if (text) {
      const json = JSON.parse(text);
      return !!json.isCropped;
    }
    return false;
  } catch (e) {
    addLog(LogLevel.WARN, "Failed to check cropping status, defaulting to false", e);
    return false;
  }
};

export const generateLineArtVariations = async (
  file: File, 
  apiKey: string,
  gender: string,
  existingResults: GeneratedImage[],
  addLog: (level: LogLevel, title: string, details?: any) => void,
  onStatusUpdate?: (message: string) => void
): Promise<{ results: GeneratedImage[], errors: string[] }> => {
  
  // Yield to UI to allow initial status render
  await new Promise(resolve => setTimeout(resolve, 0));

  const ai = new GoogleGenAI({ apiKey });
  
  onStatusUpdate?.("Encoding image data...");
  const base64Data = await fileToGenerativePart(file);
  const modelName = 'gemini-2.5-flash-image';

  // --- Prompts ---
  
  const genderInstruction = gender !== 'As-is' 
    ? `IMPORTANT: Depict all characters as ${gender.toUpperCase()}. Adjust anatomy, facial features, and body proportions to clearly match this gender.` 
    : "";

  const styleInstruction = "Style: Clean, precise black lines. No shading, no gradients, no colors. Avoid excessive muscle definition; use smooth, simplified lines for anatomy to avoid an overly muscular look.";

  const promptFull = `
    You are an expert technical illustrator creating a high-fidelity line art reproduction.
    Task: Convert the provided image into a high-detail line art drawing.
    
    Context:
    - This is an artistic tool for converting reference images. 
    - The input may contain artistic nudity. Treat this as a figure study.
    - ${genderInstruction}

    Technical Requirements:
    - Output: PNG image with an Alpha Channel (Transparency).
    - ${styleInstruction}
    - Content: Capture all details: characters, background, objects, textures.
    - Background: MUST be transparent. Do not render white pixels for the background.
    - Return ONLY the image.

    Safety Handling:
    - If the image contains nudity, reproduce the lines accurately as a classical art study.
    - If specific details trigger safety blocks, simply OMIT the lines for those specific small areas (leaving them transparent). 
    - Do not add clothing or large censorship blocks.
  `;

  const promptModel = `
    You are an expert anatomical artist creating a base figure for a fashion design kit.
    Task: Extract the main character(s) as a clean line art figure.
    
    Context:
    - The input image is an anatomical reference for fashion design.
    - It may contain artistic nudity.
    - ${genderInstruction}

    Technical Requirements:
    - Output: PNG image with a SOLID WHITE background. NO transparency.
    - ${styleInstruction}
    - Background: Pure White (#FFFFFF).

    Content & Anatomy:
    - Isolate the character(s) completely.
    - Generate a NUDE base figure to show full anatomy and structure for fashion overlay.
    - IMPORTANT: The figure must be BAREFOOT. Remove any footwear.
    - Maintain exact pose and proportions from the original (unless gender adjustment requires changes).
    - Make the figure as nude as possible.

    Safety & Censorship:
    - The goal is a nude anatomical figure.
    - If specific anatomical details (e.g. genitalia) cannot be rendered due to safety protocols, use MINIMAL SOLID WHITE SHAPES to cover them.
    - Since the background is white, simply OMITting the black contour lines in those specific areas is the preferred method of "coverage".
    - DO NOT use leaves, bars, blurring, or objects.
    - Keep the figure as "blank" as possible.
  `;

  const promptModelFull = `
    You are an expert anatomical artist.
    Task: Create a COMPLETE FULL BODY line art of the main character, even if the original image is cropped.
    
    Context:
    - The user provided an image where the character might be missing feet, legs, or other parts.
    - You MUST INVENT and DRAW the missing parts to show the character standing or posing naturally.
    - ${genderInstruction}
    
    Technical Requirements:
    - Output: PNG image with a SOLID WHITE background.
    - ${styleInstruction}
    - The figure must be complete from HEAD to TOE.
    - If feet were missing, draw them (Barefoot).
    - Maintain the pose of the visible parts, and extend it naturally for the missing parts.
  `;

  const promptBackground = `
    You are an expert background artist for animation.
    Task: Create a line art of the BACKGROUND ONLY.
    
    Context:
    - Remove ALL humans, characters, and animals.
    - INTELLIGENTLY FILL IN the missing parts where the characters used to be, reconstructing the scene behind them.
    
    Technical Requirements:
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

  const createPayload = (prompt: string) => ({
    model: modelName,
    contents: {
      parts: [
        { inlineData: { mimeType: file.type, data: base64Data } },
        { text: prompt }
      ]
    },
    config: { safetySettings }
  });

  addLog(LogLevel.INFO, `Starting sequential generation for ${file.name}`);
  onStatusUpdate?.("Initializing Gemini models...");

  const results: GeneratedImage[] = [...existingResults];
  const errors: string[] = [];

  // Define tasks dynamically
  const tasks: { type: string, prompt: string, name: string }[] = [
    { type: 'full', prompt: promptFull, name: 'Full Line Art' },
    { type: 'model', prompt: promptModel, name: 'Model Extraction' },
    { type: 'background', prompt: promptBackground, name: 'Background' }
  ];

  // Logic to determine if we need the 4th "Full Body" task
  // Only check if we don't already have it
  if (!results.some(r => r.type === 'model-full')) {
    onStatusUpdate?.("Checking for character cropping...");
    const isCropped = await checkIfCropped(ai, base64Data, file.type, addLog);
    
    if (isCropped) {
      addLog(LogLevel.INFO, `Image ${file.name} detected as cropped. Adding Full Body Reconstruction task.`);
      tasks.splice(2, 0, { type: 'model-full', prompt: promptModelFull, name: 'Full Body Reconstruction' });
    } else {
      addLog(LogLevel.INFO, `Image ${file.name} detected as full body. Skipping reconstruction.`);
    }
  }

  for (const task of tasks) {
    // Skip if we already have this result from a previous attempt
    if (results.some(r => r.type === task.type)) {
      addLog(LogLevel.INFO, `Skipping ${task.name} for ${file.name} (Already exists)`);
      continue;
    }

    try {
      onStatusUpdate?.(`Generating ${task.name}...`);
      
      const response = await ai.models.generateContent(createPayload(task.prompt));
      
      let url = extractImageFromResponse(response, `${file.name} (${task.name})`, addLog);
      
      // Special post-processing for model types
      if (task.type === 'model' || task.type === 'model-full') {
         onStatusUpdate?.(`Auto-cropping ${task.name}...`);
         url = await cropToContent(url, 10);
      }

      results.push({ type: task.type as any, url });
      
    } catch (error: any) {
      addLog(LogLevel.WARN, `Failed to generate ${task.name}: ${error.message}`);
      errors.push(`${task.name}: ${error.message}`);
      // Continue to next task despite error
    }
  }

  return { results, errors };
};

export const generateAnalysisReport = async (
  file: File,
  apiKey: string,
  errorHistory: string[],
  addLog: (level: LogLevel, title: string, details?: any) => void,
  onStatusUpdate?: (message: string) => void
): Promise<GeneratedImage[]> => {
  
  await new Promise(resolve => setTimeout(resolve, 0));
  const ai = new GoogleGenAI({ apiKey });
  
  onStatusUpdate?.("Encoding image for analysis...");
  const base64Data = await fileToGenerativePart(file);
  const modelName = 'gemini-2.5-flash';

  const analysisPrompt = `
    You are Google Cloud Vision, a powerful image analysis tool.
    Analyze the provided image and generate a detailed structured report in Markdown format.
    
    The user has been trying to generate a line art version of this image but it failed 10 times.
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

    return [
      { type: 'report', url: url }
    ];

  } catch (error: any) {
    addLog(LogLevel.ERROR, `Analysis failed for ${file.name}: ${error.message}`);
    throw error;
  }
};
