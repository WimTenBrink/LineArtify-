
export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface GeneratedImage {
  type: 'full' | 'model' | 'background' | 'report' | 'model-full';
  url: string;
}

export interface QueueItem {
  id: string;
  file: File;
  thumbnailUrl: string;
  status: ProcessingStatus;
  results?: GeneratedImage[];
  errorMessage?: string;
  timestamp: number;
  retryCount: number;
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