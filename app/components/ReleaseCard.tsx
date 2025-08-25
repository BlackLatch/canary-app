'use client';

import { useState, useEffect } from 'react';
import type { Address } from 'viem';
import type { Dossier } from '@/app/lib/contract';
import { useTheme } from '@/app/lib/theme-context';

interface ReleaseCardProps {
  user: Address;
  dossierId: bigint;
  dossier: Dossier;
  isUnlocked: boolean;
  timeUntilUnlock?: number;
  onViewRelease?: (user: Address, dossierId: bigint) => void;
}

export default function ReleaseCard({ 
  user, 
  dossierId, 
  dossier, 
  isUnlocked, 
  timeUntilUnlock,
  onViewRelease
}: ReleaseCardProps) {
  const [countdown, setCountdown] = useState(timeUntilUnlock || 0);
  const { theme } = useTheme();

  useEffect(() => {
    if (!isUnlocked && timeUntilUnlock) {
      const timer = setInterval(() => {
        setCountdown(prev => Math.max(0, prev - 1));
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [isUnlocked, timeUntilUnlock]);

  const formatCountdown = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const shareRelease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent card click when sharing
    const url = `${window.location.origin}/release?user=${user}&id=${dossierId.toString()}`;
    const text = `${dossier.name || 'Untitled Dossier'} has been unlocked`;
    
    if (navigator.share) {
      navigator.share({ title: dossier.name, text, url });
    } else {
      navigator.clipboard.writeText(url);
      // Show toast notification instead of alert
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded shadow-lg z-50';
      toast.textContent = 'Link copied to clipboard';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
  };

  const handleCardClick = () => {
    if (onViewRelease) {
      onViewRelease(user, dossierId);
    } else {
      window.location.href = `/release?user=${user}&id=${dossierId.toString()}`;
    }
  };

  return (
    <article 
      className="editorial-card-bordered p-6 flex flex-col h-full cursor-pointer transition-all hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600"
      onClick={handleCardClick}>
      {/* Status Badge Row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          {isUnlocked ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
              <svg className="w-3.5 h-3.5 text-green-700 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium uppercase tracking-wider text-green-700 dark:text-green-400">
                Public
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800">
              <svg className="w-3.5 h-3.5 text-yellow-700 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
                Pending
              </span>
            </span>
          )}
        </div>
        
        {!isUnlocked && countdown > 0 && (
          <span className="monospace-accent text-xs text-gray-500 dark:text-gray-400">
            {formatCountdown(countdown)}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-3 line-clamp-2">
        {dossier.name || 'Untitled Dossier'}
      </h3>

      {/* Metadata */}
      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Created {formatDate(dossier.lastCheckIn)}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>{dossier.encryptedFileHashes.length} file{dossier.encryptedFileHashes.length !== 1 ? 's' : ''}</span>
        </div>
        
        {!isUnlocked && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Check-in required every {Math.floor(Number(dossier.checkInInterval) / 86400)} days</span>
          </div>
        )}
      </div>

      {/* Publisher */}
      <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Publisher: <span className="monospace-accent">Anonymous</span>
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click
            if (onViewRelease) {
              onViewRelease(user, dossierId);
            } else {
              window.location.href = `/release?user=${user}&id=${dossierId.toString()}`;
            }
          }}
          className={`flex-1 text-center editorial-button editorial-button-primary`}
        >
          <span className="text-sm font-medium">View Details</span>
        </button>
        
        <button
          onClick={shareRelease}
          className="editorial-button px-3"
          aria-label="Share"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a3 3 0 10-4.028-4.435 3 3 0 004.028 4.435zm0 0l-5.716-3.342" />
          </svg>
        </button>
      </div>
    </article>
  );
}