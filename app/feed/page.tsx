'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ContractService, type Dossier } from '@/app/lib/contract';
import ReleaseCard from '@/app/components/ReleaseCard';
import type { Address } from 'viem';
import { useTheme } from '@/app/lib/theme-context';
import Link from 'next/link';

interface FeedDossier {
  user: Address;
  dossierId: bigint;
  dossier: Dossier;
  isUnlocked: boolean;
  timeUntilUnlock?: number;
}

export default function ImpactFeed() {
  const [feedDossiers, setFeedDossiers] = useState<FeedDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const { address } = useAccount();
  const { theme } = useTheme();

  useEffect(() => {
    // Apply the guide background class
    document.body.classList.remove('guide-dark', 'guide-light');
    document.body.classList.add('guide-light');
    
    return () => {
      document.body.classList.remove('guide-dark', 'guide-light');
    };
  }, []);

  useEffect(() => {
    const loadFeed = async () => {
      try {
        setLoading(true);
        const dossiers: FeedDossier[] = [];
        
        // In production, this would query DossierCreated events
        // For now, we'll check the current user's dossiers
        if (address) {
          const dossierIds = await ContractService.getUserDossierIds(address);
          
          for (const dossierId of dossierIds) {
            const dossier = await ContractService.getDossier(address, dossierId);
            const shouldStayEncrypted = await ContractService.shouldDossierStayEncrypted(address, dossierId);
            
            const now = Math.floor(Date.now() / 1000);
            const timeSinceLastCheckIn = now - Number(dossier.lastCheckIn);
            const checkInDeadline = Number(dossier.checkInInterval) + 86400; // + grace period
            const timeUntilUnlock = checkInDeadline - timeSinceLastCheckIn;
            
            dossiers.push({
              user: address,
              dossierId,
              dossier,
              isUnlocked: !shouldStayEncrypted && dossier.isActive,
              timeUntilUnlock: shouldStayEncrypted ? Math.max(0, timeUntilUnlock) : undefined
            });
          }
        }
        
        // Sort by creation time (newest first)
        dossiers.sort((a, b) => Number(b.dossier.lastCheckIn) - Number(a.dossier.lastCheckIn));
        
        setFeedDossiers(dossiers);
      } catch (error) {
        console.error('Failed to load feed:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFeed();
    
    // Refresh every 30 seconds to update countdowns
    const interval = setInterval(loadFeed, 30000);
    return () => clearInterval(interval);
  }, [address]);

  const filteredDossiers = feedDossiers.filter(item => {
    if (filter === 'unlocked') return item.isUnlocked;
    if (filter === 'locked') return !item.isUnlocked;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen">
        {/* Navigation Header */}
        <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
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
            </div>
          </div>
        </header>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-12"></div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="editorial-card-bordered h-64"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navigation Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Breadcrumb Navigation */}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Page Header */}
        <div className="mb-12 border-b border-gray-200 dark:border-gray-700 pb-8">
          <h1 className="editorial-header-large text-gray-900 dark:text-gray-100 mb-3">
            IMPACT FEED
          </h1>
          <p className="editorial-body text-gray-600 dark:text-gray-400">
            Browse dossiers that have become public due to inactivity conditions being met
          </p>
        </div>

        {/* Filter Navigation */}
        <nav className="flex items-center gap-8 mb-12 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setFilter('all')}
            className={`pb-4 px-1 border-b-2 transition-colors ${
              filter === 'all'
                ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="editorial-label">ALL RELEASES</span>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              ({feedDossiers.length})
            </span>
          </button>
          <button
            onClick={() => setFilter('unlocked')}
            className={`pb-4 px-1 border-b-2 transition-colors ${
              filter === 'unlocked'
                ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="editorial-label">PUBLIC</span>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              ({feedDossiers.filter(d => d.isUnlocked).length})
            </span>
          </button>
          <button
            onClick={() => setFilter('locked')}
            className={`pb-4 px-1 border-b-2 transition-colors ${
              filter === 'locked'
                ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="editorial-label">PENDING</span>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              ({feedDossiers.filter(d => !d.isUnlocked).length})
            </span>
          </button>
        </nav>

        {/* Feed Grid */}
        {filteredDossiers.length === 0 ? (
          <div className="text-center py-24 editorial-card-bordered">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-3">
              {filter === 'unlocked' 
                ? 'No Public Releases Yet'
                : filter === 'locked'
                ? 'No Pending Releases'
                : 'No Releases Found'
              }
            </h3>
            <p className="editorial-body text-gray-600 dark:text-gray-400 mb-6">
              {filter === 'unlocked'
                ? 'Dossiers will appear here once their inactivity conditions are met'
                : 'Check back soon for new releases'
              }
            </p>
            <Link 
              href="/"
              className="editorial-button editorial-button-primary inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Back to Dashboard</span>
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredDossiers.map((item) => (
              <ReleaseCard
                key={`${item.user}-${item.dossierId.toString()}`}
                user={item.user}
                dossierId={item.dossierId}
                dossier={item.dossier}
                isUnlocked={item.isUnlocked}
                timeUntilUnlock={item.timeUntilUnlock}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}