export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  ENDED = 'ENDED' // For jobs that cannot be retried
}

export type TaskType = 
  // Scenes
  'full' | 'full-nude' | 'background' | 
  // Groups
  'all-people' | 'all-people-nude' |
  // Body (Expanded with Anatomy/Skeleton)
  'model-full' | 'model-full-nude' | 'model-full-anatomy' | 'model-full-skeleton' |
  'body-front' | 'body-front-nude' | 'body-front-anatomy' | 'body-front-skeleton' |
  'body-left' | 'body-left-nude' | 'body-left-anatomy' | 'body-left-skeleton' |
  'body-right' | 'body-right-nude' | 'body-right-anatomy' | 'body-right-skeleton' |
  'backside' | 'nude-opposite' | 'backside-anatomy' | 'backside-skeleton' |
  
  // Faces (Expanded)
  'face-asis' | 'face' | 'face-left' | 'face-right' | 'face-back' |
  
  // --- STYLES (Existing) ---
  'chibi' | 'chibi-nude' | 'chibi-topless' | 'chibi-bottomless' |
  'anime' | 'anime-nude' | 'anime-topless' | 'anime-bottomless' |
  'sketch' | 'sketch-nude' | 'sketch-topless' | 'sketch-bottomless' |
  'coloring-book' | 'coloring-book-nude' | 'coloring-book-topless' | 'coloring-book-bottomless' |
  'cyberpunk' | 'cyberpunk-nude' | 'cyberpunk-topless' | 'cyberpunk-bottomless' |
  'noir' | 'noir-nude' | 'noir-topless' | 'noir-bottomless' |
  'impressionist' | 'impressionist-nude' | 'impressionist-topless' | 'impressionist-bottomless' |
  'sticker' | 'sticker-nude' | 'sticker-topless' | 'sticker-bottomless' |
  'fantasy' | 'fantasy-nude' | 'fantasy-topless' | 'fantasy-bottomless' |
  'elfquest' | 'elfquest-nude' | 'elfquest-topless' | 'elfquest-bottomless' |
  'european-comic' | 'european-comic-nude' | 'european-comic-topless' | 'european-comic-bottomless' |
  'american-comic' | 'american-comic-nude' | 'american-comic-topless' | 'american-comic-bottomless' |
  'manga' | 'manga-nude' | 'manga-topless' | 'manga-bottomless' |
  'pinup' | 'pinup-nude' | 'pinup-topless' | 'pinup-bottomless' |
  'mecha' | 'mecha-nude' | 'mecha-topless' | 'mecha-bottomless' |
  'blueprint' | 'blueprint-nude' | 'blueprint-topless' | 'blueprint-bottomless' |
  'woodcut' | 'woodcut-nude' | 'woodcut-topless' | 'woodcut-bottomless' |
  'popart' | 'popart-nude' | 'popart-topless' | 'popart-bottomless' |
  'ukiyo' | 'ukiyo-nude' | 'ukiyo-topless' | 'ukiyo-bottomless' |
  'graffiti' | 'graffiti-nude' | 'graffiti-topless' | 'graffiti-bottomless' |
  'horror' | 'horror-nude' | 'horror-topless' | 'horror-bottomless' |

  // --- STYLES (New Expansion - Western) ---
  'style-ligne-claire' | 'style-ligne-claire-nude' | 'style-ligne-claire-topless' | 'style-ligne-claire-bottomless' |
  'style-asterix' | 'style-asterix-nude' | 'style-asterix-topless' | 'style-asterix-bottomless' |
  'style-spirou' | 'style-spirou-nude' | 'style-spirou-topless' | 'style-spirou-bottomless' |
  'style-lucky' | 'style-lucky-nude' | 'style-lucky-topless' | 'style-lucky-bottomless' |
  'style-moebius' | 'style-moebius-nude' | 'style-moebius-topless' | 'style-moebius-bottomless' |
  'style-peanuts' | 'style-peanuts-nude' | 'style-peanuts-topless' | 'style-peanuts-bottomless' |
  'style-calvin' | 'style-calvin-nude' | 'style-calvin-topless' | 'style-calvin-bottomless' |
  'style-garfield' | 'style-garfield-nude' | 'style-garfield-topless' | 'style-garfield-bottomless' |
  'style-simpsons' | 'style-simpsons-nude' | 'style-simpsons-topless' | 'style-simpsons-bottomless' |
  'style-kirby' | 'style-kirby-nude' | 'style-kirby-topless' | 'style-kirby-bottomless' |
  'style-miller' | 'style-miller-nude' | 'style-miller-topless' | 'style-miller-bottomless' |
  'style-mignola' | 'style-mignola-nude' | 'style-mignola-topless' | 'style-mignola-bottomless' |
  'style-timm' | 'style-timm-nude' | 'style-timm-topless' | 'style-timm-bottomless' |
  'style-fleischer' | 'style-fleischer-nude' | 'style-fleischer-topless' | 'style-fleischer-bottomless' |
  'style-hanna' | 'style-hanna-nude' | 'style-hanna-topless' | 'style-hanna-bottomless' |
  'style-disney' | 'style-disney-nude' | 'style-disney-topless' | 'style-disney-bottomless' |
  'style-looney' | 'style-looney-nude' | 'style-looney-topless' | 'style-looney-bottomless' |
  'style-archies' | 'style-archies-nude' | 'style-archies-topless' | 'style-archies-bottomless' |
  'style-manara' | 'style-manara-nude' | 'style-manara-topless' | 'style-manara-bottomless' |
  'style-fenzo' | 'style-fenzo-nude' | 'style-fenzo-topless' | 'style-fenzo-bottomless' |

  // --- STYLES (New Expansion - Eastern) ---
  'style-toriyama' | 'style-toriyama-nude' | 'style-toriyama-topless' | 'style-toriyama-bottomless' |
  'style-ghibli' | 'style-ghibli-nude' | 'style-ghibli-topless' | 'style-ghibli-bottomless' |
  'style-oda' | 'style-oda-nude' | 'style-oda-topless' | 'style-oda-bottomless' |
  'style-jojo' | 'style-jojo-nude' | 'style-jojo-topless' | 'style-jojo-bottomless' |
  'style-berserk' | 'style-berserk-nude' | 'style-berserk-topless' | 'style-berserk-bottomless' |
  'style-junji-ito' | 'style-junji-ito-nude' | 'style-junji-ito-topless' | 'style-junji-ito-bottomless' |
  'style-rumiko' | 'style-rumiko-nude' | 'style-rumiko-topless' | 'style-rumiko-bottomless' |
  'style-tezuka' | 'style-tezuka-nude' | 'style-tezuka-topless' | 'style-tezuka-bottomless' |

  // --- STYLES (New Expansion - Fantasy/SciFi) ---
  'style-frazetta' | 'style-frazetta-nude' | 'style-frazetta-topless' | 'style-frazetta-bottomless' |
  'style-vallejo' | 'style-vallejo-nude' | 'style-vallejo-topless' | 'style-vallejo-bottomless' |
  'style-giger' | 'style-giger-nude' | 'style-giger-topless' | 'style-giger-bottomless' |
  'style-amano' | 'style-amano-nude' | 'style-amano-topless' | 'style-amano-bottomless' |
  'style-diterlizzi' | 'style-diterlizzi-nude' | 'style-diterlizzi-topless' | 'style-diterlizzi-bottomless' |
  'style-rackham' | 'style-rackham-nude' | 'style-rackham-topless' | 'style-rackham-bottomless' |
  'style-mtg' | 'style-mtg-nude' | 'style-mtg-topless' | 'style-mtg-bottomless' |

  // --- STYLES (New Expansion - Artistic/Movements) ---
  'style-art-nouveau' | 'style-art-nouveau-nude' | 'style-art-nouveau-topless' | 'style-art-nouveau-bottomless' |
  'style-art-deco' | 'style-art-deco-nude' | 'style-art-deco-topless' | 'style-art-deco-bottomless' |
  'style-bauhaus' | 'style-bauhaus-nude' | 'style-bauhaus-topless' | 'style-bauhaus-bottomless' |
  'style-cubism' | 'style-cubism-nude' | 'style-cubism-topless' | 'style-cubism-bottomless' |
  'style-surrealism' | 'style-surrealism-nude' | 'style-surrealism-topless' | 'style-surrealism-bottomless' |
  'style-expressionism' | 'style-expressionism-nude' | 'style-expressionism-topless' | 'style-expressionism-bottomless' |
  'style-stained-glass' | 'style-stained-glass-nude' | 'style-stained-glass-topless' | 'style-stained-glass-bottomless' |
  'style-pixel-art' | 'style-pixel-art-nude' | 'style-pixel-art-topless' | 'style-pixel-art-bottomless' |
  'style-low-poly' | 'style-low-poly-nude' | 'style-low-poly-topless' | 'style-low-poly-bottomless' |
  'style-paper-cutout' | 'style-paper-cutout-nude' | 'style-paper-cutout-topless' | 'style-paper-cutout-bottomless' |
  'style-origami' | 'style-origami-nude' | 'style-origami-topless' | 'style-origami-bottomless' |
  'style-claymation' | 'style-claymation-nude' | 'style-claymation-topless' | 'style-claymation-bottomless' |

  // --- STYLES (New Expansion - Techniques) ---
  'style-stipple' | 'style-stipple-nude' | 'style-stipple-topless' | 'style-stipple-bottomless' |
  'style-hatching' | 'style-hatching-nude' | 'style-hatching-topless' | 'style-hatching-bottomless' |
  'style-charcoal' | 'style-charcoal-nude' | 'style-charcoal-topless' | 'style-charcoal-bottomless' |
  'style-ink-wash' | 'style-ink-wash-nude' | 'style-ink-wash-topless' | 'style-ink-wash-bottomless' |
  'style-chalk' | 'style-chalk-nude' | 'style-chalk-topless' | 'style-chalk-bottomless' |
  'style-crayon' | 'style-crayon-nude' | 'style-crayon-topless' | 'style-crayon-bottomless' |
  'style-watercolor' | 'style-watercolor-nude' | 'style-watercolor-topless' | 'style-watercolor-bottomless' |
  'style-vector' | 'style-vector-nude' | 'style-vector-topless' | 'style-vector-bottomless' |

  // --- STYLES (New Expansion - Erotic) ---
  'style-nagel' | 'style-nagel-nude' | 'style-nagel-topless' | 'style-nagel-bottomless' |
  'style-sorayama' | 'style-sorayama-nude' | 'style-sorayama-topless' | 'style-sorayama-bottomless' |
  'style-crepax' | 'style-crepax-nude' | 'style-crepax-topless' | 'style-crepax-bottomless' |
  'style-tom-finland' | 'style-tom-finland-nude' | 'style-tom-finland-topless' | 'style-tom-finland-bottomless' |
  'style-coop' | 'style-coop-nude' | 'style-coop-topless' | 'style-coop-bottomless' |
  'style-shibari' | 'style-shibari-nude' | 'style-shibari-topless' | 'style-shibari-bottomless' |
  'style-latex' | 'style-latex-nude' | 'style-latex-topless' | 'style-latex-bottomless' |
  'style-boudoir' | 'style-boudoir-nude' | 'style-boudoir-topless' | 'style-boudoir-bottomless' |
  'style-silhouette' | 'style-silhouette-nude' | 'style-silhouette-topless' | 'style-silhouette-bottomless' |
  'style-vampirella' | 'style-vampirella-nude' | 'style-vampirella-topless' | 'style-vampirella-bottomless' |
  'style-julie-bell' | 'style-julie-bell-nude' | 'style-julie-bell-topless' | 'style-julie-bell-bottomless' |

  // --- STYLES (New Expansion - Print/Graphic) ---
  'style-risograph' | 'style-risograph-nude' | 'style-risograph-topless' | 'style-risograph-bottomless' |
  'style-screenprint' | 'style-screenprint-nude' | 'style-screenprint-topless' | 'style-screenprint-bottomless' |
  'style-etching' | 'style-etching-nude' | 'style-etching-topless' | 'style-etching-bottomless' |
  'style-tattoo' | 'style-tattoo-nude' | 'style-tattoo-topless' | 'style-tattoo-bottomless' |
  'style-tarot' | 'style-tarot-nude' | 'style-tarot-topless' | 'style-tarot-bottomless' |
  'style-banknote' | 'style-banknote-nude' | 'style-banknote-topless' | 'style-banknote-bottomless' |
  'style-schematic' | 'style-schematic-nude' | 'style-schematic-topless' | 'style-schematic-bottomless' |
  'style-halftone' | 'style-halftone-nude' | 'style-halftone-topless' | 'style-halftone-bottomless' |
  'style-lithograph' | 'style-lithograph-nude' | 'style-lithograph-topless' | 'style-lithograph-bottomless' |
  'style-monoprint' | 'style-monoprint-nude' | 'style-monoprint-topless' | 'style-monoprint-bottomless' |
  'style-patch' | 'style-patch-nude' | 'style-patch-topless' | 'style-patch-bottomless' |
  'style-travel-poster' | 'style-travel-poster-nude' | 'style-travel-poster-topless' | 'style-travel-poster-bottomless' |

  // --- STYLES (New Expansion - Historical/Cultural) ---
  'style-greek-pottery' | 'style-greek-pottery-nude' | 'style-greek-pottery-topless' | 'style-greek-pottery-bottomless' |
  'style-hieroglyph' | 'style-hieroglyph-nude' | 'style-hieroglyph-topless' | 'style-hieroglyph-bottomless' |
  'style-mosaic' | 'style-mosaic-nude' | 'style-mosaic-topless' | 'style-mosaic-bottomless' |
  'style-medieval' | 'style-medieval-nude' | 'style-medieval-topless' | 'style-medieval-bottomless' |
  'style-mayan' | 'style-mayan-nude' | 'style-mayan-topless' | 'style-mayan-bottomless' |
  'style-tribal' | 'style-tribal-nude' | 'style-tribal-topless' | 'style-tribal-bottomless' |
  'style-cave' | 'style-cave-nude' | 'style-cave-topless' | 'style-cave-bottomless' |
  'style-renaissance' | 'style-renaissance-nude' | 'style-renaissance-topless' | 'style-renaissance-bottomless' |
  'style-baroque' | 'style-baroque-nude' | 'style-baroque-topless' | 'style-baroque-bottomless' |
  'style-azulejo' | 'style-azulejo-nude' | 'style-azulejo-topless' | 'style-azulejo-bottomless' |

  // Utility
  'scan-people' | 'upscale' | 'generate-name' |
  // Deprecated/Legacy mappings
  'model' | 'nude' | 'neutral' | 'neutral-nude'; 

