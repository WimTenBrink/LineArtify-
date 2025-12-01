import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLogger } from './services/loggerService';
import { generateLineArt } from './services/geminiService';
import Console from './components/Console';
import ImageViewer from './components/ImageViewer';
import { QueueItem, ProcessingStatus, LogLevel } from './types';
import { Upload, X, RefreshCw, AlertCircle, CheckCircle2, Image as ImageIcon, Terminal, Github, Heart, Maximize } from 'lucide-react';

const MAX_CONCURRENT_REQUESTS = 1;

export default function App() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processingCount, setProcessingCount] = useState(0);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const { addLog } = useLogger();

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRetry = (id: string) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      // Move to bottom of pending, reset status
      const others = prev.filter(i => i.id !== id);
      return [...others, { ...item, status: ProcessingStatus.PENDING, errorMessage: undefined }];
    });
    addLog(LogLevel.INFO, `Retrying item ${id}`);
  };

  const handleDelete = (id: string) => {
    setQueue(prev => prev.filter(i => i.id !== id));
    addLog(LogLevel.INFO, `Deleted item ${id}`);
  };

  const triggerDownload = (url: string, originalFilename: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      // Replace extension or append .png
      const nameWithoutExt = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
      a.download = `line-art-${nameWithoutExt}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Auto-download failed", e);
    }
  };

  // --- Processing Logic ---

  useEffect(() => {
    const processNext = async () => {
      if (processingCount >= MAX_CONCURRENT_REQUESTS) return;

      const nextItem = queue.find(item => item.status === ProcessingStatus.PENDING);
      if (!nextItem) return;

      // Start processing
      setProcessingCount(prev => prev + 1);
      setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: ProcessingStatus.PROCESSING } : i));
      
      const apiKey = process.env.API_KEY || '';
      if (!apiKey) {
        addLog(LogLevel.ERROR, 'Missing API Key');
        setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: ProcessingStatus.ERROR, errorMessage: 'API Key missing' } : i));
        setProcessingCount(prev => prev - 1);
        return;
      }

      try {
        addLog(LogLevel.INFO, `Starting processing for ${nextItem.file.name}`);
        const resultUrl = await generateLineArt(nextItem.file, apiKey, addLog);
        
        setQueue(prev => prev.map(i => i.id === nextItem.id ? { 
          ...i, 
          status: ProcessingStatus.SUCCESS, 
          resultUrl 
        } : i));
        
        addLog(LogLevel.INFO, `Successfully processed ${nextItem.file.name}`);
        
        // Auto Download
        triggerDownload(resultUrl, nextItem.file.name);
        addLog(LogLevel.INFO, `Triggered auto-download for ${nextItem.file.name}`);

      } catch (err: any) {
        setQueue(prev => prev.map(i => i.id === nextItem.id ? { 
          ...i, 
          status: ProcessingStatus.ERROR, 
          errorMessage: err.message || 'Unknown error' 
        } : i));
        addLog(LogLevel.ERROR, `Failed to process ${nextItem.file.name}`, err);
      } finally {
        setProcessingCount(prev => prev - 1);
      }
    };

    processNext();
  }, [queue, processingCount, addLog]);


  // --- Render ---

  return (
    <div className="flex h-screen w-screen bg-[#0f0f16] text-slate-200 font-sans overflow-hidden relative">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute top-[40%] right-[0%] w-[40%] h-[60%] bg-blue-900/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex w-full h-full p-4 gap-4">
        
        {/* Left Column: Input Queue */}
        <div className="w-80 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-xl animate-fade-in-left">
          <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <h2 className="font-bold text-slate-100 flex items-center"><Upload className="mr-2 w-4 h-4 text-indigo-400" /> Input Queue</h2>
            <span className="text-xs font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">{inputQueue.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Drop Area */}
            <div 
              onDrop={handleDrop}
              onDragOver={handleDragOver}
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
        <div className="flex-1 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-xl">
           <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <h2 className="font-bold text-slate-100 flex items-center"><ImageIcon className="mr-2 w-4 h-4 text-emerald-400" /> Line Art Gallery</h2>
            <div className="flex items-center space-x-2">
               <span className="text-xs text-slate-400" title="Katje stands for Knowledge And Technology Joyfully Engaged">Copyright © Katje B.V.</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 bg-slate-900/40">
            {successQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                  <ImageIcon size={40} />
                </div>
                <p>No results yet.</p>
                <p className="text-sm">Process some images to see the magic!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {successQueue.map(item => (
                  <div key={item.id} className="group relative aspect-square bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all hover:scale-[1.02] border-4 border-white">
                    <img 
                      src={item.resultUrl} 
                      alt="Result" 
                      className="w-full h-full object-contain p-4" 
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-3">
                      <button 
                        onClick={() => setViewerUrl(item.resultUrl!)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium text-sm flex items-center transform translate-y-4 group-hover:translate-y-0 transition-transform"
                      >
                        <Maximize size={16} className="mr-2" /> Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Error Queue */}
        <div className="w-80 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-xl animate-fade-in-right">
           <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <h2 className="font-bold text-slate-100 flex items-center"><AlertCircle className="mr-2 w-4 h-4 text-red-400" /> Error Queue</h2>
             <span className="text-xs font-mono bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{errorQueue.length}</span>
          </div>

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