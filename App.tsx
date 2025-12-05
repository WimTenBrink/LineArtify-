

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
    Upload, X, RefreshCw, Play, Pause, Trash2, Key, Save, FolderOpen, Terminal, Book, 
    ChevronRight, Settings, Image as ImageIcon, Layers, User, AlertTriangle, CheckCircle2, 
    ScanFace, Check, Repeat, RefreshCcw, Wand2, Square, CheckSquare, XCircle, Info,
    ArrowUp, ArrowDown, ArrowUpCircle, ArrowDownCircle, Mountain, Users, UserCheck, 
    ArrowLeft, ArrowRight, Smile, EyeOff, Accessibility, Loader2, Grip, Monitor
} from 'lucide-react';

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

type QueueView = 'UPLOADS' | 'JOBS' | 'FULL' | 'FULL_NUDE' | 'BACKGROUND' | 'COUNTING' | 'RETRY' | 'FAILED' | 'ENDED' | 'MODEL' | 'BACKSIDE' | 'NUDE' | 'NUDE_OPPOSITE' | 'MODEL_FULL' | 'FACE' | 'FACE_LEFT' | 'FACE_RIGHT' | 'NEUTRAL' | 'NEUTRAL_NUDE' | 'ALL_PEOPLE' | 'ALL_PEOPLE_NUDE' | 'UPSCALE';

const PRIORITY_VALUES: Record<PriorityLevel, number> = {
    'Very Low': 1,
    'Low': 2,
    'Normal': 3,
    'High': 4,
    'Very High': 5
};

