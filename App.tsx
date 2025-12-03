
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLogger } from './services/loggerService';
import { generateLineArtTask, generateAnalysisReport, detectPeople } from './services/geminiService';
import Console from './components/Console';
import ImageViewer from './components/ImageViewer';
import ManualDialog from './components/ManualDialog';
import { QueueItem, ProcessingStatus, LogLevel, LogEntry, GeneratedImage, TaskType } from './types';
import { Upload, X, RefreshCw, AlertCircle, CheckCircle2, Image as ImageIcon, Terminal, Maximize, Play, Pause, Layers, User, Image, Trash2, Eraser, Key, ChevronDown, AlertTriangle, Brain, FileText, Users, Expand, Book, Repeat, Filter, ScanFace, Clock, ChevronUp, ChevronsUp, ChevronsDown, ZoomIn, Sliders, ArrowRightCircle } from 'lucide-react';

const MAX_CONCURRENT_REQUESTS = 1;
const MAX_RETRY_LIMIT = 5;

// Definitions including the special 'scan-people' task which isn't shown as a final type usually
const TASK_DEFINITIONS: { type: TaskType, label: string }[] = [
    { type: 'full', label: 'Full Scene' },
    { type: 'model', label: 'Character Extraction' },
    { type: 'background', label: 'Background Only' },
    { type: 'model-full', label: 'Body Reconstruction' },
    { type: 'backside', label: 'Opposite View' },
    { type: 'scan-people', label: 'Scanning for People...' }
];

