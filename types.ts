

export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  ENDED = 'ENDED' // For jobs that cannot be retried
}

export type TaskType = 'full' | 'model' | 'background' | 'model-full' | 'backside' | 'scan-people' | 'nude' | 'nude-opposite' | 'face' | 'all-people' | 'all-people-nude' | 'upscale';

export interface GeneratedImage {
  type: TaskType;
  url: string;
}

export interface SourceImage {
  id: string;
  file: File;
  thumbnailUrl: string;
  timestamp: number;
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

export interface AppOptions {
  taskTypes: {
    full: boolean;
    background: boolean;
    allPeople: boolean;
    allPeopleNude: boolean;
    model: boolean; // Character
    backside: boolean;
    nude: boolean;
    nudeOpposite: boolean;
    modelFull: boolean;
    face: boolean;
  };
  gender: string;
  detailLevel: string;
}