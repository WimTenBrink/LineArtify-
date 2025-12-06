








import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLogger } from './services/loggerService';
import { generateLineArtTask, detectPeople, generateFilename } from './services/geminiService';
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
    Zap, Eye, Star, Heart, Bot, Map, Feather, Scroll, ZapOff, Grid, Brush, Hammer, SprayCan, Skull,
    FileCheck, Globe, Compass, Pen
} from 'lucide-react';
import { TASK_DEFINITIONS } from './services/taskDefinitions';
import { EMPTY_GALLERY_BACKGROUND } from './assets';

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
    'STYLES_WESTERN' | 'STYLES_EASTERN' | 'STYLES_FANTASY' | 'STYLES_ARTISTIC' | 'STYLES_SPECIAL' |
    'UTILITY' | 'ISSUES';

// Mapping Groups to Task Types for Filtering
const GROUP_MAPPING: Record<string, TaskType[]> = {
    'SCENES': ['full', 'full-nude', 'background'],
    'GROUPS': ['all-people', 'all-people-nude'],
    'CHARACTERS': [
        'model-full', 'model-full-nude', 'model-full-anatomy', 'model-full-skeleton',
        'body-front', 'body-front-nude', 'body-front-anatomy', 'body-front-skeleton',
        'body-left', 'body-left-nude', 'body-left-anatomy', 'body-left-skeleton',
        'body-right', 'body-right-nude', 'body-right-anatomy', 'body-right-skeleton',
        'backside', 'nude-opposite', 'backside-anatomy', 'backside-skeleton',
        'model', 'nude', 'neutral', 'neutral-nude'
    ],
    'PORTRAITS': ['face-asis', 'face', 'face-left', 'face-right', 'face-back'],
    
    'STYLES_WESTERN': [
        'american-comic', 'american-comic-nude',
        'european-comic', 'european-comic-nude',
        'pinup', 'pinup-nude',
        'style-ligne-claire', 'style-ligne-claire-nude',
        'style-asterix', 'style-asterix-nude',
        'style-spirou', 'style-spirou-nude',
        'style-lucky', 'style-lucky-nude',
        'style-peanuts', 'style-peanuts-nude',
        'style-calvin', 'style-calvin-nude',
        'style-garfield', 'style-garfield-nude',
        'style-simpsons', 'style-simpsons-nude',
        'style-kirby', 'style-kirby-nude',
        'style-miller', 'style-miller-nude',
        'style-mignola', 'style-mignola-nude',
        'style-timm', 'style-timm-nude',
        'style-fleischer', 'style-fleischer-nude',
        'style-hanna', 'style-hanna-nude',
        'style-disney', 'style-disney-nude',
        'style-looney', 'style-looney-nude',
        'style-archies', 'style-archies-nude',
        'coloring-book', 'coloring-book-nude'
    ],

    'STYLES_EASTERN': [
        'anime', 'anime-nude',
        'manga', 'manga-nude',
        'chibi', 'chibi-nude',
        'style-toriyama', 'style-toriyama-nude',
        'style-ghibli', 'style-ghibli-nude',
        'style-oda', 'style-oda-nude',
        'style-jojo', 'style-jojo-nude',
        'style-berserk', 'style-berserk-nude',
        'style-rumiko', 'style-rumiko-nude',
        'style-tezuka', 'style-tezuka-nude'
    ],

    'STYLES_FANTASY': [
        'fantasy', 'fantasy-nude',
        'elfquest', 'elfquest-nude',
        'style-frazetta', 'style-frazetta-nude',
        'style-vallejo', 'style-vallejo-nude',
        'style-amano', 'style-amano-nude',
        'style-diterlizzi', 'style-diterlizzi-nude',
        'style-rackham', 'style-rackham-nude',
        'style-mtg', 'style-mtg-nude',
        'style-moebius', 'style-moebius-nude'
    ],

    'STYLES_ARTISTIC': [
        'sketch', 'sketch-nude',
        'impressionist', 'impressionist-nude',
        'style-art-nouveau', 'style-art-nouveau-nude',
        'style-art-deco', 'style-art-deco-nude',
        'style-bauhaus', 'style-bauhaus-nude',
        'style-cubism', 'style-cubism-nude',
        'style-surrealism', 'style-surrealism-nude',
        'style-expressionism', 'style-expressionism-nude',
        'style-stained-glass', 'style-stained-glass-nude',
        'popart', 'popart-nude',
        'ukiyo', 'ukiyo-nude',
        'woodcut', 'woodcut-nude',
        'style-stipple', 'style-stipple-nude',
        'style-hatching', 'style-hatching-nude',
        'style-charcoal', 'style-charcoal-nude',
        'style-ink-wash', 'style-ink-wash-nude',
        'style-chalk', 'style-chalk-nude',
        'style-crayon', 'style-crayon-nude',
        'style-watercolor', 'style-watercolor-nude',
        'style-vector', 'style-vector-nude'
    ],

    'STYLES_SPECIAL': [
        'cyberpunk', 'cyberpunk-nude',
        'noir', 'noir-nude',
        'mecha', 'mecha-nude',
        'sticker', 'sticker-nude',
        'blueprint', 'blueprint-nude',
        'graffiti', 'graffiti-nude',
        'horror', 'horror-nude',
        'style-junji-ito', 'style-junji-ito-nude',
        'style-giger', 'style-giger-nude',
        'style-pixel-art', 'style-pixel-art-nude',
        'style-low-poly', 'style-low-poly-nude',
        'style-paper-cutout', 'style-paper-cutout-nude',
        'style-origami', 'style-origami-nude',
        'style-claymation', 'style-claymation-nude'
    ],

    'UTILITY': ['scan-people', 'upscale', 'generate-name']
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
    sourceDisplayName?: string;
    isHighlighted: boolean;
    isSelectedSource: boolean;
    onSetViewerItemId: (id: string) => void;
    onUpscale: (item: QueueItem) => void;
    isUpscaling: boolean;
    onRepeat: (item: QueueItem) => void;
    onDelete: (id: string) => void;
}

