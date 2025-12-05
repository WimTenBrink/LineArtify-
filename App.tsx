

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLogger } from './services/loggerService';
import { generateLineArtTask, detectPeople } from './services/geminiService';
import { saveWorkspace, loadWorkspace } from './services/dbService';
import Console from './components/Console';
import ImageViewer from './components/ImageViewer';
import ManualDialog from './components/ManualDialog';
import OptionsDialog from './components/OptionsDialog';
import { QueueItem, ProcessingStatus, LogLevel, AppOptions, SourceImage, TaskType, PriorityLevel } from './types';
import { 
    Upload, RefreshCw, Play, Pause, Trash2, Key, Save, FolderOpen, Terminal, Book, 
    Settings, Image as ImageIcon, Layers, User, AlertTriangle, CheckCircle2, 
    ScanFace, CheckSquare, XCircle, Info,
    ArrowUp, ArrowDown, ArrowUpCircle, ArrowDownCircle, Mountain, Users, UserCheck, 
    ArrowLeft, Smile, EyeOff, Accessibility, Loader2, Grip, Monitor, PieChart,
    Palette, PenTool, Ghost, Baby, Sticker, Sword, Sparkles, Square, Wand2, Repeat,
    Zap, Eye
} from 'lucide-react';
import { TASK_DEFINITIONS } from './services/taskDefinitions';

const MAX_CONCURRENT_REQUESTS = 5;

// Helper for converting Blob/File to Base64 (Data URL)
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Memory Cleanup Helper
const cleanupUrl = (url?: string) => {
    if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
};

// Groups for Queue Views
type QueueViewGroup = 
    'UPLOADS' | 'JOBS' | 'SCENES' | 'GROUPS' | 'CHARACTERS' | 'PORTRAITS' | 
    'STYLES_CHIBI' | 'STYLES_ANIME' | 'STYLES_SKETCH' | 'STYLES_COLORING' | 
    'STYLES_CYBER' | 'STYLES_NOIR' | 'STYLES_IMPRESS' | 'STYLES_STICKER' | 'STYLES_FANTASY' |
    'UTILITY' | 'RETRY' | 'FAILED' | 'ENDED';

// Mapping Groups to Task Types for Filtering
const GROUP_MAPPING: Record<string, TaskType[]> = {
    'SCENES': ['full', 'full-nude', 'background'],
    'GROUPS': ['all-people', 'all-people-nude'],
    'CHARACTERS': ['model', 'nude', 'model-full', 'model-full-nude', 'neutral', 'neutral-nude', 'backside', 'nude-opposite'],
    'PORTRAITS': ['face', 'face-left', 'face-right'],
    
    // Detailed Style Queues
    'STYLES_CHIBI': ['chibi', 'chibi-nude'],
    'STYLES_ANIME': ['anime', 'anime-nude'],
    'STYLES_SKETCH': ['sketch', 'sketch-nude'],
    'STYLES_COLORING': ['coloring-book', 'coloring-book-nude'],
    'STYLES_CYBER': ['cyberpunk', 'cyberpunk-nude'],
    'STYLES_NOIR': ['noir', 'noir-nude'],
    'STYLES_IMPRESS': ['impressionist', 'impressionist-nude'],
    'STYLES_STICKER': ['sticker', 'sticker-nude'],
    'STYLES_FANTASY': ['fantasy', 'fantasy-nude'],

    'UTILITY': ['scan-people', 'upscale']
};

const PRIORITY_VALUES: Record<PriorityLevel, number> = {
    'Very Low': 1,
    'Low': 2,
    'Normal': 3,
    'High': 4,
    'Very High': 5
};

interface GalleryItemCardProps {
    item: QueueItem;
    isHighlighted: boolean;
    onSetViewerItemId: (id: string) => void;
    onUpscale: (item: QueueItem) => void;
    isUpscaling: boolean;
    onRepeat: (item: QueueItem) => void;
    onDelete: (id: string) => void;
}

const GalleryItemCard: React.FC<GalleryItemCardProps> = ({ 
    item, isHighlighted, onSetViewerItemId, onUpscale, isUpscaling, onRepeat, onDelete 
}) => {
     const [showOriginal, setShowOriginal] = useState(false);
     const displayUrl = showOriginal ? item.thumbnailUrl : (item.result?.url || item.thumbnailUrl);

     return (
         <div className="flex flex-col group animate-fade-in">
             <div className={`relative bg-[#1e1e1e] rounded-t-xl overflow-hidden cursor-zoom-in border border-b-0 transition-all duration-300 ${isHighlighted ? 'border-emerald-500 ring-4 ring-emerald-500/30' : 'border-white/5'}`} onClick={() => onSetViewerItemId(item.id)} style={{ height: '400px', borderWidth: isHighlighted ? '0px' : '1px' }}>
                 <div className="absolute inset-0 flex items-center justify-center bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
                 <img src={displayUrl} className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105" />
                 <div className="absolute top-3 left-3 flex flex-col items-start gap-1 z-20"><span className={`px-2 py-1 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded tracking-wider ${isHighlighted ? 'bg-emerald-600' : 'bg-black/60'}`}>{item.taskType}</span>{item.personDescription && <span className="px-2 py-1 bg-indigo-600/80 backdrop-blur-md text-white text-[10px] rounded max-w-[150px] truncate">{item.personDescription}</span>}</div>
                 
                 {/* Quick Toggle Original */}
                 <button 
                    onClick={(e) => { e.stopPropagation(); setShowOriginal(!showOriginal); }}
                    className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-white/20 backdrop-blur text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    title="Toggle Original"
                 >
                    {showOriginal ? <EyeOff size={16} /> : <Eye size={16} />}
                 </button>

                 <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-3 py-2 text-center border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-[10px] font-mono text-slate-300 truncate block">{item.file.name}</span></div>
             </div>
             <div className={`h-12 bg-slate-800 rounded-b-xl flex divide-x divide-white/10 ${isHighlighted ? 'border-x-[8px] border-b-[8px] border-emerald-500' : 'border border-white/5'}`}>
                 <button onClick={() => onUpscale(item)} disabled={isUpscaling} className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50">{isUpscaling ? <Loader2 size={14} className="animate-spin text-purple-400" /> : <Wand2 size={14} className="text-purple-400" />} <span>Upscale</span></button>
                 <button onClick={() => onRepeat(item)} className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"><Repeat size={14} /> <span>Repeat</span></button>
                 <button onClick={() => onDelete(item.id)} className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"><Trash2 size={14} /> <span>Delete</span></button>
             </div>
         </div>
     );
};

