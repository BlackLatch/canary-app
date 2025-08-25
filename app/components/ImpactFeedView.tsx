'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ContractService, type Dossier } from '@/app/lib/contract';
import ReleaseCard from '@/app/components/ReleaseCard';
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

  useEffect(() => {
    const loadFeed = async () => {
      try {
        setLoading(true);
        const dossiers: FeedDossier[] = [];
        
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
      <div className={`min-h-screen ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'}`}>
        <div className="max-w-7xl mx-auto px-6 py-8">
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
    <div className={`min-h-screen ${theme === 'light' ? 'mesh-background-light' : 'mesh-background-dark'}`}>
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
              <p className="editorial-body text-gray-600 dark:text-gray-400">
                {filter === 'unlocked'
                  ? 'Dossiers will appear here once their inactivity conditions are met'
                  : 'Check back soon for new releases'
                }
              </p>
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
                  onViewRelease={(user, dossierId) => {
                    router.push(`/release?user=${user}&id=${dossierId.toString()}`);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}