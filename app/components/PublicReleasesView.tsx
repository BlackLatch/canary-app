'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ContractService, type Dossier } from '@/app/lib/contract';
import type { Address } from 'viem';

interface FeedDossier {
  user: Address;
  dossierId: bigint;
  dossier: Dossier;
  isUnlocked: boolean;
  timeUntilUnlock?: number;
}

interface CachedDossier {
  user: string;
  dossierId: string;
  dossier: {
    id: string;
    name: string;
    description: string;
    lastCheckIn: string;
    checkInInterval: string;
    encryptedFileHashes: string[];
    isActive: boolean;
    isPermanentlyDisabled: boolean;
    publicRecipients: string[];
    guardians: string[];
  };
  isUnlocked: boolean;
  cachedAt: number;
}

interface CacheData {
  dossiers: CachedDossier[];
  timestamp: number;
}

interface PublicReleasesViewProps {
  theme: 'light' | 'dark';
}

const CACHE_KEY = 'canary-public-releases-cache';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache validity

// Convert FeedDossier to cacheable format
const serializeDossier = (dossier: FeedDossier): CachedDossier => ({
  user: dossier.user,
  dossierId: dossier.dossierId.toString(),
  dossier: {
    id: dossier.dossier.id.toString(),
    name: dossier.dossier.name,
    description: dossier.dossier.description,
    lastCheckIn: dossier.dossier.lastCheckIn.toString(),
    checkInInterval: dossier.dossier.checkInInterval.toString(),
    encryptedFileHashes: dossier.dossier.encryptedFileHashes,
    isActive: dossier.dossier.isActive,
    isPermanentlyDisabled: dossier.dossier.isPermanentlyDisabled,
    publicRecipients: dossier.dossier.publicRecipients,
    guardians: dossier.dossier.guardians,
  },
  isUnlocked: dossier.isUnlocked,
  cachedAt: Date.now(),
});

// Convert cached format back to FeedDossier
const deserializeDossier = (cached: CachedDossier): FeedDossier => ({
  user: cached.user as Address,
  dossierId: BigInt(cached.dossierId),
  dossier: {
    id: BigInt(cached.dossier.id),
    name: cached.dossier.name,
    description: cached.dossier.description,
    lastCheckIn: BigInt(cached.dossier.lastCheckIn),
    checkInInterval: BigInt(cached.dossier.checkInInterval),
    encryptedFileHashes: cached.dossier.encryptedFileHashes,
    isActive: cached.dossier.isActive,
    isPermanentlyDisabled: cached.dossier.isPermanentlyDisabled,
    publicRecipients: cached.dossier.publicRecipients,
    guardians: cached.dossier.guardians,
  },
  isUnlocked: cached.isUnlocked,
});

// Load cached dossiers from localStorage
const loadCache = (): FeedDossier[] => {
  if (typeof window === 'undefined') return [];

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return [];

    const cacheData: CacheData = JSON.parse(cached);

    // Check if cache is still valid
    const cacheAge = Date.now() - cacheData.timestamp;
    if (cacheAge > CACHE_DURATION) {
      console.log('📦 Cache expired, clearing...');
      localStorage.removeItem(CACHE_KEY);
      return [];
    }

    console.log(`📦 Loaded ${cacheData.dossiers.length} dossiers from cache (${Math.round(cacheAge / 1000)}s old)`);
    return cacheData.dossiers.map(deserializeDossier);
  } catch (error) {
    console.error('Failed to load cache:', error);
    localStorage.removeItem(CACHE_KEY);
    return [];
  }
};

