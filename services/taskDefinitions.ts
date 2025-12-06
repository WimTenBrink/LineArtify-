

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
  modesty?: string;
}

// --- Instructions ---
const orientationInstruction = "Orientation: Ensure the generated image is UPRIGHT and vertically aligned, correcting any rotation from the input image.";
const styleInstruction = "Style: Strict BLACK AND WHITE line art. NO gray fills. NO colored surfaces. NO shading. Pure white background.";
const allAgesInstruction = "Subject: The subject may be of any age. Create a respectful, general-purpose figure study.";
const bodyTypeInstruction = "BODY TYPE: Natural, realistic proportions. Do NOT exaggerate muscles. Do NOT create hyper-muscular or superhero physiques. Keep the anatomy lean and natural.";

// Strengthened Pose Instruction
const strictPoseInstruction = `
    CRITICAL POSE ADHERENCE:
    - You are a TRACING MACHINE. You must trace the input image EXACTLY.
    - DO NOT HALLUCINATE NEW POSES. 
    - DO NOT CHANGE THE CAMERA ANGLE.
    - DO NOT CHANGE THE ACTIVITY. If the subject is sitting, they MUST BE SITTING. If they are lying down, they MUST BE LYING DOWN.
    - IGNORE any temptation to make the image more dynamic or "interesting". Boring accuracy is the goal.
    - If the result looks like a different pose than the original, you have FAILED.
    - Maintain the exact perspective, limb positions, and head tilt of the source.
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
    if (gender === 'As-is') return "GENDER: Maintain the exact gender of the subject in the image.";
    // Strengthened Gender Instruction
    return `CRITICAL GENDER ENFORCEMENT: The subject IS ${gender.toUpperCase()}. You MUST depict them as ${gender}. Do NOT output the opposite gender under any circumstances. Adjust anatomy, facial features, and proportions to strictly match ${gender}. Ignore any visual cues in the source that suggest otherwise if they conflict with this instruction.`;
};

const getModestyInstruction = (modesty?: string) => {
    if (!modesty || modesty === 'None') return "";
    const instructions: Record<string, string> = {
        'Left Hand': "MODESTY POSE: The subject must use their LEFT HAND to modestly cover their genital area.",
        'Right Hand': "MODESTY POSE: The subject must use their RIGHT HAND to modestly cover their genital area.",
        'Both Hands': "MODESTY POSE: The subject must use one hand to cover their genitals and the other hand to cover their breasts/chest.",
        'Object': "MODESTY: Strategically place a natural prop, flower, or fabric to obscure the genital area naturally.",
        'Veil': "MODESTY: The subject is wearing a sheer, transparent veil draped over their torso and hips.",
        'Long Hair': "MODESTY: Use long flowing hair to obscure the chest and genital areas.",
        'Steam': "MODESTY: Obscure private areas with steam, mist, or fog.",
        'Shadow': "MODESTY: Use deep shadows to obscure private details."
    };
    return instructions[modesty] || "";
};

const getNudeInstruction = (nude: boolean, modesty?: string) => {
    if (!nude) return "CLOTHING: Keep original clothing. If the subject is wearing clothes, keep them.";
    return `
    CLOTHING: REMOVE ALL CLOTHING. The subject must be COMPLETELY NUDE.
    DEFINITION: Nude means NO CLOTHES. Bare body only.
    SAFETY/MODESTY: This is an artistic anatomy study. DO NOT draw explicit genitalia or sexual features. Use "Barbie/Ken doll" smooth surfaces for private areas.
    ${getModestyInstruction(modesty)}
    `;
};

const getAnatomyInstruction = (type: 'muscles' | 'skeleton') => {
    if (type === 'skeleton') {
        return "MODE: SKELETAL STRUCTURE. Draw the human skeleton inside the subject's pose. Show the bones (skull, ribcage, spine, pelvis, limbs) accurately aligned with the subject's posture.";
    }
    return "MODE: ANATOMY / ECORCHÉ. Draw the muscle structure of the subject. Remove skin and clothing. Show the musculature (muscles, tendons) accurately aligned with the subject's pose. Artistic anatomy study.";
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
      ${getNudeInstruction(true, p.modesty)}
      ${allAgesInstruction}
      ${getGenderInstruction(p.gender)}
      ${getDetailInstruction(p.detailLevel)}
      ${getCustomStyleInstruction(p.customStyle)}
      ${orientationInstruction}
      Output: PNG image with Transparency.
      ${styleInstruction}
      ${strictPoseInstruction}
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
      ${strictPoseInstruction}
    `));

