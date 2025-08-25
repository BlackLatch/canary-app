'use client';

import ImpactFeedView from '@/app/components/ImpactFeedView';
import { useTheme } from '@/app/lib/theme-context';
import Link from 'next/link';
import { Sun, Moon } from 'lucide-react';

export default function ImpactFeedPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'mesh-background-light' : 'mesh-background-dark'}`}>
      {/* Navigation Header - matching main app style */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Navigation */}
            <nav className="flex items-center gap-2">
              <Link 
                href="/" 
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <span className="text-gray-300 dark:text-gray-600 mx-2">/</span>
              <span className="editorial-label text-gray-900 dark:text-gray-100">IMPACT FEED</span>
            </nav>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <Link 
                href="/"
                className="editorial-button"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - ImpactFeedView component */}
      <ImpactFeedView theme={theme} />
    </div>
  );
}