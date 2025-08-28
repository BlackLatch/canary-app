'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/app/lib/theme-context';

interface DemoPopupProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export default function DemoPopup({ forceShow, onClose }: DemoPopupProps = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    // If forceShow is true, always show the popup
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    // Check if user has permanently disabled the popup by checking the checkbox
    const permanentlyHidden = localStorage.getItem('demo-popup-hidden');
    if (permanentlyHidden === 'true') {
      return;
    }

    // Always show popup unless explicitly disabled via checkbox
    // Show popup after a short delay for better UX
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [forceShow]);

  const handleClose = () => {
    if (!forceShow && dontShowAgain) {
      localStorage.setItem('demo-popup-hidden', 'true');
    }
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] animate-fade-in"
        onClick={handleClose}
      />
      
      {/* Popup */}
      <div className="fixed inset-0 flex items-center justify-center z-[10000] pointer-events-none">
        <div 
          className={`pointer-events-auto max-w-md w-full mx-4 animate-slide-up editorial-card-bordered ${
            theme === 'light' 
              ? 'bg-white border-gray-300' 
              : 'bg-black border-gray-600'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${
            theme === 'light' ? 'border-gray-300' : 'border-gray-600'
          }`}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className={`editorial-header-small uppercase tracking-wide ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}>
                Testnet Demo
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
              Welcome to the <span className="text-red-600 font-medium">Canary</span> testnet demo. This is alpha software running on the Polygon Amoy test network.
            </p>
            
            <div className={`p-4 rounded border ${
              theme === 'light' 
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-white/5 border-gray-700'
            }`}>
              <p className={`text-sm font-medium mb-2 ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}>
                Important Notes:
              </p>
              <ul className={`text-sm space-y-1 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                <li>• No real funds or assets are used</li>
                <li>• Data may be reset at any time</li>
                <li>• Features are experimental and may change</li>
              </ul>
            </div>

            <p className={`text-xs mt-4 ${
              theme === 'light' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              By continuing, you acknowledge that this is a demonstration only.
            </p>
          </div>

          {/* Footer */}
          <div className={`p-6 border-t ${
            theme === 'light' ? 'border-gray-300' : 'border-gray-600'
          }`}>
            {/* Checkbox */}
            <label className={`flex items-center gap-3 mb-4 cursor-pointer ${
              theme === 'light' ? 'text-gray-700' : 'text-gray-300'
            }`}>
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className={`w-4 h-4 rounded border ${
                  theme === 'light' 
                    ? 'border-gray-300 text-black focus:ring-black' 
                    : 'border-gray-600 bg-black text-white focus:ring-white'
                } focus:ring-2 focus:ring-offset-0 cursor-pointer`}
              />
              <span className="text-sm select-none">
                Don't show this message again
              </span>
            </label>

            <button
              onClick={handleClose}
              className={`w-full py-3 px-6 font-medium text-base rounded-lg transition-all duration-300 ease-out border ${
                theme === 'light'
                  ? 'bg-black text-white border-black hover:border-[#e53e3e] hover:bg-gray-800'
                  : 'bg-black/40 text-white border-gray-600 hover:border-[#e53e3e] hover:bg-[rgba(229,62,62,0.1)]'
              }`}
            >
              I Understand, Continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
}