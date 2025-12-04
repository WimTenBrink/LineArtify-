
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLogger } from './services/loggerService';
import { generateLineArtTask, detectPeople } from './services/geminiService';
import Console from './components/Console';
import ImageViewer from './components/ImageViewer';
import ManualDialog from './components/ManualDialog';
import OptionsDialog from './components/OptionsDialog';
import { QueueItem, ProcessingStatus, LogLevel, AppOptions, SourceImage, TaskType } from './types';
import { Upload, X, RefreshCw, Play, Pause, Trash2, Key, Save, FolderOpen, Terminal, Book, ChevronRight, Settings, Image as ImageIcon, Layers, User, AlertTriangle, CheckCircle2, ScanFace, Check, Repeat, RefreshCcw, Wand2, Square, CheckSquare } from 'lucide-react';

const MAX_CONCURRENT_REQUESTS = 3;

// Helper for converting Blob/File to Base64 (Data URL)
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

type QueueView = 'UPLOADS' | 'JOBS' | 'FULL' | 'BACKGROUND' | 'COUNTING' | 'RETRY' | 'FAILED' | 'ENDED' | 'MODEL' | 'BACKSIDE' | 'NUDE' | 'NUDE_OPPOSITE' | 'MODEL_FULL' | 'FACE' | 'ALL_PEOPLE' | 'ALL_PEOPLE_NUDE' | 'UPSCALE';

