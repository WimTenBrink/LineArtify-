import React, { useState } from 'react';
import { useLogger } from '../services/loggerService';
import { LogLevel, LogEntry } from '../types';
import { Terminal, X, Copy, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';

interface ConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

const Console: React.FC<ConsoleProps> = ({ isOpen, onClose }) => {
  const { logs, clearLogs } = useLogger();
  const [activeTab, setActiveTab] = useState<string>('ALL');

  if (!isOpen) return null;

  const tabs = [
    { id: 'ALL', label: 'All Logs' },
    { id: LogLevel.INFO, label: 'Info' },
    { id: LogLevel.WARN, label: 'Warnings' },
    { id: LogLevel.ERROR, label: 'Errors' },
    { id: LogLevel.GEMINI_REQUEST, label: 'Gemini Req' },
    { id: LogLevel.GEMINI_RESPONSE, label: 'Gemini Res' },
    // Imagen placeholders for completeness as requested
    { id: LogLevel.IMAGEN_REQUEST, label: 'Imagen Req' },
    { id: LogLevel.IMAGEN_RESPONSE, label: 'Imagen Res' },
  ];

  const filteredLogs = activeTab === 'ALL' 
    ? logs 
    : logs.filter(l => l.level === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1e2e] w-[90vw] h-[90vh] rounded-xl shadow-2xl flex flex-col border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center space-x-2 text-indigo-400">
            <Terminal size={20} />
            <h2 className="font-mono font-bold text-lg">System Console</h2>
          </div>
          <div className="flex items-center space-x-3">
             <button 
              onClick={clearLogs}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
              title="Clear Logs"
            >
              <Trash2 size={18} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto bg-slate-900 border-b border-slate-700 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id 
                  ? 'border-indigo-500 text-indigo-400 bg-slate-800' 
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Log List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#1e1e2e]">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-slate-500 mt-20 font-mono">No logs found for this filter.</div>
          ) : (
            filteredLogs.map(log => <LogItem key={log.id} log={log} />)
          )}
        </div>
      </div>
    </div>
  );
};

const LogItem: React.FC<{ log: LogEntry }> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = JSON.stringify({
      timestamp: log.timestamp,
      level: log.level,
      title: log.title,
      details: log.details
    }, null, 2);
    navigator.clipboard.writeText(text);
  };

  const getLevelColor = (level: LogLevel) => {
    switch(level) {
      case LogLevel.ERROR: return 'text-red-400 border-red-900/50 bg-red-900/10';
      case LogLevel.WARN: return 'text-amber-400 border-amber-900/50 bg-amber-900/10';
      case LogLevel.GEMINI_REQUEST: return 'text-cyan-400 border-cyan-900/50 bg-cyan-900/10';
      case LogLevel.GEMINI_RESPONSE: return 'text-emerald-400 border-emerald-900/50 bg-emerald-900/10';
      default: return 'text-slate-300 border-slate-700 bg-slate-800/50';
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${getLevelColor(log.level)}`}>
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center p-3 cursor-pointer hover:bg-white/5"
      >
        <span className="mr-2 opacity-70">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div className="flex-1 font-mono text-sm">
          <span className="opacity-60 text-xs mr-3">
            {log.timestamp.toLocaleTimeString()}.{log.timestamp.getMilliseconds().toString().padStart(3, '0')}
          </span>
          <span className="font-bold mr-2">[{log.level}]</span>
          <span>{log.title}</span>
        </div>
        <button 
          onClick={copyToClipboard}
          className="p-1.5 rounded hover:bg-white/10 text-current opacity-60 hover:opacity-100"
          title="Copy log entry"
        >
          <Copy size={14} />
        </button>
      </div>
      
      {expanded && log.details && (
        <div className="p-3 border-t border-white/10 bg-black/20 overflow-x-auto">
          <pre className="text-xs font-mono opacity-90 whitespace-pre-wrap break-words">
            {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default Console;