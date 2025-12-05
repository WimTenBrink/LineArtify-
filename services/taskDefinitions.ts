

import { TaskType } from '../types';

export interface TaskDefinition {
  id: TaskType;
  label: string;
  description: string;
  category: 'Scene' | 'Person' | 'Group' | 'Style' | 'Utility';
  defaultEnabled: boolean;
  prompt: (params: PromptParams) => string;
}

export interface PromptParams {
  gender: string;
  detailLevel: string;
  personDescription?: string;
  customStyle?: string;
}

// --- Instructions ---
const orientationInstruction = "Orientation: Ensure the generated image is UPRIGHT and vertically aligned, correcting any rotation from the input image.";
const styleInstruction = "Style: Strict BLACK AND WHITE line art. NO gray fills. NO colored surfaces. NO shading. Pure white background.";
const allAgesInstruction = "Subject: The subject may be of any age. Create a respectful, general-purpose figure study.";
const bodyTypeInstruction = "BODY TYPE: Natural, realistic proportions. Do NOT exaggerate muscles. Do NOT create hyper-muscular or superhero physiques. Keep the anatomy lean and natural.";
const strictPoseInstruction = `
    CRITICAL POSE ADHERENCE:
    - You must trace the EXACT pose of the original subject.
    - Do not change the position of HANDS, FEET, FINGERS, or HEAD TILT.
    - Retain the exact Hairstyle and Facial Expression (unless Nude/Mannequin style implies simplification).
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
const getCustomStyleInstruction = (style?: string) => style ? `\nADDITIONAL STYLE INSTRUCTIONS: ${style}\n` : "";

// --- Definition Generator ---
const createDefinition = (
    id: TaskType, 
    label: string, 
    description: string, 
    category: TaskDefinition['category'], 
    promptGen: (params: PromptParams) => string,
    defaultEnabled: boolean = true
): TaskDefinition => ({ id, label, description, category, defaultEnabled, prompt: promptGen });

// --- Tasks ---

export const TASK_DEFINITIONS: Record<TaskType, TaskDefinition> = {} as any;

// Helper to add task
const addTask = (def: TaskDefinition) => { TASK_DEFINITIONS[def.id] = def; };

// 1. SCENES
addTask(createDefinition('full', 'Full Scene', 'Entire image with background.', 'Scene', 
    p => `
      Task: Full scene line art.
      ${allAgesInstruction}
      ${getGenderInstruction(p.gender)}
      ${getDetailInstruction(p.detailLevel)}
      ${getCustomStyleInstruction(p.customStyle)}
      ${orientationInstruction}
      Output: PNG image with Transparency.
      ${styleInstruction}
      Content: Capture characters, background, objects.
      ${strictPoseInstruction}
    `));

addTask(createDefinition('full-nude', 'Full Scene (Nude)', 'Entire scene, characters nude (Mannequin style).', 'Scene', 
    p => `
      Task: Full scene line art, characters stripped of clothing.
      CLOTHING: ABSOLUTELY NO CLOTHING LINES. Remove all shirts, pants, socks, and underwear lines. Draw only the bare skin surface and muscle structure.
      SAFETY/MODESTY: This is an artistic anatomy study. DO NOT draw explicit genitalia or sexual features. Use "Barbie/Ken doll" smooth surfaces for private areas. Keep the naughty bits hidden.
      ${allAgesInstruction}
      ${getGenderInstruction(p.gender)}
      ${getDetailInstruction(p.detailLevel)}
      ${getCustomStyleInstruction(p.customStyle)}
      ${orientationInstruction}
      Output: PNG image with Transparency.
      ${styleInstruction}
    `));

addTask(createDefinition('background', 'Background Only', 'Remove people, keep scene.', 'Scene', 
    p => `
      Task: Background only. Remove ALL humans. In-paint missing areas.
      ${getDetailInstruction(p.detailLevel)}
      ${getCustomStyleInstruction(p.customStyle)}
      ${orientationInstruction}
      Output: PNG image with Transparency.
      ${styleInstruction}
    `));

// 2. GROUPS
addTask(createDefinition('all-people', 'All People', 'Extract group.', 'Group', 
    p => `
      Task: Extract ALL characters as a group.
      ${allAgesInstruction}
      ${getGenderInstruction(p.gender)}
      ${getDetailInstruction(p.detailLevel)}
      ${fullBodyInstruction}
      ${getCustomStyleInstruction(p.customStyle)}
      ${orientationInstruction}
      Output: PNG with Transparency.
      ${styleInstruction}
    `));

addTask(createDefinition('all-people-nude', 'All People (Nude)', 'Extract group (Nude).', 'Group', 
    p => `
      Task: Extract ALL characters as a group of anatomical figures.
      CLOTHING: Remove all clothing. Mannequin style.
      SAFETY/MODESTY: No explicit genitalia.
      ${allAgesInstruction}
      ${getGenderInstruction(p.gender)}
      ${getDetailInstruction(p.detailLevel)}
      ${fullBodyInstruction}
      ${getCustomStyleInstruction(p.customStyle)}
      ${orientationInstruction}
      Output: PNG with Transparency.
      ${styleInstruction}
    `));

// 3. CHARACTERS
const charPrompt = (nude: boolean, p: PromptParams, typeDesc: string) => `
    Task: ${typeDesc}.
    ${getTargetInstruction(p.personDescription)}
    ${nude ? "CLOTHING: Remove all clothing. Mannequin style.\nSAFETY/MODESTY: No explicit genitalia." : "CLOTHING: Keep original clothing."}
    ${allAgesInstruction}
    ${getGenderInstruction(p.gender)}
    ${getDetailInstruction(p.detailLevel)}
    ${fullBodyInstruction}
    ${strictPoseInstruction}
    ${cyberneticInstruction}
    ${bodyTypeInstruction}
    ${getCustomStyleInstruction(p.customStyle)}
    ${orientationInstruction}
    Output: PNG with SOLID WHITE background.
    ${styleInstruction}
