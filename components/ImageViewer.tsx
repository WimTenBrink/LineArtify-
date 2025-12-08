import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, EyeOff, Repeat, Trash2, Info } from 'lucide-react';
import { QueueItem } from '../types';

interface ImageViewerProps {
  item: QueueItem;
  onClose: () => void;
  onRepeat?: () => void;
  onDelete?: () => void;
  onDetails?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ item, onClose, onRepeat, onDelete, onDetails, onNext, onPrev, onFirst, onLast, hasNext, hasPrev }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showOriginal, setShowOriginal] = useState(false);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const resultUrl = item.result?.url;
  const sourceUrl = item.thumbnailUrl;
  
  // If result is available, toggle between result and source. If only source (waiting job), show source.
  const displayUrl = (item.result && !showOriginal) ? resultUrl : sourceUrl;

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setShowOriginal(false);
  }, [item.id]);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.1, scale + delta), 8);
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomIn = () => setScale(s => Math.min(s * 1.2, 8));
  const zoomOut = () => setScale(s => Math.max(s / 1.2, 0.1));
  const reset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
    if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
    if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev();
    if (e.key === 'Home' && onFirst) onFirst();
    if (e.key === 'End' && onLast) onLast();
    if (e.key === 'Escape') onClose();
    if (e.key === ' ') {
        e.preventDefault(); 
        if (item.result) setShowOriginal(prev => !prev);
    }
    if (e.key === 'Enter' && onRepeat) {
        e.preventDefault();
        onRepeat(); 
    }
    if (e.key === 'Delete' && onDelete) {
        onDelete();
    }
    if (e.key === 'i' && onDetails) {
        onDetails();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasNext, hasPrev, onNext, onPrev, onFirst, onLast, onRepeat, onDetails, item.result]);

  useEffect(() => {
    if (containerRef.current) containerRef.current.focus();
  }, []);

  if (!displayUrl) return null;

  return (
    <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        autoFocus
    >
      <div className="relative w-[95vw] h-[95vh] bg-[#181825] rounded-xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col outline-none">
        
        {/* Header Config Info */}
        <div className="absolute top-4 left-4 z-20 pointer-events-none">
             <div className="bg-black/60 backdrop-blur text-white px-4 py-2 rounded-lg border border-white/10 shadow-lg flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-200">{item.file.name}</h3>
                    {showOriginal && <span className="text-[10px] bg-amber-500 text-black px-1.5 rounded font-bold uppercase">Original</span>}
                    {!showOriginal && item.result && <span className="text-[10px] bg-emerald-500 text-black px-1.5 rounded font-bold uppercase">Result</span>}
                    {!item.result && <span className="text-[10px] bg-blue-500 text-black px-1.5 rounded font-bold uppercase">Source</span>}
                </div>
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-indigo-300 font-mono uppercase bg-indigo-500/20 px-1.5 py-0.5 rounded">
                        {item.taskType}
                    </span>
                    <span className="text-[10px] text-slate-500">P:{item.priority}</span>
                </div>
             </div>
        </div>

        {/* Top Right Controls */}
        <div className="absolute top-4 right-4 z-30 flex items-center space-x-3">
             {onDetails && (
                <button 
                  onClick={onDetails}
                  className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-full text-white transition-colors border border-white/10 backdrop-blur"
                  title="View Job Details (i)"
                >
                  <Info size={24} />
                </button>
             )}
             {onDelete && (
                <button 
                  onClick={onDelete}
                  className="p-2 bg-slate-800/80 hover:bg-red-500 rounded-full text-white transition-colors border border-white/10 backdrop-blur"
                  title="Delete this job"
                >
                  <Trash2 size={24} />
                </button>
             )}
             {onRepeat && (
                <button 
                  onClick={onRepeat}
                  className="p-2 bg-slate-800/80 hover:bg-indigo-500 rounded-full text-white transition-colors border border-white/10 backdrop-blur"
                  title="Repeat this job (Enter)"
                >
                  <Repeat size={24} />
                </button>
             )}
             <button 
              onClick={onClose}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-full text-white transition-colors border border-white/10 backdrop-blur"
            >
              <X size={24} />
            </button>
        </div>

        {/* Toolbar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2 bg-slate-800/90 backdrop-blur p-2 rounded-full border border-white/10 shadow-xl">
          <button onClick={zoomOut} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors" title="Zoom Out"><ZoomOut size={20} /></button>
          <span className="text-xs font-mono text-slate-300 w-12 text-center select-none">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors" title="Zoom In"><ZoomIn size={20} /></button>
          <div className="w-px h-4 bg-white/20 mx-2"></div>
          <button onClick={reset} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors" title="Reset View"><Maximize size={20} /></button>
          <div className="w-px h-4 bg-white/20 mx-2"></div>
          
          {/* Toggle Original/Result */}
          <button 
            onClick={() => setShowOriginal(!showOriginal)} 
            className={`p-2 rounded-full transition-colors ${showOriginal ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-white/10 text-white'}`} 
            title={showOriginal ? "Showing Original (Space)" : "Showing Result (Space)"}
            disabled={!item.result} 
          >
            {showOriginal ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {/* Navigation Controls */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
            {onFirst && (
                 <button onClick={onFirst} className="p-3 bg-black/40 hover:bg-white/10 rounded-full text-white transition-colors border border-white/5 backdrop-blur group" title="First Image (Home)">
                    <ChevronsLeft size={24} className="opacity-70 group-hover:opacity-100" />
                 </button>
            )}
            {hasPrev && (
                <button onClick={onPrev} className="p-3 bg-black/40 hover:bg-white/10 rounded-full text-white transition-colors border border-white/5 backdrop-blur group" title="Previous Image (Left Arrow)">
                    <ChevronLeft size={32} className="opacity-70 group-hover:opacity-100" />
                </button>
            )}
        </div>

        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
            {hasNext && (
                <button onClick={onNext} className="p-3 bg-black/40 hover:bg-white/10 rounded-full text-white transition-colors border border-white/5 backdrop-blur group" title="Next Image (Right Arrow)">
                    <ChevronRight size={32} className="opacity-70 group-hover:opacity-100" />
                </button>
            )}
             {onLast && (
                 <button onClick={onLast} className="p-3 bg-black/40 hover:bg-white/10 rounded-full text-white transition-colors border border-white/5 backdrop-blur group" title="Last Image (End)">
                    <ChevronsRight size={24} className="opacity-70 group-hover:opacity-100" />
                 </button>
            )}
        </div>

        {/* Image Area */}
        <div 
          className="flex-1 overflow-hidden relative cursor-move flex items-center justify-center bg-white"
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
             backgroundImage: 'linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%)',
             backgroundSize: '20px 20px',
             backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
          }}
        >
            <img 
              ref={imgRef}
              src={displayUrl} 
              alt="Detailed View" 
              className="transition-transform duration-75 ease-out select-none shadow-xl"
              style={{ 
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain'
              }}
              draggable={false}
            />
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;