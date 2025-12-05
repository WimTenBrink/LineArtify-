

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
  // Character
  'model' | 'nude' | 
  'model-full' | 'model-full-nude' |
  'neutral' | 'neutral-nude' |
  'backside' | 'nude-opposite' |
  // Faces
  'face' | 'face-left' | 'face-right' | 
  // Styles (New & Expanded)
  'chibi' | 'chibi-nude' |
  'anime' | 'anime-nude' |
  'sketch' | 'sketch-nude' |
  'coloring-book' | 'coloring-book-nude' |
  'cyberpunk' | 'cyberpunk-nude' |
  'noir' | 'noir-nude' |
  'impressionist' | 'impressionist-nude' |
  'sticker' | 'sticker-nude' |
  'fantasy' | 'fantasy-nude' |
  // Utility
  'scan-people' | 'upscale';

export interface GeneratedImage {
  type: TaskType;
  url: string;
  blob?: Blob; // For DB Persistence
}

export type PriorityLevel = 'Very Low' | 'Low' | 'Normal' | 'High' | 'Very High';

export type ModelPreference = 'flash' | 'pro';

export interface AppOptions {
  taskTypes: Record<string, boolean>; // Converted to Record for flexibility with many types
  taskPriorities: Record<string, PriorityLevel>; // Converted to Record
  gender: string;
  detailLevel: string;
  modelPreference: ModelPreference; // New: Choose between Flash (Fast) and Pro (Quality)
  creativity: number; // New: Temperature control (0.0 to 1.0)
  customStyle: string; // New: User prompt injection
}

export interface SourceImage {
  id: string;
  file: File;
  thumbnailUrl: string;
  timestamp: number;
  options: AppOptions; 
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