`;

addTask(createDefinition('model', 'Character', 'Isolate character (Clothed).', 'Person', p => charPrompt(false, p, "Extract character")));
addTask(createDefinition('nude', 'Nude Study', 'Anatomical study (Safe/Mannequin).', 'Person', p => charPrompt(true, p, "Anatomical figure study")));

addTask(createDefinition('model-full', 'Body Recon', 'Invent missing limbs.', 'Person', p => charPrompt(false, p, "Full body reconstruction")));
addTask(createDefinition('model-full-nude', 'Body Recon (Nude)', 'Invent missing limbs (Nude).', 'Person', p => charPrompt(true, p, "Full body anatomical reconstruction")));

addTask(createDefinition('neutral', 'Neutral Pose', 'A-Pose reconstruction.', 'Person', p => charPrompt(false, p, "Reconstruct in Neutral A-Pose")));
addTask(createDefinition('neutral-nude', 'Neutral Pose (Nude)', 'A-Pose reconstruction (Nude).', 'Person', p => charPrompt(true, p, "Reconstruct in Neutral A-Pose (Nude)")));

addTask(createDefinition('backside', 'Backside', 'Reverse angle.', 'Person', p => charPrompt(false, p, "Generate 180-degree REVERSE VIEW")));
addTask(createDefinition('nude-opposite', 'Backside (Nude)', 'Reverse angle (Nude).', 'Person', p => charPrompt(true, p, "Generate 180-degree REVERSE VIEW (Nude)")));

// 4. FACES
const facePrompt = (view: string, p: PromptParams) => `
    Task: High detail ${view} portrait of FACE ONLY.
    ${getTargetInstruction(p.personDescription)}
    FACE ONLY: Floating head style. No shoulders/bust.
    ${getGenderInstruction(p.gender)}
    ${getDetailInstruction(p.detailLevel)}
    ${getCustomStyleInstruction(p.customStyle)}
    ${orientationInstruction}
    Output: PNG with SOLID WHITE background.
`;

addTask(createDefinition('face', 'Face Front', 'Frontal portrait.', 'Person', p => facePrompt('FRONTAL', p)));
addTask(createDefinition('face-left', 'Face Left', 'Left profile.', 'Person', p => facePrompt('LEFT PROFILE', p)));
addTask(createDefinition('face-right', 'Face Right', 'Right profile.', 'Person', p => facePrompt('RIGHT PROFILE', p)));

// 5. STYLES
const stylePrompt = (styleName: string, guide: string, nude: boolean, p: PromptParams) => `
    Task: Redraw subject in ${styleName} style.
    STYLE GUIDE: ${guide}
    ${getTargetInstruction(p.personDescription)}
    ${nude ? "CLOTHING: Remove all clothing. Mannequin style.\nSAFETY/MODESTY: No explicit genitalia." : "CLOTHING: Keep original clothing."}
    ${getGenderInstruction(p.gender)}
    ${getCustomStyleInstruction(p.customStyle)}
    ${orientationInstruction}
    Output: PNG with SOLID WHITE background.
    ${styleInstruction}
`;

// Define Styles with Variants
const defineStyle = (id: string, name: string, desc: string, guide: string) => {
    addTask(createDefinition(id as TaskType, name, desc, 'Style', p => stylePrompt(name.toUpperCase(), guide, false, p), false));
    addTask(createDefinition(`${id}-nude` as TaskType, `${name} (Nude)`, `${desc} (Nude)`, 'Style', p => stylePrompt(name.toUpperCase(), guide, true, p), false));
};

defineStyle('chibi', 'Chibi', 'Super deformed, cute proportions.', "Large head, small body, cute proportions, simplified features, big eyes.");
defineStyle('anime', '90s Anime', 'Retro anime aesthetic.', "Sharp angular lines, retro aesthetic, detailed hair, expressive eyes, cel-shading hints.");
defineStyle('sketch', 'Rough Sketch', 'Loose pencil sketch style.', "Loose lines, graphite texture, energetic strokes, unfinished artistic look.");
defineStyle('coloring-book', 'Coloring Book', 'Thick lines, closed shapes.', "Bold thick uniform lines, closed shapes, simplified details, ready for coloring.");
defineStyle('cyberpunk', 'Cyberpunk', 'High-tech low-life aesthetic.', "Complex mechanical details, wires, circuitry patterns, angular geometric shapes, futuristic aesthetic.");
defineStyle('noir', 'Noir', 'High contrast shadow style.', "Heavy shadows, high contrast, dramatic lighting, hatching for shading, comic noir aesthetic.");
defineStyle('impressionist', 'Impressionist', 'Artistic loose strokes.', "Broken lines, varying line weight, organic feel, capturing light and movement rather than rigid form.");
defineStyle('sticker', 'Sticker Art', 'Bold outline, simple vector style.', "Thick white border implied, vector graphics style, bold uniform outer line, simplified interior details.");
defineStyle('fantasy', 'Fantasy Art', 'RPG character concept style.', "Intricate armor/clothing details, flowing fabrics, heroic proportions, D&D character sheet aesthetic.");

// 6. UTILITY
addTask(createDefinition('scan-people', 'Scanner', 'Utility', 'Utility', () => ''));
addTask(createDefinition('upscale', 'Upscale 4K', 'Utility', 'Utility', () => ''));