addTask(createDefinition('all-people-nude', 'All People (Nude)', 'Extract group (Nude).', 'Group', 
    p => `
      Task: Extract ALL characters as a group of anatomical figures.
      ${getNudeInstruction(true, p.modesty)}
      ${allAgesInstruction}
      ${getGenderInstruction(p.gender)}
      ${getDetailInstruction(p.detailLevel)}
      ${fullBodyInstruction}
      ${getCustomStyleInstruction(p.customStyle)}
      ${orientationInstruction}
      Output: PNG with Transparency.
      ${styleInstruction}
      ${strictPoseInstruction}
    `));

// 3. CHARACTERS
const charPrompt = (mode: 'clothed' | 'nude' | 'anatomy' | 'skeleton', p: PromptParams, typeDesc: string, extraInstruction: string = '') => `
    Task: ${typeDesc}.
    ${getTargetInstruction(p.personDescription)}
    ${mode === 'clothed' ? getNudeInstruction(false) : ''}
    ${mode === 'nude' ? getNudeInstruction(true, p.modesty) : ''}
    ${mode === 'anatomy' ? getAnatomyInstruction('muscles') : ''}
    ${mode === 'skeleton' ? getAnatomyInstruction('skeleton') : ''}
    ${allAgesInstruction}
    ${getGenderInstruction(p.gender)}
    ${getDetailInstruction(p.detailLevel)}
    ${fullBodyInstruction}
    ${strictPoseInstruction}
    ${extraInstruction}
    ${cyberneticInstruction}
    ${bodyTypeInstruction}
    ${getCustomStyleInstruction(p.customStyle)}
    ${orientationInstruction}
    Output: PNG with SOLID WHITE background.
    ${styleInstruction}
`;

// Body Views Helper
const addBodyView = (baseId: string, label: string, desc: string, extra: string) => {
    // Clothed
    addTask(createDefinition(baseId as TaskType, label, desc, 'Person', p => charPrompt('clothed', p, desc, extra)));
    // Nude
    addTask(createDefinition(`${baseId}-nude` as TaskType, `${label} (Nude)`, `${desc} (Nude)`, 'Person', p => charPrompt('nude', p, `${desc} (Nude)`, extra)));
    // Anatomy
    addTask(createDefinition(`${baseId}-anatomy` as TaskType, `${label} (Anatomy)`, `${desc} (Muscles)`, 'Person', p => charPrompt('anatomy', p, `${desc} (Anatomy)`, extra), false));
    // Skeleton
    addTask(createDefinition(`${baseId}-skeleton` as TaskType, `${label} (Skeleton)`, `${desc} (Bones)`, 'Person', p => charPrompt('skeleton', p, `${desc} (Skeleton)`, extra), false));
};

addBodyView('model-full', 'Body As-is', 'Full body reconstruction', "VIEW: Keep the original camera angle.");
addBodyView('body-front', 'Body Front', 'Full body reconstruction - Front View', "VIEW: Force a FRONTAL view of the character (A-Pose or standing).");
addBodyView('body-left', 'Body Left', 'Full body reconstruction - Left Profile', "VIEW: Force a LEFT PROFILE view of the character.");
addBodyView('body-right', 'Body Right', 'Full body reconstruction - Right Profile', "VIEW: Force a RIGHT PROFILE view of the character.");
addBodyView('backside', 'Body Back', 'Full body reconstruction - Back View', "VIEW: Generate 180-degree REVERSE/BACK view.");
// Note: 'nude-opposite' was the legacy key for backside nude, handled below manually to maintain compatibility or just remapped in addBodyView if I change the key logic. 
// To keep legacy 'nude-opposite' working, we need to ensure the key matches.
// The helper above generates `${baseId}-nude`. 
// 'backside-nude' is NEW. 'nude-opposite' is OLD. 
// Let's explicitly re-add the legacy key mapping or just add the new one.
// The user asked for Anatomy/Skeleton. I will stick to the generated keys for consistency.
// 'backside' -> 'backside-nude', 'backside-anatomy', 'backside-skeleton'.
// Legacy 'nude-opposite' is mapped in types, but let's just use the consistent naming for new features.
addTask(createDefinition('nude-opposite', 'Body Back (Nude Legacy)', 'Legacy Back View', 'Person', p => charPrompt('nude', p, "Back View (Nude)", "VIEW: Generate 180-degree REVERSE/BACK view."), false));

