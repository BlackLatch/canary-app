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
    // Clean theme setup - no mesh backgrounds
  }, [theme]);

  return (
    <div className="min-h-screen flex flex-col">
      
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
        <footer className={`border-t backdrop-blur-sm flex-shrink-0 ${theme === 'light' ? 'border-gray-200 bg-white/80' : 'border-gray-700 bg-gray-900/80'}`}>
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-center gap-6">
              <a
                href="https://canary.tools"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 text-xs transition-colors ${theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Website</span>
              </a>
              
              <a
                href="https://docs.canaryapp.io"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 text-xs transition-colors ${theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Docs</span>
              </a>
              
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  const supportAddress = '0x60646c03b1576E75539b64352C18F1230F99EEa3';
                  navigator.clipboard.writeText(supportAddress).then(() => {
                    // Would need to import toast for this
                    alert('💝 Support address copied to clipboard!\n\nETH/Polygon: ' + supportAddress);
                  }).catch(() => {
                    alert('Failed to copy address');
                  });
                }}
                className={`flex items-center gap-1.5 text-xs transition-colors ${theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
                title="Click to copy donation address"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>Support</span>
              </a>
              
              <a
                href="https://github.com/TheThirdRoom/canary"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 text-xs transition-colors ${theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>Source</span>
              </a>
              
              <a
                href="mailto:contact@canary.tools"
                className={`flex items-center gap-1.5 text-xs transition-colors ${theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Contact</span>
              </a>
            </div>
            
            <div className={`text-center mt-2 pt-2 border-t ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`}>
              <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                © 2025 Canary. Truth protection through cryptographic deadman switches.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}