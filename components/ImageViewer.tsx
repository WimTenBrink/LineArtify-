import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface ImageViewerProps {
  imageUrl: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative w-[95vw] h-[95vh] bg-[#181825] rounded-xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
        
        {/* Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center space-x-2 bg-slate-800/80 backdrop-blur p-2 rounded-full border border-white/10 shadow-lg">
          <button onClick={zoomOut} className="p-2 hover:bg-white/10 rounded-full text-white"><ZoomOut size={20} /></button>
          <span className="text-xs font-mono text-slate-300 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-2 hover:bg-white/10 rounded-full text-white"><ZoomIn size={20} /></button>
          <div className="w-px h-4 bg-white/20 mx-2"></div>
          <button onClick={reset} className="p-2 hover:bg-white/10 rounded-full text-white"><Maximize size={20} /></button>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-slate-800/80 hover:bg-red-500/80 rounded-full text-white transition-colors border border-white/10"
        >
          <X size={24} />
        </button>

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
              src={imageUrl} 
              alt="Detailed View" 
              className="max-w-none transition-transform duration-75 ease-out select-none shadow-xl"
              style={{ 
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` 
              }}
              draggable={false}
            />
        </div>
        
        <div className="absolute bottom-4 left-4 text-xs text-slate-500 font-mono pointer-events-none bg-white/80 px-2 py-1 rounded backdrop-blur-sm">
          Scroll to zoom • Drag to pan
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;