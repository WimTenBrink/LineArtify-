

import React, { useState, useRef } from 'react';
import { X, Layers, User, Settings, RotateCcw, Save, Upload, Download, ArrowUpCircle } from 'lucide-react';
import { AppOptions, TaskType, PriorityLevel } from '../types';
import { TASK_DEFINITIONS } from '../services/taskDefinitions';

interface OptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  options: AppOptions;
  setOptions: React.Dispatch<React.SetStateAction<AppOptions>>;
}

const OptionsDialog: React.FC<OptionsDialogProps> = ({ isOpen, onClose, options, setOptions }) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const toggleTask = (key: keyof AppOptions['taskTypes']) => {
    setOptions(prev => ({
      ...prev,
      taskTypes: { ...prev.taskTypes, [key]: !prev.taskTypes[key] }
    }));
  };

  const setTaskPriority = (key: keyof AppOptions['taskPriorities'], priority: PriorityLevel) => {
    setOptions(prev => ({
      ...prev,
      taskPriorities: { ...prev.taskPriorities, [key]: priority }
    }));
  };

  const DEFAULT_OPTIONS: AppOptions = {
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
        full: 'Low',
        fullNude: 'Low', // New
        background: 'Low',
        allPeople: 'Normal',
        allPeopleNude: 'Normal',
        model: 'Very High',
        backside: 'Normal',
        nude: 'Very High',
        nudeOpposite: 'Normal',
        modelFull: 'Normal',
        face: 'Very Low',
        faceLeft: 'Very Low',
        faceRight: 'Very Low',
        neutral: 'High',
        neutralNude: 'Normal',
        upscale: 'Normal'
    },
    gender: 'As-is',
    detailLevel: 'Medium'
  };

  const handleRestoreDefaults = () => {
    if (window.confirm('Are you sure you want to restore default settings?')) {
      setOptions(DEFAULT_OPTIONS);
    }
  };

  const handleSaveConfig = () => {
    const blob = new Blob([JSON.stringify(options, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lineartify_config.klc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = ev.target?.result as string;
        const parsed = JSON.parse(result);
        if (parsed && parsed.taskTypes) {
           // Ensure taskPriorities exists for backward compatibility
           if (!parsed.taskPriorities) {
             parsed.taskPriorities = DEFAULT_OPTIONS.taskPriorities;
           }
           setOptions(parsed);
           alert('Configuration loaded successfully.');
        } else {
           alert('Invalid configuration file.');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to load configuration.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  const detailLevels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
  const currentDetailIndex = detailLevels.indexOf(options.detailLevel);
  // Fallback if current option isn't in list (e.g. from old state)
  const sliderValue = currentDetailIndex === -1 ? 2 : currentDetailIndex; 

  const genderOptions = ['As-is', 'Female', 'Male', 'Non-binary', 'Androgynous', 'Transgender', 'Intersex'];

  // Group definitions by category
  const sceneTasks = Object.values(TASK_DEFINITIONS).filter(t => t.category === 'Scene' || t.category === 'Group');
  const personTasks = Object.values(TASK_DEFINITIONS).filter(t => t.category === 'Person');
  
  // Helper to map TaskDef ID to Options Key
  const taskKeyMap: Record<string, keyof AppOptions['taskTypes']> = {
      'full': 'full',
      'full-nude': 'fullNude',
      'background': 'background',
      'all-people': 'allPeople',
      'all-people-nude': 'allPeopleNude',
      'model': 'model',
      'face': 'face',
      'face-left': 'faceLeft',
      'face-right': 'faceRight',
      'neutral': 'neutral',
      'neutral-nude': 'neutralNude',
      'model-full': 'modelFull',
      'backside': 'backside',
      'nude': 'nude',
      'nude-opposite': 'nudeOpposite',
      'upscale': 'upscale'
  };

  const PrioritySelector = ({ taskKey }: { taskKey: keyof AppOptions['taskPriorities'] }) => {
      const p = options.taskPriorities[taskKey];
      const colors = {
          'Very Low': 'text-slate-500',
          'Low': 'text-slate-400',
          'Normal': 'text-indigo-400',
          'High': 'text-emerald-400',
          'Very High': 'text-amber-400 font-bold'
      };

      return (
          <div className="flex items-center space-x-1 bg-slate-900/80 rounded px-1.5 py-0.5 border border-white/5 ml-auto" onClick={(e) => e.stopPropagation()}>
              <span className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">Priority</span>
              <select 
                value={p} 
                onChange={(e) => setTaskPriority(taskKey, e.target.value as PriorityLevel)}
                className={`bg-transparent text-[10px] outline-none cursor-pointer ${colors[p]} font-mono`}
              >
                  <option value="Very Low">Very Low</option>
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Very High">Very High</option>
              </select>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1e1e2e] w-[95vw] h-[95vh] rounded-xl shadow-2xl flex flex-col border border-slate-700 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
          <h2 className="text-lg font-bold text-white">Configuration</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900/50 shrink-0">
           <button 
             onClick={() => setActiveTab(0)} 
             className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 ${activeTab === 0 ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50'}`}
           >
             <Layers size={14} /> Types
           </button>
           <button 
             onClick={() => setActiveTab(1)} 
             className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 ${activeTab === 1 ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50'}`}
           >
             <User size={14} /> Gender
           </button>
           <button 
             onClick={() => setActiveTab(2)} 
             className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 ${activeTab === 2 ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50'}`}
           >
             <Settings size={14} /> Quality
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto bg-[#13131f] custom-scrollbar">
          
          {/* Page 1: Types */}
          {activeTab === 0 && (
            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Scene & Group Generation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sceneTasks.map(task => {
                      const key = taskKeyMap[task.id];
                      if (!key) return null;
                      return (
                        <div key={task.id} className="flex flex-col p-2 bg-slate-800/50 rounded-lg border border-white/5 transition-colors hover:bg-slate-800">
                             <div className="flex items-start mb-2">
                                <label className="flex items-start cursor-pointer flex-1">
                                    <input type="checkbox" checked={options.taskTypes[key]} onChange={() => toggleTask(key)} className="mt-1 accent-indigo-500 w-4 h-4 shrink-0" />
                                    <div className="ml-3">
                                        <span className="block font-bold text-white text-sm">{task.label}</span>
                                        <span className="block text-[10px] text-slate-400 leading-tight">{task.description}</span>
                                    </div>
                                </label>
                            </div>
                            <div className="mt-auto pt-1">
                                <PrioritySelector taskKey={key} />
                            </div>
                        </div>
                      );
                  })}
                </div>
              </section>

              <section>
                 <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Person Extraction Tasks</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {personTasks.map(task => {
                        const key = taskKeyMap[task.id];
                        if (!key) return null;
                        return (
                            <div key={task.id} className="flex flex-col p-2 bg-slate-800/50 rounded-lg border border-white/5 transition-colors hover:bg-slate-800">
                                <div className="flex items-start mb-2">
                                    <label className="flex items-start cursor-pointer flex-1">
                                        <input type="checkbox" checked={options.taskTypes[key]} onChange={() => toggleTask(key)} className="mt-1 accent-indigo-500 w-4 h-4 shrink-0" />
                                        <div className="ml-3">
                                            <span className="block font-bold text-white text-sm">{task.label}</span>
                                            <span className="block text-[10px] text-slate-400 leading-tight">{task.description}</span>
                                        </div>
                                    </label>
                                </div>
                                <div className="mt-auto pt-1">
                                    <PrioritySelector taskKey={key} />
                                </div>
                            </div>
                        );
                    })}
                 </div>
              </section>

              <section>
                 <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Utility</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex flex-col p-2 bg-slate-800/50 rounded-lg border border-white/5 transition-colors hover:bg-slate-800">
                        <div className="flex items-start mb-2">
                            <label className="flex items-start cursor-pointer flex-1">
                                <input type="checkbox" checked={options.taskTypes.upscale} onChange={() => toggleTask('upscale')} className="mt-1 accent-indigo-500 w-4 h-4 shrink-0" />
                                <div className="ml-3">
                                    <span className="block font-bold text-white text-sm">Upscale 4K</span>
                                    <span className="block text-[10px] text-slate-400 leading-tight">Automatically upscale generated images to 4K resolution using Gemini 3 Pro.</span>
                                </div>
                            </label>
                        </div>
                         <div className="mt-auto pt-1">
                            <PrioritySelector taskKey="upscale" />
                        </div>
                    </div>
                 </div>
              </section>
            </div>
          )}

          {/* Page 2: Gender */}
          {activeTab === 1 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Target Gender Adjustment</h3>
              <p className="text-sm text-slate-300 mb-4">Force the AI to interpret ambiguous figures as a specific gender, or leave as "As-is" for natural interpretation.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                 {genderOptions.map((g) => (
                    <label key={g} className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${options.gender === g ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/50 border-white/5 hover:bg-slate-800'}`}>
                        <input 
                            type="radio" 
                            name="gender" 
                            value={g} 
                            checked={options.gender === g}
                            onChange={(e) => setOptions(prev => ({...prev, gender: e.target.value}))}
                            className="accent-indigo-500 w-4 h-4"
                        />
                        <span className="text-sm font-medium text-slate-300">{g}</span>
                    </label>
                 ))}
              </div>
            </div>
          )}

          {/* Page 3: Quality */}
          {activeTab === 2 && (
             <div className="space-y-6">
               <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Detail & Style Quality</h3>
               
               <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                      <span>Very Low</span>
                      <span>Low</span>
                      <span>Medium</span>
                      <span>High</span>
                      <span>Very High</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="4" 
                    step="1"
                    value={sliderValue}
                    onChange={(e) => {
                       const val = parseInt(e.target.value);
                       setOptions(prev => ({...prev, detailLevel: detailLevels[val]}));
                    }}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="mt-6 text-center">
                     <span className="text-indigo-400 font-bold text-xl">{options.detailLevel} Detail</span>
                     <p className="text-sm text-slate-300 mt-2 max-w-lg mx-auto leading-relaxed">
                        {options.detailLevel === 'Very Low' && "Abstract & Minimalist. Ultra-simplified lines. Best for conceptual icons."}
                        {options.detailLevel === 'Low' && "Simplified lines. Best for icons and quick sketches. Focus on silhouette."}
                        {options.detailLevel === 'Medium' && "Balanced detail. Standard professional illustration style. Good for general use."}
                        {options.detailLevel === 'High' && "Intricate details. Captures fine textures, hair strands, and cloth folds."}
                        {options.detailLevel === 'Very High' && "Hyper-realistic. Micro-details, pores, and extreme texture density."}
                     </p>
                  </div>
               </div>
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-between shrink-0">
            <div className="flex space-x-2">
                 <button onClick={handleRestoreDefaults} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Restore Defaults">
                    <RotateCcw size={18} />
                </button>
                <div className="w-px h-full bg-slate-700 mx-1"></div>
                <button onClick={handleSaveConfig} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Save Config (.klc)">
                    <Download size={18} />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Load Config (.klc)">
                    <Upload size={18} />
                </button>
                <input type="file" ref={fileInputRef} hidden accept=".klc" onChange={handleLoadConfig} />
            </div>

            <button onClick={onClose} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm transition-colors shadow-lg">
                Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default OptionsDialog;