
import React, { useState } from 'react';
import { X, Layers, User, Settings } from 'lucide-react';
import { AppOptions, TaskType } from '../types';
import { TASK_DEFINITIONS } from '../services/taskDefinitions';

interface OptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  options: AppOptions;
  setOptions: React.Dispatch<React.SetStateAction<AppOptions>>;
}

const OptionsDialog: React.FC<OptionsDialogProps> = ({ isOpen, onClose, options, setOptions }) => {
  const [activeTab, setActiveTab] = useState<number>(0);

  if (!isOpen) return null;

  const toggleTask = (key: keyof AppOptions['taskTypes']) => {
    setOptions(prev => ({
      ...prev,
      taskTypes: { ...prev.taskTypes, [key]: !prev.taskTypes[key] }
    }));
  };

  const detailLevels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
  const currentDetailIndex = detailLevels.indexOf(options.detailLevel);
  // Fallback if current option isn't in list (e.g. from old state)
  const sliderValue = currentDetailIndex === -1 ? 2 : currentDetailIndex; 

  const genderOptions = ['As-is', 'Female', 'Male', 'Non-binary', 'Androgynous', 'Transgender', 'Intersex'];

  // Group definitions by category
  const sceneTasks = Object.values(TASK_DEFINITIONS).filter(t => t.category === 'Scene' || t.category === 'Group');
  const personTasks = Object.values(TASK_DEFINITIONS).filter(t => t.category === 'Person');

  // Helper to map TaskDef ID to Options Key (converting kebab-case to camelCase for legacy options keys if needed)
  // Or ensuring keys match. In AppOptions, we have: full, background, allPeople, allPeopleNude, model, backside, nude, nudeOpposite, modelFull, face
  // We need to map task IDs to these keys.
  const taskKeyMap: Record<string, keyof AppOptions['taskTypes']> = {
      'full': 'full',
      'background': 'background',
      'all-people': 'allPeople',
      'all-people-nude': 'allPeopleNude',
      'model': 'model',
      'face': 'face',
      'model-full': 'modelFull',
      'backside': 'backside',
      'nude': 'nude',
      'nude-opposite': 'nudeOpposite',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1e1e2e] w-[95vw] h-[95vh] rounded-xl shadow-2xl flex flex-col border border-slate-700 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shrink-0">
          <h2 className="text-xl font-bold text-white">Configuration</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900/50 shrink-0">
           <button 
             onClick={() => setActiveTab(0)} 
             className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 0 ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50'}`}
           >
             <Layers size={16} /> Types
           </button>
           <button 
             onClick={() => setActiveTab(1)} 
             className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 1 ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50'}`}
           >
             <User size={16} /> Gender
           </button>
           <button 
             onClick={() => setActiveTab(2)} 
             className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 2 ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50'}`}
           >
             <Settings size={16} /> Quality
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-y-auto bg-[#13131f]">
          
          {/* Page 1: Types */}
          {activeTab === 0 && (
            <div className="max-w-4xl mx-auto space-y-8">
              <section>
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-6 border-b border-white/10 pb-2">Scene & Group Generation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sceneTasks.map(task => {
                      const key = taskKeyMap[task.id];
                      if (!key) return null;
                      return (
                        <label key={task.id} className="flex items-start p-4 bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-800 border border-white/5 transition-colors">
                            <input type="checkbox" checked={options.taskTypes[key]} onChange={() => toggleTask(key)} className="mt-1 accent-indigo-500 w-5 h-5" />
                            <div className="ml-4">
                            <span className="block font-medium text-white text-lg">{task.label}</span>
                            <span className="block text-sm text-slate-400 mt-1">{task.description}</span>
                            </div>
                        </label>
                      );
                  })}
                </div>
              </section>

              <section>
                 <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-6 border-b border-white/10 pb-2">Person Extraction Tasks</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {personTasks.map(task => {
                        const key = taskKeyMap[task.id];
                        if (!key) return null;
                        return (
                            <label key={task.id} className="flex items-start p-4 bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-800 border border-white/5 transition-colors">
                                <input type="checkbox" checked={options.taskTypes[key]} onChange={() => toggleTask(key)} className="mt-1 accent-indigo-500 w-5 h-5" />
                                <div className="ml-4">
                                    <span className="block font-medium text-white">{task.label}</span>
                                    <span className="block text-xs text-slate-400 mt-1">{task.description}</span>
                                </div>
                            </label>
                        );
                    })}
                 </div>
              </section>
            </div>
          )}

          {/* Page 2: Gender */}
          {activeTab === 1 && (
            <div className="max-w-4xl mx-auto space-y-6">
              <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-6 border-b border-white/10 pb-2">Target Gender Adjustment</h3>
              <p className="text-lg text-slate-300 mb-8">Force the AI to interpret ambiguous figures as a specific gender, or leave as "As-is" for natural interpretation based on the image.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {genderOptions.map((g) => (
                    <label key={g} className={`flex items-center space-x-4 p-6 rounded-xl border cursor-pointer transition-all ${options.gender === g ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/50 border-white/5 hover:bg-slate-800'}`}>
                        <input 
                            type="radio" 
                            name="gender" 
                            value={g} 
                            checked={options.gender === g}
                            onChange={(e) => setOptions(prev => ({...prev, gender: e.target.value}))}
                            className="accent-indigo-500 w-6 h-6"
                        />
                        <span className={`text-lg font-medium ${options.gender === g ? 'text-indigo-300' : 'text-slate-300'}`}>{g}</span>
                    </label>
                 ))}
              </div>
            </div>
          )}

          {/* Page 3: Quality */}
          {activeTab === 2 && (
             <div className="max-w-4xl mx-auto space-y-8">
               <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-6 border-b border-white/10 pb-2">Detail & Style Quality</h3>
               
               <div className="bg-slate-800/50 p-10 rounded-2xl border border-white/5">
                  <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest mb-8">
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
                    className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="mt-10 text-center">
                     <span className="text-indigo-400 font-bold text-3xl">{options.detailLevel} Detail</span>
                     <p className="text-lg text-slate-300 mt-4 max-w-2xl mx-auto">
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
        <div className="p-6 bg-slate-900/50 border-t border-slate-700 flex justify-end shrink-0">
            <button onClick={onClose} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-lg transition-colors shadow-lg">
                Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default OptionsDialog;