// 4. FACES
const facePrompt = (view: string, p: PromptParams, desc: string) => `
    Task: High detail portrait of FACE ONLY.
    VIEWPOINT: ${view}.
    ${getTargetInstruction(p.personDescription)}
    FACE ONLY: Floating head style. No shoulders/bust.
    ${getGenderInstruction(p.gender)}
    ${getDetailInstruction(p.detailLevel)}
    ${getCustomStyleInstruction(p.customStyle)}
    ${orientationInstruction}
    Output: PNG with SOLID WHITE background.
`;

addTask(createDefinition('face-asis', 'Face As-is', 'Original angle.', 'Person', p => facePrompt('MATCH ORIGINAL ANGLE', p, 'Portrait')));
addTask(createDefinition('face', 'Face Front', 'Frontal portrait.', 'Person', p => facePrompt('STRICT FRONTAL VIEW', p, 'Frontal Portrait')));
addTask(createDefinition('face-left', 'Face Left', 'Left profile.', 'Person', p => facePrompt('STRICT LEFT PROFILE', p, 'Left Profile')));
addTask(createDefinition('face-right', 'Face Right', 'Right profile.', 'Person', p => facePrompt('STRICT RIGHT PROFILE', p, 'Right Profile')));
addTask(createDefinition('face-back', 'Face Back', 'Back of head.', 'Person', p => facePrompt('BACK OF HEAD', p, 'Back View')));

// 5. STYLES
const stylePrompt = (styleName: string, guide: string, nude: boolean, p: PromptParams) => `
    Task: Redraw subject in ${styleName} style.
    STYLE GUIDE: ${guide}
    ${getTargetInstruction(p.personDescription)}
    ${getNudeInstruction(nude, p.modesty)}
    ${getGenderInstruction(p.gender)}
    ${getCustomStyleInstruction(p.customStyle)}
    ${fullBodyInstruction}
    ${orientationInstruction}
    Output: PNG with SOLID WHITE background.
    ${styleInstruction}
    ${strictPoseInstruction}
`;

// Define Styles with Variants
const defineStyle = (id: string, name: string, desc: string, guide: string) => {
    addTask(createDefinition(id as TaskType, name, desc, 'Style', p => stylePrompt(name.toUpperCase(), guide, false, p), false));
    addTask(createDefinition(`${id}-nude` as TaskType, `${name} (Nude)`, `${desc} (Nude)`, 'Style', p => stylePrompt(name.toUpperCase(), guide, true, p), false));
};

