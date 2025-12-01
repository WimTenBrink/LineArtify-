
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLogger } from './services/loggerService';
import { generateLineArtVariations } from './services/geminiService';
import Console from './components/Console';
import ImageViewer from './components/ImageViewer';
import { QueueItem, ProcessingStatus, LogLevel } from './types';
import { Upload, X, RefreshCw, AlertCircle, CheckCircle2, Image as ImageIcon, Terminal, Maximize, Play, Pause, Layers, User, Sparkles, Brain, Trash2, Eraser, Image } from 'lucide-react';

const MAX_CONCURRENT_REQUESTS = 1;

export default function App() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processingCount, setProcessingCount] = useState(0);
  const [isProcessingEnabled, setIsProcessingEnabled] = useState(false); // Default stopped
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const { addLog } = useLogger();

  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  // Derived state
  const inputQueue = queue.filter(item => item.status === ProcessingStatus.PENDING || item.status === ProcessingStatus.PROCESSING);
  const successQueue = queue.filter(item => item.status === ProcessingStatus.SUCCESS);
  const errorQueue = queue.filter(item => item.status === ProcessingStatus.ERROR);

  // --- Handlers ---

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const newItems: QueueItem[] = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .map(file => ({
        id: crypto.randomUUID(),
        file,
        thumbnailUrl: URL.createObjectURL(file),
        status: ProcessingStatus.PENDING,
        timestamp: Date.now()
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
      // Move to end of queue by creating new object with PENDING status
      const others = prev.filter(i => i.id !== id);
      return [...others, { ...item, status: ProcessingStatus.PENDING, errorMessage: undefined }];
    });
    addLog(LogLevel.INFO, `Retrying item ${id}`);
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

  const triggerDownload = (url: string, originalFilename: string, prefix: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      const nameWithoutExt = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
      a.download = `${prefix}${nameWithoutExt}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      // Use WARN for download issues to avoid system error flags
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
      setProcessingStatus(`Initializing ${nextItem.file.name}...`);
      
      const apiKey = process.env.API_KEY || '';
      if (!apiKey) {
        addLog(LogLevel.ERROR, 'Missing API Key');
        setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: ProcessingStatus.ERROR, errorMessage: 'API Key missing' } : i));
        setProcessingCount(prev => prev - 1);
        setProcessingStatus("");
        return;
      }

      try {
        addLog(LogLevel.INFO, `Starting processing for ${nextItem.file.name}`);
        
        // Generate variations
        const results = await generateLineArtVariations(
          nextItem.file, 
          apiKey, 
          addLog,
          (msg) => setProcessingStatus(msg)
        );
        
        setQueue(prev => prev.map(i => i.id === nextItem.id ? { 
          ...i, 
          status: ProcessingStatus.SUCCESS, 
          results 
        } : i));
        
        addLog(LogLevel.INFO, `Successfully processed ${nextItem.file.name}`);
        
        // Auto Download Each Variation
        results.forEach(res => {
            let prefix = 'Line-';
            if (res.type === 'model') prefix = 'Line-Model-';
            if (res.type === 'background') prefix = 'Line-Background-';
            
            triggerDownload(res.url, nextItem.file.name, prefix);
        });
        addLog(LogLevel.INFO, `Triggered auto-downloads for ${nextItem.file.name}`);

      } catch (err: any) {
        const errorMsg = err.message || 'Unknown error';
        
        setQueue(prev => prev.map(i => i.id === nextItem.id ? { 
          ...i, 
          status: ProcessingStatus.ERROR, 
          errorMessage: errorMsg
        } : i));
        
        // Log as WARN if it's a safety block to prevent AI Studio "fix these errors" spam
        // Log as ERROR for unexpected crashes
        if (errorMsg.includes("blocked by safety") || errorMsg.includes("No content parts")) {
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

        <div className="flex items-center space-x-4">
             {/* Start/Stop Button */}
            <button
              onClick={() => setIsProcessingEnabled(!isProcessingEnabled)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all shadow-lg ${
                isProcessingEnabled 
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30' 
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
              }`}
            >
              {isProcessingEnabled ? (
                <>
                  <Pause size={18} className="fill-current" />
                  <span>Stop Processing</span>
                </>
              ) : (
                <>
                  <Play size={18} className="fill-current" />
                  <span>Start Processing</span>
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
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Processing...
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 flex items-center">
                        Waiting...
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
                      <img 
                        src={result.url} 
                        alt="Result" 
                        className="w-full h-auto object-contain p-2" 
                      />
                      
                      {/* Type Badge */}
                      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-[10px] uppercase font-bold tracking-wider backdrop-blur-sm flex items-center">
                        {result.type === 'full' && <Layers size={10} className="mr-1"/>}
                        {result.type === 'model' && <User size={10} className="mr-1"/>}
                        {result.type === 'background' && <Image size={10} className="mr-1"/>}
                        {result.type}
                      </div>

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-3">
                        <button 
                          onClick={() => setViewerUrl(result.url)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium text-sm flex items-center transform translate-y-4 group-hover:translate-y-0 transition-transform"
                        >
                          <Maximize size={16} className="mr-2" /> Inspect
                        </button>
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
                  </div>
                 </div>
                 <div className="flex space-x-2 mt-2">
                   <button 
                    onClick={() => handleRetry(item.id)}
                    className="flex-1 py-1.5 px-3 bg-white/5 hover:bg-white/10 rounded text-xs font-medium text-slate-200 transition-colors flex items-center justify-center"
                   >
                     <RefreshCw size={12} className="mr-1.5" /> Retry
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

      {/* Floating Console Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button 
          onClick={() => setIsConsoleOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-lg shadow-indigo-500/30 transition-all hover:scale-110 active:scale-95 group"
          title="Open Developer Console"
        >
          <Terminal size={24} />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Dev Console
          </span>
        </button>
      </div>

      {/* Modals */}
      <Console isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} />
      {viewerUrl && <ImageViewer imageUrl={viewerUrl} onClose={() => setViewerUrl(null)} />}

    </div>
  );
}
