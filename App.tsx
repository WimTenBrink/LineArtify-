

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLogger } from './services/loggerService';
import {
  Upload, Play, Pause, Settings, Key, Book, HelpCircle,
  Trash2, RefreshCw, ChevronUp, ChevronDown, Image as ImageIcon, CheckCircle, AlertTriangle, Loader2,
  Terminal, List, Layers, CheckSquare, Eye, EyeOff, Info, Layout, ChevronsUp, ChevronsDown,
  Clock, ShieldBan, LayoutGrid, Palette, Ban, Filter, UserX
} from 'lucide-react';
import {
  ProcessingStatus, TaskType, SourceImage, QueueItem, AppOptions,
  StyleStat, LogLevel
} from './types';
import { TASK_DEFINITIONS } from './services/taskDefinitions';
import { saveWorkspace, loadWorkspace, clearWorkspace as clearDbWorkspace } from './services/dbService';
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

// --- Helper for Filename Parsing ---
const getTaskFilenameInfo = (taskType: string) => {
    if (taskType.endsWith('-nude')) return { style: taskType.replace('-nude', ''), variant: 'Nude' };
    if (taskType.endsWith('-topless')) return { style: taskType.replace('-topless', ''), variant: 'Topless' };
    if (taskType.endsWith('-bottomless')) return { style: taskType.replace('-bottomless', ''), variant: 'Bottomless' };
    if (taskType.endsWith('-anatomy')) return { style: taskType.replace('-anatomy', ''), variant: 'Anatomy' };
    if (taskType.endsWith('-skeleton')) return { style: taskType.replace('-skeleton', ''), variant: 'Skeleton' };
    // Default fallback
    return { style: taskType, variant: 'Clothed' };
};

// --- Gallery Item Component ---
interface GalleryItemProps {
    item: QueueItem;
    onView: () => void;
    onDetails: () => void;
    onRetry: () => void;
    onDelete: () => void;
    isHighlighted?: boolean;
}

