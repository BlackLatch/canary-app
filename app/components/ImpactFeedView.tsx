'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ContractService, type Dossier } from '@/app/lib/contract';
import type { Address } from 'viem';

interface FeedDossier {
  user: Address;
  dossierId: bigint;
  dossier: Dossier;
  isUnlocked: boolean;
  timeUntilUnlock?: number;
}

interface ImpactFeedViewProps {
  theme: 'light' | 'dark';
}

export default function ImpactFeedView({ theme }: ImpactFeedViewProps) {
  const [feedDossiers, setFeedDossiers] = useState<FeedDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const { address } = useAccount();
  const router = useRouter();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadFeed = async () => {
      try {
        // Only show loading on very first load
        if (!hasLoadedRef.current && isMounted) {
          setLoading(true);
        }
        
        const dossiers: FeedDossier[] = [];
        
        // Wait a minimum time to avoid flash of empty state
        const startTime = Date.now();
        
        // In production, this would query DossierCreated events from all users
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
        
        // Ensure minimum loading time to avoid flash
        const elapsed = Date.now() - startTime;
        if (elapsed < 500 && !hasLoadedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
        }
        
        // Sort by creation time (newest first)
        dossiers.sort((a, b) => Number(b.dossier.lastCheckIn) - Number(a.dossier.lastCheckIn));
        
        if (isMounted) {
          setFeedDossiers(dossiers);
          if (!hasLoadedRef.current) {
            setLoading(false);
            hasLoadedRef.current = true;
          }
        }
      } catch (error) {
        console.error('Failed to load feed:', error);
        if (isMounted && !hasLoadedRef.current) {
          // Ensure minimum time even on error
          await new Promise(resolve => setTimeout(resolve, 300));
          setLoading(false);
          hasLoadedRef.current = true;
        }
      }
    };

    loadFeed();
    
    // Refresh every 30 seconds to update countdowns (without showing loading)
    const interval = setInterval(loadFeed, 30000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [address]);

  const filteredDossiers = feedDossiers.filter(item => {
    if (filter === 'unlocked') return item.isUnlocked;
    if (filter === 'locked') return !item.isUnlocked;
    return true;
  });

  if (loading) {
    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-white' : 'bg-gray-900'}`}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header Skeleton */}
          <div className="mb-12 border-b border-gray-200 dark:border-gray-700 pb-8">
            <div className="animate-pulse">
              <div className="h-10 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-48 mb-3"></div>
              <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-96"></div>
            </div>
          </div>

          {/* Filter Skeleton */}
          <nav className="flex items-center gap-8 mb-12 border-b border-gray-200 dark:border-gray-700">
            <div className="animate-pulse flex gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-24 mb-4"></div>
              ))}
            </div>
          </nav>

          {/* List Items Skeleton with Loading Animation */}
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 relative overflow-hidden">
                {/* Shimmer effect */}
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent"></div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-3/4 mb-2 animate-pulse"></div>
                      <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-1/2 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-16 animate-pulse"></div>
                    <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-white' : 'bg-gray-900'}`}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="spacing-section">
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

          {/* Feed List - Clean Minimal Design */}
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
              <p className="editorial-body text-gray-600 dark:text-gray-400">
                {filter === 'unlocked'
                  ? 'Dossiers will appear here once their inactivity conditions are met'
                  : 'Check back soon for new releases'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredDossiers.map((item, index) => {
                const formatDate = (timestamp: bigint) => {
                  const date = new Date(Number(timestamp) * 1000);
                  return date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  });
                };

                const formatCountdown = (seconds: number) => {
                  const days = Math.floor(seconds / 86400);
                  const hours = Math.floor((seconds % 86400) / 3600);
                  const mins = Math.floor((seconds % 3600) / 60);
                  
                  if (days > 0) return `${days}d ${hours}h`;
                  if (hours > 0) return `${hours}h ${mins}m`;
                  return `${mins}m`;
                };

                return (
                  <div
                    key={`${item.user}-${item.dossierId.toString()}`}
                    onClick={() => router.push(`/release?user=${item.user}&id=${item.dossierId.toString()}`)}
                    className={`
                      flex items-center justify-between px-6 py-5 cursor-pointer transition-all
                      border border-gray-200 dark:border-gray-700 rounded-lg
                      bg-white dark:bg-gray-800
                      hover:bg-gray-50 dark:hover:bg-gray-750
                      ${index !== 0 ? 'mt-4' : ''}
                    `}
                  >
                    {/* Left: Status indicator and title */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Status Dot */}
                      <div className={`
                        w-2 h-2 rounded-full flex-shrink-0
                        ${item.isUnlocked 
                          ? 'bg-green-500 dark:bg-green-400' 
                          : 'bg-yellow-500 dark:bg-yellow-400 animate-pulse'
                        }
                      `} />
                      
                      {/* Title and metadata */}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                          {item.dossier.name.replace('Encrypted file: ', '') || 'Untitled Dossier'}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span>{formatDate(item.dossier.lastCheckIn)}</span>
                          <span>•</span>
                          <span>{item.dossier.encryptedFileHashes.length} file{item.dossier.encryptedFileHashes.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status */}
                    <div className="flex items-center gap-6 ml-6">
                      {/* Status or countdown */}
                      {item.isUnlocked ? (
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">
                          PUBLIC
                        </span>
                      ) : item.timeUntilUnlock ? (
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 monospace-accent">
                            {formatCountdown(item.timeUntilUnlock)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            until release
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                          PENDING
                        </span>
                      )}

                      {/* Arrow indicator */}
                      <svg 
                        className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}