export default function App() {
  // Data State
  const [uploads, setUploads] = useState<SourceImage[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]); 
  
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
    gender: 'As-is',
    detailLevel: 'Medium',
    modelPreference: 'flash',
    creativity: 0.4,
    customStyle: ''
  });

  // UI State
  const [activeQueueView, setActiveQueueView] = useState<QueueViewGroup>('UPLOADS');
  const [viewerItemId, setViewerItemId] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [thumbnailSize, setThumbnailSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showFinishedUploads, setShowFinishedUploads] = useState(false);

  const [hoveredButton, setHoveredButton] = useState<{id: string, rect: DOMRect} | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isKeyLoading, setIsKeyLoading] = useState(false);
  const [upscalingIds, setUpscalingIds] = useState<Set<string>>(new Set());

  const [gallerySortBy, setGallerySortBy] = useState<'queue' | 'filename' | 'timestamp'>('queue');
  const [gallerySortOrder, setGallerySortOrder] = useState<'asc' | 'desc'>('asc');
  const galleryRef = useRef<HTMLDivElement>(null);

  const saveTimeoutRef = useRef<any>(null);

  // Queue Control State (Enable/Disable Queues)
  // Initially enable all groups
  const [queueControls, setQueueControls] = useState<Record<string, boolean>>({
      'GLOBAL': false,
      'SCENES': true,
      'GROUPS': true,
      'CHARACTERS': true,
      'PORTRAITS': true,
      'STYLES_CHIBI': true,
      'STYLES_ANIME': true,
      'STYLES_SKETCH': true,
      'STYLES_COLORING': true,
      'STYLES_CYBER': true,
      'STYLES_NOIR': true,
      'STYLES_IMPRESS': true,
      'STYLES_STICKER': true,
      'STYLES_FANTASY': true,
      'UTILITY': true
  });

  const { addLog } = useLogger();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
        const state = await loadWorkspace();
        if (state) {
            setUploads(state.uploads);
            setQueue(state.queue);
            // Merge options
            setOptions(prev => ({
                ...prev,
                ...state.options,
                taskPriorities: { ...prev.taskPriorities, ...(state.options.taskPriorities || {}) },
                taskTypes: { ...prev.taskTypes, ...(state.options.taskTypes || {}) }
            }));
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

  const processingJobs = queue.filter(i => i.status === ProcessingStatus.PROCESSING);
  
  const getQueueItems = (view: QueueViewGroup): QueueItem[] => {
      switch (view) {
          case 'JOBS': return processingJobs;
          case 'RETRY': return queue.filter(i => i.status === ProcessingStatus.ERROR && !i.isBlocked && i.retryCount < 3);
          case 'FAILED': return queue.filter(i => i.status === ProcessingStatus.ERROR && (i.isBlocked || (i.retryCount >= 3 && i.isLastChance)));
          case 'ENDED': return queue.filter(i => i.status === ProcessingStatus.ENDED);
          case 'UPLOADS': return []; // Handled separately
          default:
              const types = GROUP_MAPPING[view];
              if (!types) return [];
              return queue.filter(i => types.includes(i.taskType) && i.status === ProcessingStatus.PENDING);
      }
  };

  const getQueueStats = (view: QueueViewGroup): string | number => {
    if (view === 'UPLOADS') return uploads.length;
    if (view === 'JOBS') return processingJobs.length;
    if (view === 'RETRY' || view === 'FAILED' || view === 'ENDED') return getQueueItems(view).length;

    const types = GROUP_MAPPING[view];
    if (types) {
        const allItems = queue.filter(j => types.includes(j.taskType));
        const total = allItems.length;
        const unfinished = allItems.filter(j => 
            j.status === ProcessingStatus.PENDING || 
            j.status === ProcessingStatus.PROCESSING || 
            (j.status === ProcessingStatus.ERROR && !j.isBlocked && j.retryCount < 3)
        ).length;
        return `${unfinished}/${total}`;
    }
    return 0;
  };

  const allSuccessItems = queue.filter(i => i.status === ProcessingStatus.SUCCESS && i.taskType !== 'scan-people');
  
  // Gallery Logic: Filter based on view, fallback to all if empty
  // IMPROVED: Automatically filter based on selected Queue View if it's a specific type
  let galleryItems = allSuccessItems;
  
  // Logic: 
  // 1. If viewing specific style/category queue, filter gallery to that.
  // 2. If viewing utility/jobs/failed/uploads, show ALL (or filtered by selected source).
  const currentViewTypes = GROUP_MAPPING[activeQueueView];
  
  if (currentViewTypes && activeQueueView !== 'UTILITY') {
      // If we are in a specific category, show ONLY that category in gallery
      // Unless no items exist, then maybe show all? User said "If there are no images for that style, show all images."
      const filtered = allSuccessItems.filter(i => currentViewTypes.includes(i.taskType));
      if (filtered.length > 0) {
          galleryItems = filtered;
      }
  }

  if (selectedSourceIds.size > 0) {
      galleryItems = galleryItems.filter(i => selectedSourceIds.has(i.sourceId));
  }

  galleryItems.sort((a, b) => {
      let comparison = 0;
      switch (gallerySortBy) {
          case 'queue': comparison = a.taskType.localeCompare(b.taskType); break;
          case 'filename': 
              comparison = a.file.name.localeCompare(b.file.name);
              if (comparison === 0) comparison = a.taskType.localeCompare(b.taskType);
              break;
          case 'timestamp': comparison = a.timestamp - b.timestamp; break;
      }
      return gallerySortOrder === 'asc' ? comparison : -comparison;
  });

  const getViewerNav = () => {
    if (!viewerItemId) return { hasPrev: false, hasNext: false, onPrev: undefined, onNext: undefined };
    const idx = galleryItems.findIndex(i => i.id === viewerItemId);
    if (idx === -1) return { hasPrev: false, hasNext: false, onPrev: undefined, onNext: undefined };
    return {
        hasPrev: idx > 0,
        hasNext: idx < galleryItems.length - 1,
        onPrev: idx > 0 ? () => setViewerItemId(galleryItems[idx - 1].id) : undefined,
        onNext: idx < galleryItems.length - 1 ? () => setViewerItemId(galleryItems[idx + 1].id) : undefined
    };
  };
  const viewerNav = getViewerNav();
  const totalJobs = queue.length;
  const completedJobs = queue.filter(i => i.status === ProcessingStatus.SUCCESS || i.status === ProcessingStatus.ENDED || (i.status === ProcessingStatus.ERROR && (i.isBlocked || i.retryCount >= 3))).length;
  const progressPercent = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  const handleUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    const newUploads: SourceImage[] = [];
    const currentOptionsSnapshot = JSON.parse(JSON.stringify(options));
    Array.from(files).filter(f => f.type.startsWith('image/')).forEach(file => {
       if (uploads.some(u => u.file.name === file.name)) return;
       const id = crypto.randomUUID();
       newUploads.push({ id, file, thumbnailUrl: URL.createObjectURL(file), timestamp: Date.now(), options: currentOptionsSnapshot });
    });
    if (newUploads.length > 0) {
      setUploads(prev => [...prev, ...newUploads]);
      addLog(LogLevel.INFO, `Uploaded ${newUploads.length} images.`);
      populateQueues(newUploads);
    }
  }, [options, addLog, uploads]);

  const populateQueues = (sources: SourceImage[]) => {
    const newJobs: QueueItem[] = [];
    sources.forEach(source => {
      const srcOpts = source.options;
      if (srcOpts.taskTypes.full) newJobs.push(createJob(source, 'full'));
      if (srcOpts.taskTypes['full-nude']) newJobs.push(createJob(source, 'full-nude'));
      if (srcOpts.taskTypes.background) newJobs.push(createJob(source, 'background'));
      newJobs.push(createJob(source, 'scan-people')); 
    });
    setQueue(prev => [...prev, ...newJobs]);
  };

  const createJob = (source: SourceImage, taskType: TaskType, personDescription?: string, detectBox?: number[]): QueueItem => ({
        id: crypto.randomUUID(),
        sourceId: source.id,
        file: source.file,
        taskType: taskType,
        personDescription,
        detectBox,
        thumbnailUrl: source.thumbnailUrl,
        status: ProcessingStatus.PENDING,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        errorHistory: []
  });

  const deleteUpload = (id: string) => {
    const upload = uploads.find(u => u.id === id);
    if (upload) cleanupUrl(upload.thumbnailUrl);
    setUploads(prev => prev.filter(u => u.id !== id));
    setQueue(prev => prev.filter(j => j.sourceId !== id));
  };

  const deleteJob = (id: string) => {
    const job = queue.find(j => j.id === id);
    if (job) cleanupUrl(job.result?.url);
    setQueue(prev => prev.filter(j => j.id !== id));
  };

  const handleDeleteAllInQueue = (view: QueueViewGroup) => {
     if (view === 'UPLOADS') {
         if (window.confirm("Delete all uploads? This will also remove all associated jobs.")) {
             uploads.forEach(u => deleteUpload(u.id));
         }
         return;
     }

     const itemsToDelete = getQueueItems(view);
     if (itemsToDelete.length === 0) return;
     
     if (window.confirm(`Delete ${itemsToDelete.length} items from ${view}?`)) {
        itemsToDelete.forEach(job => cleanupUrl(job.result?.url));
        const idsToDelete = new Set(itemsToDelete.map(j => j.id));
        setQueue(prev => prev.filter(j => !idsToDelete.has(j.id)));
        addLog(LogLevel.INFO, `Bulk deleted items from ${view}`);
     }
  };

  const retryJob = (item: QueueItem) => {
      setQueue(prev => prev.map(i => i.id === item.id ? { 
          ...i, 
          status: ProcessingStatus.PENDING, 
          retryCount: 0, 
          isBlocked: false,
          isLastChance: false,
          errorMessage: undefined 
      } : i));
  };

  const handleRetryAllInQueue = (view: QueueViewGroup) => {
      const itemsToRetry = getQueueItems(view);
      if (itemsToRetry.length === 0) return;

      if (window.confirm(`Retry ${itemsToRetry.length} items in ${view}?`)) {
          const idsToRetry = new Set(itemsToRetry.map(i => i.id));
          setQueue(prev => prev.map(i => idsToRetry.has(i.id) ? {
              ...i,
              status: ProcessingStatus.PENDING,
              retryCount: 0,
              isBlocked: false,
              isLastChance: false,
              errorMessage: undefined
          } : i));
          addLog(LogLevel.INFO, `Bulk retrying ${itemsToRetry.length} items from ${view}`);
      }
  };

  const repeatJob = (item: QueueItem) => {
    setQueue(prev => [...prev, { ...item, id: crypto.randomUUID(), status: ProcessingStatus.PENDING, result: undefined, retryCount: 0, errorHistory: [], timestamp: Date.now(), isLastChance: false }]);
  };

  const handleUpscale = async (item: QueueItem) => {
      if (!item.result?.url) return;
      setUpscalingIds(prev => { const next = new Set(prev); next.add(item.id); return next; });
      try {
          const res = await fetch(item.result.url);
          const blob = await res.blob();
          const file = new File([blob], `source-for-upscale.png`, { type: 'image/png' });
          setQueue(prev => [...prev, { id: crypto.randomUUID(), sourceId: item.sourceId, file: file, taskType: 'upscale', thumbnailUrl: item.result!.url, status: ProcessingStatus.PENDING, timestamp: Date.now(), retryCount: 0, maxRetries: 3, errorHistory: [], personDescription: item.personDescription }]);
      } catch (e) { addLog(LogLevel.ERROR, "Upscale failed", e); } 
      finally { setUpscalingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; }); }
  };

  const downloadImage = (url: string, filename: string) => {
      const link = document.createElement('a'); link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- Processing Loop ---
  useEffect(() => {
    if (!queueControls.GLOBAL) return;
    const runProcessor = async () => {
        if (processingJobs.length >= MAX_CONCURRENT_REQUESTS) return;
        const activeTaskTypes = new Set(processingJobs.map(j => j.taskType));
        
        // Find next job based on Priority
        // Flatten all available tasks
        let candidates: { item: QueueItem, priority: number }[] = [];
        
        // Helper to check if a specific task type is allowed
        const isTypeAllowed = (type: TaskType) => {
            // Find which group this type belongs to
            const groupEntry = Object.entries(GROUP_MAPPING).find(([g, types]) => types.includes(type));
            if (!groupEntry) return true; // Default allowed if not mapped (unlikely)
            return queueControls[groupEntry[0]];
        };

        // Scan is priority
        const scan = queue.find(i => i.taskType === 'scan-people' && i.status === ProcessingStatus.PENDING);
        if (scan && !activeTaskTypes.has('scan-people') && queueControls.UTILITY) {
             candidates.push({ item: scan, priority: 100 });
        } else {
             queue.forEach(item => {
                 if (item.status === ProcessingStatus.PENDING && !activeTaskTypes.has(item.taskType)) {
                     if (isTypeAllowed(item.taskType)) {
                         const prioStr = options.taskPriorities[item.taskType] || 'Normal';
                         candidates.push({ item, priority: PRIORITY_VALUES[prioStr] });
                     }
                 }
             });
        }
        
        if (candidates.length === 0) return;
        candidates.sort((a, b) => b.priority - a.priority);
        const job = candidates[0].item;

        setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.PROCESSING } : i));
        const apiKey = process.env.API_KEY || '';
        if (!apiKey) { handleJobError(job, "Missing API Key", true); return; }

        try {
            const source = uploads.find(u => u.id === job.sourceId);
            const jobOptions = source?.options || options; 
            if (job.taskType === 'scan-people') await handleScanning(job, apiKey, jobOptions);
            else await handleGeneration(job, apiKey, jobOptions);
        } catch (error: any) {
             handleJobError(job, error.message || "Unknown error", error.message?.includes("Safety"));
        }
    };
    const interval = setInterval(runProcessor, 1000);
    return () => clearInterval(interval);
  }, [queue, queueControls, processingJobs.length, options, uploads]);

  const handleJobError = (job: QueueItem, message: string, isSafety: boolean) => {
      addLog(LogLevel.WARN, `Job Failed: ${message}`);
      setQueue(prev => prev.map(i => i.id === job.id ? { 
          ...i, 
          status: ProcessingStatus.ERROR, 
          errorMessage: message, 
          retryCount: i.retryCount + 1, 
          isBlocked: isSafety, 
          isLastChance: isSafety || (i.retryCount + 1 >= i.maxRetries) 
      } : i));
  };

  const handleScanning = async (job: QueueItem, apiKey: string, jobOptions: AppOptions) => {
      addLog(LogLevel.INFO, `Scanning ${job.file.name}...`);
      const people = await detectPeople(job.file, apiKey, addLog, jobOptions.gender);
      setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.SUCCESS } : i));

      const newJobs: QueueItem[] = [];
      const source = uploads.find(u => u.id === job.sourceId)!;
      const create = (type: TaskType, description?: string, box?: number[]) => createJob(source, type, description, box);

      // Groups
      if (people.length > 1) {
          if (jobOptions.taskTypes['all-people']) newJobs.push(create('all-people'));
          if (jobOptions.taskTypes['all-people-nude']) newJobs.push(create('all-people-nude'));
      }
      
      // Individuals
      people.forEach(p => {
          Object.keys(jobOptions.taskTypes).forEach(key => {
              // Iterate all configured types. If enabled, and it's a Person/Style/Portrait type, spawn it.
              // Scene types (full, background) are spawned on upload, not scan.
              const def = TASK_DEFINITIONS[key as TaskType];
              if (jobOptions.taskTypes[key] && def && (def.category === 'Person' || def.category === 'Style')) {
                  // Only spawn if valid key (sanity check)
                   newJobs.push(create(key as TaskType, p.description, p.box_2d));
              }
          });
      });

      if (newJobs.length > 0) {
          addLog(LogLevel.INFO, `Spawned ${newJobs.length} tasks from scan.`);
          setQueue(prev => [...prev, ...newJobs]);
      }
  };

  const handleGeneration = async (job: QueueItem, apiKey: string, jobOptions: AppOptions) => {
      const res = await generateLineArtTask(job.file, apiKey, job.taskType, jobOptions, addLog, undefined, job.personDescription);
      setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.SUCCESS, result: res, timestamp: Date.now() } : i));
      const originalName = job.file.name.replace(/\.[^/.]+$/, "");
      downloadImage(res.url, `${job.taskType}-${originalName}.png`);
  };

  const handleExport = async () => {
      setIsExporting(true);
      await new Promise(resolve => setTimeout(resolve, 0));
      try {
        const exportData = { uploads: await Promise.all(uploads.map(async u => ({...u, data: await blobToBase64(u.file)}))), options };
        const blob = new Blob([JSON.stringify(exportData)], {type: 'application/json'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lineartify_backup.json'; a.click();
      } catch(e) { addLog(LogLevel.ERROR, "Export failed", e); } 
      finally { setIsExporting(false); }
  };
  
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      setIsImporting(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const data = JSON.parse(ev.target?.result as string);
              if (data.options) setOptions(prev => ({...prev, ...data.options, taskPriorities: {...prev.taskPriorities, ...(data.options.taskPriorities||{})}, taskTypes: {...prev.taskTypes, ...(data.options.taskTypes||{})}}));
              if (data.uploads) {
                  const newUploads = await Promise.all(data.uploads.map(async (u: any) => {
                      const res = await fetch(u.data); const blob = await res.blob(); const file = new File([blob], u.file.name, { type: u.file.type });
                      return { ...u, file, thumbnailUrl: URL.createObjectURL(file), options: u.options || options };
                  }));
                  const unique = newUploads.filter(nu => !uploads.some(u => u.file.name === nu.file.name));
                  setUploads(prev => [...prev, ...unique]); populateQueues(unique);
              }
          } catch(err) { console.error(err); } finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
      };
      reader.readAsText(file);
  };
  
  const handleApiKeyChange = async () => { 
      setIsKeyLoading(true);
      try { if ((window as any).aistudio?.openSelectKey) await (window as any).aistudio.openSelectKey(); } finally { setIsKeyLoading(false); }
  };

  const getSourceStatus = (sourceId: string): 'done' | 'processing' | 'error' | 'empty' => {
      const jobs = queue.filter(j => j.sourceId === sourceId);
      if (jobs.length === 0) return 'empty';
      
      const hasError = jobs.some(j => j.status === ProcessingStatus.ERROR && (j.isBlocked || j.retryCount >= j.maxRetries));
      if (hasError) return 'error';

      const allDone = jobs.every(j => j.status === ProcessingStatus.SUCCESS || j.status === ProcessingStatus.ENDED);
      return allDone ? 'done' : 'processing';
  };
  const getProcessingJobsForSource = (sourceId: string) => queue.filter(j => j.sourceId === sourceId && j.status === ProcessingStatus.PROCESSING);

  // Define Views
  const queueViews: { id: QueueViewGroup, label: string, icon: any, description: string }[] = [
    { id: 'UPLOADS', label: 'Uploads', icon: Upload, description: "Manage source images" },
    { id: 'JOBS', label: 'Jobs', icon: RefreshCw, description: "Running tasks" },
    { id: 'SCENES', label: 'Scenes', icon: Mountain, description: "Full scenes and backgrounds" },
    { id: 'GROUPS', label: 'Groups', icon: Users, description: "Multi-person extraction" },
    { id: 'CHARACTERS', label: 'Characters', icon: User, description: "Individual character studies" },
    { id: 'PORTRAITS', label: 'Portraits', icon: Smile, description: "Face close-ups" },
    
    // New Individual Style Queues
    { id: 'STYLES_CHIBI', label: 'Chibi', icon: Baby, description: "Cute proportions" },
    { id: 'STYLES_ANIME', label: 'Anime', icon: Sparkles, description: "90s Anime Style" },
    { id: 'STYLES_SKETCH', label: 'Sketch', icon: PenTool, description: "Rough Sketch" },
    { id: 'STYLES_COLORING', label: 'Coloring', icon: Book, description: "Coloring Book Lines" },
    { id: 'STYLES_CYBER', label: 'Cyberpunk', icon: Zap, description: "High-tech low-life" },
    { id: 'STYLES_NOIR', label: 'Noir', icon: Ghost, description: "High contrast shadows" },
    { id: 'STYLES_IMPRESS', label: 'Impress.', icon: Palette, description: "Loose artistic strokes" },
    { id: 'STYLES_STICKER', label: 'Sticker', icon: Sticker, description: "Vector style sticker" },
    { id: 'STYLES_FANTASY', label: 'Fantasy', icon: Sword, description: "RPG Character style" },

    { id: 'UTILITY', label: 'Utility', icon: Layers, description: "Scanning and Upscaling" },
    { id: 'RETRY', label: 'Retry', icon: RefreshCw, description: "Transient errors" },
    { id: 'FAILED', label: 'Failed', icon: AlertTriangle, description: "Permanent errors" },
    { id: 'ENDED', label: 'Ended', icon: XCircle, description: "Stopped jobs" }
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0f0f16] text-slate-200 font-sans overflow-hidden relative" onDragOver={e => {e.preventDefault(); setIsDragging(true)}} onDragLeave={e => {e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)}} onDrop={e => {e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files)}}>
      {isDragging && <div className="absolute inset-0 z-[100] bg-indigo-500/20 backdrop-blur-sm border-4 border-indigo-500 border-dashed flex items-center justify-center pointer-events-none"><div className="text-4xl font-bold text-white drop-shadow-lg">Drop images to upload</div></div>}

      {/* Header */}
      <header className="flex-none h-14 bg-[#181825] border-b border-white/5 flex items-center justify-between px-4 z-50">
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2"><div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center"><ImageIcon className="text-white w-5 h-5" /></div><h1 className="font-bold text-lg tracking-tight">LineArtify</h1></div>
            {totalJobs > 0 && (<div className="flex items-center space-x-3 bg-slate-800/50 px-3 py-1.5 rounded-full border border-white/5"><div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }}></div></div><span className="text-xs font-mono text-slate-400">{completedJobs} / {totalJobs} jobs</span></div>)}
        </div>
        <div className="flex items-center space-x-2">
            <div className="bg-slate-800 rounded flex items-center border border-white/5 mr-2">
                <button onClick={() => setThumbnailSize('small')} className={`p-1.5 rounded-l ${thumbnailSize === 'small' ? 'bg-indigo-600' : 'text-slate-400 hover:text-white'}`}><Grip size={14} /></button>
                <div className="w-px h-4 bg-white/10"></div>
                <button onClick={() => setThumbnailSize('medium')} className={`p-1.5 ${thumbnailSize === 'medium' ? 'bg-indigo-600' : 'text-slate-400 hover:text-white'}`}><Grip size={16} /></button>
                <div className="w-px h-4 bg-white/10"></div>
                <button onClick={() => setThumbnailSize('large')} className={`p-1.5 rounded-r ${thumbnailSize === 'large' ? 'bg-indigo-600' : 'text-slate-400 hover:text-white'}`}><Monitor size={16} /></button>
            </div>
            <button onClick={() => setIsOptionsOpen(true)} className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors border border-white/5"><Settings size={16} /> <span>Options</span></button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={() => setQueueControls(p => ({...p, GLOBAL: !p.GLOBAL}))} className={`flex items-center space-x-2 px-4 py-1.5 rounded text-sm font-bold transition-all ${queueControls.GLOBAL ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                {queueControls.GLOBAL ? <><Pause size={16} fill="currentColor" /><span>Stop</span></> : <><Play size={16} fill="currentColor" /><span>Start</span></>}
            </button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={handleExport} disabled={isExporting} className="p-2 hover:bg-white/10 rounded text-slate-400 disabled:opacity-50">{isExporting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}</button>
            <button onClick={() => !isImporting && fileInputRef.current?.click()} disabled={isImporting} className="p-2 hover:bg-white/10 rounded text-slate-400 disabled:opacity-50">{isImporting ? <Loader2 size={18} className="animate-spin" /> : <FolderOpen size={18} />}</button>
            <input type="file" ref={fileInputRef} hidden accept=".json" onChange={handleImport} />
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={() => setIsManualOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400"><Book size={18} /></button>
            <button onClick={() => setIsConsoleOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400"><Terminal size={18} /></button>
            <button onClick={handleApiKeyChange} disabled={isKeyLoading} className="p-2 hover:bg-white/10 rounded text-slate-400 disabled:opacity-50">{isKeyLoading ? <Loader2 size={18} className="animate-spin" /> : <Key size={18} />}</button>
        </div>
      </header>

      {/* Button Bar */}
      <div className="w-full bg-[#1e1e2e] border-b border-white/5 flex items-center px-2 py-2 overflow-x-auto space-x-1 scrollbar-hide flex-none z-40 relative">
        {queueViews.map((view) => (
            <button key={view.id} onClick={() => setActiveQueueView(view.id)} onMouseEnter={(e) => setHoveredButton({id: view.id, rect: e.currentTarget.getBoundingClientRect()})} onMouseLeave={() => setHoveredButton(null)} className={`flex-none min-w-[3.5rem] px-2 h-9 flex items-center justify-center rounded-lg transition-all border relative ${activeQueueView === view.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}>
                <view.icon size={18} className="shrink-0" /><span className="ml-2 text-[10px] font-bold font-mono">{getQueueStats(view.id)}</span>
            </button>
        ))}
        {hoveredButton && <div className="fixed z-[60] bg-slate-900 border border-slate-600 text-white p-3 rounded-lg shadow-2xl pointer-events-none w-64" style={{ top: hoveredButton.rect.bottom + 10, left: Math.min(hoveredButton.rect.left, window.innerWidth - 270) }}><div className="font-bold text-sm text-indigo-400 mb-1">{queueViews.find(q => q.id === hoveredButton.id)?.label}</div><div className="text-xs text-slate-300">{queueViews.find(q => q.id === hoveredButton.id)?.description}</div></div>}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-[20vw] flex flex-col bg-[#13131f] border-r border-white/5 relative z-10">
            <div className="p-3 border-b border-white/5 bg-slate-800/30 flex items-center justify-between sticky top-0 z-30 backdrop-blur">
                <h2 className="font-bold text-sm text-indigo-400 uppercase tracking-wider truncate" title={queueViews.find(q => q.id === activeQueueView)?.label}>{queueViews.find(q => q.id === activeQueueView)?.label}</h2>
                <div className="flex items-center space-x-1">
                    {(activeQueueView === 'RETRY' || activeQueueView === 'FAILED') && (
                        <button onClick={() => handleRetryAllInQueue(activeQueueView)} className="p-1.5 hover:bg-indigo-500/20 text-slate-500 hover:text-indigo-400 rounded transition-colors" title="Retry All"><RefreshCw size={16} /></button>
                    )}
                    <button onClick={() => handleDeleteAllInQueue(activeQueueView)} className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors" title="Delete All"><Trash2 size={16} /></button>
                </div>
            </div>
            
            <div className="p-3 border-b border-white/5">
                {activeQueueView === 'UPLOADS' && (
                    <div className="flex flex-col gap-2 w-full">
                        <div className="w-full flex items-center justify-center p-4 border-2 border-dashed border-white/10 rounded bg-white/5 hover:bg-white/10 cursor-pointer relative transition-colors"><input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleUpload(e.target.files)} /><div className="flex items-center space-x-2 text-sm text-slate-400 font-medium"><Upload size={16} /> <span>Add Images</span></div></div>
                        <div className="flex gap-2"><button onClick={() => { const ids = uploads.filter(u => getSourceStatus(u.id) === 'done').map(u => u.id); ids.forEach(deleteUpload); }} className="flex-1 py-2 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded border border-emerald-500/20"><CheckCircle2 size={12} className="inline mr-1"/> Done</button><button onClick={() => setShowFinishedUploads(!showFinishedUploads)} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded border flex items-center justify-center gap-2 ${showFinishedUploads ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-700 text-slate-400 border-white/5'}`}>{showFinishedUploads ? <CheckSquare size={12} /> : <Square size={12} />} Finished</button></div>
                    </div>
                )}
                {GROUP_MAPPING[activeQueueView] && (
                    <div className="w-full flex items-center justify-between bg-slate-800/50 p-2 rounded">
                         <span className="text-xs font-mono uppercase text-slate-400">Group Active</span>
                         <button onClick={() => setQueueControls(p => ({...p, [activeQueueView]: !p[activeQueueView]}))} className={`w-10 h-5 rounded-full relative transition-colors ${queueControls[activeQueueView] ? 'bg-emerald-500' : 'bg-slate-600'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${queueControls[activeQueueView] ? 'translate-x-5.5 left-0.5' : 'translate-x-0.5 left-0.5'}`}></div></button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
                {activeQueueView === 'UPLOADS' && uploads.filter(u => !showFinishedUploads || getSourceStatus(u.id) === 'done').map(upload => {
                    const status = getSourceStatus(upload.id);
                    const processing = getProcessingJobsForSource(upload.id);
                    const isScanning = processing.some(j => j.taskType === 'scan-people');
                    const borderColor = status === 'done' ? 'border-emerald-500 border-4' : status === 'error' ? 'border-red-500 border-4' : 'border-white/5';

                    return (
                    <div key={upload.id} className={`bg-slate-800 rounded-lg overflow-hidden border relative group flex flex-col cursor-pointer ${selectedSourceIds.has(upload.id) ? 'ring-2 ring-indigo-500' : ''} ${borderColor}`} onClick={() => setSelectedSourceIds(p => {const n=new Set(p); if(n.has(upload.id)) n.delete(upload.id); else n.add(upload.id); return n;})}>
                        <div className="relative"><img src={upload.thumbnailUrl} className="w-full h-auto max-h-[50vh] object-cover opacity-70 group-hover:opacity-100" /><div className="absolute top-2 left-2 z-20"><div className={`p-1 rounded bg-black/50 backdrop-blur ${selectedSourceIds.has(upload.id) ? 'text-emerald-400' : 'text-slate-400'}`}>{selectedSourceIds.has(upload.id) ? <CheckSquare size={20} /> : <Square size={20} />}</div></div>{isScanning && <div className="absolute inset-0 z-10 overflow-hidden"><div className="absolute left-0 w-full h-[2px] bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)] animate-scan"></div></div>}</div>
                        <div className="p-2 border-t border-white/5 flex flex-col gap-2"><p className="text-xs font-bold text-slate-200 truncate">{upload.file.name}</p><button onClick={(e) => { e.stopPropagation(); deleteUpload(upload.id); }} className="w-full py-1.5 bg-slate-700 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded text-xs"><Trash2 size={12} className="inline mr-1" /> Delete</button></div>
                    </div>
                )})}
                {activeQueueView !== 'UPLOADS' && getQueueItems(activeQueueView).map(item => (
                     <div key={item.id} className="bg-slate-800 rounded-lg overflow-hidden border border-white/5 relative group">
                        <div className={`h-1 w-full ${item.status === ProcessingStatus.PROCESSING ? 'bg-indigo-500 animate-pulse' : item.status === ProcessingStatus.ERROR ? 'bg-red-500' : 'bg-slate-600'}`}></div>
                        <div className="relative"><img src={item.thumbnailUrl} className="w-full h-auto opacity-80" />{item.detectBox && <div className="absolute border-2 border-indigo-500/50" style={{top: `${item.detectBox[0]/10}%`, left: `${item.detectBox[1]/10}%`, height: `${(item.detectBox[2]-item.detectBox[0])/10}%`, width: `${(item.detectBox[3]-item.detectBox[1])/10}%`}}></div>}</div>
                        <div className="p-3"><p className="text-xs font-bold text-slate-200 uppercase">{item.taskType}</p><p className="text-[10px] text-slate-400 truncate">{item.file.name}</p></div>
                        <button onClick={() => deleteJob(item.id)} className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-20"><Trash2 size={14} /></button>
                        {item.status === ProcessingStatus.ERROR && (
                            <button onClick={() => retryJob(item)} className="absolute top-2 left-2 p-1 bg-black/50 hover:bg-indigo-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-20"><RefreshCw size={14} /></button>
                        )}
                     </div>
                ))}
            </div>
        </div>

        {/* Content */}
        <div className="w-[80vw] h-full flex flex-col bg-[#0f0f16] relative">
            <div className="absolute top-4 left-0 right-0 z-30 flex items-center justify-center pointer-events-none">
                 <div className="pointer-events-auto flex items-center space-x-4">
                     {selectedSourceIds.size > 0 && <div className="bg-indigo-600 shadow-lg border border-indigo-400/50 rounded-full px-4 py-2 flex items-center space-x-4 animate-in slide-in-from-top-4"><span className="text-sm font-bold text-white">{selectedSourceIds.size} Sources Selected</span><button onClick={() => setSelectedSourceIds(new Set())} className="p-1 hover:bg-white/20 rounded-full text-white bg-white/10"><span className="text-xs px-2 font-bold">Deselect All</span></button></div>}
                 </div>
                 <div className="absolute right-6 pointer-events-auto flex items-center space-x-2 bg-slate-800/90 backdrop-blur p-2 rounded-lg border border-white/5 shadow-xl">
                      <select value={gallerySortBy} onChange={(e) => setGallerySortBy(e.target.value as any)} className="bg-transparent text-xs font-bold text-slate-300 outline-none cursor-pointer"><option value="queue">Sort: Queue Type</option><option value="filename">Sort: File Name</option><option value="timestamp">Sort: Time</option></select>
                      <button onClick={() => setGallerySortOrder(o => o === 'asc' ? 'desc' : 'asc')} className="p-1 hover:bg-white/10 rounded text-slate-400">{gallerySortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</button>
                 </div>
            </div>

            {/* Gallery Header for Context */}
            {activeQueueView !== 'UPLOADS' && (
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#0f0f16] to-transparent pointer-events-none z-20 flex justify-start px-8 pt-4">
                    <span className="text-4xl font-black text-white/5 uppercase tracking-tighter select-none">{queueViews.find(q => q.id === activeQueueView)?.label}</span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-8 pt-20" ref={galleryRef}>
                 <div className={`grid gap-8 pb-20 ${thumbnailSize === 'small' ? 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]' : thumbnailSize === 'medium' ? 'grid-cols-[repeat(auto-fill,minmax(350px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(500px,1fr))]'}`}>
                     {galleryItems.map(item => (
                        <GalleryItemCard 
                            key={item.id} 
                            item={item} 
                            isHighlighted={!!(currentViewTypes && currentViewTypes.includes(item.taskType))}
                            onSetViewerItemId={setViewerItemId}
                            onUpscale={handleUpscale}
                            isUpscaling={upscalingIds.has(item.id)}
                            onRepeat={repeatJob}
                            onDelete={deleteJob}
                        />
                     ))}
                     {galleryItems.length === 0 && (
                         <div className="col-span-full flex flex-col items-center justify-center pt-20 text-slate-600">
                             <Ghost size={48} className="mb-4 opacity-50"/>
                             <p className="text-sm font-bold">No images found</p>
                             <p className="text-xs opacity-70">Try generating some art or checking your filters.</p>
                         </div>
                     )}
                 </div>
            </div>
        </div>

        <Console isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} />
        <ManualDialog isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
        <OptionsDialog isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} options={options} setOptions={setOptions} />
        {viewerItemId && <ImageViewer item={queue.find(i => i.id === viewerItemId)!} onClose={() => setViewerItemId(null)} onRepeat={() => repeatJob(queue.find(i => i.id === viewerItemId)!)} onDelete={() => { deleteJob(viewerItemId); setViewerItemId(null); }} {...viewerNav} />}
    </div>
  );
}
