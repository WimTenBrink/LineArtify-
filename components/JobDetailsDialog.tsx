import React, { useState } from 'react';
import { X, Download, FileText, Calendar, Activity, AlertTriangle, CheckCircle, Hash, Tag, Layers, Cpu } from 'lucide-react';
import { QueueItem, SourceImage, ProcessingStatus } from '../types';

interface JobDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  job?: QueueItem;
  source?: SourceImage;
}

const getBase64FromUrl = async (url: string): Promise<string> => {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return "";
    }
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const JobDetailsDialog: React.FC<JobDetailsDialogProps> = ({ isOpen, onClose, job, source }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen || !job) return null;

  const handleDownloadReport = async () => {
     setIsGenerating(true);
     try {
         // Determine filename
         const baseName = source?.displayName || source?.file.name.split('.')[0] || "job";
         const safeName = baseName.replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
         const filename = `${job.taskType}-${safeName}.md`;

         // Gather Data
         const dateStr = new Date(job.timestamp).toLocaleString();
         const resultBase64 = job.result?.url ? await getBase64FromUrl(job.result.url) : null;
         const sourceBase64 = await fileToBase64(job.file);

         const content = `
# Job Report: ${job.taskType}
**Date:** ${dateStr}
**Status:** ${job.status}
**Job ID:** ${job.id}

## Source Information
- **Original Filename:** ${source?.file.name || job.file.name}
- **Source ID:** ${job.sourceId}
- **Display Name:** ${safeName}

## Job Configuration
- **Task Type:** ${job.taskType}
- **Priority:** ${job.priority}
- **Retries:** ${job.retryCount} / ${job.maxRetries}
- **Blocked:** ${job.isBlocked ? 'Yes' : 'No'}

## Execution Details
${job.result?.prompt ? `### System Prompt Used
\`\`\`text
${job.result.prompt}
\`\`\`
` : ''}

${job.errorHistory && job.errorHistory.length > 0 ? `### Error History
${job.errorHistory.map(e => `- ${e}`).join('\n')}
` : ''}

## Attached Images

### Source Image
![Source](${sourceBase64})

${resultBase64 ? `### Generated Result
![Result](${resultBase64})` : ''}
         `.trim();

         const blob = new Blob([content], { type: 'text/markdown' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = filename;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);

     } catch (e) {
         console.error("Failed to generate report", e);
         alert("Failed to generate report.");
     } finally {
         setIsGenerating(false);
     }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e1c2e] w-[600px] max-w-[95vw] max-h-[90vh] rounded-xl shadow-2xl flex flex-col border border-white/10 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#252233] border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="text-purple-400" size={20} />
            <h2 className="text-lg font-bold text-white tracking-tight">Job Details</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={24} className="text-slate-400 hover:text-white" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            
            {/* Status Card */}
            <div className={`p-4 rounded-lg border flex items-center justify-between ${
                job.status === ProcessingStatus.SUCCESS ? 'bg-emerald-500/10 border-emerald-500/30' :
                job.status === ProcessingStatus.ERROR ? 'bg-red-500/10 border-red-500/30' :
                job.status === ProcessingStatus.PROCESSING ? 'bg-blue-500/10 border-blue-500/30' :
                'bg-slate-800/50 border-white/5'
            }`}>
                <div className="flex items-center gap-3">
                    {job.status === ProcessingStatus.SUCCESS && <CheckCircle className="text-emerald-400" size={24} />}
                    {job.status === ProcessingStatus.ERROR && <AlertTriangle className="text-red-400" size={24} />}
                    {job.status === ProcessingStatus.PROCESSING && <Activity className="text-blue-400 animate-pulse" size={24} />}
                    {job.status === ProcessingStatus.PENDING && <Calendar className="text-slate-400" size={24} />}
                    
                    <div>
                        <div className="text-xs font-bold uppercase opacity-70">Status</div>
                        <div className="font-bold text-white">{job.status}</div>
                    </div>
                </div>
                <div className="text-right">
                     <div className="text-xs font-bold uppercase opacity-70">Retry Count</div>
                     <div className="font-mono text-slate-300">{job.retryCount} / {job.maxRetries}</div>
                </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/30 p-3 rounded border border-white/5">
                    <div className="flex items-center gap-2 text-slate-400 mb-1"><Tag size={14} /><span className="text-xs font-bold uppercase">Task Type</span></div>
                    <div className="text-sm text-white truncate" title={job.taskType}>{job.taskType}</div>
                </div>
                <div className="bg-slate-800/30 p-3 rounded border border-white/5">
                    <div className="flex items-center gap-2 text-slate-400 mb-1"><Hash size={14} /><span className="text-xs font-bold uppercase">Priority</span></div>
                    <div className="text-sm text-white">{job.priority}</div>
                </div>
                <div className="bg-slate-800/30 p-3 rounded border border-white/5 col-span-2">
                    <div className="flex items-center gap-2 text-slate-400 mb-1"><Layers size={14} /><span className="text-xs font-bold uppercase">Source File</span></div>
                    <div className="text-sm text-white truncate">{source?.displayName || job.file.name}</div>
                </div>
                <div className="bg-slate-800/30 p-3 rounded border border-white/5 col-span-2">
                    <div className="flex items-center gap-2 text-slate-400 mb-1"><Cpu size={14} /><span className="text-xs font-bold uppercase">Job ID</span></div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">{job.id}</div>
                </div>
            </div>

            {/* Prompt Preview */}
            {job.result?.prompt && (
                <div className="bg-black/30 rounded border border-white/5 p-3">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-2">Prompt Snapshot</div>
                    <div className="text-xs font-mono text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {job.result.prompt}
                    </div>
                </div>
            )}

             {/* Error Log */}
            {job.errorHistory && job.errorHistory.length > 0 && (
                <div className="bg-red-900/10 rounded border border-red-500/20 p-3">
                    <div className="text-xs font-bold text-red-400 uppercase mb-2">Error Log</div>
                    <ul className="list-disc list-inside text-xs text-red-300/80 space-y-1">
                        {job.errorHistory.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                </div>
            )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-[#1a1825] border-t border-white/5 shrink-0 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-bold text-xs transition-colors">Close</button>
            <button 
                onClick={handleDownloadReport} 
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-xs shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isGenerating ? 'Generating...' : (
                    <>
                        <Download size={14} /> <span>Save Report (.md)</span>
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};
