import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Layers, Settings, Save, Upload, Cpu, Sparkles, CheckSquare, Square, Info, Check, Shield, Palette, PenTool, ChevronDown, ChevronRight, FileImage, Minus, Scissors } from 'lucide-react';
import { AppOptions, TaskType } from '../types';
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

  // Helper for Tri-state Style Selection
  const styleVariantKeys = useMemo(() => {
    const clothed: string[] = [];
    const nude: string[] = [];
    const topless: string[] = [];
    const bottomless: string[] = [];

    Object.keys(TASK_DEFINITIONS).forEach(k => {
        const def = TASK_DEFINITIONS[k as TaskType];
        if (def.category !== 'Style') return;

        if (k.endsWith('-nude')) nude.push(k);
        else if (k.endsWith('-topless')) topless.push(k);
        else if (k.endsWith('-bottomless')) bottomless.push(k);
        else clothed.push(k);
    });
    return { clothed, nude, topless, bottomless };
  }, []);

  const getVariantState = (keys: string[]) => {
      if (keys.length === 0) return 'unchecked';
      const enabledCount = keys.filter(k => options.taskTypes[k]).length;
      if (enabledCount === 0) return 'unchecked';
      if (enabledCount === keys.length) return 'checked';
      return 'partial';
  };

  const toggleVariant = (keys: string[], currentState: string) => {
      const targetState = currentState === 'checked' ? false : true;
      setOptions(prev => {
          const next = { ...prev.taskTypes };
          keys.forEach(k => { next[k] = targetState; });
          return { ...prev, taskTypes: next };
      });
  };

  // Helper for Subgroup Variants
  const getSubgroupKeys = (category: string, variant: 'clothed' | 'nude' | 'topless' | 'bottomless') => {
      return Object.keys(TASK_DEFINITIONS).filter(k => {
          const def = TASK_DEFINITIONS[k as TaskType];
          // Check category
          if (def.category !== 'Style' || def.subCategory !== category) return false;
          
          // Check variant based on suffix
          const isNude = k.endsWith('-nude');
          const isTopless = k.endsWith('-topless');
          const isBottomless = k.endsWith('-bottomless');
          const isClothed = !isNude && !isTopless && !isBottomless;

          if (variant === 'clothed') return isClothed;
          if (variant === 'nude') return isNude;
          if (variant === 'topless') return isTopless;
          if (variant === 'bottomless') return isBottomless;
          return false;
      });
  };

  const stats = useMemo(() => {
    let total = 0;
    let clothed = 0;
    let nude = 0;
    let topless = 0;
    let bottomless = 0;
    let background = 0;

    Object.entries(options.taskTypes).forEach(([key, enabled]) => {
        if (!enabled) return;
        
        // Skip utility tasks (Scanner, Name Gen, Upscale)
        const def = TASK_DEFINITIONS[key as TaskType];
        if (!def || def.category === 'Utility') return;

        total++;
        if (key === 'background') {
            background++;
        } else if (key.endsWith('-nude') || key === 'all-people-nude' || key === 'full-nude') {
            nude++;
        } else if (key.endsWith('-topless')) {
            topless++;
        } else if (key.endsWith('-bottomless')) {
            bottomless++;
        } else {
            clothed++;
        }
    });

    return { total, clothed, nude, topless, bottomless, background };
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

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setIsSaveMode(false);
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
            let loadedOptions: Partial<AppOptions> = {};

            if (parsed.type === 'lineartify-preset' && parsed.data) {
                loadedOptions = parsed.data;
            } else if (parsed.taskTypes || parsed.gender) {
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

        } catch (e) {
            console.error("Failed to load preset", e);
            alert("Invalid preset file.");
        }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e1c2e] w-[1000px] max-w-[95vw] h-[90vh] rounded-xl shadow-2xl flex flex-col border border-white/10 overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#252233] border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
             <Settings className="text-white" size={24} />
             <h2 className="text-xl font-bold text-white tracking-tight">Configuration</h2>
             
             {/* Detailed Stats Badge */}
             <div className="flex gap-2 ml-4">
                 <div className="px-2 py-1 bg-black/40 rounded text-[10px] font-mono border border-white/5 text-slate-400" title="Total Tasks Enabled">
                    Total: <span className="text-white font-bold">{stats.total}</span>
                 </div>
                 {stats.clothed > 0 && <div className="px-2 py-1 bg-indigo-900/40 rounded text-[10px] font-mono border border-indigo-500/20 text-indigo-300">Clothed: {stats.clothed}</div>}
                 {stats.background > 0 && <div className="px-2 py-1 bg-cyan-900/40 rounded text-[10px] font-mono border border-cyan-500/20 text-cyan-300">Bkg: {stats.background}</div>}
                 {stats.nude > 0 && <div className="px-2 py-1 bg-purple-900/40 rounded text-[10px] font-mono border border-purple-500/20 text-purple-300">Nude: {stats.nude}</div>}
                 {stats.topless > 0 && <div className="px-2 py-1 bg-pink-900/40 rounded text-[10px] font-mono border border-pink-500/20 text-pink-300">Topless: {stats.topless}</div>}
                 {stats.bottomless > 0 && <div className="px-2 py-1 bg-rose-900/40 rounded text-[10px] font-mono border border-rose-500/20 text-rose-300">Botless: {stats.bottomless}</div>}
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} className="text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 bg-[#1a1825] shrink-0 overflow-x-auto scrollbar-hide">
             {[
               { id: 0, label: 'Tasks', icon: Layers },
               { id: 1, label: 'Art Styles Library', icon: Palette },
               { id: 2, label: 'Advanced', icon: Cpu },
               { id: 3, label: 'Modifiers', icon: Shield },
               { id: 4, label: 'Body Hair', icon: Scissors },
               { id: 5, label: 'Custom', icon: PenTool },
             ].map(tab => {
                 const Icon = tab.icon;
                 return (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-wide transition-colors border-b-2 whitespace-nowrap ${
                            activeTab === tab.id 
                            ? 'border-indigo-500 text-indigo-400 bg-[#2d2a3d]' 
                            : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-[#2d2a3d]/50'
                        }`}
                     >
                        <Icon size={16} /> {tab.label}
                     </button>
                 );
             })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#13111c] relative">
            
            {/* TAB 0: TASKS */}
            {activeTab === 0 && (
                <div className="space-y-8">
                    
                    {/* Scene Tasks */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                        <h3 className="text-sm font-bold text-slate-300 uppercase mb-4 flex items-center gap-2"><FileImage size={16}/> Scene Extraction</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {SCENE_TASKS.map(task => (
                                <div 
                                    key={task.id}
                                    onClick={() => toggleTask(task.id)}
                                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                        options.taskTypes[task.id] 
                                        ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20' 
                                        : 'bg-slate-800 border-white/5 hover:border-indigo-500/50 hover:bg-slate-700'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${
                                        options.taskTypes[task.id] ? 'bg-white border-white text-indigo-600' : 'border-slate-500 bg-transparent'
                                    }`}>
                                        {options.taskTypes[task.id] && <Check size={14} strokeWidth={4} />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-white">{task.label}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{task.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body Views */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                         <h3 className="text-sm font-bold text-slate-300 uppercase mb-4 flex items-center gap-2"><Layers size={16}/> Body Reconstruction</h3>
                         <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/5 text-xs text-slate-500 font-mono uppercase">
                                        <th className="py-2 px-2">Angle</th>
                                        <th className="py-2 px-2">Clothed</th>
                                        <th className="py-2 px-2 text-purple-400">Nude</th>
                                        <th className="py-2 px-2 text-pink-400">Anatomy</th>
                                        <th className="py-2 px-2 text-slate-400">Skeleton</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {BODY_VIEWS.map(view => (
                                        <tr key={view.baseId} className="hover:bg-white/5">
                                            <td className="py-3 px-2 font-bold text-slate-300">{view.label}</td>
                                            {['', '-nude', '-anatomy', '-skeleton'].map(suffix => {
                                                const id = `${view.baseId}${suffix}`;
                                                let finalId = id;
                                                if (id === 'backside-nude') finalId = 'nude-opposite'; // Legacy map

                                                if (!TASK_DEFINITIONS[finalId as TaskType]) return <td key={suffix}></td>;

                                                const isEnabled = options.taskTypes[finalId];
                                                return (
                                                    <td key={suffix} className="py-2 px-2">
                                                        <button 
                                                            onClick={() => toggleTask(finalId)}
                                                            className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                                                                isEnabled 
                                                                ? suffix === '' ? 'bg-indigo-600 text-white' 
                                                                  : suffix === '-nude' ? 'bg-purple-600 text-white' 
                                                                  : suffix === '-anatomy' ? 'bg-pink-600 text-white'
                                                                  : 'bg-slate-600 text-white'
                                                                : 'bg-slate-800 border border-slate-600 hover:border-white'
                                                            }`}
                                                        >
                                                            {isEnabled && <Check size={14} />}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                    </div>

                    {/* Face Views */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                        <h3 className="text-sm font-bold text-slate-300 uppercase mb-4 flex items-center gap-2"><Sparkles size={16}/> Face Portraits</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {FACE_VIEWS.map(view => (
                                <button 
                                    key={view.id}
                                    onClick={() => toggleTask(view.id)}
                                    className={`p-3 rounded-lg border text-center transition-all ${
                                        options.taskTypes[view.id] 
                                        ? 'bg-cyan-900/50 border-cyan-500 text-cyan-200 shadow-lg shadow-cyan-500/10' 
                                        : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                                    }`}
                                >
                                    <div className="font-bold text-sm mb-1">{view.label}</div>
                                    <div className={`w-4 h-4 rounded-full mx-auto border ${options.taskTypes[view.id] ? 'bg-cyan-400 border-cyan-400' : 'border-slate-500'}`}></div>
                                </button>
                            ))}
                        </div>
                    </div>

                </div>
            )}

            {/* TAB 1: STYLES */}
            {activeTab === 1 && (
                <div className="space-y-6">
                    
                    {/* Sticky Bulk Selector Header */}
                    <div className="sticky top-0 z-20 bg-[#1e1c2e]/95 backdrop-blur py-2 -mx-2 px-2 border-b border-white/5 space-y-2">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Overrides</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {/* All Clothed */}
                            <button 
                                onClick={() => toggleVariant(styleVariantKeys.clothed, getVariantState(styleVariantKeys.clothed))}
                                className={`flex items-center justify-center gap-2 px-3 py-2 rounded border transition-all text-xs font-bold ${
                                    getVariantState(styleVariantKeys.clothed) !== 'unchecked' 
                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                    : 'bg-slate-800 border-white/10 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                {getVariantState(styleVariantKeys.clothed) === 'checked' ? <CheckSquare size={14} /> : getVariantState(styleVariantKeys.clothed) === 'partial' ? <Minus size={14} /> : <Square size={14} />}
                                <span>All Clothed</span>
                            </button>
                            {/* All Nude */}
                            <button 
                                onClick={() => toggleVariant(styleVariantKeys.nude, getVariantState(styleVariantKeys.nude))}
                                className={`flex items-center justify-center gap-2 px-3 py-2 rounded border transition-all text-xs font-bold ${
                                    getVariantState(styleVariantKeys.nude) !== 'unchecked' 
                                    ? 'bg-purple-600 border-purple-500 text-white' 
                                    : 'bg-slate-800 border-white/10 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                {getVariantState(styleVariantKeys.nude) === 'checked' ? <CheckSquare size={14} /> : getVariantState(styleVariantKeys.nude) === 'partial' ? <Minus size={14} /> : <Square size={14} />}
                                <span>All Nude</span>
                            </button>
                            {/* All Topless */}
                            <button 
                                onClick={() => toggleVariant(styleVariantKeys.topless, getVariantState(styleVariantKeys.topless))}
                                className={`flex items-center justify-center gap-2 px-3 py-2 rounded border transition-all text-xs font-bold ${
                                    getVariantState(styleVariantKeys.topless) !== 'unchecked' 
                                    ? 'bg-pink-600 border-pink-500 text-white' 
                                    : 'bg-slate-800 border-white/10 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                {getVariantState(styleVariantKeys.topless) === 'checked' ? <CheckSquare size={14} /> : getVariantState(styleVariantKeys.topless) === 'partial' ? <Minus size={14} /> : <Square size={14} />}
                                <span>All Topless</span>
                            </button>
                            {/* All Bottomless */}
                            <button 
                                onClick={() => toggleVariant(styleVariantKeys.bottomless, getVariantState(styleVariantKeys.bottomless))}
                                className={`flex items-center justify-center gap-2 px-3 py-2 rounded border transition-all text-xs font-bold ${
                                    getVariantState(styleVariantKeys.bottomless) !== 'unchecked' 
                                    ? 'bg-rose-600 border-rose-500 text-white' 
                                    : 'bg-slate-800 border-white/10 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                {getVariantState(styleVariantKeys.bottomless) === 'checked' ? <CheckSquare size={14} /> : getVariantState(styleVariantKeys.bottomless) === 'partial' ? <Minus size={14} /> : <Square size={14} />}
                                <span>All Bottomless</span>
                            </button>
                        </div>
                    </div>

                    {/* Style Groups */}
                    {STYLE_SUBCATEGORIES.map(category => {
                        const stylesInCat = Object.keys(TASK_DEFINITIONS).filter(k => {
                            const def = TASK_DEFINITIONS[k as TaskType];
                            return def.category === 'Style' && def.subCategory === category && !k.includes('-nude') && !k.includes('-topless') && !k.includes('-bottomless');
                        });
                        
                        if (stylesInCat.length === 0) return null;

                        const isExpanded = expandedCategories[category];

                        return (
                            <div key={category} className="bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden">
                                <div 
                                    className="px-4 py-3 bg-slate-800/50 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors"
                                    onClick={() => toggleCategory(category)}
                                >
                                    <h3 className="font-bold text-white uppercase tracking-wider text-xs">{category}</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded text-slate-400">{stylesInCat.length} Styles</span>
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>
                                </div>
                                
                                {isExpanded && (
                                    <div className="p-2 space-y-1">
                                        
                                        {/* SUBGROUP CONTROLS */}
                                        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-white/5 rounded border border-white/5">
                                             <span className="text-[10px] uppercase font-bold text-slate-500 mr-auto">Select {category}:</span>
                                             
                                             {['clothed', 'nude', 'topless', 'bottomless'].map((variant, idx) => {
                                                  const keys = getSubgroupKeys(category, variant as any);
                                                  const state = getVariantState(keys);
                                                  const colors = [
                                                      'bg-indigo-600 border-indigo-500 text-white',
                                                      'bg-purple-600 border-purple-500 text-white',
                                                      'bg-pink-600 border-pink-500 text-white',
                                                      'bg-rose-600 border-rose-500 text-white'
                                                  ];
                                                  
                                                  return (
                                                      <button
                                                         key={variant}
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             toggleVariant(keys, state);
                                                         }}
                                                         className={`w-10 h-6 flex items-center justify-center rounded border transition-colors ${
                                                             state !== 'unchecked' ? colors[idx] : 'bg-slate-800 border-slate-600 text-slate-400'
                                                         }`}
                                                         title={`Toggle All ${variant} in Category`}
                                                     >
                                                         {state === 'checked' ? <CheckSquare size={14} /> : state === 'partial' ? <Minus size={14} /> : <Square size={14} />}
                                                     </button>
                                                  );
                                             })}
                                        </div>

                                        {/* Header Row */}
                                        <div className="flex items-center px-2 py-1 text-[10px] font-mono uppercase text-slate-500">
                                            <div className="flex-1">Style Name</div>
                                            <div className="w-12 text-center">Prio</div>
                                            <div className="w-10 text-center">Cloth</div>
                                            <div className="w-10 text-center text-purple-400">Nude</div>
                                            <div className="w-10 text-center text-pink-400">Top</div>
                                            <div className="w-10 text-center text-rose-400">Bot</div>
                                        </div>

                                        {stylesInCat.map(styleId => {
                                            const def = TASK_DEFINITIONS[styleId as TaskType];
                                            const variants = {
                                                clothed: styleId,
                                                nude: `${styleId}-nude`,
                                                topless: `${styleId}-topless`,
                                                bottomless: `${styleId}-bottomless`
                                            };
                                            
                                            const isHovered = hoveredStyle === styleId;

                                            return (
                                                <div 
                                                    key={styleId} 
                                                    className="flex items-center p-2 hover:bg-white/5 rounded relative group"
                                                    onMouseEnter={(e) => { setHoveredStyle(styleId as TaskType); setMousePos({x: e.clientX, y: e.clientY}); }}
                                                    onMouseLeave={() => setHoveredStyle(null)}
                                                >
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <div className="text-sm font-bold text-slate-300 truncate">{def.label}</div>
                                                        <div className="text-[10px] text-slate-500 truncate">{def.description}</div>
                                                    </div>

                                                    {/* Priority Input */}
                                                    <div className="w-12 shrink-0 mr-2">
                                                        <input 
                                                            type="number" 
                                                            className="w-full bg-black/40 border border-white/10 rounded px-1 py-0.5 text-center text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
                                                            value={options.stylePriorities[styleId] || ''}
                                                            placeholder="50"
                                                            onChange={(e) => updateStylePriority(styleId, e.target.value)}
                                                        />
                                                    </div>

                                                    {/* Variant Toggles */}
                                                    <div className="flex items-center gap-1">
                                                        {Object.values(variants).map((vid, idx) => (
                                                            <div key={vid} className="w-10 flex justify-center">
                                                                <button
                                                                    onClick={() => toggleTask(vid)}
                                                                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${
                                                                        options.taskTypes[vid]
                                                                        ? idx === 0 ? 'bg-indigo-600 border-indigo-500 text-white' 
                                                                          : idx === 1 ? 'bg-purple-600 border-purple-500 text-white' 
                                                                          : idx === 2 ? 'bg-pink-600 border-pink-500 text-white' 
                                                                          : 'bg-rose-600 border-rose-500 text-white' 
                                                                        : 'bg-slate-800 border-slate-600 hover:border-white/50'
                                                                    }`}
                                                                >
                                                                    {options.taskTypes[vid] && <Check size={12} strokeWidth={4} />}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Tooltip Popup */}
                                                    {isHovered && (
                                                        <div 
                                                            className="fixed z-50 pointer-events-none bg-black/90 backdrop-blur border border-white/10 p-2 rounded text-xs text-white shadow-xl max-w-xs"
                                                            style={{ top: mousePos.y + 10, left: mousePos.x + 10 }}
                                                        >
                                                            <div className="font-bold text-indigo-400 mb-1">{def.label}</div>
                                                            <div className="text-slate-300">{def.description}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* TAB 2: ADVANCED */}
            {activeTab === 2 && (
                <div className="space-y-6">
                    {/* Gender Section */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                        <label className="text-sm font-bold text-slate-300 uppercase mb-3 block">Gender Bias</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {['As-is', 'Female', 'Male', 'Non-Binary'].map(g => (
                                <button
                                    key={g}
                                    onClick={() => setOptions(prev => ({ ...prev, gender: g }))}
                                    className={`py-3 rounded-lg border text-sm font-bold transition-all ${
                                        options.gender === g 
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow' 
                                        : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                                    }`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Output Format Section */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                        <label className="text-sm font-bold text-slate-300 uppercase mb-3 block">Output Format</label>
                        <div className="grid grid-cols-2 gap-3">
                             {['png', 'jpg'].map(fmt => (
                                 <button
                                    key={fmt}
                                    onClick={() => setOptions(prev => ({ ...prev, outputFormat: fmt as any }))}
                                    className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                                        options.outputFormat === fmt
                                        ? 'bg-blue-900/40 border-blue-500 text-blue-200' 
                                        : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700'
                                    }`}
                                 >
                                     <span className="font-bold text-lg uppercase">{fmt}</span>
                                     <span className="text-[10px] opacity-70">{fmt === 'png' ? 'Transparency' : 'EXIF Data'}</span>
                                 </button>
                             ))}
                        </div>
                    </div>

                    {/* Model Config */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                        <div className="mb-4">
                            <label className="text-sm font-bold text-slate-300 uppercase mb-2 block">AI Model</label>
                            <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                                <button 
                                    onClick={() => setOptions(prev => ({ ...prev, modelPreference: 'flash' }))}
                                    className={`flex-1 py-2 rounded text-xs font-bold transition-all ${options.modelPreference === 'flash' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    Gemini 2.5 Flash
                                </button>
                                <button 
                                    onClick={() => setOptions(prev => ({ ...prev, modelPreference: 'pro' }))}
                                    className={`flex-1 py-2 rounded text-xs font-bold transition-all ${options.modelPreference === 'pro' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    Gemini 3 Pro
                                </button>
                            </div>
                        </div>

                        <div className="mb-4">
                             <label className="text-sm font-bold text-slate-300 uppercase mb-2 block">Detail Level</label>
                             <input 
                                type="range" 
                                min="0" max="4" step="1" 
                                value={['Very Low', 'Low', 'Medium', 'High', 'Very High'].indexOf(options.detailLevel)}
                                onChange={(e) => setOptions(prev => ({ ...prev, detailLevel: ['Very Low', 'Low', 'Medium', 'High', 'Very High'][parseInt(e.target.value)] }))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                             />
                             <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono uppercase">
                                 <span>Very Low</span>
                                 <span>Low</span>
                                 <span className="text-white font-bold">Medium</span>
                                 <span>High</span>
                                 <span>Ultra</span>
                             </div>
                        </div>

                        <div>
                             <label className="text-sm font-bold text-slate-300 uppercase mb-2 block">Creativity (Temperature): {options.creativity}</label>
                             <input 
                                type="range" 
                                min="0" max="1" step="0.1" 
                                value={options.creativity}
                                onChange={(e) => setOptions(prev => ({ ...prev, creativity: parseFloat(e.target.value) }))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                             />
                        </div>
                    </div>
                </div>
            )}
            
            {/* TAB 3: MODIFIERS */}
            {activeTab === 3 && (
                <div className="space-y-6">
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                        <h3 className="text-sm font-bold text-slate-300 uppercase mb-2 flex items-center gap-2"><Shield size={16}/> Modesty Layer</h3>
                        <p className="text-xs text-slate-400 mb-4">
                            Automatically adds covering elements to "Nude" tasks.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {MODESTY_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setOptions(prev => ({ ...prev, modesty: opt }))}
                                    className={`px-3 py-2 rounded text-xs text-left transition-all border ${
                                        options.modesty === opt 
                                        ? 'bg-emerald-900/40 border-emerald-500 text-emerald-200 font-bold' 
                                        : 'bg-slate-800 border-white/5 text-slate-400 hover:bg-slate-700 hover:text-white'
                                    }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: BODY HAIR */}
            {activeTab === 4 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                         <h3 className="text-sm font-bold text-slate-300 uppercase">Zone Density Control</h3>
                         <div className="flex gap-2">
                             <button onClick={setSmoothBodyHair} className="px-3 py-1 bg-slate-800 hover:bg-indigo-600 text-white text-xs rounded border border-white/10 transition-colors">Smooth</button>
                             <button onClick={resetBodyHair} className="px-3 py-1 bg-slate-800 hover:bg-red-500 text-white text-xs rounded border border-white/10 transition-colors">Reset</button>
                         </div>
                    </div>

                    {HAIR_GROUPS.map(group => (
                        <div key={group} className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 border-b border-white/5 pb-1">{group}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {BODY_HAIR_ZONES.filter(z => z.group === group).map(zone => {
                                    const currentVal = options.bodyHair[zone.id] || 'Default';
                                    return (
                                        <div key={zone.id} className="flex items-center justify-between">
                                            <label className="text-xs text-slate-300 font-medium">{zone.label}</label>
                                            <select 
                                                value={currentVal}
                                                onChange={(e) => updateBodyHair(zone.id, e.target.value)}
                                                className={`bg-black/40 border text-xs rounded px-2 py-1 outline-none focus:border-indigo-500 ${currentVal !== 'Default' ? 'border-indigo-500 text-indigo-300' : 'border-white/10 text-slate-500'}`}
                                            >
                                                {HAIR_DENSITIES.map(d => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* TAB 5: CUSTOM */}
            {activeTab === 5 && (
                 <div className="space-y-6">
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5 h-full flex flex-col">
                         <h3 className="text-sm font-bold text-slate-300 uppercase mb-2">Additional Prompt Instructions</h3>
                         <textarea 
                             className="flex-1 min-h-[150px] bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none resize-none font-mono"
                             placeholder="Enter specific instructions here..."
                             value={options.customStyle}
                             onChange={(e) => setOptions(prev => ({ ...prev, customStyle: e.target.value }))}
                         />
                         
                         <div className="mt-4">
                             <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Quick Presets</label>
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                 {CUSTOM_DEFAULTS.map(preset => (
                                     <button
                                         key={preset.label}
                                         onClick={() => setOptions(prev => ({ ...prev, customStyle: preset.value }))}
                                         className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded text-xs text-left truncate transition-colors text-slate-300 hover:text-white"
                                         title={preset.tooltip}
                                     >
                                         {preset.label}
                                     </button>
                                 ))}
                             </div>
                         </div>
                    </div>
                 </div>
            )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#1a1825] border-t border-white/5 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
                 {isSaveMode ? (
                     <div className="flex items-center gap-2 animate-in slide-in-from-left-4">
                         <input 
                            type="text" 
                            className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 w-48"
                            placeholder="Preset Name"
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            autoFocus
                         />
                         <button onClick={performSave} className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"><Check size={16}/></button>
                         <button onClick={() => setIsSaveMode(false)} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"><X size={16}/></button>
                     </div>
                 ) : (
                     <>
                        <button onClick={() => setIsSaveMode(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold transition-colors border border-white/5">
                            <Save size={16} /> Save
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold transition-colors border border-white/5">
                            <Upload size={16} /> Load
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".json,.klc" onChange={performLoad} />
                     </>
                 )}
            </div>
            
            <button 
                onClick={onClose}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all"
            >
                Done
            </button>
        </div>

      </div>
    </div>
  );
};

export default OptionsDialog;