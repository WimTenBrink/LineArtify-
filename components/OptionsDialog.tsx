

import React, { useState, useRef } from 'react';
import { X, Layers, Settings, Save, Upload, Download, Cpu, Sparkles, CheckSquare, Square, Info, Check, Shield, Palette, Sliders } from 'lucide-react';
import { AppOptions, TaskType, PriorityLevel } from '../types';
import { TASK_DEFINITIONS } from '../services/taskDefinitions';

interface OptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  options: AppOptions;
  setOptions: React.Dispatch<React.SetStateAction<AppOptions>>;
}

const PrioritySelector: React.FC<{
  priority: PriorityLevel;
  onChange: (priority: PriorityLevel) => void;
}> = ({ priority, onChange }) => {
  const colorClass = {
      'Very Low': 'bg-slate-700 text-slate-400',
      'Low': 'bg-slate-600 text-slate-300',
      'Normal': 'bg-purple-600 text-white',
      'High': 'bg-emerald-600 text-white',
      'Very High': 'bg-amber-600 text-white'
  }[priority] || 'bg-slate-600';

  return (
      <div className="relative group/prio w-full h-full min-w-[60px]">
         <div className={`w-full h-full rounded flex items-center justify-center text-[9px] font-bold ${colorClass} cursor-pointer hover:opacity-90 transition-opacity`}>
             {priority}
         </div>
         <select 
            value={priority} 
            onChange={(e) => onChange(e.target.value as PriorityLevel)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer bg-slate-900 text-white"
          >
              <option value="Very Low" className="bg-slate-900 text-slate-300">Very Low</option>
              <option value="Low" className="bg-slate-900 text-slate-300">Low</option>
              <option value="Normal" className="bg-slate-900 text-white">Normal</option>
              <option value="High" className="bg-slate-900 text-white">High</option>
              <option value="Very High" className="bg-slate-900 text-white">Very High</option>
          </select>
      </div>
  );
};

// Data structures for UI Grouping
const SCENE_TASKS = [
    { id: 'full', label: 'Full Scene', description: 'Everything' },
    { id: 'full-nude', label: 'Scene Nude', description: 'No Clothes' },
    { id: 'background', label: 'Background', description: 'No People' },
    { id: 'all-people', label: 'All People', description: 'Group Shot' },
    { id: 'all-people-nude', label: 'All People Nude', description: 'Group Nude' }
];

const BODY_VIEWS = [
    { label: 'As-is', baseId: 'model-full' },
    { label: 'Front', baseId: 'body-front' },
    { label: 'Left', baseId: 'body-left' },
    { label: 'Right', baseId: 'body-right' },
    { label: 'Back', baseId: 'backside' },
];

const FACE_VIEWS = [
    { label: 'As-is', id: 'face-asis' },
    { label: 'Front', id: 'face' },
    { label: 'Left', id: 'face-left' },
    { label: 'Right', id: 'face-right' },
    { label: 'Back', id: 'face-back' },
];

const MODESTY_OPTIONS = [
    'None', 'Left Hand', 'Right Hand', 'Both Hands', 'Object', 'Veil', 'Long Hair', 'Steam', 'Shadow'
];

// Sort Styles Alphabetically
const STYLES = Object.keys(TASK_DEFINITIONS)
    .filter(k => TASK_DEFINITIONS[k as TaskType].category === 'Style' && !k.endsWith('-nude'))
    .sort((a, b) => TASK_DEFINITIONS[a as TaskType].label.localeCompare(TASK_DEFINITIONS[b as TaskType].label));

const OptionsDialog: React.FC<OptionsDialogProps> = ({ isOpen, onClose, options, setOptions }) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isSaveMode, setIsSaveMode] = useState(false);
  const [presetName, setPresetName] = useState("lineartify-preset");
  const [hoveredStyle, setHoveredStyle] = useState<TaskType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const toggleTask = (key: string) => {
    if (!TASK_DEFINITIONS[key as TaskType]) return;
    setOptions(prev => ({
      ...prev,
      taskTypes: { ...prev.taskTypes, [key]: !prev.taskTypes[key] }
    }));
  };

  const performSave = () => {
    try {
        const finalName = presetName.trim() || "lineartify-preset";
        const fullName = finalName.endsWith('.klc') ? finalName : `${finalName}.klc`;

        // Create a structured save object
        const savePackage = {
            version: 1,
            type: 'lineartify-preset',
            timestamp: Date.now(),
            data: {
                taskTypes: { ...options.taskTypes },
                taskPriorities: { ...options.taskPriorities },
                gender: options.gender,
                detailLevel: options.detailLevel,
                modelPreference: options.modelPreference,
                creativity: options.creativity,
                customStyle: options.customStyle,
                modesty: options.modesty
            }
        };

        const jsonString = JSON.stringify(savePackage, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fullName;
        document.body.appendChild(link);
        link.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setIsSaveMode(false); // Reset UI
        }, 100);

    } catch (err) {
        console.error("Save failed:", err);
        alert("Failed to create save file.");
    }
  };

  const performLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const text = event.target?.result as string;
            if (!text) throw new Error("File is empty");

            const parsed = JSON.parse(text);
            
            // Handle both legacy (raw options) and new (structured) formats
            let loadedOptions: Partial<AppOptions> = {};

            if (parsed.type === 'lineartify-preset' && parsed.data) {
                // New Format
                loadedOptions = parsed.data;
            } else if (parsed.taskTypes || parsed.gender) {
                // Legacy/Raw Format
                loadedOptions = parsed;
            } else {
                throw new Error("Unrecognized preset format");
            }

            setOptions(prev => ({
                ...prev,
                ...loadedOptions,
                taskTypes: {
                    ...prev.taskTypes,
                    ...(loadedOptions.taskTypes || {})
                },
                taskPriorities: {
                    ...prev.taskPriorities,
                    ...(loadedOptions.taskPriorities || {})
                }
            }));
            
        } catch (err) {
            console.error("Load failed:", err);
            alert("Failed to load preset. Invalid file.");
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset to allow reloading same file
  };

  const setAll = (keys: string[], val: boolean) => {
      setOptions(prev => {
          const next = { ...prev.taskTypes };
          keys.forEach(k => { if(TASK_DEFINITIONS[k as TaskType]) next[k] = val; });
          return { ...prev, taskTypes: next };
      });
  };
  
  const resetStyles = () => {
       const styleKeys: string[] = [];
       STYLES.forEach(s => {
           styleKeys.push(s);
           styleKeys.push(`${s}-nude`);
       });
       setAll(styleKeys, false);
  };

  const getTabClass = (index: number) => `flex-1 py-4 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === index ? 'text-purple-400 border-purple-500 bg-[#2d2a3d]' : 'text-slate-400 border-transparent hover:bg-[#2d2a3d]/50 hover:text-slate-200'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm text-slate-200">
      <div className="bg-[#1e1c2e] w-[95vw] h-[95vh] rounded-xl shadow-2xl flex flex-col border border-white/10 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#252233] border-b border-white/5 shrink-0">
          <h2 className="text-xl font-bold text-white tracking-tight">Configuration</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={24} className="text-slate-400 hover:text-white" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#1a1825] shrink-0">
           <button onClick={() => setActiveTab(0)} className={getTabClass(0)}><Layers size={16} /> Tasks</button>
           <button onClick={() => setActiveTab(1)} className={getTabClass(1)}><Palette size={16} /> Styles</button>
           <button onClick={() => setActiveTab(2)} className={getTabClass(2)}><Cpu size={16} /> Advanced</button>
           <button onClick={() => setActiveTab(3)} className={getTabClass(3)}><Sliders size={16} /> Modifiers</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#13111c] custom-scrollbar flex flex-col relative">
          
          {/* TASKS TAB */}
          {activeTab === 0 && (
             <div className="p-8 space-y-10 max-w-6xl mx-auto w-full pb-24">
                 
                 {/* SCENE SECTION */}
                 <div>
                     <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                        <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest">Scenes & Groups</h3>
                        <div className="flex gap-2">
                             <button onClick={() => setAll(SCENE_TASKS.map(s => s.id), true)} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded">All</button>
                             <button onClick={() => setAll(SCENE_TASKS.map(s => s.id), false)} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded">None</button>
                         </div>
                     </div>
                     <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                         {SCENE_TASKS.map(task => (
                             <button 
                                key={task.id} 
                                onClick={() => toggleTask(task.id)} 
                                className={`p-3 rounded-lg border text-left transition-all ${options.taskTypes[task.id] ? 'bg-purple-600/20 border-purple-500/50 ring-1 ring-purple-500/50' : 'bg-slate-800/50 border-white/5 hover:border-white/10'}`}
                             >
                                 <div className={`text-xs font-bold uppercase mb-1 ${options.taskTypes[task.id] ? 'text-purple-300' : 'text-slate-400'}`}>{task.label}</div>
                                 <div className="text-[10px] text-slate-500 truncate">{task.description}</div>
                             </button>
                         ))}
                     </div>
                 </div>

                 {/* FACE SECTION */}
                 <div>
                     <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                         <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest">Face Portraits</h3>
                         <div className="flex gap-2">
                             <button onClick={() => setAll(FACE_VIEWS.map(f => f.id), true)} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded">All</button>
                             <button onClick={() => setAll(FACE_VIEWS.map(f => f.id), false)} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded">None</button>
                         </div>
                     </div>
                     <div className="grid grid-cols-5 gap-3">
                         {FACE_VIEWS.map(view => (
                             <button 
                                key={view.id} 
                                onClick={() => toggleTask(view.id)} 
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${options.taskTypes[view.id] ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/20' : 'bg-slate-800/50 text-slate-400 border-white/5 hover:bg-slate-700'}`}
                             >
                                 <span className="text-xs font-bold uppercase">{view.label}</span>
                                 {options.taskTypes[view.id] && <Check size={14} className="mt-1" />}
                             </button>
                         ))}
                     </div>
                 </div>

                 {/* BODY SECTION (Updated with Anatomy/Skeleton) */}
                 <div>
                     <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                         <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest">Body Reconstruction</h3>
                         <div className="flex gap-2">
                             <button onClick={() => setAll(BODY_VIEWS.flatMap(b => [b.baseId, `${b.baseId}-nude`, `${b.baseId}-anatomy`, `${b.baseId}-skeleton`]), true)} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded">All</button>
                             <button onClick={() => setAll(BODY_VIEWS.flatMap(b => [b.baseId, `${b.baseId}-nude`, `${b.baseId}-anatomy`, `${b.baseId}-skeleton`]), false)} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded">None</button>
                         </div>
                     </div>
                     <div className="bg-slate-800/30 rounded-lg p-1 overflow-x-auto">
                         <div className="grid grid-cols-6 min-w-[600px] gap-px bg-slate-700/50 rounded overflow-hidden">
                             {/* Header Row */}
                             <div className="p-3 bg-slate-800/80 flex items-center justify-center"><span className="text-[10px] uppercase font-bold text-slate-500">View</span></div>
                             {BODY_VIEWS.map(view => (
                                 <div key={view.label} className="p-3 bg-slate-800/80 flex items-center justify-center"><span className="text-[10px] uppercase font-bold text-slate-300">{view.label}</span></div>
                             ))}

                             {/* Clothed Row */}
                             <div className="p-3 bg-slate-800/80 flex items-center justify-center border-t border-white/5"><span className="text-[10px] uppercase font-bold text-purple-400">Clothed</span></div>
                             {BODY_VIEWS.map(view => (
                                 <button 
                                     key={`c-${view.label}`} 
                                     onClick={() => toggleTask(view.baseId)}
                                     className={`p-4 flex items-center justify-center transition-colors border-t border-l border-white/5 ${options.taskTypes[view.baseId] ? 'bg-purple-600/20 text-purple-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-600'}`}
                                 >
                                     {options.taskTypes[view.baseId] ? <CheckSquare size={18} /> : <Square size={18} />}
                                 </button>
                             ))}

                             {/* Nude Row */}
                             <div className="p-3 bg-slate-800/80 flex items-center justify-center border-t border-white/5"><span className="text-[10px] uppercase font-bold text-rose-400">Nude</span></div>
                             {BODY_VIEWS.map(view => (
                                 <button 
                                     key={`n-${view.label}`} 
                                     onClick={() => toggleTask(`${view.baseId}-nude`)}
                                     className={`p-4 flex items-center justify-center transition-colors border-t border-l border-white/5 ${options.taskTypes[`${view.baseId}-nude`] ? 'bg-rose-600/20 text-rose-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-600'}`}
                                 >
                                     {options.taskTypes[`${view.baseId}-nude`] ? <CheckSquare size={18} /> : <Square size={18} />}
                                 </button>
                             ))}

                             {/* Anatomy Row */}
                             <div className="p-3 bg-slate-800/80 flex items-center justify-center border-t border-white/5"><span className="text-[10px] uppercase font-bold text-amber-400">Anatomy</span></div>
                             {BODY_VIEWS.map(view => (
                                 <button 
                                     key={`a-${view.label}`} 
                                     onClick={() => toggleTask(`${view.baseId}-anatomy`)}
                                     className={`p-4 flex items-center justify-center transition-colors border-t border-l border-white/5 ${options.taskTypes[`${view.baseId}-anatomy`] ? 'bg-amber-600/20 text-amber-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-600'}`}
                                 >
                                     {options.taskTypes[`${view.baseId}-anatomy`] ? <CheckSquare size={18} /> : <Square size={18} />}
                                 </button>
                             ))}

                             {/* Skeleton Row */}
                             <div className="p-3 bg-slate-800/80 flex items-center justify-center border-t border-white/5"><span className="text-[10px] uppercase font-bold text-slate-200">Skeleton</span></div>
                             {BODY_VIEWS.map(view => (
                                 <button 
                                     key={`s-${view.label}`} 
                                     onClick={() => toggleTask(`${view.baseId}-skeleton`)}
                                     className={`p-4 flex items-center justify-center transition-colors border-t border-l border-white/5 ${options.taskTypes[`${view.baseId}-skeleton`] ? 'bg-slate-400/20 text-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-600'}`}
                                 >
                                     {options.taskTypes[`${view.baseId}-skeleton`] ? <CheckSquare size={18} /> : <Square size={18} />}
                                 </button>
                             ))}
                         </div>
                     </div>
                 </div>

             </div>
          )}

          {/* STYLES TAB */}
          {activeTab === 1 && (
              <div className="p-8 pb-24 max-w-7xl mx-auto w-full relative">
                 <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4 sticky top-0 bg-[#13111c] z-20">
                     <h3 className="text-lg font-bold text-purple-400 uppercase tracking-widest">Art Styles Library</h3>
                     <div className="flex gap-2">
                         <button onClick={resetStyles} className="text-xs uppercase font-bold text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded flex items-center gap-2"><X size={14}/> Reset Styles</button>
                     </div>
                 </div>
                 
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                     {STYLES.map(styleKey => {
                         const def = TASK_DEFINITIONS[styleKey as TaskType];
                         const nudeKey = `${styleKey}-nude` as TaskType;
                         const isEnabled = options.taskTypes[styleKey];
                         const isNudeEnabled = options.taskTypes[nudeKey];

                         return (
                             <div 
                                key={styleKey} 
                                className="rounded-lg border overflow-hidden flex flex-col bg-slate-800/50 border-white/5 relative group"
                                onMouseEnter={() => setHoveredStyle(styleKey as TaskType)}
                                onMouseLeave={() => setHoveredStyle(null)}
                             >
                                 {/* Header */}
                                 <div className="px-3 py-2 bg-slate-900/50 border-b border-white/5">
                                     <div className="text-xs font-bold uppercase text-slate-300 truncate">{def.label}</div>
                                 </div>
                                 
                                 {/* Controls */}
                                 <div className="flex flex-col">
                                     <button 
                                        onClick={() => toggleTask(styleKey)} 
                                        className={`flex items-center justify-between px-3 py-2 transition-colors border-b border-white/5 ${isEnabled ? 'bg-purple-600/10 text-purple-400' : 'hover:bg-slate-700 text-slate-400'}`}
                                     >
                                         <span className="text-[10px] font-bold uppercase">Clothed</span>
                                         {isEnabled ? <CheckSquare size={14} /> : <Square size={14} />}
                                     </button>
                                     
                                     {TASK_DEFINITIONS[nudeKey] && (
                                        <button 
                                            onClick={() => toggleTask(nudeKey)} 
                                            className={`flex items-center justify-between px-3 py-2 transition-colors ${isNudeEnabled ? 'bg-rose-500/10 text-rose-400' : 'hover:bg-slate-700 text-slate-400'}`}
                                        >
                                            <span className="text-[10px] font-bold uppercase">Nude</span>
                                            {isNudeEnabled ? <CheckSquare size={14} /> : <Square size={14} />}
                                        </button>
                                     )}
                                 </div>
                             </div>
                         );
                     })}
                 </div>

                 {/* TOOLTIP OVERLAY */}
                 {hoveredStyle && TASK_DEFINITIONS[hoveredStyle] && (
                     <div className="fixed bottom-24 right-8 w-80 bg-slate-900 border border-purple-500/30 rounded-lg p-4 shadow-2xl z-30 animate-in slide-in-from-bottom-5 fade-in duration-200 pointer-events-none">
                         <div className="flex items-center gap-2 mb-2">
                             <Palette className="text-purple-400 w-4 h-4" />
                             <h4 className="font-bold text-white text-sm uppercase tracking-wide">{TASK_DEFINITIONS[hoveredStyle].label}</h4>
                         </div>
                         <p className="text-xs text-slate-300 leading-relaxed mb-3">{TASK_DEFINITIONS[hoveredStyle].description}</p>
                         <div className="text-[10px] text-slate-500 font-mono bg-black/30 p-2 rounded border border-white/5">
                            {/* Extract key definition keywords for context */}
                            {TASK_DEFINITIONS[hoveredStyle].prompt({gender: 'Female', detailLevel: 'Medium', personDescription: '', customStyle: '', modesty: ''})
                                .split('STYLE GUIDE:')[1]?.split('\n')[0]?.trim() || "No detailed style guide available."}
                         </div>
                     </div>
                 )}
              </div>
          )}

          {/* ADVANCED TAB */}
          {activeTab === 2 && (
            <div className="p-8 space-y-8 max-w-4xl mx-auto w-full">
              
              {/* Model & Creativity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-800/20 p-6 rounded-xl border border-white/5">
                      <div className="flex items-center space-x-2 mb-4"><Cpu size={20} className="text-purple-400" /><h3 className="text-base font-bold text-slate-200">AI Model</h3></div>
                      <div className="flex bg-slate-900 rounded-lg p-1 border border-white/5">
                          <button onClick={() => setOptions(prev => ({...prev, modelPreference: 'flash'}))} className={`flex-1 py-3 rounded text-sm font-bold transition-colors ${options.modelPreference === 'flash' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Flash (Fast)</button>
                          <button onClick={() => setOptions(prev => ({...prev, modelPreference: 'pro'}))} className={`flex-1 py-3 rounded text-sm font-bold transition-colors ${options.modelPreference === 'pro' ? 'bg-purple-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Pro (High Qual)</button>
                      </div>
                      <p className="text-xs text-slate-500 mt-3 leading-relaxed">Flash is faster and cheaper. Pro (Gemini 3) follows complex instructions better and supports native 4K.</p>
                  </div>

                  <div className="bg-slate-800/20 p-6 rounded-xl border border-white/5">
                      <div className="flex items-center space-x-2 mb-4"><Sparkles size={20} className="text-amber-400" /><h3 className="text-base font-bold text-slate-200">Creativity (Temperature)</h3></div>
                      <input type="range" min="0" max="1" step="0.1" value={options.creativity ?? 0.4} onChange={(e) => setOptions(prev => ({...prev, creativity: parseFloat(e.target.value)}))} className="w-full h-2 bg-slate-700 rounded-lg accent-amber-500 cursor-pointer" />
                      <div className="flex justify-between text-xs font-mono text-slate-400 mt-3"><span>Strict (0.0)</span><span className="text-amber-400 font-bold bg-amber-500/10 px-2 rounded">{options.creativity ?? 0.4}</span><span>Wild (1.0)</span></div>
                  </div>
              </div>

              {/* Detail Level */}
              <div className="bg-slate-800/20 p-8 rounded-xl border border-white/5">
                  <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest mb-6">Detail Level</h3>
                  <div className="relative pt-2">
                       <input type="range" min="0" max="4" step="1" value={['Very Low', 'Low', 'Medium', 'High', 'Very High'].indexOf(options.detailLevel)} onChange={(e) => setOptions(prev => ({...prev, detailLevel: ['Very Low', 'Low', 'Medium', 'High', 'Very High'][parseInt(e.target.value)]}))} className="w-full h-2 bg-slate-700 rounded-lg accent-purple-500 cursor-pointer relative z-10" />
                       <div className="flex justify-between mt-4">
                           {['Very Low', 'Low', 'Medium', 'High', 'Very High'].map((l, i) => (
                               <div key={l} className="flex flex-col items-center cursor-pointer" onClick={() => setOptions(prev => ({...prev, detailLevel: l}))}>
                                   <div className={`w-1 h-2 mb-2 ${options.detailLevel === l ? 'bg-purple-500' : 'bg-slate-700'}`}></div>
                                   <span className={`text-[10px] font-bold uppercase tracking-wider ${options.detailLevel === l ? 'text-purple-400' : 'text-slate-600'}`}>{l}</span>
                               </div>
                           ))}
                       </div>
                  </div>
              </div>
            </div>
          )}

          {/* MODIFIERS TAB */}
          {activeTab === 3 && (
              <div className="p-8 space-y-8 max-w-4xl mx-auto w-full">
                  
                  {/* MODESTY LAYER */}
                  <div className="bg-slate-800/20 p-6 rounded-xl border border-white/5">
                       <div className="flex items-center space-x-2 mb-4"><Shield size={20} className="text-rose-400" /><h3 className="text-base font-bold text-slate-200">Modesty Layer</h3></div>
                       <p className="text-xs text-slate-500 mb-4">Automatically applies covering elements to nude generations. Does not affect clothed tasks.</p>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                           {MODESTY_OPTIONS.map(m => (
                               <button 
                                 key={m} 
                                 onClick={() => setOptions(prev => ({...prev, modesty: m}))}
                                 className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all ${options.modesty === m ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-slate-800'}`}
                               >
                                   {m}
                               </button>
                           ))}
                       </div>
                  </div>

                  {/* Gender */}
                  <div className="bg-slate-800/20 p-6 rounded-xl border border-white/5">
                      <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest mb-4">Target Gender Bias</h3>
                      <div className="flex flex-wrap gap-3">
                          {['As-is', 'Female', 'Male', 'Non-binary', 'Transgender'].map(g => (
                              <button key={g} onClick={() => setOptions(prev => ({...prev, gender: g}))} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all ${options.gender === g ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-slate-800 hover:border-slate-500'}`}>{g}</button>
                          ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-3"><Info size={12} className="inline mr-1"/> Forces the AI to interpret ambiguous subjects as the selected gender.</p>
                  </div>

                  {/* Custom Style */}
                  <div className="bg-slate-800/20 p-6 rounded-xl border border-white/5">
                      <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest mb-4">Custom Style Injection</h3>
                      <textarea value={options.customStyle || ''} onChange={(e) => setOptions(prev => ({...prev, customStyle: e.target.value}))} placeholder="E.g., 'Art Nouveau', 'Cyberpunk', 'Thick Lines'..." className="w-full h-24 bg-black/30 border border-white/10 rounded-lg p-4 text-sm text-slate-200 resize-none font-mono focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none placeholder:text-slate-600" />
                      <p className="text-xs text-slate-500 mt-2">These instructions are appended to the system prompt. Use this to enforce specific artistic directions not covered by presets.</p>
                  </div>
              </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-[#1a1825] border-t border-white/5 flex justify-between shrink-0 backdrop-blur z-40">
            {isSaveMode ? (
                <div className="flex items-center space-x-2 w-full animate-in fade-in slide-in-from-bottom-2 bg-slate-800 p-1 rounded-lg border border-purple-500/50">
                    <span className="text-xs font-bold text-purple-400 px-2 uppercase">File Name:</span>
                    <input 
                        type="text" 
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded px-3 py-1.5 text-sm text-white flex-1 focus:ring-1 focus:ring-purple-500 outline-none"
                        placeholder="Enter preset name..."
                        autoFocus
                    />
                    <button onClick={performSave} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all">Download .klc</button>
                    <button onClick={() => setIsSaveMode(false)} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-bold text-xs transition-colors">Cancel</button>
                </div>
            ) : (
                <>
                    <div className="flex space-x-3">
                        <button onClick={() => setIsSaveMode(true)} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors border border-white/5" title="Save Config"><Download size={16} /> <span>Save Preset</span></button>
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors border border-white/5" title="Load Config"><Upload size={16} /> <span>Load Preset</span></button>
                        <input type="file" ref={fileInputRef} hidden accept=".klc,.json" onChange={performLoad} />
                    </div>
                    <button onClick={onClose} className="px-8 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-purple-500/20 transition-all hover:scale-105">Done</button>
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default OptionsDialog;