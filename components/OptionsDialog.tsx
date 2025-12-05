

import React, { useState, useRef } from 'react';
import { X, Layers, Settings, Save, Upload, Download, Cpu, Sparkles, CheckSquare, Square, Info } from 'lucide-react';
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
      'Normal': 'bg-indigo-600 text-white',
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
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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

// Configuration of Task Groups to pair Clothed/Nude variants
const TASK_GROUPS = [
    // Scenes
    { category: 'Scene', label: 'Full Scene', clothed: 'full', nude: 'full-nude' },
    { category: 'Scene', label: 'Background Only', clothed: 'background' },
    // Groups
    { category: 'Group', label: 'Group Extraction', clothed: 'all-people', nude: 'all-people-nude' },
    // Characters
    { category: 'Person', label: 'Character Extraction', clothed: 'model', nude: 'nude' },
    { category: 'Person', label: 'Body Reconstruction', clothed: 'model-full', nude: 'model-full-nude' },
    { category: 'Person', label: 'Neutral Pose', clothed: 'neutral', nude: 'neutral-nude' },
    { category: 'Person', label: 'Backside View', clothed: 'backside', nude: 'nude-opposite' },
    // Faces
    { category: 'Person', label: 'Face Front', clothed: 'face' },
    { category: 'Person', label: 'Face Left', clothed: 'face-left' },
    { category: 'Person', label: 'Face Right', clothed: 'face-right' },
    // Styles
    { category: 'Style', label: 'Chibi', clothed: 'chibi', nude: 'chibi-nude' },
    { category: 'Style', label: 'Anime (90s)', clothed: 'anime', nude: 'anime-nude' },
    { category: 'Style', label: 'Rough Sketch', clothed: 'sketch', nude: 'sketch-nude' },
    { category: 'Style', label: 'Coloring Book', clothed: 'coloring-book', nude: 'coloring-book-nude' },
    { category: 'Style', label: 'Cyberpunk', clothed: 'cyberpunk', nude: 'cyberpunk-nude' },
    { category: 'Style', label: 'Noir', clothed: 'noir', nude: 'noir-nude' },
    { category: 'Style', label: 'Impressionist', clothed: 'impressionist', nude: 'impressionist-nude' },
    { category: 'Style', label: 'Sticker', clothed: 'sticker', nude: 'sticker-nude' },
    { category: 'Style', label: 'Fantasy', clothed: 'fantasy', nude: 'fantasy-nude' },
];

