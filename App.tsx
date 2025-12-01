
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLogger } from './services/loggerService';
import { generateLineArtVariations, generateAnalysisReport } from './services/geminiService';
import Console from './components/Console';
import ImageViewer from './components/ImageViewer';
import { QueueItem, ProcessingStatus, LogLevel, LogEntry } from './types';
import { Upload, X, RefreshCw, AlertCircle, CheckCircle2, Image as ImageIcon, Terminal, Maximize, Play, Pause, Layers, User, Image, Trash2, Eraser, Key, ChevronDown, AlertTriangle, Brain, FileText } from 'lucide-react';

const MAX_CONCURRENT_REQUESTS = 1;
const AUTO_RETRY_LIMIT = 3;
const MAX_TOTAL_RETRIES = 10;

export default function App() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processingCount, setProcessingCount] = useState(0);
  const [isProcessingEnabled, setIsProcessingEnabled] = useState(false); // Default stopped
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isErrorDropdownOpen, setIsErrorDropdownOpen] = useState(false);
  const { addLog, logs } = useLogger();

  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  // Derived state
  const inputQueue = queue.filter(item => item.status === ProcessingStatus.PENDING || item.status === ProcessingStatus.PROCESSING);
  const successQueue = queue.filter(item => item.status === ProcessingStatus.SUCCESS);
  const errorQueue = queue.filter(item => item.status === ProcessingStatus.ERROR);

  // Error History Logic
  const errorLogs = logs.filter(l => l.level === LogLevel.ERROR);
  // Get distinct error messages (combining title and details for uniqueness)
  const uniqueErrors = errorLogs.reduce((acc: LogEntry[], current) => {
    const msg = `${current.title} ${JSON.stringify(current.details || '')}`;
    if (!acc.find(item => `${item.title} ${JSON.stringify(item.details || '')}` === msg)) {
      acc.push(current);
    }
    return acc;
  }, []).slice(0, 5);
  
  const lastError = errorLogs.length > 0 ? errorLogs[0] : null;

  const getErrorMessage = (log: LogEntry) => {
    let detailMsg = '';
    if (log.details) {
       if (typeof log.details === 'string') detailMsg = log.details;
       else if (log.details.message) detailMsg = log.details.message;
       else detailMsg = JSON.stringify(log.details);
    }
    return `${log.title}${detailMsg ? `: ${detailMsg}` : ''}`;
  };


  // --- Handlers ---

  const handleApiKeyChange = async () => {
    try {
      if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
        // Force re-read of env in next process cycle implicitly
        addLog(LogLevel.INFO, "API Key update requested by user.");
      } else {
        alert("API Key selection is not available in this environment.");
      }
    } catch (e) {
      console.error("Failed to open API key selector", e);
    }
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const newItems: QueueItem[] = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .map(file => ({
        id: crypto.randomUUID(),
        file,
        thumbnailUrl: URL.createObjectURL(file),
        status: ProcessingStatus.PENDING,
        timestamp: Date.now(),
        retryCount: 0,
        errorHistory: []
      }));

    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems]);
      addLog(LogLevel.INFO, `Added ${newItems.length} files to input queue.`);
    }
  }, [addLog]);

  // Global DnD Handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.some(type => type === 'Files')) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounter.current = 0;
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleRetry = (id: string) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      // Status to PENDING. retryCount and errorHistory are preserved.
      // Retry count will increment upon next failure.
      const others = prev.filter(i => i.id !== id);
      return [...others, { ...item, status: ProcessingStatus.PENDING, errorMessage: undefined }];
    });
    addLog(LogLevel.INFO, `Manually retrying item ${id}`);
  };

  const handleRetryAll = () => {
    // When retrying all, we want to reset them to pending.
    setQueue(prev => prev.map(item => 
      item.status === ProcessingStatus.ERROR 
        ? { ...item, status: ProcessingStatus.PENDING, errorMessage: undefined }
        : item
    ));
    addLog(LogLevel.INFO, "Retrying all failed items.");
  };

  const handleDelete = (id: string) => {
    setQueue(prev => prev.filter(i => i.id !== id));
    addLog(LogLevel.INFO, `Deleted item ${id}`);
  };

  const handleClearInputQueue = () => {
    setQueue(prev => prev.filter(i => i.status !== ProcessingStatus.PENDING));
    addLog(LogLevel.INFO, "Cleared input queue (removed all pending items).");
  };

  const handleDeleteAllErrors = () => {
    setQueue(prev => prev.filter(i => i.status !== ProcessingStatus.ERROR));
    addLog(LogLevel.INFO, "Deleted all error items.");
  };

  const handleClearGallery = () => {
    setQueue(prev => prev.filter(i => i.status !== ProcessingStatus.SUCCESS));
    addLog(LogLevel.INFO, "Cleared gallery (removed all success items).");
  };

  const triggerDownload = (url: string, originalFilename: string, prefix: string, extension: string = 'png') => {
    try {
      const a = document.createElement('a');
      a.href = url;
      const nameWithoutExt = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
      a.download = `${prefix}${nameWithoutExt}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.warn("Auto-download failed", e);
    }
  };

  // --- Processing Logic ---

  useEffect(() => {
    const processNext = async () => {
      if (!isProcessingEnabled) return;
      if (processingCount >= MAX_CONCURRENT_REQUESTS) return;

      // STRICT FIFO: Only pick the very first pending item
      const nextItem = queue.find(item => item.status === ProcessingStatus.PENDING);
      if (!nextItem) return;

      // Start processing
      setProcessingCount(prev => prev + 1);
      setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: ProcessingStatus.PROCESSING } : i));
      setProcessingStatus(`Initializing ${nextItem.file.name} (Attempt ${nextItem.retryCount + 1})...`);
      
      const apiKey = process.env.API_KEY || '';
      if (!apiKey) {
        addLog(LogLevel.ERROR, 'Missing API Key');
        setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: ProcessingStatus.ERROR, errorMessage: 'API Key missing' } : i));
        setProcessingCount(prev => prev - 1);
        setProcessingStatus("");
        return;
      }

      try {
        let results;

        if (nextItem.retryCount >= MAX_TOTAL_RETRIES) {
             addLog(LogLevel.INFO, `Retry limit reached (${nextItem.retryCount}). Switching to Cloud Vision Analysis for ${nextItem.file.name}`);
             setProcessingStatus(`Generating Cloud Vision Report for ${nextItem.file.name}...`);
             results = await generateAnalysisReport(
                nextItem.file, 
                apiKey, 
                nextItem.errorHistory,
                addLog,
                (msg) => setProcessingStatus(msg)
             );
        } else {
             addLog(LogLevel.INFO, `Starting line art processing for ${nextItem.file.name}`);
             results = await generateLineArtVariations(
              nextItem.file, 
              apiKey, 
              addLog,
              (msg) => setProcessingStatus(msg)
            );
        }
        
        setQueue(prev => prev.map(i => i.id === nextItem.id ? { 
          ...i, 
          status: ProcessingStatus.SUCCESS, 
          results 
        } : i));
        
        addLog(LogLevel.INFO, `Successfully processed ${nextItem.file.name}`);
        
        // Auto Download
        results.forEach(res => {
            if (res.type === 'report') {
                triggerDownload(res.url, nextItem.file.name, '', 'md');
            } else {
                let prefix = 'Line-';
                if (res.type === 'model') prefix = 'Line-Model-';
                if (res.type === 'background') prefix = 'Line-Background-';
                triggerDownload(res.url, nextItem.file.name, prefix, 'png');
            }
        });
        addLog(LogLevel.INFO, `Triggered auto-downloads for ${nextItem.file.name}`);

      } catch (err: any) {
        const errorMsg = err.message || 'Unknown error';
        const nextRetryCount = nextItem.retryCount + 1;
        const newHistory = [...nextItem.errorHistory, errorMsg];

        // Determine if we should auto-retry
        // We retry automatically for first 3 attempts (count 0, 1, 2)
        // If nextRetryCount < AUTO_RETRY_LIMIT (3), we go back to PENDING immediately.
        
        let nextStatus = ProcessingStatus.ERROR;
        
        if (nextRetryCount < AUTO_RETRY_LIMIT) {
            nextStatus = ProcessingStatus.PENDING;
            addLog(LogLevel.INFO, `Auto-retrying ${nextItem.file.name} (Attempt ${nextRetryCount + 1})`);
        } else {
            addLog(LogLevel.WARN, `Failed ${nextItem.file.name} after ${nextRetryCount} attempts. Waiting for manual retry.`);
        }
        
        setQueue(prev => prev.map(i => i.id === nextItem.id ? { 
          ...i, 
          status: nextStatus, 
          errorMessage: errorMsg,
          retryCount: nextRetryCount,
          errorHistory: newHistory
        } : i));
        
        if (errorMsg.includes("blocked by safety")) {
          addLog(LogLevel.WARN, `Processing blocked for ${nextItem.file.name}: ${errorMsg}`);
        } else {
          addLog(LogLevel.ERROR, `Failed to process ${nextItem.file.name}`, err);
        }
      } finally {
        setProcessingCount(prev => prev - 1);
        setProcessingStatus("");
      }
    };

    processNext();
  }, [queue, processingCount, isProcessingEnabled, addLog]);


  // --- Render ---

  return (
    <div 
      className="flex flex-col h-screen w-screen bg-[#0f0f16] text-slate-200 font-sans overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => isErrorDropdownOpen && setIsErrorDropdownOpen(false)}
    >
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute top-[40%] right-[0%] w-[40%] h-[60%] bg-blue-900/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Full Screen Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-4 z-50 rounded-3xl border-4 border-dashed border-indigo-500 bg-[#0f0f16]/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in pointer-events-none">
          <Upload className="w-24 h-24 text-indigo-400 mb-6 animate-bounce" />
          <h2 className="text-4xl font-bold text-white tracking-tight">Drop images to process</h2>
          <p className="text-slate-400 mt-2 font-mono">Support for multiple files</p>
        </div>
      )}

      {/* Header Bar */}
      <header className="relative z-20 flex-none h-16 border-b border-white/5 bg-[#181825]/80 backdrop-blur-md flex items-center justify-between px-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center">
             <ImageIcon className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">LineArtify <span className="text-indigo-400 text-sm font-normal ml-1">Gemini Edition</span></h1>
        </div>
        
        {/* Central Status Indicator */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {processingStatus && (
            <div className="flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-4 py-1.5 rounded-full text-sm font-mono shadow-[0_0_15px_rgba(99,102,241,0.2)] animate-pulse">
              <Brain size={16} className="animate-pulse" />
              <span>{processingStatus}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
            {/* Error Display Widget */}
            {lastError && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsErrorDropdownOpen(!isErrorDropdownOpen); }}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-red-900/20 border border-red-500/30 text-red-300 hover:bg-red-900/40 transition-colors text-xs font-mono max-w-[200px]"
                >
                  <AlertTriangle size={14} className="shrink-0" />
                  <span className="truncate">{getErrorMessage(lastError)}</span>
                  <ChevronDown size={12} className="shrink-0 opacity-50" />
                </button>

                {isErrorDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-96 bg-[#1e1e2e] border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col">
                    <div className="bg-red-900/20 p-2 border-b border-white/5 text-xs font-bold text-red-300 flex items-center">
                      <AlertCircle size={12} className="mr-2" /> Recent Errors
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {uniqueErrors.map((err, idx) => (
                        <div key={err.id} className="p-3 border-b border-white/5 hover:bg-white/5 text-xs font-mono text-slate-300 break-words">
                          <div className="opacity-50 text-[10px] mb-1">{err.timestamp.toLocaleTimeString()}</div>
                          {getErrorMessage(err)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="h-6 w-px bg-white/10 mx-2"></div>

             {/* API Key Button */}
            <button
              onClick={handleApiKeyChange}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Set API Key"
            >
              <Key size={20} />
            </button>

            {/* Console Button */}
            <button
              onClick={() => setIsConsoleOpen(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Open Console"
            >
              <Terminal size={20} />
            </button>

             {/* Start/Stop Button */}
            <button
              onClick={() => setIsProcessingEnabled(!isProcessingEnabled)}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-full font-medium transition-all shadow-lg ml-2 text-sm ${
                isProcessingEnabled 
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30' 
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
              }`}
            >
              {isProcessingEnabled ? (
                <>
                  <Pause size={16} className="fill-current" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play size={16} className="fill-current" />
                  <span>Start</span>
                </>
              )}
            </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 p-4 gap-4 relative z-10">
        
        {/* Left Column: Input Queue */}
        <div className="w-80 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-xl animate-fade-in-left flex-none">
          <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <h2 className="font-bold text-slate-100 flex items-center"><Upload className="mr-2 w-4 h-4 text-indigo-400" /> Input Queue</h2>
            <div className="flex items-center space-x-2">
                <span className="text-xs font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">{inputQueue.length}</span>
                {inputQueue.length > 0 && (
                  <button 
                    onClick={handleClearInputQueue}
                    title="Clean Queue"
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Visual Drop Area / Click to Upload */}
            <div 
              className="border-2 border-dashed border-indigo-500/30 rounded-xl p-6 text-center transition-all hover:border-indigo-400/60 hover:bg-indigo-500/5 group cursor-pointer relative"
            >
              <input 
                type="file" 
                multiple 
                accept="image/*"
                onChange={(e) => handleFiles(e.target.files)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-slate-300">Drop images here</p>
              <p className="text-xs text-slate-500 mt-1">or click to browse</p>
            </div>

            {/* List */}
            {inputQueue.map(item => (
              <div key={item.id} className="flex items-center p-2 bg-slate-800/40 rounded-lg border border-white/5 relative group">
                <div className="w-12 h-12 rounded overflow-hidden bg-slate-900 shrink-0">
                  <img src={item.thumbnailUrl} alt="Thumb" className="w-full h-full object-cover" />
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{item.file.name}</p>
                  <div className="flex items-center mt-1">
                    {item.status === ProcessingStatus.PROCESSING ? (
                      <span className="text-xs text-amber-400 flex items-center animate-pulse">
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> 
                         {item.retryCount >= MAX_TOTAL_RETRIES 
                            ? "Analyzing..." 
                            : item.retryCount > 0 
                                ? `Retry ${item.retryCount}...` 
                                : "Processing..."}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 flex items-center">
                         {item.retryCount > 0 ? `Queued (Retry ${item.retryCount})` : "Waiting..."}
                      </span>
                    )}
                  </div>
                </div>
                {item.status !== ProcessingStatus.PROCESSING && (
                   <button 
                     onClick={() => handleDelete(item.id)}
                     className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                   >
                     <X size={14} />
                   </button>
                )}
              </div>
            ))}
          </div>
          
          <div className="p-3 border-t border-white/5 bg-slate-900/30 text-xs text-center text-slate-500">
            Powered by Gemini 2.5 Flash
          </div>
        </div>

        {/* Center Column: Results Gallery */}
        <div className="flex-1 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-xl min-w-0">
           <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <h2 className="font-bold text-slate-100 flex items-center"><ImageIcon className="mr-2 w-4 h-4 text-emerald-400" /> Line Art Gallery</h2>
            <div className="flex items-center space-x-3">
               <span className="text-xs text-slate-400" title="Katje stands for Knowledge And Technology Joyfully Engaged">Copyright © Katje B.V.</span>
               {successQueue.length > 0 && (
                 <button 
                   onClick={handleClearGallery}
                   title="Clear Gallery"
                   className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                 >
                   <Eraser size={16} />
                 </button>
               )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 bg-slate-900/40">
            {successQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                  <ImageIcon size={40} />
                </div>
                <p>No results yet.</p>
                <p className="text-sm">Start processing to generate line art.</p>
              </div>
            ) : (
              <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
                {successQueue.flatMap(item => (
                  (item.results || []).map((result, idx) => (
                    <div key={`${item.id}-${result.type}`} className="group relative break-inside-avoid bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all hover:scale-[1.02] border-4 border-white mb-6">
                      
                      {result.type === 'report' ? (
                          // Report Card
                          <div className="w-full h-64 bg-slate-800 flex flex-col items-center justify-center p-4 text-center">
                             <FileText size={48} className="text-indigo-400 mb-2" />
                             <h3 className="text-white font-bold mb-1">Analysis Report</h3>
                             <p className="text-slate-400 text-xs">Line Art failed {MAX_TOTAL_RETRIES}x</p>
                             <p className="text-slate-500 text-[10px] mt-2">Cloud Vision Analysis Generated</p>
                          </div>
                      ) : (
                          // Image Card
                          <img 
                            src={result.url} 
                            alt="Result" 
                            className="w-full h-auto object-contain p-2" 
                          />
                      )}
                      
                      {/* Type Badge */}
                      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-[10px] uppercase font-bold tracking-wider backdrop-blur-sm flex items-center">
                        {result.type === 'full' && <Layers size={10} className="mr-1"/>}
                        {result.type === 'model' && <User size={10} className="mr-1"/>}
                        {result.type === 'background' && <Image size={10} className="mr-1"/>}
                        {result.type === 'report' && <FileText size={10} className="mr-1"/>}
                        {result.type}
                      </div>

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-3">
                        {result.type !== 'report' && (
                             <button 
                               onClick={() => setViewerUrl(result.url)}
                               className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium text-sm flex items-center transform translate-y-4 group-hover:translate-y-0 transition-transform"
                             >
                               <Maximize size={16} className="mr-2" /> Inspect
                             </button>
                        )}
                        {result.type === 'report' && (
                             <button 
                               onClick={() => triggerDownload(result.url, item.file.name, '', 'md')}
                               className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium text-sm flex items-center transform translate-y-4 group-hover:translate-y-0 transition-transform"
                             >
                               <FileText size={16} className="mr-2" /> Download Report
                             </button>
                        )}
                      </div>
                      
                      {/* Source Filename Label */}
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur text-white text-[10px] p-2 truncate text-center translate-y-full group-hover:translate-y-0 transition-transform">
                        {item.file.name}
                      </div>
                    </div>
                  ))
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Error Queue */}
        <div className="w-80 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-xl animate-fade-in-right flex-none">
           <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <h2 className="font-bold text-slate-100 flex items-center"><AlertCircle className="mr-2 w-4 h-4 text-red-400" /> Error Queue</h2>
             <span className="text-xs font-mono bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{errorQueue.length}</span>
          </div>
          
          {/* Retry/Delete All Header */}
          {errorQueue.length > 0 && (
             <div className="px-3 py-2 bg-red-500/5 border-b border-red-500/10 flex space-x-2">
                <button 
                  onClick={handleRetryAll}
                  className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold uppercase tracking-wider rounded border border-red-500/20 transition-colors flex items-center justify-center"
                >
                  <RefreshCw size={12} className="mr-2" /> Retry All
                </button>
                <button 
                  onClick={handleDeleteAllErrors}
                  className="w-8 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold uppercase tracking-wider rounded border border-red-500/20 transition-colors flex items-center justify-center"
                  title="Delete All Errors"
                >
                  <Trash2 size={12} />
                </button>
             </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
             {errorQueue.length === 0 && (
               <div className="mt-10 text-center text-slate-600 text-sm">
                 <div className="inline-block p-3 rounded-full bg-slate-800/50 mb-2">
                   <CheckCircle2 size={20} className="text-emerald-500/50" />
                 </div>
                 <p>All systems normal.</p>
               </div>
             )}
             
             {errorQueue.map(item => (
               <div key={item.id} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                 <div className="flex items-start mb-2">
                   <div className="w-12 h-12 rounded overflow-hidden bg-slate-900 shrink-0 border border-red-500/20">
                    <img src={item.thumbnailUrl} alt="Thumb" className="w-full h-full object-cover" />
                  </div>
                  <div className="ml-3 min-w-0 flex-1">
                     <p className="text-sm font-medium text-slate-200 truncate">{item.file.name}</p>
                     <p className="text-xs text-red-300 mt-1 line-clamp-2">{item.errorMessage}</p>
                     <div className="mt-1 flex items-center text-[10px] text-slate-400">
                        <span className="font-mono bg-white/5 px-1 rounded">Retry #{item.retryCount}</span>
                     </div>
                  </div>
                 </div>
                 <div className="flex space-x-2 mt-2">
                   <button 
                    onClick={() => handleRetry(item.id)}
                    className="flex-1 py-1.5 px-3 bg-white/5 hover:bg-white/10 rounded text-xs font-medium text-slate-200 transition-colors flex items-center justify-center"
                   >
                     <RefreshCw size={12} className="mr-1.5" /> 
                     {item.retryCount >= MAX_TOTAL_RETRIES ? "Run Analysis" : "Retry"}
                   </button>
                   <button 
                    onClick={() => handleDelete(item.id)}
                    className="flex-1 py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 rounded text-xs font-medium text-red-300 transition-colors flex items-center justify-center"
                   >
                     <X size={12} className="mr-1.5" /> Delete
                   </button>
                 </div>
               </div>
             ))}
          </div>
        </div>

      </div>

      {/* Modals */}
      <Console isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} />
      {viewerUrl && <ImageViewer imageUrl={viewerUrl} onClose={() => setViewerUrl(null)} />}

    </div>
  );
}