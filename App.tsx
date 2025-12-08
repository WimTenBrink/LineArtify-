import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLogger } from './services/loggerService';
import {
  Upload, Play, Pause, Settings, Key, Book, Info, HelpCircle,
  Trash2, RefreshCw, ChevronUp, Image as ImageIcon, CheckCircle, AlertTriangle, Loader2,
  Terminal, ArrowUp, List, Layers, Square, CheckSquare, X
} from 'lucide-react';
import {
  ProcessingStatus, TaskType, SourceImage, QueueItem, AppOptions,
  PriorityLevel, LogLevel, StyleStat
} from './types';
import { TASK_DEFINITIONS } from './services/taskDefinitions';
import { saveWorkspace, loadWorkspace, clearWorkspace } from './services/dbService';
import { detectPeople, generateFilename, generateLineArtTask } from './services/geminiService';
import { addExifToJpeg, convertBlobUrlToJpeg } from './services/exifService';
import { EMPTY_GALLERY_BACKGROUND } from './assets';

// Dialogs
import Console from './components/Console';
import ManualDialog from './components/ManualDialog';
import OptionsDialog from './components/OptionsDialog';
import ImageViewer from './components/ImageViewer';
import { JobDetailsDialog } from './components/JobDetailsDialog';
import AboutDialog from './components/AboutDialog';

// Global types for AI Studio/Process
declare var process: { env: { API_KEY: string } };

const DEFAULT_OPTIONS: AppOptions = {
  taskTypes: { 'full': true },
  taskPriorities: {},
  stylePriorities: {},
  gender: 'As-is',
  detailLevel: 'Medium',
  modelPreference: 'flash',
  creativity: 0.4,
  customStyle: '',
  modesty: 'None',
  bodyHair: {},
  outputFormat: 'png'
};

