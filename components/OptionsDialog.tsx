import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Layers, Settings, Save, Upload, Download, Cpu, Sparkles, CheckSquare, Square, Info, Check, Shield, Palette, Sliders, Scissors, PenTool, Eraser, ChevronDown, ChevronRight, FileImage } from 'lucide-react';
import { AppOptions, TaskType, PriorityLevel } from '../types';
import { TASK_DEFINITIONS } from '../services/taskDefinitions';

interface OptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  options: AppOptions;
  setOptions: React.Dispatch<React.SetStateAction<AppOptions>>;
}

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
    'None', 'Left Hand', 'Right Hand', 'Both Hands', 
    'Object', 'Veil', 'Long Hair', 'Steam', 'Shadow',
    'Censorship Bar', 'Pixelation', 'Blur', 'Bright Light', 'Lens Flare',
    'Floating Fabric', 'Ribbons', 'Flowers', 'Leaves', 'Vines',
    'Feathers', 'Wings', 'Bubbles', 'Foam', 'Water Splash',
    'Smoke', 'Mist', 'Fog', 'Clouds', 'Fire',
    'Cybernetic Plate', 'Armor Piece', 'Bandages', 'Towel', 'Robe',
    'Blanket', 'Pillow', 'Book', 'Laptop', 'Pet',
    'Floating Rocks', 'Abstract Shapes', 'Geometry'
];

const HAIR_DENSITIES = [
    'Default', 'None', 'Stubble', 'Light', 'Medium', 'Heavy', 'Bushy', 'Long', 'Braided'
];

// Comprehensive list of body hair zones (27 items)
const BODY_HAIR_ZONES = [
    // FACE
    { id: 'eyebrows', label: 'Eyebrows', group: 'Face' },
    { id: 'unibrow', label: 'Unibrow', group: 'Face' },
    { id: 'upperLip', label: 'Mustache', group: 'Face' },
    { id: 'chin', label: 'Chin/Goatee', group: 'Face' },
    { id: 'jawline', label: 'Beard', group: 'Face' },
    { id: 'cheeks', label: 'Cheek Fuzz', group: 'Face' },
    { id: 'sideburns', label: 'Sideburns', group: 'Face' },
    { id: 'neckFront', label: 'Neck (Front)', group: 'Face' },
    // TORSO
    { id: 'neckBack', label: 'Neck (Back)', group: 'Torso' },
    { id: 'shoulders', label: 'Shoulders', group: 'Torso' },
    { id: 'chest', label: 'Chest', group: 'Torso' },
    { id: 'nipples', label: 'Nipples', group: 'Torso' },
    { id: 'upperStomach', label: 'Upper Stomach', group: 'Torso' },
    { id: 'happyTrail', label: 'Happy Trail', group: 'Torso' },
    { id: 'upperBack', label: 'Upper Back', group: 'Torso' },
    { id: 'lowerBack', label: 'Lower Back', group: 'Torso' },
    // ARMS
    { id: 'armpits', label: 'Armpits', group: 'Arms' },
    { id: 'upperArms', label: 'Upper Arms', group: 'Arms' },
    { id: 'elbows', label: 'Elbows', group: 'Arms' },
    { id: 'forearms', label: 'Forearms', group: 'Arms' },
    { id: 'hands', label: 'Hands', group: 'Arms' },
    // LEGS
    { id: 'pubic', label: 'Pubic Area', group: 'Legs' },
    { id: 'buttocks', label: 'Buttocks', group: 'Legs' },
    { id: 'thighs', label: 'Thighs', group: 'Legs' },
    { id: 'knees', label: 'Knees', group: 'Legs' },
    { id: 'calves', label: 'Calves/Shins', group: 'Legs' },
    { id: 'feet', label: 'Feet/Toes', group: 'Legs' },
];

const HAIR_GROUPS = ['Face', 'Torso', 'Arms', 'Legs'];