// ORIGINAL STYLES
defineStyle('chibi', 'Chibi', 'Super deformed, cute proportions.', "Large head, small body, cute proportions, simplified features, big eyes.");
defineStyle('anime', '90s Anime', 'Retro anime aesthetic.', "Sharp angular lines, retro aesthetic, detailed hair, expressive eyes, cel-shading hints.");
defineStyle('sketch', 'Rough Sketch', 'Loose pencil sketch style.', "Loose lines, graphite texture, energetic strokes, unfinished artistic look.");
defineStyle('coloring-book', 'Coloring Book', 'Thick lines, closed shapes.', "Bold thick uniform lines, closed shapes, simplified details, ready for coloring.");
defineStyle('cyberpunk', 'Cyberpunk', 'High-tech low-life aesthetic.', "Complex mechanical details, wires, circuitry patterns, angular geometric shapes, futuristic aesthetic.");
defineStyle('noir', 'Noir', 'High contrast shadow style.', "Heavy shadows, high contrast, dramatic lighting, hatching for shading, comic noir aesthetic.");
defineStyle('impressionist', 'Impressionist', 'Artistic loose strokes.', "Broken lines, varying line weight, organic feel, capturing light and movement rather than rigid form.");
defineStyle('sticker', 'Sticker Art', 'Bold outline, simple vector style.', "Thick white border implied, vector graphics style, bold uniform outer line, simplified interior details.");
defineStyle('fantasy', 'Fantasy Art', 'RPG character concept style.', "Intricate armor/clothing details, flowing fabrics, heroic proportions, D&D character sheet aesthetic.");
defineStyle('elfquest', 'Elfquest', 'Wendy Pini style fantasy.', "Style of Wendy Pini's Elfquest. Fantasy comic style, large expressive eyes, feathered hair, organic flowing lines, slight 80s fantasy aesthetic.");
defineStyle('european-comic', 'European Comic', 'Ligne Claire style.', "European comic style (Bande Dessinée). Ligne Claire (Clear Line) style. Uniform line weights, high clarity, detailed backgrounds, realistic but stylized proportions. Think Moebius or Hergé.");
defineStyle('american-comic', 'American Comic', 'Superhero comic style.', "American superhero comic book style. Dynamic heavy blacks, cross-hatching, dramatic lighting, heroic proportions, bold contour lines. Marvel/DC style.");
defineStyle('manga', 'Modern Manga', 'Modern Japanese manga style.', "Modern Manga style. Black and white ink. Screentone textures implied via hatching. Fine lines, expressive faces, dynamic action lines.");
defineStyle('pinup', 'Pin-up', 'Vintage glamour style.', "Classic Pin-up Art style. Gil Elvgren/Alberto Vargas. Soft contour lines, glamourous posing, elegant curves, 1950s aesthetic.");
defineStyle('mecha', 'Mecha', 'Robot/Tech aesthetic.', "Mecha / Robot Anime style. Technical drawing aesthetic, panel lining, hard edges, mechanical details, greebling.");

defineStyle('blueprint', 'Blueprint', 'Technical schematic.', "Technical Drawing / Blueprint style. White lines on blue background (inverted for line art to black on white). Straight ruler lines, measurement annotations, exploded view aesthetic, mechanical precision.");
defineStyle('woodcut', 'Woodcut', 'Medieval block print.', "Woodcut / Linocut style. Thick, jagged lines. Strong contrast. Hatching implies texture. Medieval or folklore aesthetic.");
defineStyle('popart', 'Pop Art', 'Pop Art/Lichtenstein.', "Pop Art / Lichtenstein style. Thick bold contours, Ben-Day dots for shading, commercial print aesthetic, dramatic graphic impact.");
defineStyle('ukiyo', 'Ukiyo-e', 'Japanese woodblock print.', "Japanese Ukiyo-e style. Fluid organic lines, flat perspective, traditional patterns on clothing, Hokusai/Hiroshige aesthetic.");
defineStyle('graffiti', 'Graffiti', 'Street art style.', "Graffiti Character style. Wildstyle outlines, exaggerated features, drip effects, spray paint texture implied by stippling, urban aesthetic.");
defineStyle('horror', 'Horror Manga', 'Junji Ito style.', "Horror Manga / Junji Ito style. Excessive detail on grotesque elements, spiral patterns, heavy black ink usage, unsettling organic textures.");