const OptionsDialog: React.FC<OptionsDialogProps> = ({ isOpen, onClose, options, setOptions }) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const toggleTask = (key: string) => {
    if (!TASK_DEFINITIONS[key as TaskType]) return;
    setOptions(prev => ({
      ...prev,
      taskTypes: { ...prev.taskTypes, [key]: !prev.taskTypes[key] }
    }));
  };

  const setGroupBulk = (category: string, type: 'clothed' | 'nude' | 'all' | 'none') => {
      setOptions(prev => {
          const nextTypes = { ...prev.taskTypes };
          TASK_GROUPS.filter(g => g.category === category).forEach(g => {
              const hasClothed = g.clothed && TASK_DEFINITIONS[g.clothed as TaskType];
              const hasNude = g.nude && TASK_DEFINITIONS[g.nude as TaskType];

              if (type === 'all') {
                  if (hasClothed) nextTypes[g.clothed] = true;
                  if (hasNude) nextTypes[g.nude!] = true;
              } else if (type === 'none') {
                  if (hasClothed) nextTypes[g.clothed] = false;
                  if (hasNude) nextTypes[g.nude!] = false;
              } else if (type === 'clothed') {
                  if (hasClothed) nextTypes[g.clothed] = true;
              } else if (type === 'nude') {
                  if (hasNude) nextTypes[g.nude!] = true;
              }
          });
          return { ...prev, taskTypes: nextTypes };
      });
  };

  const setBulk = (type: 'all' | 'none' | 'clothed' | 'nude') => {
    setOptions(prev => {
        const nextTypes = { ...prev.taskTypes };
        TASK_GROUPS.forEach(g => {
            const hasClothed = g.clothed && TASK_DEFINITIONS[g.clothed as TaskType];
            const hasNude = g.nude && TASK_DEFINITIONS[g.nude as TaskType];

            if (type === 'all') {
                if (hasClothed) nextTypes[g.clothed] = true;
                if (hasNude) nextTypes[g.nude!] = true;
            } else if (type === 'none') {
                if (hasClothed) nextTypes[g.clothed] = false;
                if (hasNude) nextTypes[g.nude!] = false;
            } else if (type === 'clothed') {
                if (hasClothed) nextTypes[g.clothed] = true;
            } else if (type === 'nude') {
                if (hasNude) nextTypes[g.nude!] = true;
            }
        });
        return { ...prev, taskTypes: nextTypes };
    });
  };

  const handleSaveConfig = () => {
    const filename = prompt('Enter a filename:', 'lineartify_config');
    if (!filename) return;
    const blob = new Blob([JSON.stringify(options, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.klc`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleLoadConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.taskTypes) { setOptions(p => ({...p, ...parsed})); alert('Loaded.'); }
      } catch (err) { alert('Failed.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Render a Group Row
  const renderGroupRow = (group: typeof TASK_GROUPS[0]) => {
      const clothedKey = group.clothed as TaskType;
      const nudeKey = group.nude as TaskType | undefined;
      
      const hasClothed = !!TASK_DEFINITIONS[clothedKey];
      const hasNude = nudeKey && !!TASK_DEFINITIONS[nudeKey];

      if (!hasClothed && !hasNude) return null;

      const isClothedEnabled = options.taskTypes[clothedKey];
      const isNudeEnabled = hasNude ? options.taskTypes[nudeKey!] : false;

      const currentPriority = options.taskPriorities[clothedKey] || 'Normal';
      
      const handleGroupPriority = (p: PriorityLevel) => {
          setOptions(prev => {
              const next = { ...prev.taskPriorities };
              if (hasClothed) next[clothedKey] = p;
              if (hasNude) next[nudeKey!] = p;
              return { ...prev, taskPriorities: next };
          });
      };

      return (
          <div key={group.label} className="flex items-center bg-slate-800 border border-white/5 rounded-lg p-2 hover:border-white/10 transition-colors">
              {/* Label */}
              <div className="flex-1 min-w-0 pr-4">
                  <div className="text-xs font-bold text-slate-200 truncate" title={group.label}>{group.label}</div>
                  <div className="text-[9px] text-slate-500 truncate">{TASK_DEFINITIONS[clothedKey]?.description}</div>
              </div>

              {/* Checkboxes */}
              <div className="flex items-center space-x-3 mr-4">
                  {hasClothed && (
                      <button 
                        onClick={() => toggleTask(clothedKey)}
                        className={`flex items-center space-x-1.5 px-2 py-1 rounded border transition-all ${isClothedEnabled ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-white/10 text-slate-500 hover:border-slate-400'}`}
                      >
                         {isClothedEnabled ? <CheckSquare size={14} /> : <Square size={14} />}
                         <span className="text-[10px] font-bold uppercase">Clothed</span>
                      </button>
                  )}
                  
                  {hasNude && (
                       <button 
                        onClick={() => toggleTask(nudeKey!)}
                        className={`flex items-center space-x-1.5 px-2 py-1 rounded border transition-all ${isNudeEnabled ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-slate-900 border-white/10 text-slate-500 hover:border-slate-400'}`}
                      >
                         {isNudeEnabled ? <CheckSquare size={14} /> : <Square size={14} />}
                         <span className="text-[10px] font-bold uppercase">Nude</span>
                      </button>
                  )}
              </div>

              {/* Priority */}
              <div className="w-20 h-6 shrink-0">
                  <PrioritySelector priority={currentPriority} onChange={handleGroupPriority} />
              </div>
          </div>
      );
  };

  const categories = ['Scene', 'Group', 'Person', 'Style'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1e1e2e] w-[95vw] h-[95vh] rounded-xl shadow-2xl flex flex-col border border-slate-700 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shrink-0">
          <h2 className="text-xl font-bold text-white tracking-tight">Configuration</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={24} className="text-slate-400 hover:text-white" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900/50 shrink-0">
           <button onClick={() => setActiveTab(0)} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors ${activeTab === 0 ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}><Layers size={16} /> Tasks</button>
           <button onClick={() => setActiveTab(1)} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors ${activeTab === 1 ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}><Settings size={16} /> Advanced</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#13131f] custom-scrollbar flex flex-col">
          
          {/* TASKS TAB */}
          {activeTab === 0 && (
             <div className="flex flex-col h-full">
                 <div className="p-6 space-y-8 flex-1">
                    {categories.map(cat => (
                        <div key={cat}>
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest pl-1">{cat}s</h3>
                                <div className="flex gap-2">
                                     <button onClick={() => setGroupBulk(cat, 'clothed')} className="text-[10px] uppercase font-bold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/30 px-2 py-1 rounded transition-colors">All Clothed</button>
                                     <button onClick={() => setGroupBulk(cat, 'nude')} className="text-[10px] uppercase font-bold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/30 px-2 py-1 rounded transition-colors">All Nude</button>
                                     <button onClick={() => setGroupBulk(cat, 'all')} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-slate-700 px-2 py-1 rounded transition-colors">Select All</button>
                                     <button onClick={() => setGroupBulk(cat, 'none')} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-slate-700 px-2 py-1 rounded transition-colors">Select None</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {TASK_GROUPS.filter(g => g.category === cat).map(g => renderGroupRow(g))}
                            </div>
                        </div>
                    ))}
                 </div>
                 
                 {/* Bulk Actions Footer */}
                 <div className="p-4 bg-slate-800 border-t border-slate-700 shrink-0 flex items-center justify-between gap-4 sticky bottom-0 z-10">
                    <span className="text-xs font-bold text-slate-400 uppercase">Global Selection:</span>
                    <div className="flex gap-2 flex-1">
                        <button onClick={() => setBulk('clothed')} className="flex-1 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase rounded transition-colors">Select All Clothed</button>
                        <button onClick={() => setBulk('nude')} className="flex-1 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase rounded transition-colors">Select All Nude</button>
                        <button onClick={() => setBulk('all')} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 border border-white/10 text-white text-xs font-bold uppercase rounded transition-colors">Select All</button>
                        <button onClick={() => setBulk('none')} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 border border-white/10 text-slate-300 text-xs font-bold uppercase rounded transition-colors">Select None</button>
                    </div>
                 </div>
             </div>
          )}

          {/* ADVANCED TAB */}
          {activeTab === 1 && (
            <div className="p-8 space-y-8 max-w-4xl mx-auto w-full">
              
              {/* Model & Creativity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5">
                      <div className="flex items-center space-x-2 mb-4"><Cpu size={20} className="text-purple-400" /><h3 className="text-base font-bold text-slate-200">AI Model</h3></div>
                      <div className="flex bg-slate-900 rounded-lg p-1 border border-white/5">
                          <button onClick={() => setOptions(prev => ({...prev, modelPreference: 'flash'}))} className={`flex-1 py-3 rounded text-sm font-bold transition-colors ${options.modelPreference === 'flash' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Flash (Fast)</button>
                          <button onClick={() => setOptions(prev => ({...prev, modelPreference: 'pro'}))} className={`flex-1 py-3 rounded text-sm font-bold transition-colors ${options.modelPreference === 'pro' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>Pro (High Qual)</button>
                      </div>
                      <p className="text-xs text-slate-500 mt-3 leading-relaxed">Flash is faster and cheaper. Pro (Gemini 3) follows complex instructions better and supports native 4K.</p>
                  </div>

                  <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5">
                      <div className="flex items-center space-x-2 mb-4"><Sparkles size={20} className="text-amber-400" /><h3 className="text-base font-bold text-slate-200">Creativity (Temperature)</h3></div>
                      <input type="range" min="0" max="1" step="0.1" value={options.creativity ?? 0.4} onChange={(e) => setOptions(prev => ({...prev, creativity: parseFloat(e.target.value)}))} className="w-full h-2 bg-slate-700 rounded-lg accent-amber-500 cursor-pointer" />
                      <div className="flex justify-between text-xs font-mono text-slate-400 mt-3"><span>Strict (0.0)</span><span className="text-amber-400 font-bold bg-amber-500/10 px-2 rounded">{options.creativity ?? 0.4}</span><span>Wild (1.0)</span></div>
                  </div>
              </div>

              {/* Detail Level */}
              <div className="bg-slate-800/40 p-8 rounded-xl border border-white/5">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-6">Detail Level</h3>
                  <div className="relative pt-2">
                       <input type="range" min="0" max="4" step="1" value={['Very Low', 'Low', 'Medium', 'High', 'Very High'].indexOf(options.detailLevel)} onChange={(e) => setOptions(prev => ({...prev, detailLevel: ['Very Low', 'Low', 'Medium', 'High', 'Very High'][parseInt(e.target.value)]}))} className="w-full h-2 bg-slate-700 rounded-lg accent-indigo-500 cursor-pointer relative z-10" />
                       <div className="flex justify-between mt-4">
                           {['Very Low', 'Low', 'Medium', 'High', 'Very High'].map((l, i) => (
                               <div key={l} className="flex flex-col items-center cursor-pointer" onClick={() => setOptions(prev => ({...prev, detailLevel: l}))}>
                                   <div className={`w-1 h-2 mb-2 ${options.detailLevel === l ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                                   <span className={`text-[10px] font-bold uppercase tracking-wider ${options.detailLevel === l ? 'text-indigo-400' : 'text-slate-600'}`}>{l}</span>
                               </div>
                           ))}
                       </div>
                  </div>
              </div>

              {/* Gender */}
              <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">Target Gender Bias</h3>
                  <div className="flex flex-wrap gap-3">
                      {['As-is', 'Female', 'Male', 'Non-binary', 'Transgender'].map(g => (
                          <button key={g} onClick={() => setOptions(prev => ({...prev, gender: g}))} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all ${options.gender === g ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-slate-800 hover:border-slate-500'}`}>{g}</button>
                      ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-3"><Info size={12} className="inline mr-1"/> Forces the AI to interpret ambiguous subjects as the selected gender.</p>
              </div>

              {/* Custom Style */}
              <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">Custom Style Injection</h3>
                  <textarea value={options.customStyle || ''} onChange={(e) => setOptions(prev => ({...prev, customStyle: e.target.value}))} placeholder="E.g., 'Art Nouveau', 'Cyberpunk', 'Thick Lines'..." className="w-full h-24 bg-black/30 border border-white/10 rounded-lg p-4 text-sm text-slate-200 resize-none font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-600" />
                  <p className="text-xs text-slate-500 mt-2">These instructions are appended to the system prompt. Use this to enforce specific artistic directions not covered by presets.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-700 flex justify-between shrink-0 backdrop-blur">
            <div className="flex space-x-3">
                <button onClick={handleSaveConfig} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors border border-white/5" title="Save Config"><Download size={16} /> <span>Save Preset</span></button>
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors border border-white/5" title="Load Config"><Upload size={16} /> <span>Load Preset</span></button>
                <input type="file" ref={fileInputRef} hidden accept=".klc" onChange={handleLoadConfig} />
            </div>
            <button onClick={onClose} className="px-8 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all hover:scale-105">Done</button>
        </div>
      </div>
    </div>
  );
};

export default OptionsDialog;