const STYLE_SUBCATEGORIES = [
    'Comics', 
    'Manga/Anime', 
    'Fantasy/Sci-Fi', 
    'Artistic', 
    'Technique', 
    'Erotic', 
    'Print/Graphic', 
    'Historical',
    'Misc'
];

const CUSTOM_DEFAULTS = [
    { label: "Cyberpunk City", value: "Background: Neon-lit cyberpunk city, high-tech skyscrapers, rain-slicked streets, holograms.", tooltip: "Futuristic urban environment" },
    { label: "Fantasy Forest", value: "Background: Enchanted forest, ancient trees, glowing mushrooms, fireflies, magical atmosphere.", tooltip: "Magical nature setting" },
    { label: "Space Station", value: "Background: Sci-fi space station interior, white panels, hexagonal windows looking out to stars.", tooltip: "Clean sci-fi interior" },
    { label: "Post-Apocalyptic", value: "Background: Ruined city, overgrown vegetation, crumbling concrete, dusty atmosphere.", tooltip: "Destroyed civilization" },
    { label: "Underwater", value: "Background: Underwater coral reef, bubbles, shafts of light, fish, aquatic plants.", tooltip: "Submerged scene" },
    { label: "Desert", value: "Background: Vast desert dunes, scorching sun, heat haze, ancient ruins in distance.", tooltip: "Hot sandy environment" },
    { label: "Snowy Peak", value: "Background: Snowy mountain peak, blizzard, jagged rocks, icy atmosphere.", tooltip: "Cold alpine setting" },
    { label: "Castle", value: "Background: Medieval castle throne room, stone walls, banners, torches, regal atmosphere.", tooltip: "Medieval interior" },
    { label: "Dojo", value: "Background: Traditional Japanese dojo, tatami mats, shoji screens, calligraphy scrolls.", tooltip: "Martial arts setting" },
    { label: "Cyber Armor", value: "Clothing: Wearing high-tech cybernetic power armor, glowing circuits, metallic plating.", tooltip: "Sci-fi combat gear" },
    { label: "Fantasy Plate", value: "Clothing: Wearing ornate medieval plate armor, engravings, cape, pauldrons.", tooltip: "Knight armor" },
    { label: "School Uniform", value: "Clothing: Wearing Japanese school uniform (Seifuku), pleated skirt, sailor collar.", tooltip: "Anime trope" },
    { label: "Kimono", value: "Clothing: Wearing elaborate floral Kimono, obi sash, traditional hair ornaments.", tooltip: "Traditional Japanese" },
    { label: "Business Suit", value: "Clothing: Wearing sharp tailored business suit, tie, professional look.", tooltip: "Formal office wear" },
    { label: "Hoodie & Jeans", value: "Clothing: Wearing casual oversized hoodie and denim jeans, sneakers, relaxed look.", tooltip: "Modern casual" },
    { label: "Steampunk", value: "Clothing: Wearing steampunk outfit, leather corset, brass goggles, gears, victorian influence.", tooltip: "Retro-future style" },
    { label: "Tactical Gear", value: "Clothing: Wearing military tactical gear, vest, cargo pants, boots, pouches.", tooltip: "Modern combat" },
    { label: "Lab Coat", value: "Clothing: Wearing white science lab coat, glasses, pens in pocket, smart look.", tooltip: "Scientist attire" },
    { label: "Ballgown", value: "Clothing: Wearing elegant victorian ballgown, ruffles, lace, corset, wide skirt.", tooltip: "Formal historical" },
    { label: "Noir Lighting", value: "Lighting: Dramatic film noir lighting, heavy shadows, venetian blind slats, high contrast.", tooltip: "Moody atmosphere" },
    { label: "Neon Rim", value: "Lighting: Strong neon rim lighting (blue/pink), dark background, synthwave aesthetic.", tooltip: "Colorful outlines" },
    { label: "Ethereal Glow", value: "Lighting: Soft ethereal glow, bloom effect, angelic lighting, low contrast.", tooltip: "Dreamy lighting" },
    { label: "Wide Angle", value: "Camera: Wide angle lens, slight distortion, dynamic perspective, expanded background.", tooltip: "Action camera" },
    { label: "Macro", value: "Camera: Macro lens, extreme close-up details, shallow depth of field, blurred background.", tooltip: "Close detail" },
    { label: "Glitch", value: "Effect: Digital glitch aesthetic, datamoshing, pixel sorting, chromatic aberration.", tooltip: "Digital error style" },
    { label: "Double Exposure", value: "Effect: Double exposure photography, silhouette filled with galaxy/forest texture.", tooltip: "Artistic overlay" }
];