export default function App() {
  // Data State
  const [uploads, setUploads] = useState<SourceImage[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]); // "The Master Job List"
  
  // App Config State
  const [options, setOptions] = useState<AppOptions>({
    taskTypes: {
      full: true,
      fullNude: true, // New
      background: true,
      allPeople: true,
      allPeopleNude: true,
      model: true,
      backside: true,
      nude: true,
      nudeOpposite: true,
      modelFull: true,
      face: true,
      faceLeft: true,
      faceRight: true,
      neutral: true,
      neutralNude: true,
      upscale: false
    },
    taskPriorities: {
        full: 'Normal',
        fullNude: 'Normal', // New
        background: 'Normal',
        allPeople: 'Normal',
        allPeopleNude: 'Normal',
        model: 'Normal',
        backside: 'Normal',
        nude: 'Normal',
        nudeOpposite: 'Normal',
        modelFull: 'Normal',
        face: 'Normal',
        faceLeft: 'Normal',
        faceRight: 'Normal',
        neutral: 'Normal',
        neutralNude: 'Normal',
        upscale: 'Normal'
    },
    gender: 'As-is',
    detailLevel: 'Medium'
  });

  // UI State
  const [activeQueueView, setActiveQueueView] = useState<QueueView>('UPLOADS');
  const [isGalleryFilteredByQueue, setIsGalleryFilteredByQueue] = useState(false);
  const [viewerItemId, setViewerItemId] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [thumbnailSize, setThumbnailSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showFinishedUploads, setShowFinishedUploads] = useState(false); // Toggle for finished uploads

  // Tooltip State
  const [hoveredButton, setHoveredButton] = useState<{id: string, rect: DOMRect} | null>(null);

  // Loading States for Buttons
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isKeyLoading, setIsKeyLoading] = useState(false);
  const [upscalingIds, setUpscalingIds] = useState<Set<string>>(new Set());

  // Gallery Sort State
  const [gallerySortBy, setGallerySortBy] = useState<'queue' | 'filename' | 'timestamp'>('queue');
  const [gallerySortOrder, setGallerySortOrder] = useState<'asc' | 'desc'>('asc');
  const galleryRef = useRef<HTMLDivElement>(null);

  // Persistence Debounce Ref
  // Using 'any' to avoid cross-environment type issues (NodeJS.Timeout vs number)
  const saveTimeoutRef = useRef<any>(null);

  // Queue Control State
  const [queueControls, setQueueControls] = useState({
    global: false,
    full: true,
    fullNude: true, // New
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
    faceLeft: true,
    faceRight: true,
    neutral: true,
    neutralNude: true,
    upscale: true
  });

  const { addLog } = useLogger();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INITIALIZATION (Load DB) ---
  useEffect(() => {
    const init = async () => {
        const state = await loadWorkspace();
        if (state) {
            setUploads(state.uploads);
            setQueue(state.queue);
            // Merge options to ensure new fields like taskPriorities exist
            setOptions(prev => ({
                ...prev,
                ...state.options,
                taskPriorities: { ...prev.taskPriorities, ...state.options.taskPriorities }
            }));
            addLog(LogLevel.INFO, "Restored previous workspace from local database.");
        }
    };
    init();
  }, [addLog]);

  // --- PERSISTENCE (Save DB) ---
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    // Debounce save to avoid hammering IDB
    saveTimeoutRef.current = setTimeout(() => {
        if (uploads.length > 0 || queue.length > 0) {
            saveWorkspace(uploads, queue, options);
        }
    }, 2000);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [uploads, queue, options]);

  // Reset gallery queue filter when view changes
  useEffect(() => {
    setIsGalleryFilteredByQueue(false);
  }, [activeQueueView]);

  // --- Derived Data ---

  const processingJobs = queue.filter(i => i.status === ProcessingStatus.PROCESSING);
  
  // Helper to filter queue items
  const getQueueItems = (type: QueueView): QueueItem[] => {
    switch (type) {
      case 'JOBS': return processingJobs;
      case 'FULL': return queue.filter(i => i.taskType === 'full' && i.status === ProcessingStatus.PENDING);
      case 'FULL_NUDE': return queue.filter(i => i.taskType === 'full-nude' && i.status === ProcessingStatus.PENDING);
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
      case 'FACE_LEFT': return queue.filter(i => i.taskType === 'face-left' && i.status === ProcessingStatus.PENDING);
      case 'FACE_RIGHT': return queue.filter(i => i.taskType === 'face-right' && i.status === ProcessingStatus.PENDING);
      case 'NEUTRAL': return queue.filter(i => i.taskType === 'neutral' && i.status === ProcessingStatus.PENDING);
      case 'NEUTRAL_NUDE': return queue.filter(i => i.taskType === 'neutral-nude' && i.status === ProcessingStatus.PENDING);
      case 'UPSCALE': return queue.filter(i => i.taskType === 'upscale' && i.status === ProcessingStatus.PENDING);
      case 'RETRY': return queue.filter(i => i.status === ProcessingStatus.ERROR && !i.isBlocked && i.retryCount < 3);
      case 'FAILED': return queue.filter(i => i.status === ProcessingStatus.ERROR && (i.isBlocked || (i.retryCount >= 3 && i.isLastChance)));
      case 'ENDED': return queue.filter(i => i.status === ProcessingStatus.ENDED);
      default: return [];
    }
  };

  const getQueueCount = (type: QueueView): number => {
      if (type === 'UPLOADS') return uploads.length;
      return getQueueItems(type).length;
  };

  // Gallery Logic
  const allSuccessItems = queue.filter(i => i.status === ProcessingStatus.SUCCESS && i.taskType !== 'scan-people');
  
  let galleryItems = allSuccessItems;

  // 0. Check if current queue has generated images (for filter visibility)
  const typeMap: Record<string, TaskType> = {
      'FULL': 'full', 'FULL_NUDE': 'full-nude', 'BACKGROUND': 'background', 'ALL_PEOPLE': 'all-people', 'ALL_PEOPLE_NUDE': 'all-people-nude',
      'MODEL': 'model', 'BACKSIDE': 'backside', 'NUDE': 'nude', 'NUDE_OPPOSITE': 'nude-opposite',
      'MODEL_FULL': 'model-full', 'FACE': 'face', 'FACE_LEFT': 'face-left', 'FACE_RIGHT': 'face-right', 
      'NEUTRAL': 'neutral', 'NEUTRAL_NUDE': 'neutral-nude', 'UPSCALE': 'upscale'
  };
  const currentViewTaskType = typeMap[activeQueueView];

  const currentQueueGeneratedItems = allSuccessItems.filter(i => currentViewTaskType && i.taskType === currentViewTaskType);
  const showQueueFilter = currentQueueGeneratedItems.length > 0;

  // 1. Filter by Queue View if enabled
  if (isGalleryFilteredByQueue && showQueueFilter) {
      galleryItems = currentQueueGeneratedItems;
  }

  // 2. Filter by Selected Sources
  if (selectedSourceIds.size > 0) {
      galleryItems = galleryItems.filter(i => selectedSourceIds.has(i.sourceId));
  }

  // 3. Sort Gallery
  galleryItems.sort((a, b) => {
      // Priority: Highlighting Active Queue
      // If item belongs to current active queue view, it goes to TOP (-1)
      const aIsActive = currentViewTaskType && a.taskType === currentViewTaskType;
      const bIsActive = currentViewTaskType && b.taskType === currentViewTaskType;
      
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      let comparison = 0;
      switch (gallerySortBy) {
          case 'queue':
              comparison = a.taskType.localeCompare(b.taskType);
              break;
          case 'filename':
              // If sorting by filename, sort by filename THEN queue type to group them nicely
              comparison = a.file.name.localeCompare(b.file.name);
              if (comparison === 0) comparison = a.taskType.localeCompare(b.taskType);
              break;
          case 'timestamp':
              comparison = a.timestamp - b.timestamp;
              break;
      }
      
      // Secondary sort by filename usually good for stability
      if (comparison === 0) comparison = a.file.name.localeCompare(b.file.name);

      return gallerySortOrder === 'asc' ? comparison : -comparison;
  });

  // Calculate Viewer Navigation
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

  // Progress Calculation
  const totalJobs = queue.length;
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
    const currentOptionsSnapshot = JSON.parse(JSON.stringify(options));

    Array.from(files).filter(f => f.type.startsWith('image/')).forEach(file => {
       // Duplicate Check: Don't add if filename exists in uploads
       if (uploads.some(u => u.file.name === file.name)) return;

       const id = crypto.randomUUID();
       newUploads.push({
         id,
         file,
         thumbnailUrl: URL.createObjectURL(file),
         timestamp: Date.now(),
         options: currentOptionsSnapshot
       });
    });

    if (newUploads.length > 0) {
      setUploads(prev => [...prev, ...newUploads]);
      addLog(LogLevel.INFO, `Uploaded ${newUploads.length} images.`);
      populateQueues(newUploads);
    } else {
      addLog(LogLevel.INFO, "No new images uploaded (duplicates ignored).");
    }
  }, [options, addLog, uploads]);

  const populateQueues = (sources: SourceImage[]) => {
    const newJobs: QueueItem[] = [];
    sources.forEach(source => {
      const srcOpts = source.options;
      if (srcOpts.taskTypes.full) newJobs.push(createJob(source, 'full'));
      if (srcOpts.taskTypes.fullNude) newJobs.push(createJob(source, 'full-nude'));
      if (srcOpts.taskTypes.background) newJobs.push(createJob(source, 'background'));
      newJobs.push(createJob(source, 'scan-people')); // Scanning is a job
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

    // Clean up associated jobs
    const jobs = queue.filter(j => j.sourceId === id);
    jobs.forEach(j => cleanupUrl(j.result?.url));

    setUploads(prev => prev.filter(u => u.id !== id));
    setQueue(prev => prev.filter(j => j.sourceId !== id));
    addLog(LogLevel.INFO, `Deleted source image ${id} and related jobs.`);
  };

  const handleRemoveFinishedUploads = () => {
      const idsToRemove: string[] = [];
      
      uploads.forEach(u => {
          const jobs = queue.filter(j => j.sourceId === u.id);
          if (jobs.length === 0) return; // Ignore if no jobs (shouldn't happen)
          
          const allDone = jobs.every(j => 
              j.status === ProcessingStatus.SUCCESS || 
              j.status === ProcessingStatus.ENDED || 
              (j.status === ProcessingStatus.ERROR && (j.isBlocked || j.retryCount >= j.maxRetries))
          );
          
          if (allDone) {
              idsToRemove.push(u.id);
          }
      });

      if (idsToRemove.length > 0) {
          idsToRemove.forEach(id => deleteUpload(id));
          addLog(LogLevel.INFO, `Removed ${idsToRemove.length} finished uploads.`);
      } else {
          addLog(LogLevel.INFO, "No finished uploads found to remove.");
      }
  };

  const deleteJob = (id: string) => {
    const job = queue.find(j => j.id === id);
    if (job) cleanupUrl(job.result?.url);
    setQueue(prev => prev.filter(j => j.id !== id));
  };

  const handleDeleteAllInQueue = (view: QueueView) => {
     let itemsToDelete: QueueItem[] = [];

     if (view === 'UPLOADS') {
         // Special case: Delete everything
         uploads.forEach(u => deleteUpload(u.id));
         return;
     } else if (view === 'JOBS') {
         // No logic for deleting active jobs broadly, safe to skip or just cancel
         // But maybe delete all PROCESSING?
         itemsToDelete = queue.filter(i => i.status === ProcessingStatus.PROCESSING);
     } else if (view === 'RETRY') {
         itemsToDelete = queue.filter(i => i.status === ProcessingStatus.ERROR && !i.isBlocked && i.retryCount < 3);
     } else if (view === 'FAILED') {
         itemsToDelete = queue.filter(i => i.status === ProcessingStatus.ERROR && (i.isBlocked || (i.retryCount >= 3 && i.isLastChance)));
     } else if (view === 'ENDED') {
         itemsToDelete = queue.filter(i => i.status === ProcessingStatus.ENDED);
     } else {
         // It's a TaskType view
         const type = typeMap[view];
         if (type) {
             itemsToDelete = queue.filter(i => i.taskType === type && i.status === ProcessingStatus.PENDING);
         }
     }
     
     itemsToDelete.forEach(job => {
         cleanupUrl(job.result?.url);
     });
     
     // Bulk update state for performance
     const idsToDelete = new Set(itemsToDelete.map(j => j.id));
     setQueue(prev => prev.filter(j => !idsToDelete.has(j.id)));
     addLog(LogLevel.INFO, `Bulk deleted ${itemsToDelete.length} items from ${view}`);
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
        isLastChance: false
    };
    setQueue(prev => [...prev, newJob]);
    addLog(LogLevel.INFO, `Repeated job for ${item.file.name} (${item.taskType})`);
  };

  const handleUpscale = async (item: QueueItem) => {
      if (!item.result?.url) return;
      setUpscalingIds(prev => { const next = new Set(prev); next.add(item.id); return next; });
      try {
          await spawnUpscaleJob(item, item.result.url);
      } finally {
          setUpscalingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
      }
  };

  const spawnUpscaleJob = async (parentItem: QueueItem, url: string) => {
    try {
          const res = await fetch(url);
          const blob = await res.blob();
          const file = new File([blob], `source-for-upscale.png`, { type: 'image/png' });

          const newJob: QueueItem = {
              id: crypto.randomUUID(),
              sourceId: parentItem.sourceId,
              file: file,
              taskType: 'upscale',
              thumbnailUrl: url,
              status: ProcessingStatus.PENDING,
              timestamp: Date.now(),
              retryCount: 0,
              maxRetries: 3,
              errorHistory: [],
              personDescription: parentItem.personDescription
          };
          setQueue(prev => [...prev, newJob]);
          addLog(LogLevel.INFO, `Created Upscale job for ${parentItem.file.name}`);
      } catch (e) {
          addLog(LogLevel.ERROR, "Failed to create upscale job", e);
      }
  };

  const downloadImage = (url: string, filename: string) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- Processing Loop ---

  useEffect(() => {
    if (!queueControls.global) return;

    const runProcessor = async () => {
        // Enforce Global Max Concurrency
        if (processingJobs.length >= MAX_CONCURRENT_REQUESTS) return;

        // ENFORCE "ONE JOB PER QUEUE" RULE
        // Get set of TaskTypes currently processing
        // Note: 'scan-people' is a task type too.
        const activeTaskTypes = new Set(processingJobs.map(j => j.taskType));

        let candidate: QueueItem | undefined;

        // Helper to check if queue is enabled, has pending items, AND is not currently processing
        const findInQueue = (type: TaskType, controlKey: keyof typeof queueControls) => {
            if (!queueControls[controlKey]) return undefined;
            if (activeTaskTypes.has(type)) return undefined; // Skip if this queue is busy
            return queue.find(i => i.taskType === type && i.status === ProcessingStatus.PENDING);
        };

        // PRIORITY QUEUE LOGIC
        // Scan is always highest priority to unblock other tasks
        candidate = findInQueue('scan-people', 'counting');

        if (!candidate) {
            // Map queues to their current Priority Score
            const queueMap: Array<{ type: TaskType, control: keyof typeof queueControls, optionKey: keyof AppOptions['taskPriorities'] }> = [
                { type: 'upscale', control: 'upscale', optionKey: 'upscale' },
                { type: 'all-people', control: 'allPeople', optionKey: 'allPeople' },
                { type: 'all-people-nude', control: 'allPeopleNude', optionKey: 'allPeopleNude' },
                { type: 'face', control: 'face', optionKey: 'face' },
                { type: 'face-left', control: 'faceLeft', optionKey: 'faceLeft' },
                { type: 'face-right', control: 'faceRight', optionKey: 'faceRight' },
                { type: 'model', control: 'model', optionKey: 'model' },
                { type: 'neutral', control: 'neutral', optionKey: 'neutral' },
                { type: 'neutral-nude', control: 'neutralNude', optionKey: 'neutralNude' },
                { type: 'nude', control: 'nude', optionKey: 'nude' },
                { type: 'nude-opposite', control: 'nudeOpposite', optionKey: 'nudeOpposite' },
                { type: 'backside', control: 'backside', optionKey: 'backside' },
                { type: 'model-full', control: 'modelFull', optionKey: 'modelFull' },
                { type: 'full', control: 'full', optionKey: 'full' },
                { type: 'full-nude', control: 'fullNude', optionKey: 'fullNude' },
                { type: 'background', control: 'background', optionKey: 'background' }
            ];

            // Sort Queues by Priority (High to Low)
            const sortedQueues = queueMap.sort((a, b) => {
                const priorityA = PRIORITY_VALUES[options.taskPriorities[a.optionKey]] || 3;
                const priorityB = PRIORITY_VALUES[options.taskPriorities[b.optionKey]] || 3;
                return priorityB - priorityA; // Descending
            });

            // Iterate sorted queues to find work
            for (const q of sortedQueues) {
                candidate = findInQueue(q.type, q.control);
                if (candidate) break;
            }
        }

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
            const source = uploads.find(u => u.id === job.sourceId);
            const jobOptions = source?.options || options; 

            if (job.taskType === 'scan-people') {
                await handleScanning(job, apiKey, jobOptions);
            } else {
                await handleGeneration(job, apiKey, jobOptions);
            }
        } catch (error: any) {
             const isSafety = error.message?.includes("Content Policy") || error.message?.includes("Safety");
             handleJobError(job, error.message || "Unknown error", isSafety);
        }
    };

    const interval = setInterval(runProcessor, 1000);
    return () => clearInterval(interval);
  }, [queue, queueControls, processingJobs.length, options, uploads]);

  const handleJobError = (job: QueueItem, message: string, isSafety: boolean) => {
      addLog(LogLevel.WARN, `Job Failed: ${message}`);
      setQueue(prev => prev.map(i => {
          if (i.id !== job.id) return i;
          const newRetryCount = i.retryCount + 1;
          if (i.isLastChance) {
               return { ...i, status: ProcessingStatus.ENDED, errorMessage: message, retryCount: newRetryCount };
          }
          const isFailedQueue = isSafety || (newRetryCount >= i.maxRetries);
          return {
              ...i,
              status: ProcessingStatus.ERROR,
              errorMessage: message,
              retryCount: newRetryCount,
              isBlocked: isSafety,
              isLastChance: isFailedQueue
          };
      }));
  };

  const handleScanning = async (job: QueueItem, apiKey: string, jobOptions: AppOptions) => {
      addLog(LogLevel.INFO, `Scanning ${job.file.name}...`);
      const people = await detectPeople(job.file, apiKey, addLog, jobOptions.gender);
      setQueue(prev => prev.map(i => i.id === job.id ? { ...i, status: ProcessingStatus.SUCCESS } : i));

      const newJobs: QueueItem[] = [];
      const source = uploads.find(u => u.id === job.sourceId)!;
      const create = (type: TaskType, description?: string, box?: number[]) => createJob(source, type, description, box);

      if (people.length > 1) {
          if (jobOptions.taskTypes.allPeople) newJobs.push(create('all-people'));
          if (jobOptions.taskTypes.allPeopleNude) newJobs.push(create('all-people-nude'));
      }
      people.forEach(p => {
          if (jobOptions.taskTypes.face) newJobs.push(create('face', p.description, p.box_2d));
          if (jobOptions.taskTypes.faceLeft) newJobs.push(create('face-left', p.description, p.box_2d));
          if (jobOptions.taskTypes.faceRight) newJobs.push(create('face-right', p.description, p.box_2d));
          if (jobOptions.taskTypes.model) newJobs.push(create('model', p.description, p.box_2d));
          if (jobOptions.taskTypes.neutral) newJobs.push(create('neutral', p.description, p.box_2d));
          if (jobOptions.taskTypes.neutralNude) newJobs.push(create('neutral-nude', p.description, p.box_2d));
          if (jobOptions.taskTypes.backside) newJobs.push(create('backside', p.description, p.box_2d));
          if (jobOptions.taskTypes.nude) newJobs.push(create('nude', p.description, p.box_2d));
          if (jobOptions.taskTypes.nudeOpposite) newJobs.push(create('nude-opposite', p.description, p.box_2d));
          if (jobOptions.taskTypes.modelFull) newJobs.push(create('model-full', p.description, p.box_2d));
      });

      if (newJobs.length > 0) {
          addLog(LogLevel.INFO, `Spawned ${newJobs.length} tasks from scan.`);
          setQueue(prev => [...prev, ...newJobs]);
      }
  };

  const handleGeneration = async (job: QueueItem, apiKey: string, jobOptions: AppOptions) => {
      // Use "Update 4K" option to trigger 4K mode for this generation
      const use4k = jobOptions.taskTypes.upscale; 

      const res = await generateLineArtTask(
          job.file,
          apiKey,
          job.taskType,
          jobOptions.gender,
          jobOptions.detailLevel,
          addLog,
          undefined,
          job.personDescription,
          use4k
      );

      setQueue(prev => prev.map(i => i.id === job.id ? { 
          ...i, 
          status: ProcessingStatus.SUCCESS, 
          result: res,
          timestamp: Date.now() // Update completion time
      } : i));

      // AUTO DOWNLOAD
      // Corrected Filename: QueueName-OriginalFile.png
      const originalName = job.file.name.replace(/\.[^/.]+$/, ""); // Strip extension
      const filename = `${job.taskType}-${originalName}.png`;
      downloadImage(res.url, filename);

      // We removed the separate upscale spawning because "Upscale" option now triggers 4K natively.
      // But we leave the manual upscale task logic intact if user requested 'upscale' task explicitly via other means.
  };

  // --- Handlers ---
  const handleRetryAll = () => setQueue(prev => prev.map(i => i.status === ProcessingStatus.ERROR && !i.isBlocked && i.retryCount < 3 ? { ...i, status: ProcessingStatus.PENDING } : i));
  const handleRetryFailedQueue = () => setQueue(prev => prev.map(i => i.status === ProcessingStatus.ERROR && (i.isBlocked || (i.retryCount >= 3 && i.isLastChance)) ? { ...i, status: ProcessingStatus.PENDING } : i));
  const handleDeleteFailedQueue = () => handleDeleteAllInQueue('FAILED');
  const handleDeleteEndedQueue = () => handleDeleteAllInQueue('ENDED');
  const handleRemoveAllRetry = () => handleDeleteAllInQueue('RETRY');
  const handleRetryFailedItem = (id: string) => setQueue(prev => prev.map(i => i.id === id ? { ...i, status: ProcessingStatus.PENDING } : i));
  
  const handleExport = async () => {
      setIsExporting(true);
      // Give UI a chance to render spinner
      await new Promise(resolve => setTimeout(resolve, 0));
      try {
        const exportData = { uploads: await Promise.all(uploads.map(async u => ({...u, data: await blobToBase64(u.file)}))), options };
        const blob = new Blob([JSON.stringify(exportData)], {type: 'application/json'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lineartify_backup.json'; a.click();
      } catch(e) {
          addLog(LogLevel.ERROR, "Export failed", e);
      } finally {
          setIsExporting(false);
      }
  };
  
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      setIsImporting(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const data = JSON.parse(ev.target?.result as string);
              if (data.options) {
                  // Merge options carefully to keep new fields
                  setOptions(prev => ({
                      ...prev,
                      ...data.options,
                      taskPriorities: { ...prev.taskPriorities, ...(data.options.taskPriorities || {}) }
                  }));
              }
              if (data.uploads) {
                  const newUploads = await Promise.all(data.uploads.map(async (u: any) => {
                      const res = await fetch(u.data);
                      const blob = await res.blob();
                      const file = new File([blob], u.file.name, { type: u.file.type });
                      return { ...u, file, thumbnailUrl: URL.createObjectURL(file), options: u.options || options };
                  }));
                  // Filter out existing by filename during import too
                  const uniqueUploads = newUploads.filter(nu => !uploads.some(u => u.file.name === nu.file.name));
                  setUploads(prev => [...prev, ...uniqueUploads]);
                  populateQueues(uniqueUploads);
              }
          } catch(err) { console.error(err); }
          finally { 
              setIsImporting(false);
              // Reset input so same file can be selected again
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.onerror = () => setIsImporting(false);
      reader.readAsText(file);
  };
  
  const handleApiKeyChange = async () => { 
      setIsKeyLoading(true);
      try {
        if ((window as any).aistudio?.openSelectKey) await (window as any).aistudio.openSelectKey(); 
      } finally {
        setIsKeyLoading(false);
      }
  };
  
  const toggleQueueControl = (key: keyof typeof queueControls) => setQueueControls(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleSourceSelection = (sourceId: string) => setSelectedSourceIds(prev => { const next = new Set(prev); if (next.has(sourceId)) next.delete(sourceId); else next.add(sourceId); return next; });
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files); };
  const shouldHighlight = (taskType: TaskType) => {
      return currentViewTaskType === taskType;
  };
  const getSourceStatus = (sourceId: string) => {
      const jobs = queue.filter(j => j.sourceId === sourceId);
      if (jobs.length === 0) return 'empty';
      const allDone = jobs.every(j => j.status === ProcessingStatus.SUCCESS || j.status === ProcessingStatus.ENDED || (j.status === ProcessingStatus.ERROR && (j.isBlocked || j.retryCount >= j.maxRetries)));
      return allDone ? 'done' : 'processing';
  };
  const getProcessingJobsForSource = (sourceId: string) => queue.filter(j => j.sourceId === sourceId && j.status === ProcessingStatus.PROCESSING);
  
  // Filtering Uploads for Display
  const sortedUploads = [...uploads]
    .filter(u => {
        if (!showFinishedUploads) return true; // Show all if filter is off? Or interpretation of request is "Show finished SO IT ONLY SHOWS uploads that are finished" -> Means if ON, show only finished.
        const status = getSourceStatus(u.id);
        return status === 'done';
    })
    .sort((a, b) => {
      const aP = getProcessingJobsForSource(a.id).length > 0;
      const bP = getProcessingJobsForSource(b.id).length > 0;
      if (aP && !bP) return -1;
      if (!aP && bP) return 1;
      return a.file.name.localeCompare(b.file.name);
  });
  
  // HELPER: Queue Icons & Descriptions
  const queueViews: { id: QueueView, label: string, icon: any, description: string }[] = [
    { id: 'UPLOADS', label: `Uploads`, icon: Upload, description: "Manage source images and view scan progress" },
    { id: 'JOBS', label: `Jobs`, icon: RefreshCw, description: "View all currently running generation tasks" },
    { id: 'COUNTING', label: 'Scanner', icon: ScanFace, description: "AI analysis to detect people and crop targets" },
    { id: 'FULL', label: 'Full Scene', icon: ImageIcon, description: "Generate line art for the entire image including background" },
    { id: 'FULL_NUDE', label: 'Full Scene (Nude)', icon: EyeOff, description: "Full scene line art with all people as nude anatomical figures" },
    { id: 'BACKGROUND', label: 'Background', icon: Mountain, description: "Remove characters to create a clean environment layout" },
    { id: 'ALL_PEOPLE', label: 'Group', icon: Users, description: "Extract all characters as a single group composition" },
    { id: 'ALL_PEOPLE_NUDE', label: 'Group Nude', icon: Users, description: "Extract all characters as an anatomical group study" },
    { id: 'MODEL', label: 'Character', icon: User, description: "Isolate individual character on white background" },
    { id: 'MODEL_FULL', label: 'Body Recon', icon: UserCheck, description: "Reconstruct missing limbs for full body character art" },
    { id: 'FACE', label: 'Portrait', icon: Smile, description: "Strict frontal view face portrait" },
    { id: 'FACE_LEFT', label: 'Face Left', icon: ArrowLeft, description: "Left profile view portrait" },
    { id: 'FACE_RIGHT', label: 'Face Right', icon: ArrowRight, description: "Right profile view portrait" },
    { id: 'NEUTRAL', label: 'Neutral', icon: Accessibility, description: "Reconstruct character in a neutral A-pose with clothes" },
    { id: 'NEUTRAL_NUDE', label: 'Neutral Nude', icon: Accessibility, description: "Reconstruct character in a neutral A-pose without clothes" },
    { id: 'BACKSIDE', label: 'Backside', icon: Repeat, description: "Generate the reverse (180°) angle of the character" },
    { id: 'NUDE', label: 'Nude', icon: EyeOff, description: "Anatomical figure study (Mannequin/Base Mesh style)" },
    { id: 'NUDE_OPPOSITE', label: 'Nude Oppo', icon: EyeOff, description: "Reverse angle anatomical figure study" },
    { id: 'UPSCALE', label: 'Upscale', icon: Wand2, description: "Enhance resolution to 4K using Gemini 3 Pro" },
    { id: 'RETRY', label: 'Retry', icon: RefreshCcw, description: "Jobs that failed with temporary errors" },
    { id: 'FAILED', label: 'Failed', icon: AlertTriangle, description: "Jobs that failed permanently or were blocked" },
    { id: 'ENDED', label: 'Ended', icon: XCircle, description: "Jobs manually cancelled or stopped" }
  ];

  const scrollToGallery = (direction: 'top' | 'bottom') => {
      if (galleryRef.current) {
          galleryRef.current.scrollTo({
              top: direction === 'top' ? 0 : galleryRef.current.scrollHeight,
              behavior: 'smooth'
          });
      }
  };

  const getQueueLabel = (id: QueueView) => queueViews.find(q => q.id === id)?.label || id;
  
  // Dynamic Grid Class based on Thumbnail Size
  const gridClass = {
      'small': 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]',
      'medium': 'grid-cols-[repeat(auto-fill,minmax(350px,1fr))]',
      'large': 'grid-cols-[repeat(auto-fill,minmax(500px,1fr))]'
  }[thumbnailSize];

  return (
    <div 
        className="flex flex-col h-screen w-screen bg-[#0f0f16] text-slate-200 font-sans overflow-hidden relative"
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      {isDragging && (
          <div className="absolute inset-0 z-[100] bg-indigo-500/20 backdrop-blur-sm border-4 border-indigo-500 border-dashed flex items-center justify-center pointer-events-none">
              <div className="text-4xl font-bold text-white drop-shadow-lg">Drop images to upload</div>
          </div>
      )}

      {/* --- HEADER --- */}
      <header className="flex-none h-14 bg-[#181825] border-b border-white/5 flex items-center justify-between px-4 z-50">
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center"><ImageIcon className="text-white w-5 h-5" /></div>
                <h1 className="font-bold text-lg tracking-tight">LineArtify</h1>
            </div>
            {totalJobs > 0 && (
                <div className="flex items-center space-x-3 bg-slate-800/50 px-3 py-1.5 rounded-full border border-white/5">
                    <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <span className="text-xs font-mono text-slate-400">{completedJobs} / {totalJobs} jobs</span>
                </div>
            )}
        </div>
        <div className="flex items-center space-x-2">
            <div className="bg-slate-800 rounded flex items-center border border-white/5 mr-2">
                <button onClick={() => setThumbnailSize('small')} className={`p-1.5 rounded-l ${thumbnailSize === 'small' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Small Thumbnails"><Grip size={14} /></button>
                <div className="w-px h-4 bg-white/10"></div>
                <button onClick={() => setThumbnailSize('medium')} className={`p-1.5 ${thumbnailSize === 'medium' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Medium Thumbnails"><Grip size={16} /></button>
                <div className="w-px h-4 bg-white/10"></div>
                <button onClick={() => setThumbnailSize('large')} className={`p-1.5 rounded-r ${thumbnailSize === 'large' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Large Thumbnails"><Monitor size={16} /></button>
            </div>

            <button onClick={() => setIsOptionsOpen(true)} className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors border border-white/5"><Settings size={16} /> <span>Options</span></button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={() => toggleQueueControl('global')} className={`flex items-center space-x-2 px-4 py-1.5 rounded text-sm font-bold transition-all ${queueControls.global ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                {queueControls.global ? <><Pause size={16} fill="currentColor" /><span>Stop</span></> : <><Play size={16} fill="currentColor" /><span>Start</span></>}
            </button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            
            {/* Save (Export) Button */}
            <button onClick={handleExport} disabled={isExporting} className="p-2 hover:bg-white/10 rounded text-slate-400 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-wait">
                {isExporting ? <Loader2 size={18} className="animate-spin text-indigo-400" /> : <Save size={18} />}
                <span className="text-xs">Save</span>
            </button>
            
            {/* Load (Import) Button */}
            <button onClick={() => !isImporting && fileInputRef.current?.click()} disabled={isImporting} className="p-2 hover:bg-white/10 rounded text-slate-400 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-wait">
                {isImporting ? <Loader2 size={18} className="animate-spin text-indigo-400" /> : <FolderOpen size={18} />}
                <span className="text-xs">Load</span>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
            
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={() => setIsManualOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400 flex items-center space-x-2"><Book size={18} /><span className="text-xs">Manual</span></button>
            <button onClick={() => setIsConsoleOpen(true)} className="p-2 hover:bg-white/10 rounded text-slate-400 flex items-center space-x-2"><Terminal size={18} /><span className="text-xs">Console</span></button>
            
            {/* API Key Button */}
            <button onClick={handleApiKeyChange} disabled={isKeyLoading} className="p-2 hover:bg-white/10 rounded text-slate-400 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-wait">
                {isKeyLoading ? <Loader2 size={18} className="animate-spin text-indigo-400" /> : <Key size={18} />}
                <span className="text-xs">API Key</span>
            </button>
        </div>
      </header>

      {/* --- BUTTON BAR NAVIGATION --- */}
      <div className="w-full bg-[#1e1e2e] border-b border-white/5 flex items-center px-2 py-2 overflow-x-auto space-x-1 scrollbar-hide flex-none z-40 relative">
        {queueViews.map((view) => {
            const count = getQueueCount(view.id);
            return (
                <button
                    key={view.id}
                    onClick={() => setActiveQueueView(view.id)}
                    onMouseEnter={(e) => setHoveredButton({id: view.id, rect: e.currentTarget.getBoundingClientRect()})}
                    onMouseLeave={() => setHoveredButton(null)}
                    className={`flex-none w-14 h-9 flex items-center justify-center rounded-lg transition-all border relative ${activeQueueView === view.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
                >
                    <view.icon size={18} />
                    <span className="ml-1.5 text-[10px] font-bold">{count}</span>
                </button>
            );
        })}
        {/* Special Tooltip */}
        {hoveredButton && (
            <div 
                className="fixed z-[60] bg-slate-900 border border-slate-600 text-white p-3 rounded-lg shadow-2xl pointer-events-none w-64 animate-in fade-in zoom-in-95 duration-150"
                style={{ top: hoveredButton.rect.bottom + 10, left: Math.min(hoveredButton.rect.left, window.innerWidth - 270) }}
            >
                <div className="font-bold text-sm text-indigo-400 mb-1">{getQueueLabel(hoveredButton.id as QueueView).split('(')[0]}</div>
                <div className="text-xs text-slate-300 leading-relaxed font-sans">{queueViews.find(q => q.id === hoveredButton.id)?.description}</div>
            </div>
        )}
      </div>

      {/* --- MAIN LAYOUT --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* --- LEFT SIDEBAR (20vw) --- */}
        <div className="w-[20vw] flex flex-col bg-[#13131f] border-r border-white/5 relative z-10">
            {/* Sidebar Header */}
            <div className="p-3 border-b border-white/5 bg-slate-800/30 flex items-center justify-between">
                <h2 className="font-bold text-sm text-indigo-400 uppercase tracking-wider truncate">
                    {getQueueLabel(activeQueueView).split('(')[0]}
                </h2>
                <button 
                    onClick={() => {
                        if (window.confirm(`Delete ALL items in ${getQueueLabel(activeQueueView)}?`)) {
                            handleDeleteAllInQueue(activeQueueView);
                        }
                    }} 
                    className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors" 
                    title="Delete All in this Queue"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Queue Controls */}
            <div className="p-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                    {activeQueueView === 'UPLOADS' && (
                        <div className="flex flex-col gap-2 w-full">
                            <div className="w-full flex items-center justify-center p-4 border-2 border-dashed border-white/10 rounded bg-white/5 hover:bg-white/10 cursor-pointer relative transition-colors">
                                <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleUpload(e.target.files)} />
                                <div className="flex items-center space-x-2 text-sm text-slate-400 font-medium"><Upload size={16} /> <span>Add Images / Drag & Drop</span></div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleRemoveFinishedUploads} className="flex-1 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[10px] font-bold uppercase rounded border border-emerald-500/20 flex items-center justify-center gap-2">
                                    <CheckCircle2 size={12} /> Remove Finished
                                </button>
                                <button onClick={() => setShowFinishedUploads(!showFinishedUploads)} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded border flex items-center justify-center gap-2 transition-colors ${showFinishedUploads ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-700 text-slate-400 border-white/5'}`}>
                                    {showFinishedUploads ? <CheckSquare size={12} /> : <Square size={12} />} Finished Only
                                </button>
                            </div>
                        </div>
                    )}

                    {(activeQueueView !== 'UPLOADS' && activeQueueView !== 'JOBS' && activeQueueView !== 'RETRY' && activeQueueView !== 'FAILED' && activeQueueView !== 'ENDED') && (
                        <div className="w-full space-y-2">
                            <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                                <span className="text-xs font-mono uppercase text-slate-400">Queue Active</span>
                                <button 
                                    onClick={() => {
                                        if (activeQueueView === 'FULL') toggleQueueControl('full');
                                        if (activeQueueView === 'FULL_NUDE') toggleQueueControl('fullNude');
                                        if (activeQueueView === 'BACKGROUND') toggleQueueControl('background');
                                        if (activeQueueView === 'ALL_PEOPLE') toggleQueueControl('allPeople');
                                        if (activeQueueView === 'ALL_PEOPLE_NUDE') toggleQueueControl('allPeopleNude');
                                        if (activeQueueView === 'COUNTING') toggleQueueControl('counting');
                                        if (activeQueueView === 'MODEL') toggleQueueControl('model');
                                        if (activeQueueView === 'FACE') toggleQueueControl('face');
                                        if (activeQueueView === 'FACE_LEFT') toggleQueueControl('faceLeft');
                                        if (activeQueueView === 'FACE_RIGHT') toggleQueueControl('faceRight');
                                        if (activeQueueView === 'NEUTRAL') toggleQueueControl('neutral');
                                        if (activeQueueView === 'NEUTRAL_NUDE') toggleQueueControl('neutralNude');
                                        if (activeQueueView === 'BACKSIDE') toggleQueueControl('backside');
                                        if (activeQueueView === 'NUDE') toggleQueueControl('nude');
                                        if (activeQueueView === 'NUDE_OPPOSITE') toggleQueueControl('nudeOpposite');
                                        if (activeQueueView === 'MODEL_FULL') toggleQueueControl('modelFull');
                                        if (activeQueueView === 'UPSCALE') toggleQueueControl('upscale');
                                    }}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${
                                        (activeQueueView === 'FULL' && queueControls.full) || 
                                        (activeQueueView === 'FULL_NUDE' && queueControls.fullNude) || 
                                        (activeQueueView === 'BACKGROUND' && queueControls.background) ||
                                        (activeQueueView === 'ALL_PEOPLE' && queueControls.allPeople) ||
                                        (activeQueueView === 'ALL_PEOPLE_NUDE' && queueControls.allPeopleNude) ||
                                        (activeQueueView === 'COUNTING' && queueControls.counting) ||
                                        (activeQueueView === 'MODEL' && queueControls.model) ||
                                        (activeQueueView === 'FACE' && queueControls.face) ||
                                        (activeQueueView === 'FACE_LEFT' && queueControls.faceLeft) ||
                                        (activeQueueView === 'FACE_RIGHT' && queueControls.faceRight) ||
                                        (activeQueueView === 'NEUTRAL' && queueControls.neutral) ||
                                        (activeQueueView === 'NEUTRAL_NUDE' && queueControls.neutralNude) ||
                                        (activeQueueView === 'BACKSIDE' && queueControls.backside) ||
                                        (activeQueueView === 'NUDE' && queueControls.nude) ||
                                        (activeQueueView === 'NUDE_OPPOSITE' && queueControls.nudeOpposite) ||
                                        (activeQueueView === 'MODEL_FULL' && queueControls.modelFull) ||
                                        (activeQueueView === 'UPSCALE' && queueControls.upscale)
                                        ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                        (activeQueueView === 'FULL' && queueControls.full) || 
                                        (activeQueueView === 'FULL_NUDE' && queueControls.fullNude) || 
                                        (activeQueueView === 'BACKGROUND' && queueControls.background) ||
                                        (activeQueueView === 'ALL_PEOPLE' && queueControls.allPeople) ||
                                        (activeQueueView === 'ALL_PEOPLE_NUDE' && queueControls.allPeopleNude) ||
                                        (activeQueueView === 'COUNTING' && queueControls.counting) ||
                                        (activeQueueView === 'MODEL' && queueControls.model) ||
                                        (activeQueueView === 'FACE' && queueControls.face) ||
                                        (activeQueueView === 'FACE_LEFT' && queueControls.faceLeft) ||
                                        (activeQueueView === 'FACE_RIGHT' && queueControls.faceRight) ||
                                        (activeQueueView === 'NEUTRAL' && queueControls.neutral) ||
                                        (activeQueueView === 'NEUTRAL_NUDE' && queueControls.neutralNude) ||
                                        (activeQueueView === 'BACKSIDE' && queueControls.backside) ||
                                        (activeQueueView === 'NUDE' && queueControls.nude) ||
                                        (activeQueueView === 'NUDE_OPPOSITE' && queueControls.nudeOpposite) ||
                                        (activeQueueView === 'MODEL_FULL' && queueControls.modelFull) ||
                                        (activeQueueView === 'UPSCALE' && queueControls.upscale)
                                        ? 'translate-x-5.5 left-0.5' : 'translate-x-0.5 left-0.5'
                                    }`}></div>
                                </button>
                            </div>
                            
                            {/* Conditional Filter Display */}
                            {showQueueFilter && (
                                <label className="flex items-center space-x-2 p-2 rounded hover:bg-white/5 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={isGalleryFilteredByQueue} 
                                        onChange={() => setIsGalleryFilteredByQueue(!isGalleryFilteredByQueue)}
                                        className="accent-indigo-500 rounded w-4 h-4"
                                    />
                                    <span className="text-xs text-slate-300">Filter Gallery to this Queue</span>
                                </label>
                            )}
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
                {activeQueueView === 'UPLOADS' && sortedUploads.map(upload => {
                    const status = getSourceStatus(upload.id);
                    const processingJobs = getProcessingJobsForSource(upload.id);
                    const isScanning = processingJobs.some(j => j.taskType === 'scan-people');
                    return (
                    <div 
                        key={upload.id} 
                        className={`bg-slate-800 rounded-lg overflow-hidden border relative group flex flex-col cursor-pointer ${selectedSourceIds.has(upload.id) ? 'ring-2 ring-indigo-500' : ''} ${status === 'done' ? 'border-emerald-500 border-4' : 'border-white/5'}`}
                        onClick={() => toggleSourceSelection(upload.id)}
                    >
                        <div className="relative">
                             <img src={upload.thumbnailUrl} alt="source" className="w-full h-auto max-h-[50vh] object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                             <div className="absolute top-2 left-2 z-20">
                                 <button onClick={(e) => { e.stopPropagation(); toggleSourceSelection(upload.id); }} className={`p-1 rounded bg-black/50 backdrop-blur transition-colors ${selectedSourceIds.has(upload.id) ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}>
                                     {selectedSourceIds.has(upload.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                                 </button>
                             </div>
                             
                             {isScanning && (<div className="absolute inset-0 pointer-events-none z-10 overflow-hidden"><div className="absolute inset-0 bg-emerald-500/10"></div><div className="absolute left-0 w-full h-[2px] bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)] animate-scan"></div></div>)}
                             {processingJobs.length > 0 && (<div className={`absolute inset-0 flex flex-col items-center justify-center transition-all ${isScanning ? 'bg-black/20' : 'bg-black/60 backdrop-blur-[2px]'}`}><div className={`${isScanning ? 'bg-emerald-600/90' : 'bg-indigo-600/90'} text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center space-x-2`}>{isScanning ? <ScanFace size={12} className="animate-pulse" /> : <RefreshCw size={12} className="animate-spin" />}<span>{isScanning ? 'Scanning...' : `Processing ${processingJobs[0].taskType}`}</span></div></div>)}
                        </div>
                        <div className="p-2 border-t border-white/5 flex flex-col gap-2">
                             <p className="text-xs font-bold text-slate-200 truncate">{upload.file.name}</p>
                             <button 
                                onClick={(e) => { e.stopPropagation(); deleteUpload(upload.id); }} 
                                className="w-full py-1.5 bg-slate-700 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded text-xs transition-colors flex items-center justify-center gap-1"
                             >
                                <Trash2 size={12} /> Delete
                             </button>
                        </div>
                    </div>
                )})}
                {activeQueueView !== 'UPLOADS' && getQueueItems(activeQueueView).map(item => (
                     <div key={item.id} className="bg-slate-800 rounded-lg overflow-hidden border border-white/5 relative group">
                        <div className={`h-1 w-full ${item.status === ProcessingStatus.PROCESSING ? 'bg-indigo-500 animate-pulse' : item.status === ProcessingStatus.ERROR ? 'bg-red-500' : item.status === ProcessingStatus.ENDED ? 'bg-slate-900' : 'bg-slate-600'}`}></div>
                        <div className="relative">
                            <img src={item.thumbnailUrl} alt="job" className="w-full h-auto opacity-80" />
                            <div className="absolute top-2 left-2 z-20"><button onClick={(e) => { e.stopPropagation(); toggleSourceSelection(item.sourceId); }} className={`p-1 rounded bg-black/50 backdrop-blur transition-colors ${selectedSourceIds.has(item.sourceId) ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}>{selectedSourceIds.has(item.sourceId) ? <CheckSquare size={20} /> : <Square size={20} />}</button></div>
                            {item.status === ProcessingStatus.PROCESSING && (<div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"><RefreshCw className="text-indigo-400 animate-spin" size={32} /></div>)}
                            {item.detectBox && (<div className="absolute border-2 border-indigo-500/50" style={{top: `${item.detectBox[0]/10}%`, left: `${item.detectBox[1]/10}%`, height: `${(item.detectBox[2]-item.detectBox[0])/10}%`, width: `${(item.detectBox[3]-item.detectBox[1])/10}%`}}></div>)}
                        </div>
                        <div className="p-3">
                            <div className="flex justify-between items-start"><div><p className="text-xs font-bold text-slate-200 uppercase">{item.taskType}</p><p className="text-[10px] text-slate-400 truncate w-48">{item.file.name}</p>{item.personDescription && <p className="text-[10px] text-indigo-300 italic">{item.personDescription}</p>}</div>{item.retryCount > 0 && <span className="text-[10px] bg-red-900/50 text-red-300 px-1 rounded">{item.retryCount} Retries</span>}</div>
                            {item.errorMessage && (<div className="mt-2 p-1.5 bg-red-900/20 border border-red-500/20 rounded text-[10px] text-red-300 font-mono">{item.errorMessage}</div>)}
                            {(item.status === ProcessingStatus.ERROR || activeQueueView === 'FAILED' || activeQueueView === 'RETRY') && (<div className="flex gap-2 mt-2"><button onClick={() => handleRetryFailedItem(item.id)} className="flex-1 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] uppercase font-bold rounded flex items-center justify-center gap-1"><RefreshCcw size={10} /> Retry</button><button onClick={() => deleteJob(item.id)} className="flex-1 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] uppercase font-bold rounded flex items-center justify-center gap-1"><Trash2 size={10} /> Delete</button></div>)}
                        </div>
                        {!item.errorMessage && (<button onClick={() => deleteJob(item.id)} className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-20"><Trash2 size={14} /></button>)}
                     </div>
                ))}
            </div>
        </div>

        {/* --- MAIN CONTENT (80vw) --- */}
        <div className="w-[80vw] h-full flex flex-col bg-[#0f0f16] relative">
            {/* Gallery Header Controls */}
            <div className="absolute top-4 left-0 right-0 z-30 flex items-center justify-center pointer-events-none">
                 <div className="pointer-events-auto flex items-center space-x-4">
                     {selectedSourceIds.size > 0 && (
                        <div className="bg-indigo-600 shadow-lg border border-indigo-400/50 rounded-full px-4 py-2 flex items-center space-x-4 animate-in slide-in-from-top-4">
                            <span className="text-sm font-bold text-white">{selectedSourceIds.size} Sources Selected</span>
                            <button onClick={() => setSelectedSourceIds(new Set())} className="p-1 hover:bg-white/20 rounded-full text-white bg-white/10"><span className="text-xs px-2 font-bold">Deselect All</span></button>
                        </div>
                    )}
                 </div>
                 
                 {/* Sort Controls (Right Side) */}
                 <div className="absolute right-6 pointer-events-auto flex items-center space-x-2 bg-slate-800/90 backdrop-blur p-2 rounded-lg border border-white/5 shadow-xl">
                      <select 
                        value={gallerySortBy} 
                        onChange={(e) => setGallerySortBy(e.target.value as any)}
                        className="bg-transparent text-xs font-bold text-slate-300 outline-none cursor-pointer"
                      >
                          <option value="queue">Sort: Queue Type</option>
                          <option value="filename">Sort: File Name</option>
                          <option value="timestamp">Sort: Time</option>
                      </select>
                      <button onClick={() => setGallerySortOrder(o => o === 'asc' ? 'desc' : 'asc')} className="p-1 hover:bg-white/10 rounded text-slate-400">
                          {gallerySortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                      </button>
                      <div className="w-px h-4 bg-white/10 mx-1"></div>
                      <button onClick={() => scrollToGallery('top')} className="p-1 hover:bg-white/10 rounded text-slate-400"><ArrowUpCircle size={16} /></button>
                      <button onClick={() => scrollToGallery('bottom')} className="p-1 hover:bg-white/10 rounded text-slate-400"><ArrowDownCircle size={16} /></button>
                 </div>
            </div>

            {/* Gallery Area */}
            <div className="flex-1 overflow-y-auto p-8 pt-20" ref={galleryRef}>
                 <div className={`grid ${gridClass} gap-8 pb-20`}>
                     {galleryItems.map(item => {
                         const source = uploads.find(u => u.id === item.sourceId);
                         const usedOptions = source?.options || options;
                         const isUpscaling = upscalingIds.has(item.id);
                         const isHighlighted = shouldHighlight(item.taskType);
                         
                         return (
                         <div key={item.id} className="flex flex-col group animate-fade-in">
                             <div className={`relative bg-[#1e1e1e] rounded-t-xl overflow-hidden cursor-zoom-in border border-b-0 transition-all duration-300 ${isHighlighted ? 'border-emerald-500 ring-4 ring-emerald-500/30' : 'border-white/5'}`} onClick={() => setViewerItemId(item.id)} style={{ height: '400px', borderWidth: isHighlighted ? '0px' : '1px' }}>
                                 <div className="absolute inset-0 flex items-center justify-center bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
                                 <img src={item.result?.url} alt="Result" className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105" />
                                 {isHighlighted && (<div className="absolute inset-0 border-[8px] border-emerald-500 pointer-events-none rounded-t-lg z-10"></div>)}
                                 <div className="absolute top-3 left-3 flex flex-col items-start gap-1 z-20">
                                     <span className={`px-2 py-1 backdrop-blur-md text-white text-[10px] font-bold uppercase rounded tracking-wider ${isHighlighted ? 'bg-emerald-600' : 'bg-black/60'}`}>{item.taskType}</span>
                                     {item.personDescription && (<span className="px-2 py-1 bg-indigo-600/80 backdrop-blur-md text-white text-[10px] rounded max-w-[150px] truncate">{item.personDescription}</span>)}
                                 </div>
                                 <div className="absolute top-3 right-3 z-30 flex flex-col items-end group/info">
                                    <div className="p-1.5 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white hover:bg-black/60 transition-colors cursor-help"><Info size={16} /></div>
                                    <div className="absolute top-8 right-0 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl p-3 text-xs text-slate-300 invisible group-hover/info:visible opacity-0 group-hover/info:opacity-100 transition-all transform origin-top-right scale-95 group-hover/info:scale-100 z-40 flex flex-col gap-2 pointer-events-none">
                                        <div><span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Original File</span><span className="truncate block font-medium text-white" title={item.file.name}>{item.file.name}</span></div>
                                        <div className="grid grid-cols-2 gap-2"><div><span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Task</span><span className="block text-indigo-300">{item.taskType}</span></div><div><span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Status</span><span className="block text-emerald-400">Completed</span></div></div>
                                        <div className="border-t border-white/5 pt-2 mt-1"><span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Parameters</span><div className="flex justify-between mb-1"><span>Gender:</span><span className="text-white font-mono">{usedOptions.gender}</span></div><div className="flex justify-between"><span>Detail:</span><span className="text-white font-mono">{usedOptions.detailLevel}</span></div></div>
                                    </div>
                                 </div>
                                 
                                 {/* Original Filename Footer */}
                                 <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-3 py-2 text-center border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[10px] font-mono text-slate-300 truncate block">{item.file.name}</span>
                                 </div>
                             </div>
                             <div className={`h-12 bg-slate-800 rounded-b-xl flex divide-x divide-white/10 ${isHighlighted ? 'border-x-[8px] border-b-[8px] border-emerald-500' : 'border border-white/5'}`}>
                                 <button onClick={() => handleUpscale(item)} disabled={isUpscaling} className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50" title="Upscale to 4K">
                                     {isUpscaling ? <Loader2 size={14} className="animate-spin text-purple-400" /> : <Wand2 size={14} className="text-purple-400" />} 
                                     <span>Upscale</span>
                                 </button>
                                 <button onClick={() => repeatJob(item)} className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"><Repeat size={14} /> <span>Repeat</span></button>
                                 <button onClick={() => deleteJob(item.id)} className="flex-1 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"><Trash2 size={14} /> <span>Delete</span></button>
                             </div>
                         </div>
                     )})}
                 </div>
                 {galleryItems.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center text-slate-600 pointer-events-none">
                         <Layers size={64} className="mb-4 opacity-20" />
                         <p className="text-lg font-medium">{selectedSourceIds.size > 0 ? "No results for selected images" : (isGalleryFilteredByQueue ? "No results in this queue" : "Gallery is empty")}</p>
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
          const item = queue.find(i => i.id === viewerItemId);
          return item ? (
            <ImageViewer 
                item={item} 
                onClose={() => setViewerItemId(null)} 
                onRepeat={() => repeatJob(item)}
                {...viewerNav}
            />
          ) : null;
      })()}
    </div>
  );
}