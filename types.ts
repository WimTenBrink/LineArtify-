

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
  'chibi' | 'chibi-nude' |
  'anime' | 'anime-nude' |
  'sketch' | 'sketch-nude' |
  'coloring-book' | 'coloring-book-nude' |
  'cyberpunk' | 'cyberpunk-nude' |
  'noir' | 'noir-nude' |
  'impressionist' | 'impressionist-nude' |
  'sticker' | 'sticker-nude' |
  'fantasy' | 'fantasy-nude' |
  'elfquest' | 'elfquest-nude' |
  'european-comic' | 'european-comic-nude' |
  'american-comic' | 'american-comic-nude' |
  'manga' | 'manga-nude' |
  'pinup' | 'pinup-nude' |
  'mecha' | 'mecha-nude' |
  'blueprint' | 'blueprint-nude' |
  'woodcut' | 'woodcut-nude' |
  'popart' | 'popart-nude' |
  'ukiyo' | 'ukiyo-nude' |
  'graffiti' | 'graffiti-nude' |
  'horror' | 'horror-nude' |

  // --- STYLES (New Expansion - Western) ---
  'style-ligne-claire' | 'style-ligne-claire-nude' |
  'style-asterix' | 'style-asterix-nude' |
  'style-spirou' | 'style-spirou-nude' |
  'style-lucky' | 'style-lucky-nude' |
  'style-moebius' | 'style-moebius-nude' |
  'style-peanuts' | 'style-peanuts-nude' |
  'style-calvin' | 'style-calvin-nude' |
  'style-garfield' | 'style-garfield-nude' |
  'style-simpsons' | 'style-simpsons-nude' |
  'style-kirby' | 'style-kirby-nude' |
  'style-miller' | 'style-miller-nude' |
  'style-mignola' | 'style-mignola-nude' |
  'style-timm' | 'style-timm-nude' |
  'style-fleischer' | 'style-fleischer-nude' |
  'style-hanna' | 'style-hanna-nude' |
  'style-disney' | 'style-disney-nude' |
  'style-looney' | 'style-looney-nude' |
  'style-archies' | 'style-archies-nude' |
  'style-manara' | 'style-manara-nude' |
  'style-fenzo' | 'style-fenzo-nude' |

  // --- STYLES (New Expansion - Eastern) ---
  'style-toriyama' | 'style-toriyama-nude' |
  'style-ghibli' | 'style-ghibli-nude' |
  'style-oda' | 'style-oda-nude' |
  'style-jojo' | 'style-jojo-nude' |
  'style-berserk' | 'style-berserk-nude' |
  'style-junji-ito' | 'style-junji-ito-nude' |
  'style-rumiko' | 'style-rumiko-nude' |
  'style-tezuka' | 'style-tezuka-nude' |

  // --- STYLES (New Expansion - Fantasy/SciFi) ---
  'style-frazetta' | 'style-frazetta-nude' |
  'style-vallejo' | 'style-vallejo-nude' |
  'style-giger' | 'style-giger-nude' |
  'style-amano' | 'style-amano-nude' |
  'style-diterlizzi' | 'style-diterlizzi-nude' |
  'style-rackham' | 'style-rackham-nude' |
  'style-mtg' | 'style-mtg-nude' |

  // --- STYLES (New Expansion - Artistic/Movements) ---
  'style-art-nouveau' | 'style-art-nouveau-nude' |
  'style-art-deco' | 'style-art-deco-nude' |
  'style-bauhaus' | 'style-bauhaus-nude' |
  'style-cubism' | 'style-cubism-nude' |
  'style-surrealism' | 'style-surrealism-nude' |
  'style-expressionism' | 'style-expressionism-nude' |
  'style-stained-glass' | 'style-stained-glass-nude' |
  'style-pixel-art' | 'style-pixel-art-nude' |
  'style-low-poly' | 'style-low-poly-nude' |
  'style-paper-cutout' | 'style-paper-cutout-nude' |
  'style-origami' | 'style-origami-nude' |
  'style-claymation' | 'style-claymation-nude' |

  // --- STYLES (New Expansion - Techniques) ---
  'style-stipple' | 'style-stipple-nude' |
  'style-hatching' | 'style-hatching-nude' |
  'style-charcoal' | 'style-charcoal-nude' |
  'style-ink-wash' | 'style-ink-wash-nude' |
  'style-chalk' | 'style-chalk-nude' |
  'style-crayon' | 'style-crayon-nude' |
  'style-watercolor' | 'style-watercolor-nude' |
  'style-vector' | 'style-vector-nude' |

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

export interface AppOptions {
  taskTypes: Record<string, boolean>; 
  taskPriorities: Record<string, PriorityLevel>;
  gender: string;
  detailLevel: string;
  modelPreference: ModelPreference;
  creativity: number;
  customStyle: string;
  modesty: string; // New: Modesty filter options for nude styles
}

export interface SourceImage {
  id: string;
  file: File;
  thumbnailUrl: string;
  displayName?: string; // Generated Name
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