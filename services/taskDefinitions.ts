

import { TaskType } from '../types';

export interface TaskDefinition {
  id: TaskType;
  label: string;
  description: string;
  category: 'Scene' | 'Person' | 'Group' | 'Utility';
  defaultEnabled: boolean;
  prompt: (params: PromptParams) => string;
}

export interface PromptParams {
  gender: string;
  detailLevel: string;
  personDescription?: string;
}

// Helper Strings
const orientationInstruction = "Orientation: Ensure the generated image is UPRIGHT and vertically aligned, correcting any rotation from the input image.";
const styleInstruction = "Style: Strict BLACK AND WHITE line art. NO gray fills. NO colored surfaces. NO shading. Pure white background.";
const allAgesInstruction = "Subject: The subject may be of any age. Create a respectful, general-purpose figure study.";
const bodyTypeInstruction = "BODY TYPE: Natural, realistic proportions. Do NOT exaggerate muscles. Do NOT create hyper-muscular or superhero physiques. Keep the anatomy lean and natural.";
const strictPoseInstruction = `
    CRITICAL POSE ADHERENCE:
    - You must trace the EXACT pose of the original subject.
    - Do not change the position of HANDS, FEET, FINGERS, or HEAD TILT.
    - Retain the exact Hairstyle and Facial Expression.
    - Do not halluncinate new gestures.
`;
const cyberneticInstruction = "CYBERNETICS: If the subject has cybernetic limbs, prosthetics, or mechanical body parts, PRESERVE THEM EXACTLY. Do not convert them to biological skin. Treat them as part of the subject's anatomy.";
const fullBodyInstruction = "FULL BODY REQUIREMENT: You MUST generate the COMPLETE figure from head to toe. If the legs or feet are cut off in the source image, you MUST invent/reconstruct them naturally to show the full standing or sitting pose.";

const getDetailInstruction = (level: string) => {
    switch (level) {
        case 'Very Low': return "DETAIL LEVEL: VERY LOW / ABSTRACT. Ultra-minimalist. Use only the absolute most essential lines to define the form. Create a highly stylized, abstract, or icon-like representation.";
        case 'Low': return "DETAIL LEVEL: LOW / SIMPLIFIED. Use fewer lines. Focus on the main silhouette and major shapes. Omit fine textures, small folds, and minor details. Create a clean, minimalist look.";
        case 'High': return "DETAIL LEVEL: HIGH / INTRICATE. Maximize detail. Capture every texture, fold, strand of hair, and surface nuance. Use intricate linework. Create a dense, highly detailed illustration.";
        case 'Very High': return "DETAIL LEVEL: VERY HIGH / HYPER-REALISTIC. Extreme detail. Capture micro-textures, individual fabric threads, pores, and extreme texture density. Masterpiece quality.";
        default: return "DETAIL LEVEL: MEDIUM / BALANCED. Capture essential details while maintaining clarity. Standard professional line art.";
    }
};

const getGenderInstruction = (gender: string) => {
    return gender !== 'As-is' 
    ? `IMPORTANT: Depict the subject as ${gender.toUpperCase()}. Adjust anatomy, facial features, and body proportions to clearly match this gender.` 
    : "";
};

const getTargetInstruction = (desc?: string) => desc ? `TARGET SUBJECT: Focus ONLY on "${desc}". Ignore other people in the image.` : "";

