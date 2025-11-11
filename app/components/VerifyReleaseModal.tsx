'use client';

import { useState } from 'react';
import type { Address } from 'viem';
import type { Dossier } from '@/app/lib/contract';
import { useTheme } from '@/app/lib/theme-context';

interface VerifyReleaseModalProps {
  user: Address;
  dossierId: bigint;
  dossier: Dossier;
  isUnlocked: boolean;
  onClose: () => void;
}

export default function VerifyReleaseModal({
  user,
  dossierId,
  dossier,
  isUnlocked,
  onClose
}: VerifyReleaseModalProps) {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();

  const verificationData = {
    userAddress: user,
    dossierId: dossierId.toString(),
    dossierName: dossier.name,
    isActive: dossier.isActive,
    lastCheckIn: Number(dossier.lastCheckIn),
    lastCheckInDate: new Date(Number(dossier.lastCheckIn) * 1000).toISOString(),
    checkInInterval: Number(dossier.checkInInterval),
    checkInIntervalDays: Number(dossier.checkInInterval) / 86400,
    gracePeriod: 86400, // 1 day grace period
    currentDecryptability: isUnlocked ? 'PUBLIC' : 'ENCRYPTED',
    encryptedFileCIDs: dossier.encryptedFileHashes,
    recipients: dossier.recipients,
    contractAddress: '0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0',
    network: 'Polygon Amoy (Chain ID: 80002)',
    timestamp: new Date().toISOString()
  };

  const copyProof = () => {
    const proofText = JSON.stringify(verificationData, null, 2);
    navigator.clipboard.writeText(proofText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-5 flex items-center justify-between">
          <h2 className="editorial-header text-black dark:text-gray-100">
            VERIFY RELEASE
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <p className="editorial-body text-gray-600 dark:text-gray-400 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            Technical verification details for crypto-aware users. This data can be used to independently verify the authenticity and state of this dossier on the blockchain.
          </p>

          {/* Verification Details */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="editorial-label text-gray-900 dark:text-gray-100 mb-4">
                BASIC INFORMATION
              </h3>
              <dl className="space-y-3 pl-4">
                <div className="flex justify-between items-start">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">User Address</dt>
                  <dd className="monospace-accent text-xs text-gray-900 dark:text-gray-100 text-right break-all max-w-[60%]">{user}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">Dossier ID</dt>
                  <dd className="monospace-accent text-sm text-gray-900 dark:text-gray-100">{dossierId.toString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">Name</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100 font-medium">{dossier.name || 'Untitled'}</dd>
                </div>
              </dl>
            </div>

            {/* Status Info */}
            <div>
              <h3 className="editorial-label text-gray-900 dark:text-gray-100 mb-4">
                STATUS INFORMATION
              </h3>
              <dl className="space-y-3 pl-4">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">Active</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">
                    {dossier.isActive ? 'Yes' : 'No'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">Decryptability</dt>
                  <dd className="text-sm font-semibold">
                    <span className={isUnlocked ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                      {isUnlocked ? 'PUBLIC' : 'ENCRYPTED'}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">Last Check-in:</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {formatTimestamp(Number(dossier.lastCheckIn))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">Check-in Interval:</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {Number(dossier.checkInInterval) / 86400} days
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">Grace Period:</dt>
                  <dd className="text-sm text-gray-900 dark:text-white">1 day</dd>
                </div>
              </dl>
            </div>

            {/* File Info */}
            <div>
              <h3 className="editorial-label text-gray-900 dark:text-gray-100 mb-4">
                ENCRYPTED FILES ({dossier.encryptedFileHashes.length})
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-4 max-h-32 overflow-y-auto">
                {dossier.encryptedFileHashes.map((hash, index) => (
                  <div key={index} className="monospace-accent text-xs text-gray-600 dark:text-gray-400 break-all mb-1">
                    {hash}
                  </div>
                ))}
              </div>
            </div>

            {/* Contract Info */}
            <div>
              <h3 className="editorial-label text-gray-900 dark:text-gray-100 mb-4">
                CONTRACT INFORMATION
              </h3>
              <dl className="space-y-3 pl-4">
                <div className="flex justify-between items-start">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">Contract</dt>
                  <dd className="monospace-accent text-xs text-gray-900 dark:text-gray-100 text-right break-all max-w-[60%]">
                    0x671f15e4bAF8aB59FA4439b5866E1Ed048ca79e0
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">Network</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">
                    Polygon Amoy (80002)
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-5 flex gap-3">
          <button
            onClick={copyProof}
            className="flex-1 editorial-button editorial-button-primary flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">Copy Proof</span>
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="editorial-button"
          >
            <span className="font-medium">Close</span>
          </button>
        </div>
      </div>
    </div>
  );
}