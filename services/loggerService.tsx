import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { LogEntry, LogLevel } from '../types';

interface LoggerContextType {
  logs: LogEntry[];
  addLog: (level: LogLevel, title: string, details?: any) => void;
  clearLogs: () => void;
}

const LoggerContext = createContext<LoggerContextType | undefined>(undefined);

export const useLogger = () => {
  const context = useContext(LoggerContext);
  if (!context) {
    throw new Error('useLogger must be used within a LoggerProvider');
  }
  return context;
};

export const LoggerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((level: LogLevel, title: string, details?: any) => {
    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      title,
      details,
    };
    setLogs((prev) => [newLog, ...prev]);
    
    // Also log to browser console for dev convenience
    if (level === LogLevel.ERROR) console.error(title, details);
    else if (level === LogLevel.WARN) console.warn(title, details);
    else console.log(`[${level}] ${title}`, details);

  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <LoggerContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LoggerContext.Provider>
  );
};