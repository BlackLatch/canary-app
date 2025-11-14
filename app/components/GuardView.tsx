'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Shield, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useTheme } from '../lib/theme-context';
import toast from 'react-hot-toast';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { useBurnerWallet } from '../lib/burner-wallet-context';
import { ContractService, type Dossier, type DossierReference } from '../lib/contract';
import { ensureCorrectNetwork } from '../lib/network-switch';

interface GuardViewProps {
  onBack: () => void;
  onViewDossier: (owner: Address, dossierId: bigint) => void;
  onShowConfirmModal: (owner: Address, dossierId: bigint, dossierName: string) => void;
}

interface GuardianDossier extends Dossier {
  owner: Address;
  isDecryptable?: boolean;
  isThresholdMet?: boolean;
}

export default function GuardView({ onBack, onViewDossier, onShowConfirmModal }: GuardViewProps) {
  const { theme } = useTheme();
  const [guardianDossiers, setGuardianDossiers] = useState<GuardianDossier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasConfirmed, setHasConfirmed] = useState<Map<string, boolean>>(new Map());

  // Wallet hooks
  const { address } = useAccount();
  const burnerWallet = useBurnerWallet();

  // Helper to get current address (prioritize burner wallet)
  const getCurrentAddress = () => {
    return burnerWallet.address || address || null;
  };

  // Load guardian dossiers
  useEffect(() => {
    const loadGuardianDossiers = async () => {
      const currentAddress = getCurrentAddress();
      if (!currentAddress) {
        console.log('No wallet connected, cannot load guardian dossiers');
        setGuardianDossiers([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      // For web3 external wallets (not burner), ensure correct network before loading
      if (!burnerWallet.isConnected && address) {
        console.log('🔗 Checking network for web3 wallet...');
        const networkOk = await ensureCorrectNetwork();
        if (!networkOk) {
          console.log('❌ Network switch failed or cancelled');
          toast.error('Please switch to Status Network Sepolia to view guardian dossiers');
          setGuardianDossiers([]);
          setIsLoading(false);
          return;
        }
        console.log('✅ Network check passed');
      }

      try {
        console.log('📋 Loading dossiers where user is guardian...');

        // Get all dossier references where user is a guardian
        const references: DossierReference[] = await ContractService.getDossiersWhereGuardian(currentAddress);
        console.log(`Found ${references.length} dossier(s) where ${currentAddress} is guardian`);

        if (references.length === 0) {
          setGuardianDossiers([]);
          setIsLoading(false);
          return;
        }

        // Load full details for each dossier
        const dossiers: GuardianDossier[] = [];
        const confirmationMap = new Map<string, boolean>();

        for (const ref of references) {
          try {
            const dossier = await ContractService.getDossier(ref.owner, ref.dossierId);
            const shouldStayEncrypted = await ContractService.shouldDossierStayEncrypted(ref.owner, ref.dossierId);

            // Check if guardian threshold is met (only for dossiers with guardians)
            let isThresholdMet = false;
            if (dossier.guardians && dossier.guardians.length > 0) {
              isThresholdMet = await ContractService.isGuardianThresholdMet(ref.owner, ref.dossierId);
            }

            dossiers.push({
              ...dossier,
              owner: ref.owner,
              isDecryptable: !shouldStayEncrypted,
              isThresholdMet
            });

            // Check if current user has confirmed this dossier
            const key = `${ref.owner}-${ref.dossierId}`;
            const hasUserConfirmed = await ContractService.hasGuardianConfirmed(ref.owner, ref.dossierId, currentAddress);
            confirmationMap.set(key, hasUserConfirmed);
          } catch (error) {
            console.error(`Failed to load dossier ${ref.dossierId} for owner ${ref.owner}:`, error);
          }
        }

        setGuardianDossiers(dossiers);
        setHasConfirmed(confirmationMap);
        console.log(`✅ Loaded ${dossiers.length} guardian dossier(s)`);
      } catch (error) {
        console.error('Failed to load guardian dossiers:', error);
        toast.error('Failed to load guardian dossiers');
      } finally {
        setIsLoading(false);
      }
    };

    loadGuardianDossiers();
  }, [address, burnerWallet.address]);

  const handleDossierClick = async (dossier: GuardianDossier) => {
    // For web3 external wallets (not burner), ensure correct network before viewing
    if (!burnerWallet.isConnected && address) {
      console.log('🔗 Checking network before viewing guardian dossier...');
      const networkOk = await ensureCorrectNetwork();
      if (!networkOk) {
        console.log('❌ Network switch failed or cancelled');
        toast.error('Please switch to Status Network Sepolia to view this dossier');
        return;
      }
      console.log('✅ Network check passed, opening dossier');
    }

    onViewDossier(dossier.owner, dossier.id);
  };

  const formatTimeRemaining = (lastCheckIn: bigint, interval: bigint): { text: string; color: string; isExpired: boolean } => {
    const lastCheckInMs = Number(lastCheckIn) * 1000;
    const intervalMs = Number(interval) * 1000;
    const now = Date.now();
    const timeSinceLastCheckIn = now - lastCheckInMs;
    const remainingMs = intervalMs - timeSinceLastCheckIn;

    if (remainingMs <= 0) {
      return { text: 'EXPIRED', color: 'text-red-600 dark:text-red-400', isExpired: true };
    }

    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return { text: `${days}d ${hours}h`, color: 'text-green-600 dark:text-green-400', isExpired: false };
    }
    return { text: `${hours}h`, color: 'text-yellow-600 dark:text-yellow-400', isExpired: false };
  };

  return (
    <div className={`flex-1 overflow-auto ${theme === "light" ? "bg-white" : "bg-black"}`}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className={`mb-8 border-b pb-6 ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onBack}
              className={`p-2 rounded-full transition-colors ${
                theme === 'light'
                  ? 'hover:bg-gray-100 text-gray-600'
                  : 'hover:bg-white/10 text-gray-400'
              }`}
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Shield className="w-8 h-8 text-[#e53e3e] flex-shrink-0" />
            <h1 className="editorial-header-large text-black dark:text-gray-100 mb-0" style={{ lineHeight: '1' }}>
              GUARDIAN DOSSIERS
            </h1>
          </div>
          <p className="editorial-body text-gray-600 dark:text-gray-400">
            View and manage dossiers where you are a guardian
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${
              theme === 'light' ? 'border-gray-900' : 'border-gray-100'
            }`}></div>
            <p className={`mt-4 text-sm ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>
              Loading guardian dossiers...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && guardianDossiers.length === 0 && (
          <div className={`text-center py-12 rounded-lg border ${
            theme === 'light'
              ? 'bg-gray-50 border-gray-200'
              : 'bg-gray-900/20 border-gray-700'
          }`}>
            <Shield className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'light' ? 'text-gray-400' : 'text-gray-600'
            }`} />
            <h3 className={`text-lg font-medium mb-2 ${
              theme === 'light' ? 'text-gray-900' : 'text-gray-100'
            }`}>
              No Guardian Dossiers
            </h3>
            <p className={`text-sm ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>
              You are not currently a guardian for any dossiers
            </p>
          </div>
        )}

        {/* Guardian Dossiers List */}
        {!isLoading && guardianDossiers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-medium ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}>
                Dossiers Under Your Protection ({guardianDossiers.length})
              </h2>
            </div>

            <div className="space-y-3">
              {guardianDossiers.map(dossier => {
                const timeInfo = formatTimeRemaining(dossier.lastCheckIn, dossier.checkInInterval);
                const key = `${dossier.owner}-${dossier.id}`;
                const confirmed = hasConfirmed.get(key) || false;
                const confirmationProgress = `${dossier.guardianConfirmationCount}/${dossier.guardianThreshold}`;

                // Determine status based on expiration and guardian protection
                const hasGuardians = dossier.guardians && dossier.guardians.length > 0;
                let status: 'active' | 'awaiting' | 'released';

                if (!timeInfo.isExpired) {
                  status = 'active';
                } else if (hasGuardians && !dossier.isThresholdMet) {
                  status = 'awaiting';
                } else {
                  status = 'released';
                }

                return (
                  <div
                    key={key}
                    className={`p-5 rounded-lg border transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300'
                        : 'bg-black border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className={`font-medium text-lg mb-1 ${
                          theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                        }`}>
                          {dossier.name}
                        </h3>
                        <p className={`text-sm font-mono ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Owner: {dossier.owner.slice(0, 6)}...{dossier.owner.slice(-4)}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : status === 'awaiting'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {status === 'active' ? 'Active' : status === 'awaiting' ? 'Awaiting Confirmation' : 'Released'}
                      </div>
                    </div>

                    {/* Guardian Info */}
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {/* Confirmation Status */}
                      <div className="flex items-center gap-2">
                        {confirmed ? (
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                        )}
                        <span className={`text-sm ${
                          theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                        }`}>
                          {confirmed ? 'Confirmed' : 'Pending'}
                        </span>
                      </div>

                      {/* Guardian Progress */}
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#e53e3e]" />
                        <span className={`text-sm font-medium ${
                          theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                        }`}>
                          {confirmationProgress} Guardians
                        </span>
                      </div>

                      {/* Time Remaining */}
                      {!timeInfo.isExpired && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className={`text-sm ${timeInfo.color}`}>
                            {timeInfo.text} remaining
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {/* View More Button */}
                      <button
                        onClick={() => handleDossierClick(dossier)}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          theme === 'light'
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-white/10 text-gray-200 hover:bg-white/20'
                        }`}
                      >
                        View More...
                      </button>

                      {/* Confirm Release Button - Only show if can confirm */}
                      {!confirmed && timeInfo.isExpired && status !== 'released' && (
                        <button
                          onClick={() => {
                            onShowConfirmModal(dossier.owner, dossier.id, dossier.name);
                          }}
                          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                            theme === 'light'
                              ? 'bg-gray-900 text-white hover:bg-gray-800'
                              : 'bg-white text-gray-900 hover:bg-gray-100'
                          }`}
                        >
                          <Shield className="w-4 h-4" />
                          <span>Confirm Release</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className={`mt-8 p-6 rounded-lg border ${
          theme === 'light'
            ? 'bg-blue-50 border-blue-200'
            : 'bg-blue-900/10 border-blue-800'
        }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 mt-0.5 ${
              theme === 'light' ? 'text-blue-600' : 'text-blue-400'
            }`} />
            <div>
              <h3 className={`font-medium mb-2 ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}>
                About Guardian Protection
              </h3>
              <ul className={`text-sm space-y-1 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                <li>• As a guardian, you help protect sensitive information from premature release</li>
                <li>• A specified number of guardians must confirm before a dossier can be decrypted</li>
                <li>• Click on any dossier to view details and confirm release when appropriate</li>
                <li>• Your guardian status represents trust placed in you by the dossier owner</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