// --- WESTERN COMICS / CARTOONS ---
defineStyle('style-ligne-claire', 'Tintin Style', 'Hergé / Ligne Claire.', "Style of Hergé (Tintin). Absolute line uniformity, no hatching, vibrant clarity, flat perspective, distinct character silhouettes.");
defineStyle('style-asterix', 'Asterix Style', 'Uderzo French comic style.', "Style of Albert Uderzo (Asterix). Dynamic caricatures, large noses, energetic poses, fluid ink lines, expressive motion.");
defineStyle('style-spirou', 'Spirou Style', 'Franquin dynamic comic style.', "Style of André Franquin (Spirou/Gaston). Highly dynamic energy, loose 'Marcinelle school' linework, expressive body language, detailed clutter.");
defineStyle('style-lucky', 'Lucky Luke', 'Morris style western.', "Style of Morris (Lucky Luke). Thin clean lines, exaggerated lanky proportions, minimal background detail, witty caricature.");
defineStyle('style-moebius', 'Moebius', 'Jean Giraud Sci-Fi.', "Style of Moebius (Jean Giraud). Intricate stippling/hatching, surreal landscapes, distinct headgear/costumes, clean but detailed contour lines.");
defineStyle('style-peanuts', 'Peanuts', 'Charles Schulz strips.', "Style of Charles Schulz (Peanuts). Wobbly distinct ink lines, large heads, simplified bodies, minimal detail, emotional minimalism.");
defineStyle('style-calvin', 'Watterson', 'Calvin & Hobbes style.', "Style of Bill Watterson. Dynamic brush strokes, expressive faces, energetic movement lines, perfect balance of loose sketch and tight detail.");
defineStyle('style-garfield', 'Garfield', 'Jim Davis style.', "Style of Jim Davis. Heavy eyelids, sleepy expression, striped patterns, rounded simplified forms, heavy outlines.");
defineStyle('style-simpsons', 'Simpsons', 'Matt Groening style.', "Style of Matt Groening (The Simpsons). Overbite, bulging eyes, specific hair shapes, uniform line weight, yellow-character aesthetic.");
defineStyle('style-kirby', 'Kirby', 'Jack Kirby dynamic.', "Style of Jack Kirby. 'Kirby Krackle' energy dots, squared fingers, extreme foreshortening, blocky muscles, dynamic action.");
defineStyle('style-miller', 'Sin City', 'Frank Miller Noir.', "Style of Frank Miller (Sin City). Extreme high contrast, pure black and white, no mid-tones, gritty silhouettes, rain/blood splatter effects.");
defineStyle('style-mignola', 'Mignola', 'Hellboy heavy shadows.', "Style of Mike Mignola (Hellboy). Angular shapes, heavy solid black shadows, minimalist faces, gothic atmosphere, high contrast.");
defineStyle('style-timm', 'Bruce Timm', 'Batman TAS / DCAU.', "Style of Bruce Timm (Batman TAS). Broad shoulders, tiny ankles, angular jaws, streamlined art deco influence, heroic silhouettes.");
defineStyle('style-fleischer', 'Rubber Hose', '1930s Animation.', "1930s Fleischer/Disney Rubber Hose style. Pie eyes, gloved hands, noodle limbs, constant bouncing motion, retro cartoon aesthetic.");
defineStyle('style-hanna', 'Hanna-Barbera', '60s TV Cartoon.', "Hanna-Barbera style (Flintstones/Scooby). Thick outlines, neckties/collars (to save animation), simplified flat designs, TV animation aesthetic.");
defineStyle('style-disney', 'Disney Classic', 'Renaissance Animation.', "Classic Disney Animation (90s Renaissance). Fluid anatomical lines, expressive acting, clean cleanup lines, appealing character design.");
defineStyle('style-looney', 'Looney Tunes', 'Chuck Jones / Tex Avery.', "Looney Tunes style. Exaggerated takes, wild expressions, stretch and squash, dynamic energy, slapstick aesthetic.");
defineStyle('style-archies', 'Archie Comics', 'Classic Dan DeCarlo.', "Classic Archie Comics style (Dan DeCarlo). Wholesome Americana, idealized teen proportions, clean heavy outlines, fashion focus.");

