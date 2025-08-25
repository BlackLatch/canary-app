'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/app/lib/theme-context';
import { useAccount, useDisconnect } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import ImpactFeedView from '@/app/components/ImpactFeedView';
import Link from 'next/link';

export default function ImpactFeedPage() {
  const { theme, toggleTheme } = useTheme();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { authenticated, user, logout } = usePrivy();
  const [showAlphaBanner, setShowAlphaBanner] = useState(true);
  const [authMode, setAuthMode] = useState<'standard' | 'advanced'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('canary-auth-mode') as 'standard' | 'advanced') || 'standard';
    }
    return 'standard';
  });

  const hasWalletConnection = () => {
    return (authMode === 'advanced' && isConnected) || (authMode === 'standard' && authenticated);
  };

  const setAuthModeWithPersistence = (mode: 'standard' | 'advanced') => {
    setAuthMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('canary-auth-mode', mode);
    }
  };

  useEffect(() => {
    // Apply the mesh background styles
    if (theme === 'light') {
      document.body.classList.remove('guide-dark');
      document.body.classList.add('guide-light');
    } else {
      document.body.classList.remove('guide-light');
      document.body.classList.add('guide-dark');
    }
    
    return () => {
      document.body.classList.remove('guide-dark', 'guide-light');
    };
  }, [theme]);

  return (
    <div className="min-h-screen flex flex-col">
      <style jsx global>
        {`
          @keyframes meshFloat {
            0%, 100% { background-position: 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%; }
            25% { background-position: 10% 10%, 5% 5%, 2% 2%, 10% 10%, 5% 5%, 2% 2%; }
            50% { background-position: 20% 20%, 10% 10%, 5% 5%, 20% 20%, 10% 10%, 5% 5%; }
            75% { background-position: 10% 10%, 5% 5%, 2% 2%, 10% 10%, 5% 5%, 2% 2%; }
          }
          
          body.guide-dark {
            background-color: #0a0a0a !important;
            background-image: 
              linear-gradient(rgba(255, 255, 255, 0.03) 0.5px, transparent 0.5px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 0.5px, transparent 0.5px),
              linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px),
              linear-gradient(rgba(255, 255, 255, 0.005) 2px, transparent 2px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.005) 2px, transparent 2px) !important;
            background-size: 
              12px 12px,
              12px 12px,
              36px 36px,
              36px 36px,
              72px 72px,
              72px 72px !important;
            animation: meshFloat 20s ease-in-out infinite !important;
          }
          
          body.guide-light {
            background-color: #fefefe !important;
            background-image: 
              linear-gradient(rgba(0, 0, 0, 0.015) 0.5px, transparent 0.5px),
              linear-gradient(90deg, rgba(0, 0, 0, 0.015) 0.5px, transparent 0.5px),
              linear-gradient(rgba(0, 0, 0, 0.008) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 0, 0, 0.008) 1px, transparent 1px),
              linear-gradient(rgba(0, 0, 0, 0.003) 2px, transparent 2px),
              linear-gradient(90deg, rgba(0, 0, 0, 0.003) 2px, transparent 2px) !important;
            background-size: 
              12px 12px,
              12px 12px,
              36px 36px,
              36px 36px,
              72px 72px,
              72px 72px !important;
            animation: meshFloat 20s ease-in-out infinite !important;
          }
        `}
      </style>
      
      {/* Alpha Status Indicator */}
      {showAlphaBanner && (
        <div className={`border-b flex-shrink-0 ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between h-12">
              <div className="w-4 h-4"></div>
              <div className="flex items-center justify-center flex-1">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  Testnet demo · No production guarantees · Use at your own risk
                </span>
              </div>
              <button
                onClick={() => setShowAlphaBanner(false)}
                className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors w-4 h-4 flex items-center justify-center flex-shrink-0"
                aria-label="Close banner"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1" style={{ zoom: '0.8' }}>
        
        {/* Header */}
        <header className={`border-b backdrop-blur-sm ${theme === 'light' ? 'border-gray-200 bg-white/80' : 'border-gray-700 bg-gray-900/80'}`} style={{ marginTop: '0px' }}>
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between h-10">
              {/* Left: Logo */}
              <div className="flex items-center">
                <img 
                  src="/canary.png" 
                  alt="Canary" 
                  className="h-12 w-auto"
                  style={{
                    filter: 'drop-shadow(0 1px 4px rgba(0, 0, 0, 0.1))'
                  }}
                />
              </div>
              
              {/* Right: Navigation and Wallet Status */}
              <div className="flex items-center gap-8">
                {/* Main Navigation */}
                <nav className="flex items-center gap-6 h-full">
                  <Link 
                    href="/?view=checkin"
                    className="nav-link"
                  >
                    Check In
                  </Link>
                  <Link 
                    href="/?view=documents"
                    className="nav-link"
                  >
                    Documents
                  </Link>
                  <Link 
                    href="/feed"
                    className="nav-link nav-link-active"
                  >
                    Impact Feed
                  </Link>
                </nav>
                
                {/* Wallet Status and Theme Toggle */}
                <div className="flex items-center gap-6">
                
                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                >
                  {theme === 'light' ? (
                    <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
                
                {/* Authentication Status */}
                {hasWalletConnection() ? (
                  <div className="flex items-center gap-4">
                    {authMode === 'advanced' && address ? (
                      // Advanced mode: Show wallet address
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-gray-800'}`}>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className={`monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                          {`${address.slice(0, 6)}...${address.slice(-4)}`}
                        </span>
                      </div>
                    ) : authMode === 'standard' && authenticated ? (
                      // Standard mode: Show user email or authenticated status
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-gray-800'}`}>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className={`monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                          {user?.email?.address || 'Signed In'}
                        </span>
                      </div>
                    ) : null}
                    
                    <button
                      onClick={() => {
                        // Disconnect based on mode
                        if (authMode === 'advanced' && isConnected) {
                          disconnect();
                        }
                        if (authMode === 'standard' && authenticated) {
                          logout();
                        }
                        // Reset state
                        setAuthModeWithPersistence('standard');
                      }}
                      className="text-sm text-muted hover:text-primary transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <span>Not Signed In</span>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Impact Feed Content */}
        <div className="flex-1 overflow-auto">
          <ImpactFeedView theme={theme} />
        </div>
        
        {/* Footer */}
        <footer className={`border-t mt-auto ${theme === 'light' ? 'border-gray-200 bg-white' : 'border-gray-700 bg-gray-900'}`}>
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                © 2024 Canary · Testnet Release
              </div>
              <div className="flex items-center gap-6">
                <a 
                  href="https://github.com/TheThirdRoom/canary" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  GitHub
                </a>
                <a 
                  href="#" 
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Documentation
                </a>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  v0.1.0-alpha
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}