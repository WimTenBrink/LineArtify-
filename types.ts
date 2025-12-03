
export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export type TaskType = 'full' | 'model' | 'background' | 'model-full' | 'backside' | 'scan-people' | 'nude' | 'nude-opposite';

export interface GeneratedImage {
  type: TaskType;
  url: string;
}

export interface QueueItem {
  id: string;
  file: File;
  taskType: TaskType;
  personDescription?: string; // For multi-person extraction
  detectBox?: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  thumbnailUrl: string;
  status: ProcessingStatus;
  result?: GeneratedImage;
  errorMessage?: string;
  timestamp: number;
  retryCount: number; // Counts number of failures
  errorHistory: string[];
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