// --- EASTERN / MANGA / ANIME ---
defineStyle('style-toriyama', 'Toriyama', 'Dragon Ball style.', "Style of Akira Toriyama. Angular eyes, spiky hair, distinct muscle definition, clean mechanical details, dynamic fighting poses.");
defineStyle('style-ghibli', 'Ghibli', 'Miyazaki style.', "Style of Hayao Miyazaki (Studio Ghibli). Soft natural lines, detailed hair movement, realistic clothing folds, emotional facial expressions, pastoral details.");
defineStyle('style-oda', 'One Piece', 'Eiichiro Oda style.', "Style of Eiichiro Oda. Wide grins, exaggerated proportions, distinct hatching style, busy details, energetic and wacky.");
defineStyle('style-jojo', 'JoJo', 'Hirohiko Araki.', "Style of Hirohiko Araki (JoJo). Heavy contouring on faces, fabulous posing, fashion focus, dramatic shading lines, intense expressions.");
defineStyle('style-berserk', 'Berserk', 'Kentaro Miura detail.', "Style of Kentaro Miura (Berserk). Insane level of cross-hatching detail, gritty dark fantasy, hyper-detailed armor and monsters.");
defineStyle('style-junji-ito', 'Junji Ito', 'Horror spirals.', "Style of Junji Ito. Unsettling realism, obsession with spirals/holes, heavy black ink, dead eyes, grotesque organic textures.");
defineStyle('style-rumiko', 'Rumiko', 'Takahashi style.', "Style of Rumiko Takahashi (Inuyasha/Ranma). Large expressive eyes, soft hair, distinct noses, 80s/90s manga aesthetic.");
defineStyle('style-tezuka', 'Tezuka', 'Astro Boy / God of Manga.', "Style of Osamu Tezuka. Round forms, star system characters, disney-influenced large eyes, rounded limbs, classic manga.");

// --- FANTASY / SCI-FI ---
defineStyle('style-frazetta', 'Frazetta', 'Frank Frazetta Fantasy.', "Style of Frank Frazetta. Dynamic muscle tension, shadows, barbarian aesthetic, weight and power, heavy contrast.");
defineStyle('style-vallejo', 'Vallejo', 'Boris Vallejo.', "Style of Boris Vallejo. Hyper-realistic anatomy, oiled skin sheen, heroic poses, soft blending converted to line, high fantasy.");
defineStyle('style-giger', 'Giger', 'Biomechanic.', "Style of H.R. Giger. Biomechanical, fusion of flesh and machine, ribs, tubes, monochromatic nightmare, industrial organic.");
defineStyle('style-amano', 'Amano', 'Final Fantasy concept.', "Style of Yoshitaka Amano. Wispy flowing lines, ethereal, watercolor-like delicacy, pale, intricate patterns, dreamlike.");
defineStyle('style-diterlizzi', 'Spiderwick', 'Tony DiTerlizzi.', "Style of Tony DiTerlizzi. Whimsical faerie tale, Arthur Rackham influence, ink and watercolor look, goblin/creature focus.");
defineStyle('style-rackham', 'Rackham', 'Arthur Rackham.', "Style of Arthur Rackham. Twisted trees, gnarly roots, muted fairy tale atmosphere, intricate ink lines, old storybook aesthetic.");
defineStyle('style-mtg', 'Magic Card', 'Modern Fantasy Illustration.', "Style of modern Magic: The Gathering card art. High detail realism, dynamic lighting, magical effects, epic scale.");

