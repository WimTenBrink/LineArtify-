
import { GoogleGenAI } from "@google/genai";
import { LogLevel, GeneratedImage, TaskType, AppOptions } from "../types";
import { TASK_DEFINITIONS } from "./taskDefinitions";

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
    const copy = JSON.parse(JSON.stringify(data));
    const str = JSON.stringify(copy, (key, value) => {
      if (typeof value === 'string' && value.length > 500) {
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

const extractImageFromResponse = (response: any, logTitle: string): string => {
    // Removed logging from here to ensure central logging in caller.
    const candidate = response.candidates?.[0];
    
    if (!candidate) {
      throw new Error(`No candidates received from Gemini for ${logTitle}.`);
    }

    if (candidate.finishReason && candidate.finishReason !== "STOP") {
      const reason = candidate.finishReason;
      if (reason === "SAFETY" || reason === "PROHIBITED_CONTENT") {
        throw new Error(`Generation blocked by Safety Policy. Try a different angle or less explicit subject.`);
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

// Complete safety settings including Civic Integrity to minimize blocks
const SAFETY_SETTINGS_BLOCK_NONE = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
];

const sanitizeDescription = (text: string): string => {
    return text
        .replace(/\b(child|children|kid|kids|minor|minors|baby|toddler)\b/gi, 'Subject')
        .replace(/\b(girl|boy)\b/gi, 'Person');
};

// NEW: Detect people in the image with Bounding Boxes
export const detectPeople = async (
    file: File,
    apiKey: string,
    addLog: (level: LogLevel, title: string, details?: any) => void,
    gender?: string
): Promise<Array<{ description: string, box_2d?: number[] }>> => {
    await new Promise(resolve => setTimeout(resolve, 0));
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = await fileToGenerativePart(file);

    addLog(LogLevel.INFO, `Scanning for people in ${file.name}`);
    
    const genderHint = (gender && gender !== 'As-is') ? `IMPORTANT: Assume the subjects are ${gender} unless unmistakably otherwise. Use ${gender} terms in the description. Do NOT use terms of the opposite gender.` : '';

    const prompt = `
        Analyze this image and identify all distinct human subjects.
        Return a JSON list of objects.
        Each object must have:
        - "description": A unique visual description (e.g. "man in red hat"). ${genderHint}
        - "box_2d": A bounding box [ymin, xmin, ymax, xmax] normalized to 0-1000 scale.

        Rules:
        - Identify every person ONLY ONCE. Do not output duplicate entries for the same person.
        - If multiple people look similar, add location context to description (e.g. "man on left").
        - If there are NO people, return an empty list [].
        
        Example:
        [
          {"description": "woman in blue", "box_2d": [100, 100, 900, 500]},
          {"description": "person in front", "box_2d": [500, 400, 800, 600]}
        ]
    `;

    // Retry Logic for Scanner
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            const payload = {
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
            };

            // Log Request (Sanitize base64) - Only log on first attempt to reduce spam
            if (attempt === 0) {
                 const logPayload = JSON.parse(JSON.stringify(payload));
                 if (logPayload.contents?.parts?.[0]?.inlineData) {
                     logPayload.contents.parts[0].inlineData.data = `<Base64 (${base64Data.length} chars) Omitted>`;
                 }
                 addLog(LogLevel.GEMINI_REQUEST, `Scan Request: ${file.name}`, logPayload);
            }

            const response = await ai.models.generateContent(payload);

            // Log Response
            if (attempt === 0) {
                 addLog(LogLevel.GEMINI_RESPONSE, `Scan Response: ${file.name}`, sanitizeForLog(response));
            }
            
            if (!response.candidates || response.candidates.length === 0) {
                throw new Error(`No candidates received from Gemini for ${file.name} (Scanner).`);
            }

            const text = response.text || "[]";
            // Clean markdown code blocks if present
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const people = JSON.parse(jsonStr);
            
            if (Array.isArray(people)) {
                // Validate structure and Sanitize
                return people.map(p => ({
                    description: sanitizeDescription(p.description || String(p)),
                    box_2d: Array.isArray(p.box_2d) && p.box_2d.length === 4 ? p.box_2d : undefined
                }));
            }
            return [];
        } catch (e: any) {
            attempt++;
            const errorMessage = e.message || String(e);
            
            if (attempt >= MAX_RETRIES) {
                // If we ran out of retries, log error and return empty
                addLog(LogLevel.ERROR, `Job Failed: scan-people (After ${MAX_RETRIES} attempts)`, errorMessage);
                return [];
            } else {
                // Log retry warning
                 addLog(LogLevel.WARN, `Scan failed for ${file.name}, retrying (${attempt}/${MAX_RETRIES})...`, errorMessage);
                 // Exponential backoff
                 await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
        }
    }
    
    return [];
};

// NEW: Generate descriptive filename
export const generateFilename = async (
    file: File,
    apiKey: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = await fileToGenerativePart(file);

    const prompt = `
        Analyze this image and generate a short, descriptive filename for it.
        Rules:
        - Use kebab-case (lowercase, hyphens).
        - Max 5-6 words.
        - Describe the main subject and activity/vibe.
        - Do NOT include file extension (like .png).
        - Do NOT include generic words like "image", "photo", "picture".
        
        Example: "cyberpunk-warrior-rain-neon"
        Example: "cat-sleeping-on-sofa"
    `;

    try {
        const payload = {
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: file.type, data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
               maxOutputTokens: 20
            }
        };

        const response = await ai.models.generateContent(payload);

        const name = response.text?.trim() || "";
        // Basic sanitization to ensure valid filename characters
        return name.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || "image";

    } catch (e) {
        console.error("Failed to generate filename", e);
        return "image"; // Fallback
    }
};

export const generateLineArtTask = async (
  file: File, 
  apiKey: string,
  taskType: TaskType,
  options: AppOptions,
  addLog: (level: LogLevel, title: string, details?: any) => void,
  onStatusUpdate?: (message: string) => void,
  personDescription?: string // Optional target
): Promise<GeneratedImage> => {
  
  // Yield to UI to allow initial status render
  await new Promise(resolve => setTimeout(resolve, 0));

  const ai = new GoogleGenAI({ apiKey });
  
  onStatusUpdate?.(`Encoding image data...`);
  const base64Data = await fileToGenerativePart(file);
  
  // Model Selection Logic
  // 'Upscale' tasks MUST use Pro. 
  // All other tasks respect the global model preference, defaulting to Flash if unset.
  const isUpscaleTask = taskType === 'upscale';
  const modelPreference = options.modelPreference || 'flash';
  
  // Determine model name
  let modelName = 'gemini-2.5-flash-image';
  if (isUpscaleTask || modelPreference === 'pro') {
      modelName = 'gemini-3-pro-image-preview';
  }
  
  // Get prompt from Task Definitions
  let prompt = "";
  let taskName = "";

  if (taskType === 'upscale') {
      taskName = "Upscale (4K)";
      prompt = `
        Task: Upscale and enhance the resolution of this line art to 4K quality.
        Context: The input is a line art drawing.
        Instructions:
        - Preserve the original style, linework, and details exactly.
        - Do not add new content or change the composition.
        - Sharpen lines and remove any compression artifacts.
        - Output the highest resolution possible.
        - Background: Keep the background EXACTLY as it is (Transparency or White).
      `;
  } else if (TASK_DEFINITIONS[taskType]) {
      const def = TASK_DEFINITIONS[taskType];
      taskName = def.label;
      if (personDescription) taskName += ` (${personDescription})`;
      
      prompt = def.prompt({
          gender: options.gender,
          detailLevel: options.detailLevel,
          personDescription: sanitizeDescription(personDescription || ''),
          customStyle: options.customStyle,
          modesty: options.modesty,
          bodyHair: options.bodyHair
      });
  } else {
      throw new Error(`Unknown Task Type: ${taskType}`);
  }

  const createPayload = (promptStr: string) => {
    const payload: any = {
      model: modelName,
      contents: {
        parts: [
          { inlineData: { mimeType: file.type, data: base64Data } },
          { text: promptStr }
        ]
      },
      config: { 
          safetySettings: SAFETY_SETTINGS_BLOCK_NONE,
          // Use user preference for creativity (temperature)
          // Default to 0.4 for balanced output if not set
          temperature: options.creativity !== undefined ? options.creativity : 0.4 
      }
    };

    // Add upscale config if using Pro model (implicitly enables 4K output when imageSize is set)
    if (modelName === 'gemini-3-pro-image-preview') {
        payload.config.imageConfig = { imageSize: '4K' };
    }

    return payload;
  };

  addLog(LogLevel.INFO, `Starting generation for ${file.name} [${taskName}]`, { model: modelName, creativity: options.creativity });
  onStatusUpdate?.(`Generating ${taskName} with ${modelName.includes('flash') ? 'Flash' : 'Pro'}...`);

  try {
      const payload = createPayload(prompt);

      // Log Request (Sanitize Base64)
      const logPayload = JSON.parse(JSON.stringify(payload));
      if (logPayload.contents?.parts) {
          logPayload.contents.parts.forEach((p: any) => {
              if (p.inlineData?.data) {
                  p.inlineData.data = `<Base64 (${p.inlineData.data.length} chars) Omitted>`;
              }
          });
      }
      addLog(LogLevel.GEMINI_REQUEST, `Generate Request: ${file.name} (${taskName})`, logPayload);

      const response = await ai.models.generateContent(payload);
      
      // Log Response (Sanitize Base64 in response)
      addLog(LogLevel.GEMINI_RESPONSE, `Generate Response: ${file.name} (${taskName})`, sanitizeForLog(response));
      
      let url = extractImageFromResponse(response, `${file.name} (${taskName})`);
      
      // Special post-processing for model types and all-people types
      // Updated to include all relevant types in the auto-crop logic
      const isAutoCropCandidate = 
          taskType.includes('model') || 
          taskType.includes('nude') || 
          taskType.includes('face') || 
          taskType.includes('neutral') ||
          taskType.includes('all-people') ||
          // Styles
          taskType.includes('chibi') ||
          taskType.includes('anime') ||
          taskType.includes('sketch') ||
          taskType.includes('coloring') ||
          taskType.includes('cyberpunk') ||
          taskType.includes('noir') ||
          taskType.includes('impressionist') ||
          taskType.includes('sticker') ||
          taskType.includes('fantasy');

      if (isAutoCropCandidate) {
         onStatusUpdate?.(`Auto-cropping ${taskName}...`);
         url = await cropToContent(url, 10);
      }

      return { type: taskType, url, prompt };

  } catch (error: any) {
      let friendlyError = error.message;

      // Map common errors to friendly messages
      if (error.message.includes('403') || error.message.includes('API key')) {
          friendlyError = "Access Denied: Invalid API Key. Please verify your key in settings.";
      } else if (error.message.includes('400') || error.message.includes('INVALID_ARGUMENT')) {
          friendlyError = "Bad Request: The image may be corrupted or the format is unsupported.";
      } else if (error.message.includes('503') || error.message.includes('Overloaded')) {
          friendlyError = "Service Overloaded: Google's servers are busy. Retrying automatically...";
      } else if (error.message.includes('SAFETY') || error.message.includes('PROHIBITED')) {
          friendlyError = "Content Policy Violation: The AI refused to generate this image due to safety settings.";
      }

      addLog(LogLevel.WARN, `Failed to generate ${taskName}: ${friendlyError}`);
      
      // Throw the friendly error
      throw new Error(friendlyError);
  }
};