export default function App() {
  // Data State
  const [uploads, setUploads] = useState<SourceImage[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]); // "The Master Job List"
  
  // App Config State
  const [options, setOptions] = useState<AppOptions>({
    taskTypes: {
      full: true,
      background: true,
      allPeople: true, // Default Checked
      allPeopleNude: true, // Default Checked
      model: true,
      backside: true,
      nude: true, // Default Checked
      nudeOpposite: true, // Default Checked
      modelFull: true, // Default Checked
      face: true
    },
    gender: 'Female', // Default Female
    detailLevel: 'Medium' // Default Medium
  });

  // UI State
  const [activeQueueView, setActiveQueueView] = useState<QueueView>('UPLOADS');
  const [viewerItemId, setViewerItemId] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());

  // Queue Control State (Start/Stop per queue)
  const [queueControls, setQueueControls] = useState({
    global: false, // Master switch
    full: true,
    background: true,
    allPeople: true,
    allPeopleNude: true,
    counting: true,
    model: true,
    backside: true,
    nude: true,
    nudeOpposite: true,
    modelFull: true,
    face: true,
    upscale: true
  });

  const { addLog } = useLogger();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Derived Data (The "Queues") ---

  const processingJobs = queue.filter(i => i.status === ProcessingStatus.PROCESSING);
  
  // Helper to filter queue items
  const getQueueItems = (type: QueueView): QueueItem[] => {
    switch (type) {
      case 'JOBS': return processingJobs;
      case 'FULL': return queue.filter(i => i.taskType === 'full' && i.status === ProcessingStatus.PENDING);
      case 'BACKGROUND': return queue.filter(i => i.taskType === 'background' && i.status === ProcessingStatus.PENDING);
      case 'ALL_PEOPLE': return queue.filter(i => i.taskType === 'all-people' && i.status === ProcessingStatus.PENDING);
      case 'ALL_PEOPLE_NUDE': return queue.filter(i => i.taskType === 'all-people-nude' && i.status === ProcessingStatus.PENDING);
      case 'COUNTING': return queue.filter(i => i.taskType === 'scan-people' && i.status === ProcessingStatus.PENDING);
      case 'MODEL': return queue.filter(i => i.taskType === 'model' && i.status === ProcessingStatus.PENDING);
      case 'BACKSIDE': return queue.filter(i => i.taskType === 'backside' && i.status === ProcessingStatus.PENDING);
      case 'NUDE': return queue.filter(i => i.taskType === 'nude' && i.status === ProcessingStatus.PENDING);
      case 'NUDE_OPPOSITE': return queue.filter(i => i.taskType === 'nude-opposite' && i.status === ProcessingStatus.PENDING);
      case 'MODEL_FULL': return queue.filter(i => i.taskType === 'model-full' && i.status === ProcessingStatus.PENDING);
      case 'FACE': return queue.filter(i => i.taskType === 'face' && i.status === ProcessingStatus.PENDING);
      case 'UPSCALE': return queue.filter(i => i.taskType === 'upscale' && i.status === ProcessingStatus.PENDING);
      case 'RETRY': return queue.filter(i => i.status === ProcessingStatus.ERROR && !i.isBlocked && i.retryCount < 3);
      case 'FAILED': return queue.filter(i => i.status === ProcessingStatus.ERROR && (i.isBlocked || (i.retryCount >= 3 && i.isLastChance)));
      case 'ENDED': return queue.filter(i => i.status === ProcessingStatus.ENDED);
      default: return [];
    }
  };

  // Gallery items - Filter by selectedSourceIds if any are selected
  const allGalleryItems = queue.filter(i => i.status === ProcessingStatus.SUCCESS && i.taskType !== 'scan-people');
  const galleryItems = selectedSourceIds.size > 0 
    ? allGalleryItems.filter(i => selectedSourceIds.has(i.sourceId))
    : allGalleryItems;

  // Progress Calculation
  const totalJobs = queue.length;
  // Completed = Success, Ended, or Blocked Error (Final states)
  const completedJobs = queue.filter(i => 
    i.status === ProcessingStatus.SUCCESS || 
    i.status === ProcessingStatus.ENDED || 
    (i.status === ProcessingStatus.ERROR && (i.isBlocked || i.retryCount >= 3))
  ).length;
  const progressPercent = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  // --- Logic ---

  const handleUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    const newUploads: SourceImage[] = [];
    
    Array.from(files).filter(f => f.type.startsWith('image/')).forEach(file => {
       const id = crypto.randomUUID();
       newUploads.push({
         id,
         file,
         thumbnailUrl: URL.createObjectURL(file),
         timestamp: Date.now()
       });
    });

    if (newUploads.length > 0) {
      setUploads(prev => [...prev, ...newUploads]);
      addLog(LogLevel.INFO, `Uploaded ${newUploads.length} images.`);
      populateQueues(newUploads);
    }
  }, [options, addLog]);

  const populateQueues = (sources: SourceImage[]) => {
    const newJobs: QueueItem[] = [];
    
    sources.forEach(source => {
      // Full Art Job
      newJobs.push({
        id: crypto.randomUUID(),
        sourceId: source.id,
        file: source.file,
        taskType: 'full',
        thumbnailUrl: source.thumbnailUrl,
        status: ProcessingStatus.PENDING,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        errorHistory: []
      });

      // Background Job
      newJobs.push({
        id: crypto.randomUUID(),
        sourceId: source.id,
        file: source.file,
        taskType: 'background',
        thumbnailUrl: source.thumbnailUrl,
        status: ProcessingStatus.PENDING,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        errorHistory: []
      });

      // Counting Job (Scanner)
      newJobs.push({
        id: crypto.randomUUID(),
        sourceId: source.id,
        file: source.file,
        taskType: 'scan-people',
        thumbnailUrl: source.thumbnailUrl,
        status: ProcessingStatus.PENDING,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        errorHistory: []
      });
    });

    setQueue(prev => [...prev, ...newJobs]);
  };

  const deleteUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
    // Cascade delete jobs
    setQueue(prev => prev.filter(j => j.sourceId !== id));
    addLog(LogLevel.INFO, `Deleted source image ${id} and related jobs.`);
  };

  const deleteJob = (id: string) => {
    setQueue(prev => prev.filter(j => j.id !== id));
  };

  const repeatJob = (item: QueueItem) => {
    const newJob = { 
        ...item, 
        id: crypto.randomUUID(), 
        status: ProcessingStatus.PENDING, 
        result: undefined, 
        retryCount: 0,
        errorHistory: [],
        timestamp: Date.now(),
        isLastChance: false // Reset last chance on manual repeat
    };
    setQueue(prev => [...prev, newJob]);
    addLog(LogLevel.INFO, `Repeated job for ${item.file.name} (${item.taskType})`);
  };

  const handleUpscale = async (item: QueueItem) => {
      if (!item.result?.url) return;
      
      try {
          const res = await fetch(item.result.url);
          const blob = await res.blob();
          const file = new File([blob], `source-for-upscale.png`, { type: 'image/png' });

          const newJob: QueueItem = {
              id: crypto.randomUUID(),
              sourceId: item.sourceId,
              file: file,
              taskType: 'upscale',
              thumbnailUrl: item.result.url,
              status: ProcessingStatus.PENDING,
              timestamp: Date.now(),
              retryCount: 0,
              maxRetries: 3,
              errorHistory: [],
              personDescription: item.personDescription
          };
          setQueue(prev => [...prev, newJob]);
          addLog(LogLevel.INFO, `Created Upscale job for ${item.file.name}`);
      } catch (e) {
          addLog(LogLevel.ERROR, "Failed to create upscale job", e);
      }
  };

  // --- Processing Loop ---

  useEffect(() => {
    if (!queueControls.global) return;

    const runProcessor = async () => {
        if (processingJobs.length >= MAX_CONCURRENT_REQUESTS) return;

        // Find next job based on priority/queues enabled
        // Priority order: Counting -> Full -> BG -> Character/Nude...
        let candidate: QueueItem | undefined;

        // Helper to check if queue is enabled and has items
        const findInQueue = (type: TaskType, controlKey: keyof typeof queueControls) => {
            if (!queueControls[controlKey]) return undefined;
            return queue.find(i => i.taskType === type && i.status === ProcessingStatus.PENDING);
        };

        // 1. Counting (Highest Priority to spawn other jobs)
        if (!candidate) candidate = findInQueue('scan-people', 'counting');
        
        // 1.5. Upscale
        if (!candidate) candidate = findInQueue('upscale', 'upscale');
        
        // 2. Scene / Group Tasks
        if (!candidate) candidate = findInQueue('all-people', 'allPeople');
        if (!candidate) candidate = findInQueue('all-people-nude', 'allPeopleNude');
        
        // 3. Specific tasks
        if (!candidate) candidate = findInQueue('face', 'face');
        if (!candidate) candidate = findInQueue('model', 'model');
        if (!candidate) candidate = findInQueue('nude', 'nude');
        if (!candidate) candidate = findInQueue('nude-opposite', 'nudeOpposite');
        if (!candidate) candidate = findInQueue('backside', 'backside');
        if (!candidate) candidate = findInQueue('model-full', 'modelFull');
        
        // 4. Full / BG (Lowest priority as they are large)
        if (!candidate) candidate = findInQueue('full', 'full');
        if (!candidate) candidate = findInQueue('background', 'background');

        if (!candidate) return;

        // Start Processing
        const job = candidate;
        setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.PROCESSING } : i));
        
        const apiKey = process.env.API_KEY || '';
        if (!apiKey) {
            handleJobError(job, "Missing API Key", true);
            return;
        }

        try {
            if (job.taskType === 'scan-people') {
                // Special Handling for Scanner
                await handleScanning(job, apiKey);
            } else {
                // Regular Generation
                await handleGeneration(job, apiKey);
            }
        } catch (error: any) {
             const isSafety = error.message?.includes("Content Policy") || error.message?.includes("Safety");
             handleJobError(job, error.message || "Unknown error", isSafety);
        }
    };

    const interval = setInterval(runProcessor, 1000);
    return () => clearInterval(interval);
  }, [queue, queueControls, processingJobs.length, options]); // Dependencies

  const handleJobError = (job: QueueItem, message: string, isSafety: boolean) => {
      addLog(LogLevel.WARN, `Job Failed: ${message}`);
      setQueue(prev => prev.map(i => {
          if (i.id !== job.id) return i;
          
          const newRetryCount = i.retryCount + 1;

          // If it was ALREADY in the "Last Chance" state (Failed Queue) and failed again, it's over.
          if (i.isLastChance) {
               return {
                  ...i,
                  status: ProcessingStatus.ENDED, // Moves to Ended queue
                  errorMessage: message,
                  retryCount: newRetryCount
               };
          }

          const isFailedQueue = isSafety || (newRetryCount >= i.maxRetries);
          
          return {
              ...i,
              status: ProcessingStatus.ERROR,
              errorMessage: message,
              retryCount: newRetryCount,
              isBlocked: isSafety,
              // If it failed too often or is safety blocked, set lastChance so it goes to Failed queue
              isLastChance: isFailedQueue
          };
      }));
  };

  const handleScanning = async (job: QueueItem, apiKey: string) => {
      addLog(LogLevel.INFO, `Scanning ${job.file.name}...`);
      const people = await detectPeople(job.file, apiKey, addLog);
      
      // Success mark for scanner
      setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.SUCCESS } : i));

      const newJobs: QueueItem[] = [];

      // HELPER: Job Creator
      const create = (type: TaskType, description?: string, box?: number[]) => ({
          id: crypto.randomUUID(),
          sourceId: job.sourceId,
          file: job.file,
          taskType: type,
          personDescription: description,
          detectBox: box,
          thumbnailUrl: job.thumbnailUrl,
          status: ProcessingStatus.PENDING,
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          errorHistory: []
      });

      // 1. Group Tasks (Only if more than 1 person detected)
      if (people.length > 1) {
          if (options.taskTypes.allPeople) {
              newJobs.push(create('all-people'));
          }
          if (options.taskTypes.allPeopleNude) {
              newJobs.push(create('all-people-nude'));
          }
      }

      // 2. Individual Tasks (Loop through detected people)
      people.forEach(p => {
          if (options.taskTypes.face) newJobs.push(create('face', p.description, p.box_2d));
          if (options.taskTypes.model) newJobs.push(create('model', p.description, p.box_2d));
          if (options.taskTypes.backside) newJobs.push(create('backside', p.description, p.box_2d));
          if (options.taskTypes.nude) newJobs.push(create('nude', p.description, p.box_2d));
          if (options.taskTypes.nudeOpposite) newJobs.push(create('nude-opposite', p.description, p.box_2d));
          if (options.taskTypes.modelFull) newJobs.push(create('model-full', p.description, p.box_2d));
      });

      if (newJobs.length > 0) {
          addLog(LogLevel.INFO, `Spawned ${newJobs.length} tasks from scan.`);
          setQueue(prev => [...prev, ...newJobs]);
      } else {
          addLog(LogLevel.INFO, `Scan complete. No tasks spawned.`);
      }
  };

  const handleGeneration = async (job: QueueItem, apiKey: string) => {
      const res = await generateLineArtTask(
          job.file,
          apiKey,
          job.taskType,
          options.gender,
          options.detailLevel,
          addLog,
          undefined,
          job.personDescription
      );

      setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.SUCCESS, result: res } : i));

      // Auto Download
      try {
          const link = document.createElement('a');
          link.href = res.url;
          // Filename: Line-<Queue>-<Filename>.png
          const baseName = job.file.name.substring(0, job.file.name.lastIndexOf('.')) || job.file.name;
          link.download = `Line-${job.taskType}-${baseName}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          addLog(LogLevel.INFO, `Auto-downloaded result for ${job.file.name}`);
      } catch (e) {
          addLog(LogLevel.ERROR, `Failed to auto-download: ${e}`);
      }
  };

  // --- Handlers ---

  const handleRetryAll = () => {
      setQueue(prev => prev.map(i => {
          // Retry queue items (non-fatal errors)
          if (i.status === ProcessingStatus.ERROR && !i.isBlocked && i.retryCount < 3) {
              return { ...i, status: ProcessingStatus.PENDING };
          }
          return i;
      }));
  };

  const handleRetryFailedQueue = () => {
      setQueue(prev => prev.map(i => {
          // Retry from Failed Queue (Last Chance items)
          if (i.status === ProcessingStatus.ERROR && (i.isBlocked || (i.retryCount >= 3 && i.isLastChance))) {
              return { ...i, status: ProcessingStatus.PENDING };
          }
          return i;
      }));
  };

  const handleDeleteFailedQueue = () => {
       setQueue(prev => prev.filter(i => !(i.status === ProcessingStatus.ERROR && (i.isBlocked || (i.retryCount >= 3 && i.isLastChance)))));
  };

  const handleDeleteEndedQueue = () => {
      setQueue(prev => prev.filter(i => i.status !== ProcessingStatus.ENDED));
  };

  const handleRemoveAllRetry = () => {
      setQueue(prev => prev.filter(i => !(i.status === ProcessingStatus.ERROR && !i.isBlocked && i.retryCount < 3)));
  };

  const handleRetryFailedItem = (id: string) => {
      setQueue(prev => prev.map(i => {
          if (i.id === id) {
              // Retry Once: Keep isLastChance=true. If it fails again, handleJobError will kill it.
              return { ...i, status: ProcessingStatus.PENDING }; 
          }
          return i;
      }));
  };
  
  const handleExport = async () => {
      const exportData = { uploads: await Promise.all(uploads.map(async u => ({...u, data: await blobToBase64(u.file)}))), options };
      const blob = new Blob([JSON.stringify(exportData)], {type: 'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lineartify_backup.json'; a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const data = JSON.parse(ev.target?.result as string);
              if (data.options) setOptions(data.options);
              if (data.uploads) {
                  const newUploads = await Promise.all(data.uploads.map(async (u: any) => {
                      const res = await fetch(u.data);
                      const blob = await res.blob();
                      const file = new File([blob], u.file.name, { type: u.file.type });
                      return { ...u, file, thumbnailUrl: URL.createObjectURL(file) };
                  }));
                  setUploads(prev => [...prev, ...newUploads]);
                  populateQueues(newUploads);
              }
          } catch(err) { console.error(err); }
      };
      reader.readAsText(file);
  };
  
  const handleApiKeyChange = async () => {
      if ((window as any).aistudio?.openSelectKey) await (window as any).aistudio.openSelectKey();
  };

  const toggleQueueControl = (key: keyof typeof queueControls) => {
      setQueueControls(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSourceSelection = (sourceId: string) => {
      setSelectedSourceIds(prev => {
          const next = new Set(prev);
          if (next.has(sourceId)) next.delete(sourceId);
          else next.add(sourceId);
          return next;
      });
  };

  // Drag & Drop Handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  // Helper for Gallery Highlighting logic
  const shouldHighlight = (taskType: TaskType) => {
      // Map Active Queue View to TaskType for highlighting
      switch (activeQueueView) {
          case 'FULL': return taskType === 'full';
          case 'BACKGROUND': return taskType === 'background';
          case 'ALL_PEOPLE': return taskType === 'all-people';
          case 'ALL_PEOPLE_NUDE': return taskType === 'all-people-nude';
          case 'MODEL': return taskType === 'model';
          case 'FACE': return taskType === 'face';
          case 'BACKSIDE': return taskType === 'backside';
          case 'NUDE': return taskType === 'nude';
          case 'NUDE_OPPOSITE': return taskType === 'nude-opposite';
          case 'MODEL_FULL': return taskType === 'model-full';
          case 'UPSCALE': return taskType === 'upscale';
          default: return false; 
      }
  };

  return (
    <div 
        className="flex flex-col h-screen w-screen bg-[#0f0f16] text-slate-200 font-sans overflow-hidden relative"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
          <div className="absolute inset-0 z-[100] bg-indigo-500/20 backdrop-blur-sm border-4 border-indigo-500 border-dashed flex items-center justify-center pointer-events-none">
              <div className="text-4xl font-bold text-white drop-shadow-lg">Drop images to upload</div>
          </div>
      )}

      {/* --- HEADER --- */}
      <header className="flex-none h-14 bg-[#181825] border-b border-white/5 flex items-center justify-between px-4 z-50">
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
                    <ImageIcon className="text-white w-5 h-5" />
                </div>
                <h1 className="font-bold text-lg tracking-tight">LineArtify</h1>
            </div>
            
            {/* PROGRESS BAR */}
            {totalJobs > 0 && (
                <div className="flex items-center space-x-3 bg-slate-800/50 px-3 py-1.5 rounded-full border border-white/5">
                    <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                        {completedJobs} / {totalJobs} jobs completed
                    </span>
                </div>
            )}
        </div>

        <div className="flex items-center space-x-2">
            <button onClick={() => setIsOptionsOpen(true)} className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors border border-white/5">
                <Settings size={16} /> <span>Options</span>
            </button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            
            <button onClick={() => toggleQueueControl('global')} className={`flex items-center space-x-2 px-4 py-1.5 rounded text-sm font-bold transition-all ${queueControls.global ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                {queueControls.global ? <><Pause size={16} fill="currentColor" /><span>Stop</span></> : <><Play size={16} fill="currentColor" /><span>Start</span></>}
            </button>

            <div className="w-px h-6 bg-white/10 mx-1"></div>

            <button onClick={handleExport} className="p-2 hover:bg-white/10 rounded text-slate-400 flex items-center space-x-2"><Save size={18} /><span className="text-xs">Save</span></button>
            <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded text-slate-400 flex items-center space-x-2"><FolderOpen size={18} /><span className="text-xs">Load</span></button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />

            <div className="w-px h-6 bg-white/10 mx-1"></div>

            <button onClick={() => setIsManualOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400 flex items-center space-x-2"><Book size={18} /><span className="text-xs">Manual</span></button>
            <button onClick={() => setIsConsoleOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400 flex items-center space-x-2"><Terminal size={18} /><span className="text-xs">Console</span></button>
            <button onClick={handleApiKeyChange} className="p-2 hover:bg-white/10 rounded text-slate-400 flex items-center space-x-2"><Key size={18} /><span className="text-xs">API Key</span></button>
        </div>
      </header>

      {/* --- MAIN LAYOUT --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* --- LEFT SIDEBAR (20vw) --- */}
        <div className="w-[20vw] flex flex-col bg-[#13131f] border-r border-white/5 relative z-10">
            {/* Queue Selector */}
            <div className="p-3 border-b border-white/5">
                <select 
                    value={activeQueueView} 
                    onChange={(e) => setActiveQueueView(e.target.value as QueueView)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded p-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="UPLOADS">Uploads ({uploads.length})</option>
                    <option value="JOBS">Jobs ({processingJobs.length})</option>
                    <option disabled>--- Queues ---</option>
                    <option value="FULL">Full Line Art</option>
                    <option value="BACKGROUND">Background</option>
                    <option value="ALL_PEOPLE">All People (Group)</option>
                    <option value="ALL_PEOPLE_NUDE">All People Nude (Group)</option>
                    <option value="COUNTING">Counting (Scanner)</option>
                    <option disabled>--- Person Tasks ---</option>
                    <option value="MODEL">Character</option>
                    <option value="FACE">Face Portrait</option>
                    <option value="BACKSIDE">Opposite View</option>
                    <option value="NUDE">Nude</option>
                    <option value="NUDE_OPPOSITE">Nude Opposite</option>
                    <option value="MODEL_FULL">Body Reconstruction</option>
                    <option disabled>--- Utility ---</option>
                    <option value="UPSCALE">Upscale (4K)</option>
                    <option disabled>--- Status ---</option>
                    <option value="RETRY">Retry</option>
                    <option value="FAILED">Failed / Blocked</option>
                    <option value="ENDED">Ended</option>
                </select>

                {/* Queue Specific Controls */}
                <div className="flex items-center justify-between mt-3">
                    {activeQueueView === 'UPLOADS' && (
                        <div className="w-full flex items-center justify-center p-4 border-2 border-dashed border-white/10 rounded bg-white/5 hover:bg-white/10 cursor-pointer relative transition-colors">
                            <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleUpload(e.target.files)} />
                            <div className="flex items-center space-x-2 text-sm text-slate-400 font-medium">
                                <Upload size={16} /> <span>Add Images / Drag & Drop</span>
                            </div>
                        </div>
                    )}

                    {(activeQueueView === 'FULL' || activeQueueView === 'BACKGROUND' || activeQueueView === 'ALL_PEOPLE' || activeQueueView === 'ALL_PEOPLE_NUDE' || activeQueueView === 'COUNTING' || 
                      activeQueueView === 'MODEL' || activeQueueView === 'FACE' || activeQueueView === 'BACKSIDE' || activeQueueView === 'NUDE' || 
                      activeQueueView === 'NUDE_OPPOSITE' || activeQueueView === 'MODEL_FULL' || activeQueueView === 'UPSCALE') && (
                        <div className="w-full flex justify-between items-center bg-slate-800/50 p-2 rounded">
                            <span className="text-xs font-mono uppercase text-slate-400">Queue Active</span>
                            <button 
                                onClick={() => {
                                    if (activeQueueView === 'FULL') toggleQueueControl('full');
                                    if (activeQueueView === 'BACKGROUND') toggleQueueControl('background');
                                    if (activeQueueView === 'ALL_PEOPLE') toggleQueueControl('allPeople');
                                    if (activeQueueView === 'ALL_PEOPLE_NUDE') toggleQueueControl('allPeopleNude');
                                    if (activeQueueView === 'COUNTING') toggleQueueControl('counting');
                                    if (activeQueueView === 'MODEL') toggleQueueControl('model');
                                    if (activeQueueView === 'FACE') toggleQueueControl('face');
                                    if (activeQueueView === 'BACKSIDE') toggleQueueControl('backside');
                                    if (activeQueueView === 'NUDE') toggleQueueControl('nude');
                                    if (activeQueueView === 'NUDE_OPPOSITE') toggleQueueControl('nudeOpposite');
                                    if (activeQueueView === 'MODEL_FULL') toggleQueueControl('modelFull');
                                    if (activeQueueView === 'UPSCALE') toggleQueueControl('upscale');
                                }}
                                className={`w-10 h-5 rounded-full relative transition-colors ${
                                    (activeQueueView === 'FULL' && queueControls.full) || 
                                    (activeQueueView === 'BACKGROUND' && queueControls.background) ||
                                    (activeQueueView === 'ALL_PEOPLE' && queueControls.allPeople) ||
                                    (activeQueueView === 'ALL_PEOPLE_NUDE' && queueControls.allPeopleNude) ||
                                    (activeQueueView === 'COUNTING' && queueControls.counting) ||
                                    (activeQueueView === 'MODEL' && queueControls.model) ||
                                    (activeQueueView === 'FACE' && queueControls.face) ||
                                    (activeQueueView === 'BACKSIDE' && queueControls.backside) ||
                                    (activeQueueView === 'NUDE' && queueControls.nude) ||
                                    (activeQueueView === 'NUDE_OPPOSITE' && queueControls.nudeOpposite) ||
                                    (activeQueueView === 'MODEL_FULL' && queueControls.modelFull) ||
                                    (activeQueueView === 'UPSCALE' && queueControls.upscale)
                                    ? 'bg-emerald-500' : 'bg-slate-600'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                     (activeQueueView === 'FULL' && queueControls.full) || 
                                     (activeQueueView === 'BACKGROUND' && queueControls.background) ||
                                     (activeQueueView === 'ALL_PEOPLE' && queueControls.allPeople) ||
                                     (activeQueueView === 'ALL_PEOPLE_NUDE' && queueControls.allPeopleNude) ||
                                     (activeQueueView === 'COUNTING' && queueControls.counting) ||
                                     (activeQueueView === 'MODEL' && queueControls.model) ||
                                     (activeQueueView === 'FACE' && queueControls.face) ||
                                     (activeQueueView === 'BACKSIDE' && queueControls.backside) ||
                                     (activeQueueView === 'NUDE' && queueControls.nude) ||
                                     (activeQueueView === 'NUDE_OPPOSITE' && queueControls.nudeOpposite) ||
                                     (activeQueueView === 'MODEL_FULL' && queueControls.modelFull) ||
                                     (activeQueueView === 'UPSCALE' && queueControls.upscale)
                                     ? 'translate-x-5.5 left-0.5' : 'translate-x-0.5 left-0.5'
                                }`}></div>
                            </button>
                        </div>
                    )}

                    {activeQueueView === 'RETRY' && (
                        <div className="flex gap-2 w-full">
                            <button onClick={handleRetryAll} className="flex-1 py-1 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 text-xs uppercase font-bold rounded">Retry All</button>
                            <button onClick={handleRemoveAllRetry} className="flex-1 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs uppercase font-bold rounded">Remove All</button>
                        </div>
                    )}

                     {activeQueueView === 'FAILED' && (
                        <div className="flex gap-2 w-full">
                            <button onClick={handleRetryFailedQueue} className="flex-1 py-1 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 text-xs uppercase font-bold rounded">Retry All</button>
                            <button onClick={handleDeleteFailedQueue} className="flex-1 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs uppercase font-bold rounded">Delete All</button>
                        </div>
                    )}

                    {activeQueueView === 'ENDED' && (
                        <div className="flex gap-2 w-full">
                             <button onClick={handleDeleteEndedQueue} className="flex-1 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs uppercase font-bold rounded">Delete All Ended</button>
                        </div>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
                {activeQueueView === 'UPLOADS' && uploads.map(upload => (
                    <div key={upload.id} className="bg-slate-800 rounded-lg overflow-hidden border border-white/5 relative group flex flex-col">
                        <div className="relative">
                             <img src={upload.thumbnailUrl} alt="source" className="w-full h-auto opacity-70 group-hover:opacity-100 transition-opacity" />
                             
                             {/* Checkbox Overlay */}
                             <div className="absolute top-2 left-2 z-20">
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); toggleSourceSelection(upload.id); }}
                                    className={`p-1 rounded bg-black/50 backdrop-blur transition-colors ${selectedSourceIds.has(upload.id) ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                                 >
                                     {selectedSourceIds.has(upload.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                                 </button>
                             </div>

                             <button onClick={() => deleteUpload(upload.id)} className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                <Trash2 size={14} />
                             </button>
                        </div>
                        <div className="p-2">
                            <p className="text-xs font-bold text-slate-200 truncate">{upload.file.name}</p>
                            <p className="text-[10px] text-slate-500">{new Date(upload.timestamp).toLocaleTimeString()}</p>
                        </div>
                    </div>
                ))}

                {activeQueueView !== 'UPLOADS' && getQueueItems(activeQueueView).map(item => (
                     <div key={item.id} className="bg-slate-800 rounded-lg overflow-hidden border border-white/5 relative group">
                        {/* Status Bar */}
                        <div className={`h-1 w-full ${item.status === ProcessingStatus.PROCESSING ? 'bg-indigo-500 animate-pulse' : item.status === ProcessingStatus.ERROR ? 'bg-red-500' : item.status === ProcessingStatus.ENDED ? 'bg-slate-900' : 'bg-slate-600'}`}></div>
                        
                        <div className="relative">
                            <img src={item.thumbnailUrl} alt="job" className="w-full h-auto opacity-80" />
                            
                             {/* Checkbox Overlay for Jobs too (links to source) */}
                             <div className="absolute top-2 left-2 z-20">
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); toggleSourceSelection(item.sourceId); }}
                                    className={`p-1 rounded bg-black/50 backdrop-blur transition-colors ${selectedSourceIds.has(item.sourceId) ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                                 >
                                     {selectedSourceIds.has(item.sourceId) ? <CheckSquare size={20} /> : <Square size={20} />}
                                 </button>
                             </div>

                            {item.status === ProcessingStatus.PROCESSING && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                                    <RefreshCw className="text-indigo-400 animate-spin" size={32} />
                                </div>
                            )}
                            {item.detectBox && (
                                <div className="absolute border-2 border-indigo-500/50" style={{
                                    top: `${item.detectBox[0]/10}%`, left: `${item.detectBox[1]/10}%`,
                                    height: `${(item.detectBox[2]-item.detectBox[0])/10}%`, width: `${(item.detectBox[3]-item.detectBox[1])/10}%`
                                }}></div>
                            )}
                        </div>
                        
                        <div className="p-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-bold text-slate-200 uppercase">{item.taskType}</p>
                                    <p className="text-[10px] text-slate-400 truncate w-48">{item.file.name}</p>
                                    {item.personDescription && <p className="text-[10px] text-indigo-300 italic">{item.personDescription}</p>}
                                </div>
                                {item.retryCount > 0 && <span className="text-[10px] bg-red-900/50 text-red-300 px-1 rounded">{item.retryCount} Retries</span>}
                            </div>
                            
                            {item.errorMessage && (
                                <div className="mt-2 p-1.5 bg-red-900/20 border border-red-500/20 rounded text-[10px] text-red-300 font-mono">
                                    {item.errorMessage}
                                </div>
                            )}

                            {/* Buttons for Failed/Retry items inside sidebar */}
                            {(item.status === ProcessingStatus.ERROR || activeQueueView === 'FAILED' || activeQueueView === 'RETRY') && (
                                <div className="flex gap-2 mt-2">
                                     <button 
                                        onClick={() => handleRetryFailedItem(item.id)} 
                                        className="flex-1 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] uppercase font-bold rounded flex items-center justify-center gap-1"
                                    >
                                        <RefreshCcw size={10} /> Retry
                                    </button>
                                     <button 
                                        onClick={() => deleteJob(item.id)} 
                                        className="flex-1 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] uppercase font-bold rounded flex items-center justify-center gap-1"
                                    >
                                        <Trash2 size={10} /> Delete
                                    </button>
                                </div>
                            )}
                        </div>
                         {/* Fallback delete for regular items */}
                         {!item.errorMessage && (
                            <button onClick={() => deleteJob(item.id)} className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                <Trash2 size={14} />
                            </button>
                         )}
                     </div>
                ))}
            </div>
        </div>

        {/* --- MAIN CONTENT (80vw) --- */}
        <div className="w-[80vw] h-full flex flex-col bg-[#0f0f16] relative">
            {/* Gallery Area */}
            <div className="flex-1 overflow-y-auto p-8">
                 <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-8">
                     {galleryItems.map(item => (
                         <div key={item.id} className="flex flex-col group animate-fade-in">
                             <div 
                                className={`relative bg-[#1e1e1e] rounded-t-xl overflow-hidden cursor-zoom-in border border-b-0 transition-all duration-300 ${shouldHighlight(item.taskType) ? 'border-emerald-500 ring-4 ring-emerald-500/30' : 'border-white/5'}`}
                                onClick={() => setViewerItemId(item.id)}
                                style={{ height: '400px', borderWidth: shouldHighlight(item.taskType) ? '0px' : '1px' }}
                             >
                                 <div className="absolute inset-0 flex items-center justify-center bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
                                 <img 
                                    src={item.result?.url} 
                                    alt="Result" 
                                    className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105" 
                                 />
                                 
                                 {/* Highlight Border Overlay if Active */}
                                 {shouldHighlight(item.taskType) && (
                                     <div className="absolute inset-0 border-[8px] border-emerald-500 pointer-events-none rounded-t-lg z-10"></div>
                                 )}
                                 
                                 {/* Overlay Tags */}
                                 <div className="absolute top-3 left-3 flex flex-col items-start gap-1 z-20">
                                     <span className={`px-2 py-1 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded tracking-wider ${shouldHighlight(item.taskType) ? 'bg-emerald-600' : 'bg-black/60'}`}>
                                        {item.taskType}
                                     </span>
                                     {item.personDescription && (
                                         <span className="px-2 py-1 bg-indigo-600/80 backdrop-blur-md text-white text-[10px] rounded max-w-[150px] truncate">
                                            {item.personDescription}
                                         </span>
                                     )}
                                 </div>
                             </div>
                             
                             {/* Actions Footer */}
                             <div className={`h-12 bg-slate-800 rounded-b-xl flex divide-x divide-white/10 ${shouldHighlight(item.taskType) ? 'border-x-[8px] border-b-[8px] border-emerald-500' : 'border border-white/5'}`}>
                                 <button 
                                    onClick={() => handleUpscale(item)}
                                    className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                                    title="Upscale to 4K"
                                 >
                                    <Wand2 size={14} className="text-purple-400" /> <span>Upscale</span>
                                 </button>
                                 <button 
                                    onClick={() => repeatJob(item)}
                                    className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                                 >
                                    <Repeat size={14} /> <span>Repeat</span>
                                 </button>
                                 <button 
                                    onClick={() => deleteJob(item.id)}
                                    className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                 >
                                    <Trash2 size={14} /> <span>Delete</span>
                                 </button>
                             </div>
                         </div>
                     ))}
                 </div>
                 
                 {galleryItems.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center text-slate-600 pointer-events-none">
                         <Layers size={64} className="mb-4 opacity-20" />
                         <p className="text-lg font-medium">
                            {selectedSourceIds.size > 0 ? "No results for selected images" : "Gallery is empty"}
                         </p>
                         <p className="text-sm">Processed images will appear here.</p>
                     </div>
                 )}
            </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      <Console isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} />
      <ManualDialog isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      <OptionsDialog isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} options={options} setOptions={setOptions} />
      
      {viewerItemId && (() => {
          const item = queue.find(i => i.id === viewerItemId) || uploads.find(u => u.id === viewerItemId) as any;
          return item ? (
            <ImageViewer 
                item={item} 
                onClose={() => setViewerItemId(null)} 
                hasNext={false} hasPrev={false}
            />
          ) : null;
      })()}

    </div>
  );
}