// Save dossiers to localStorage cache
const saveCache = (dossiers: FeedDossier[]) => {
  if (typeof window === 'undefined') return;

  try {
    const cacheData: CacheData = {
      dossiers: dossiers.map(serializeDossier),
      timestamp: Date.now(),
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log(`📦 Cached ${dossiers.length} dossiers`);
  } catch (error) {
    console.error('Failed to save cache:', error);
    // If quota exceeded, clear old cache and try again with fresh data
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
  }
};

// Merge cached and fresh dossiers, removing duplicates
const mergeDossiers = (cached: FeedDossier[], fresh: FeedDossier[]): FeedDossier[] => {
  const map = new Map<string, FeedDossier>();

  // Add cached dossiers first
  cached.forEach(d => {
    const key = `${d.user}-${d.dossierId.toString()}`;
    map.set(key, d);
  });

  // Add/update with fresh dossiers (they take precedence)
  fresh.forEach(d => {
    const key = `${d.user}-${d.dossierId.toString()}`;
    map.set(key, d);
  });

  return Array.from(map.values());
};

export default function PublicReleasesView({ theme }: PublicReleasesViewProps) {
  const [feedDossiers, setFeedDossiers] = useState<FeedDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const hasLoadedRef = useRef(false);
  const currentDossiersRef = useRef<FeedDossier[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadFeed = async () => {
      try {
        // On first load, try to load from cache
        if (!hasLoadedRef.current) {
          const cachedDossiers = loadCache();

          if (cachedDossiers.length > 0) {
            // Show cached data immediately - no loading state
            console.log('📦 Displaying cached dossiers immediately');
            const sorted = [...cachedDossiers].sort(
              (a, b) => Number(b.dossier.lastCheckIn) - Number(a.dossier.lastCheckIn)
            );
            currentDossiersRef.current = sorted;
            setFeedDossiers(sorted);
            setLoading(false);
            hasLoadedRef.current = true;
          } else {
            // No cache, show loading state
            setLoading(true);
          }
        }

        // Fetch fresh data from blockchain (in background if cache was shown)
        console.log('🔗 Fetching fresh dossiers from blockchain...');
        const publicReleases = await ContractService.getAllPublicReleases();

        const freshDossiers: FeedDossier[] = publicReleases.map(release => ({
          user: release.user,
          dossierId: release.dossierId,
          dossier: release.dossier,
          isUnlocked: true,
          timeUntilUnlock: undefined
        }));

        if (!isMounted) return;

        // Merge with existing data (fresh data takes precedence)
        const merged = mergeDossiers(currentDossiersRef.current, freshDossiers);

        // Sort by creation time (newest first)
        merged.sort((a, b) => Number(b.dossier.lastCheckIn) - Number(a.dossier.lastCheckIn));

        // Update state and ref
        currentDossiersRef.current = merged;
        setFeedDossiers(merged);
        setLoading(false);
        hasLoadedRef.current = true;

        // Save to cache for next time
        saveCache(merged);

        console.log(`✅ Feed updated: ${merged.length} total dossiers (${freshDossiers.length} from blockchain)`);
      } catch (error) {
        console.error('Failed to load feed:', error);
        if (isMounted && !hasLoadedRef.current) {
          setLoading(false);
          hasLoadedRef.current = true;
        }
      }
    };

    loadFeed();

    // Refresh every 30 seconds to check for new dossiers
    const interval = setInterval(loadFeed, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);


  if (loading) {
    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header Skeleton */}
          <div className="mb-12 border-b border-gray-300 dark:border-gray-700 pb-8">
            <div className="animate-pulse">
              <div className="h-10 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-48 mb-3"></div>
              <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-96"></div>
            </div>
          </div>

          {/* Filter Skeleton */}
          <nav className="flex items-center gap-8 mb-12 border-b border-gray-300 dark:border-gray-700">
            <div className="animate-pulse flex gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-24 mb-4"></div>
              ))}
            </div>
          </nav>

          {/* Gallery Grid Skeleton with Loading Animation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className={`border rounded-lg p-5 relative overflow-hidden ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'}`}>
                {/* Shimmer effect */}
                <div className={`absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent to-transparent ${theme === 'light' ? 'via-white/20' : 'via-white/5'}`}></div>

                {/* Badge and dot */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`h-6 bg-gradient-to-r rounded-full w-16 animate-pulse ${theme === 'light' ? 'from-gray-200 to-gray-300' : 'from-gray-800 to-gray-700'}`}></div>
                  <div className={`w-2 h-2 rounded-full animate-pulse ${theme === 'light' ? 'bg-gray-300' : 'bg-gray-600'}`}></div>
                </div>

                {/* Title */}
                <div className={`h-5 bg-gradient-to-r rounded w-full mb-2 animate-pulse ${theme === 'light' ? 'from-gray-200 to-gray-300' : 'from-gray-800 to-gray-700'}`}></div>
                <div className={`h-5 bg-gradient-to-r rounded w-2/3 mb-3 animate-pulse ${theme === 'light' ? 'from-gray-200 to-gray-300' : 'from-gray-800 to-gray-700'}`}></div>

                {/* Owner address */}
                <div className={`h-4 bg-gradient-to-r rounded w-24 mb-3 animate-pulse ${theme === 'light' ? 'from-gray-200 to-gray-300' : 'from-gray-800 to-gray-700'}`}></div>

                {/* Metadata */}
                <div className={`border-t pt-3 ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`}>
                  <div className={`h-3 bg-gradient-to-r rounded w-full animate-pulse ${theme === 'light' ? 'from-gray-200 to-gray-300' : 'from-gray-800 to-gray-700'}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="spacing-section">
          <div className="mb-12 border-b border-gray-300 dark:border-gray-700 pb-8">
            <h1 className="editorial-header-large text-black dark:text-gray-100 mb-3">
              PUBLIC RELEASES
            </h1>
            <p className="editorial-body text-gray-600 dark:text-gray-400">
              Browse dossiers that have become public due to inactivity conditions being met
            </p>
          </div>

          {/* Public Releases Count */}
          <div className="mb-12 pb-4 border-b border-gray-300 dark:border-gray-700">
            <span className="editorial-label text-gray-500 dark:text-gray-400">
              {feedDossiers.length} PUBLIC RELEASE{feedDossiers.length !== 1 ? 'S' : ''}
            </span>
          </div>

          {/* Feed List - Clean Minimal Design */}
          {feedDossiers.length === 0 ? (
            <div className={`text-center py-24 border rounded-lg ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black/40'}`}>
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 border-2 ${theme === 'light' ? 'border-gray-200' : 'border-gray-600 bg-black/30'}`}>
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className={`editorial-header mb-3 ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                No Public Releases Yet
              </h3>
              <p className={`editorial-body ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Dossiers will appear here once their inactivity conditions are met
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {feedDossiers.map((item) => {
                const formatDate = (timestamp: bigint) => {
                  const date = new Date(Number(timestamp) * 1000);
                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                };

                return (
                  <div
                    key={`${item.user}-${item.dossierId.toString()}`}
                    onClick={() => router.push(`/release?user=${item.user}&id=${item.dossierId.toString()}`)}
                    className={`
                      cursor-pointer transition-all rounded-lg border p-5
                      ${theme === 'light'
                        ? 'border-gray-300 bg-white hover:border-[#e53e3e] hover:shadow-lg'
                        : 'border-gray-700 bg-black hover:border-[#e53e3e] hover:bg-white/5'}
                    `}
                  >
                    {/* PUBLIC Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${theme === 'light' ? 'bg-green-100 text-green-700' : 'bg-green-900/30 text-green-400'}`}>
                        PUBLIC
                      </div>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${theme === 'light' ? 'bg-green-500' : 'bg-green-400'}`} />
                    </div>

                    {/* Title */}
                    <h3 className={`text-base font-semibold mb-3 line-clamp-2 ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                      {item.dossier.name.replace('Encrypted file: ', '') || 'Untitled Dossier'}
                    </h3>

                    {/* Description - Only show if present */}
                    {item.dossier.description && (
                      <p className={`text-sm mb-3 line-clamp-2 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {item.dossier.description}
                      </p>
                    )}

                    {/* Owner Address */}
                    <p className={`text-xs font-mono mb-3 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                      {item.user.slice(0, 6)}...{item.user.slice(-4)}
                    </p>

                    {/* Metadata */}
                    <div className={`flex items-center gap-3 text-xs pt-3 border-t ${theme === 'light' ? 'text-gray-500 border-gray-200' : 'text-gray-400 border-gray-700'}`}>
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{formatDate(item.dossier.lastCheckIn)}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>{item.dossier.encryptedFileHashes.length}</span>
                      </div>
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