import React, { useState } from 'react';
import { X, Github, Shield, FileText, Code } from 'lucide-react';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'ABOUT' | 'PRIVACY' | 'TERMS'>('ABOUT');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e1c2e] w-[600px] max-w-[95vw] h-[80vh] rounded-xl shadow-2xl flex flex-col border border-white/10 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#252233] border-b border-white/5 shrink-0">
          <h2 className="text-lg font-bold text-white tracking-tight">About LineArtify</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} className="text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#1a1825] shrink-0">
           <button 
             onClick={() => setActiveTab('ABOUT')} 
             className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors border-b-2 ${activeTab === 'ABOUT' ? 'text-indigo-400 border-indigo-500 bg-[#2d2a3d]' : 'text-slate-400 border-transparent hover:bg-[#2d2a3d]/50'}`}
           >
             App Info
           </button>
           <button 
             onClick={() => setActiveTab('PRIVACY')} 
             className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors border-b-2 ${activeTab === 'PRIVACY' ? 'text-emerald-400 border-emerald-500 bg-[#2d2a3d]' : 'text-slate-400 border-transparent hover:bg-[#2d2a3d]/50'}`}
           >
             Privacy Policy
           </button>
           <button 
             onClick={() => setActiveTab('TERMS')} 
             className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-colors border-b-2 ${activeTab === 'TERMS' ? 'text-amber-400 border-amber-500 bg-[#2d2a3d]' : 'text-slate-400 border-transparent hover:bg-[#2d2a3d]/50'}`}
           >
             Terms of Service
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#13111c]">
          
          {activeTab === 'ABOUT' && (
            <div className="space-y-6 text-center">
               <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
                  <Code className="text-white w-10 h-10" />
               </div>
               
               <div>
                 <h1 className="text-2xl font-bold text-white mb-2">LineArtify</h1>
                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                    <span className="text-xs font-mono text-indigo-300">Gemini Edition</span>
                    <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                    <span className="text-xs font-mono text-slate-400">v4.5</span>
                 </div>
               </div>

               <p className="text-slate-300 leading-relaxed max-w-md mx-auto">
                 Convert your photos into stunning, high-detail line art using the power of Google's Gemini 2.5 Flash and Gemini 3 Pro models. Designed for artists, illustrators, and hobbyists.
               </p>

               <div className="pt-6 border-t border-white/5">
                 <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-4">Created By</p>
                 <div className="font-medium text-white mb-1">Knowledge And Technology Joyfully Engaged</div>
                 <div className="text-sm text-slate-400">(Katje B.V.)</div>
               </div>

               <div className="pt-4 flex justify-center">
                 <a 
                   href="https://github.com/WimTenBrink/LineArtify-" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-white/10 font-bold text-sm"
                 >
                   <Github size={18} />
                   <span>View Source on GitHub</span>
                 </a>
               </div>
            </div>
          )}

          {activeTab === 'PRIVACY' && (
            <div className="space-y-6 text-slate-300">
               <div className="flex items-center gap-3 mb-6">
                 <Shield className="text-emerald-400 w-8 h-8" />
                 <h2 className="text-xl font-bold text-white">Privacy Policy</h2>
               </div>
               
               <div className="prose prose-invert prose-sm max-w-none">
                 <p className="font-bold text-white">Effective Date: {new Date().toLocaleDateString()}</p>
                 
                 <h3>1. Overview</h3>
                 <p>
                   LineArtify ("the Application") is created by Knowledge And Technology Joyfully Engaged (Katje B.V.). 
                   We respect your privacy and are committed to protecting your personal data. 
                   This policy explains how your data is handled.
                 </p>

                 <h3>2. Data Collection & Processing</h3>
                 <ul className="list-disc pl-4 space-y-2">
                   <li>
                     <strong>Client-Side Execution:</strong> The Application runs locally in your web browser. 
                     Katje B.V. does not collect, store, or transmit your images or personal data to our own servers.
                   </li>
                   <li>
                     <strong>AI Processing:</strong> To generate line art, your images and prompts are sent directly from your browser 
                     to <strong>Google's Gemini API</strong>. This transmission occurs securely using your provided API Key.
                   </li>
                   <li>
                     <strong>Local Storage:</strong> Your workspace data (uploaded images, generated results, settings) 
                     is stored locally on your device using your browser's IndexedDB technology.
                   </li>
                 </ul>

                 <h3>3. Third-Party Services</h3>
                 <p>
                   The Application relies on Google AI Studio services. By using this Application, you acknowledge that your data 
                   is processed subject to <a href="https://policies.google.com/privacy" target="_blank" className="text-indigo-400 hover:underline">Google's Privacy Policy</a> and <a href="https://ai.google.dev/terms" target="_blank" className="text-indigo-400 hover:underline">Terms of Service</a>.
                 </p>

                 <h3>4. No Tracking</h3>
                 <p>
                   We do not use cookies, analytics, or tracking pixels to monitor your usage of the Application.
                 </p>
               </div>
            </div>
          )}

          {activeTab === 'TERMS' && (
            <div className="space-y-6 text-slate-300">
               <div className="flex items-center gap-3 mb-6">
                 <FileText className="text-amber-400 w-8 h-8" />
                 <h2 className="text-xl font-bold text-white">Terms of Service</h2>
               </div>

               <div className="prose prose-invert prose-sm max-w-none">
                 <p className="font-bold text-white">Last Updated: {new Date().toLocaleDateString()}</p>
                 
                 <h3>1. Acceptance of Terms</h3>
                 <p>
                   By accessing and using LineArtify, you agree to comply with and be bound by these Terms of Service.
                 </p>

                 <h3>2. Use of Service</h3>
                 <p>
                   LineArtify is a tool for artistic generation. You agree to use it responsibly and in compliance with all applicable laws. 
                   You must not use the Application to generate illegal, harmful, or abusive content.
                 </p>

                 <h3>3. Intellectual Property</h3>
                 <ul className="list-disc pl-4 space-y-2">
                   <li>
                     <strong>Source Code:</strong> The source code of LineArtify is open source and available on GitHub.
                   </li>
                   <li>
                     <strong>Generated Content:</strong> You retain ownership of the content you generate, subject to Google's Generative AI terms.
                   </li>
                 </ul>

                 <h3>4. Disclaimer of Warranties</h3>
                 <p>
                   THE APPLICATION IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO 
                   THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
                   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY.
                 </p>

                 <h3>5. API Costs</h3>
                 <p>
                   You are responsible for any costs associated with your use of the Google Gemini API. 
                   Katje B.V. is not responsible for charges incurred on your Google Cloud or AI Studio accounts.
                 </p>
               </div>
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-[#1a1825] border-t border-white/5 text-center text-xs text-slate-500 shrink-0">
          © {new Date().getFullYear()} Katje B.V. | <a href="https://github.com/WimTenBrink/LineArtify-" target="_blank" className="hover:text-indigo-400 transition-colors">Open Source</a>
        </div>

      </div>
    </div>
  );
};

export default AboutDialog;