export default function App() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processingCount, setProcessingCount] = useState(0);
  const [isProcessingEnabled, setIsProcessingEnabled] = useState(false); // Default stopped
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [viewerItemId, setViewerItemId] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isErrorDropdownOpen, setIsErrorDropdownOpen] = useState(false);
  const [gender, setGender] = useState<string>('As-is'); // Gender state
  const [detailLevel, setDetailLevel] = useState<string>('Medium'); // Detail Level State
  const [galleryFilter, setGalleryFilter] = useState<TaskType | 'ALL'>('ALL');
  const [jobDurations, setJobDurations] = useState<number[]>([]); // Track durations for estimation
  const { addLog, logs } = useLogger();

  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  // Derived state
  // Filter input and error queues based on the gallery filter for consistency as requested
  const inputQueue = queue.filter(item => 
    (item.status === ProcessingStatus.PENDING || 
     item.status === ProcessingStatus.PROCESSING || 
     item.status === ProcessingStatus.SUCCESS) &&
    (galleryFilter === 'ALL' || item.taskType === galleryFilter)
  );
  
  const successQueue = queue.filter(item => item.status === ProcessingStatus.SUCCESS && item.taskType !== 'scan-people');
  // Count only pending generation tasks for the estimator (exclude scans as they are fast/background)
  const pendingCount = queue.filter(item => item.status === ProcessingStatus.PENDING && item.taskType !== 'scan-people').length;

  // Apply filtering to the viewable gallery
  const filteredGallery = successQueue.filter(item => galleryFilter === 'ALL' || item.taskType === galleryFilter);

  const errorQueue = queue.filter(item => 
    item.status === ProcessingStatus.ERROR &&
    (galleryFilter === 'ALL' || item.taskType === galleryFilter)
  );

  // Viewer Helpers
  const activeViewerItem = viewerItemId ? queue.find(i => i.id === viewerItemId) : null;
  // Calculate index based on where the user opened the viewer from
  const isInputQueueView = activeViewerItem && inputQueue.some(i => i.id === activeViewerItem.id);
  const isErrorQueueView = activeViewerItem && errorQueue.some(i => i.id === activeViewerItem.id);
  
  // Create a context-aware navigation list
  const viewerList = isErrorQueueView ? errorQueue : (isInputQueueView ? inputQueue : filteredGallery);
  const viewerIndex = activeViewerItem ? viewerList.findIndex(i => i.id === activeViewerItem.id) : -1;

  // Error History Logic
  const errorLogs = logs.filter(l => l.level === LogLevel.ERROR);
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

  const getTaskLabel = (type: TaskType) => {
      return TASK_DEFINITIONS.find(t => t.type === type)?.label || type;
  };

  // Estimation Helpers
  const formatDuration = (ms: number) => {
    if (ms < 1000) return "< 1s";
    const sec = Math.floor((ms / 1000) % 60);
    const min = Math.floor((ms / (1000 * 60)) % 60);
    const hr = Math.floor(ms / (1000 * 60 * 60));
    
    if (hr > 0) return `${hr}h ${min}m`;
    if (min > 0) return `${min}m ${sec}s`;
    return `${sec}s`;
  };

  const averageDuration = jobDurations.length > 0 
      ? jobDurations.reduce((acc, curr) => acc + curr, 0) / jobDurations.length 
      : 12000; // Default conservative start guess (12s)
  
  const estimatedMs = pendingCount * averageDuration;

  // --- Handlers ---

  const handleApiKeyChange = async () => {
    try {
      if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
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
    
    const newItems: QueueItem[] = [];
    
    Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .forEach(file => {
          const timestamp = Date.now();
          const thumbUrl = URL.createObjectURL(file);

          // Standard global tasks (Scene level)
          ['full', 'background'].forEach(type => {
              newItems.push({
                  id: crypto.randomUUID(),
                  file,
                  taskType: type as TaskType,
                  thumbnailUrl: thumbUrl,
                  status: ProcessingStatus.PENDING,
                  timestamp,
                  retryCount: 0,
                  errorHistory: []
              });
          });

          // Special Scan Task (Detects people -> Spawns Model & Backside tasks)
          newItems.push({
              id: crypto.randomUUID(),
              file,
              taskType: 'scan-people',
              thumbnailUrl: thumbUrl,
              status: ProcessingStatus.PENDING,
              timestamp,
              retryCount: 0,
              errorHistory: []
          });
      });

    if (newItems.length > 0) {
      setQueue(prev => {
          // De-duplication logic (Compound key: File + Task + PersonDesc)
          const existingKeys = new Set(prev.map(i => `${i.file.name}-${i.taskType}-${i.personDescription || ''}`));
          const uniqueNewItems = newItems.filter(i => !existingKeys.has(`${i.file.name}-${i.taskType}-${i.personDescription || ''}`));
          
          if (uniqueNewItems.length > 0) {
             addLog(LogLevel.INFO, `Added ${uniqueNewItems.length} jobs to input queue.`);
             return [...prev, ...uniqueNewItems];
          }
          return prev;
      });
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
      
      const isSuccess = item.status === ProcessingStatus.SUCCESS;

      if (!isSuccess && item.retryCount >= MAX_RETRY_LIMIT) return prev;

      const others = prev.filter(i => i.id !== id);
      return [...others, { 
          ...item, 
          status: ProcessingStatus.PENDING, 
          errorMessage: undefined,
          retryCount: isSuccess ? 0 : item.retryCount,
          result: isSuccess ? undefined : item.result,
          errorHistory: isSuccess ? [] : item.errorHistory
      }];
    });
    addLog(LogLevel.INFO, `Manually retrying/rerunning item ${id}`);
  };

  const handleRetryAll = () => {
    setQueue(prev => prev.map(item => 
      (item.status === ProcessingStatus.ERROR && item.retryCount < MAX_RETRY_LIMIT)
        ? { ...item, status: ProcessingStatus.PENDING, errorMessage: undefined }
        : item
    ));
    addLog(LogLevel.INFO, "Retrying all eligible failed items.");
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

  const handleLocateInGallery = (id: string) => {
    const el = document.getElementById(`gallery-item-${id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Optional temporary highlight logic could go here
        el.classList.add('ring-4', 'ring-indigo-500');
        setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-500'), 2000);
    }
  };

  const handleReorder = (id: string, direction: 'top' | 'up' | 'down' | 'bottom') => {
    setQueue(prev => {
      const newQueue = [...prev];
      const index = newQueue.findIndex(i => i.id === id);
      if (index === -1) return prev;

      // Identify indices of all items belonging to the "Input Queue" view logic
      // Note: We should order broadly within the queue, but specifically we want to move pending items relative to other pending items
      const pendingIndices = newQueue
        .map((item, idx) => ({ ...item, originalIndex: idx }))
        .filter(item => 
            item.status === ProcessingStatus.PENDING || 
            item.status === ProcessingStatus.PROCESSING
        )
        .map(i => i.originalIndex);
      
      const currentPendingPos = pendingIndices.indexOf(index);
      // If item is not pending, we don't reorder it in the processing queue
      if (currentPendingPos === -1) return prev;

      let targetPendingPos = currentPendingPos;
       if (direction === 'up') targetPendingPos--;
       if (direction === 'down') targetPendingPos++;
       if (direction === 'top') targetPendingPos = 0;
       if (direction === 'bottom') targetPendingPos = pendingIndices.length - 1;

       if (targetPendingPos < 0 || targetPendingPos >= pendingIndices.length || targetPendingPos === currentPendingPos) return prev;

       const targetIndex = pendingIndices[targetPendingPos];
       
       // Move logic
       const itemToMove = newQueue[index];
       newQueue.splice(index, 1);
       // We need to insert it at the position where the target was
       // If we removed from before the target, the target index shifted down by 1
       let insertAt = targetIndex;
       if (index < targetIndex) insertAt--; 
       
       // Wait, direct swap is safer if adjacent
       if (Math.abs(index - targetIndex) === 1 && (direction === 'up' || direction === 'down')) {
          [newQueue[index], newQueue[targetIndex]] = [newQueue[targetIndex], newQueue[index]];
       } else {
           // For jumps
           if (direction === 'bottom') {
               // Insert after the last pending item
               const lastPendingIndex = pendingIndices[pendingIndices.length - 1];
               newQueue.splice(lastPendingIndex, 0, itemToMove); // Re-insert logic is tricky with splice shifts
               // Let's simplify: Remove item, filter others, insert at desired position relative to filtered list? 
               // No, we need to maintain position relative to non-pending items too.
               // Simplest: just swap with target? No, that messes up intermediate items.
               
               // Robust method: Extract all pending items, reorder them array-wise, then place them back into the main queue slots.
               const pendingItems = pendingIndices.map(i => prev[i]);
               const movedItem = pendingItems[currentPendingPos];
               pendingItems.splice(currentPendingPos, 1);
               pendingItems.splice(targetPendingPos, 0, movedItem);
               
               // Map back
               pendingIndices.forEach((originalIndex, i) => {
                   newQueue[originalIndex] = pendingItems[i];
               });
           } else {
                // Same logic for top/up/down
               const pendingItems = pendingIndices.map(i => prev[i]);
               const movedItem = pendingItems[currentPendingPos];
               pendingItems.splice(currentPendingPos, 1);
               pendingItems.splice(targetPendingPos, 0, movedItem);
               
               pendingIndices.forEach((originalIndex, i) => {
                   newQueue[originalIndex] = pendingItems[i];
               });
           }
       }
       
       return newQueue;
    });
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

  // --- Background Processing for Scanning (Immediate) ---
  useEffect(() => {
    const processScanQueue = async () => {
        // Find next pending scan task
        const scanItem = queue.find(i => i.taskType === 'scan-people' && i.status === ProcessingStatus.PENDING);
        
        if (!scanItem) return;

        // Mark as Processing
        setQueue(prev => prev.map(i => i.id === scanItem.id ? { ...i, status: ProcessingStatus.PROCESSING } : i));
        
        const apiKey = process.env.API_KEY || '';
        if (!apiKey) {
             setQueue(prev => prev.map(i => i.id === scanItem.id ? { ...i, status: ProcessingStatus.ERROR, errorMessage: 'API Key missing for scan' } : i));
             return;
        }

        try {
            // Detect People with Bounding Boxes
            const people = await detectPeople(scanItem.file, apiKey, addLog);
            
            // Create new tasks
            const newJobs: QueueItem[] = [];
            people.forEach(personData => {
                // Job 1: Character Extraction (Model View)
                newJobs.push({
                    id: crypto.randomUUID(),
                    file: scanItem.file,
                    taskType: 'model',
                    personDescription: personData.description,
                    detectBox: personData.box_2d, // Pass the box
                    thumbnailUrl: scanItem.thumbnailUrl,
                    status: ProcessingStatus.PENDING,
                    timestamp: Date.now(),
                    retryCount: 0,
                    errorHistory: []
                });

                // Job 2: Opposite View (Backside)
                newJobs.push({
                    id: crypto.randomUUID(),
                    file: scanItem.file,
                    taskType: 'backside',
                    personDescription: personData.description,
                    detectBox: personData.box_2d, // Pass the box
                    thumbnailUrl: scanItem.thumbnailUrl,
                    status: ProcessingStatus.PENDING,
                    timestamp: Date.now(),
                    retryCount: 0,
                    errorHistory: []
                });
            });

            if (newJobs.length === 0) {
                 addLog(LogLevel.WARN, `No people detected in ${scanItem.file.name}.`);
            } else {
                 addLog(LogLevel.INFO, `Scan complete: ${people.length} people found in ${scanItem.file.name}.`);
            }

            // Remove scan task and add new tasks
            setQueue(prev => {
                const filtered = prev.filter(i => i.id !== scanItem.id);
                // Deduplicate
                const existingKeys = new Set(filtered.map(i => `${i.file.name}-${i.taskType}-${i.personDescription || ''}`));
                const uniqueNewItems = newJobs.filter(i => !existingKeys.has(`${i.file.name}-${i.taskType}-${i.personDescription || ''}`));

                return [...filtered, ...uniqueNewItems];
            });

        } catch (err: any) {
             setQueue(prev => prev.map(i => i.id === scanItem.id ? { 
                ...i, 
                status: ProcessingStatus.ERROR, 
                errorMessage: `Scan failed: ${err.message}`,
                retryCount: scanItem.retryCount + 1 
             } : i));
        }
    };

    processScanQueue();
  }, [queue, addLog]);

  // --- Main Generation Processing Logic ---

  useEffect(() => {
    const processNext = async () => {
      if (!isProcessingEnabled) return;
      if (processingCount >= MAX_CONCURRENT_REQUESTS) return;

      // Skip scan tasks here, they are handled by the effect above
      const nextItem = queue.find(item => item.status === ProcessingStatus.PENDING && item.taskType !== 'scan-people');
      if (!nextItem) return;

      setProcessingCount(prev => prev + 1);
      setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: ProcessingStatus.PROCESSING } : i));
      
      const apiKey = process.env.API_KEY || '';
      if (!apiKey) {
        addLog(LogLevel.ERROR, 'Missing API Key');
        setQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: ProcessingStatus.ERROR, errorMessage: 'API Key missing' } : i));
        setProcessingCount(prev => prev - 1);
        setProcessingStatus("");
        return;
      }

      const startTime = Date.now();

      try {
            setProcessingStatus(`Processing ${nextItem.file.name} [${getTaskLabel(nextItem.taskType)}]...`);
            addLog(LogLevel.INFO, `Starting job for ${nextItem.file.name} (${nextItem.taskType}) - Detail: ${detailLevel}`);
            
            const result = await generateLineArtTask(
              nextItem.file, 
              apiKey,
              nextItem.taskType,
              gender,
              detailLevel,
              addLog,
              (msg) => setProcessingStatus(msg),
              nextItem.personDescription
            );
            
            // Success
            setQueue(prev => prev.map(i => i.id === nextItem.id ? { 
              ...i, 
              status: ProcessingStatus.SUCCESS, 
              result: result 
            } : i));
            
            const duration = Date.now() - startTime;
            setJobDurations(prev => [...prev.slice(-19), duration]); 

            addLog(LogLevel.INFO, `Successfully processed ${nextItem.file.name} - ${nextItem.taskType} in ${formatDuration(duration)}`);
            
            if (result.type !== 'report') {
                let prefix = 'Line-';
                if (result.type === 'model') prefix = 'Line-Model-';
                if (result.type === 'model-full') prefix = 'Line-Model-Full-';
                if (result.type === 'background') prefix = 'Line-Background-';
                if (result.type === 'backside') prefix = 'Line-Opposite-';
                
                if (nextItem.personDescription) {
                    prefix += 'Person-';
                }

                triggerDownload(result.url, nextItem.file.name, prefix, 'png');
            }

      } catch (err: any) {
        const errorMsg = err.message || 'Unknown error';
        const newFailureCount = nextItem.retryCount + 1; 
        const newHistory = [...nextItem.errorHistory, errorMsg];

        addLog(LogLevel.WARN, `Job failed: ${nextItem.file.name} (${nextItem.taskType}). Failure #${newFailureCount}. Error: ${errorMsg}`);
        
        setQueue(prev => prev.map(i => i.id === nextItem.id ? { 
          ...i, 
          status: ProcessingStatus.ERROR, 
          errorMessage: errorMsg,
          retryCount: newFailureCount,
          errorHistory: newHistory
        } : i));
        
      } finally {
        setProcessingCount(prev => prev - 1);
        setProcessingStatus("");
      }
    };

    processNext();
  }, [queue, processingCount, isProcessingEnabled, addLog, gender, detailLevel]);


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
          <p className="text-slate-400 mt-2 font-mono">Will detect people and generate variations automatically</p>
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
        
        {/* Central Status Indicator & Timer */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center">
          {processingStatus && (
            <div className="flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-4 py-1.5 rounded-full text-sm font-mono shadow-[0_0_15px_rgba(99,102,241,0.2)] animate-pulse mb-1">
              <Brain size={16} className="animate-pulse" />
              <span>{processingStatus}</span>
            </div>
          )}
          
          {isProcessingEnabled && pendingCount > 0 && (
             <div className="flex items-center space-x-1.5 text-xs text-indigo-300/80 font-mono bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/5 animate-fade-in">
                <Clock size={10} />
                <span>~{formatDuration(estimatedMs)} remaining</span>
             </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
            
            {/* Settings Group */}
            <div className="flex items-center bg-slate-800/50 rounded-lg p-1 border border-white/5 space-x-3 px-3 mr-2">
                
                {/* Gender Dropdown */}
                <div className="flex items-center space-x-2">
                    <Users size={16} className="text-slate-400" />
                    <select 
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="bg-transparent border-none text-sm text-slate-200 py-1.5 focus:ring-0 focus:outline-none cursor-pointer"
                        title="Target Gender"
                    >
                        <option value="As-is">As-is</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Intersex">Intersex</option>
                    </select>
                </div>

                <div className="w-px h-4 bg-white/10"></div>

                {/* Detail Slider */}
                <div className="flex flex-col justify-center w-32 px-1">
                     <div className="flex justify-between text-[8px] text-slate-400 font-mono uppercase mb-0.5">
                        <span className={detailLevel === 'Low' ? 'text-indigo-400 font-bold' : ''}>Low</span>
                        <span className={detailLevel === 'Medium' ? 'text-indigo-400 font-bold' : ''}>Med</span>
                        <span className={detailLevel === 'High' ? 'text-indigo-400 font-bold' : ''}>High</span>
                     </div>
                     <div className="relative h-4 flex items-center">
                         <input 
                            type="range" 
                            min="0" 
                            max="2" 
                            step="1"
                            value={detailLevel === 'Low' ? 0 : detailLevel === 'High' ? 2 : 1}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setDetailLevel(val === 0 ? 'Low' : val === 2 ? 'High' : 'Medium');
                            }}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 z-10"
                            title={`Detail Level: ${detailLevel}`}
                         />
                         {/* Tick Marks */}
                         <div className="absolute w-full flex justify-between px-1 pointer-events-none">
                             <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                             <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                             <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                         </div>
                     </div>
                </div>
            </div>

            <div className="h-6 w-px bg-white/10 mx-1"></div>

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

             {/* Manual Button */}
             <button
              onClick={() => setIsManualOpen(true)}
              className="flex items-center space-x-2 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/5"
              title="Open Manual"
            >
              <Book size={18} />
              <span className="text-sm font-medium hidden lg:inline">Manual</span>
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
        <div className="w-96 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-xl animate-fade-in-left flex-none">
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
          
          <div className="flex-1 overflow-y-auto p-0 space-y-0 scrollbar-hide bg-slate-900/30">
            {/* Visual Drop Area / Click to Upload */}
            <div 
              className="border-b border-dashed border-white/10 p-6 text-center transition-all hover:bg-white/5 group cursor-pointer relative"
            >
              <input 
                type="file" 
                multiple 
                accept="image/*"
                onChange={(e) => handleFiles(e.target.files)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5 text-indigo-400" />
              </div>
              <p className="text-xs font-medium text-slate-400">Add more images</p>
            </div>

            {/* List */}
            {inputQueue.map((item, idx) => (
              <div key={item.id} className="flex flex-col border-b border-white/5 relative group bg-slate-900">
                
                {/* Image Area - Full Width */}
                <div 
                  className="w-full relative cursor-zoom-in group/image"
                >
                    <img 
                      src={item.thumbnailUrl} 
                      alt="Thumb" 
                      className="w-full h-auto max-h-64 object-cover"
                      onClick={() => setViewerItemId(item.id)}
                    />

                    {/* Bounding Box Overlay for People */}
                    {item.detectBox && (
                       <div 
                         className="absolute border-2 border-indigo-400 bg-indigo-500/10 z-10 pointer-events-none"
                         style={{
                           top: `${item.detectBox[0] / 10}%`,
                           left: `${item.detectBox[1] / 10}%`,
                           height: `${(item.detectBox[2] - item.detectBox[0]) / 10}%`,
                           width: `${(item.detectBox[3] - item.detectBox[1]) / 10}%`,
                           boxShadow: '0 0 0 1px rgba(0,0,0,0.3), inset 0 0 10px rgba(99,102,241,0.2)'
                         }}
                       >
                         <div className="absolute -top-5 left-0 bg-indigo-600 text-[9px] text-white px-1 rounded shadow-sm whitespace-nowrap">Target</div>
                       </div>
                    )}
                    
                    {/* Status Overlays */}
                    {item.status === ProcessingStatus.PROCESSING && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm z-20">
                            {item.taskType === 'scan-people' ? (
                                <ScanFace className="w-10 h-10 text-indigo-400 animate-pulse" />
                            ) : (
                                <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
                            )}
                        </div>
                    )}
                     {item.status === ProcessingStatus.SUCCESS && (
                      <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center z-20 pointer-events-none">
                          <CheckCircle2 className="w-12 h-12 text-emerald-400 drop-shadow-lg" />
                      </div>
                    )}

                    {/* Quick Delete Overlay */}
                     <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 hover:text-white rounded-full transition-all text-slate-300 opacity-0 group-hover:opacity-100 z-30"
                        title="Delete from Queue"
                     >
                        <X size={14} />
                    </button>
                    
                    {/* Zoom Hint */}
                    <div className="absolute bottom-2 right-2 p-1.5 bg-black/40 text-white rounded text-xs opacity-0 group-hover/image:opacity-100 transition-opacity pointer-events-none z-20">
                        <ZoomIn size={14} />
                    </div>
                </div>

                {/* Content Area - Below Image */}
                <div className="flex flex-col p-3 bg-slate-800/20">
                  <div className="flex justify-between items-start">
                      <p className="text-sm font-medium text-slate-200 truncate pr-2" title={item.file.name}>{item.file.name}</p>
                      
                      {/* Priority Controls (Only for pending) */}
                      {(item.status === ProcessingStatus.PENDING) && (
                          <div className="flex space-x-0.5 bg-slate-800 rounded-md border border-white/5 p-0.5">
                              <button onClick={() => handleReorder(item.id, 'top')} className="p-1 hover:bg-indigo-500/20 text-slate-500 hover:text-indigo-300 rounded" title="Move to Top"><ChevronsUp size={10} /></button>
                              <button onClick={() => handleReorder(item.id, 'up')} className="p-1 hover:bg-white/10 text-slate-500 hover:text-slate-300 rounded" title="Move Up"><ChevronUp size={10} /></button>
                              <button onClick={() => handleReorder(item.id, 'down')} className="p-1 hover:bg-white/10 text-slate-500 hover:text-slate-300 rounded" title="Move Down"><ChevronDown size={10} /></button>
                              <button onClick={() => handleReorder(item.id, 'bottom')} className="p-1 hover:bg-indigo-500/20 text-slate-500 hover:text-indigo-300 rounded" title="Move to Bottom"><ChevronsDown size={10} /></button>
                          </div>
                      )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border self-start ${
                        item.taskType === 'scan-people' ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' :
                        item.taskType === 'model' ? 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300' :
                        'bg-slate-700 border-slate-600 text-slate-300'
                    }`}>
                        {getTaskLabel(item.taskType)}
                    </span>
                    
                     {item.personDescription && (
                          <div className="flex items-center space-x-1.5 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 max-w-full">
                             <User size={10} className="text-indigo-400 shrink-0" />
                             <span className="text-xs text-indigo-200 italic font-medium leading-tight truncate">{item.personDescription}</span>
                          </div>
                      )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                    {item.status === ProcessingStatus.PROCESSING ? (
                      <span className="text-xs text-amber-400 flex items-center animate-pulse">
                        {item.taskType === 'scan-people' ? "Detecting people..." : "Generating..."}
                      </span>
                    ) : item.status === ProcessingStatus.SUCCESS ? (
                       <div className="flex gap-2 w-full">
                             <button 
                               onClick={() => handleLocateInGallery(item.id)}
                               className="flex-1 py-1.5 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs uppercase font-bold rounded border border-emerald-500/20 transition-colors flex items-center justify-center"
                             >
                               <ArrowRightCircle size={12} className="mr-1.5" /> Locate
                             </button>
                             <button 
                               onClick={() => handleRetry(item.id)}
                               className="flex-1 py-1.5 px-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs uppercase font-bold rounded border border-indigo-500/20 transition-colors"
                             >
                               Rerun
                             </button>
                       </div>
                    ) : (
                      <span className="text-xs text-slate-500 flex items-center">
                         Waiting in queue...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center Column: Results Gallery */}
        <div className="flex-1 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-xl min-w-0">
           <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <h2 className="font-bold text-slate-100 flex items-center"><ImageIcon className="mr-2 w-4 h-4 text-emerald-400" /> Gallery</h2>
                
                {/* Gallery Filter */}
                <div className="flex items-center bg-slate-800/50 rounded-lg p-1 space-x-1 border border-white/5">
                    <button 
                        onClick={() => setGalleryFilter('ALL')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${galleryFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        All
                    </button>
                    <button 
                        onClick={() => setGalleryFilter('full')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${galleryFilter === 'full' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Full
                    </button>
                    <button 
                        onClick={() => setGalleryFilter('model')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${galleryFilter === 'model' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Char
                    </button>
                     <button 
                        onClick={() => setGalleryFilter('background')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${galleryFilter === 'background' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        BG
                    </button>
                    <button 
                        onClick={() => setGalleryFilter('backside')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${galleryFilter === 'backside' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Op. View
                    </button>
                </div>
            </div>

            <div className="flex items-center space-x-3">
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
            {filteredGallery.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                  <Filter size={40} />
                </div>
                <p>No images found.</p>
                <p className="text-sm">Try adjusting the filter or process more images.</p>
              </div>
            ) : (
              <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6">
                {filteredGallery.map(item => {
                  const result = item.result!;
                  return (
                    <div 
                        key={item.id} 
                        id={`gallery-item-${item.id}`}
                        onClick={() => result.type !== 'report' && setViewerItemId(item.id)}
                        className={`inline-block w-full group relative break-inside-avoid bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all hover:scale-[1.02] border-4 border-white mb-6 scroll-mt-20 ${result.type !== 'report' ? 'cursor-zoom-in' : ''}`}
                    >
                      
                      {result.type === 'report' ? (
                          // Report Card
                          <div className="w-full h-64 bg-slate-800 flex flex-col items-center justify-center p-4 text-center">
                             <FileText size={48} className="text-indigo-400 mb-2" />
                             <h3 className="text-white font-bold mb-1">Analysis Report</h3>
                             <p className="text-slate-400 text-xs">Generation Failed {item.retryCount}x</p>
                             <p className="text-slate-500 text-[10px] mt-2">Cloud Vision Analysis</p>
                          </div>
                      ) : (
                          // Image Card with Max Height Constraint
                          <div className="w-full flex justify-center bg-gray-50">
                             <img 
                                src={result.url} 
                                alt="Result" 
                                className="object-contain max-h-[40vh] w-auto max-w-full mx-auto" 
                             />
                          </div>
                      )}
                      
                      {/* Type Badge */}
                      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-[10px] uppercase font-bold tracking-wider backdrop-blur-sm flex items-center pointer-events-none">
                        {result.type === 'full' && <Layers size={10} className="mr-1"/>}
                        {result.type === 'model' && <User size={10} className="mr-1"/>}
                        {result.type === 'model-full' && <Expand size={10} className="mr-1 text-yellow-300"/>}
                        {result.type === 'background' && <Image size={10} className="mr-1"/>}
                        {result.type === 'backside' && <Repeat size={10} className="mr-1 text-cyan-300"/>}
                        {getTaskLabel(item.taskType)}
                      </div>

                      {/* Person Indicator Badge */}
                      {item.personDescription && (
                           <div className="absolute top-2 right-2 px-2 py-1 rounded bg-indigo-600/80 text-white text-[10px] font-bold backdrop-blur-sm pointer-events-none max-w-[150px] truncate">
                              {item.personDescription}
                           </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-3 pointer-events-none">
                        {result.type === 'report' ? (
                             <button 
                               onClick={(e) => { e.stopPropagation(); triggerDownload(result.url, item.file.name, '', 'md'); }}
                               className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium text-sm flex items-center transform translate-y-4 group-hover:translate-y-0 transition-transform pointer-events-auto shadow-xl"
                             >
                               <FileText size={16} className="mr-2" /> Download Report
                             </button>
                        ) : (
                           <button 
                                onClick={(e) => { e.stopPropagation(); triggerDownload(result.url, item.file.name, 'Line-', 'png'); }}
                                className="px-4 py-2 bg-white text-slate-900 hover:bg-indigo-50 rounded-full font-bold text-xs flex items-center transform translate-y-4 group-hover:translate-y-0 transition-transform pointer-events-auto shadow-xl"
                            >
                                <Users size={14} className="mr-2" /> Download Image
                            </button>
                        )}

                        {/* Delete Button (Visible on Hover) */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-full font-medium text-xs flex items-center transform translate-y-4 group-hover:translate-y-0 transition-transform pointer-events-auto shadow-xl delay-75"
                        >
                            <Trash2 size={14} className="mr-2" /> Delete
                        </button>
                      </div>
                      
                      {/* Source Filename Label */}
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur text-white text-[10px] p-2 truncate text-center translate-y-full group-hover:translate-y-0 transition-transform pointer-events-none">
                        {item.file.name}
                        {item.personDescription && <span className="text-indigo-300 block text-[9px] mt-0.5">{item.personDescription}</span>}
                      </div>
                      
                       {/* Always Visible Delete Button for Gallery (Small corner icon) */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            className="absolute bottom-2 right-2 p-1.5 bg-red-600/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto z-10"
                            title="Delete"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                  );
                })}
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
                  <RefreshCw size={12} className="mr-2" /> Retry Valid
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

          <div className="flex-1 overflow-y-auto p-0 space-y-0 scrollbar-hide bg-slate-900/30">
             {errorQueue.length === 0 && (
               <div className="mt-10 text-center text-slate-600 text-sm p-4">
                 <div className="inline-block p-3 rounded-full bg-slate-800/50 mb-2">
                   <CheckCircle2 size={20} className="text-emerald-500/50" />
                 </div>
                 <p>All systems normal.</p>
               </div>
             )}
             
             {errorQueue.map(item => (
               <div key={item.id} className="bg-red-900/10 border-b border-red-500/10 flex flex-col relative group">
                 {/* Image - Full Width */}
                 <div 
                   onClick={() => setViewerItemId(item.id)}
                   className="w-full h-auto max-h-48 object-cover relative cursor-zoom-in"
                 >
                    <img src={item.thumbnailUrl} alt="Thumb" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                    <div className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                       Failures: {item.retryCount}
                    </div>
                 </div>
                 
                 <div className="flex flex-col p-3">
                    <p className="text-sm font-medium text-slate-200 truncate">{item.file.name}</p>
                    <p className="text-xs text-indigo-300 font-medium truncate mt-0.5">{getTaskLabel(item.taskType)}</p>
                    <p className="text-xs text-red-300 mt-2 line-clamp-2 bg-red-900/20 p-2 rounded border border-red-500/10 font-mono leading-relaxed">{item.errorMessage}</p>
                 </div>
                 
                 <div className="flex space-x-2 px-3 pb-3">
                   <button 
                    onClick={() => handleRetry(item.id)}
                    disabled={item.retryCount >= MAX_RETRY_LIMIT}
                    className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors flex items-center justify-center border ${
                        item.retryCount >= MAX_RETRY_LIMIT 
                        ? 'bg-white/5 border-transparent text-slate-500 cursor-not-allowed' 
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                    }`}
                   >
                     <RefreshCw size={12} className="mr-1.5" /> 
                     {item.retryCount >= MAX_RETRY_LIMIT ? "Limit" : "Retry"}
                   </button>
                   <button 
                    onClick={() => handleDelete(item.id)}
                    className="w-8 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded text-xs font-medium text-red-300 transition-colors flex items-center justify-center border border-red-500/20"
                    title="Dismiss"
                   >
                     <X size={12} />
                   </button>
                 </div>
               </div>
             ))}
          </div>
        </div>

      </div>

      {/* Modals */}
      <Console isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} />
      <ManualDialog isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      {activeViewerItem && (
          <ImageViewer 
              item={activeViewerItem} 
              onClose={() => setViewerItemId(null)} 
              onNext={() => viewerIndex < viewerList.length - 1 && setViewerItemId(viewerList[viewerIndex + 1].id)}
              onPrev={() => viewerIndex > 0 && setViewerItemId(viewerList[viewerIndex - 1].id)}
              hasNext={viewerIndex < viewerList.length - 1}
              hasPrev={viewerIndex > 0}
          />
      )}

    </div>
  );
}
