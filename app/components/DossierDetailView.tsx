'use client';

import { useState } from 'react';
import { Copy, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Dossier } from '@/app/lib/contract';
import type { Address } from 'viem';

interface DossierDetailViewProps {
  dossier: Dossier;
  owner: Address;
  theme: 'light' | 'dark';
  currentTime: Date;
  isOwner: boolean;
  onBack: () => void;
  onCheckIn?: () => Promise<void>;
  onEditSchedule?: (newInterval: string) => void;
  onAddFiles?: () => void;
  onPauseResume?: () => Promise<void>;
  onDecrypt?: () => Promise<void>;
  isCheckingIn?: boolean;
}

export default function DossierDetailView({
  dossier,
  owner,
  theme,
  currentTime,
  isOwner,
  onBack,
  onCheckIn,
  onEditSchedule,
  onAddFiles,
  onPauseResume,
  onDecrypt,
  isCheckingIn = false,
}: DossierDetailViewProps) {
  const [showEditSchedule, setShowEditSchedule] = useState(false);

  // Calculate status
  const getStatus = () => {
    if (dossier.isPermanentlyDisabled === true) return 'permanently-disabled';
    if (dossier.isReleased === true) return 'released';
    if (!dossier.isActive) return 'paused';

    const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
    const intervalMs = Number(dossier.checkInInterval) * 1000;
    const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
    const remainingMs = intervalMs - timeSinceLastCheckIn;
    const isTimeExpired = remainingMs <= 0;

    return isTimeExpired ? 'expired' : 'active';
  };

  const status = getStatus();

  const getStatusLabel = () => {
    switch (status) {
      case 'permanently-disabled': return 'Permanently Disabled';
      case 'released': return 'Released';
      case 'paused': return 'Paused';
      case 'expired': return 'Expired';
      default: return 'Active';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'permanently-disabled':
      case 'expired':
        return 'status-expired';
      case 'released':
      case 'active':
        return 'status-active';
      default:
        return 'status-inactive';
    }
  };

  const formatInterval = () => {
    const hours = Math.floor(Number(dossier.checkInInterval) / 3600);
    const minutes = Math.floor((Number(dossier.checkInInterval) % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours} hours`;
    return `${minutes} minutes`;
  };

  const canCheckIn = isOwner && dossier.isActive && dossier.isReleased !== true;
  const canEditSchedule = isOwner && dossier.isActive && dossier.isReleased !== true;
  const canAddFiles = isOwner && dossier.isActive && dossier.isReleased !== true;
  const canPauseResume = isOwner && dossier.isPermanentlyDisabled !== true && dossier.isReleased !== true;

  const canDecrypt = (() => {
    const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
    const intervalMs = Number(dossier.checkInInterval) * 1000;
    const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
    const remainingMs = intervalMs - timeSinceLastCheckIn;
    const isTimeExpired = remainingMs <= 0;
    return (isTimeExpired || dossier.isReleased === true) && dossier.encryptedFileHashes.length > 0;
  })();

  return (
    <div className="spacing-section">
      {/* Navigation Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${
            theme === 'light'
              ? 'text-gray-600 hover:text-gray-900'
              : 'text-gray-400 hover:text-gray-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dossiers
        </button>
      </div>

      {/* Dossier Detail Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Information Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dossier Overview */}
          <div className={`border rounded-lg px-6 py-5 ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black/40'}`}>
            <div className={`border-b pb-4 mb-4 ${theme === 'light' ? 'border-gray-300' : 'border-gray-600'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <h1 className="editorial-header-large text-black dark:text-gray-100 mb-2">
                    {dossier.name.replace('Encrypted file: ', '')}
                  </h1>
                  <div className="flex items-center gap-4">
                    <div className={`status-indicator text-xs ${getStatusClass()}`}>
                      <div className="status-dot"></div>
                      <span>{getStatusLabel()}</span>
                    </div>
                    <div className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                      Dossier #{dossier.id.toString()}
                    </div>
                    {/* Release Visibility Badge */}
                    <div
                      className={`inline-flex items-center gap-2 px-5 py-2.5 font-medium text-sm rounded-lg border transition-colors ${
                        dossier.recipients && dossier.recipients.length > 1
                          ? theme === 'light'
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-900 border-white'
                          : theme === 'light'
                            ? 'bg-white text-gray-700 border-gray-300'
                            : 'bg-black/20 text-gray-300 border-gray-600'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {dossier.recipients && dossier.recipients.length > 1 ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        )}
                      </svg>
                      {dossier.recipients && dossier.recipients.length > 1 ? 'Private' : 'Public'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timing Information */}
          <div className={`border rounded-lg px-6 py-5 ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black/40'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="editorial-header text-gray-900 dark:text-gray-100">Timing & Schedule</h3>
              {canEditSchedule && onEditSchedule && (
                <button
                  onClick={() => {
                    const intervalInMinutes = String(Number(dossier.checkInInterval) / 60);
                    onEditSchedule(intervalInMinutes);
                  }}
                  className={`px-3 py-1 text-xs font-medium border rounded transition-all ${
                    theme === 'light'
                      ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      : 'border-gray-600 text-gray-300 hover:bg-white/5'
                  }`}
                >
                  Edit Schedule
                </button>
              )}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className={`editorial-label-small ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    Check-in Interval
                  </div>
                  <div className={`text-lg font-semibold monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                    {formatInterval()}
                  </div>
                </div>
                <div>
                  <div className={`editorial-label-small ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                    LAST CHECK-IN
                  </div>
                  <div className={`text-lg font-semibold monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                    {new Date(Number(dossier.lastCheckIn) * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* File Information */}
          <div className={`border rounded-lg px-6 py-5 ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black/40'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="editorial-header text-gray-900 dark:text-gray-100">Encrypted Files</h3>
              {canAddFiles && onAddFiles && (
                <button
                  onClick={onAddFiles}
                  className={`px-3 py-1 text-xs font-medium border rounded transition-all ${
                    theme === 'light'
                      ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      : 'border-gray-600 text-gray-300 hover:bg-white/5'
                  }`}
                >
                  Add Files
                </button>
              )}
            </div>
            <div className="space-y-3">
              {dossier.encryptedFileHashes.map((hash, index) => {
                const cid = hash.startsWith('ipfs://') ? hash.replace('ipfs://', '') : hash;
                const ipldExplorerUrl = `https://explore.ipld.io/#/explore/${cid}`;

                return (
                  <div
                    key={index}
                    className={`p-3 border rounded ${theme === 'light' ? 'border-gray-200 bg-gray-50' : 'border-gray-600 bg-black/40'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className={`text-sm font-medium mb-1 ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                          {index === 0 ? (
                            <span className="inline-flex items-center gap-1">
                              📋 Manifest
                              <span className={`text-xs font-normal ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                                (Dossier Metadata)
                              </span>
                            </span>
                          ) : (
                            `File #${index}`
                          )}
                        </div>
                        <a
                          href={ipldExplorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-xs monospace-accent break-all inline-flex items-center gap-1 hover:underline ${
                            theme === 'light'
                              ? 'text-blue-600 hover:text-blue-700'
                              : 'text-blue-400 hover:text-blue-300'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {hash}
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(hash);
                          toast.success('Hash copied to clipboard');
                        }}
                        className={`ml-2 p-1 rounded text-xs ${
                          theme === 'light'
                            ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
                        }`}
                        title="Copy to clipboard"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <div className={`border rounded-lg px-6 py-5 ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black/40'}`}>
            <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-4">Actions</h3>
            <div className="space-y-3">
              {/* Released Message */}
              {dossier.isReleased === true && (
                <div
                  className={`p-3 border rounded-lg text-center ${
                    theme === 'light'
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-green-900/30 border-green-600 text-green-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">DOCUMENT RELEASED</span>
                  </div>
                  <p className="text-sm mt-1 opacity-90">
                    This document has been permanently released and cannot be modified
                  </p>
                </div>
              )}

              {/* Check In Button */}
              {canCheckIn && onCheckIn && (
                <button
                  onClick={onCheckIn}
                  disabled={isCheckingIn}
                  className={`w-full py-2 px-3 text-sm font-medium border rounded-lg transition-all ${
                    theme === 'light'
                      ? 'bg-gray-900 text-white hover:bg-gray-800 border-gray-900'
                      : 'bg-white text-gray-900 hover:bg-gray-100 border-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isCheckingIn ? 'CHECKING IN...' : 'CHECK IN'}
                </button>
              )}

              {/* Decrypt Button */}
              {canDecrypt && onDecrypt && (
                <button
                  onClick={onDecrypt}
                  className={`w-full py-2 px-3 text-sm font-medium border rounded-lg transition-all ${
                    theme === 'light'
                      ? 'bg-white text-gray-900 hover:bg-gray-50 border-gray-300'
                      : 'bg-transparent text-gray-100 hover:bg-white/10 border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>DOWNLOAD</span>
                  </div>
                </button>
              )}

              {/* Pause/Resume Button */}
              {canPauseResume && onPauseResume && (
                <button
                  onClick={onPauseResume}
                  className={`w-full py-2 px-3 text-sm font-medium border rounded-lg transition-all ${
                    theme === 'light'
                      ? 'bg-white text-gray-900 hover:bg-gray-50 border-gray-300'
                      : 'bg-transparent text-gray-100 hover:bg-white/10 border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {dossier.isActive ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                    <span>{dossier.isActive ? 'PAUSE' : 'RESUME'}</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
