import React, { useMemo } from 'react';
import { X, Download, Book } from 'lucide-react';

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
              <p className="text-xs text-slate-400 font-mono">LineArtify Documentation v4.5</p>
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
        <div className="flex-1 overflow-y-auto p-8 bg-[#0f0f16] custom-scrollbar">
          <div className="max-w-5xl mx-auto prose prose-invert prose-indigo prose-lg pb-20">
            <MarkdownRenderer content={MANUAL_CONTENT} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-500 shrink-0">
          Documentation © {new Date().getFullYear()} Katje B.V. | Gemini Powered
        </div>
      </div>
    </div>
  );
};

// Simple Markdown Renderer component
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const sections = useMemo(() => {
    return content.split('\n').map((line, index) => {
      // Headlines
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-4xl font-bold text-white mb-6 mt-12 pb-4 border-b border-white/10">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-2xl font-bold text-indigo-400 mb-4 mt-10 flex items-center gap-2"><span className="w-2 h-8 bg-indigo-500 rounded-full inline-block"></span>{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-xl font-semibold text-slate-200 mb-3 mt-8">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('#### ')) {
        return <h4 key={index} className="text-lg font-bold text-indigo-300 mb-2 mt-6 uppercase tracking-wider">{line.replace('#### ', '')}</h4>;
      }
      
      // Lists
      if (line.startsWith('- ')) {
        return <div key={index} className="ml-4 text-slate-300 mb-2 pl-4 border-l border-white/10 hover:border-indigo-500 transition-colors">{line.replace('- ', '')}</div>;
      }
      if (line.match(/^\d+\. /)) {
        return <div key={index} className="ml-4 text-slate-300 mb-2 font-medium flex items-start"><span className="mr-2 text-indigo-500 font-bold min-w-[20px]">{line.split(' ')[0]}</span> <span>{line.replace(/^\d+\. /, '')}</span></div>;
      }
      
      // Quotes/Callouts
      if (line.startsWith('> ')) {
        return <div key={index} className="border-l-4 border-indigo-500 pl-6 py-3 my-6 bg-indigo-900/10 rounded-r-lg text-indigo-200 italic font-medium">{line.replace('> ', '')}</div>;
      }
      
      // Separator
      if (line.trim() === '---') {
        return <hr key={index} className="border-white/10 my-8" />;
      }
      
      // Code blocks (simple single line)
      if (line.startsWith('`') && line.endsWith('`')) {
         return <div key={index} className="bg-black/40 p-4 rounded-lg font-mono text-sm text-emerald-400 my-4 border border-white/5 overflow-x-auto">{line.replace(/`/g, '')}</div>;
      }

      if (line.trim() === '') {
        return <div key={index} className="h-2"></div>;
      }

      // Bold text highlighting logic
      const parts = line.split(/(\*\*.*?\*\*|`.*?`)/);
      return (
        <p key={index} className="text-slate-400 leading-relaxed mb-4">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="text-slate-200 font-bold">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
               return <code key={i} className="bg-white/10 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-mono border border-white/5">{part.slice(1, -1)}</code>;
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

const MANUAL_CONTENT = `# LineArtify Gemini Edition: Comprehensive Manual

> **Version:** 4.5  
> **Author:** Katje B.V.  
> **Engine:** Google Gemini 2.5 Flash / 3 Pro  
> **Last Updated:** 2025

---

## 1. Introduction

Welcome to **LineArtify Gemini Edition**, a professional-grade automated illustration pipeline designed to convert photographs and reference images into high-fidelity line art, technical diagrams, and anatomical studies.

Unlike simple filter-based applications, LineArtify utilizes advanced multimodal AI (Google Gemini) to "see" and understand the content of your images. It deconstructs photographs into their component parts—separating characters from backgrounds, analyzing poses, and hallucinating new viewing angles or anatomical layers—before reconstructing them as precise, transparent digital line work.

### Core Capabilities
- **Intelligent Scanning**: Automatically detects people and subjects in images.
- **Multi-Lane Processing**: Runs up to 5 concurrent jobs without blocking the UI.
- **Anatomical Reconstruction**: Generates skeletal and muscular overlays for artist reference.
- **Style Transfer**: Reinterprets subjects in over 80+ distinct art styles, from "Ligne Claire" to "Cyberpunk".
- **4K Upscaling**: Uses Gemini 3 Pro to enhance output resolution for print-ready results.
- **Privacy First**: All data is stored locally in your browser.

---

## 2. Getting Started

### 2.1 System Requirements
LineArtify is a modern web application built on React 19.
- **Browser**: Google Chrome (v90+), Edge, or any Chromium-based browser is highly recommended for the best performance with large image buffers.
- **Hardware**: A device with at least 8GB of RAM is recommended, as the application manages high-resolution image blobs in memory.

### 2.2 API Key Configuration
This application operates on a "Bring Your Own Key" (BYOK) model. You need a Google Gemini API key to function.
1.  Click the **Key Icon** in the top header bar.
2.  A secure Google dialog will appear. Follow the prompts to select a project with billing enabled.
3.  **Why Billing?** While Gemini Flash is free-tier eligible, the advanced **Gemini 3 Pro** model used for Upscaling and High-Quality rendering requires a paid tier (Pay-as-you-go).
4.  **Security**: Your key is stored in your browser's session memory. It is never sent to Katje B.V. servers.

### 2.3 Loading Your Workspace
- **New Session**: On load, the app checks for a saved state in your browser's IndexedDB. If found, your previous images and settings are restored automatically.
- **Import/Export**: You can save your entire configuration to a \`.klc\` file via the **Options** menu.

---

## 3. User Interface Tour

### 3.1 The Main Workspace
The interface is divided into three primary zones: the **Sidebar** (left), the **Header** (top), and the **Gallery** (center/right).

### 3.2 The Header Bar
Located at the very top of the screen, this bar controls the application state.
- **Queue Status Button**: A Play/Pause toggle. 
  - **Green (Running)**: The processor will pick up new jobs.
  - **Grey (Paused)**: New jobs will sit in "Pending" state. Useful if you want to queue up 50 images before starting processing.
- **Progress Bar**: Shows the global completion percentage of all active jobs.
- **Action Buttons**:
  - **Options (Gear)**: Opens the detailed configuration dialog.
  - **Key (Key)**: API Key selection.
  - **Manual (Book)**: Opens this documentation.
  - **Console (Info)**: Opens the system log for debugging API errors.
  - **About (Help)**: Version info, Privacy Policy, and Terms of Service.

### 3.3 The Navigation Bar
Located directly below the header, this strip allows you to filter the main gallery view.
- **All Results**: Shows every generated image (default view).
- **Categories**: Click buttons like "Person", "Scene", or "Style" to see only those specific job types.
- **Status Filters**: The buttons on the far right allow you to see only "Failed" or "Dead" jobs.

### 3.4 The Sidebar
The Sidebar is your command center for input management. It has two modes, toggled by the buttons at the top:

#### A. Sources View
Displays your uploaded images.
- **Upload Button**: Large button to add images. Supports multi-file selection.
- **Source Cards**: Each card represents an uploaded image.
  - **Scanning Overlay**: When you first upload, a "SCANNING" animation plays while Gemini analyzes the image for people.
  - **People Count**: Once scanned, it displays how many people were found (e.g., "2 People").
  - **Progress Bar**: A mini bar at the bottom of the card shows the status of jobs *specific to that image* (Green=Done, Orange=Failed, Blue=Waiting).
  - **Context Actions**: Hover over a card to see buttons:
    - **Select**: Filters the main gallery to show ONLY results for this image.
    - **Boost (Up Arrow)**: Increases priority of all pending jobs for this image by +10.
    - **Retry (Refresh)**: Retries any failed jobs for this image.
    - **Delete (Trash)**: Removes the image and ALL associated jobs/results.

#### B. Queues View
Displays a high-level overview of the processing pipeline.
- **Bulk Actions**: A grid of buttons to manage the entire system.
  - **Boost Wait**: Increases priority of all waiting jobs.
  - **Retry Failed**: Resets all "Error" jobs to "Pending".
  - **Del Failed**: Removes all failed jobs.
  - **Prune Uploads**: Removes uploaded images that have no active jobs associated with them.
- **Queue List**: Shows active queues (e.g., "Face Portrait", "Cyberpunk Style") with a live count of jobs in each. Click a queue to filter the gallery.

### 3.5 The Gallery (Main Area)
This is where your results appear.
- **Dynamic Grid**: Automatically resizes cards based on screen width.
- **Sections**: 
  - **Selection**: If you selected a source in the sidebar, its results appear at the top in a special section.
  - **Active Tasks**: Jobs currently processing (blue pulse).
  - **Finished**: Completed jobs.
- **Job Cards**:
  - **Visuals**: Shows the result (or thumbnail if pending).
  - **Status Borders**: Green (Success), Red (Failed), Blue pulse (Processing).
  - **Toolbar**: Appears on hover.
    - **View**: Opens Immersive Viewer.
    - **Repeat**: Duplicates the job (useful for styles with high randomness).
    - **Details**: Opens technical job report.
    - **Delete**: Removes the job.

---

## 4. The Immersive Viewer

Clicking any image in the gallery opens the Immersive Viewer.

### Controls
- **Zoom**: Mouse wheel to zoom in/out.
- **Pan**: Click and drag to move the image.
- **Toggle View (Spacebar)**: Instantly flips between the **Generated Result** and the **Original Source**. This is crucial for comparing anatomical accuracy or style fidelity.

### Keyboard Shortcuts
- **Arrow Right / Left**: Navigate to next/previous image.
- **Home / End**: Jump to first/last image.
- **Space**: Toggle Original/Result.
- **Enter**: Repeat Job (Re-run).
- **Delete**: Delete current job.
- **Esc**: Close viewer.

---

## 5. Configuration Guide (Options)

The **Options Dialog** is the heart of LineArtify. It determines what tasks are spawned for each image.

### 5.1 Tasks Tab
Select which base tasks to run for every image.
- **Scenes**:
  - **Full Scene**: The entire image.
  - **Background**: Removes people using in-painting.
  - **Full Scene (Nude)**: The scene with characters stripped of clothing (Mannequin style).
- **Face Portraits**:
  - **As-is**: Matches original angle.
  - **Front/Left/Right/Back**: Forces the AI to hallucinate specific angles (e.g., generating a profile view from a frontal photo).
- **Body Reconstruction**:
  - **Body As-is**: Matches original pose.
  - **Front/Left/Right/Back**: Rotates the character in 3D space.
  - **Nude Variants**: Digital undressing for anatomy study.
  - **Anatomy**: Renders the **musculature** (Ecorché) instead of skin.
  - **Skeleton**: Renders the **skeletal structure**.

### 5.2 Styles Tab
A comprehensive library of over 80 art styles.
- **Categorization**: Styles are grouped (Comics, Manga, Fantasy, Techniques, etc.).
- **Priorities**: You can set a numeric priority (1-100) for each style. Higher priority styles run first.
- **Variants**: Every style has 4 variants:
  - **Clothed**: Standard style transfer.
  - **Nude**: Style transfer + Anatomy study.
  - **Topless / Bottomless**: Partial anatomy studies.

### 5.3 Advanced Tab
- **Output Format**:
  - **PNG**: Best for editing. Supports transparency.
  - **JPG**: Best for archiving. Does not support transparency (white background). **Includes EXIF Data** (Model version, Copyright, GPS coordinates of Amsterdam, User Comments with the prompt).
- **AI Model**:
  - **Flash (Fast)**: Uses Gemini 2.5 Flash. Fast, cheap, good for bulk.
  - **Pro (High Qual)**: Uses Gemini 3 Pro. Slower, more expensive, but significantly better at following complex instructions and 4K resolution.
- **Creativity (Temperature)**:
  - **0.0 (Strict)**: Follows lines exactly. Good for tracing.
  - **1.0 (Wild)**: Adds creative embellishments. Good for artistic styles.
- **Detail Level**:
  - **Very Low**: Abstract, minimal lines.
  - **Very High**: Hyper-realistic cross-hatching and texture.

### 5.4 Modifiers Tab
- **Modesty Layer**: automatically adds covering elements to "Nude" tasks to ensure generated content remains safe or artistic. Options include "Leaves", "Steam", "Light", "Veil", etc.
- **Gender Bias**: Forces the AI to interpret subjects as a specific gender. Useful if the AI misidentifies an androgynous subject.

### 5.5 Hair Tab
Granular control over body hair density for 27 specific zones (Eyebrows, Armpits, Chest, Legs, etc.).
- **Default**: AI decides based on source.
- **None**: Forces smooth skin.
- **Bushy/Heavy**: Forces hair rendering.
- **Presets**: "Smooth Body" button instantly sets all body zones to "None".

### 5.6 Custom Tab
- **Custom Prompt**: Text entered here is appended to the system prompt. Use this to enforce specific details (e.g., "Make everyone wear glasses", "Draw in the style of Van Gogh").
- **Quick Presets**: One-click buttons to load complex custom prompts (e.g., "Cyberpunk City", "Fantasy Forest").

---

## 6. Workflow Strategies

### 6.1 The "Set and Forget" Batch
1.  Open Options. Enable "Face Front", "Body Front", and "Style: Cyberpunk".
2.  Drag and Drop 50 reference photos into the window.
3.  The app will scan all 50 images first (High Priority).
4.  It will then begin processing the tasks.
5.  Walk away. The browser will auto-download every result as it finishes.

### 6.2 The "Style Explorer"
1.  Upload a single high-quality photo.
2.  Go to the **Styles Tab**.
3.  Enable 10 different styles (e.g., Art Nouveau, Noir, Chibi, etc.).
4.  Watch as the gallery fills with 10 variations of your subject.
5.  Use the **Viewer** to flip through them and compare.

### 6.3 The "Anatomy Study"
1.  Upload a pose reference.
2.  Enable "Body Front (Anatomy)" and "Body Front (Skeleton)".
3.  The result will be a perfect muscle map and bone map of the pose, useful for drawing reference.

### 6.4 Handling Failures
- **403/400 Errors**: Usually bad API key or corrupt image.
- **503 Errors**: Google servers are busy. The app automatically retries these with exponential backoff.
- **Safety Blocks**: If an image violates Google's safety policy, it will be marked as "Blocked". These cannot be retried.
- **Retry Strategy**: If many jobs fail, go to the Sidebar (Queues View) and click **Retry Failed**.

---

## 7. Data & Privacy

### 7.1 Local Storage
LineArtify uses **IndexedDB** to store your workspace. This means if you close the tab and reopen it, your images are still there. 
**Warning**: This storage is tied to your browser profile. Clearing your "Site Data" or "Cookies" will wipe your workspace.

### 7.2 Exporting Data
- **Save Preset**: In Options, you can save your settings to a \`.klc\` file.
- **Job Reports**: In the "Details" view of any job, you can download a Markdown (\`.md\`) report containing the prompt, error logs, and base64 encoded images.
- **EXIF**: JPG outputs contain metadata. You can view this in Windows Properties or macOS Get Info.

### 7.3 Privacy
Your images are sent directly to Google Gemini API. They do not pass through any intermediate server. Katje B.V. has no access to your data.

---

## 8. Troubleshooting

### "The app is stuck on 'Scanning'..."
- Check your API Key. If the key is invalid, scanning (which is the first API call) will fail silently in some older versions, or show an error in the Console.
- Open the **Console** (Info icon in header) to see the raw error message.

### "Images are downloading automatically and it's annoying."
- This is a core feature for batch processing. You cannot currently disable it in the UI, but you can configure your browser settings to "Ask where to save each file" to interrupt the flow, or set a default download folder to silence it.

### "The AI refuses to generate a nude image."
- Google's safety filters are strict. Even with "Mannequin" instructions, some poses or subjects may trigger the "Sexually Explicit" filter.
- Try using the **Modesty Layer** (e.g., "Steam" or "Shadow") in the Options tab. This often satisfies the safety filter while still providing the anatomical reference.

---

*Manual v4.5 - Knowledge And Technology Joyfully Engaged (Katje B.V.)*
`;