const OptionsDialog: React.FC<OptionsDialogProps> = ({ isOpen, onClose, options, setOptions }) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isSaveMode, setIsSaveMode] = useState(false);
  const [presetName, setPresetName] = useState("lineartify-preset");
  const [hoveredStyle, setHoveredStyle] = useState<TaskType | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize expanded state logic
  useEffect(() => {
    if (isOpen) {
        const initialExpanded: Record<string, boolean> = {};
        STYLE_SUBCATEGORIES.forEach(cat => {
            const hasSelection = Object.keys(options.taskTypes).some(key => {
                 const def = TASK_DEFINITIONS[key as TaskType];
                 return def && def.category === 'Style' && def.subCategory === cat && options.taskTypes[key];
            });
            initialExpanded[cat] = hasSelection;
        });
        setExpandedCategories(initialExpanded);
    }
  }, [isOpen]); // Re-evaluate when dialog opens

  const stats = useMemo(() => {
    let total = 0;
    let clothed = 0;
    let nude = 0;
    let topless = 0;
    let bottomless = 0;

    Object.entries(options.taskTypes).forEach(([key, enabled]) => {
        if (!enabled) return;
        
        // Skip utility tasks (Scanner, Name Gen, Upscale)
        const def = TASK_DEFINITIONS[key as TaskType];
        if (!def || def.category === 'Utility') return;

        total++;
        if (key.endsWith('-nude') || key === 'all-people-nude' || key === 'full-nude') {
            nude++;
        } else if (key.endsWith('-topless')) {
            topless++;
        } else if (key.endsWith('-bottomless')) {
            bottomless++;
        } else {
            clothed++;
        }
    });

    return { total, clothed, nude, topless, bottomless };
  }, [options.taskTypes]);

  if (!isOpen) return null;

  const toggleTask = (key: string) => {
    if (!TASK_DEFINITIONS[key as TaskType]) return;
    setOptions(prev => ({
      ...prev,
      taskTypes: { ...prev.taskTypes, [key]: !prev.taskTypes[key] }
    }));
  };

  const toggleCategory = (cat: string) => {
      setExpandedCategories(prev => ({...prev, [cat]: !prev[cat]}));
  };

  const updateBodyHair = (zoneId: string, value: string) => {
      setOptions(prev => ({
          ...prev,
          bodyHair: {
              ...prev.bodyHair,
              [zoneId]: value
          }
      }));
  };

  const updateStylePriority = (styleId: string, val: string) => {
      const num = Math.min(100, Math.max(1, parseInt(val) || 1));
      setOptions(prev => ({
          ...prev,
          stylePriorities: {
              ...prev.stylePriorities,
              [styleId]: num
          }
      }));
  };
  
  const resetBodyHair = () => {
      setOptions(prev => ({ ...prev, bodyHair: {} }));
  };

  const setSmoothBodyHair = () => {
      const newHair: Record<string, string> = {};
      const exemptZones = ['eyebrows', 'armpits', 'pubic'];
      
      BODY_HAIR_ZONES.forEach(zone => {
          if (exemptZones.includes(zone.id)) {
              // Set to default (delete key or explicitly set Default)
              newHair[zone.id] = 'Default';
          } else {
              newHair[zone.id] = 'None';
          }
      });
      setOptions(prev => ({ ...prev, bodyHair: newHair }));
  };

  const performSave = () => {
    try {
        const finalName = presetName.trim() || "lineartify-preset";
        const fullName = finalName.endsWith('.klc') ? finalName : `${finalName}.klc`;

        // Create a structured save object
        const savePackage = {
            version: 2,
            type: 'lineartify-preset',
            timestamp: Date.now(),
            data: {
                taskTypes: { ...options.taskTypes },
                taskPriorities: { ...options.taskPriorities },
                stylePriorities: { ...options.stylePriorities },
                gender: options.gender,
                detailLevel: options.detailLevel,
                modelPreference: options.modelPreference,
                creativity: options.creativity,
                customStyle: options.customStyle,
                modesty: options.modesty,
                bodyHair: options.bodyHair,
                outputFormat: options.outputFormat
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
                },
                stylePriorities: {
                    ...prev.stylePriorities,
                    ...(loadedOptions.stylePriorities || {})
                },
                bodyHair: {
                    ...prev.bodyHair,
                    ...(loadedOptions.bodyHair || {})
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
       // Helper to collect style keys
       Object.keys(TASK_DEFINITIONS).forEach(k => {
           const def = TASK_DEFINITIONS[k as TaskType];
           if (def.category === 'Style') styleKeys.push(k);
       });
       setAll(styleKeys, false);
  };

  const getTabClass = (index: number) => `flex-1 py-4 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === index ? 'text-purple-400 border-purple-500 bg-[#2d2a3d]' : 'text-slate-400 border-transparent hover:bg-[#2d2a3d]/50 hover:text-slate-200'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm text-slate-200">
      <div className="bg-[#1e1c2e] w-[95vw] h-[95vh] rounded-xl shadow-2xl flex flex-col border border-white/10 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#252233] border-b border-white/5 shrink-0">
          <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-white tracking-tight">Configuration</h2>
              
              {/* Stats Badge */}
              <div className="hidden md:flex items-center gap-3 text-xs font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                  <div className="flex items-center gap-1.5 pr-3 border-r border-white/10">
                      <span className="text-slate-400 font-bold uppercase">Est. Images</span>
                      <span className="text-white font-bold text-sm">{stats.total}</span>
                  </div>
                  <div className="flex items-center gap-3">
                       {stats.clothed > 0 && <span className="text-purple-400 font-bold">{stats.clothed} Clothed</span>}
                       {stats.nude > 0 && <span className="text-rose-400 font-bold">{stats.nude} Nude</span>}
                       {stats.topless > 0 && <span className="text-amber-400 font-bold">{stats.topless} Topless</span>}
                       {stats.bottomless > 0 && <span className="text-amber-400 font-bold">{stats.bottomless} Bottomless</span>}
                       {stats.total === 0 && <span className="text-slate-600 italic">No tasks selected</span>}
                  </div>
              </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={24} className="text-slate-400 hover:text-white" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#1a1825] shrink-0">
           <button onClick={() => setActiveTab(0)} className={getTabClass(0)}><Layers size={16} /> Tasks</button>
           <button onClick={() => setActiveTab(1)} className={getTabClass(1)}><Palette size={16} /> Styles</button>
           <button onClick={() => setActiveTab(2)} className={getTabClass(2)}><Cpu size={16} /> Advanced</button>
           <button onClick={() => setActiveTab(3)} className={getTabClass(3)}><Sliders size={16} /> Modifiers</button>
           <button onClick={() => setActiveTab(4)} className={getTabClass(4)}><Scissors size={16} /> Hair</button>
           <button onClick={() => setActiveTab(5)} className={getTabClass(5)}><PenTool size={16} /> Custom</button>
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
              <div 
                  className="p-8 pb-24 max-w-7xl mx-auto w-full relative"
                  onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
              >
                 <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4 sticky top-0 bg-[#13111c] z-20">
                     <h3 className="text-lg font-bold text-purple-400 uppercase tracking-widest">Art Styles Library</h3>
                     <div className="flex gap-2">
                         <button onClick={resetStyles} className="text-xs uppercase font-bold text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded flex items-center gap-2"><X size={14}/> Reset Styles</button>
                     </div>
                 </div>
                 
                 <div className="space-y-4">
                 {STYLE_SUBCATEGORIES.map(category => {
                     const catStyles = Object.keys(TASK_DEFINITIONS)
                         .filter(k => {
                             const def = TASK_DEFINITIONS[k as TaskType];
                             return def.category === 'Style' && !k.endsWith('-nude') && !k.endsWith('-topless') && !k.endsWith('-bottomless') && (def.subCategory === category || (!def.subCategory && category === 'Misc'));
                         })
                         .sort((a, b) => TASK_DEFINITIONS[a as TaskType].label.localeCompare(TASK_DEFINITIONS[b as TaskType].label));
                     
                     if (catStyles.length === 0) return null;

                     const isExpanded = expandedCategories[category];

                     // Counts
                     const clothedCount = catStyles.filter(k => options.taskTypes[k]).length;
                     const nudeCount = catStyles.filter(k => options.taskTypes[`${k}-nude` as TaskType]).length;
                     const toplessCount = catStyles.filter(k => options.taskTypes[`${k}-topless` as TaskType]).length;
                     const bottomlessCount = catStyles.filter(k => options.taskTypes[`${k}-bottomless` as TaskType]).length;
                     
                     return (
                         <div key={category} className="border border-white/5 rounded-lg bg-slate-800/20 overflow-hidden">
                             {/* Category Header */}
                             <div 
                                onClick={() => toggleCategory(category)}
                                className="px-4 py-3 bg-slate-800/50 flex items-center justify-between cursor-pointer hover:bg-slate-700/50 transition-colors"
                             >
                                 <div className="flex items-center gap-3">
                                     <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                        <ChevronRight size={18} className="text-slate-400" />
                                     </div>
                                     <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">{category}</h4>
                                 </div>
                                 <div className="flex items-center gap-3 text-[10px] font-bold uppercase text-slate-500">
                                     {clothedCount > 0 && <span className="text-purple-400">{clothedCount} Clothed</span>}
                                     {nudeCount > 0 && <span className="text-rose-400">{nudeCount} Nude</span>}
                                     {(toplessCount > 0 || bottomlessCount > 0) && <span className="text-amber-400">{toplessCount + bottomlessCount} Partial</span>}
                                     {clothedCount === 0 && nudeCount === 0 && toplessCount === 0 && bottomlessCount === 0 && <span className="opacity-50">No Selection</span>}
                                 </div>
                             </div>

                             {isExpanded && (
                                <div className="p-4 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-2">
                                    {catStyles.map(styleKey => {
                                        const def = TASK_DEFINITIONS[styleKey as TaskType];
                                        const nudeKey = `${styleKey}-nude` as TaskType;
                                        const toplessKey = `${styleKey}-topless` as TaskType;
                                        const bottomlessKey = `${styleKey}-bottomless` as TaskType;

                                        const isEnabled = options.taskTypes[styleKey];
                                        const isNudeEnabled = options.taskTypes[nudeKey];
                                        const isToplessEnabled = options.taskTypes[toplessKey];
                                        const isBottomlessEnabled = options.taskTypes[bottomlessKey];

                                        const priority = options.stylePriorities?.[styleKey] || 1;

                                        return (
                                            <div 
                                                key={styleKey} 
                                                className="rounded-lg border overflow-hidden flex flex-col bg-slate-800/50 border-white/5 relative group"
                                                onMouseEnter={() => setHoveredStyle(styleKey as TaskType)}
                                                onMouseLeave={() => setHoveredStyle(null)}
                                            >
                                                {/* Header */}
                                                <div className="px-3 py-2 bg-slate-900/50 border-b border-white/5 flex items-center justify-between">
                                                    <div className="text-xs font-bold uppercase text-slate-300 truncate mr-2" title={def.label}>{def.label}</div>
                                                </div>
                                                
                                                {/* Priority Input */}
                                                <div className="px-3 py-1.5 bg-black/20 border-b border-white/5 flex items-center justify-between text-[10px]">
                                                    <span className="text-slate-500 uppercase font-bold">Priority</span>
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        max="100" 
                                                        value={priority}
                                                        onChange={(e) => updateStylePriority(styleKey, e.target.value)}
                                                        className="w-12 bg-slate-800 border border-white/10 rounded px-1 py-0.5 text-center text-slate-300 focus:outline-none focus:border-purple-500"
                                                        title="Execution Priority (1-100)"
                                                    />
                                                </div>

                                                {/* Controls */}
                                                <div className="flex flex-col">
                                                    {/* Clothed & Nude */}
                                                    <div className="flex border-b border-white/5">
                                                        <button 
                                                            onClick={() => toggleTask(styleKey)} 
                                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors border-r border-white/5 ${isEnabled ? 'bg-purple-600/10 text-purple-400' : 'hover:bg-slate-700 text-slate-400'}`}
                                                            title="Clothed"
                                                        >
                                                            {isEnabled ? <CheckSquare size={12} /> : <Square size={12} />}
                                                            <span className="text-[9px] font-bold uppercase">Clothed</span>
                                                        </button>
                                                        
                                                        {TASK_DEFINITIONS[nudeKey] && (
                                                            <button 
                                                                onClick={() => toggleTask(nudeKey)} 
                                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${isNudeEnabled ? 'bg-rose-500/10 text-rose-400' : 'hover:bg-slate-700 text-slate-400'}`}
                                                                title="Nude"
                                                            >
                                                                {isNudeEnabled ? <CheckSquare size={12} /> : <Square size={12} />}
                                                                <span className="text-[9px] font-bold uppercase">Nude</span>
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Partial (Topless/Bottomless) */}
                                                    {TASK_DEFINITIONS[toplessKey] && TASK_DEFINITIONS[bottomlessKey] && (
                                                        <div className="flex">
                                                            <button 
                                                                onClick={() => toggleTask(toplessKey)} 
                                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors border-r border-white/5 ${isToplessEnabled ? 'bg-amber-500/10 text-amber-400' : 'hover:bg-slate-700 text-slate-400'}`}
                                                                title="Topless"
                                                            >
                                                                {isToplessEnabled ? <CheckSquare size={12} /> : <Square size={12} />}
                                                                <span className="text-[9px] font-bold uppercase">Topless</span>
                                                            </button>
                                                            
                                                            <button 
                                                                onClick={() => toggleTask(bottomlessKey)} 
                                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${isBottomlessEnabled ? 'bg-amber-500/10 text-amber-400' : 'hover:bg-slate-700 text-slate-400'}`}
                                                                title="Bottomless"
                                                            >
                                                                {isBottomlessEnabled ? <CheckSquare size={12} /> : <Square size={12} />}
                                                                <span className="text-[9px] font-bold uppercase">Botless</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                             )}
                         </div>
                     );
                 })}
                 </div>

                 {/* TOOLTIP OVERLAY */}
                 {hoveredStyle && TASK_DEFINITIONS[hoveredStyle] && (
                     <div 
                         className="fixed z-50 bg-slate-900/95 border border-purple-500/50 p-6 rounded-xl shadow-2xl backdrop-blur-md pointer-events-none min-w-[320px] max-w-[400px]"
                         style={{
                             top: mousePos.y, 
                             left: mousePos.x > window.innerWidth / 2 ? mousePos.x - 50 : mousePos.x + 50,
                             transform: mousePos.x > window.innerWidth / 2 ? 'translate(-100%, -50%)' : 'translate(0, -50%)'
                         }}
                     >
                         <div className="flex items-center gap-3 mb-3">
                             <Scissors className="text-purple-400 w-8 h-8" />
                             <h4 className="font-bold text-white text-2xl uppercase tracking-wide">{TASK_DEFINITIONS[hoveredStyle].label}</h4>
                         </div>
                         <p className="text-base text-slate-300 leading-relaxed mb-4 font-medium">{TASK_DEFINITIONS[hoveredStyle].description}</p>
                         <div className="text-sm text-slate-400 font-mono bg-black/40 p-3 rounded border border-white/10 leading-relaxed">
                            {/* Extract key definition keywords for context */}
                            {TASK_DEFINITIONS[hoveredStyle].prompt({gender: 'Female', detailLevel: 'Medium', personDescription: '', customStyle: '', modesty: '', bodyHair: {}})
                                .split('STYLE GUIDE:')[1]?.split('\n')[0]?.trim() || "No detailed style guide available."}
                         </div>
                     </div>
                 )}
              </div>
          )}

          {/* ADVANCED TAB */}
          {activeTab === 2 && (
            <div className="p-8 space-y-8 max-w-4xl mx-auto w-full">
              
              {/* Output Format Section */}
              <div className="bg-slate-800/20 p-6 rounded-xl border border-white/5">
                  <div className="flex items-center space-x-2 mb-4"><FileImage size={20} className="text-emerald-400" /><h3 className="text-base font-bold text-slate-200">Output Format</h3></div>
                  <div className="flex bg-slate-900 rounded-lg p-1 border border-white/5">
                      <button onClick={() => setOptions(prev => ({...prev, outputFormat: 'png'}))} className={`flex-1 py-3 rounded text-sm font-bold transition-colors ${options.outputFormat === 'png' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>PNG (Transparent)</button>
                      <button onClick={() => setOptions(prev => ({...prev, outputFormat: 'jpg'}))} className={`flex-1 py-3 rounded text-sm font-bold transition-colors ${options.outputFormat === 'jpg' ? 'bg-emerald-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>JPG (with EXIF)</button>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                      PNG supports transparency but has no metadata. <br/>
                      JPG replaces transparency with white but includes rich EXIF metadata (Copyright, GPS, Description).
                  </p>
              </div>

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
                                   <span className={`text-xs font-bold uppercase tracking-wider ${options.detailLevel === l ? 'text-purple-400' : 'text-slate-600'}`}>{l}</span>
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
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto custom-scrollbar p-1">
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
                              <button key={g} onClick={() => setOptions(prev => ({...prev, gender: g}))} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all ${options.gender === g ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-slate-800'}`}>{g}</button>
                          ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-3"><Info size={12} className="inline mr-1"/> Forces the AI to interpret ambiguous subjects as the selected gender.</p>
                  </div>
              </div>
          )}

          {/* HAIR TAB */}
          {activeTab === 4 && (
              <div className="p-8 max-w-7xl mx-auto w-full">
                  <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-purple-400 uppercase tracking-wide">Body Hair Configuration</h3>
                        <p className="text-sm text-slate-500 mt-1">Granular control over hair density for specific body zones. Default uses AI discretion.</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={setSmoothBodyHair} className="text-xs uppercase font-bold text-emerald-400 hover:text-white bg-slate-800 hover:bg-emerald-600 px-3 py-1.5 rounded flex items-center gap-2 border border-emerald-500/30 transition-colors"><Eraser size={14}/> Preset: Smooth Body</button>
                        <button onClick={resetBodyHair} className="text-xs uppercase font-bold text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded flex items-center gap-2 border border-white/5 hover:border-white/10"><X size={14}/> Reset All</button>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {HAIR_GROUPS.map(group => (
                          <div key={group} className="space-y-4">
                              <div className="pb-2 border-b border-white/10 text-sm font-bold text-slate-300 uppercase tracking-wider">{group}</div>
                              {BODY_HAIR_ZONES.filter(z => z.group === group).map(zone => {
                                  const currentValue = options.bodyHair?.[zone.id] || 'Default';
                                  
                                  // Dynamic Color logic for selector
                                  const getDensityColor = (val: string) => {
                                      if (val === 'None') return 'text-sky-300 bg-sky-900/20 border-sky-500/30';
                                      if (['Stubble', 'Light'].includes(val)) return 'text-emerald-300 bg-emerald-900/20 border-emerald-500/30';
                                      if (['Medium', 'Heavy'].includes(val)) return 'text-amber-300 bg-amber-900/20 border-amber-500/30';
                                      if (['Bushy', 'Long'].includes(val)) return 'text-rose-300 bg-rose-900/20 border-rose-500/30';
                                      if (val === 'Default') return 'text-slate-400 bg-slate-800/50 border-white/5';
                                      return 'text-slate-200 bg-slate-800 border-white/10';
                                  };

                                  return (
                                      <div key={zone.id} className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-800/30 border border-white/5 hover:bg-slate-800/50 transition-colors">
                                          <div className="text-xs font-bold text-slate-300 uppercase">{zone.label}</div>
                                          <div className="relative">
                                              <select 
                                                  value={currentValue}
                                                  onChange={(e) => updateBodyHair(zone.id, e.target.value)}
                                                  className={`w-full appearance-none rounded px-3 py-2 text-xs font-bold uppercase border cursor-pointer outline-none focus:ring-1 focus:ring-purple-500 transition-all ${getDensityColor(currentValue)}`}
                                              >
                                                  {HAIR_DENSITIES.map(d => (
                                                      <option key={d} value={d} className="bg-[#1e1c2e] text-slate-300">{d}</option>
                                                  ))}
                                              </select>
                                              {/* Custom Arrow */}
                                              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                                  <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className="text-current"><path d="M0 0L5 6L10 0H0Z"/></svg>
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* CUSTOM TAB (NEW) */}
          {activeTab === 5 && (
               <div className="p-8 space-y-8 max-w-5xl mx-auto w-full">
                  
                  {/* Custom Style Input */}
                  <div className="bg-slate-800/20 p-6 rounded-xl border border-white/5">
                      <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest mb-4">Custom Style & Prompt Injection</h3>
                      <textarea value={options.customStyle || ''} onChange={(e) => setOptions(prev => ({...prev, customStyle: e.target.value}))} placeholder="E.g., 'Art Nouveau', 'Cyberpunk', 'Thick Lines'..." className="w-full h-32 bg-black/30 border border-white/10 rounded-lg p-4 text-sm text-slate-200 resize-none font-mono focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none placeholder:text-slate-600" />
                      <p className="text-xs text-slate-500 mt-2">These instructions are appended to the system prompt. Use this to enforce specific artistic directions not covered by presets.</p>
                  </div>

                  {/* Defaults Grid */}
                  <div>
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Presets</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                           {CUSTOM_DEFAULTS.map((def, idx) => (
                               <div key={idx} className="group relative">
                                    <button 
                                        onClick={() => setOptions(prev => ({...prev, customStyle: def.value}))}
                                        className="w-full px-3 py-2 bg-slate-800/50 hover:bg-slate-700 border border-white/5 rounded-lg text-left transition-colors flex flex-col gap-1"
                                    >
                                        <span className="text-xs font-bold text-slate-300 group-hover:text-white">{def.label}</span>
                                    </button>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/90 text-xs text-slate-300 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 text-center">
                                        {def.tooltip}
                                    </div>
                               </div>
                           ))}
                      </div>
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
                        onKeyDown={(e) => e.key === 'Enter' && performSave()}
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