const GalleryItemCard: React.FC<GalleryItemCardProps> = ({ 
    item, sourceDisplayName, isHighlighted, isSelectedSource, onSetViewerItemId, onUpscale, isUpscaling, onRepeat, onDelete 
}) => {
     const [showOriginal, setShowOriginal] = useState(false);
     const displayUrl = showOriginal ? item.thumbnailUrl : (item.result?.url || item.thumbnailUrl);

     // Selection Style: Green Border if belonging to selected source
     const borderClass = isSelectedSource 
        ? 'border-emerald-500 ring-2 ring-emerald-500/50' 
        : isHighlighted 
            ? 'border-purple-500/50' 
            : 'border-white/5';

     return (
         <div className="flex flex-col group animate-fade-in">
             <div className={`relative bg-[#1e1c2e] rounded-t-xl overflow-hidden cursor-zoom-in border border-b-0 transition-all duration-300 ${borderClass}`} onClick={() => onSetViewerItemId(item.id)} style={{ height: '400px' }}>
                 <div className="absolute inset-0 flex items-center justify-center bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
                 <img src={displayUrl} className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105" />
                 <div className="absolute top-3 left-3 flex flex-col items-start gap-1 z-20"><span className={`px-2 py-1 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded tracking-wider ${isSelectedSource ? 'bg-emerald-600' : 'bg-black/60'}`}>{item.taskType}</span>{item.personDescription && <span className="px-2 py-1 bg-purple-600/80 backdrop-blur-md text-white text-[10px] rounded max-w-[150px] truncate">{item.personDescription}</span>}</div>
                 
                 {/* Quick Toggle Original */}
                 <button 
                    onClick={(e) => { e.stopPropagation(); setShowOriginal(!showOriginal); }}
                    className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-white/20 backdrop-blur text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    title="Toggle Original"
                 >
                    {showOriginal ? <EyeOff size={16} /> : <Eye size={16} />}
                 </button>

                 <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-3 py-2 text-center border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-[10px] font-mono text-slate-300 truncate block">{sourceDisplayName || item.file.name}</span></div>
             </div>
             <div className={`h-12 bg-slate-800 rounded-b-xl flex divide-x divide-white/10 ${isSelectedSource ? 'border-x-2 border-b-2 border-emerald-500' : 'border border-white/5'}`}>
                 <button onClick={() => onUpscale(item)} disabled={isUpscaling} className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50" title="Upscale to 4K">{isUpscaling ? <Loader2 size={14} className="animate-spin text-purple-400" /> : <Wand2 size={14} className="text-purple-400" />} <span>Upscale</span></button>
                 <button onClick={() => onRepeat(item)} className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-colors" title="Repeat this job"><Repeat size={14} /> <span>Repeat</span></button>
                 <button onClick={() => onDelete(item.id)} className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Delete job"><Trash2 size={14} /> <span>Delete</span></button>
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
    customStyle: '',
    modesty: 'None'
  });

  const [maxConcurrent, setMaxConcurrent] = useState(5);

  // UI State
  const [activeQueueView, setActiveQueueView] = useState<QueueViewGroup>('UPLOADS');
  const [viewerItemId, setViewerItemId] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Single selection source ID
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  
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
  // Default to enabled
  const [queueControls, setQueueControls] = useState<Record<string, boolean>>({
      'GLOBAL': false,
      'SCENES': true,
      'GROUPS': true,
      'CHARACTERS': true,
      'PORTRAITS': true,
      'STYLES_WESTERN': true,
      'STYLES_EASTERN': true,
      'STYLES_FANTASY': true,
      'STYLES_ARTISTIC': true,
      'STYLES_SPECIAL': true,
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
          case 'ISSUES': return queue.filter(i => i.status === ProcessingStatus.ERROR || i.status === ProcessingStatus.ENDED);
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
    if (view === 'ISSUES') return getQueueItems('ISSUES').length;

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

  const allSuccessItems = queue.filter(i => i.status === ProcessingStatus.SUCCESS || i.status === ProcessingStatus.PROCESSING);
  
  let galleryItems = allSuccessItems.filter(i => 
    i.taskType !== 'scan-people' && i.taskType !== 'generate-name'
  );
  
  const currentViewTypes = GROUP_MAPPING[activeQueueView];
  
  // STRICT FILTERING by View Group
  if (currentViewTypes && activeQueueView !== 'UTILITY') {
      galleryItems = allSuccessItems.filter(i => currentViewTypes.includes(i.taskType));
  }

  // Sorting
  galleryItems.sort((a, b) => {
      // 1. Priority: Selected Source ID comes first
      if (selectedSourceId) {
          if (a.sourceId === selectedSourceId && b.sourceId !== selectedSourceId) return -1;
          if (a.sourceId !== selectedSourceId && b.sourceId === selectedSourceId) return 1;
      }

      // 2. Existing Sort Logic
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

  const activeJobs = processingJobs;
  let statusMessage = "Ready";
  
  if (activeJobs.length > 0) {
      const scanning = activeJobs.filter(j => j.taskType === 'scan-people');
      const naming = activeJobs.filter(j => j.taskType === 'generate-name');
      const generating = activeJobs.filter(j => j.taskType !== 'scan-people' && j.taskType !== 'generate-name');
      
      if (scanning.length > 0) {
          statusMessage = `AI Status: Scanning ${scanning[0].file.name} for human subjects...`;
      } else if (naming.length > 0) {
          statusMessage = `AI Status: Analyzing ${naming[0].file.name} to generate descriptive filename...`;
      } else if (generating.length > 0) {
          const job = generating[0];
          statusMessage = `AI Thinking: Generating ${job.taskType} artwork for ${job.file.name}... (${generating.length} active)`;
      }
  }

  const handleUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    const newUploads: SourceImage[] = [];
    const currentOptionsSnapshot = JSON.parse(JSON.stringify(options));
    Array.from(files).filter(f => f.type.startsWith('image/')).forEach(file => {
       if (uploads.some(u => u.file.name === file.name)) return;
       const id = crypto.randomUUID();
       newUploads.push({ 
           id, 
           file, 
           thumbnailUrl: URL.createObjectURL(file), 
           timestamp: Date.now(), 
           options: currentOptionsSnapshot,
           // Initial display name is file name until generated
           displayName: undefined 
       });
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
      
      // Auto-Spawn Utility Tasks
      newJobs.push(createJob(source, 'scan-people')); 
      newJobs.push(createJob(source, 'generate-name'));
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

  const createAuditLog = (source: SourceImage) => {
    const jobs = queue.filter(j => j.sourceId === source.id);
    const log = {
        originalImage: source.file.name,
        sourceOptions: source.options,
        processedAt: new Date().toISOString(),
        jobs: jobs.map(j => ({
            task: j.taskType,
            status: j.status,
            resultFilename: j.result ? `${j.taskType}-${source.displayName || source.file.name.split('.')[0]}.png` : null,
            prompt: j.result?.prompt || "N/A",
            description: TASK_DEFINITIONS[j.taskType]?.description || "Utility Task",
            error: j.errorMessage
        }))
    };
    return JSON.stringify(log, null, 2);
  };

  const deleteUpload = (id: string) => {
    const upload = uploads.find(u => u.id === id);
    if (upload) {
        // Generate and download KLA
        const json = createAuditLog(upload);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${upload.file.name.split('.')[0]}.kla`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        cleanupUrl(upload.thumbnailUrl);
    }

    setUploads(prev => prev.filter(u => u.id !== id));
    setQueue(prev => prev.filter(j => j.sourceId !== id));
    if (selectedSourceId === id) setSelectedSourceId(null);
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
             setSelectedSourceId(null);
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
  
  const handleClearFinished = () => {
      const finishedJobs = queue.filter(j => j.status === ProcessingStatus.SUCCESS || j.status === ProcessingStatus.ENDED);
      if (finishedJobs.length === 0) return;
      if (window.confirm(`Clear ${finishedJobs.length} finished jobs from view? (This does not delete source images)`)) {
          finishedJobs.forEach(job => cleanupUrl(job.result?.url));
          const idsToDelete = new Set(finishedJobs.map(j => j.id));
          setQueue(prev => prev.filter(j => !idsToDelete.has(j.id)));
          addLog(LogLevel.INFO, `Cleared finished jobs.`);
      }
  };

  const handleDeleteFinishedSources = () => {
      const sourcesToDelete: string[] = [];

      uploads.forEach(upload => {
          const jobs = queue.filter(j => j.sourceId === upload.id);
          
          if (jobs.length === 0) return;

          // A job is "done or died" if it is SUCCESS or ENDED.
          // ERROR means it might be retried (unless it reached max retries, which sets it to ENDED anyway).
          const allSettled = jobs.every(j => 
              j.status === ProcessingStatus.SUCCESS || 
              j.status === ProcessingStatus.ENDED 
          );

          if (allSettled) {
              sourcesToDelete.push(upload.id);
          }
      });

      if (sourcesToDelete.length === 0) {
          alert("No completely finished images found to delete.");
          return;
      }

      if (window.confirm(`Delete ${sourcesToDelete.length} images where all jobs are finished or dead?`)) {
          sourcesToDelete.forEach(id => deleteUpload(id));
          addLog(LogLevel.INFO, `Deleted ${sourcesToDelete.length} finished source images.`);
      }
  };

  const retryJob = (item: QueueItem) => {
      setQueue(prev => prev.map(i => i.id === item.id ? { 
          ...i, 
          status: ProcessingStatus.PENDING, 
          retryCount: 0, 
          isBlocked: false,
          isLastChance: false,
          errorMessage: undefined,
          errorHistory: [],
          timestamp: Date.now() // Send to back of queue
      } : i));
  };

  const retrySourceJobs = (sourceId: string) => {
      setQueue(prev => prev.map(j => {
          if (j.sourceId === sourceId && (j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED)) {
               return {
                   ...j,
                   status: ProcessingStatus.PENDING,
                   retryCount: 0,
                   isBlocked: false,
                   isLastChance: false,
                   errorMessage: undefined,
                   errorHistory: [],
                   timestamp: Date.now() // Send to back of queue
               };
          }
          return j;
      }));
  };
  
  const clearDeadSourceJobs = (sourceId: string) => {
      const deadJobs = queue.filter(j => j.sourceId === sourceId && j.status === ProcessingStatus.ENDED);
      deadJobs.forEach(job => cleanupUrl(job.result?.url));
      const idsToDelete = new Set(deadJobs.map(j => j.id));
      setQueue(prev => prev.filter(j => !idsToDelete.has(j.id)));
  };
  
  const handleRetryAllIssues = () => {
    setQueue(prev => prev.map(j => {
         if (j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED) {
             return {
               ...j,
               status: ProcessingStatus.PENDING,
               retryCount: 0,
               isBlocked: false,
               isLastChance: false,
               errorMessage: undefined,
               errorHistory: [],
               timestamp: Date.now()
             };
         }
         return j;
    }));
    addLog(LogLevel.INFO, "Retrying all failed/ended jobs.");
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

  const downloadImage = (url: string, sourceId: string, taskType: string) => {
      const source = uploads.find(u => u.id === sourceId);
      const baseName = source?.displayName || source?.file.name.replace(/\.[^/.]+$/, "") || "image";
      const filename = `${taskType}-${baseName}.png`;
      
      const link = document.createElement('a'); link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- Processing Loop ---
  useEffect(() => {
    if (!queueControls.GLOBAL) return;
    const runProcessor = async () => {
        // Strict Concurrency Limit controlled by User Input
        if (processingJobs.length >= maxConcurrent) return;

        const activeTaskTypes = new Set(processingJobs.map(j => j.taskType));
        
        let candidates: { item: QueueItem, priority: number }[] = [];
        
        const isTypeAllowed = (type: TaskType) => {
            const groupEntry = Object.entries(GROUP_MAPPING).find(([g, types]) => types.includes(type));
            if (!groupEntry) return true; 
            return queueControls[groupEntry[0]];
        };

        const scan = queue.find(i => i.taskType === 'scan-people' && i.status === ProcessingStatus.PENDING);
        const nameGen = queue.find(i => i.taskType === 'generate-name' && i.status === ProcessingStatus.PENDING);

        if ((scan || nameGen) && queueControls.UTILITY) {
             if (scan && !activeTaskTypes.has('scan-people')) candidates.push({ item: scan, priority: 100 });
             if (nameGen && !activeTaskTypes.has('generate-name')) candidates.push({ item: nameGen, priority: 99 });
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
        
        // Sort: Priority (Desc), then Timestamp (Asc -> Oldest First)
        candidates.sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            return a.item.timestamp - b.item.timestamp;
        });
        
        const job = candidates[0].item;

        setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.PROCESSING } : i));
        const apiKey = process.env.API_KEY || '';
        if (!apiKey) { handleJobError(job, "Missing API Key", true); return; }

        try {
            const source = uploads.find(u => u.id === job.sourceId);
            const jobOptions = source?.options || options; 
            
            if (job.taskType === 'scan-people') {
                await handleScanning(job, apiKey, jobOptions);
            } else if (job.taskType === 'generate-name') {
                const generatedName = await generateFilename(job.file, apiKey);
                // Update Source Image with new name
                setUploads(prev => prev.map(u => u.id === job.sourceId ? { ...u, displayName: generatedName } : u));
                // Mark job as success
                setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.SUCCESS, timestamp: Date.now() } : i));
                addLog(LogLevel.INFO, `Renamed ${job.file.name} to ${generatedName}`);
            } else {
                await handleGeneration(job, apiKey, jobOptions);
            }
        } catch (error: any) {
             handleJobError(job, error.message || "Unknown error", error.message?.includes("Safety") || error.message?.includes("Prohibited"));
        }
    };
    const interval = setInterval(runProcessor, 1000);
    return () => clearInterval(interval);
  }, [queue, queueControls, processingJobs.length, options, uploads, maxConcurrent]);

  const handleJobError = (job: QueueItem, message: string, isSafety: boolean) => {
      addLog(LogLevel.WARN, `Job Failed: ${message}`);
      setQueue(prev => prev.map(i => {
          if (i.id !== job.id) return i;

          const newHistory = [...(i.errorHistory || []), message];
          const totalErrors = newHistory.length;
          
          // Logic: 
          // 3 Total Errors -> ENDED
          // Prohibited errors are treated as regular errors now (part of the 3 strike rule)
          const isDead = totalErrors >= 3;

          return {
              ...i,
              status: isDead ? ProcessingStatus.ENDED : ProcessingStatus.ERROR, 
              errorMessage: message,
              retryCount: i.retryCount + 1,
              errorHistory: newHistory,
              isBlocked: isSafety, 
              isLastChance: isDead,
              timestamp: Date.now()
          };
      }));
  };

  const handleScanning = async (job: QueueItem, apiKey: string, jobOptions: AppOptions) => {
      addLog(LogLevel.INFO, `Scanning ${job.file.name}...`);
      let people = await detectPeople(job.file, apiKey, addLog, jobOptions.gender);
      
      if (people.length === 0) {
          addLog(LogLevel.WARN, `Scan failed or no people found in ${job.file.name}. Defaulting to single subject.`);
          people = [{ description: "Subject" }];
      }

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
              const def = TASK_DEFINITIONS[key as TaskType];
              if (jobOptions.taskTypes[key] && def && (def.category === 'Person' || def.category === 'Style')) {
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
      downloadImage(res.url, job.sourceId, job.taskType);
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

  const getProcessingJobsForSource = (sourceId: string) => queue.filter(j => j.sourceId === sourceId && j.status === ProcessingStatus.PROCESSING);

  const getUploadBorderClass = (uploadId: string) => {
      const jobs = queue.filter(j => j.sourceId === uploadId);
      if (jobs.length === 0) return 'border-white/5';

      // 1. Blue: Active job running
      if (jobs.some(j => j.status === ProcessingStatus.PROCESSING)) return 'border-blue-500 border-4';
      
      // 2. Yellow: Scan needed (Scan pending)
      const scanJob = jobs.find(j => j.taskType === 'scan-people');
      if (scanJob && scanJob.status === ProcessingStatus.PENDING) return 'border-yellow-500 border-4';

      // 3. Red: Jobs have died (Ended)
      if (jobs.some(j => j.status === ProcessingStatus.ENDED)) return 'border-red-500 border-4';

      // 4. Orange: Jobs have failed (Error)
      if (jobs.some(j => j.status === ProcessingStatus.ERROR)) return 'border-orange-500 border-4';

      // 5. Green: All jobs finished (Success)
      const allDone = jobs.length > 0 && jobs.every(j => j.status === ProcessingStatus.SUCCESS);
      if (allDone) return 'border-emerald-500 border-4';

      // Default
      return 'border-white/5';
  };

  const sortedUploads = [...uploads].sort((a, b) => a.file.name.localeCompare(b.file.name));

  const queueViews: { id: QueueViewGroup, label: string, icon: any, description: string }[] = [
    { id: 'UPLOADS', label: 'Uploads', icon: Upload, description: "Manage source images" },
    { id: 'JOBS', label: 'Jobs', icon: RefreshCw, description: "Running tasks" },
    { id: 'SCENES', label: 'Scenes', icon: Mountain, description: "Full scenes and backgrounds" },
    { id: 'GROUPS', label: 'Groups', icon: Users, description: "Multi-person extraction" },
    { id: 'CHARACTERS', label: 'Characters', icon: User, description: "Full body character studies" },
    { id: 'PORTRAITS', label: 'Portraits', icon: Smile, description: "Face close-ups" },
    
    // Updated Consolidated Styles
    { id: 'STYLES_WESTERN', label: 'Western', icon: Star, description: "US/Euro Comics & Cartoons" },
    { id: 'STYLES_EASTERN', label: 'Eastern', icon: Scroll, description: "Anime & Manga" },
    { id: 'STYLES_FANTASY', label: 'Fantasy', icon: Sword, description: "Fantasy & Sci-Fi Artists" },
    { id: 'STYLES_ARTISTIC', label: 'Artistic', icon: Palette, description: "Movements & Techniques" },
    { id: 'STYLES_SPECIAL', label: 'Special', icon: Zap, description: "Tech, Horror, & Misc" },

    { id: 'UTILITY', label: 'Utility', icon: Layers, description: "Scanning and Upscaling" },
    { id: 'ISSUES', label: 'Issues', icon: AlertTriangle, description: "Failed and Dead jobs" }
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#13111c] text-slate-200 font-sans overflow-hidden relative" onDragOver={e => {e.preventDefault(); setIsDragging(true)}} onDragLeave={e => {e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)}} onDrop={e => {e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files)}}>
      {isDragging && <div className="absolute inset-0 z-[100] bg-purple-500/20 backdrop-blur-sm border-4 border-purple-500 border-dashed flex items-center justify-center pointer-events-none"><div className="text-4xl font-bold text-white drop-shadow-lg">Drop images to upload</div></div>}

      <header className="flex-none h-14 bg-[#1a1625] border-b border-white/5 flex items-center justify-between px-4 z-50">
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2"><div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center"><ImageIcon className="text-white w-5 h-5" /></div><h1 className="font-bold text-lg tracking-tight">LineArtify</h1></div>
            <div className="flex flex-col justify-center ml-4">
                {totalJobs > 0 && (<div className="flex items-center space-x-3 bg-slate-800/50 px-3 py-1.5 rounded-full border border-white/5 mb-0.5"><div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }}></div></div><span className="text-xs font-mono text-slate-400">{completedJobs} / {totalJobs} jobs</span></div>)}
                <div className="text-[10px] text-purple-300 font-mono h-3 overflow-hidden whitespace-nowrap text-ellipsis max-w-[300px] animate-pulse">
                    {statusMessage}
                </div>
            </div>
        </div>
        <div className="flex items-center space-x-2">
            <button onClick={handleRetryAllIssues} className="flex items-center space-x-2 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded text-sm transition-colors border border-orange-500/20 font-bold mr-2" title="Retry all Failed Jobs"><RefreshCw size={14} /> <span>Retry All Issues</span></button>
            <button onClick={handleDeleteFinishedSources} className="flex items-center space-x-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-sm transition-colors border border-red-500/20 font-bold mr-2" title="Delete sources where all jobs are done"><Trash2 size={14} /> <span>Delete Finished</span></button>
            
            <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-800 rounded border border-white/5 px-2 py-1 mr-2" title="Max concurrent jobs">
                <span>Max Jobs:</span>
                <input type="number" min="1" max="10" value={maxConcurrent} onChange={(e) => setMaxConcurrent(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))} className="w-8 bg-transparent text-center text-white outline-none font-bold appearance-none" style={{MozAppearance: 'textfield'}} />
            </div>

            <div className="bg-slate-800 rounded flex items-center border border-white/5 mr-2">
                <button onClick={() => setThumbnailSize('small')} className={`p-1.5 rounded-l ${thumbnailSize === 'small' ? 'bg-purple-600' : 'text-slate-400 hover:text-white'}`} title="Small Thumbnails"><Grip size={14} /></button>
                <div className="w-px h-4 bg-white/10"></div>
                <button onClick={() => setThumbnailSize('medium')} className={`p-1.5 ${thumbnailSize === 'medium' ? 'bg-purple-600' : 'text-slate-400 hover:text-white'}`} title="Medium Thumbnails"><Grip size={16} /></button>
                <div className="w-px h-4 bg-white/10"></div>
                <button onClick={() => setThumbnailSize('large')} className={`p-1.5 rounded-r ${thumbnailSize === 'large' ? 'bg-purple-600' : 'text-slate-400 hover:text-white'}`} title="Large Thumbnails"><Monitor size={16} /></button>
            </div>
            <button onClick={() => setIsOptionsOpen(true)} className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors border border-white/5" title="Configuration"><Settings size={16} /> <span>Options</span></button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={() => setQueueControls(p => ({...p, GLOBAL: !p.GLOBAL}))} className={`flex items-center space-x-2 px-4 py-1.5 rounded text-sm font-bold transition-all ${queueControls.GLOBAL ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`} title={queueControls.GLOBAL ? "Stop Processing" : "Start Processing"}>
                {queueControls.GLOBAL ? <><Pause size={16} fill="currentColor" /><span>Stop</span></> : <><Play size={16} fill="currentColor" /><span>Start</span></>}
            </button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={handleExport} disabled={isExporting} className="p-2 hover:bg-white/10 rounded text-slate-400 disabled:opacity-50" title="Backup Workspace"><Save size={18} /></button>
            <button onClick={() => !isImporting && fileInputRef.current?.click()} disabled={isImporting} className="p-2 hover:bg-white/10 rounded text-slate-400 disabled:opacity-50" title="Restore Workspace"><FolderOpen size={18} /></button>
            <input type="file" ref={fileInputRef} hidden accept=".json" onChange={handleImport} />
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={() => setIsManualOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400" title="User Manual"><Book size={18} /></button>
            <button onClick={() => setIsConsoleOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400" title="System Logs"><Terminal size={18} /></button>
            <button onClick={handleApiKeyChange} disabled={isKeyLoading} className="p-2 hover:bg-white/10 rounded text-slate-400 disabled:opacity-50" title="API Key Config"><Key size={18} /></button>
        </div>
      </header>

      <div className="w-full bg-[#201c2e] border-b border-white/5 flex items-center px-2 py-2 overflow-x-auto space-x-1 scrollbar-hide flex-none z-40 relative">
        {queueViews.map((view) => (
            <button key={view.id} onClick={() => setActiveQueueView(view.id)} onMouseEnter={(e) => setHoveredButton({id: view.id, rect: e.currentTarget.getBoundingClientRect()})} onMouseLeave={() => setHoveredButton(null)} className={`flex-none min-w-[3.5rem] px-2 h-9 flex items-center justify-center rounded-lg transition-all border relative ${activeQueueView === view.id ? 'bg-purple-600 border-purple-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}>
                <view.icon size={18} className="shrink-0" /><span className="ml-2 text-[10px] font-bold font-mono">{getQueueStats(view.id)}</span>
            </button>
        ))}
        {hoveredButton && <div className="fixed z-[60] bg-slate-900 border border-slate-600 text-white p-3 rounded-lg shadow-2xl pointer-events-none w-64" style={{ top: hoveredButton.rect.bottom + 10, left: Math.min(hoveredButton.rect.left, window.innerWidth - 270) }}><div className="font-bold text-sm text-purple-400 mb-1">{queueViews.find(q => q.id === hoveredButton.id)?.label}</div><div className="text-xs text-slate-300">{queueViews.find(q => q.id === hoveredButton.id)?.description}</div></div>}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[20vw] flex flex-col bg-[#16141f] border-r border-white/5 relative z-10">
            <div className="p-3 border-b border-white/5 bg-slate-800/30 flex items-center justify-between sticky top-0 z-30 backdrop-blur">
                <h2 className="font-bold text-sm text-purple-400 uppercase tracking-wider truncate" title={queueViews.find(q => q.id === activeQueueView)?.label}>{queueViews.find(q => q.id === activeQueueView)?.label}</h2>
                <div className="flex items-center space-x-1">
                     {(activeQueueView !== 'UPLOADS' && activeQueueView !== 'ISSUES') && (
                        <button onClick={() => handleDeleteAllInQueue(activeQueueView)} className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors" title="Delete All"><Trash2 size={16} /></button>
                     )}
                </div>
            </div>
            
            <div className="p-3 border-b border-white/5">
                {activeQueueView === 'UPLOADS' && (
                    <div className="flex flex-col gap-2 w-full">
                        <div className="w-full flex items-center justify-center p-4 border-2 border-dashed border-white/10 rounded bg-white/5 hover:bg-white/10 cursor-pointer relative transition-colors"><input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleUpload(e.target.files)} /><div className="flex items-center space-x-2 text-sm text-slate-400 font-medium"><Upload size={16} /> <span>Add Images</span></div></div>
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
                {activeQueueView === 'UPLOADS' && sortedUploads.filter(u => !showFinishedUploads).map(upload => {
                    const sourceJobs = queue.filter(j => j.sourceId === upload.id);
                    const isScanning = getProcessingJobsForSource(upload.id).some(j => j.taskType === 'scan-people');
                    const isNaming = getProcessingJobsForSource(upload.id).some(j => j.taskType === 'generate-name');
                    const borderColorClass = getUploadBorderClass(upload.id);
                    const hasErrorJobs = sourceJobs.some(j => j.status === ProcessingStatus.ERROR);
                    const hasDeadJobs = sourceJobs.some(j => j.status === ProcessingStatus.ENDED);

                    const totalSourceJobs = sourceJobs.length;
                    const settledSourceJobs = sourceJobs.filter(j => 
                        j.status === ProcessingStatus.SUCCESS || 
                        j.status === ProcessingStatus.ENDED || 
                        (j.status === ProcessingStatus.ERROR && (j.isBlocked || j.retryCount >= 3))
                    ).length;
                    const failedSourceJobs = sourceJobs.filter(j => j.status === ProcessingStatus.ERROR || j.status === ProcessingStatus.ENDED).length;
                    
                    const isSelected = selectedSourceId === upload.id;
                    const errorMessages = sourceJobs.filter(j => j.errorMessage).map(j => `${j.taskType}: ${j.errorMessage}`);

                    const activeStates = [ProcessingStatus.PENDING, ProcessingStatus.PROCESSING];
                    const isBusy = sourceJobs.some(j => activeStates.includes(j.status));
                    const deleteBtnClass = isBusy 
                        ? "bg-red-600 hover:bg-red-500 text-white" 
                        : "bg-emerald-600 hover:bg-emerald-500 text-white";

                    return (
                    <div key={upload.id} className={`bg-slate-800 rounded-lg overflow-hidden border relative group flex flex-col cursor-pointer transition-all ${isSelected ? 'ring-2 ring-purple-500 z-10 scale-[1.02]' : ''} ${borderColorClass}`} onClick={() => setSelectedSourceId(prev => prev === upload.id ? null : upload.id)}>
                        <div className="relative">
                            <img src={upload.thumbnailUrl} className="w-full h-auto max-h-[50vh] object-cover opacity-70 group-hover:opacity-100" />
                            <div className="absolute top-2 left-2 z-20"><div className={`p-1 rounded bg-black/50 backdrop-blur ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>{isSelected ? <CheckSquare size={20} /> : <Square size={20} />}</div></div>
                            {totalSourceJobs > 0 && (
                                <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-20">
                                    <div className="bg-black/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded-full font-mono font-bold border border-white/10 shadow-lg">
                                        {settledSourceJobs} / {totalSourceJobs} jobs
                                    </div>
                                    {failedSourceJobs > 0 && (
                                        <div className="bg-red-500/90 text-white text-[10px] px-2 py-1 rounded-full font-bold shadow-lg animate-pulse">
                                            {failedSourceJobs} failed
                                        </div>
                                    )}
                                </div>
                            )}
                            {(isScanning || isNaming) && <div className="absolute inset-0 z-10 overflow-hidden"><div className="absolute left-0 w-full h-[2px] bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)] animate-scan"></div></div>}
                            
                            <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 backdrop-blur">
                                <p className="text-[10px] font-mono text-white truncate text-center">{upload.displayName || upload.file.name}</p>
                            </div>
                            
                            {/* Error Tooltip */}
                            {errorMessages.length > 0 && (
                                <div className="hidden group-hover:block absolute bottom-8 left-2 right-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="bg-slate-900 border border-red-500/50 rounded p-2 shadow-2xl">
                                        <div className="text-xs font-bold text-red-400 mb-1 pb-1 border-b border-white/10">Errors: ({errorMessages.length})</div>
                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                            {errorMessages.map((msg, idx) => (
                                                <div key={idx} className="text-[10px] text-slate-300 leading-tight">• {msg}</div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-2 border-t border-white/5 flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); deleteUpload(upload.id); }} className={`flex-1 py-1.5 rounded text-xs flex items-center justify-center font-bold transition-colors ${deleteBtnClass}`}><Trash2 size={12} className="inline mr-1" /> Delete</button>
                            {hasErrorJobs && (
                                <button onClick={(e) => { e.stopPropagation(); retrySourceJobs(upload.id); }} className="flex-1 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 hover:text-orange-300 rounded text-xs flex items-center justify-center border border-orange-500/20 font-bold"><RefreshCw size={12} className="inline mr-1" /> Retry</button>
                            )}
                            {hasDeadJobs && (
                                <button onClick={(e) => { e.stopPropagation(); clearDeadSourceJobs(upload.id); }} className="flex-1 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded text-xs flex items-center justify-center border border-red-500/20 font-bold"><XCircle size={12} className="inline mr-1" /> Clear Dead</button>
                            )}
                        </div>
                    </div>
                )})}
                {activeQueueView !== 'UPLOADS' && getQueueItems(activeQueueView).map(item => (
                     <div key={item.id} className="bg-slate-800 rounded-lg overflow-hidden border border-white/5 relative group">
                        <div className={`h-1 w-full ${item.status === ProcessingStatus.PROCESSING ? 'bg-purple-500 animate-pulse' : item.status === ProcessingStatus.ERROR ? 'bg-red-500' : 'bg-slate-600'}`}></div>
                        <div className="relative"><img src={item.thumbnailUrl} className="w-full h-auto opacity-80" />{item.detectBox && <div className="absolute border-2 border-purple-500/50" style={{top: `${item.detectBox[0]/10}%`, left: `${item.detectBox[1]/10}%`, height: `${(item.detectBox[2]-item.detectBox[0])/10}%`, width: `${(item.detectBox[3]-item.detectBox[1])/10}%`}}></div>}</div>
                        <div className="p-3"><p className="text-xs font-bold text-slate-200 uppercase">{item.taskType}</p><p className="text-[10px] text-slate-400 truncate">{uploads.find(u => u.id === item.sourceId)?.displayName || item.file.name}</p></div>
                        <button onClick={() => deleteJob(item.id)} className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-20"><Trash2 size={14} /></button>
                        {(item.status === ProcessingStatus.ERROR || item.status === ProcessingStatus.ENDED) && (
                            <button onClick={() => retryJob(item)} className="absolute top-2 left-2 p-1 bg-black/50 hover:bg-purple-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-20"><RefreshCw size={14} /></button>
                        )}
                     </div>
                ))}
            </div>
        </div>

        <Console isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} />
        <ManualDialog isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
        <OptionsDialog isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} options={options} setOptions={setOptions} />
        {viewerItemId && <ImageViewer item={queue.find(i => i.id === viewerItemId)!} onClose={() => setViewerItemId(null)} onRepeat={() => repeatJob(queue.find(i => i.id === viewerItemId)!)} onDelete={() => { deleteJob(viewerItemId); setViewerItemId(null); }} {...viewerNav} />}
    </div>
  );
}