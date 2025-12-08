import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLogger } from './services/loggerService';
import { generateLineArtTask, detectPeople, generateFilename } from './services/geminiService';
import { saveWorkspace, loadWorkspace, clearWorkspace } from './services/dbService';
import { convertBlobUrlToJpeg, addExifToJpeg } from './services/exifService';
import Console from './components/Console';
import ImageViewer from './components/ImageViewer';
import ManualDialog from './components/ManualDialog';
import OptionsDialog from './components/OptionsDialog';
import { JobDetailsDialog } from './components/JobDetailsDialog';
import { QueueItem, ProcessingStatus, LogLevel, AppOptions, SourceImage, TaskType, PriorityLevel } from './types';
import { TASK_DEFINITIONS } from './services/taskDefinitions';
import { EMPTY_GALLERY_BACKGROUND } from './assets';
import { 
    Upload, RefreshCw, Play, Pause, Trash2, Key, Book, 
    Settings, Image as ImageIcon, Layers, XCircle, Info,
    ArrowLeft, EyeOff, Repeat, Eye, Filter, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight,
    Zap, ArrowUp, Activity, ChevronsUp, Eraser, Scissors, AlertTriangle, List, Grid, FolderX, CheckCircle, ShieldAlert, Ban, MousePointer2, Users
} from 'lucide-react';

// Helper for converting Blob/File to Base64 (Data URL)
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const WARNING_THRESHOLD_UPLOADS = 100;
const HARD_LIMIT_UPLOADS = 150;
const WARNING_THRESHOLD_JOBS = 500;
const HARD_LIMIT_JOBS = 750;

// Queue definitions
const ANALYZING_TYPES: TaskType[] = ['scan-people', 'generate-name'];

// Helper to determine active queue types for Tabs
const getQueueTypes = (queue: QueueItem[]): string[] => {
    const types = new Set<string>();
    queue.forEach(j => {
        if (!ANALYZING_TYPES.includes(j.taskType)) {
            // Group by category from TaskDefinition if possible, or just use taskType
            const def = TASK_DEFINITIONS[j.taskType];
            if (def) types.add(def.label);
            else types.add(j.taskType);
        }
    });
    return Array.from(types).sort();
};

// Helper for Failure Alerts
const getAlertLevel = (jobs: QueueItem[]): 'NONE' | 'HIGH_FAILURE' | 'CRITICAL_FAILURE' => {
    if (jobs.length === 0) return 'NONE';
    const failed = jobs.filter(j => j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED);
    if (failed.length === 0) return 'NONE';
    
    // Calculate rate based on completed/failed attempts vs total
    // "more than half the jobs in a queue have failed"
    const failureRate = failed.length / jobs.length;
    
    if (failureRate <= 0.5) return 'NONE';
    
    // Check for prohibited
    const hasProhibited = failed.some(j => j.isBlocked);
    return hasProhibited ? 'CRITICAL_FAILURE' : 'HIGH_FAILURE';
};

const GalleryItemCard: React.FC<{ 
    item: QueueItem, 
    onSetViewerItemId: (id: string) => void, 
    onRepeat: (item: QueueItem) => void, 
    onDelete: (id: string) => void, 
    onDeleteSource: (sourceId: string) => void,
    onDetails: (id: string) => void,
    onFilterSource: (sourceId: string) => void,
    showPriority?: boolean
}> = ({ item, onSetViewerItemId, onRepeat, onDelete, onDeleteSource, onDetails, onFilterSource, showPriority }) => {
     const [showOriginal, setShowOriginal] = useState(false);
     const displayUrl = showOriginal ? item.thumbnailUrl : (item.result?.url || item.thumbnailUrl);
     const isProcessing = item.status === ProcessingStatus.PROCESSING;
     const isSuccess = item.status === ProcessingStatus.SUCCESS;
     const isFailed = item.status === ProcessingStatus.ERROR || item.status === ProcessingStatus.ENDED;

     return (
         <div className={`flex flex-col group relative rounded-xl overflow-hidden bg-[#1e1c2e] transition-all hover:border-purple-500/50 shadow-lg ${isSuccess ? 'border-4 border-emerald-500' : isFailed ? 'border-4 border-red-500/50' : 'border-0'}`}>
             <div className="relative h-48 cursor-zoom-in" onClick={() => onSetViewerItemId(item.id)}>
                 {isProcessing && (
                     <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-[2px] flex items-center justify-center flex-col gap-2">
                         <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                         <span className="text-[10px] font-bold text-purple-300 animate-pulse">Running...</span>
                     </div>
                 )}
                 {isFailed && !item.result && (
                     <div className="absolute inset-0 z-20 bg-red-900/20 flex items-center justify-center">
                         <AlertTriangle className="text-red-500 w-12 h-12 opacity-50" />
                     </div>
                 )}
                 <img src={displayUrl} className="w-full h-full object-contain p-2 bg-[#13111c]" loading="lazy" />
                 
                 <div className="absolute top-2 left-2 flex flex-col gap-1 z-20 pointer-events-none">
                    <span className="px-1.5 py-0.5 bg-black/60 backdrop-blur text-white text-[9px] font-bold uppercase rounded border border-white/10">{item.taskType}</span>
                    {showPriority && <span className="px-1.5 py-0.5 bg-indigo-500/80 backdrop-blur text-white text-[9px] font-bold uppercase rounded border border-white/10 flex items-center gap-1"><Zap size={8} /> P:{item.priority}</span>}
                 </div>

                 <div className="absolute top-2 right-2 flex flex-col gap-1 z-20">
                     {item.result && (
                         <button 
                            onClick={(e) => { e.stopPropagation(); setShowOriginal(!showOriginal); }}
                            className="p-1.5 rounded-full bg-black/60 hover:bg-white/20 backdrop-blur text-white opacity-0 group-hover:opacity-100 transition-opacity border border-white/10"
                            title="Show Result"
                         >
                            {showOriginal ? <EyeOff size={14} /> : <Eye size={14} />}
                         </button>
                     )}
                     <button 
                        onClick={(e) => { e.stopPropagation(); onFilterSource(item.sourceId); }}
                        className="p-1.5 rounded-full bg-black/60 hover:bg-indigo-500 backdrop-blur text-white opacity-0 group-hover:opacity-100 transition-opacity border border-white/10"
                        title="Filter by Source Image"
                     >
                        <Filter size={14} />
                     </button>
                 </div>
             </div>
             <div className="h-8 bg-[#181825] flex divide-x divide-white/5 border-t border-white/5">
                 <button onClick={() => onSetViewerItemId(item.id)} className="flex-1 flex items-center justify-center hover:bg-white/5 text-slate-400 hover:text-white transition-colors" title="View"><ImageIcon size={14} /></button>
                 <button onClick={() => onRepeat(item)} className="flex-1 flex items-center justify-center hover:bg-white/5 text-slate-400 hover:text-white transition-colors" title="Repeat"><Repeat size={14} /></button>
                 <button onClick={() => onDetails(item.id)} className="flex-1 flex items-center justify-center hover:bg-white/5 text-slate-400 hover:text-white transition-colors" title="Details"><Info size={14} /></button>
                 <button onClick={() => onDelete(item.id)} className="flex-1 flex items-center justify-center hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors" title="Delete Job"><Trash2 size={14} /></button>
                 <button onClick={() => onDeleteSource(item.sourceId)} className="flex-1 flex items-center justify-center hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors" title="Delete Source & All Jobs"><FolderX size={14} /></button>
             </div>
         </div>
     );
};