// --- ART MOVEMENTS ---
defineStyle('style-art-nouveau', 'Art Nouveau', 'Mucha style.', "Art Nouveau / Alphonse Mucha. Flowing organic lines, floral motifs, decorative borders, elegant hair curves, idealized beauty.");
defineStyle('style-art-deco', 'Art Deco', 'Geometric 1920s.', "Art Deco. Geometric shapes, sunburst motifs, streamlined forms, industrial elegance, high contrast, 1920s poster style.");
defineStyle('style-bauhaus', 'Bauhaus', 'Minimalist geometric.', "Bauhaus style. Form follows function. Geometric primitives, clean lines, asymmetry, minimal detail, bold composition.");
defineStyle('style-cubism', 'Cubism', 'Picasso style.', "Cubism. Fragmented subjects, multiple viewpoints simultaneously, geometric deconstruction, abstract forms.");
defineStyle('style-surrealism', 'Surrealism', 'Dali style.', "Surrealism. Dream logic, melting forms, impossible juxtapositions, hyper-real rendering of unreal objects.");
defineStyle('style-expressionism', 'Expressionism', 'Munch style.', "Expressionism. Distorted forms to evoke emotion, swirling lines, angst, psychological intensity.");
defineStyle('style-stained-glass', 'Stained Glass', 'Thick lead lines.', "Stained Glass. Thick black lead outlines, fragmented color fields (represented by space), religious/medieval aesthetic.");
defineStyle('style-pixel-art', 'Pixel Art', 'Retro game sprite.', "Pixel Art style. Jagged edges, stair-step lines, limited resolution aesthetic, retro video game look.");
defineStyle('style-low-poly', 'Low Poly', '3D mesh wireframe.', "Low Poly Wireframe. Triangular mesh, sharp edges, computer graphics aesthetic, polygon reduction.");
defineStyle('style-paper-cutout', 'Paper Cutout', 'Layered paper.', "Paper Cutout style. Flat layers, sharp scissor edges, depth implied by shadow overlap, Matisse influence.");
defineStyle('style-origami', 'Origami', 'Folded paper.', "Origami style. Straight crease lines, geometric facets, paper texture implied, folded construction.");
defineStyle('style-claymation', 'Claymation', 'Aardman style.', "Claymation / Aardman style. Soft rounded forms, fingerprints visible, wide eyes, toothy grins, plasticine aesthetic.");

// --- TECHNIQUES ---
defineStyle('style-stipple', 'Stippling', 'Dotwork shading.', "Stippling / Pointillism. Images created entirely from dots. Density of dots creates shading. No solid lines where possible.");
defineStyle('style-hatching', 'Cross-Hatching', 'Engraving style.', "Cross-hatching. Shading created by intersecting sets of parallel lines. Banknote or old engraving aesthetic.");
defineStyle('style-charcoal', 'Charcoal', 'Smudged soft lines.', "Charcoal drawing. Rough texture, soft smudged edges, deep blacks, expressive sweeping strokes.");
defineStyle('style-ink-wash', 'Ink Wash', 'Sumi-e.', "Sumi-e / Ink Wash. Varying brush opacity, bleeding edges, focus on essence over detail, zen aesthetic.");
defineStyle('style-chalk', 'Chalk', 'Chalkboard art.', "Chalk style. Rough texture, white lines on dark background (inverted), dusty edges, broad strokes.");
defineStyle('style-crayon', 'Crayon', 'Child drawing.', "Crayon / Wax resist. Waxy texture, uneven coverage, childlike strokes, rough paper texture.");
defineStyle('style-watercolor', 'Watercolor', 'Line and wash.', "Watercolor Line and Wash. Loose fluid ink lines, suggestion of paint pooling, organic happy accidents.");
defineStyle('style-vector', 'Vector', 'Clean illustrator.', "Vector Art. Mathematical precision, perfect bezier curves, constant line width, scalable aesthetic, logo design.");

// 6. UTILITY
addTask(createDefinition('scan-people', 'Scanner', 'Utility', 'Utility', () => ''));
addTask(createDefinition('generate-name', 'Name Generator', 'Utility', 'Utility', () => ''));
addTask(createDefinition('upscale', 'Upscale 4K', 'Utility', 'Utility', () => ''));

// 7. LEGACY MAPPINGS
addTask(createDefinition('model', 'Legacy Character', 'Deprecated', 'Person', p => charPrompt('clothed', p, "Extract character"), false));
addTask(createDefinition('nude', 'Legacy Nude', 'Deprecated', 'Person', p => charPrompt('nude', p, "Anatomical figure study"), false));
addTask(createDefinition('neutral', 'Legacy Neutral', 'Deprecated', 'Person', p => charPrompt('clothed', p, "Reconstruct in Neutral A-Pose"), false));
addTask(createDefinition('neutral-nude', 'Legacy Neutral Nude', 'Deprecated', 'Person', p => charPrompt('nude', p, "Reconstruct in Neutral A-Pose (Nude)"), false));