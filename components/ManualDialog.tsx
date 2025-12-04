

import React, { useMemo } from 'react';
import { X, Download, Book, FileText } from 'lucide-react';

interface ManualDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManualDialog: React.FC<ManualDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    const blob = new Blob([MANUAL_CONTENT], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'LineArtify_Manual.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#181825] w-[95vw] h-[96vh] rounded-xl shadow-2xl flex flex-col border border-slate-700 overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Book className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">User Manual</h2>
              <p className="text-xs text-slate-400 font-mono">LineArtify Documentation v4.1</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleDownload}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors text-sm font-medium border border-white/5"
            >
              <Download size={16} />
              <span>Download .md</span>
            </button>
            <div className="w-px h-8 bg-slate-700 mx-2"></div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#0f0f16]">
          <div className="max-w-5xl mx-auto prose prose-invert prose-indigo prose-lg">
            <MarkdownRenderer content={MANUAL_CONTENT} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-500 shrink-0">
          Documentation © 2024 Katje B.V. | Gemini Powered
        </div>
      </div>
    </div>
  );
};

// Simple Markdown Renderer component
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const sections = useMemo(() => {
    // This is a basic parser for the specific format of our manual
    return content.split('\n').map((line, index) => {
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-4xl font-bold text-white mb-6 mt-8 pb-4 border-b border-white/10">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-2xl font-bold text-indigo-400 mb-4 mt-8">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-xl font-semibold text-slate-200 mb-3 mt-6">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('#### ')) {
        return <h4 key={index} className="text-lg font-bold text-indigo-300 mb-2 mt-4 uppercase tracking-wider">{line.replace('#### ', '')}</h4>;
      }
      if (line.startsWith('- ')) {
        return <li key={index} className="ml-4 text-slate-300 mb-1 leading-relaxed">{line.replace('- ', '')}</li>;
      }
      if (line.startsWith('1. ')) {
        return <div key={index} className="ml-4 text-slate-300 mb-2 font-medium flex"><span className="mr-2 text-indigo-500">•</span> {line.replace(/^\d+\. /, '')}</div>;
      }
      if (line.startsWith('> ')) {
        return <div key={index} className="border-l-4 border-indigo-500 pl-4 py-2 my-4 bg-slate-800/30 text-slate-300 italic">{line.replace('> ', '')}</div>;
      }
      if (line.trim() === '') {
        return <div key={index} className="h-2"></div>;
      }
      // Bold text highlighting
      const parts = line.split(/(\*\*.*?\*\*)/);
      return (
        <p key={index} className="text-slate-400 leading-relaxed mb-4">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="text-slate-200 font-bold bg-white/5 px-1 rounded">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  }, [content]);

  return <div className="space-y-1">{sections}</div>;
};

export default ManualDialog;

const MANUAL_CONTENT = `# LineArtify Comprehensive User Manual

## 1. Introduction

Welcome to **LineArtify Gemini Edition**, the premier solution for automated technical illustration and line art extraction. This manual provides an exhaustive guide to the application's capabilities, ranging from basic operation to advanced batch processing workflows.

LineArtify is not merely a filter; it is an intelligent, AI-driven pipeline that "sees" and "understands" the content of your images. Powered by Google's **Gemini 2.5 Flash** (for high-speed analysis) and **Gemini 3 Pro** (for 4K upscaling), it deconstructs photographs into their component visual parts: the characters, the background, the anatomical structure, and even hallucinated alternate angles.

This tool is designed for:
- **Concept Artists** needing rapid base meshes for painting.
- **Manga/Comic Authors** extracting backgrounds or character poses from reference photos.
- **3D Modelers** requiring orthogonal views and anatomical references.
- **Hobbyists** looking to turn personal photos into coloring pages or digital art.

---

## 2. System Requirements & Setup

### 2.1 Browser Compatibility
LineArtify is a cutting-edge web application utilizing modern browser APIs including \`Canvas API\`, \`IndexedDB\`, and \`Flexbox/Grid\` layouts.
- **Supported Browsers**: Google Chrome (v90+), Mozilla Firefox (v88+), Safari (v15+), Microsoft Edge (Chromium).
- **Recommended**: Chromium-based browsers (Chrome, Edge) are recommended for optimal performance with large image buffers.

### 2.2 API Key Configuration
This application operates on a "Bring Your Own Key" (BYOK) model.
1.  **Acquire a Key**: You must have a valid API Key from Google AI Studio. The project associated with the key must have billing enabled to access the higher-tier models (Gemini 2.5/3 Pro).
2.  **Configuration**: Click the **Key Icon** in the header. A secure Google dialog will appear to select your key.
3.  **Security**: Your key is stored in your browser's session memory and is never transmitted to any third-party server other than Google's API.

---

## 3. Interface Overview

### 3.1 The Header Bar
- **Progress Bar**: Displays global progress of all active jobs.
- **Global Controls**: 
    - **Options**: Opens the global configuration (Gender, Quality, Task Types).
    - **Start/Stop**: The "Master Switch". Pausing stops new network requests.
    - **Save/Load**: Export/Import your entire workspace to a JSON file.
    - **Manual/Console**: Access documentation and logs.

### 3.2 The Navigation Bar (Icon Bar)
Located just below the header, this bar contains icons allowing you to switch views between:
- **Uploads**: Your source images.
- **Jobs**: Currently processing tasks.
- **Specific Queues**: Filter the list to show only "Face Portrait", "Nude", "Background", etc.
- **Status Views**: "Retry" (transient errors), "Failed" (permanent errors), and "Ended".

### 3.3 The Gallery (Workspace)
- **Sorting**: Use the controls in the top-right of the gallery to sort by Queue Type, Filename, or Timestamp (Ascending/Descending).
- **Filtering**: 
    - **By Queue**: Check "Filter Gallery to this Queue" in the sidebar to only see results from the active tab.
    - **By Source**: Click the checkbox on any source image thumbnail (left sidebar) to isolate results for that specific image.
- **Scrolling**: Use the arrow icons to jump to the top or bottom of the gallery.
- **Interaction**: Click any image to open the **Immersive Viewer** (Zoom/Pan).

---

## 4. The Intelligent Workflow

### 4.1 Ingestion & Scanning
1.  **Upload**: Drag & Drop images.
2.  **Scan**: A "Scanner" job runs automatically using Gemini 2.5 Flash to identify human subjects.
3.  **Visual Feedback**: A scanning animation overlay appears on the thumbnail. Once complete, detected subjects are highlighted with bounding boxes.

### 4.2 Task Generation
Based on the scan and your **Options**, tasks are spawned:
- **Scene Tasks**: Full Scene, Background.
- **Person Tasks**: Spawns *per detected person*. Includes Character, Face, Nude, etc.
- **Group Tasks**: Spawns if >1 person is detected.

### 4.3 Processing Queue & Concurrency
- **One Job Per Queue**: The system runs up to 3 jobs simultaneously, but **never** two of the same type (e.g., it won't run two "Face" tasks at once). This diversity ensures one bottleneck doesn't stall the whole pipeline.
- **Priority**: Scans > Upscales > Groups > Individual Tasks > Full Scenes.

### 4.4 Auto-Cropping & Downloading
- **Auto-Crop**: The client-side engine analyzes the generated image, detects non-white pixels, and crops the image with a 10px padding.
- **Auto-Download**: Upon successful generation, the image is automatically downloaded to your device.

### 4.5 Persistence
- **Local Database**: The app automatically saves your workspace (uploads, queue, results) to your browser's IndexedDB. If you refresh the page, your work is restored.

---

## 5. Task Capabilities

### 5.1 Scene & Environment
- **Full Scene**: High-fidelity line art of the entire image on transparency.
- **Background Only**: Removes people and uses in-painting to reconstruct the scene behind them.

### 5.2 Character & Anatomy
- **Character Extraction**: Isolate the person on a white background (Mannequin style).
- **Body Reconstruction**: If legs/feet are cropped in the photo, this mode invents them to show a full standing figure.
- **Neutral Pose**: Reconstructs the character standing straight (A-Pose) with clothes.
- **Neutral Pose (Nude)**: Reconstructs the character standing straight without clothes (Anatomical study).
- **Nude / Base Mesh**: "Digital undressing" to reveal muscle structure/pose. (Safe/Barbie-doll style).
- **All People**: Group shots preserving interaction.

### 5.3 Portraiture & Face
- **Face Portrait**: Frontal view (passport style) regardless of original angle.
- **Face Left/Right**: Specific profile views.
- **Detail**: The AI "zooms in" to hallucinate high-frequency details (eyelashes, iris patterns).

### 5.4 Generative Angles
- **Backside / Nude Opposite**: The AI hallucinates the *reverse* angle (180 degrees) of the subject. Perfect for character turnarounds.

### 5.5 Utility
- **Upscale 4K**: Uses Gemini 3 Pro to enhance resolution, sharpen lines, and remove artifacts.

---

## 6. Advanced Configuration

### 6.1 Gender Bias
- **As-Is**: AI determines gender visually.
- **Targeted**: Force AI to interpret cues as Male/Female/Non-Binary to correct ambiguities.

### 6.2 Quality Levels
- **Very Low** to **Very High**: Adjusts the complexity of the linework from abstract icons to hyper-realistic cross-hatching.

### 6.3 Configuration Management
- **Save/Load Config**: You can save your settings (enabled tasks, gender, quality) to a \`.klc\` file and load it later.
- **Restore Defaults**: Reset everything to factory settings.

---

## 7. Troubleshooting

- **503 Overloaded**: Google's servers are busy. The app retries automatically.
- **Safety Block**: The image triggered Google's safety filters (Violence/Explicit). These cannot be bypassed.
- **No People Detected**: The scanner found no humans, so person-specific tasks were skipped.

---

## 8. Keyboard Shortcuts & Tips

- **Arrow Left/Right**: Navigate images in the Viewer.
- **Scroll Wheel**: Zoom in/out in the Viewer.
- **Deselect All**: Button in the gallery header to reset source filtering.

*Documentation Revision 4.1 - 2025*
`;