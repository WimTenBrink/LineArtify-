
import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight } from 'lucide-react';
import { QueueItem } from '../types';

interface ImageViewerProps {
  item: QueueItem;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ item, onClose, onNext, onPrev, hasNext, hasPrev }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
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

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
    if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev();
    if (e.key === 'Escape') onClose();
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasNext, hasPrev, onNext, onPrev]);

  if (!item.result?.url) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="relative w-[95vw] h-[95vh] bg-[#181825] rounded-xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
        
        {/* Header Config Info */}
        <div className="absolute top-4 left-4 z-20 pointer-events-none">
             <div className="bg-black/60 backdrop-blur text-white px-4 py-2 rounded-lg border border-white/10 shadow-lg">
                <h3 className="font-bold text-sm">{item.file.name}</h3>
                <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-indigo-300 font-mono uppercase bg-indigo-500/20 px-1.5 py-0.5 rounded">
                        {item.taskType}
                    </span>
                    {item.personDescription && (
                        <span className="text-xs text-slate-300 italic truncate max-w-[200px]">
                             - {item.personDescription}
                        </span>
                    )}
                </div>
             </div>
        </div>

        {/* Toolbar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2 bg-slate-800/80 backdrop-blur p-2 rounded-full border border-white/10 shadow-lg">
          <button onClick={zoomOut} className="p-2 hover:bg-white/10 rounded-full text-white" title="Zoom Out"><ZoomOut size={20} /></button>
          <span className="text-xs font-mono text-slate-300 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-2 hover:bg-white/10 rounded-full text-white" title="Zoom In"><ZoomIn size={20} /></button>
          <div className="w-px h-4 bg-white/20 mx-2"></div>
          <button onClick={reset} className="p-2 hover:bg-white/10 rounded-full text-white" title="Reset View"><Maximize size={20} /></button>
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 bg-slate-800/80 hover:bg-red-500/80 rounded-full text-white transition-colors border border-white/10"
        >
          <X size={24} />
        </button>

        {/* Prev/Next Navigation */}
        {hasPrev && (
            <button 
                onClick={onPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/40 hover:bg-white/10 rounded-full text-white transition-colors border border-white/5 backdrop-blur group"
            >
                <ChevronLeft size={32} className="opacity-70 group-hover:opacity-100" />
            </button>
        )}
        {hasNext && (
            <button 
                onClick={onNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/40 hover:bg-white/10 rounded-full text-white transition-colors border border-white/5 backdrop-blur group"
            >
                <ChevronRight size={32} className="opacity-70 group-hover:opacity-100" />
            </button>
        )}

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
              src={item.result.url} 
              alt="Detailed View" 
              className="max-w-none transition-transform duration-75 ease-out select-none shadow-xl"
              style={{ 
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` 
              }}
              draggable={false}
            />
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;
