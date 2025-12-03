
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
              <p className="text-xs text-slate-400 font-mono">LineArtify Documentation v2.5</p>
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

This manual serves as a comprehensive guide to understanding, operating, and troubleshooting the application. Whether you are generating a single character study or processing a batch of hundreds of images, LineArtify provides the robust toolset necessary to accomplish your goals.

## 2. Getting Started

### 2.1 Prerequisites
To use LineArtify, you require:
- A modern web browser (Chrome, Firefox, Edge, or Safari).
- An active internet connection.
- A valid **Google GenAI API Key** (Paid Tier recommended for high volume).

### 2.2 API Key Configuration
The application does not store your API Key on any server; it is used locally within your browser session to authenticate requests with Google's servers.

1.  **Obtaining a Key**: Visit Google AI Studio to generate your API key.
2.  **Setting the Key**: Click the **Key Icon** button in the application header.
3.  **Authentication**: A secure dialog provided by Google AI Studio will appear. Select your project and key.
4.  **Confirmation**: Once selected, the application will log a confirmation message in the system console.

*Note: If the key is invalid or lacks permission for the Gemini 2.5 models, processing will fail immediately with an authentication error.*

## 3. User Interface Overview

The interface is divided into three primary vertical columns, flanked by a header and specialized overlays.

### 3.1 Header
The header controls global application state:
- **Logo Area**: Displays app version.
- **Status Indicator**: A pulsing pill in the center showing real-time operations (e.g., "Initializing...", "Processing...").
- **Gender Selector**: Dropdown to enforce gender presentation in generated art.
- **Error Widget**: Appears only when errors occur, showing the most recent issue. Click to expand a dropdown of the last 5 unique errors.
- **API Key Button**: For credential management.
- **Console Button**: Opens the system logs for debugging.
- **Manual Button**: Opens this documentation.
- **Start/Stop Button**: The master switch for the processing queue.

### 3.2 Input Queue (Left Column)
This area manages the raw images waiting to be processed.
- **Drag & Drop**: The entire screen accepts dropped files, but the visual drop zone is located here.
- **File List**: Shows thumbnails, filenames, and current status (Pending, Processing, Waiting).
- **Controls**: Individual delete buttons and a "Clear Queue" button to remove all pending items.

### 3.3 Gallery (Center Column)
The heart of the application where results appear.
- **Layout**: Uses a masonry layout to respect the aspect ratio of every generated image.
- **Interaction**: Hovering over an image reveals options to **Inspect** (view full screen) or **Download**.
- **Organization**: Images are grouped by their source file, but flow naturally to maximize screen real estate.

### 3.4 Error Queue (Right Column)
A dedicated space for items that failed processing.
- **Retry Logic**: Items here can be retried individually or in bulk.
- **Persistence**: Failed items retain their original file data so you don't need to re-upload.
- **Safety**: Items are not removed until explicitly deleted or successfully processed.

## 4. Core Features

### 4.1 Image Generation Modes
For every uploaded image, LineArtify attempts to generate three distinct variations automatically. This multi-modal approach ensures you get the exact asset you need without prompting.

**1. Full Line Art**
- **Description**: A faithful reproduction of the entire image (characters + background).
- **Style**: Clean, precise black lines on a transparent background.
- **Use Case**: General coloring books, artistic references, and scene studies.

**2. Model Extraction**
- **Description**: Isolates the main character(s) from the scene.
- **Style**: Anatomical study style with minimal shading.
- **Format**: Rendered on a **Solid White** background to serve as a fashion croquis or drawing base.
- **Special Handling**: The system attempts to remove clothing (nude base) and footwear to provide a neutral mannequin. Safety filters are handled via "omission" rather than blurring, leaving sensitive areas as blank white space.

**3. Background Extraction**
- **Description**: The scene without the characters.
- **Intelligence**: The AI attempts to "inpainting" the area behind the character, revealing what was occluded.
- **Use Case**: animation backgrounds, game assets, and scene setting.

### 4.2 Gender Enforce
Located in the header, the **Gender Selector** allows you to override the perceived gender of the subject.
- **As-is**: The AI interprets the image naturally.
- **Female/Male/Intersex**: The AI is instructed to adjust anatomy, proportions, and features to match the selected gender target.
- **Application**: This applies to all generation modes (Full, Model, Model-Full) for the current batch.

