
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

// Helper to crop image to content (non-white pixels) with padding
// Optimized to be non-blocking for large images by processing in chunks
const cropToContent = async (base64Data: string, padding: number = 10): Promise<string> => {
  if (typeof window === 'undefined') return base64Data; // Safety check for SSR

  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64Data); return; }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      
      let minX = width, minY = height, maxX = 0, maxY = 0;
      let found = false;

      // Process in chunks to avoid blocking the UI thread
      const CHUNK_SIZE = 100; // Process 100 rows at a time
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
          // Schedule next chunk
          setTimeout(processChunk, 0);
        } else {
          // Finished processing all rows
          finalizeCrop();
        }
      };

      const finalizeCrop = () => {
        if (!found) {
          resolve(base64Data); // Return original if empty or pure white
          return;
        }

        const contentWidth = maxX - minX + 1;
        const contentHeight = maxY - minY + 1;
        
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = contentWidth + (padding * 2);
        croppedCanvas.height = contentHeight + (padding * 2);
        const croppedCtx = croppedCanvas.getContext('2d');
        
        if (!croppedCtx) { resolve(base64Data); return; }

        // Fill white first
        croppedCtx.fillStyle = '#FFFFFF';
        croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);

        // Draw content
        croppedCtx.drawImage(
          canvas, 
          minX, minY, contentWidth, contentHeight, 
          padding, padding, contentWidth, contentHeight
        );

        resolve(croppedCanvas.toDataURL('image/png'));
      };

      // Start processing
      processChunk();
    };

    img.onerror = () => resolve(base64Data); // Fallback
    img.src = base64Data; 
  });
};

const extractImageFromResponse = (response: any, logTitle: string, addLog: any): string => {
    addLog(LogLevel.GEMINI_RESPONSE, `Generate Content Response: ${logTitle}`, response);

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
        return `data:${mimeType};base64,${part.inlineData.data}`;
      }
    }

    const textPart = parts.find((p: any) => p.text);
    if (textPart) {
        throw new Error(`Gemini returned text instead of an image for ${logTitle}: ${textPart.text.substring(0, 100)}...`);
    }
    
    throw new Error(`Gemini did not return a valid image for ${logTitle}.`);
};

export const generateLineArtVariations = async (
  file: File, 
  apiKey: string,
  addLog: (level: LogLevel, title: string, details?: any) => void,
  onStatusUpdate?: (message: string) => void
): Promise<GeneratedImage[]> => {
  
  // Yield to UI to allow initial status render
  await new Promise(resolve => setTimeout(resolve, 0));

  const ai = new GoogleGenAI({ apiKey });
  
  onStatusUpdate?.("Encoding image data...");
  const base64Data = await fileToGenerativePart(file);
  const modelName = 'gemini-2.5-flash-image';

  // --- Prompt 1: Full Image ---
  const promptFull = `
    You are an expert technical illustrator creating a high-fidelity line art reproduction.
    Task: Convert the provided image into a high-detail line art drawing.
    
    Context:
    - This is an artistic tool for converting reference images. 
    - The input may contain artistic nudity. Treat this as a figure study.

    Technical Requirements:
    - Output: PNG image with an Alpha Channel (Transparency).
    - Style: Clean, precise black lines. No shading, no gradients, no colors.
    - Content: Capture all details: characters, background, objects, textures.
    - Background: MUST be transparent. Do not render white pixels for the background.
    - Return ONLY the image.

    Safety Handling:
    - If the image contains nudity, reproduce the lines accurately as a classical art study.
    - If specific details trigger safety blocks, simply OMIT the lines for those specific small areas (leaving them transparent). 
    - Do not add clothing or large censorship blocks.
  `;

  // --- Prompt 2: Model Only (Base Figure) ---
  const promptModel = `
    You are an expert anatomical artist creating a base figure for a fashion design kit.
    Task: Extract the main character(s) as a clean line art figure.
    
    Context:
    - The input image is an anatomical reference for fashion design.
    - It may contain artistic nudity.

    Technical Requirements:
    - Output: PNG image with a SOLID WHITE background. NO transparency.
    - Style: Clean, precise black lines on a pure white canvas.
    - Background: Pure White (#FFFFFF).

    Content & Anatomy:
    - Isolate the character(s) completely.
    - Generate a NUDE base figure to show full anatomy and muscle structure for fashion overlay.
    - IMPORTANT: The figure must be BAREFOOT. Remove any footwear.
    - Maintain exact pose and proportions from the original.
    - Make the figure as nude as possible.

    Safety & Censorship:
    - The goal is a nude anatomical figure.
    - If specific anatomical details (e.g. genitalia) cannot be rendered due to safety protocols, use MINIMAL SOLID WHITE SHAPES to cover them.
    - Since the background is white, simply OMITting the black contour lines in those specific areas is the preferred method of "coverage".
    - DO NOT use leaves, bars, blurring, or objects.
    - Keep the figure as "blank" as possible.
  `;

  // --- Prompt 3: Background Only ---
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

  addLog(LogLevel.INFO, `Starting parallel generation for ${file.name}`);
  onStatusUpdate?.("Analyzing scene & Initializing Gemini models...");

  try {
    // Run 3 requests in parallel
    const pFull = ai.models.generateContent(createPayload(promptFull))
        .then(res => {
            onStatusUpdate?.("Full Line Art generated...");
            return res;
        });
    
    const pModel = ai.models.generateContent(createPayload(promptModel))
        .then(res => {
            onStatusUpdate?.("Model extraction generated...");
            return res;
        });

    const pBackground = ai.models.generateContent(createPayload(promptBackground))
        .then(res => {
            onStatusUpdate?.("Background generation completed...");
            return res;
        });

    onStatusUpdate?.("Generating variations (Full, Model, Background)...");

    const [responseFull, responseModel, responseBackground] = await Promise.all([pFull, pModel, pBackground]);

    onStatusUpdate?.("Processing response data...");

    const urlFull = extractImageFromResponse(responseFull, `${file.name} (Full)`, addLog);
    let urlModel = extractImageFromResponse(responseModel, `${file.name} (Model)`, addLog);
    const urlBackground = extractImageFromResponse(responseBackground, `${file.name} (Background)`, addLog);

    // Post-process: Crop Model image
    onStatusUpdate?.("Auto-cropping model image...");
    urlModel = await cropToContent(urlModel, 10);

    return [
        { type: 'full', url: urlFull },
        { type: 'model', url: urlModel },
        { type: 'background', url: urlBackground }
    ];

  } catch (error: any) {
    // Log the error here as info/warn to avoid system noise, caller handles status update
    addLog(LogLevel.WARN, `Gemini API Exception for ${file.name}: ${error.message}`);
    throw error;
  }
};
