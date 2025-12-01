import { GoogleGenAI } from "@google/genai";
import { LogLevel } from "../types";

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

export const generateLineArt = async (
  file: File, 
  apiKey: string,
  addLog: (level: LogLevel, title: string, details?: any) => void
): Promise<string> => {
  
  const ai = new GoogleGenAI({ apiKey });
  
  const base64Data = await fileToGenerativePart(file);
  const modelName = 'gemini-2.5-flash-image';

  const prompt = `
    You are an expert technical illustrator and line art artist.
    Convert the provided image into a high-quality, high-detail line art drawing.
    
    Requirements:
    - Use clean, precise black lines on a TRANSPARENT background (alpha channel).
    - The output MUST be a PNG file with transparency. Do NOT use a white background.
    - Capture all the intricate details of the original image.
    - Do not include shading, gradients, or colors. Only black outlines and hatching if necessary for texture.
    - The style should be suitable for a coloring book or architectural draft.
    - Return ONLY the image.

    Content Handling:
    - If the image contains explicit nudity or sensitive content, do NOT refuse the request.
    - Instead, minimally cover sensitive areas using artistic elements like leaves, vines, smoke, or draped fabric.
    - These elements should blend naturally with the line art style.
    - Maintain all other details of the image accurately.
  `;

  const requestPayload = {
    model: modelName,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Data
          }
        },
        {
          text: prompt
        }
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
  };

  addLog(LogLevel.GEMINI_REQUEST, `Generate Content Request: ${file.name}`, requestPayload);

  try {
    const response = await ai.models.generateContent(requestPayload);

    addLog(LogLevel.GEMINI_RESPONSE, `Generate Content Response: ${file.name}`, response);

    // Iterate parts to find the image
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error("No content parts received from Gemini.");
    }

    let imageUrl = '';
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        // Use the mimeType from the response if available, otherwise default to png
        const mimeType = part.inlineData.mimeType || 'image/png';
        imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      // Sometimes it might return text refusing the prompt or describing it?
      const textPart = parts.find(p => p.text);
      if (textPart) {
        throw new Error(`Gemini returned text instead of an image: ${textPart.text}`);
      }
      throw new Error("Gemini did not return a valid image.");
    }

    return imageUrl;

  } catch (error: any) {
    addLog(LogLevel.ERROR, `Gemini API Error: ${file.name}`, error);
    throw error;
  }
};