### 4.3 Smart Cropping & Reconstruction
The application includes a sophisticated "Cropping Detection" agent.
1.  **Analysis**: Before processing, a lightweight AI request analyzes the image to see if the character is cut off (e.g., missing feet, head, or legs).
2.  **Detection**: If the agent detects a cropped figure, it triggers a **Fourth Generation Mode**.
3.  **Line-Model-Full**: This special mode generates a full-body reconstruction. The AI "invents" the missing body parts (e.g., drawing the feet that were out of frame) to create a complete standing model.
4.  **Naming**: These files are saved with the prefix \`Line-Model-Full-\` to distinguish them from the standard extraction.

### 4.4 Automated Workflow
The application follows a strict state machine:
1.  **Pending**: Image uploaded, waiting for the "Start" signal.
2.  **Processing**: The image is locked, and requests are sent to Gemini.
3.  **Success**: Images are generated, blob URLs created, and results moved to the Gallery.
4.  **Error**: If all retries fail, the item moves to the Error Queue.

## 5. Advanced Resilience Systems

LineArtify is built for stability, utilizing a robust retry and fallback mechanism.

### 5.1 Auto-Retry Logic
Network glitches and AI hallucinations happen. The system accounts for this:
- **Count**: 3 Automatic Retries.
- **Behavior**: If an image fails to generate (e.g., 500 error, timeout, or safety block), the system immediately requeues it.
- **Transparency**: The status text updates to show "(Attempt 2)", "(Attempt 3)".

### 5.2 Manual Retry
After 3 failed automatic attempts, the system pauses the item and moves it to the Error Queue.
- **User Action**: You must click "Retry" manually. This prevents infinite loops consuming your API quota.
- **State Preservation**: Any partial results (e.g., if Background succeeded but Model failed) are preserved. Retrying only attempts the missing parts.

### 5.3 Cloud Vision Fallback (The "Point of No Return")
If an image fails **10 times** (combined auto and manual retries), the system determines that visual generation is impossible (likely due to hard safety filters or unrecognizable content).
- **Trigger**: Retry count reaches 10.
- **Action**: Instead of trying to draw lines, the system switches models to **Gemini 2.5 Flash Text Mode**.
- **Output**: It acts as a "Cloud Vision" simulator, generating a detailed text report.
- **Report Content**:
    - Image Labels & Objects.
    - Safety Analysis (Why was it blocked?).
    - Detailed scene description.
- **Format**: The report is generated as a Markdown file (\`.md\`) and displayed in the gallery as a document icon. You can download this report to understand the failure.

## 6. Performance & Optimization

To maintain responsiveness while handling megabytes of image data:

**1. Blob URLs**
The application avoids storing large Base64 strings in React state. Images are immediately converted to \`Blob URLs\`. This keeps the DOM light and prevents interface freezing during renders.

**2. Sequential Processing**
Images are processed one by one (Concurrency: 1). While Gemini is fast, processing multiple high-res images in parallel can crash browser memory tabs. The queue ensures stability over raw speed.

**3. Non-Blocking Cropping**
The "Auto-Crop" feature, which trims whitespace from generated models, runs on a chunked execution cycle. It processes pixel rows in small batches, yielding to the main thread every few milliseconds to keep the UI responsive (spinning loaders keep spinning).

**4. Log Sanitization**
The internal logger strips massive data strings before saving to memory. This prevents the "Console" history from consuming gigabytes of RAM during long sessions.

## 7. Troubleshooting

### 7.1 Common Errors

**"Candidate was blocked by safety settings"**
- **Cause**: The input image contains explicit content that triggers the "HARM_CATEGORY_SEXUALLY_EXPLICIT" filter at a hard level.
- **Solution**: Try cropping the image to focus on the face, or use the "Cloud Vision Report" (retry 10 times) to see exactly what triggered the block.

**"403 Forbidden" / "API Key Invalid"**
- **Cause**: Your API key is missing, deleted, or lacks permissions.
- **Solution**: Click the Key icon in the header and re-select a valid project.

**"Overloaded" / "503 Service Unavailable"**
- **Cause**: Google's servers are under high load.
- **Solution**: The Auto-Retry system usually handles this. If it persists, wait a few minutes before clicking "Retry All".

### 7.2 The App is "Stuck"
If the "Processing..." indicator never goes away:
1.  Click **Stop**.
2.  Open the **Console** to check for pending promises.
3.  Click **Start** again to reset the queue processor.

### 7.3 Images are blank/white
- **Cause**: The model generated white lines on a white background, or the alpha channel failed.
- **Solution**: Use the "Inspect" view. The viewer has a checkerboard pattern to reveal transparency. If the image is truly blank, delete it and retry.

## 8. Keyboard Shortcuts & Gestures
- **Drag & Drop**: Anywhere on the window.
- **Esc**: Closes modals (Console, Image Viewer, Manual).
- **Click Overlay**: Closes dropdowns.

## 9. Technical Specifications

**Models Used**
- **Generation**: \`gemini-2.5-flash-image\`
- **Analysis**: \`gemini-2.5-flash\`
- **Vision**: \`gemini-2.5-flash\` (multimodal)

**Image output**
- **Format**: PNG (24-bit + Alpha)
- **Resolution**: Native resolution of input (scaled by model, usually up to 2048x2048 equivalent).
- **Cropping**: Automatic bounding box calculation with 10px padding.

## 10. Privacy & Data Handling
- **Local Processing**: Images are processed in browser memory.
- **API Transmission**: Images are sent directly to Google's API endpoints via encrypted channel.
- **No Third Party**: No intermediate servers, analytics, or trackers are used in this application.
- **Ephemeral**: Refreshing the page clears all data. Save your work frequently.

---

*Manual last updated: October 2025*
*LineArtify v2.5.0*
`;