export default function App() {
  // Data State
  const [uploads, setUploads] = useState<SourceImage[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]); 
  
  // Ref to track latest uploads state for async callbacks
  const uploadsRef = useRef(uploads);
  useEffect(() => { uploadsRef.current = uploads; }, [uploads]);

  // App Config State
  const [options, setOptions] = useState<AppOptions>({
    taskTypes: Object.keys(TASK_DEFINITIONS).reduce((acc, key) => {
        acc[key] = TASK_DEFINITIONS[key as TaskType].defaultEnabled;
        return acc;
    }, {} as Record<string, boolean>),
    taskPriorities: Object.keys(TASK_DEFINITIONS).reduce((acc, key) => {
        acc[key] = 'Normal';
        return acc;
    }, {} as Record<string, PriorityLevel>),
    stylePriorities: {}, 
    gender: 'As-is',
    detailLevel: 'Medium',
    modelPreference: 'flash',
    creativity: 0.4,
    customStyle: '',
    modesty: 'None',
    bodyHair: {},
    outputFormat: 'png' // Default format
  });

  const [maxConcurrent, setMaxConcurrent] = useState(5);
  const [sidebarWidth, setSidebarWidth] = useState<number>(25);
  const [isResizing, setIsResizing] = useState(false);
  
  // UI State
  const [sidebarView, setSidebarView] = useState<'SOURCES' | 'QUEUES'>('SOURCES');
  const [activeQueueTab, setActiveQueueTab] = useState<string>('UPLOADS'); // 'UPLOADS' here means "All Results" or Main View
  const [viewerItemId, setViewerItemId] = useState<string | null>(null);
  const [detailsJobId, setDetailsJobId] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  
  // Drag and Drop State
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isKeyLoading, setIsKeyLoading] = useState(false);
  const [filterNoPeople, setFilterNoPeople] = useState(false);
  
  const [queueActive, setQueueActive] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useLogger();

  // Initialization
  useEffect(() => {
    const init = async () => {
        const state = await loadWorkspace();
        if (state) {
            setUploads(state.uploads);
            // Migrate queue to ensure priority exists
            setQueue(state.queue.map(q => ({...q, priority: q.priority ?? 50})));
            setOptions(prev => ({ ...prev, ...state.options, outputFormat: state.options.outputFormat || 'png' }));
            addLog(LogLevel.INFO, "Restored previous workspace.");
        }
    };
    init();
  }, [addLog]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
        if (uploads.length > 0 || queue.length > 0) {
            saveWorkspace(uploads, queue, options);
        }
    }, 2000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [uploads, queue, options]);

  // Sidebar Resizing
  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) setSidebarWidth(Math.max(15, Math.min(50, (e.clientX / window.innerWidth) * 100)));
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
        window.removeEventListener("mousemove", resize);
        window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // --- Bulk Queue Actions ---
  const retryAllFailed = () => {
      setQueue(prev => prev.map(j => j.status === ProcessingStatus.ERROR ? { ...j, status: ProcessingStatus.PENDING, retryCount: 0, priority: 60 } : j));
      addLog(LogLevel.INFO, "Retrying all failed jobs.");
  };

  const deleteAllFailed = () => {
      setQueue(prev => prev.filter(j => j.status !== ProcessingStatus.ERROR));
      addLog(LogLevel.INFO, "Deleted all failed jobs.");
  };

  const deleteAllDead = () => {
      setQueue(prev => prev.filter(j => j.status !== ProcessingStatus.ENDED));
      addLog(LogLevel.INFO, "Deleted all dead jobs.");
  };

  const boostAllWaiting = () => {
      setQueue(prev => prev.map(j => j.status === ProcessingStatus.PENDING ? { ...j, priority: j.priority + 1 } : j));
      addLog(LogLevel.INFO, "Boosted all waiting jobs by +1.");
  };

  const clearGallery = () => {
      // Remove SUCCESS jobs (Display jobs)
      setQueue(prev => prev.filter(j => j.status === ProcessingStatus.SUCCESS));
      addLog(LogLevel.INFO, "Cleared all finished jobs from gallery.");
  };

  const pruneUploads = () => {
      // Keep uploads that have PENDING or PROCESSING jobs
      const activeSourceIds = new Set(queue.filter(j => j.status === ProcessingStatus.PENDING || j.status === ProcessingStatus.PROCESSING).map(j => j.sourceId));
      
      const toRemove = uploads.filter(u => !activeSourceIds.has(u.id));
      
      if (toRemove.length === 0) {
          alert("No unused uploads found.");
          return;
      }

      if (confirm(`Remove ${toRemove.length} uploads that have no active jobs? This will also remove their finished/failed history.`)) {
          const removeIds = new Set(toRemove.map(u => u.id));
          setUploads(prev => prev.filter(u => !removeIds.has(u.id)));
          // Clean up any lingering non-active jobs for these sources
          setQueue(prev => prev.filter(j => !removeIds.has(j.sourceId)));
          // Reset Selection if needed
          if (selectedSourceId && removeIds.has(selectedSourceId)) setSelectedSourceId(null);
          addLog(LogLevel.INFO, `Pruned ${toRemove.length} unused uploads.`);
      }
  };

  const boostQueue = (category: string) => {
      setQueue(prev => prev.map(j => {
          if (j.status !== ProcessingStatus.PENDING) return j;
          const def = TASK_DEFINITIONS[j.taskType];
          // Check for exact match or category match
          const matches = (def && def.label === category) || j.taskType === category || (category === 'Pending' && j.status === ProcessingStatus.PENDING);
          if (matches) {
              return { ...j, priority: j.priority + 5 };
          }
          return j;
      }));
      addLog(LogLevel.INFO, `Boosted queue '${category}' by +5.`);
  };

  // Helper actions for gallery context
  const retrySelection = (items: QueueItem[]) => {
      const ids = new Set(items.filter(j => j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED).map(j => j.id));
      setQueue(prev => prev.map(j => ids.has(j.id) ? { ...j, status: ProcessingStatus.PENDING, retryCount: 0, priority: 60, errorHistory: [] } : j));
      addLog(LogLevel.INFO, `Retrying ${ids.size} failed items in selection.`);
  };

  const deleteFailedInSelection = (items: QueueItem[]) => {
      const ids = new Set(items.filter(j => j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED).map(j => j.id));
      setQueue(prev => prev.filter(j => !ids.has(j.id)));
      addLog(LogLevel.INFO, `Deleted ${ids.size} failed items in selection.`);
  };

  const deleteAllInSelection = (items: QueueItem[]) => {
      const ids = new Set(items.map(j => j.id));
      setQueue(prev => prev.filter(j => !ids.has(j.id)));
      addLog(LogLevel.INFO, `Deleted ${ids.size} items in selection.`);
  };


  // --- Core Processing Logic ---
  useEffect(() => {
    if (!queueActive) return;

    const runProcessor = async () => {
        const apiKey = process.env.API_KEY || '';
        
        // Split jobs by lane
        const analyzingJobs = queue.filter(j => 
            j.status === ProcessingStatus.PROCESSING && ANALYZING_TYPES.includes(j.taskType)
        );
        const generatingJobs = queue.filter(j => 
            j.status === ProcessingStatus.PROCESSING && !ANALYZING_TYPES.includes(j.taskType)
        );

        // --- LANE 1: ANALYZING (Max 3) ---
        if (analyzingJobs.length < 3) {
            const candidates = queue
                .filter(j => j.status === ProcessingStatus.PENDING && ANALYZING_TYPES.includes(j.taskType))
                .sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp); // High priority first, then FIFO

            if (candidates.length > 0) {
                const job = candidates[0];
                startJob(job, apiKey);
            }
        }

        // --- LANE 2: GENERATING (Configurable Max) ---
        if (generatingJobs.length < maxConcurrent) {
             const candidates = queue
                .filter(j => j.status === ProcessingStatus.PENDING && !ANALYZING_TYPES.includes(j.taskType))
                .sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);

            if (candidates.length > 0) {
                const job = candidates[0];
                startJob(job, apiKey);
            }
        }
    };

    const startJob = async (job: QueueItem, apiKey: string) => {
        if (!apiKey) { handleJobError(job, "Missing API Key", false); return; }
        
        // Optimistic update to PROCESSING
        setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.PROCESSING } : i));

        try {
            const source = uploadsRef.current.find(u => u.id === job.sourceId);
            const jobOptions = source?.options || options;

            if (job.taskType === 'scan-people') {
                await handleScanning(job, apiKey, jobOptions);
            } else if (job.taskType === 'generate-name') {
                 const name = await generateFilename(job.file, apiKey);
                 setUploads(prev => prev.map(u => u.id === job.sourceId ? { ...u, displayName: name } : u));
                 setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.SUCCESS } : i));
            } else {
                 const res = await generateLineArtTask(job.file, apiKey, job.taskType, jobOptions, addLog, undefined, job.personDescription);
                 
                 // Handle Auto-download and Format Conversion
                 if (res.url) {
                     // Fetch latest source info (in case name generation finished while we were generating art)
                     const currentSource = uploadsRef.current.find(u => u.id === job.sourceId);
                     const baseName = currentSource?.displayName || currentSource?.file.name.split('.')[0] || "image";
                     const safeName = baseName.replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
                     
                     const outputFormat = jobOptions.outputFormat || 'png';
                     
                     if (outputFormat === 'jpg') {
                         try {
                            // Convert PNG to JPG and add EXIF
                            const jpegData = await convertBlobUrlToJpeg(res.url);
                            const modelName = jobOptions.modelPreference === 'pro' ? 'Gemini 3 Pro Image' : 'Gemini 2.5 Flash Image';
                            
                            const exifJpeg = addExifToJpeg(jpegData, {
                                filename: safeName,
                                style: job.taskType,
                                model: modelName
                            });
                            
                            // Download as JPG
                            const a = document.createElement('a');
                            a.href = exifJpeg;
                            a.download = `${job.taskType}-${safeName}.jpg`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);

                         } catch (conversionErr) {
                             console.error("Failed to convert/export JPG", conversionErr);
                             // Fallback to PNG download if JPG processing fails
                             const a = document.createElement('a');
                             a.href = res.url;
                             a.download = `${job.taskType}-${safeName}.png`;
                             document.body.appendChild(a);
                             a.click();
                             document.body.removeChild(a);
                         }
                     } else {
                         // Default PNG
                         const filename = `${job.taskType}-${safeName}.png`;
                         const a = document.createElement('a');
                         a.href = res.url;
                         a.download = filename;
                         document.body.appendChild(a);
                         a.click();
                         document.body.removeChild(a);
                     }
                 }

                 setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.SUCCESS, result: res } : i));
            }
        } catch (error: any) {
            handleJobError(job, error.message || "Unknown error", error.message?.includes("Safety") || error.message?.includes("Prohibited"));
        }
    };

    const interval = setInterval(runProcessor, 1000);
    return () => clearInterval(interval);
  }, [queue, queueActive, uploads, maxConcurrent, options]);

  const handleJobError = (job: QueueItem, message: string, isProhibited: boolean) => {
      // Calculate penalty
      const penalty = isProhibited ? 10 : 5;
      const newPriority = Math.max(1, job.priority - penalty);
      
      const newHistory = [...(job.errorHistory || []), message];
      const isDead = newHistory.length >= 3;
      
      addLog(LogLevel.WARN, `Job ${job.taskType} failed. Penalty: -${penalty}. New Prio: ${newPriority}. ${isDead ? 'JOB DIED.' : 'Retrying...'}`);

      setQueue(prev => prev.map(i => i.id === job.id ? {
          ...i,
          status: isDead ? ProcessingStatus.ENDED : ProcessingStatus.ERROR,
          errorMessage: message,
          retryCount: i.retryCount + 1,
          errorHistory: newHistory,
          isBlocked: isProhibited,
          priority: newPriority
      } : i));
  };

  const handleScanning = async (job: QueueItem, apiKey: string, jobOptions: AppOptions) => {
      let people = await detectPeople(job.file, apiKey, addLog, jobOptions.gender);
      if (people.length === 0) people = []; // Normalized to empty array if no people found
      
      // Update Source with People Count
      setUploads(prev => prev.map(u => u.id === job.sourceId ? { ...u, peopleCount: people.length } : u));
      
      setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.SUCCESS } : i));

      const newJobs: QueueItem[] = [];
      const create = (type: TaskType, desc?: string, box?: number[]) => ({
          id: crypto.randomUUID(), sourceId: job.sourceId, file: job.file, taskType: type,
          personDescription: desc, detectBox: box, thumbnailUrl: job.thumbnailUrl,
          status: ProcessingStatus.PENDING, timestamp: Date.now(), retryCount: 0,
          maxRetries: 3, errorHistory: [], priority: 50
      });

      // Default fallback subject if no people found but we need to run tasks (e.g. standard scene tasks)
      const peopleList = people.length > 0 ? people : [{ description: "Subject" }];

      if (people.length > 1) {
          if (jobOptions.taskTypes['all-people']) newJobs.push(create('all-people'));
          if (jobOptions.taskTypes['all-people-nude']) newJobs.push(create('all-people-nude'));
      }
      
      peopleList.forEach(p => {
          Object.keys(jobOptions.taskTypes).forEach(key => {
              const def = TASK_DEFINITIONS[key as TaskType];
              // Only spawn person-specific tasks if actual people were found, OR if it's a generic "Subject" fallback for styles
              if (jobOptions.taskTypes[key] && def && (def.category === 'Person' || def.category === 'Style')) {
                   newJobs.push(create(key as TaskType, p.description, p.box_2d));
              }
          });
      });
      // Scenes
      if (jobOptions.taskTypes['full']) newJobs.push(create('full'));
      if (jobOptions.taskTypes['full-nude']) newJobs.push(create('full-nude'));
      if (jobOptions.taskTypes['background']) newJobs.push(create('background'));

      if (newJobs.length > 0) setQueue(prev => [...prev, ...newJobs]);
  };

  const handleUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    if (uploads.length >= HARD_LIMIT_UPLOADS) { alert(`Upload limit reached (${HARD_LIMIT_UPLOADS}).`); return; }
    if (queue.length >= HARD_LIMIT_JOBS) { alert(`Job queue full (${HARD_LIMIT_JOBS}).`); return; }

    const newUploads: SourceImage[] = [];
    const newJobs: QueueItem[] = [];

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const id = crypto.randomUUID();
        const thumbnailUrl = URL.createObjectURL(file);
        
        // Capture snapshot of current options for this image
        const snapshotOptions = JSON.parse(JSON.stringify(options));

        newUploads.push({
            id, file, thumbnailUrl, timestamp: Date.now(), 
            options: snapshotOptions
        });

        // 1. Scanner Job (High Priority)
        newJobs.push({
            id: crypto.randomUUID(), sourceId: id, file, taskType: 'scan-people',
            thumbnailUrl, status: ProcessingStatus.PENDING, timestamp: Date.now(),
            retryCount: 0, maxRetries: 3, errorHistory: [], priority: 90 // High priority
        });

        // 2. Name Gen Job (VERY HIGH PRIORITY to ensure filename is ready for auto-downloads)
        newJobs.push({
             id: crypto.randomUUID(), sourceId: id, file, taskType: 'generate-name',
             thumbnailUrl, status: ProcessingStatus.PENDING, timestamp: Date.now(),
             retryCount: 0, maxRetries: 3, errorHistory: [], priority: 95 // Very High priority
        });
    });

    setUploads(prev => [...newUploads, ...prev]);
    setQueue(prev => [...prev, ...newJobs]);
    addLog(LogLevel.INFO, `Added ${newUploads.length} images to workspace.`);
  }, [options, uploads.length, queue.length, addLog]);

  // Drag & Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
        const next = prev - 1;
        if (next === 0) setIsDraggingOver(false);
        return next;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setDragCounter(0);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
    }
  };

  const selectKey = async () => {
      if (window.aistudio?.openSelectKey) {
          setIsKeyLoading(true);
          try {
             await window.aistudio.openSelectKey();
          } finally {
             setIsKeyLoading(false);
          }
      }
  };

  // Actions for Sidebar Items
  const boostSource = (sourceId: string) => {
      setQueue(prev => prev.map(job => 
          job.sourceId === sourceId && job.status === ProcessingStatus.PENDING
          ? { ...job, priority: job.priority + 10 }
          : job
      ));
      addLog(LogLevel.INFO, "Boosted priority for pending jobs of source: " + sourceId);
  };

  const retrySource = (sourceId: string) => {
      setQueue(prev => prev.map(job => 
          job.sourceId === sourceId && (job.status === ProcessingStatus.ERROR || job.status === ProcessingStatus.ENDED)
          ? { ...job, status: ProcessingStatus.PENDING, retryCount: 0, priority: 60 } // Retry with slightly higher priority
          : job
      ));
      addLog(LogLevel.INFO, "Retrying failed jobs for source: " + sourceId);
  };

  const deleteSource = (sourceId: string) => {
      // Directly delete without confirmation as requested
      // 1. Remove from Queue first to prevent any processing
      setQueue(prev => prev.filter(j => j.sourceId !== sourceId));
      // 2. Remove from Uploads
      setUploads(prev => prev.filter(u => u.id !== sourceId));
      // 3. Clear selection if needed
      if(selectedSourceId === sourceId) setSelectedSourceId(null);
      addLog(LogLevel.INFO, "Deleted source " + sourceId + " and all related jobs.");
  };

  // Derived UI Data & Filters
  
  // Counts for Buttons
  const failedJobsCount = queue.filter(j => j.status === ProcessingStatus.ERROR && !ANALYZING_TYPES.includes(j.taskType)).length;
  const deadJobsCount = queue.filter(j => j.status === ProcessingStatus.ENDED && !ANALYZING_TYPES.includes(j.taskType)).length;
  const waitingJobsCount = queue.filter(j => j.status === ProcessingStatus.PENDING && !ANALYZING_TYPES.includes(j.taskType)).length;
  const finishedJobsCount = queue.filter(j => j.status === ProcessingStatus.SUCCESS && !ANALYZING_TYPES.includes(j.taskType)).length;
  const prunableUploadsCount = (() => {
      const activeSourceIds = new Set(queue.filter(j => j.status === ProcessingStatus.PENDING || j.status === ProcessingStatus.PROCESSING).map(j => j.sourceId));
      return uploads.filter(u => !activeSourceIds.has(u.id)).length;
  })();

  // Filter Logic
  const baseFilteredQueue = queue.filter(item => {
      // Background jobs should not be visible in gallery
      if (ANALYZING_TYPES.includes(item.taskType)) return false;

      // HIDE PENDING JOBS FROM GALLERY (Running & Finished Only)
      // UNLESS the user is explicitly looking at the 'Pending' queue or a category queue that includes them.
      const isExplicitPendingView = activeQueueTab === 'Pending' || activeQueueTab === item.taskType || TASK_DEFINITIONS[item.taskType]?.label === activeQueueTab;
      
      if (item.status === ProcessingStatus.PENDING && !isExplicitPendingView) return false;

      if (activeQueueTab === 'Failed') return item.status === ProcessingStatus.ERROR;
      if (activeQueueTab === 'Dead') return item.status === ProcessingStatus.ENDED;
      if (activeQueueTab === 'Pending') return item.status === ProcessingStatus.PENDING;
      if (activeQueueTab === 'UPLOADS') return true; 
      if (activeQueueTab === 'JOBS') return item.status === ProcessingStatus.PROCESSING || item.status === ProcessingStatus.PENDING;
      
      const def = TASK_DEFINITIONS[item.taskType];
      if (def && def.label === activeQueueTab) return true;
      if (item.taskType === activeQueueTab) return true;
      return false;
  });

  // Section 1: Top (Selected Source Results) - NOW INCLUDES ALL RELEVANT JOBS FOR SOURCE
  const selectedSourceJobs = selectedSourceId 
      ? queue.filter(j => j.sourceId === selectedSourceId && !ANALYZING_TYPES.includes(j.taskType))
             .sort((a, b) => {
                 // Sort priority: Success > Processing > Failed > Pending
                 const getScore = (s: ProcessingStatus) => {
                     if (s === ProcessingStatus.SUCCESS) return 4;
                     if (s === ProcessingStatus.PROCESSING) return 3;
                     if (s === ProcessingStatus.ERROR) return 2;
                     return 1;
                 }
                 return getScore(b.status) - getScore(a.status) || b.timestamp - a.timestamp;
             })
      : [];

  // Section 2: Middle (Running/Processing) - Exclude selected source to avoid duplicates
  const runningJobs = baseFilteredQueue.filter(j => 
      j.status === ProcessingStatus.PROCESSING &&
      (selectedSourceId ? j.sourceId !== selectedSourceId : true)
  );
  
  // Section 3: Bottom (Finished History - Exclude selected if shown above)
  const finishedJobs = baseFilteredQueue.filter(j => 
      j.status === ProcessingStatus.SUCCESS && 
      (selectedSourceId ? j.sourceId !== selectedSourceId : true)
  );
  
  // Also show Pending/Failed/Dead if explicitly selected in tab - Exclude selected source
  const explicitOtherJobs = baseFilteredQueue.filter(j => 
      (j.status === ProcessingStatus.PENDING || j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED) &&
      (activeQueueTab !== 'UPLOADS' && activeQueueTab !== 'JOBS') &&
      (selectedSourceId ? j.sourceId !== selectedSourceId : true)
  );

  // Calculate Progress
  const activeJobs = queue.filter(j => j.status === ProcessingStatus.PENDING || j.status === ProcessingStatus.PROCESSING).length;
  const progress = queue.length > 0 ? ((queue.filter(j => j.status === ProcessingStatus.SUCCESS || j.status === ProcessingStatus.ENDED).length) / queue.length) * 100 : 0;
  
  const categories = getQueueTypes(queue);
  
  // Unified List of Queues for Sidebar
  const allQueues = [
      { id: 'Pending', label: 'Uploads (Waiting)', count: waitingJobsCount, color: 'text-indigo-400', border: 'border-indigo-500' },
      { id: 'Failed', label: 'Failed Jobs', count: failedJobsCount, color: 'text-red-400', border: 'border-red-500' },
      { id: 'Dead', label: 'Dead Jobs', count: deadJobsCount, color: 'text-slate-500', border: 'border-slate-500' },
      ...categories.map(cat => ({
          id: cat,
          label: cat,
          count: queue.filter(j => TASK_DEFINITIONS[j.taskType]?.label === cat || j.taskType === cat).length,
          color: 'text-purple-400',
          border: 'border-purple-500'
      }))
  ].filter(q => q.count > 0);

  // Viewer Navigation Logic
  const displayedViewerList = [...selectedSourceJobs, ...runningJobs, ...finishedJobs, ...explicitOtherJobs];
  const currentIndex = viewerItemId ? displayedViewerList.findIndex(i => i.id === viewerItemId) : -1;
  const hasNext = currentIndex < displayedViewerList.length - 1;
  const hasPrev = currentIndex > 0;

  // Filter uploads based on "No People" checkbox
  const displayedUploads = uploads.filter(u => {
      if (filterNoPeople) return u.peopleCount === 0;
      return true;
  });

  return (
    <div 
        className="flex h-screen bg-[#0f0f16] text-white font-sans overflow-hidden select-none"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
    >
      
      {/* Drag Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-[100] bg-indigo-900/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-200 pointer-events-none">
             <div className="bg-white/10 p-12 rounded-full mb-8 border-4 border-white/20 shadow-2xl shadow-indigo-500/50">
                <Upload className="w-32 h-32 text-white animate-bounce" />
             </div>
             <h2 className="text-5xl font-bold text-white tracking-tight drop-shadow-xl">Drop Images Here</h2>
             <p className="text-indigo-200 mt-4 text-xl font-medium tracking-wide">to add them to the workspace</p>
        </div>
      )}

      {/* --- SIDEBAR --- */}
      <aside 
        style={{ width: `${sidebarWidth}%` }} 
        className="flex flex-col h-full border-r border-white/5 bg-[#13111c] relative shrink-0 z-20 shadow-2xl"
        ref={sidebarRef}
      >
        {/* Sidebar Header - FIXED */}
        <div className="p-4 border-b border-white/5 bg-[#13111c] shrink-0 space-y-3 z-20">
             <div className="flex items-center justify-between mb-2">
                 <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">LineArtify</h1>
                 <span className="text-[10px] font-mono text-slate-500 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">v4.5</span>
             </div>
             
             {/* View Toggle */}
             <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                 <button onClick={() => setSidebarView('SOURCES')} className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${sidebarView === 'SOURCES' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Grid size={14} className="inline mr-1" /> Sources</button>
                 <button onClick={() => setSidebarView('QUEUES')} className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${sidebarView === 'QUEUES' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><List size={14} className="inline mr-1" /> Queues</button>
             </div>

             {sidebarView === 'SOURCES' && (
                <>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2.5 bg-slate-800 hover:bg-indigo-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow border border-white/5 group text-xs"
                    >
                        <Upload size={16} className="group-hover:animate-bounce" /> <span>Upload Images</span>
                    </button>
                    <input type="file" multiple ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleUpload(e.target.files)} />

                    <div className="flex flex-col gap-2 px-1">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                            <span>{displayedUploads.length} Sources</span>
                            <button onClick={() => { if(confirm('Clear all data?')) { clearWorkspace(); window.location.reload(); }}} className="hover:text-red-400 flex items-center gap-1"><Trash2 size={12}/> Clear All</button>
                        </div>
                        {/* No People Filter */}
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={filterNoPeople} 
                                onChange={(e) => setFilterNoPeople(e.target.checked)}
                                className="rounded border-white/10 bg-black/40 text-indigo-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span>Show empty scans only (0 people)</span>
                        </label>
                    </div>
                </>
             )}
        </div>
        
        {/* Fixed Actions Panel for Queues */}
        {sidebarView === 'QUEUES' && (
            <div className="shrink-0 p-3 border-b border-white/5 bg-[#181825] space-y-2 shadow-lg z-10">
                <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-2">Bulk Actions</div>
                <div className="grid grid-cols-2 gap-2">
                     <button onClick={boostAllWaiting} className="flex items-center gap-1 p-2 bg-slate-800 hover:bg-indigo-600 rounded text-[9px] font-bold text-slate-300 hover:text-white transition-colors border border-white/5">
                         <Zap size={12} className="shrink-0" /> Boost Wait ({waitingJobsCount})
                     </button>
                     <button onClick={retryAllFailed} className="flex items-center gap-1 p-2 bg-slate-800 hover:bg-emerald-600 rounded text-[9px] font-bold text-slate-300 hover:text-white transition-colors border border-white/5">
                         <RefreshCw size={12} className="shrink-0" /> Retry Failed ({failedJobsCount})
                     </button>
                     <button onClick={deleteAllFailed} className="flex items-center gap-1 p-2 bg-slate-800 hover:bg-amber-600 rounded text-[9px] font-bold text-slate-300 hover:text-white transition-colors border border-white/5">
                         <AlertTriangle size={12} className="shrink-0" /> Del Failed ({failedJobsCount})
                     </button>
                     <button onClick={deleteAllDead} className="flex items-center gap-1 p-2 bg-slate-800 hover:bg-red-600 rounded text-[9px] font-bold text-slate-300 hover:text-white transition-colors border border-white/5">
                         <Trash2 size={12} className="shrink-0" /> Del Dead ({deadJobsCount})
                     </button>
                     <button onClick={clearGallery} className="flex items-center gap-1 p-2 bg-slate-800 hover:bg-slate-600 rounded text-[9px] font-bold text-slate-300 hover:text-white transition-colors border border-white/5">
                         <Eraser size={12} className="shrink-0" /> Clear Display ({finishedJobsCount})
                     </button>
                     <button onClick={pruneUploads} className="flex items-center gap-1 p-2 bg-slate-800 hover:bg-slate-600 rounded text-[9px] font-bold text-slate-300 hover:text-white transition-colors border border-white/5">
                         <Scissors size={12} className="shrink-0" /> Prune Uploads ({prunableUploadsCount})
                     </button>
                </div>
            </div>
        )}

        {/* Sidebar List - SCROLLABLE */}
        <div className="flex-1 overflow-y-auto bg-[#181825] custom-scrollbar">
            {sidebarView === 'SOURCES' ? (
                // --- SOURCES VIEW ---
                <>
                    {displayedUploads.map(u => {
                        const isActive = selectedSourceId === u.id;
                        const isScanning = queue.some(j => j.sourceId === u.id && j.taskType === 'scan-people' && j.status === ProcessingStatus.PROCESSING);
                        const isAnalysingName = queue.some(j => j.sourceId === u.id && j.taskType === 'generate-name' && j.status === ProcessingStatus.PROCESSING);
                        
                        // Counts for specific statuses
                        const sourceJobs = queue.filter(j => j.sourceId === u.id && !ANALYZING_TYPES.includes(j.taskType));
                        const finishedCount = sourceJobs.filter(j => j.status === ProcessingStatus.SUCCESS).length;
                        const prohibitedCount = sourceJobs.filter(j => j.isBlocked).length;
                        const failedCount = sourceJobs.filter(j => (j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED) && !j.isBlocked).length;
                        const totalCount = sourceJobs.length;
                        const activeCount = Math.max(0, totalCount - finishedCount - prohibitedCount - failedCount);
                        
                        const alertLevel = getAlertLevel(sourceJobs);
                        const displayFailedCount = failedCount + prohibitedCount; // For label purposes, show total bad jobs

                        return (
                            <div 
                                key={u.id}
                                className={`w-full group relative border-b transition-all ${isActive ? 'bg-indigo-900/20 border-indigo-500/30 ring-2 ring-indigo-500 z-10' : 'bg-[#181825] border-white/5'}`}
                            >
                                <div className="relative aspect-video w-full bg-black/40 overflow-hidden">
                                    <img src={u.thumbnailUrl} className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isScanning ? 'opacity-50 blur-sm' : 'opacity-80 group-hover:opacity-40'}`} />
                                    
                                    {/* Scanning Overlay */}
                                    {(isScanning || isAnalysingName) && (
                                        <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center z-10 pointer-events-none">
                                            <div className="w-full h-0.5 bg-indigo-400 absolute animate-scan shadow-[0_0_10px_#818cf8]"></div>
                                            <span className="text-[10px] font-mono text-indigo-300 bg-black/80 px-2 py-1 rounded backdrop-blur border border-indigo-500/30">
                                                {isScanning ? 'SCANNING' : 'ANALYZING'}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* People Count at Bottom */}
                                    {!isScanning && (
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 z-10 flex justify-center pointer-events-none">
                                            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-white/90">
                                                <Users size={10} className="opacity-70"/>
                                                {u.peopleCount !== undefined ? (u.peopleCount === 0 ? "No people" : `${u.peopleCount} People`) : "..."}
                                            </div>
                                        </div>
                                    )}

                                    {/* --- OVERLAY STATS (On Image) --- */}
                                    <div className="absolute top-2 left-2 flex flex-col gap-1 z-30 pointer-events-none">
                                        {alertLevel !== 'NONE' && (
                                            <div className="px-1.5 py-0.5 bg-red-600/90 text-white rounded font-bold text-[10px] animate-pulse border border-white/20">
                                                {alertLevel === 'CRITICAL_FAILURE' ? '!!!!!' : '!!'}
                                            </div>
                                        )}
                                        {activeCount > 0 && (
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-black/70 backdrop-blur rounded border border-blue-500/30 text-blue-400">
                                                <Activity size={10} className="animate-pulse" />
                                                <span className="text-[9px] font-bold">{activeCount}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* --- LARGE CENTER SELECT BUTTON --- */}
                                    {!isActive && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                            <button 
                                                onClick={() => setSelectedSourceId(u.id)} 
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-bold shadow-2xl shadow-black transform transition-transform hover:scale-105 flex items-center gap-2 border border-white/10"
                                            >
                                                <MousePointer2 size={16} /> SELECT
                                            </button>
                                        </div>
                                    )}

                                    {/* --- OVERLAY ACTIONS (On Image Bottom Right) --- */}
                                    <div className="absolute bottom-2 right-2 flex items-center gap-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isActive && (
                                            <div className="px-2 py-1 bg-indigo-600 rounded text-[10px] font-bold text-white shadow shadow-black">SELECTED</div>
                                        )}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); boostSource(u.id); }}
                                            className="p-2 bg-black/60 hover:bg-indigo-500 text-white rounded-lg transition-colors border border-white/10 backdrop-blur"
                                            title="Boost Priority (+10)"
                                        >
                                            <ArrowUp size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); retrySource(u.id); }}
                                            className={`p-2 bg-black/60 rounded-lg transition-colors border border-white/10 backdrop-blur ${displayFailedCount > 0 ? 'text-amber-500 hover:bg-emerald-500 hover:text-white animate-pulse' : 'text-slate-300 hover:bg-emerald-500 hover:text-white'}`}
                                            title="Retry Failed Jobs"
                                        >
                                            <RefreshCw size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteSource(u.id); }}
                                            className="p-2 bg-black/60 hover:bg-red-500 text-slate-300 hover:text-white rounded-lg transition-colors border border-white/10 backdrop-blur"
                                            title="Delete Source & Jobs"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                
                                {totalCount > 0 && (
                                    <div className="flex w-full h-1 bg-blue-900/20">
                                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(finishedCount / totalCount) * 100}%` }} title={`Generated: ${finishedCount}`}></div>
                                        <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${(failedCount / totalCount) * 100}%` }} title={`Failed: ${failedCount}`}></div>
                                        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${(prohibitedCount / totalCount) * 100}%` }} title={`Prohibited: ${prohibitedCount}`}></div>
                                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(activeCount / totalCount) * 100}%` }} title={`Waiting: ${activeCount}`}></div>
                                    </div>
                                )}

                                <div className="px-3 py-2 bg-[#13111c]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center min-w-0">
                                            {/* Failure Count BEFORE Name */}
                                            {displayFailedCount > 0 && <span className="text-red-400 font-mono text-[10px] font-bold mr-1">[{displayFailedCount}]</span>}
                                            <span className={`text-xs font-bold truncate pr-2 ${isActive ? 'text-indigo-300' : 'text-slate-300'}`} title={u.displayName || "Processing..."}>{u.displayName || "Processing..."}</span>
                                            {/* Success Count AFTER Name */}
                                            {finishedCount > 0 && <span className="text-emerald-400 font-mono text-[10px] font-bold">[{finishedCount}]</span>}
                                        </div>
                                        {u.options.gender !== 'As-is' && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 rounded uppercase font-bold shrink-0">{u.options.gender.substring(0,1)}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {displayedUploads.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-600 border-2 border-dashed border-white/5 rounded-lg m-4">
                            <Upload size={24} className="mb-2 opacity-50" />
                            <span className="text-xs font-bold">No Sources</span>
                            {filterNoPeople && <span className="text-[10px] text-slate-500 mt-1">(Filter Active)</span>}
                        </div>
                    )}
                </>
            ) : (
                // --- QUEUES VIEW ---
                <div className="p-3 space-y-2">
                    <div className="px-1 pb-2 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Queues</span>
                    </div>

                    {allQueues.map(q => {
                         const isSelected = activeQueueTab === q.id;
                         // Calculate failure stats for this group
                         const groupJobs = queue.filter(j => 
                             !ANALYZING_TYPES.includes(j.taskType) && 
                             (TASK_DEFINITIONS[j.taskType]?.label === q.id || j.taskType === q.id || (q.id === 'Failed' && j.status === ProcessingStatus.ERROR) || (q.id === 'Dead' && j.status === ProcessingStatus.ENDED) || (q.id === 'Pending' && j.status === ProcessingStatus.PENDING))
                         );
                         const failedCount = groupJobs.filter(j => j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED).length;
                         const successCount = groupJobs.filter(j => j.status === ProcessingStatus.SUCCESS).length;
                         
                         const alertLevel = getAlertLevel(groupJobs);

                         return (
                             <div 
                                key={q.id} 
                                onClick={() => setActiveQueueTab(q.id)}
                                className={`group flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${isSelected ? `bg-slate-800 ${q.border}` : 'bg-slate-800/30 border-white/5 hover:bg-slate-800'}`}
                             >
                                 <div className="flex items-center gap-2 overflow-hidden flex-1">
                                     <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${q.count > 0 ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`}></div>
                                     <div className="flex items-center min-w-0 flex-1">
                                        {/* Failure Alerts */}
                                        {alertLevel !== 'NONE' && (
                                            <span className="mr-1 text-[10px] font-black text-red-500 animate-pulse">
                                                {alertLevel === 'CRITICAL_FAILURE' ? '!!!!!' : '!!'}
                                            </span>
                                        )}
                                        
                                        {/* Failure Count (Before Name) */}
                                        {failedCount > 0 && (
                                            <span className="mr-1 text-red-400 font-mono text-[10px] font-bold shrink-0">
                                                [{failedCount}]
                                            </span>
                                        )}

                                        <span className={`text-xs font-bold truncate ${isSelected ? q.color : 'text-slate-300 group-hover:text-white'}`}>{q.label}</span>

                                        {/* Success Count (After Name) */}
                                        {successCount > 0 && (
                                            <span className="ml-1 text-emerald-400 font-mono text-[10px] font-bold shrink-0">
                                                [{successCount}]
                                            </span>
                                        )}
                                     </div>
                                 </div>
                                 
                                 <div className="flex items-center gap-2 shrink-0">
                                     <span className="text-[10px] font-mono text-slate-500 bg-black/30 px-1.5 rounded">{q.count}</span>
                                     <button 
                                        onClick={(e) => { e.stopPropagation(); boostQueue(q.id); }}
                                        className="p-1.5 bg-black/20 hover:bg-indigo-500 text-slate-500 hover:text-white rounded transition-colors"
                                        title="Boost Queue +5"
                                     >
                                         <ChevronsUp size={12} />
                                     </button>
                                 </div>
                             </div>
                         );
                    })}
                    
                    {allQueues.length === 0 && (
                        <div className="text-center text-[10px] text-slate-600 py-4 italic">No active queues</div>
                    )}

                </div>
            )}
        </div>

        {/* Resizer Handle */}
        <div 
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-purple-500 transition-colors z-50"
            onMouseDown={startResizing}
        ></div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0f0f16] relative">
          
          {/* Header Bar */}
          <header className="h-16 border-b border-white/5 bg-[#13111c] flex items-center justify-between px-6 shrink-0 z-30">
               
               {/* Left: Queue Stats */}
               <div className="flex items-center space-x-6">
                   <div className="flex items-center space-x-3">
                       <button onClick={() => setQueueActive(!queueActive)} className={`p-2.5 rounded-full transition-all shadow-lg ${queueActive ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                           {queueActive ? <Pause fill="currentColor" size={18} /> : <Play fill="currentColor" size={18} />}
                       </button>
                       <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Queue Status</span>
                            <span className={`text-sm font-bold ${queueActive ? 'text-emerald-400' : 'text-slate-500'}`}>{queueActive ? 'Running' : 'Paused'}</span>
                       </div>
                   </div>

                   <div className="h-8 w-px bg-white/10"></div>

                   <div className="flex flex-col w-48">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1 uppercase">
                            <span>Progress</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                   </div>
               </div>

               {/* Right: Global Actions */}
               <div className="flex items-center space-x-3">
                   <button onClick={() => setIsOptionsOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-white/5 transition-colors"><Settings size={16} /> <span>Options</span></button>
                   <button onClick={selectKey} className={`p-2 rounded-lg border border-white/5 transition-colors ${isKeyLoading ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`} title="API Key"><Key size={18} /></button>
                   <button onClick={() => setIsManualOpen(true)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-white/5 transition-colors" title="Manual"><Book size={18} /></button>
                   <button onClick={() => setIsConsoleOpen(true)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-white/5 transition-colors" title="Console"><Info size={18} /></button>
               </div>
          </header>

          {/* Icon Bar (View Navigation) */}
          <div className="h-14 border-b border-white/5 bg-[#0f0f16] flex items-center px-4 shrink-0 overflow-x-auto scrollbar-hide space-x-2">
               <button onClick={() => setActiveQueueTab('UPLOADS')} className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${activeQueueTab === 'UPLOADS' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                   <Layers size={18} /> <span className="text-xs font-bold">All Results</span>
               </button>
               <div className="w-px h-6 bg-white/10 mx-2"></div>
               
               {/* Categories (Legacy view bar - kept for quick access, but main navigation now in sidebar too) */}
               {categories.map(cat => (
                   <button 
                        key={cat} 
                        onClick={() => setActiveQueueTab(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${activeQueueTab === cat ? 'bg-slate-800 text-white border-purple-500/50' : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/5'}`}
                   >
                       {cat}
                   </button>
               ))}
               
               <div className="flex-1"></div>
               
               {/* Status Filters */}
               <button onClick={() => setActiveQueueTab('Failed')} className={`p-2 rounded-lg transition-colors ${activeQueueTab === 'Failed' ? 'bg-red-500/20 text-red-400' : 'text-slate-600 hover:text-red-500'}`} title="Failed"><XCircle size={16} /></button>
          </div>

          {/* Gallery Area */}
          <div 
            className="flex-1 overflow-y-auto p-6 relative custom-scrollbar bg-slate-900/50 space-y-8" 
            ref={galleryRef}
          >
               {/* Background for empty state */}
               {queue.length === 0 && (
                   <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none" style={{ backgroundImage: `url("${EMPTY_GALLERY_BACKGROUND}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                       <div className="text-center p-8 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 max-w-md">
                           <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                               <ImageIcon className="text-white w-8 h-8" />
                           </div>
                           <h3 className="text-xl font-bold text-white mb-2">Workspace Ready</h3>
                           <p className="text-slate-400 text-sm">Drag and drop images to begin processing. Configure tasks in Options.</p>
                       </div>
                   </div>
               )}

               {/* SECTION 1: SELECTED SOURCE RESULTS - SHOW ALL JOBS FOR THIS SOURCE (EXCEPT ANALYZING) */}
               {selectedSourceId && selectedSourceJobs.length > 0 && (
                   <div>
                       <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5 sticky top-0 bg-slate-900/90 backdrop-blur z-10 py-2">
                            <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                                {/* Failure count before name */}
                                {selectedSourceJobs.filter(j => j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED).length > 0 && (
                                    <span className="text-red-500 font-mono">[{selectedSourceJobs.filter(j => j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED).length}]</span>
                                )}
                                <span>Selection: {uploads.find(u => u.id === selectedSourceId)?.displayName || "Image"}</span>
                                {/* Generated (Success) count after name */}
                                {selectedSourceJobs.filter(j => j.status === ProcessingStatus.SUCCESS).length > 0 && (
                                    <span className="text-emerald-500 font-mono">[{selectedSourceJobs.filter(j => j.status === ProcessingStatus.SUCCESS).length}]</span>
                                )}
                            </h3>
                            <span className="text-xs text-slate-500 font-mono bg-black/30 px-2 py-0.5 rounded-full">{selectedSourceJobs.length}</span>
                            
                            {/* Contextual Action Buttons for Source */}
                            <div className="flex items-center gap-2 ml-4">
                                <button onClick={() => retrySelection(selectedSourceJobs)} className="text-[10px] uppercase font-bold text-slate-300 hover:text-emerald-400 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-white/5 flex items-center gap-1 transition-colors">
                                    <RefreshCw size={10} /> Retry Failed
                                </button>
                                <button onClick={() => deleteFailedInSelection(selectedSourceJobs)} className="text-[10px] uppercase font-bold text-slate-300 hover:text-amber-400 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-white/5 flex items-center gap-1 transition-colors">
                                    <AlertTriangle size={10} /> Del Failed
                                </button>
                                <button onClick={() => deleteAllInSelection(selectedSourceJobs)} className="text-[10px] uppercase font-bold text-slate-300 hover:text-red-400 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-white/5 flex items-center gap-1 transition-colors">
                                    <Trash2 size={10} /> Del All
                                </button>
                            </div>

                            <div className="ml-auto">
                                <button onClick={() => setSelectedSourceId(null)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"><XCircle size={12}/> Clear Selection</button>
                            </div>
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 animate-in fade-in slide-in-from-top-4">
                           {selectedSourceJobs.map(item => (
                               <GalleryItemCard 
                                    key={item.id} 
                                    item={item} 
                                    onSetViewerItemId={setViewerItemId}
                                    onRepeat={(i) => setQueue(prev => [...prev, { ...i, id: crypto.randomUUID(), status: ProcessingStatus.PENDING, result: undefined, retryCount: 0, priority: 50, errorHistory: [] }])}
                                    onDelete={(id) => setQueue(prev => prev.filter(p => p.id !== id))}
                                    onDeleteSource={deleteSource}
                                    onDetails={setDetailsJobId}
                                    onFilterSource={setSelectedSourceId}
                                    showPriority
                               />
                           ))}
                       </div>
                   </div>
               )}

               {/* SECTION 2: RUNNING & PENDING (Wait, we filtered pending unless explicit) -> RUNNING */}
               {runningJobs.length > 0 && (
                   <div>
                       <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5 sticky top-0 bg-slate-900/90 backdrop-blur z-10 py-2">
                            <Activity className="text-blue-400" size={18} />
                            <h3 className="text-lg font-bold text-blue-400 uppercase tracking-wider">Active Tasks</h3>
                            <span className="text-xs text-slate-500 font-mono bg-black/30 px-2 py-0.5 rounded-full">{runningJobs.length}</span>
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                           {runningJobs.map(item => (
                               <GalleryItemCard 
                                    key={item.id} 
                                    item={item} 
                                    onSetViewerItemId={setViewerItemId}
                                    onRepeat={(i) => setQueue(prev => [...prev, { ...i, id: crypto.randomUUID(), status: ProcessingStatus.PENDING, result: undefined, retryCount: 0, priority: 50, errorHistory: [] }])}
                                    onDelete={(id) => setQueue(prev => prev.filter(p => p.id !== id))}
                                    onDeleteSource={deleteSource}
                                    onDetails={setDetailsJobId}
                                    onFilterSource={setSelectedSourceId}
                                    showPriority
                               />
                           ))}
                       </div>
                   </div>
               )}

                {/* SECTION 2.5: EXPLICIT OTHER JOBS (Pending/Failed/Dead if selected) */}
                {explicitOtherJobs.length > 0 && (
                   <div>
                       <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5 sticky top-0 bg-slate-900/90 backdrop-blur z-10 py-2">
                            <List className="text-slate-400" size={18} />
                            <h3 className="text-lg font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                {/* Failure count before name */}
                                {explicitOtherJobs.filter(j => j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED).length > 0 && (
                                    <span className="text-red-500 font-mono">[{explicitOtherJobs.filter(j => j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED).length}]</span>
                                )}
                                <span>{activeQueueTab} Items</span>
                                {/* Generated (Success) count after name */}
                                {explicitOtherJobs.filter(j => j.status === ProcessingStatus.SUCCESS).length > 0 && (
                                    <span className="text-emerald-500 font-mono">[{explicitOtherJobs.filter(j => j.status === ProcessingStatus.SUCCESS).length}]</span>
                                )}
                            </h3>
                            <span className="text-xs text-slate-500 font-mono bg-black/30 px-2 py-0.5 rounded-full">{explicitOtherJobs.length}</span>

                             {/* Contextual Action Buttons for Queue */}
                             <div className="flex items-center gap-2 ml-4">
                                <button onClick={() => retrySelection(explicitOtherJobs)} className="text-[10px] uppercase font-bold text-slate-300 hover:text-emerald-400 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-white/5 flex items-center gap-1 transition-colors">
                                    <RefreshCw size={10} /> Retry Failed
                                </button>
                                <button onClick={() => deleteFailedInSelection(explicitOtherJobs)} className="text-[10px] uppercase font-bold text-slate-300 hover:text-amber-400 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-white/5 flex items-center gap-1 transition-colors">
                                    <AlertTriangle size={10} /> Del Failed
                                </button>
                                <button onClick={() => deleteAllInSelection(explicitOtherJobs)} className="text-[10px] uppercase font-bold text-slate-300 hover:text-red-400 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-white/5 flex items-center gap-1 transition-colors">
                                    <Trash2 size={10} /> Del All
                                </button>
                            </div>
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                           {explicitOtherJobs.map(item => (
                               <GalleryItemCard 
                                    key={item.id} 
                                    item={item} 
                                    onSetViewerItemId={setViewerItemId}
                                    onRepeat={(i) => setQueue(prev => [...prev, { ...i, id: crypto.randomUUID(), status: ProcessingStatus.PENDING, result: undefined, retryCount: 0, priority: 50, errorHistory: [] }])}
                                    onDelete={(id) => setQueue(prev => prev.filter(p => p.id !== id))}
                                    onDeleteSource={deleteSource}
                                    onDetails={setDetailsJobId}
                                    onFilterSource={setSelectedSourceId}
                                    showPriority
                               />
                           ))}
                       </div>
                   </div>
               )}


               {/* SECTION 3: ALL FINISHED */}
               {finishedJobs.length > 0 && (
                   <div>
                       <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5 sticky top-0 bg-slate-900/90 backdrop-blur z-10 py-2">
                            <ImageIcon className="text-emerald-400" size={18} />
                            <h3 className="text-lg font-bold text-emerald-400 uppercase tracking-wider">Finished</h3>
                            <span className="text-xs text-slate-500 font-mono bg-black/30 px-2 py-0.5 rounded-full">{finishedJobs.length}</span>
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                           {finishedJobs.map(item => (
                               <GalleryItemCard 
                                    key={item.id} 
                                    item={item} 
                                    onSetViewerItemId={setViewerItemId}
                                    onRepeat={(i) => setQueue(prev => [...prev, { ...i, id: crypto.randomUUID(), status: ProcessingStatus.PENDING, result: undefined, retryCount: 0, priority: 50, errorHistory: [] }])}
                                    onDelete={(id) => setQueue(prev => prev.filter(p => p.id !== id))}
                                    onDeleteSource={deleteSource}
                                    onDetails={setDetailsJobId}
                                    onFilterSource={setSelectedSourceId}
                                    showPriority
                               />
                           ))}
                       </div>
                   </div>
               )}

          </div>
          
          {/* Footer Info */}
          <div className="h-8 bg-[#0f0f16] border-t border-white/5 flex items-center justify-between px-4 text-[10px] text-slate-500 font-mono shrink-0 z-30">
               <div>Active Threads: {activeJobs} / {maxConcurrent}</div>
               <div>Queue ID: {uploads.length > 0 ? uploads[0].id.substring(0,8) : 'N/A'}...</div>
          </div>

      </main>

      {/* Dialogs */}
      <Console isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} />
      <ManualDialog isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      <OptionsDialog isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} options={options} setOptions={setOptions} />
      
      {viewerItemId && (
          <ImageViewer 
             item={queue.find(i => i.id === viewerItemId)!} 
             onClose={() => setViewerItemId(null)}
             hasNext={hasNext}
             hasPrev={hasPrev}
             onNext={() => {
                 if (hasNext) setViewerItemId(displayedViewerList[currentIndex + 1].id);
             }}
             onPrev={() => {
                 if (hasPrev) setViewerItemId(displayedViewerList[currentIndex - 1].id);
             }}
             onFirst={() => setViewerItemId(displayedViewerList[0].id)}
             onLast={() => setViewerItemId(displayedViewerList[displayedViewerList.length - 1].id)}
             onDelete={() => {
                 const nextId = displayedViewerList[currentIndex + 1]?.id || displayedViewerList[currentIndex - 1]?.id;
                 setQueue(prev => prev.filter(p => p.id !== viewerItemId));
                 setViewerItemId(nextId || null);
             }}
             onRepeat={() => {
                 const item = queue.find(i => i.id === viewerItemId);
                 if (item) setQueue(prev => [...prev, { ...item, id: crypto.randomUUID(), status: ProcessingStatus.PENDING, result: undefined, retryCount: 0, priority: 50, errorHistory: [] }]);
             }}
             onDetails={() => {
                 setDetailsJobId(viewerItemId);
             }}
          />
      )}

      {detailsJobId && (
          <JobDetailsDialog 
            isOpen={!!detailsJobId}
            onClose={() => setDetailsJobId(null)}
            job={queue.find(j => j.id === detailsJobId)}
            source={uploads.find(u => u.id === queue.find(j => j.id === detailsJobId)?.sourceId)}
          />
      )}

    </div>
  );
}