export interface GeneratedImage {
  type: TaskType;
  url: string;
  blob?: Blob; // For DB Persistence
  prompt?: string; // Stored prompt for audit logs
}

export type PriorityLevel = 'Very Low' | 'Low' | 'Normal' | 'High' | 'Very High';

export type ModelPreference = 'flash' | 'pro';

export interface BodyHairSettings {
  [zone: string]: string; // e.g. 'armpits': 'bushy'
}

export interface AppOptions {
  taskTypes: Record<string, boolean>; 
  taskPriorities: Record<string, PriorityLevel>;
  stylePriorities: Record<string, number>; 
  gender: string;
  detailLevel: string;
  modelPreference: ModelPreference;
  creativity: number;
  customStyle: string;
  modesty: string;
  bodyHair: BodyHairSettings;
  outputFormat: 'png' | 'jpg'; // New Option
}

export interface SourceImage {
  id: string;
  file: File;
  thumbnailUrl: string;
  displayName?: string; // Generated Name
  peopleCount?: number; // Number of people found
  timestamp: number;
  options: AppOptions;
  priorityCount?: number; 
}

export interface QueueItem {
  id: string;
  sourceId: string; 
  file: File; 
  taskType: TaskType;
  personDescription?: string; 
  detectBox?: number[]; 
  thumbnailUrl: string; 
  status: ProcessingStatus;
  result?: GeneratedImage;
  errorMessage?: string;
  timestamp: number;
  retryCount: number; 
  maxRetries: number; 
  errorHistory: string[];
  isBlocked?: boolean; 
  isLastChance?: boolean; 
  priority: number; // 1-100, default 50
  customPriority?: number; // kept for legacy or additional manual tweaks
}

export interface StyleStat {
  success: number;
  failure: number;
  prohibited: number;
}

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  GEMINI_REQUEST = 'GEMINI_REQUEST',
  GEMINI_RESPONSE = 'GEMINI_RESPONSE',
  IMAGEN_REQUEST = 'IMAGEN_REQUEST',
  IMAGEN_RESPONSE = 'IMAGEN_RESPONSE'
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  title: string;
  details?: any;
}