const App: React.FC = () => {
  // --- State ---
  const [uploads, setUploads] = useState<SourceImage[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [options, setOptions] = useState<AppOptions>(DEFAULT_OPTIONS);
  const [isPaused, setIsPaused] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Dialog State
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
  const [dialogs, setDialogs] = useState({ viewer: false });
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  
  // Selection / Navigation State
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [galleryFilter, setGalleryFilter] = useState<'ALL' | 'SCENE' | 'PERSON' | 'STYLE' | 'FAILED' | 'PROCESSING'>('ALL');
  const [activeQueueView, setActiveQueueView] = useState<'SOURCES' | 'QUEUES'>('SOURCES');
  
  // Processing State
  const processingRef = useRef<boolean>(false);
  const activeJobsCount = useRef<number>(0);

  const { addLog } = useLogger();

  // --- Initialization ---

  useEffect(() => {
    const init = async () => {
      // 1. Check API Key
      if ((window as any).aistudio) {
        const keySelected = await (window as any).aistudio.hasSelectedApiKey();
        setHasKey(keySelected);
      }

      // 2. Load DB
      const loaded = await loadWorkspace();
      if (loaded) {
        setUploads(loaded.uploads);
        setQueue(loaded.queue);
        setOptions(loaded.options);
        addLog(LogLevel.INFO, 'Workspace restored from database.');
      }
    };
    init();
  }, [addLog]);

  // --- Persistence ---
  
  useEffect(() => {
    const timer = setTimeout(() => {
      saveWorkspace(uploads, queue, options).catch(err => {
        console.error("Auto-save failed", err);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [uploads, queue, options]);

  // --- Stats Calculation (Memoized) ---
  const stats = useMemo(() => {
      const s: Record<string, StyleStat> = {};
      Object.keys(TASK_DEFINITIONS).forEach(k => {
          s[k] = { success: 0, failure: 0, prohibited: 0 };
      });

      queue.forEach(item => {
          if (!s[item.taskType]) s[item.taskType] = { success: 0, failure: 0, prohibited: 0 };
          
          if (item.status === ProcessingStatus.SUCCESS) s[item.taskType].success++;
          if (item.status === ProcessingStatus.ERROR) {
               if (item.errorMessage?.includes("Policy")) s[item.taskType].prohibited++;
               else s[item.taskType].failure++;
          }
      });
      return s;
  }, [queue]);

  const queueStats = useMemo(() => {
      const total = queue.length;
      const completed = queue.filter(i => i.status === ProcessingStatus.SUCCESS).length;
      const failed = queue.filter(i => i.status === ProcessingStatus.ERROR).length;
      const processing = queue.filter(i => i.status === ProcessingStatus.PROCESSING).length;
      const pending = queue.filter(i => i.status === ProcessingStatus.PENDING).length;
      const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
      return { total, completed, failed, processing, pending, progress };
  }, [queue]);

  // --- Queue View Data ---
  const allQueues = useMemo(() => {
      // Aggregate queue items by Task Type
      const map = new Map<string, { id: string, label: string, count: number, active: number, error: number, isConfigurable: boolean }>();
      
      // Initialize with enabled tasks from options
      Object.entries(options.taskTypes).forEach(([key, enabled]) => {
          const def = TASK_DEFINITIONS[key as TaskType];
          if (def) {
            map.set(key, { 
                id: key, 
                label: def.label, 
                count: 0, 
                active: 0, 
                error: 0,
                isConfigurable: true 
            });
          }
      });

      // Populate counts
      queue.forEach(item => {
          if (!map.has(item.taskType)) {
              // If task is in queue but disabled in options, still show it? Or maybe it's a legacy task.
              const def = TASK_DEFINITIONS[item.taskType];
              map.set(item.taskType, { 
                  id: item.taskType, 
                  label: def?.label || item.taskType, 
                  count: 0, 
                  active: 0, 
                  error: 0,
                  isConfigurable: !!def 
              });
          }
          const entry = map.get(item.taskType)!;
          entry.count++;
          if (item.status === ProcessingStatus.PROCESSING || item.status === ProcessingStatus.PENDING) entry.active++;
          if (item.status === ProcessingStatus.ERROR) entry.error++;
      });

      return Array.from(map.values()).sort((a, b) => b.active - a.active);
  }, [queue, options.taskTypes]);

  // --- Helpers ---

  const handleKeySelect = async () => {
    if ((window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
        const check = await (window as any).aistudio.hasSelectedApiKey();
        setHasKey(check);
        if (check) addLog(LogLevel.INFO, 'API Key selected successfully.');
    }
  };

  const processFiles = useCallback(async (files: File[]) => {
    if (!hasKey) {
        setWarningMessage("Please select a Google Gemini API Key first.");
        handleKeySelect();
        return;
    }

    // Warning if full
    const pendingCount = queue.filter(q => q.status === ProcessingStatus.PENDING || q.status === ProcessingStatus.PROCESSING).length;
    if (pendingCount > 200) {
        setWarningMessage("Queue Limit Reached.\n\nThe system cannot accept more images because the job queue is full (200+ active jobs). Please wait for some jobs to finish before adding more.");
        return;
    }

    const newUploads: SourceImage[] = [];
    const newQueueItems: QueueItem[] = [];

    for (const file of files) {
        const id = crypto.randomUUID();
        const source: SourceImage = {
            id,
            file,
            thumbnailUrl: URL.createObjectURL(file),
            timestamp: Date.now(),
            options: { ...options } // Snapshot current options
        };
        newUploads.push(source);
        
        addLog(LogLevel.INFO, `Queued ${file.name} for scanning.`);
        
        // Initial Tasks (Pre-Scan)
        Object.entries(options.taskTypes).forEach(([taskKey, enabled]) => {
            if (enabled && TASK_DEFINITIONS[taskKey as TaskType]) {
                newQueueItems.push({
                    id: crypto.randomUUID(),
                    sourceId: id,
                    file: file,
                    taskType: taskKey as TaskType,
                    thumbnailUrl: source.thumbnailUrl,
                    status: ProcessingStatus.PENDING,
                    timestamp: Date.now(),
                    retryCount: 0,
                    maxRetries: 3,
                    errorHistory: [],
                    priority: (options.stylePriorities[taskKey] || 50)
                });
            }
        });

        // Background Processing
        detectPeople(file, process.env.API_KEY, addLog, options.gender).then(people => {
             setUploads(prev => prev.map(u => u.id === id ? { ...u, peopleCount: people.length } : u));
             
             // If NO people found, we should CANCEL Person/Style tasks to save credits/time
             if (people.length === 0) {
                 setQueue(prev => prev.map(q => {
                     if (q.sourceId === id && q.status === ProcessingStatus.PENDING) {
                         const def = TASK_DEFINITIONS[q.taskType];
                         if (def.category === 'Person' || def.category === 'Group' || def.category === 'Style') {
                             return { ...q, status: ProcessingStatus.ENDED, errorMessage: "Skipped: No people detected" };
                         }
                     }
                     return q;
                 }));
                 addLog(LogLevel.WARN, `No people detected in ${file.name}. Skipped person-related tasks.`);
             }
        });

        generateFilename(file, process.env.API_KEY).then(name => {
             setUploads(prev => prev.map(u => u.id === id ? { ...u, displayName: name } : u));
        });
    }

    setUploads(prev => [...newUploads, ...prev]);
    setQueue(prev => [...newQueueItems, ...prev]); 
  }, [hasKey, queue, options, addLog]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    await processFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
        setIsDragging(true);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const imageFiles = Array.from(e.dataTransfer.files).filter((f: File) => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
            await processFiles(imageFiles);
        }
    }
  }, [processFiles]);

  const isQueueOptionEnabled = (taskType: string) => {
      return !!options.taskTypes[taskType];
  };

  const toggleQueueOption = (taskType: string) => {
      setOptions(prev => ({
          ...prev,
          taskTypes: {
              ...prev.taskTypes,
              [taskType]: !prev.taskTypes[taskType]
          }
      }));
  };

  const generateReport = () => {
    const now = new Date();
    const fmt = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${fmt(now.getMonth()+1)}${fmt(now.getDate())}-${fmt(now.getHours())}${fmt(now.getMinutes())}`;
    
    let md = `# Error report-${timestamp}\n\n`;

    // Group styles
    const stylesByGroup: Record<string, TaskType[]> = {};
    
    Object.keys(TASK_DEFINITIONS).forEach(key => {
        const def = TASK_DEFINITIONS[key as TaskType];
        if (def.category === 'Style') {
            const group = def.subCategory || 'Misc';
            if (!stylesByGroup[group]) stylesByGroup[group] = [];
            stylesByGroup[group].push(key as TaskType);
        }
    });

    // Header for Report
    md += `Report generated on ${now.toLocaleString()}\n\n`;

    Object.keys(stylesByGroup).sort().forEach(group => {
        // Filter out styles with 0 total activity
        const activeStyles = stylesByGroup[group].filter(key => {
            const s = stats[key] || { success: 0, failure: 0, prohibited: 0 };
            return (s.success + s.failure + s.prohibited) > 0;
        });

        if (activeStyles.length === 0) return;

        md += `## ${group}\n`;
        md += `| Style Name | Success | Failure | Prohibited | Total | Description |\n`;
        md += `|---|---|---|---|---|---|\n`;
        
        activeStyles.forEach(key => {
            const def = TASK_DEFINITIONS[key as TaskType];
            const s = stats[key] || { success: 0, failure: 0, prohibited: 0 };
            const total = s.success + s.failure + s.prohibited;
            md += `| ${def.label} | ${s.success} | ${s.failure} | ${s.prohibited} | ${total} | ${def.description} |\n`;
        });
        md += `\n`;
    });

    md += `\n---\n© ${now.getFullYear()} Katje B.V.`;

    // Download logic
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Error report-${timestamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Queue Processor ---

  const processQueue = useCallback(async () => {
    if (isPaused || !hasKey || processingRef.current || activeJobsCount.current >= 5) return;
    
    // Find candidate
    const candidates = queue.filter(i => i.status === ProcessingStatus.PENDING);
    if (candidates.length === 0) return;

    // Sort by Priority (High to Low), then timestamp
    candidates.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.timestamp - b.timestamp;
    });

    const job = candidates[0];

    // Mark as Processing
    activeJobsCount.current++;
    setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.PROCESSING } : i));

    try {
        const source = uploads.find(u => u.id === job.sourceId);
        // Pass source-specific options if available (snapshots), otherwise global
        const jobOptions = source?.options || options;

        const result = await generateLineArtTask(
            job.file,
            process.env.API_KEY,
            job.taskType,
            jobOptions,
            addLog,
            (msg) => addLog(LogLevel.INFO, `[Job ${job.taskType}] ${msg}`),
            job.personDescription
        );

        // Success Handling
        let finalUrl = result.url;
        let finalBlob: Blob | undefined = undefined;

        // Convert to JPG if requested
        if (jobOptions.outputFormat === 'jpg' && result.url) {
             const jpegDataUrl = await convertBlobUrlToJpeg(result.url);
             // Add EXIF
             const displayName = source?.displayName || "generated-image";
             const meta = {
                 filename: displayName,
                 style: job.taskType,
                 model: jobOptions.modelPreference || 'flash'
             };
             const exifDataUrl = addExifToJpeg(jpegDataUrl, meta);
             
             // Convert back to Blob for storage efficiency
             const res = await fetch(exifDataUrl);
             finalBlob = await res.blob();
             finalUrl = URL.createObjectURL(finalBlob);
        }

        setQueue(prev => prev.map(i => i.id === job.id ? { 
            ...i, 
            status: ProcessingStatus.SUCCESS, 
            result: { ...result, url: finalUrl, blob: finalBlob } 
        } : i));
        
        addLog(LogLevel.INFO, `Job Finished: ${job.taskType}`);

    } catch (err: any) {
        setQueue(prev => {
            const retry = (job.retryCount || 0) + 1;
            const isFatal = err.message.includes("Policy") || retry >= (job.maxRetries || 3);
            
            return prev.map(i => i.id === job.id ? {
                ...i,
                status: isFatal ? ProcessingStatus.ERROR : ProcessingStatus.PENDING, // Back to pending if retry
                isBlocked: err.message.includes("Policy"),
                retryCount: retry,
                errorMessage: err.message,
                errorHistory: [...(i.errorHistory || []), err.message]
            } : i);
        });
        
        addLog(LogLevel.ERROR, `Job Failed: ${job.taskType}`, err.message);
    } finally {
        activeJobsCount.current--;
        // Trigger next loop
        setTimeout(processQueue, 100);
    }
  }, [isPaused, hasKey, queue, uploads, options, addLog]);

  useEffect(() => {
      const interval = setInterval(processQueue, 500);
      return () => clearInterval(interval);
  }, [processQueue]);


  // --- Render Helpers ---
  const filteredGallery = useMemo(() => {
      let items = queue;
      
      // Source Filter
      if (selectedSourceId) {
          items = items.filter(i => i.sourceId === selectedSourceId);
      }

      // Status/Category Filter
      if (galleryFilter === 'FAILED') items = items.filter(i => i.status === ProcessingStatus.ERROR);
      else if (galleryFilter === 'PROCESSING') items = items.filter(i => i.status === ProcessingStatus.PROCESSING || i.status === ProcessingStatus.PENDING);
      else if (galleryFilter === 'SCENE') items = items.filter(i => TASK_DEFINITIONS[i.taskType].category === 'Scene');
      else if (galleryFilter === 'PERSON') items = items.filter(i => TASK_DEFINITIONS[i.taskType].category === 'Person' || TASK_DEFINITIONS[i.taskType].category === 'Group');
      else if (galleryFilter === 'STYLE') items = items.filter(i => TASK_DEFINITIONS[i.taskType].category === 'Style');

      // Sort: Processing first, then Success (Newest First)
      return items.sort((a, b) => {
          if (a.status === ProcessingStatus.PROCESSING && b.status !== ProcessingStatus.PROCESSING) return -1;
          if (b.status === ProcessingStatus.PROCESSING && a.status !== ProcessingStatus.PROCESSING) return 1;
          return b.timestamp - a.timestamp;
      });
  }, [queue, selectedSourceId, galleryFilter]);

  const selectedItem = queue.find(i => i.id === selectedItemId);
  const selectedSource = uploads.find(u => u.id === selectedSourceId);

  return (
    <div 
        className="flex h-screen w-screen bg-[#0f0f16] text-white overflow-hidden font-sans select-none relative"
        onDragEnter={handleDragEnter}
    >
      
      {/* --- DRAG OVERLAY --- */}
      {isDragging && (
        <div 
            className="fixed inset-0 z-[100] bg-indigo-500/20 backdrop-blur-sm border-4 border-indigo-500 border-dashed m-4 rounded-3xl flex items-center justify-center animate-in fade-in duration-200"
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={handleDrop}
        >
            <div className="bg-[#181825] p-10 rounded-2xl shadow-2xl flex flex-col items-center pointer-events-none transform transition-transform scale-110">
                <Upload size={64} className="text-indigo-400 mb-6" />
                <h2 className="text-3xl font-bold text-white mb-2">Drop Images Here</h2>
                <p className="text-slate-400">Add to workspace queue</p>
            </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-[#181825] border-b border-white/5 flex items-center px-4 z-40 justify-between">
          <div className="flex items-center gap-4">
               {/* Pause/Play */}
               <button 
                  onClick={() => setIsPaused(!isPaused)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-bold text-xs transition-all ${
                      isPaused ? 'bg-slate-700 text-slate-300' : 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                  }`}
               >
                   {isPaused ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                   {isPaused ? 'PAUSED' : 'RUNNING'}
               </button>

               {/* Progress */}
               <div className="flex flex-col w-48 gap-1">
                   <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                       <span>Queue Progress</span>
                       <span>{queueStats.progress}%</span>
                   </div>
                   <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${queueStats.progress}%` }}></div>
                   </div>
               </div>

               {/* Stats Pills */}
               <div className="hidden md:flex gap-2">
                   <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-300 font-mono">Act: {queueStats.processing}</div>
                   <div className="px-2 py-1 bg-slate-500/10 border border-slate-500/20 rounded text-[10px] text-slate-300 font-mono">Q: {queueStats.pending}</div>
                   {queueStats.failed > 0 && <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-300 font-mono">Err: {queueStats.failed}</div>}
               </div>

                {/* Report Generation Button */}
               <button 
                  onClick={generateReport}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded text-xs font-bold text-slate-300 transition-colors"
                  title="Generate Error Report"
               >
                  <Terminal size={14} /> Report
               </button>
          </div>

          <div className="flex items-center gap-2">
               <button onClick={() => setIsOptionsOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title="Configuration"><Settings size={20}/></button>
               <button onClick={handleKeySelect} className={`p-2 hover:bg-white/10 rounded transition-colors ${hasKey ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} title="API Key"><Key size={20}/></button>
               <div className="w-px h-6 bg-white/10 mx-1"></div>
               <button onClick={() => setIsManualOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title="Manual"><Book size={20}/></button>
               <button onClick={() => setIsConsoleOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title="System Logs"><Terminal size={20}/></button>
               <button onClick={() => setIsAboutOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title="About"><HelpCircle size={20}/></button>
          </div>
      </div>

      {/* --- NAVBAR --- */}
      <div className="fixed top-14 left-64 right-0 h-10 bg-[#13111c] border-b border-white/5 flex items-center px-4 z-30 overflow-x-auto scrollbar-hide gap-1">
           <button onClick={() => setGalleryFilter('ALL')} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${galleryFilter === 'ALL' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>All Results</button>
           <button onClick={() => setGalleryFilter('SCENE')} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${galleryFilter === 'SCENE' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}>Scenes</button>
           <button onClick={() => setGalleryFilter('PERSON')} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${galleryFilter === 'PERSON' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-500 hover:text-slate-300'}`}>People</button>
           <button onClick={() => setGalleryFilter('STYLE')} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${galleryFilter === 'STYLE' ? 'bg-pink-500/20 text-pink-300' : 'text-slate-500 hover:text-slate-300'}`}>Styles</button>
           
           <div className="flex-1"></div>
           
           <button onClick={() => setGalleryFilter('PROCESSING')} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${galleryFilter === 'PROCESSING' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500 hover:text-slate-300'}`}>Processing</button>
           <button onClick={() => setGalleryFilter('FAILED')} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${galleryFilter === 'FAILED' ? 'bg-red-500/20 text-red-300' : 'text-slate-500 hover:text-slate-300'}`}>Failed</button>
      </div>

      {/* --- SIDEBAR --- */}
      <div className="fixed top-14 bottom-0 left-0 w-64 bg-[#181825] border-r border-white/5 flex flex-col z-30">
          
          {/* Sidebar Tabs */}
          <div className="flex border-b border-white/5">
              <button 
                onClick={() => setActiveQueueView('SOURCES')}
                className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 ${activeQueueView === 'SOURCES' ? 'bg-[#181825] text-white' : 'bg-black/20 text-slate-500 hover:text-slate-300'}`}
              >
                  <Layers size={14} /> Sources
              </button>
              <button 
                onClick={() => setActiveQueueView('QUEUES')}
                className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 ${activeQueueView === 'QUEUES' ? 'bg-[#181825] text-white' : 'bg-black/20 text-slate-500 hover:text-slate-300'}`}
              >
                  <List size={14} /> Queues
              </button>
          </div>

          {activeQueueView === 'SOURCES' ? (
              <>
                {/* Upload Area */}
                <div className="p-4 border-b border-white/5">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all group">
                        <div className="flex flex-col items-center pt-2 pb-3">
                            <Upload className="w-6 h-6 text-slate-500 group-hover:text-indigo-400 mb-2" />
                            <p className="text-xs text-slate-400 font-bold uppercase">Add Images</p>
                        </div>
                        <input type="file" className="hidden" multiple accept="image/*" onChange={handleUpload} />
                    </label>
                </div>

                {/* Sources List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {uploads.length === 0 && (
                        <div className="text-center mt-10 text-slate-600 text-xs italic">No sources uploaded</div>
                    )}
                    {uploads.map(u => {
                        const uQueue = queue.filter(q => q.sourceId === u.id);
                        const uPending = uQueue.filter(q => q.status === ProcessingStatus.PENDING).length;
                        const uFail = uQueue.filter(q => q.status === ProcessingStatus.ERROR).length;
                        const uSuccess = uQueue.filter(q => q.status === ProcessingStatus.SUCCESS).length;
                        const uTotal = uQueue.length;
                        const percent = uTotal ? (uSuccess/uTotal)*100 : 0;
                        const isSelected = selectedSourceId === u.id;

                        return (
                            <div 
                                key={u.id}
                                className={`relative rounded-lg overflow-hidden border transition-all cursor-pointer group ${isSelected ? 'border-indigo-500 bg-white/5' : 'border-white/5 bg-black/20 hover:border-white/10'}`}
                                onClick={() => setSelectedSourceId(isSelected ? null : u.id)}
                            >
                                <div className="flex p-2 gap-3">
                                    <div className="w-12 h-12 rounded bg-black shrink-0 overflow-hidden relative">
                                        <img src={u.thumbnailUrl} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="text-xs font-bold text-slate-200 truncate">{u.displayName || "Scanning..."}</div>
                                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                            {u.peopleCount !== undefined ? `${u.peopleCount} People` : 'Scanning...'}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Mini Progress */}
                                <div className="h-1 bg-black w-full mt-1">
                                    <div className={`h-full ${uFail > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }}></div>
                                </div>

                                {/* Hover Actions */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setUploads(prev => prev.filter(up => up.id !== u.id));
                                            setQueue(prev => prev.filter(q => q.sourceId !== u.id));
                                            if (selectedSourceId === u.id) setSelectedSourceId(null);
                                        }}
                                        className="p-1 bg-black/60 hover:bg-red-500 text-white rounded" title="Delete Source"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </>
          ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                  {allQueues.map(q => {
                      const enabled = isQueueOptionEnabled(q.id);
                      return (
                        <div key={q.id} className="bg-black/20 border border-white/5 rounded p-2 flex items-center gap-2 hover:bg-white/5 transition-colors">
                             {q.isConfigurable && (
                                <button 
                                  onClick={() => toggleQueueOption(q.id)}
                                  className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${enabled ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600 text-transparent'}`}
                                >
                                    <CheckSquare size={10} />
                                </button>
                             )}
                             <div className="flex-1 min-w-0">
                                 <div className={`text-xs font-bold truncate ${enabled ? 'text-slate-200' : 'text-slate-500 line-through'}`}>{q.label}</div>
                                 <div className="flex gap-2 text-[10px] font-mono text-slate-500">
                                     <span>{q.count} Total</span>
                                     {q.active > 0 && <span className="text-blue-400">{q.active} Act</span>}
                                 </div>
                             </div>
                        </div>
                      );
                  })}
              </div>
          )}

          {/* Queue Actions */}
          <div className="p-2 border-t border-white/5 grid grid-cols-2 gap-2">
               <button 
                  onClick={() => {
                      setQueue(prev => prev.map(q => q.status === ProcessingStatus.ERROR ? { ...q, status: ProcessingStatus.PENDING, retryCount: 0 } : q));
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold text-slate-300 flex items-center justify-center gap-1"
               >
                   <RefreshCw size={12} /> Retry All
               </button>
               <button 
                  onClick={() => {
                      setQueue(prev => prev.filter(q => q.status !== ProcessingStatus.ERROR));
                  }}
                  className="p-2 bg-slate-800 hover:bg-red-900/50 rounded text-xs font-bold text-slate-300 flex items-center justify-center gap-1"
               >
                   <Trash2 size={12} /> Clear Err
               </button>
          </div>
      </div>

      {/* --- MAIN GALLERY --- */}
      <div 
        className="fixed top-24 bottom-0 left-64 right-0 overflow-y-auto p-6 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: filteredGallery.length === 0 ? `url(${EMPTY_GALLERY_BACKGROUND})` : 'none' }}
      >
          {filteredGallery.length === 0 && (
              <div className="flex items-center justify-center h-full">
                  <div className="bg-black/80 backdrop-blur border border-white/10 p-8 rounded-2xl text-center max-w-md">
                      <ImageIcon className="w-16 h-16 text-indigo-500 mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-bold text-white mb-2">Workspace Empty</h3>
                      <p className="text-slate-400 text-sm mb-6">Upload an image to start generating line art. Ensure you have selected a valid API key.</p>
                      <button onClick={() => (document.querySelector('input[type=file]') as HTMLElement)?.click()} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors">Upload Image</button>
                  </div>
              </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-20">
              {filteredGallery.map(item => {
                  const isSuccess = item.status === ProcessingStatus.SUCCESS;
                  const isProcessing = item.status === ProcessingStatus.PROCESSING;
                  const isError = item.status === ProcessingStatus.ERROR;
                  const displayUrl = item.result?.url || item.thumbnailUrl;

                  return (
                      <div 
                          key={item.id} 
                          className={`aspect-square relative rounded-xl overflow-hidden group bg-[#181825] border-2 transition-all ${
                              isProcessing ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' :
                              isSuccess ? 'border-transparent hover:border-indigo-500' :
                              isError ? 'border-red-500/50' : 'border-white/5 opacity-60'
                          }`}
                      >
                          <img src={displayUrl} className={`w-full h-full object-cover transition-transform duration-500 ${isSuccess ? 'group-hover:scale-110' : 'grayscale'}`} loading="lazy" />
                          
                          {/* Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                               <div className="font-bold text-xs text-white truncate">{item.taskType}</div>
                               <div className="text-[10px] text-slate-400 truncate mb-2">{item.file.name}</div>
                               
                               <div className="flex items-center justify-between gap-1">
                                   <button 
                                       onClick={() => { setSelectedItemId(item.id); setDialogs(d => ({...d, viewer: true})); }}
                                       className="flex-1 py-1.5 bg-white text-black rounded font-bold text-[10px] hover:bg-indigo-400 transition-colors flex justify-center"
                                   >
                                       VIEW
                                   </button>
                                   <button 
                                       onClick={() => { setSelectedItemId(item.id); setIsJobDetailsOpen(true); }}
                                       className="p-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors"
                                       title="Details"
                                   >
                                       <Info size={12} />
                                   </button>
                                   {isError && (
                                       <button 
                                           onClick={() => setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: ProcessingStatus.PENDING, retryCount: 0 } : q))}
                                           className="p-1.5 bg-slate-800 text-white rounded hover:bg-blue-600 transition-colors"
                                           title="Retry"
                                       >
                                           <RefreshCw size={12} />
                                       </button>
                                   )}
                                   <button 
                                       onClick={() => setQueue(prev => prev.filter(q => q.id !== item.id))}
                                       className="p-1.5 bg-slate-800 text-white rounded hover:bg-red-600 transition-colors"
                                       title="Delete"
                                   >
                                       <Trash2 size={12} />
                                   </button>
                               </div>
                          </div>

                          {/* Status Badges */}
                          {isProcessing && (
                              <div className="absolute top-2 right-2 p-1.5 bg-blue-600 rounded-full animate-spin">
                                  <Loader2 size={14} className="text-white" />
                              </div>
                          )}
                          {isError && (
                              <div className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-full">
                                  <AlertTriangle size={14} className="text-white" />
                              </div>
                          )}
                          {!isSuccess && !isError && !isProcessing && (
                              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur rounded text-[10px] font-mono text-slate-300 border border-white/10">
                                  P:{item.priority}
                              </div>
                          )}
                      </div>
                  );
              })}
          </div>
      </div>

      {/* --- WARNING DIALOG --- */}
      {warningMessage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e1c2e] w-[400px] rounded-xl border border-red-500/30 shadow-2xl p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="text-red-500" size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">System Warning</h3>
                <p className="text-sm text-slate-300 mb-6 whitespace-pre-wrap">{warningMessage}</p>
                <button 
                    onClick={() => setWarningMessage(null)}
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-colors w-full"
                >
                    Dismiss
                </button>
            </div>
        </div>
      )}

      {/* --- DIALOGS --- */}
      <Console isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} />
      <ManualDialog isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      <OptionsDialog 
          isOpen={isOptionsOpen} 
          onClose={() => setIsOptionsOpen(false)} 
          options={options} 
          setOptions={setOptions} 
      />
      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      
      {isJobDetailsOpen && selectedItem && (
          <JobDetailsDialog 
              isOpen={true} 
              onClose={() => setIsJobDetailsOpen(false)} 
              job={selectedItem}
              source={uploads.find(u => u.id === selectedItem.sourceId)}
          />
      )}

      {dialogs.viewer && selectedItem && (
          <ImageViewer 
              item={selectedItem}
              onClose={() => setDialogs(d => ({...d, viewer: false}))}
              hasNext={!!queue[queue.indexOf(selectedItem) + 1]}
              hasPrev={!!queue[queue.indexOf(selectedItem) - 1]}
              onNext={() => {
                  const idx = queue.indexOf(selectedItem);
                  if (queue[idx + 1]) setSelectedItemId(queue[idx + 1].id);
              }}
              onPrev={() => {
                  const idx = queue.indexOf(selectedItem);
                  if (queue[idx - 1]) setSelectedItemId(queue[idx - 1].id);
              }}
              onRepeat={() => {
                  // Clone item
                  const newItem: QueueItem = {
                      ...selectedItem,
                      id: crypto.randomUUID(),
                      status: ProcessingStatus.PENDING,
                      result: undefined,
                      timestamp: Date.now(),
                      retryCount: 0
                  };
                  setQueue(prev => [newItem, ...prev]);
              }}
              onDelete={() => {
                  setQueue(prev => prev.filter(q => q.id !== selectedItem.id));
                  setDialogs(d => ({...d, viewer: false}));
              }}
              onDetails={() => {
                  setIsJobDetailsOpen(true);
                  // Don't close viewer, just layer details on top
              }}
          />
      )}

    </div>
  );
};

export default App;