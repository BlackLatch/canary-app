'use client';

import { useState, useEffect } from 'react';
import { Shield, Bell, Database, Key, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useTheme } from '../lib/theme-context';
import { clearDemoDisclaimerPreference } from './DemoDisclaimer';

interface SettingsViewProps {
  onBack: () => void;
}

export default function SettingsView({ onBack }: SettingsViewProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'storage' | 'privacy' | 'advanced'>('storage');
  
  // Settings state
  const [debugMode, setDebugMode] = useState(false);
  const [storagePreference, setStoragePreference] = useState<'pinata' | 'ipfs' | 'codex'>('pinata');
  
  // Load settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDebugMode = localStorage.getItem('canary-debug-mode');
      const savedStorage = localStorage.getItem('canary-storage-preference');
      
      if (savedDebugMode !== null) setDebugMode(savedDebugMode === 'true');
      if (savedStorage) setStoragePreference(savedStorage as 'pinata' | 'ipfs' | 'codex');
    }
  }, []);
  
  // Save settings to localStorage
  const saveSetting = (key: string, value: string | boolean) => {
    localStorage.setItem(key, value.toString());
  };
  
  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all local data? This action cannot be undone.')) {
      // Clear specific Canary data, but preserve theme
      const themeToPreserve = localStorage.getItem('theme');
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('canary') && !key.includes('theme')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
      if (themeToPreserve) localStorage.setItem('theme', themeToPreserve);
      
      alert('Local data cleared successfully');
    }
  };

  return (
    <div className={`flex-1 overflow-auto ${theme === "light" ? "bg-white" : "bg-black"}`}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className={`mb-8 border-b pb-6 ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}>
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onBack}
              className={`p-2 rounded-full transition-colors ${
                theme === 'light' 
                  ? 'hover:bg-gray-100 text-gray-600' 
                  : 'hover:bg-white/10 text-gray-400'
              }`}
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="editorial-header-large text-gray-900 dark:text-gray-100">
              SETTINGS
            </h1>
          </div>
          <p className="editorial-body text-gray-600 dark:text-gray-400">
            Configure your preferences and manage your account
          </p>
        </div>

        {/* Settings Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('storage')}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'storage'
                    ? theme === 'light' 
                      ? 'bg-gray-100 text-gray-900 font-medium' 
                      : 'bg-white/10 text-white font-medium'
                    : theme === 'light'
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                Storage
              </button>
              <button
                onClick={() => setActiveTab('privacy')}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'privacy'
                    ? theme === 'light' 
                      ? 'bg-gray-100 text-gray-900 font-medium' 
                      : 'bg-white/10 text-white font-medium'
                    : theme === 'light'
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                Privacy & Security
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'advanced'
                    ? theme === 'light' 
                      ? 'bg-gray-100 text-gray-900 font-medium' 
                      : 'bg-white/10 text-white font-medium'
                    : theme === 'light'
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                Advanced
              </button>
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <div className={`p-6 rounded-lg border ${
              theme === 'light' 
                ? 'bg-white border-gray-200' 
                : 'bg-black border-gray-700'
            }`}>
              {activeTab === 'storage' && (
                <div className="space-y-8">
                  <div>
                    <h3 className={`text-lg font-medium mb-4 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      Storage Preference
                    </h3>
                    
                    <select
                      value={storagePreference}
                      onChange={(e) => {
                        const value = e.target.value as 'pinata' | 'ipfs' | 'codex';
                        setStoragePreference(value);
                        saveSetting('canary-storage-preference', value);
                      }}
                      className={`w-full max-w-xs px-3 py-2 rounded border ${
                        theme === 'light'
                          ? 'bg-white border-gray-300 text-gray-900'
                          : 'bg-black border-gray-600 text-white'
                      }`}
                    >
                      <option value="pinata">Pinata (Recommended)</option>
                      <option value="ipfs">IPFS</option>
                      <option value="codex">Codex (Experimental)</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="space-y-8">
                  <div>
                    <h2 className={`text-lg font-medium mb-6 flex items-center gap-2 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      <Shield className="w-5 h-5" />
                      Privacy & Security
                    </h2>
                    
                    <div className={`p-4 rounded-lg ${
                      theme === 'light' 
                        ? 'bg-gray-50 border border-gray-200' 
                        : 'bg-white/5 border border-gray-700'
                    }`}>
                      <p className={`text-sm mb-4 font-medium ${
                        theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                      }`}>
                        Your data privacy is important to us:
                      </p>
                      <ul className={`text-sm space-y-3 ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>All encryption happens locally in your browser</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>Private keys never leave your device</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-lg font-medium mb-4 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      Local Data Management
                    </h3>
                    
                    <div className={`p-4 rounded-lg border ${
                      theme === 'light' 
                        ? 'bg-yellow-50 border-yellow-200' 
                        : 'bg-yellow-900/10 border-yellow-800'
                    }`}>
                      <p className={`text-sm mb-4 ${
                        theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                      }`}>
                        Clear all locally stored preferences and cached data. This will not affect your encrypted documents.
                      </p>
                      <button
                        onClick={handleClearData}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          theme === 'light'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                      >
                        Clear Local Data
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {activeTab === 'advanced' && (
                <div className="space-y-8">
                  <div>
                    <h2 className={`text-lg font-medium mb-6 flex items-center gap-2 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      <Key className="w-5 h-5" />
                      Developer Options
                    </h2>
                    
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div>
                          <label className={`text-sm font-medium block ${
                            theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                          }`}>
                            Debug Mode
                          </label>
                          <p className={`text-sm mt-1 ${
                            theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            Show additional logging in browser console
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={debugMode}
                        onChange={(e) => {
                          setDebugMode(e.target.checked);
                          saveSetting('canary-debug-mode', e.target.checked);
                        }}
                        className="mt-1 rounded"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-lg font-medium mb-4 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      Network Information
                    </h3>
                    
                    <div className={`p-4 rounded-lg border space-y-3 ${
                      theme === 'light' 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-white/5 border-gray-700'
                    }`}>
                      <div className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">Network:</span> Polygon Amoy (Testnet)
                      </div>
                      <div className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">Chain ID:</span> 80002
                      </div>
                      <div className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">Contract Version:</span> DossierV2
                      </div>
                      <div className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">Contract Address:</span> 
                        <span className="font-mono text-xs ml-2">0x3F5e...8a7B</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-lg font-medium mb-4 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      About Canary
                    </h3>
                    
                    <div className={`space-y-2 ${
                      theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      <p className="text-sm">Version: 0.1.0 (Alpha)</p>
                      <p className="text-sm">Build: Testnet Demo</p>
                      <p className="text-sm">© 2025 Canary. All rights reserved.</p>
                      <div className="pt-4">
                        <a 
                          href="https://github.com/TheThirdRoom/canary" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`text-sm hover:underline ${
                            theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                          }`}
                        >
                          View on GitHub →
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}