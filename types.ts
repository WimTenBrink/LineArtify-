

export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  ENDED = 'ENDED' // For jobs that cannot be retried
}

export type TaskType = 'full' | 'full-nude' | 'model' | 'background' | 'model-full' | 'backside' | 'scan-people' | 'nude' | 'nude-opposite' | 'face' | 'face-left' | 'face-right' | 'neutral' | 'neutral-nude' | 'all-people' | 'all-people-nude' | 'upscale';

export interface GeneratedImage {
  type: TaskType;
  url: string;
  blob?: Blob; // For DB Persistence
}

export type PriorityLevel = 'Very Low' | 'Low' | 'Normal' | 'High' | 'Very High';

export interface AppOptions {
  taskTypes: {
    full: boolean;
    fullNude: boolean; // New
    background: boolean;
    allPeople: boolean;
    allPeopleNude: boolean;
    model: boolean; // Character
    backside: boolean;
    nude: boolean;
    nudeOpposite: boolean;
    modelFull: boolean;
    face: boolean;
    faceLeft: boolean; 
    faceRight: boolean; 
    neutral: boolean; 
    neutralNude: boolean; 
    upscale: boolean; 
  };
  taskPriorities: {
    full: PriorityLevel;
    fullNude: PriorityLevel; // New
    background: PriorityLevel;
    allPeople: PriorityLevel;
    allPeopleNude: PriorityLevel;
    model: PriorityLevel;
    backside: PriorityLevel;
    nude: PriorityLevel;
    nudeOpposite: PriorityLevel;
    modelFull: PriorityLevel;
    face: PriorityLevel;
    faceLeft: PriorityLevel;
    faceRight: PriorityLevel;
    neutral: PriorityLevel;
    neutralNude: PriorityLevel;
    upscale: PriorityLevel;
  };
  gender: string;
  detailLevel: string;
}

export interface SourceImage {
  id: string;
  file: File;
  thumbnailUrl: string;
  timestamp: number;
  options: AppOptions; // New: Options snapshot per image
}

export interface QueueItem {
  id: string;
  sourceId: string; // Link to SourceImage
  file: File; // Reference to the file (for convenience)
  taskType: TaskType;
  personDescription?: string; // For multi-person extraction
  detectBox?: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  thumbnailUrl: string; // Reference to source thumbnail
  status: ProcessingStatus;
  result?: GeneratedImage;
  errorMessage?: string;
  timestamp: number;
  retryCount: number; // Counts number of failures
  maxRetries: number; // Limit for retries
  errorHistory: string[];
  isBlocked?: boolean; 
  isLastChance?: boolean; // For the "Failed" queue logic
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