export const TASK_DEFINITIONS: Record<TaskType, TaskDefinition> = {
  'full': {
    id: 'full',
    label: 'Full Scene',
    description: 'Generate high-fidelity line art of the entire image, including background and characters.',
    category: 'Scene',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender }) => `
      You are an expert technical illustrator creating a high-fidelity line art reproduction.
      Task: Convert the provided image into a high-detail line art drawing.
      
      Context:
      - This is an artistic tool for sketching and drawing based on photos.
      - ${allAgesInstruction}
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
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
    `
  },
  'full-nude': {
    id: 'full-nude',
    label: 'Full Scene (Nude)',
    description: 'Full scene line art with all characters as nude anatomical figures.',
    category: 'Scene',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender }) => `
      You are an expert technical illustrator creating a high-fidelity line art reproduction.
      Task: Convert the provided image into a high-detail line art drawing of the FULL SCENE, but strip all characters of clothing.

      CRITICAL REQUIREMENTS:
      - SCOPE: Draw the ENTIRE image (Background + Characters).
      - CLOTHING REMOVAL: All human subjects must be depicted as NEUTRAL ANATOMICAL FIGURES (Nude/Mannequin style). Remove all clothes.
      - SAFETY/MODESTY: Artistic anatomy study. DO NOT draw explicit genitalia. Use "Barbie/Ken doll" smooth surfaces. Keep the naughty bits hidden.
      - RECONSTRUCTION: If clothes were hiding body parts, or if the image is cropped, you MUST INVENT the anatomical structure naturally.
      - POSE: Preserve exact poses and interactions.

      Context:
      - ${allAgesInstruction}
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
      - ${cyberneticInstruction}
      - ${bodyTypeInstruction}

      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with an Alpha Channel (Transparency).
      - ${styleInstruction}
      - Background: MUST be transparent.
      - Return ONLY the image.
    `
  },
  'background': {
    id: 'background',
    label: 'Background Only',
    description: 'Remove characters to create a clean background layout.',
    category: 'Scene',
    defaultEnabled: true,
    prompt: ({ detailLevel }) => `
      You are an expert background artist for animation.
      Task: Create a line art of the BACKGROUND ONLY.
      
      Context:
      - Remove ALL humans, characters, and animals.
      - INTELLIGENTLY FILL IN the missing parts where the characters used to be, reconstructing the scene behind them.
      - ${getDetailInstruction(detailLevel)}
      
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with an Alpha Channel (Transparency).
      - Style: Clean, precise black lines matching the style of the original.
      - Background: MUST be transparent.
      - Content: Only the environment (rooms, nature, buildings, furniture). NO PEOPLE.
    `
  },
  'all-people': {
    id: 'all-people',
    label: 'All People (Group)',
    description: 'Extract ALL people as a group (Clothed). Requires >1 person.',
    category: 'Group',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender }) => `
      You are an expert technical illustrator creating a character assembly.
      Task: Extract ALL characters/people from the image as a group line art composition.
  
      Context:
      - Isolate ALL distinct human subjects in the image.
      - Remove the background scenery completely (Transparent).
      - KEEP CLOTHING, accessories, and held items exactly as they are.
      - Maintain relative positions and interactions between characters.
      - ${getDetailInstruction(detailLevel)}
      - ${allAgesInstruction}
      - ${getGenderInstruction(gender)}
      - ${bodyTypeInstruction}
      - ${fullBodyInstruction}
  
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with an Alpha Channel (Transparency).
      - ${styleInstruction}
      - Background: MUST be transparent. Do not render white pixels for the background.
      - ${strictPoseInstruction}
      - Return ONLY the image.
    `
  },
  'all-people-nude': {
    id: 'all-people-nude',
    label: 'All People Nude (Group)',
    description: 'Extract ALL people as a group (Nude/Mannequin). Requires >1 person.',
    category: 'Group',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender }) => `
      You are an expert anatomical artist doing a GROUP FIGURE STUDY.
      Task: Extract ALL characters from the image as a group of neutral ANATOMICAL FIGURES (Nude/Base Mesh).
  
      CRITICAL REQUIREMENTS:
      - Isolate ALL distinct human subjects.
      - CLOTHING: ABSOLUTELY NO CLOTHING LINES. Remove all clothes. Draw only the bare skin surface and muscle structure. 
      - ${cyberneticInstruction}
      - SAFETY/MODESTY: Artistic anatomy study. DO NOT draw explicit genitalia or sexual features. Use "Barbie/Ken doll" smooth surfaces. Keep the naughty bits hidden.
      - POSE: Copy the EXACT poses and interactions of the group.
      - ${fullBodyInstruction}
  
      Context:
      - ${getDetailInstruction(detailLevel)}
      - ${allAgesInstruction}
      - ${getGenderInstruction(gender)}
      - ${bodyTypeInstruction}
  
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with a SOLID WHITE background.
      - ${styleInstruction}
      - Background: Pure White (#FFFFFF).
    `
  },
  'model': {
    id: 'model',
    label: 'Character Extraction',
    description: 'Isolate character on white.',
    category: 'Person',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender, personDescription }) => `
      You are an expert anatomical artist.
      Task: Extract the specific character as a clean MANNEQUIN-STYLE line art figure.
      
      Context:
      - ${getTargetInstruction(personDescription)}
      - ${allAgesInstruction}
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
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
      - ${fullBodyInstruction}
      - CLOTHING REMOVAL / SIMPLIFICATION: Focus on the BODY CONTOUR and ANATOMICAL STRUCTURE. 
      - Treat clothing as minimal or non-existent to reveal the pose (like a drawing base mesh or mannequin). 
      - Do NOT draw detailed clothing patterns or textures.
    `
  },
  'face': {
    id: 'face',
    label: 'Face Portrait',
    description: 'Frontal headshot/face line art.',
    category: 'Person',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender, personDescription }) => `
      You are an expert portrait artist.
      Task: Create a highly detailed FRONTAL VIEW line art portrait of the subject's FACE/HEAD.
      
      CRITICAL REQUIREMENTS:
      - ${getTargetInstruction(personDescription)}
      - VIEWPOINT: Transform the angle to be a direct FRONTAL VIEW (Passport photo style). If the subject is looking to the side, rotate the head in your drawing to face FORWARD.
      - CROP/FOCUS: Zoom in and focus strictly on the head, face, and immediate neck/shoulder area.
      - NO CLOTHING: Draw the neck and shoulders as bare skin or a smooth mannequin form. Do not draw collars, hoods, shirts, or any clothing lines.
      - DETAIL: High detail on facial features (eyes, eyelashes, eyebrows, lips, nose contour) and hair.
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
      
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with a SOLID WHITE background.
      - ${styleInstruction}
      - Background: Pure White (#FFFFFF).
    `
  },
  'face-left': {
    id: 'face-left',
    label: 'Face Left Side',
    description: 'Left profile portrait.',
    category: 'Person',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender, personDescription }) => `
      You are an expert portrait artist.
      Task: Create a highly detailed LEFT PROFILE line art portrait of the subject's FACE/HEAD.
      
      CRITICAL REQUIREMENTS:
      - ${getTargetInstruction(personDescription)}
      - VIEWPOINT: Transform the angle to be a LEFT PROFILE VIEW (Subject looking to the left side of the canvas).
      - CROP/FOCUS: Zoom in and focus strictly on the head, face, and neck.
      - NO CLOTHING: Draw the neck and shoulders as bare skin or a smooth mannequin form.
      - DETAIL: High detail on facial features (eyes, eyelashes, eyebrows, lips, nose contour) and hair.
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
      
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with a SOLID WHITE background.
      - ${styleInstruction}
      - Background: Pure White (#FFFFFF).
    `
  },
  'face-right': {
    id: 'face-right',
    label: 'Face Right Side',
    description: 'Right profile portrait.',
    category: 'Person',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender, personDescription }) => `
      You are an expert portrait artist.
      Task: Create a highly detailed RIGHT PROFILE line art portrait of the subject's FACE/HEAD.
      
      CRITICAL REQUIREMENTS:
      - ${getTargetInstruction(personDescription)}
      - VIEWPOINT: Transform the angle to be a RIGHT PROFILE VIEW (Subject looking to the right side of the canvas).
      - CROP/FOCUS: Zoom in and focus strictly on the head, face, and neck.
      - NO CLOTHING: Draw the neck and shoulders as bare skin or a smooth mannequin form.
      - DETAIL: High detail on facial features (eyes, eyelashes, eyebrows, lips, nose contour) and hair.
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
      
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with a SOLID WHITE background.
      - ${styleInstruction}
      - Background: Pure White (#FFFFFF).
    `
  },
  'neutral': {
    id: 'neutral',
    label: 'Neutral Pose',
    description: 'Standing relaxed pose with clothes.',
    category: 'Person',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender, personDescription }) => `
      You are a concept artist creating a character sheet.
      Task: Reconstruct the character in a NEUTRAL REFERENCE POSE (A-Pose or I-Pose).
      
      CRITICAL REQUIREMENTS:
      - ${getTargetInstruction(personDescription)}
      - POSE: Standing straight, arms relaxed at the sides, legs straight, facing forward.
      - VIEW: Full Body (Head to Toe). You must invent missing legs/feet if cropped.
      - CLOTHING: PRESERVE THE ORIGINAL CLOTHING. Keep the outfit, style, and accessories intact.
      - EQUIPMENT REMOVAL: Remove any weapons, held items, bags, or equipment. Just the character in their clothes.
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
      
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with a SOLID WHITE background.
      - ${styleInstruction}
      - Background: Pure White (#FFFFFF).
    `
  },
  'neutral-nude': {
    id: 'neutral-nude',
    label: 'Neutral Pose (Nude)',
    description: 'Standing relaxed pose without clothes.',
    category: 'Person',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender, personDescription }) => `
      You are an expert anatomical artist.
      Task: Reconstruct the character in a NEUTRAL REFERENCE POSE (A-Pose or I-Pose) without clothes.
      
      CRITICAL REQUIREMENTS:
      - ${getTargetInstruction(personDescription)}
      - POSE: Standing straight, arms relaxed at the sides, legs straight, facing forward.
      - VIEW: Full Body (Head to Toe). You must invent missing legs/feet if cropped.
      - CLOTHING: REMOVE ALL CLOTHING. Draw only the bare skin surface and muscle structure (Mannequin/Base mesh style).
      - SAFETY/MODESTY: Artistic anatomy study. DO NOT draw explicit genitalia. Use "Barbie/Ken doll" smooth surfaces. Keep naughty bits hidden.
      - EQUIPMENT REMOVAL: Remove all items.
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
      - ${bodyTypeInstruction}
      
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with a SOLID WHITE background.
      - ${styleInstruction}
      - Background: Pure White (#FFFFFF).
    `
  },
  'model-full': {
    id: 'model-full',
    label: 'Body Reconstruction',
    description: 'Invent missing limbs (Full Body).',
    category: 'Person',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender }) => `
      You are an expert artist.
      Task: Create a COMPLETE FULL BODY line art of the main character, even if the original image is cropped.
      
      Context:
      - The user provided an image where the character might be missing feet, legs, or other parts.
      - You MUST INVENT and DRAW the missing parts to show the character standing or posing naturally.
      - ${allAgesInstruction}
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
      - ${cyberneticInstruction}
      - ${bodyTypeInstruction}
      
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with a SOLID WHITE background.
      - ${styleInstruction}
      - The figure must be complete from HEAD to TOE.
      - Maintain the pose of the visible parts, and extend it naturally for the missing parts.
    `
  },
  'backside': {
    id: 'backside',
    label: 'Opposite View',
    description: 'Reverse angle generation.',
    category: 'Person',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender, personDescription }) => `
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
      - ${getTargetInstruction(personDescription)}
      - ${allAgesInstruction}
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
      - ${cyberneticInstruction}
      - ${bodyTypeInstruction}
      
      Pose Requirements:
      - STAY STRICT WITH THE POSE. The limb positioning, head tilt, and stance must be identical to the original, just viewed from the opposite side.
      - ${fullBodyInstruction}
      - CLOTHING REMOVAL / SIMPLIFICATION: Like the front view, simplify clothing to show the ANATOMICAL STRUCTURE and POSE. Create a clean figure study/mannequin style.
      
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with a SOLID WHITE background.
      - ${styleInstruction}
      - No background scenery. Just the figure isolated.
    `
  },
  'nude': {
    id: 'nude',
    label: 'Nude / Base Mesh',
    description: 'Anatomical figure study.',
    category: 'Person',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender, personDescription }) => `
      You are an expert anatomical artist doing a FIGURE STUDY.
      Task: Draw the subject as a neutral ANATOMICAL FIGURE or BASE MESH (Nude/No Clothes) to capture the pure pose.
      
      CRITICAL REQUIREMENTS:
      - ${getTargetInstruction(personDescription)}
      - CLOTHING: ABSOLUTELY NO CLOTHING LINES. Remove all shirts, pants, socks, and underwear lines. Draw only the bare skin surface and muscle structure.
      - ${cyberneticInstruction}
      - SAFETY/MODESTY: This is an artistic anatomy study. DO NOT draw explicit genitalia or sexual features. Use "Barbie/Ken doll" smooth surfaces for private areas. Keep the naughty bits hidden.
      - POSE: Copy the EXACT pose, hands, fingers, and facial expression of the subject.
      - ${fullBodyInstruction}
      - FACE/HANDS: Keep facial details (eyes, nose, mouth) and hands distinct and accurate.
      
      Context:
      - ${allAgesInstruction}
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
      - ${bodyTypeInstruction}
  
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with a SOLID WHITE background.
      - ${styleInstruction}
      - Background: Pure White (#FFFFFF).
    `
  },
  'nude-opposite': {
    id: 'nude-opposite',
    label: 'Nude Opposite',
    description: 'Reverse angle anatomical study.',
    category: 'Person',
    defaultEnabled: true,
    prompt: ({ detailLevel, gender, personDescription }) => `
      You are an expert anatomical artist doing a FIGURE STUDY from the OPPOSITE ANGLE.
      Task: Draw the subject as a neutral ANATOMICAL FIGURE (Nude/No Clothes) from the 180-degree REVERSE VIEW.
      
      CRITICAL INSTRUCTION:
      - Analyze input view -> Generate COMPLEMENTARY view (Front->Back, Back->Front, Left->Right).
      - CLOTHING: ABSOLUTELY NO CLOTHING LINES. Remove all clothes. Draw only the bare skin surface and muscle structure.
      - ${cyberneticInstruction}
      - SAFETY/MODESTY: Non-explicit anatomical study. No genitalia. Use smooth mannequin surfaces. Keep the naughty bits hidden.
      - POSE: Keep the exact limb positioning and stance, just viewed from the other side.
      - ${fullBodyInstruction}
      
      Context:
      - ${getTargetInstruction(personDescription)}
      - ${allAgesInstruction}
      - ${getGenderInstruction(gender)}
      - ${getDetailInstruction(detailLevel)}
      - ${bodyTypeInstruction}
      
      Technical Requirements:
      - ${orientationInstruction}
      - Output: PNG image with a SOLID WHITE background.
      - ${styleInstruction}
      - Background: Pure White (#FFFFFF).
    `
  },
  'scan-people': {
    id: 'scan-people',
    label: 'People Scanner',
    description: 'Internal utility for detecting people.',
    category: 'Utility',
    defaultEnabled: true,
    prompt: () => '' // Not used via generateLineArtTask
  },
  'upscale': {
    id: 'upscale',
    label: 'Upscale 4K',
    description: 'Enhance resolution to 4K',
    category: 'Utility',
    defaultEnabled: true,
    prompt: () => '' // Defined in service specifically for upscale
  }
};