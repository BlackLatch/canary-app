'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DemoDisclaimerProps {
  theme: 'light' | 'dark';
}

export default function DemoDisclaimer({ theme }: DemoDisclaimerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // Check if user has opted to not show again
    const hideDemo = localStorage.getItem('canary_hide_demo_disclaimer');
    if (!hideDemo || hideDemo !== 'true') {
      // Small delay to let the page render first
      setTimeout(() => setIsOpen(true), 500);
    }
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('canary_hide_demo_disclaimer', 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]" />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[10001] pointer-events-none">
        <div className={`pointer-events-auto max-w-md w-full mx-4 animate-slide-up editorial-card-bordered ${
          theme === 'light' 
            ? 'bg-white border-gray-300' 
            : 'bg-black border-gray-600'
        }`}>
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${
            theme === 'light' ? 'border-gray-300' : 'border-gray-600'
          }`}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h2 className={`editorial-header-small uppercase tracking-wide ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}>
                Demo Only
              </h2>
            </div>
            <button
              onClick={handleClose}
              className={`p-1.5 rounded-full transition-colors ${
                theme === 'light' 
                  ? 'hover:bg-gray-100 text-gray-600' 
                  : 'hover:bg-white/10 text-gray-400'
              }`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className={`editorial-body mb-4 ${
              theme === 'light' ? 'text-gray-700' : 'text-gray-300'
            }`}>
              This is an early demo of <span className="font-medium">Canary</span>. It is not ready for real-world use 
              and should not be trusted with sensitive or important data.
            </p>
            
            <p className={`editorial-body mb-4 ${
              theme === 'light' ? 'text-gray-700' : 'text-gray-300'
            }`}>
              Future updates may reset or change how this demo works, which could affect access to anything created here.
            </p>

            {/* Don't show again checkbox */}
            <label className={`flex items-center gap-2 cursor-pointer ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm">Don't show this again</span>
            </label>
          </div>

          {/* Footer */}
          <div className={`p-6 border-t ${
            theme === 'light' ? 'border-gray-300' : 'border-gray-600'
          }`}>
            <button
              onClick={handleClose}
              className={`w-full py-3 px-6 font-medium text-base rounded-lg transition-all duration-300 ease-out border ${
                theme === 'light'
                  ? 'bg-black text-white border-black hover:bg-gray-800'
                  : 'bg-black/40 text-white border-gray-600 hover:bg-black/60'
              }`}
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Utility function to clear the demo disclaimer preference
export const clearDemoDisclaimerPreference = () => {
  localStorage.removeItem('canary_hide_demo_disclaimer');
};