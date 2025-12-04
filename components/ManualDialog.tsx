
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
              <p className="text-xs text-slate-400 font-mono">LineArtify Documentation v3.5</p>
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
LineArtify is a cutting-edge web application utilizing modern browser APIs including \`Canvas API\`, \`FileReader\`, and \`Flexbox/Grid\` layouts.
- **Supported Browsers**: Google Chrome (v90+), Mozilla Firefox (v88+), Safari (v15+), Microsoft Edge (Chromium).
- **Recommended**: For optimal performance during large batch operations, a Chromium-based browser (Chrome, Edge) is recommended due to its superior V8 JavaScript engine performance.

### 2.2 API Key Configuration
This application operates on a "Bring Your Own Key" (BYOK) model. It connects directly from your browser to Google's servers.

1.  **Acquire a Key**: You must have a valid API Key from Google AI Studio. The project associated with the key must have billing enabled to access the higher-tier models (Gemini 2.5/3 Pro).
2.  **Configuration**:
    - Click the **Key Icon** in the top-right header of the application.
    - A secure Google dialog will appear. Select your project and key.
    - The key is injected into the application's runtime environment (\`process.env.API_KEY\`).
    - **Security Note**: Your key is stored in your browser's session memory. It is never transmitted to any third-party server other than Google's official API endpoints.

---

## 3. Interface Overview

### 3.1 The Header Bar
The header is your command center.
- **Progress Bar**: Located centrally, this dynamic bar fills as your batch completes. It displays the exact count of completed jobs versus total jobs.
- **Options**: Opens the global configuration dialog for gender, quality, and task types.
- **Global Start/Stop**: The "Master Switch" for the processing queue. Pausing this stops all new network requests immediately, though currently processing images will finish.
- **Save/Load**: Allows you to export your entire workspace—including uploaded images and configuration—to a JSON file for backup or sharing.
- **Manual/Console**: Access documentation and real-time system logs.

### 3.2 The Sidebar (Queue Management)
The sidebar on the left is the "Brain" of the operation. It is not just a list; it is a complex state manager.
- **View Selector**: The dropdown menu allows you to switch between viewing your Raw Uploads, Active Processing Jobs, or specific Task Queues (e.g., viewing only "Face Portrait" tasks).
- **Queue Controls**: Below the selector, specific controls appear based on the view. For example, in the "Failed" queue, you will see bulk retry/delete options.
- **Status Indicators**:
    - **Blue Pulse**: Processing.
    - **Green Bar**: Success.
    - **Red Bar**: Error.
    - **Grey Bar**: Pending.

### 3.3 The Gallery (Workspace)
The main area on the right displays your results.
- **Smart Filtering**: Clicking a checkbox on a source image in the Sidebar instantly filters the Gallery to show ONLY results derived from that specific image. This is crucial when working with hundreds of files.
- **Action Bar**: Each result card has a footer with quick actions: Upscale (Magic Wand), Repeat, and Delete.

---

## 4. The Intelligent Workflow

Understanding how LineArtify processes images is key to mastering it. The workflow is asynchronous and non-blocking.

### 4.1 Step 1: Ingestion & Scanning
When you drag and drop an image onto the Uploads area:
1.  The image is locally compressed for preview.
2.  A **"Scanner" Job** is immediately spawned in the background.
3.  **The Scan**: The app sends the image to Gemini 2.5 Flash with a specific prompt: *"Analyze this image and identify all distinct human subjects."*
4.  **The Result**: The AI returns a JSON list of bounding boxes and descriptions (e.g., "Woman in red dress," "Man in hat").
5.  **Visualization**: You can see these detection boxes drawn over your thumbnails in the Queue list.

### 4.2 Step 2: Task Spawning
Based on the results of the Scan, the application dynamically creates tasks.
- **Always Created**: "Full Scene" and "Background" tasks are created for every image, regardless of content.
- **Conditional Creation**: If humans are detected, the app iterates through the list. For *each* detected person, it creates a set of sub-tasks: "Character Extraction," "Face Portrait," "Nude Analysis," etc.
- **Group Logic**: If more than one person is detected, "Group" tasks (All People, All People Nude) are automatically generated.

### 4.3 Step 3: Prioritized Processing
The Queue is not First-In-First-Out (FIFO). It uses a priority heuristic:
1.  **Scans (Highest)**: Detection happens first to populate the queue.
2.  **Upscales**: User-requested upscales take precedence.
3.  **Groups**: Multi-person scenes.
4.  **Individual Person Tasks**: Character, Face, Nude, etc.
5.  **Full Scenes (Lowest)**: Because these prompts are computationally heavier and less "urgent" for character design workflows.

### 4.4 Step 4: Post-Processing & Crop
Raw output from AI models often contains excess white space. LineArtify includes a client-side **Auto-Cropper**.
- Before the image is displayed, a background thread analyzes the pixel data.
- It calculates the bounding box of non-white pixels.
- It crops the image to the content with a 10px padding.
- This ensures your "Character" exports are ready to drag-and-drop into Photoshop without manual trimming.

---

## 5. Task Types & Capabilities

### 5.1 Full Scene
**Target**: The entire image.
**Output Style**: High-fidelity line art, transparent background.
**Use Case**: General illustration, coloring pages, architectural visualization.
**Prompt Logic**: The AI is instructed to trace every detail, texture, and object while ignoring color data.

### 5.2 Background Only
**Target**: The environment.
**Output Style**: Clean lines, transparent background.
**Magic Feature**: **In-painting**. The AI is explicitly instructed to *remove* all humans and *reconstruct* the scenery behind them. If a person is standing in front of a door, this mode attempts to draw the complete door.

### 5.3 Character Extraction (Model)
**Target**: The specific person detected by the scanner.
**Output Style**: Solid white background, "Mannequin" style.
**Prompt Logic**: The AI isolates the figure. Clothing patterns are often simplified to emphasize the volumetric form of the body. This is a "Reference" mode, meant for artists to understand the pose.

### 5.4 Face Portrait
**Target**: Head and shoulders.
**Output Style**: Ultra-high detail.
**Prompt Logic**: The prompt forces a "zoom in" behavior. Even if the person is small in the original photo, the AI will hallucinate high-frequency details like eyelashes, hair strands, and iris patterns suitable for a close-up portrait.

### 5.5 Backside (Opposite View)
**Target**: The reverse angle of the subject.
**Behavior**: This is a **Generative** task. The AI analyzes the input pose (e.g., Front View) and hallucinates what the *back* of that person looks like.
**Use Case**: Character design sheets (Turnarounds). It maintains the same pose but flips the camera 180 degrees.

### 5.6 Nude / Base Mesh
**Target**: The underlying anatomy.
**Behavior**: This mode performs a "digital undressing" to reveal the muscle structure and pose dynamics.
**Safety**: This is **NOT** for generating explicit content. The prompt explicitly instructs the AI to use "Barbie/Ken doll" smooth surfacing for private areas. The goal is strict anatomical reference for artists who need to see how the shoulder connects to the arm without a jacket in the way.

### 5.7 Model Full (Body Reconstruction)
**Target**: The complete figure.
**Behavior**: If your photo cuts off the subject's feet or legs, this mode invents them. It will draw a complete standing figure based on the visible upper body, perfect for fixing bad framing in reference photos.

### 5.8 All People / All People Nude
**Target**: Groups.
**Behavior**: These are special variants of the Character and Nude tasks that process *everyone* in the frame simultaneously, preserving the interaction between figures (e.g., holding hands, fighting, hugging) which might be lost if processed individually.

---

## 6. Advanced Configuration

### 6.1 Gender Bias
Sometimes, line art can be ambiguous. The **Gender** setting in Options allows you to bias the output.
- **As-Is**: The AI decides based on visual evidence.
- **Female/Male/Other**: Forces the AI to interpret the anatomical cues (jawline, hips, shoulders) towards a specific gender presentation. This is useful for stylization or correcting misinterpretations in blurry photos.

### 6.2 Quality Levels
The quality slider adjusts the "Detail Level" prompt injection.
- **Very Low**: Abstract, almost logo-like. Good for vector tracing.
- **Medium**: Standard comic book style.
- **Very High**: Hyper-realism. Uses cross-hatching and stippling effects to represent shading via lines. Note that "Very High" often results in "busier" images that may be harder to color.

### 6.3 4K Upscaling
Found in the gallery footer (Magic Wand icon), this feature is distinct from generation.
- **Model**: Uses **Gemini 3 Pro Image Preview** exclusively.
- **Process**: It takes your generated line art (e.g., a 1024x1024 PNG), sends it back to the AI with a prompt to "Enhance resolution, sharpen lines, and remove artifacts," and returns a 4K (approx 4096px) image.
- **Cost**: This is a more expensive operation in terms of API quota.

---

## 7. Troubleshooting & Errors

### 7.1 "Content Policy Violation"
**Cause**: Google's Safety Filters.
**Trigger**: Even though this app sets safety thresholds to "BLOCK_NONE", Google's API has hard-coded filters for Child Safety and extreme violence that cannot be bypassed.
**Solution**: Try a different image or crop the image to remove sensitive areas before uploading.

### 7.2 "Service Overloaded (503)"
**Cause**: High traffic on Google's Gemini servers.
**Behavior**: The app automatically retries these errors up to 3 times with exponential backoff (waiting longer between each try).
**Action**: If a job moves to the "Failed" queue, you can click "Retry" manually later.

### 7.3 "No People Detected"
**Cause**: The scanner failed to find a human confidence score above threshold.
**Result**: Character-specific tasks (Face, Nude, Model) are skipped.
**Resolution**: Ensure the subject is well-lit and not obscured. This is not a bug, but a filter to prevent the AI from trying to extract a "Face" from a picture of a landscape.

### 7.4 "Network Error / Failed to Fetch"
**Cause**: Usually a local internet interruption or a very large file upload timing out.
**Action**: Check your connection. Reloading the page is safe; however, you will lose the current session's queue as it is stored in RAM.

---

## 8. Keyboard Shortcuts & Tricks

- **Arrow Left/Right**: When the Image Viewer is open, navigate rapidly through the queue.
- **Escape**: Closes any open modal (Viewer, Options, Console).
- **Drag & Drop**: You can drop images anywhere on the window, not just the upload box.
- **Click & Drag**: In the Image Viewer, you can pan around the zoomed-in image.
- **Scroll Wheel**: Zooms in/out on the Image Viewer.

---

## 9. Privacy & Data Handling

LineArtify is a **client-side** application.
- **Images**: Your photos are processed in your browser's memory. They are sent *directly* to Google's API endpoint. They do not pass through any "LineArtify" server.
- **Logging**: The "Console" feature logs data locally. It does not report telemetry.
- **Persistence**: There is no database. If you refresh the tab, your workspace is cleared. Use the "Save" (Export JSON) feature if you need to save a session.

---

## 10. Credits & Licensing

**Engine**: Google Gemini 2.5 Flash & Gemini 3 Pro.
**Development**: Developed as a technical demonstration of the Google GenAI SDK capabilities.
**Icons**: Lucide React.
**Framework**: React 19 / Tailwind CSS.

*Documentation Revision 3.5 - 2025*
`;