const GalleryItem: React.FC<GalleryItemProps> = ({ item, onView, onDetails, onRetry, onDelete, isHighlighted }) => {
    const [showOriginal, setShowOriginal] = useState(false);
    
    const isSuccess = item.status === ProcessingStatus.SUCCESS;
    const isProcessing = item.status === ProcessingStatus.PROCESSING;
    const isError = item.status === ProcessingStatus.ERROR;
    const isPending = item.status === ProcessingStatus.PENDING;
    const isBlocked = item.isBlocked;
    const isPaused = item.isPaused;
    
    // Determine display URL:
    // If we have a result and showOriginal is false, show result.
    // Otherwise show the source thumbnail.
    const hasResult = !!item.result?.url;
    const displayUrl = (hasResult && !showOriginal) ? item.result!.url : item.thumbnailUrl;

    return (
        <div 
            className={`aspect-square relative rounded-xl overflow-hidden group bg-[#181825] transition-all shrink-0 ${
                isHighlighted 
                  ? 'border-green-500 border-4 shadow-[0_0_15px_rgba(34,197,94,0.5)] z-10 scale-105' 
                  : isProcessing ? 'border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' :
                    isSuccess ? 'border-2 border-transparent hover:border-indigo-500 cursor-pointer' :
                    isBlocked ? 'border-2 border-red-900 opacity-80' :
                    isError ? 'border-2 border-red-500/50' : 
                    isPaused ? 'border-2 border-amber-500/50 opacity-80' : 'border-2 border-white/5 opacity-60'
            }`}
            onClick={() => {
                if (isSuccess) onView();
            }}
        >
            <img 
                src={displayUrl} 
                className={`w-full h-full object-cover transition-transform duration-500 ${isSuccess ? 'group-hover:scale-110' : isPending ? 'grayscale opacity-50' : 'grayscale'}`} 
                loading="lazy" 
            />
            
            {/* Priority Badge - Always Visible */}
            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur rounded text-[10px] font-mono text-slate-300 border border-white/10 shadow-lg z-20 pointer-events-none">
                 P:{item.priority}
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                 <div className="font-bold text-sm text-white truncate drop-shadow-md">{item.taskType}</div>
                 <div className="text-xs text-slate-300 truncate mb-3 opacity-80">{item.file.name}</div>
                 
                 {/* Action Buttons Container - Stop Propagation to prevent opening viewer when clicking buttons */}
                 <div className="grid grid-cols-5 gap-2" onClick={(e) => e.stopPropagation()}>
                     {isSuccess ? (
                         <button 
                             onClick={onView}
                             className="aspect-square bg-white text-black rounded-lg hover:bg-indigo-400 transition-colors flex items-center justify-center shadow-lg"
                             title="View Fullscreen"
                         >
                             <Eye size={18} />
                         </button>
                     ) : (
                         <div className="aspect-square"></div>
                     )}
                     
                     {/* Toggle Source/Result Button - Only if result exists */}
                     {hasResult ? (
                         <button 
                             onClick={(e) => { e.stopPropagation(); setShowOriginal(!showOriginal); }}
                             className={`aspect-square rounded-lg transition-colors flex items-center justify-center border border-white/10 shadow-lg ${showOriginal ? 'bg-amber-500 text-black' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                             title={showOriginal ? "Showing Original" : "Showing Result"}
                         >
                             {showOriginal ? <EyeOff size={18} /> : <ImageIcon size={18} />}
                         </button>
                     ) : (
                         <div className="aspect-square"></div>
                     )}

                     <button 
                         onClick={onDetails}
                         className="aspect-square bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center border border-white/10"
                         title="Details"
                     >
                         <Info size={18} />
                     </button>

                     {isError && !isBlocked ? (
                         <button 
                             onClick={onRetry}
                             className="aspect-square bg-slate-800 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center border border-white/10"
                             title="Retry"
                         >
                             <RefreshCw size={18} />
                         </button>
                     ) : (
                         <div className="aspect-square"></div>
                     )}

                     <button 
                         onClick={onDelete}
                         className="aspect-square bg-slate-800 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center border border-white/10"
                         title="Delete"
                     >
                         <Trash2 size={18} />
                     </button>
                 </div>
            </div>

            {/* Status Badges */}
            {isProcessing && (
                <div className="absolute top-2 right-2 p-2 bg-blue-600 rounded-full animate-spin shadow-lg">
                    <Loader2 size={16} className="text-white" />
                </div>
            )}
            {isBlocked && (
                <div className="absolute top-2 right-2 p-2 bg-red-900 rounded-full shadow-lg border border-red-500">
                    <ShieldBan size={16} className="text-red-200" />
                </div>
            )}
            {isError && !isBlocked && (
                <div className="absolute top-2 right-2 p-2 bg-red-600 rounded-full shadow-lg">
                    <AlertTriangle size={16} className="text-white" />
                </div>
            )}
            {isPaused && !isProcessing && (
                <div className="absolute top-2 right-2 p-2 bg-amber-500/80 rounded-full shadow-lg border border-amber-300">
                    <Pause size={16} className="text-black" fill="currentColor" />
                </div>
            )}
        </div>
    );
};

// Filter Types
type GalleryFilterType = 'ALL' | 'PROCESSING' | 'WAITING' | 'FINISHED' | 'FAILED' | 'PROHIBITED';

const App: React.FC = () => {
  // --- State ---
  const [uploads, setUploads] = useState<SourceImage[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [options, setOptions] = useState<AppOptions>(DEFAULT_OPTIONS);
  const [isPaused, setIsPaused] = useState(true); // START PAUSED
  const [hasKey, setHasKey] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Sidebar Resize State
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  
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
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null); 
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilterType>('ALL');
  const [activeQueueView, setActiveQueueView] = useState<'SOURCES' | 'QUEUES'>('SOURCES');
  
  // Tooltip State
  const [hoveredStyle, setHoveredStyle] = useState<{title: string, desc: string} | null>(null);

  // Processing State
  const processingRef = useRef<boolean>(false);
  const activeJobsCount = useRef<number>(0);

  const { logs, addLog } = useLogger();
  
  // Last Error for Header Display
  const lastError = useMemo(() => logs.find(l => l.level === LogLevel.ERROR), [logs]);

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
        // Filter out utility tasks (like generate-name) from restored queue to prevent errors
        setQueue(loaded.queue.filter(q => TASK_DEFINITIONS[q.taskType]?.category !== 'Utility'));
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

  // --- Sidebar Resizing Logic ---
  const startResizing = useCallback(() => setIsResizingSidebar(true), []);
  const stopResizing = useCallback(() => setIsResizingSidebar(false), []);
  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
      if (isResizingSidebar) {
          const newWidth = mouseMoveEvent.clientX;
          if (newWidth >= 250 && newWidth <= 800) {
              setSidebarWidth(newWidth);
          }
      }
  }, [isResizingSidebar]);

  useEffect(() => {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
      return () => {
          window.removeEventListener("mousemove", resize);
          window.removeEventListener("mouseup", stopResizing);
      };
  }, [resize, stopResizing]);

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

  const viewableQueue = useMemo(() => {
      // Filter for items that have successfully generated results for the Zoom Dialog navigation
      return queue.filter(q => q.status === ProcessingStatus.SUCCESS);
  }, [queue]);

  // --- Queue View Data ---
  const allQueues = useMemo(() => {
      const map = new Map<string, { id: string, label: string, count: number, active: number, error: number, avgPriority: number, isConfigurable: boolean }>();
      
      Object.entries(options.taskTypes).forEach(([key, enabled]) => {
          const def = TASK_DEFINITIONS[key as TaskType];
          if (def && def.category !== 'Utility') {
            map.set(key, { 
                id: key, 
                label: def.label, 
                count: 0, 
                active: 0, 
                error: 0,
                avgPriority: 50,
                isConfigurable: true 
            });
          }
      });

      queue.forEach(item => {
          if (!map.has(item.taskType)) {
              const def = TASK_DEFINITIONS[item.taskType];
              if (def && def.category !== 'Utility') {
                  map.set(item.taskType, { 
                      id: item.taskType, 
                      label: def?.label || item.taskType, 
                      count: 0, 
                      active: 0, 
                      error: 0,
                      avgPriority: 50,
                      isConfigurable: !!def 
                  });
              }
          }
          if (map.has(item.taskType)) {
              const entry = map.get(item.taskType)!;
              entry.count++;
              if (item.status === ProcessingStatus.PROCESSING || item.status === ProcessingStatus.PENDING) entry.active++;
              // Sum persistent error counters for the style
              entry.error += (item.failureCount || 0) + (item.prohibitedCount || 0);
          }
      });
      
      // Calculate avg priority
      const queues = Array.from(map.values());
      queues.forEach(q => {
          const items = queue.filter(i => i.taskType === q.id && (i.status === ProcessingStatus.PENDING || i.status === ProcessingStatus.PROCESSING));
          if (items.length > 0) {
              const sum = items.reduce((acc, i) => acc + i.priority, 0);
              q.avgPriority = Math.round(sum / items.length);
          }
      });

      return queues.sort((a, b) => b.active - a.active);
  }, [queue, options.taskTypes]);

  // Counts for UI Buttons
  const failedJobsCount = useMemo(() => queue.filter(q => q.status === ProcessingStatus.ERROR).length, [queue]);
  const pendingJobsCount = useMemo(() => queue.filter(q => q.status === ProcessingStatus.PENDING).length, [queue]);
  const finishedJobsCount = useMemo(() => queue.filter(q => q.status === ProcessingStatus.SUCCESS).length, [queue]);
  
  const prunableUploadsCount = useMemo(() => {
      const activeSourceIds = new Set(queue.filter(q => q.status === ProcessingStatus.PENDING || q.status === ProcessingStatus.PROCESSING).map(q => q.sourceId));
      return uploads.filter(u => !activeSourceIds.has(u.id)).length;
  }, [uploads, queue]);

  const noPeopleUploadsCount = useMemo(() => uploads.filter(u => u.peopleCount === 0).length, [uploads]);


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

    const pendingCount = queue.filter(q => q.status === ProcessingStatus.PENDING || q.status === ProcessingStatus.PROCESSING).length;
    if (pendingCount > 500) {
        setWarningMessage("Queue Limit Reached.\n\nThe system cannot accept more images because the job queue is full (500+ active jobs). Please wait for some jobs to finish before adding more.");
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
            options: { ...options }
        };
        newUploads.push(source);
        
        addLog(LogLevel.INFO, `Queued ${file.name} for scanning.`);
        
        Object.entries(options.taskTypes).forEach(([taskKey, enabled]) => {
            const def = TASK_DEFINITIONS[taskKey as TaskType];
            // Fix: Check category to prevent Utility tasks (like generate-name) from entering the image queue
            if (enabled && def && def.category !== 'Utility') {
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
                    priority: (options.stylePriorities[taskKey] || 50),
                    failureCount: 0,
                    prohibitedCount: 0,
                    isPaused: false // Default to active
                });
            }
        });

        detectPeople(file, process.env.API_KEY, addLog, options.gender).then(people => {
             setUploads(prev => prev.map(u => u.id === id ? { ...u, peopleCount: people.length } : u));
             
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

    // Add new uploads to the front, but ensure sorting handles view.
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

  const handleQueueClick = (id: string) => {
      if (activeQueueId === id) setActiveQueueId(null);
      else {
          setActiveQueueId(id);
          // Don't filter, we use highlighting now
      }
  };

  const handleNavbarFilterClick = (filter: GalleryFilterType) => {
      setGalleryFilter(filter);
      setActiveQueueId(null);
  };
  
  const handleStyleFilterClick = (styleId: string) => {
      setActiveQueueId(styleId === activeQueueId ? null : styleId);
      // Don't filter, we use highlighting
  }

  // --- Priority Helper ---
  const adjustPriority = (predicate: (item: QueueItem) => boolean, delta: number) => {
      setQueue(prev => prev.map(item => {
          // Adjust active/pending items. 
          if (predicate(item) && (item.status === ProcessingStatus.PENDING || item.status === ProcessingStatus.PROCESSING)) {
              const newPrio = Math.min(100, Math.max(1, item.priority + delta));
              return { ...item, priority: newPrio };
          }
          return item;
      }));
  };

  // --- Pause Helper ---
  const togglePause = (predicate: (item: QueueItem) => boolean, shouldPause: boolean) => {
      setQueue(prev => prev.map(item => {
          // Only modify PENDING items. Processing items are already running.
          if (predicate(item) && item.status === ProcessingStatus.PENDING) {
              return { ...item, isPaused: shouldPause };
          }
          return item;
      }));
  };

  // --- Bulk Actions ---
  const retryFailedJobs = () => {
      // NOTE: We do NOT reset failureCount or prohibitedCount here, as per requirements.
      // We just set status back to PENDING so the processor can pick it up again if it hasn't hit the hard limit.
      setQueue(prev => prev.map(q => q.status === ProcessingStatus.ERROR ? { ...q, status: ProcessingStatus.PENDING, errorMessage: undefined } : q));
  };

  const deleteFailedJobs = () => {
      setQueue(prev => prev.filter(q => q.status !== ProcessingStatus.ERROR));
  };
  
  const clearFinishedJobs = () => {
      setQueue(prev => prev.filter(q => q.status !== ProcessingStatus.SUCCESS));
  };
  
  const boostPendingJobs = () => {
      setQueue(prev => prev.map(q => q.status === ProcessingStatus.PENDING ? { ...q, priority: Math.min(100, q.priority + 20) } : q));
  };
  
  const pruneUploads = () => {
      const activeSourceIds = new Set(queue.filter(q => q.status === ProcessingStatus.PENDING || q.status === ProcessingStatus.PROCESSING).map(q => q.sourceId));
      setUploads(prev => prev.filter(u => activeSourceIds.has(u.id)));
      setQueue(prev => prev.filter(q => activeSourceIds.has(q.sourceId) || q.status === ProcessingStatus.SUCCESS));
  };

  const deleteNoPeopleUploads = () => {
      const idsToDelete = new Set(uploads.filter(u => u.peopleCount === 0).map(u => u.id));
      if (idsToDelete.size === 0) return;
      
      setUploads(prev => prev.filter(u => !idsToDelete.has(u.id)));
      setQueue(prev => prev.filter(q => !idsToDelete.has(q.sourceId)));
      if (selectedSourceId && idsToDelete.has(selectedSourceId)) setSelectedSourceId(null);
      addLog(LogLevel.INFO, `Deleted ${idsToDelete.size} uploads with no people detected.`);
  };

  const nukeWorkspace = async () => {
      if (confirm("Are you sure you want to clear EVERYTHING? This cannot be undone.")) {
          setQueue([]);
          setUploads([]);
          await clearDbWorkspace();
      }
  };

  const generateReport = () => {
    const now = new Date();
    const fmt = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${fmt(now.getMonth()+1)}${fmt(now.getDate())}-${fmt(now.getHours())}${fmt(now.getMinutes())}`;
    
    let md = `# Error report-${timestamp}\n\n`;

    const stylesByGroup: Record<string, TaskType[]> = {};
    
    Object.keys(TASK_DEFINITIONS).forEach(key => {
        const def = TASK_DEFINITIONS[key as TaskType];
        if (def.category === 'Style') {
            const group = def.subCategory || 'Misc';
            if (!stylesByGroup[group]) stylesByGroup[group] = [];
            stylesByGroup[group].push(key as TaskType);
        }
    });

    md += `Report generated on ${now.toLocaleString()}\n\n`;

    Object.keys(stylesByGroup).sort().forEach(group => {
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
    
    // Selection Logic:
    // 1. Prefer Pending jobs first. Filter out PAUSED jobs.
    let candidates = queue.filter(i => i.status === ProcessingStatus.PENDING && !i.isPaused);
    
    // 2. If no pending jobs, look for Error jobs that can be retried (but only if they haven't hit the hard limit).
    // The user said "We can have no more than five failures or two prohibited errors before the job just dies."
    // So if status is ERROR, we can retry if counters are below limits.
    // Note: status gets set to ERROR if an error occurs. Manual retry sets status back to PENDING.
    // So usually we only check PENDING. But if we want auto-retry behavior for simple errors, we check ERROR too.
    if (candidates.length === 0) {
        candidates = queue.filter(i => 
            i.status === ProcessingStatus.ERROR && 
            !i.isBlocked && 
            !i.isPaused &&
            (i.failureCount < 5) && 
            (i.prohibitedCount < 2)
        );
    }

    if (candidates.length === 0) return;

    candidates.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.timestamp - b.timestamp;
    });

    const job = candidates[0];

    activeJobsCount.current++;
    setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.PROCESSING } : i));

    try {
        const source = uploads.find(u => u.id === job.sourceId);
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

        let finalUrl = result.url;
        let finalBlob: Blob | undefined = undefined;

        if (jobOptions.outputFormat === 'jpg' && result.url) {
             const jpegDataUrl = await convertBlobUrlToJpeg(result.url);
             const displayName = source?.displayName || "generated-image";
             const meta = {
                 filename: displayName,
                 style: job.taskType,
                 model: jobOptions.modelPreference || 'flash'
             };
             const exifDataUrl = addExifToJpeg(jpegDataUrl, meta);
             
             const res = await fetch(exifDataUrl);
             finalBlob = await res.blob();
             finalUrl = URL.createObjectURL(finalBlob);
        }

        // On Success: Update current job AND adjust priorities
        setQueue(prev => prev.map(i => {
            let newPriority = i.priority;
            if (i.sourceId === job.sourceId) newPriority += 1;
            if (i.taskType === job.taskType) newPriority += 1;
            newPriority = Math.min(100, Math.max(1, newPriority));

            if (i.id === job.id) {
                return { 
                    ...i, 
                    status: ProcessingStatus.SUCCESS, 
                    result: { ...result, url: finalUrl, blob: finalBlob },
                    priority: newPriority 
                };
            }
            return { ...i, priority: newPriority };
        }));
        
        if (finalUrl) {
            try {
                const downloadLink = document.createElement('a');
                downloadLink.href = finalUrl;
                
                // --- NEW FILENAME LOGIC ---
                // Format: [Style]-[Variant]-[GeneratedName]
                const { style, variant } = getTaskFilenameInfo(job.taskType);
                const safeName = (source?.displayName || "image").replace(/[^a-z0-9-_]/gi, '-');
                const filename = `${style}-${variant}-${safeName}.${jobOptions.outputFormat}`;
                
                downloadLink.download = filename;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                addLog(LogLevel.INFO, `Downloaded result for ${job.taskType}`);
            } catch (dlErr) {
                console.error("Auto-download failed", dlErr);
            }
        }
        addLog(LogLevel.INFO, `Job Finished: ${job.taskType}`);

    } catch (err: any) {
        setQueue(prev => {
            const isPolicy = err.message.includes("Policy");
            const priorityDecrement = isPolicy ? 3 : 1;

            return prev.map(i => {
                let newPriority = i.priority;
                if (i.sourceId === job.sourceId) {
                    newPriority = Math.min(100, Math.max(1, i.priority - priorityDecrement));
                }

                if (i.id === job.id) {
                    // ERROR COUNTING LOGIC
                    const newFail = (i.failureCount || 0) + (isPolicy ? 0 : 1);
                    const newProhib = (i.prohibitedCount || 0) + (isPolicy ? 1 : 0);
                    
                    const isDead = newFail >= 5 || newProhib >= 2;

                    return {
                        ...i,
                        // If it's dead, we can set status to ENDED or leave as ERROR.
                        // Setting to ERROR but blocked is fine if filters handle it.
                        // Let's use ERROR, but set isBlocked if Prohibited limit reached.
                        status: isDead ? ProcessingStatus.ERROR : ProcessingStatus.ERROR, 
                        isBlocked: newProhib >= 2,
                        errorMessage: err.message,
                        errorHistory: [...(i.errorHistory || []), err.message],
                        failureCount: newFail,
                        prohibitedCount: newProhib,
                        priority: newPriority
                    };
                }
                return { ...i, priority: newPriority };
            });
        });
        
        addLog(LogLevel.ERROR, `Job Failed: ${job.taskType}`, err.message);
    } finally {
        activeJobsCount.current--;
        setTimeout(processQueue, 100);
    }
  }, [isPaused, hasKey, queue, uploads, options, addLog]);

  useEffect(() => {
      const interval = setInterval(processQueue, 500);
      return () => clearInterval(interval);
  }, [processQueue]);


  // --- Render Helpers ---
  
  // Highlight logic instead of filtering logic for source/style selection
  const isHighlighted = (item: QueueItem) => {
      if (selectedSourceId && item.sourceId === selectedSourceId) return true;
      if (activeQueueId && item.taskType === activeQueueId) return true;
      return false;
  };

  const applyGlobalFilter = (items: QueueItem[]) => {
      let filtered = items.filter(i => TASK_DEFINITIONS[i.taskType]?.category !== 'Utility');

      // Note: We REMOVED the strict filtering by source/queue ID here 
      // because the user requested HIGHLIGHTING instead of filtering.
      // But we still respect the top navbar filters.

      if (galleryFilter === 'FAILED') return filtered.filter(i => i.status === ProcessingStatus.ERROR);
      if (galleryFilter === 'PROHIBITED') return filtered.filter(i => i.status === ProcessingStatus.ERROR && i.isBlocked);
      if (galleryFilter === 'PROCESSING') return filtered.filter(i => i.status === ProcessingStatus.PROCESSING);
      if (galleryFilter === 'WAITING') return filtered.filter(i => i.status === ProcessingStatus.PENDING);
      if (galleryFilter === 'FINISHED') return filtered.filter(i => i.status === ProcessingStatus.SUCCESS);
      
      return filtered;
  };

  // Split Gallery Data
  const downloadedJobs = useMemo(() => {
      const items = queue.filter(i => i.status === ProcessingStatus.SUCCESS);
      return applyGlobalFilter(items).sort((a, b) => b.timestamp - a.timestamp);
  }, [queue, galleryFilter]); // Intentionally don't dep on selection to show all

  const workspaceJobs = useMemo(() => {
      // Show everything NOT SUCCESS
      const items = queue.filter(i => i.status !== ProcessingStatus.SUCCESS);
      return applyGlobalFilter(items).sort((a, b) => b.timestamp - a.timestamp);
  }, [queue, galleryFilter]);


  const selectedItem = queue.find(i => i.id === selectedItemId);

  // Gallery Item Renderer Props Helper
  const renderItem = (item: QueueItem) => (
      <GalleryItem 
          key={item.id}
          item={item}
          isHighlighted={isHighlighted(item)}
          onView={() => { 
              if (item.status === ProcessingStatus.SUCCESS) {
                  setSelectedItemId(item.id); 
                  setDialogs(d => ({...d, viewer: true}));
              }
          }}
          onDetails={() => { setSelectedItemId(item.id); setIsJobDetailsOpen(true); }}
          onRetry={() => setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: ProcessingStatus.PENDING } : q))}
          onDelete={() => setQueue(prev => prev.filter(q => q.id !== item.id))}
      />
  );
  
  // Style Buttons
  const artStyles = useMemo(() => {
      return Object.keys(TASK_DEFINITIONS)
        .map(k => TASK_DEFINITIONS[k as TaskType])
        .filter(def => def.category === 'Style' && !def.id.includes('-nude') && !def.id.includes('-topless') && !def.id.includes('-bottomless'));
  }, []);

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

               {/* NEW: Error Alert */}
               {lastError && (
                  <button 
                      onClick={() => setIsConsoleOpen(true)}
                      className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-200 hover:bg-red-500/20 transition-colors ml-2 animate-in fade-in"
                      title={lastError.details ? String(lastError.details) : lastError.title}
                  >
                      <AlertTriangle size={14} className="text-red-400 shrink-0" />
                      <span className="font-bold truncate max-w-[250px]">{lastError.title}</span>
                  </button>
               )}
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

      {/* --- NEW ICON-BASED FILTER BAR --- */}
      <div 
        className="fixed top-14 right-0 h-16 bg-[#13111c] border-b border-white/5 flex items-center z-30 overflow-hidden"
        style={{ left: sidebarWidth }}
      >
          {/* Status Filters */}
          <div className="flex items-center gap-1 px-4 border-r border-white/5 shrink-0">
               <button onClick={() => handleNavbarFilterClick('ALL')} className={`p-2.5 rounded-lg transition-colors ${galleryFilter === 'ALL' && !activeQueueId ? 'bg-white/10 text-white shadow' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`} title="Show All">
                   <LayoutGrid size={20} />
               </button>
               <button onClick={() => handleNavbarFilterClick('PROCESSING')} className={`p-2.5 rounded-lg transition-colors ${galleryFilter === 'PROCESSING' && !activeQueueId ? 'bg-blue-500/20 text-blue-300 shadow' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`} title="Processing">
                   <Loader2 size={20} className={galleryFilter === 'PROCESSING' ? 'animate-spin' : ''} />
               </button>
               <button onClick={() => handleNavbarFilterClick('FINISHED')} className={`p-2.5 rounded-lg transition-colors ${galleryFilter === 'FINISHED' && !activeQueueId ? 'bg-emerald-500/20 text-emerald-300 shadow' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`} title="Finished">
                   <CheckCircle size={20} />
               </button>
               <button onClick={() => handleNavbarFilterClick('WAITING')} className={`p-2.5 rounded-lg transition-colors ${galleryFilter === 'WAITING' && !activeQueueId ? 'bg-indigo-500/20 text-indigo-300 shadow' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`} title="Waiting">
                   <Clock size={20} />
               </button>
               <button onClick={() => handleNavbarFilterClick('FAILED')} className={`p-2.5 rounded-lg transition-colors ${galleryFilter === 'FAILED' && !activeQueueId ? 'bg-red-500/20 text-red-300 shadow' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`} title="Failed">
                   <AlertTriangle size={20} />
               </button>
               <button onClick={() => handleNavbarFilterClick('PROHIBITED')} className={`p-2.5 rounded-lg transition-colors ${galleryFilter === 'PROHIBITED' && !activeQueueId ? 'bg-red-900/20 text-red-400 shadow' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`} title="Prohibited">
                   <ShieldBan size={20} />
               </button>
          </div>

          {/* Separator */}
          <div className="w-px h-8 bg-white/5 mx-2 shrink-0"></div>
          
          {/* Scrollable Styles List */}
          <div className="flex-1 overflow-x-auto scrollbar-hide flex items-center gap-2 px-2 relative h-full">
             <div className="flex items-center gap-2 pr-4">
                 {artStyles.map(style => (
                     <div key={style.id} className="relative group">
                        <button
                           onClick={() => handleStyleFilterClick(style.id)}
                           onMouseEnter={() => setHoveredStyle({title: style.label, desc: style.description})}
                           onMouseLeave={() => setHoveredStyle(null)}
                           className={`p-2.5 rounded-lg transition-all border ${
                               activeQueueId === style.id 
                               ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20' 
                               : 'bg-[#181825] border-white/5 text-slate-500 hover:text-white hover:border-purple-500/50 hover:bg-[#252233]'
                           }`}
                        >
                            <Palette size={18} />
                        </button>
                     </div>
                 ))}
             </div>
          </div>
          
          {/* Tooltip Popup */}
          {hoveredStyle && (
              <div className="absolute top-16 right-0 left-0 bg-[#181825]/95 backdrop-blur border-b border-white/10 p-3 z-50 flex flex-col animate-in fade-in slide-in-from-top-2 shadow-2xl">
                   <div className="flex items-center gap-2 mb-1">
                        <Palette size={14} className="text-purple-400" />
                        <span className="text-sm font-bold text-white">{hoveredStyle.title}</span>
                   </div>
                   <div className="text-xs text-slate-400 font-mono line-clamp-2">
                        {hoveredStyle.desc}
                   </div>
              </div>
          )}
      </div>

      {/* --- SIDEBAR --- */}
      <div 
        className="fixed top-14 bottom-0 left-0 bg-[#181825] border-r border-white/5 flex flex-col z-30"
        style={{ width: sidebarWidth }}
      >
          {/* Resize Handle */}
          <div 
            className="absolute top-0 bottom-0 right-0 w-1 cursor-col-resize hover:bg-indigo-500 z-40 transition-colors flex items-center justify-center group"
            onMouseDown={startResizing}
          >
             <div className="h-8 w-1 bg-slate-700 rounded-full group-hover:bg-white/50 transition-colors"></div>
          </div>

          {/* Sidebar Tabs */}
          <div className="flex border-b border-white/5 shrink-0">
              <button 
                onClick={() => setActiveQueueView('SOURCES')}
                className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 ${activeQueueView === 'SOURCES' ? 'bg-[#181825] text-white' : 'bg-black/20 text-slate-500 hover:text-slate-300'}`}
              >
                  <Layers size={14} /> Sources <span className="text-[10px] bg-white/10 px-1.5 rounded">{uploads.length}</span>
              </button>
              <button 
                onClick={() => setActiveQueueView('QUEUES')}
                className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 ${activeQueueView === 'QUEUES' ? 'bg-[#181825] text-white' : 'bg-black/20 text-slate-500 hover:text-slate-300'}`}
              >
                  <List size={14} /> Queues <span className="text-[10px] bg-white/10 px-1.5 rounded">{allQueues.length}</span>
              </button>
          </div>

          {activeQueueView === 'SOURCES' ? (
              <>
                {/* Upload Area */}
                <div className="p-4 border-b border-white/5 shrink-0">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all group">
                        <div className="flex flex-col items-center pt-2 pb-3">
                            <Upload className="w-6 h-6 text-slate-500 group-hover:text-indigo-400 mb-2" />
                            <p className="text-xs text-slate-400 font-bold uppercase">Add Images</p>
                        </div>
                        <input type="file" className="hidden" multiple accept="image/*" onChange={handleUpload} />
                    </label>
                </div>

                {/* Sources List (Cards) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                    {uploads.length === 0 && (
                        <div className="text-center mt-10 text-slate-600 text-xs italic">No sources uploaded</div>
                    )}
                    {/* Explicitly Sort Uploads by timestamp desc to ensure Newest on Top */}
                    {uploads.slice().sort((a, b) => b.timestamp - a.timestamp).map(u => {
                        const uQueue = queue.filter(q => q.sourceId === u.id);
                        const uPending = uQueue.filter(q => q.status === ProcessingStatus.PENDING).length;
                        const uActive = uQueue.filter(q => q.status === ProcessingStatus.PROCESSING).length;
                        // const uFail = uQueue.filter(q => q.status === ProcessingStatus.ERROR).length;
                        const uSuccess = uQueue.filter(q => q.status === ProcessingStatus.SUCCESS).length;
                        const uTotal = uQueue.length;
                        const percent = uTotal ? (uSuccess/uTotal)*100 : 0;
                        const isSelected = selectedSourceId === u.id;
                        const isScanning = u.peopleCount === undefined;
                        const isCompleted = uTotal > 0 && uPending === 0 && uActive === 0;

                        // Calculate Total Cumulative Errors (Failures + Prohibited)
                        const totalErrors = uQueue.reduce((acc, q) => acc + (q.failureCount || 0) + (q.prohibitedCount || 0), 0);

                        const activePrioJobs = uQueue.filter(q => q.status === ProcessingStatus.PENDING || q.status === ProcessingStatus.PROCESSING);
                        const maxPrio = activePrioJobs.length > 0 ? Math.max(...activePrioJobs.map(q => q.priority)) : 0;
                        
                        // Pause State Calculation
                        const pendingItems = uQueue.filter(q => q.status === ProcessingStatus.PENDING);
                        const isPaused = pendingItems.length > 0 && pendingItems.every(q => q.isPaused);
                        const hasPending = pendingItems.length > 0;

                        return (
                            <div 
                                key={u.id}
                                className={`relative rounded-xl overflow-hidden border shadow-lg transition-all cursor-pointer group aspect-video ${isSelected ? 'border-green-500 ring-2 ring-green-500/20' : 'border-white/10 hover:border-white/30'}`}
                                onClick={() => setSelectedSourceId(isSelected ? null : u.id)}
                            >
                                {/* Background Image */}
                                <img src={u.thumbnailUrl} className="absolute inset-0 w-full h-full object-cover" />
                                
                                {maxPrio > 0 && (
                                     <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur rounded text-[10px] font-mono text-indigo-300 border border-white/10 shadow-lg z-20">
                                         Max P:{maxPrio}
                                     </div>
                                )}

                                {isScanning && (
                                    <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
                                         <div className="w-full h-1 bg-indigo-500/30 animate-scan"></div>
                                         <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest animate-pulse">Scanning...</span>
                                    </div>
                                )}

                                {isCompleted && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                                        <div className="bg-emerald-500 rounded-full p-2 shadow-xl shadow-black/50">
                                            <CheckCircle size={48} className="text-white" fill="currentColor" />
                                        </div>
                                    </div>
                                )}
                                
                                {isPaused && !isCompleted && !isScanning && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none bg-black/20 backdrop-grayscale-[50%]">
                                        <div className="bg-amber-500/80 rounded-full p-2 shadow-xl backdrop-blur-sm">
                                            <Pause size={24} className="text-black" fill="currentColor" />
                                        </div>
                                    </div>
                                )}

                                {/* Info Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent p-3 flex flex-col justify-end">
                                    <div className="flex justify-between items-end mb-1">
                                         <div className="min-w-0 z-20">
                                             <div className="text-sm font-bold text-white truncate drop-shadow-md">{u.displayName || "Processing..."}</div>
                                             {u.peopleCount === 0 ? (
                                                  <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-black/60 rounded px-1.5 py-0.5 w-fit border border-amber-500/30">
                                                      <UserX size={10} /> No People Detected
                                                  </div>
                                             ) : (
                                                  <div className="text-[10px] text-slate-300 font-mono">
                                                      {u.peopleCount !== undefined ? `${u.peopleCount} Subjects` : 'Detecting subjects...'}
                                                  </div>
                                             )}
                                         </div>
                                         <div className="flex gap-1 z-20">
                                             {/* Display Total Persistent Errors */}
                                             {totalErrors > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded">{totalErrors} Err</span>}
                                             {(uPending + uActive) > 0 && <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 rounded">{uPending + uActive} Act</span>}
                                         </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm relative z-20">
                                        <div 
                                            className={`h-full transition-all duration-500 ${totalErrors > 5 ? 'bg-red-500' : uSuccess === uTotal && uTotal > 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                            style={{ width: `${percent}%` }}
                                        ></div>
                                    </div>
                                </div>
                                
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-30">
                                    {/* Pause Source Button */}
                                    {hasPending && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                togglePause(q => q.sourceId === u.id, !isPaused);
                                            }}
                                            className={`p-1.5 rounded backdrop-blur ${isPaused ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-black/60 hover:bg-indigo-500 text-white'}`}
                                            title={isPaused ? "Resume All" : "Pause All"}
                                        >
                                            {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                                        </button>
                                    )}
                                    
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            adjustPriority(i => i.sourceId === u.id, 5);
                                        }}
                                        className="p-1.5 bg-black/60 hover:bg-emerald-500 text-white rounded backdrop-blur" title="Priority +5"
                                    >
                                        <ChevronUp size={14} />
                                    </button>
                                     <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            adjustPriority(i => i.sourceId === u.id, -5);
                                        }}
                                        className="p-1.5 bg-black/60 hover:bg-amber-500 text-white rounded backdrop-blur" title="Priority -5"
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setQueue(prev => prev.map(q => q.sourceId === u.id && q.status === ProcessingStatus.ERROR ? { ...q, status: ProcessingStatus.PENDING, retryCount: 0 } : q));
                                        }}
                                        className="p-1.5 bg-black/60 hover:bg-blue-500 text-white rounded backdrop-blur" title="Retry Failed"
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setUploads(prev => prev.filter(up => up.id !== u.id));
                                            setQueue(prev => prev.filter(q => q.sourceId !== u.id));
                                            if (selectedSourceId === u.id) setSelectedSourceId(null);
                                        }}
                                        className="p-1.5 bg-black/60 hover:bg-red-500 text-white rounded backdrop-blur" title="Delete Source"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </>
          ) : (
              <div className="flex flex-col h-full">
                  <div className="p-3 bg-black/20 border-b border-white/5 shrink-0 grid grid-cols-2 gap-2">
                      <button onClick={retryFailedJobs} disabled={failedJobsCount === 0} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 rounded text-[10px] text-slate-300 transition-colors gap-1">
                          <RefreshCw size={14} className="text-blue-400"/>
                          <span>Retry Failed ({failedJobsCount})</span>
                      </button>
                      <button onClick={boostPendingJobs} disabled={pendingJobsCount === 0} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 rounded text-[10px] text-slate-300 transition-colors gap-1">
                          <ChevronsUp size={14} className="text-amber-400"/>
                          <span>Boost All ({pendingJobsCount})</span>
                      </button>
                      <button onClick={deleteFailedJobs} disabled={failedJobsCount === 0} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 rounded text-[10px] text-slate-300 transition-colors gap-1">
                          <Trash2 size={14} className="text-red-400"/>
                          <span>Clear Failed ({failedJobsCount})</span>
                      </button>
                       <button onClick={clearFinishedJobs} disabled={finishedJobsCount === 0} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 rounded text-[10px] text-slate-300 transition-colors gap-1">
                          <Layers size={14} className="text-emerald-400"/>
                          <span>Clear Done ({finishedJobsCount})</span>
                      </button>
                       <button onClick={pruneUploads} disabled={prunableUploadsCount === 0} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 rounded text-[10px] text-slate-300 transition-colors gap-1">
                          <Trash2 size={14} className="text-slate-400"/>
                          <span>Prune Sources ({prunableUploadsCount})</span>
                      </button>
                       <button onClick={deleteNoPeopleUploads} disabled={noPeopleUploadsCount === 0} className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 rounded text-[10px] text-slate-300 transition-colors gap-1">
                          <UserX size={14} className="text-amber-500"/>
                          <span>Del No-People ({noPeopleUploadsCount})</span>
                      </button>
                       <button onClick={nukeWorkspace} className="flex flex-col items-center justify-center p-2 bg-red-900/20 hover:bg-red-900/40 border border-red-500/20 rounded text-[10px] text-red-300 transition-colors gap-1 col-span-2">
                          <AlertTriangle size={14} className="text-red-500"/>
                          <span>NUKE ALL</span>
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                      {allQueues.map(q => {
                          const enabled = isQueueOptionEnabled(q.id);
                          const isSelected = activeQueueId === q.id;
                          
                          // Pause Logic for Queues
                          const qQueue = queue.filter(item => item.taskType === q.id);
                          const pendingQ = qQueue.filter(item => item.status === ProcessingStatus.PENDING);
                          const isQPaused = pendingQ.length > 0 && pendingQ.every(item => item.isPaused);
                          const hasPendingQ = pendingQ.length > 0;

                          return (
                            <div 
                                key={q.id} 
                                onClick={() => handleQueueClick(q.id)}
                                className={`border rounded p-2 flex items-center gap-2 cursor-pointer transition-all ${
                                    isSelected 
                                    ? 'bg-green-600/20 border-green-500 ring-1 ring-green-500/50' 
                                    : 'bg-black/20 border-white/5 hover:bg-white/5'
                                }`}
                            >
                                {q.isConfigurable && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); toggleQueueOption(q.id); }}
                                      className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${enabled ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600 text-transparent'}`}
                                    >
                                        <CheckSquare size={10} />
                                    </button>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className={`text-xs font-bold truncate flex items-center gap-1 ${enabled ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                                        {isQPaused && <Pause size={10} className="text-amber-500" fill="currentColor"/>}
                                        {q.label}
                                    </div>
                                    <div className="flex gap-2 text-[10px] font-mono text-slate-500">
                                        <span>{q.count} Total</span>
                                        {q.active > 0 && <span className="text-blue-400">{q.active} Act</span>}
                                        {/* Cumulative Error Display */}
                                        {q.error > 0 && <span className="text-red-400">{q.error} Err</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    {/* Pause Style Button */}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); togglePause(item => item.taskType === q.id, !isQPaused); }} 
                                        className={`p-0.5 rounded hover:bg-white/20 ${isQPaused ? 'text-amber-400' : 'text-slate-400 hover:text-white'}`}
                                        title={isQPaused ? "Resume Queue" : "Pause Queue"}
                                        disabled={!hasPendingQ && !isQPaused}
                                    >
                                        {isQPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
                                    </button>

                                    <button 
                                        onClick={(e) => { e.stopPropagation(); adjustPriority(i => i.taskType === q.id, 5); }} 
                                        className="p-0.5 hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 rounded"
                                    >
                                        <ChevronUp size={12} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); adjustPriority(i => i.taskType === q.id, -5); }} 
                                        className="p-0.5 hover:bg-amber-500/20 text-slate-500 hover:text-amber-400 rounded"
                                    >
                                        <ChevronDown size={12} />
                                    </button>
                                </div>
                            </div>
                          );
                      })}
                  </div>
              </div>
          )}

          {/* Sidebar Footer Actions */}
          <div className="p-2 border-t border-white/5 grid grid-cols-2 gap-2 shrink-0">
               <button 
                  onClick={retryFailedJobs}
                  disabled={failedJobsCount === 0}
                  className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold text-slate-300 flex items-center justify-center gap-1"
               >
                   <RefreshCw size={12} /> Retry All ({failedJobsCount})
               </button>
               <button 
                  onClick={deleteFailedJobs}
                  disabled={failedJobsCount === 0}
                  className="p-2 bg-slate-800 hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold text-slate-300 flex items-center justify-center gap-1"
               >
                   <Trash2 size={12} /> Clear Err ({failedJobsCount})
               </button>
          </div>
      </div>

      {/* --- MAIN GALLERY (SPLIT VIEW RESTRUCTURED) --- */}
      <div 
        className="fixed top-[7.5rem] bottom-0 right-0 overflow-y-auto bg-cover bg-center bg-fixed flex flex-col"
        style={{ 
            left: sidebarWidth,
            backgroundImage: (queue.length === 0 && uploads.length === 0) ? `url(${EMPTY_GALLERY_BACKGROUND})` : 'none' 
        }}
      >
          {(queue.length === 0 && uploads.length === 0) && (
              <div className="flex flex-col items-center justify-center h-full">
                  <div className="bg-black/80 backdrop-blur border border-white/10 p-8 rounded-2xl text-center max-w-md">
                      <ImageIcon className="w-16 h-16 text-indigo-500 mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-bold text-white mb-2">Workspace Empty</h3>
                      <p className="text-slate-400 text-sm mb-6">Upload an image to start generating line art. Ensure you have selected a valid API key.</p>
                      <button onClick={() => (document.querySelector('input[type=file]') as HTMLElement)?.click()} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors">Upload Image</button>
                  </div>
              </div>
          )}

          {/* AREA 1: DOWNLOADED RESULTS (All Success Jobs) */}
          {downloadedJobs.length > 0 && (
              <div className="flex-none p-4 border-b border-white/10 bg-[#1e1c2e]/50 backdrop-blur-sm">
                   <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                       <ImageIcon className="text-emerald-400" size={20} />
                       Library (Downloaded)
                       <span className="text-xs font-mono text-slate-400 ml-2 bg-black/30 px-2 py-0.5 rounded">{downloadedJobs.length} Items</span>
                   </h2>
                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                       {downloadedJobs.map(renderItem)}
                   </div>
              </div>
          )}

          {/* AREA 2: WORKSPACE (Pending/Processing/Failed) */}
          {workspaceJobs.length > 0 && (
              <div className="flex-1 p-4 bg-[#1e1c2e]/20">
                  <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                       <Loader2 className="text-blue-400" size={20} />
                       Workspace (Active Queue)
                       <span className="text-xs font-mono text-slate-400 ml-2 bg-black/30 px-2 py-0.5 rounded">{workspaceJobs.length} Items</span>
                   </h2>
                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-20">
                       {workspaceJobs.map(renderItem)}
                   </div>
              </div>
          )}
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
              hasNext={viewableQueue.indexOf(selectedItem) < viewableQueue.length - 1}
              hasPrev={viewableQueue.indexOf(selectedItem) > 0}
              onNext={() => {
                  const idx = viewableQueue.indexOf(selectedItem);
                  if (viewableQueue[idx + 1]) setSelectedItemId(viewableQueue[idx + 1].id);
              }}
              onPrev={() => {
                  const idx = viewableQueue.indexOf(selectedItem);
                  if (viewableQueue[idx - 1]) setSelectedItemId(viewableQueue[idx - 1].id);
              }}
              onRepeat={() => {
                  // Clone item
                  const newItem: QueueItem = {
                      ...selectedItem,
                      id: crypto.randomUUID(),
                      status: ProcessingStatus.PENDING,
                      result: undefined,
                      timestamp: Date.now(),
                      retryCount: 0,
                      failureCount: 0,
                      prohibitedCount: 0,
                      isPaused: false, // Don't inherit pause on repeat
                      errorHistory: []
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