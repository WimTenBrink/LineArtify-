
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
              <p className="text-xs text-slate-400 font-mono">LineArtify Documentation v3.0</p>
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
      if (line.startsWith('- ')) {
        return <li key={index} className="ml-4 text-slate-300 mb-1">{line.replace('- ', '')}</li>;
      }
      if (line.startsWith('1. ')) {
        return <div key={index} className="ml-4 text-slate-300 mb-2 font-medium flex"><span className="mr-2 text-indigo-500">•</span> {line.replace(/^\d+\. /, '')}</div>;
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
              return <strong key={i} className="text-slate-200 font-bold">{part.slice(2, -2)}</strong>;
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

const MANUAL_CONTENT = `# LineArtify Application Manual

## 1. Introduction
Welcome to **LineArtify Gemini Edition**, a state-of-the-art web application designed to transform standard images into professional-grade line art, anatomical models, and background assets. Leveraging the advanced capabilities of **Google's Gemini 2.5 Flash Image model**, this tool provides artists, designers, and hobbyists with a seamless workflow for extracting clean, vector-like raster graphics from reference photos.

This manual serves as a comprehensive guide to understanding, operating, and troubleshooting the application.

## 2. Getting Started

### 2.1 Prerequisites
- A modern web browser.
- An active internet connection.
- A valid **Google GenAI API Key**.

### 2.2 API Key Configuration
1.  **Setting the Key**: Click the **Key Icon** button in the application header.
2.  **Authentication**: Select your paid project and key via the Google AI Studio dialog.
3.  **Note**: Keys are not stored on any server. They are used locally within your session.

## 3. Workflow & Features

### 3.1 Immediate Scanning
Upon uploading an image, the application **automatically** begins scanning for human subjects in the background. You do not need to press Start for this step.
- **Visual Feedback**: Detected people are highlighted with a **Target Bounding Box** directly on the Input Queue thumbnail.
- **Error Handling**: If no people are detected, the item moves to the **Error Queue** to inform you, allowing you to retry if necessary or accept that only scene-level tasks (Full/Background) will be generated.

### 3.2 Detail Level Control
Located in the header, the **Detail Level Slider** allows you to fine-tune the complexity of the generated line art:
- **Low**: Simplified, clean lines. Ideal for icons or base sketches.
- **Medium**: Balanced detail. Standard professional illustration style.
- **High**: Intricate detail. Captures fine textures, hair strands, and cloth folds.

### 3.3 Input Queue Management
The Input Queue gives you full control over your batch processing:
- **Priority Controls**: Use the **Top**, **Up**, **Down**, and **Bottom** arrows on any pending job to reorder it.
- **Zoom**: Click any image thumbnail to open the full-screen **Image Viewer**.
- **Filtering**: The global filter (Full/Char/BG) also filters the queue, helping you focus on specific task types.
- **Persistence**: Completed jobs remain in the list (marked with green checks), allowing you to **Rerun** them or click **Locate** to find the result in the gallery.

### 3.4 Gallery & Results
- **Layout**: Images are displayed in a responsive masonry grid with a maximum height of **40vh** for optimal viewing.
- **Interaction**: 
  - **Zoom**: Click any result to inspect it in high detail.
  - **Download**: Hover over an image to download the PNG.
  - **Delete**: Use the trash icon to remove an image from the gallery.
- **Locate**: Clicking a "Success" item in the Input Queue automatically scrolls the gallery to the result.

## 4. Image Generation Modes

**1. Full Line Art**
- **Description**: A faithful reproduction of the entire scene.
- **Style**: Black lines on transparent background.

**2. Model Extraction**
- **Description**: Isolates the main character(s) on a solid white background.
- **Style**: Anatomical study / Mannequin style. Clothing is often simplified to reveal pose structure.

**3. Background Extraction**
- **Description**: The scene without the characters. The AI attempts to fill in the space behind the subject.

**4. Body Reconstruction (Auto-Crop)**
- If a character is cut off by the frame (e.g. missing feet), the AI attempts to reconstruct the missing parts, creating a complete standing figure.

**5. Opposite View**
- **Description**: The AI hallucinates the reverse angle of the subject (e.g., generates a Back view from a Front photo).
- **Use Case**: Character design sheets.

## 5. Keyboard Shortcuts
- **Arrow Left / Right**: Navigate through images in the Image Viewer.
- **Escape**: Close the Image Viewer or Console.

## 6. Troubleshooting

### 6.1 "No People Detected" Error
- This occurs if the initial scan finds zero human subjects. The specific character tasks are skipped, but the Full Scene and Background tasks for that file remain valid in the queue.

### 6.2 Processing Stalled
- If the queue stops, click the **Stop** button, wait a second, and click **Start** again to reset the processor.

### 6.3 Performance
- The application processes images one by one to ensure stability.
- Large images are processed locally for cropping, which may cause brief UI pauses.

---

*Manual last updated: October 2025*
*LineArtify v3.0.0*
`;
