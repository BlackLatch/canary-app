'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, AlertCircle, UserCheck, Clock, Eye } from 'lucide-react';
import { useTheme } from '../lib/theme-context';
import toast from 'react-hot-toast';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { useBurnerWallet } from '../lib/burner-wallet-context';
import { ContractService, type Dossier, type DossierReference } from '../lib/contract';
import { ensureCorrectNetwork } from '../lib/network-switch';

interface MonitorViewProps {
  onBack: () => void;
  onViewDossiers: (address: Address) => void;
}

interface RecipientDossier extends Dossier {
  owner: Address;
  isDecryptable?: boolean;
  isThresholdMet?: boolean;
}

export default function MonitorView({ onBack, onViewDossiers }: MonitorViewProps) {
  const { theme } = useTheme();
  const [recipientDossiers, setRecipientDossiers] = useState<RecipientDossier[]>([]);
  const [isLoadingRecipientDossiers, setIsLoadingRecipientDossiers] = useState(true);

  // Wallet hooks
  const { address } = useAccount();
  const burnerWallet = useBurnerWallet();

  // Helper to get current address (prioritize burner wallet)
  const getCurrentAddress = () => {
    return burnerWallet.address || address || null;
  };

  // Load recipient dossiers from blockchain
  useEffect(() => {
    const loadRecipientDossiers = async () => {
      const currentAddress = getCurrentAddress();
      if (!currentAddress) {
        console.log('No wallet connected, cannot load recipient dossiers');
        setRecipientDossiers([]);
        setIsLoadingRecipientDossiers(false);
        return;
      }

      setIsLoadingRecipientDossiers(true);

      // For web3 external wallets (not burner), ensure correct network before loading
      if (!burnerWallet.isConnected && address) {
        console.log('🔗 Checking network for web3 wallet...');
        const networkOk = await ensureCorrectNetwork();
        if (!networkOk) {
          console.log('❌ Network switch failed or cancelled');
          toast.error('Please switch to Status Network Sepolia to view recipient dossiers');
          setRecipientDossiers([]);
          setIsLoadingRecipientDossiers(false);
          return;
        }
        console.log('✅ Network check passed');
      }

      try {
        console.log('📋 Loading dossiers where user is a private recipient...');

        // Get all dossier references where user is a recipient
        const references: DossierReference[] = await ContractService.getDossiersWhereRecipient(currentAddress);
        console.log(`Found ${references.length} dossier(s) where ${currentAddress} is a recipient`);

        if (references.length === 0) {
          setRecipientDossiers([]);
          setIsLoadingRecipientDossiers(false);
          return;
        }

        // Load full details for each dossier (excluding own dossiers)
        const dossiers: RecipientDossier[] = [];

        for (const ref of references) {
          // Skip dossiers owned by the current user
          if (ref.owner.toLowerCase() === currentAddress.toLowerCase()) {
            console.log(`Skipping own dossier ${ref.dossierId}`);
            continue;
          }

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
          } catch (error) {
            console.error(`Failed to load dossier ${ref.dossierId} for owner ${ref.owner}:`, error);
          }
        }

        setRecipientDossiers(dossiers);
        console.log(`✅ Loaded ${dossiers.length} recipient dossier(s) from other accounts`);
      } catch (error) {
        console.error('Failed to load recipient dossiers:', error);
        toast.error('Failed to load recipient dossiers');
      } finally {
        setIsLoadingRecipientDossiers(false);
      }
    };

    loadRecipientDossiers();
  }, [address, burnerWallet.address]);

  const handleRecipientDossierClick = (dossier: RecipientDossier) => {
    // Navigate to view this owner's dossiers
    onViewDossiers(dossier.owner);
  };

  const formatTimeRemaining = (lastCheckIn: bigint, interval: bigint): { text: string; color: string; isExpired: boolean } => {
    const lastCheckInMs = Number(lastCheckIn) * 1000;
    const intervalMs = Number(interval) * 1000;
    const now = Date.now();
    const timeSinceLastCheckIn = now - lastCheckInMs;
    const remainingMs = intervalMs - timeSinceLastCheckIn;

    if (remainingMs <= 0) {
      return { text: 'RELEASED', color: 'text-red-600 dark:text-red-400', isExpired: true };
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
            <Eye className="w-8 h-8 text-[#e53e3e] flex-shrink-0" />
            <h1 className="editorial-header-large text-black dark:text-gray-100 mb-0" style={{ lineHeight: '1' }}>
              RECEIVE
            </h1>
          </div>
          <p className="editorial-body text-gray-600 dark:text-gray-400">
            View dossiers where you've been added as a private recipient
          </p>
        </div>

        {/* Private Recipient Dossiers Section */}
        <div className={`mb-8 p-6 rounded-lg border ${
          theme === 'light'
            ? 'bg-white border-gray-300'
            : 'bg-black border-gray-700'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <UserCheck className={`w-5 h-5 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`} />
            <h2 className={`text-lg font-medium ${
              theme === 'light' ? 'text-gray-900' : 'text-gray-100'
            }`}>
              Private Recipient Dossiers
            </h2>
          </div>

          {/* Loading State */}
          {isLoadingRecipientDossiers && (
            <div className="text-center py-8">
              <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${
                theme === 'light' ? 'border-gray-900' : 'border-gray-100'
              }`}></div>
              <p className={`mt-4 text-sm ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                Loading recipient dossiers...
              </p>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingRecipientDossiers && recipientDossiers.length === 0 && (
            <p className={`text-sm ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>
              You are not a private recipient of any dossiers yet.
            </p>
          )}

          {/* Recipient Dossiers List */}
          {!isLoadingRecipientDossiers && recipientDossiers.length > 0 && (
            <div className="space-y-3">
              <p className={`text-sm mb-4 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                You are a private recipient for {recipientDossiers.length} dossier{recipientDossiers.length !== 1 ? 's' : ''}. Click to view details.
              </p>
              {recipientDossiers.map(dossier => {
                const timeInfo = formatTimeRemaining(dossier.lastCheckIn, dossier.checkInInterval);
                const key = `${dossier.owner}-${dossier.id}`;

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
                    onClick={() => handleRecipientDossierClick(dossier)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 hover:border-[#e53e3e] hover:shadow-md'
                        : 'bg-black border-gray-700 hover:border-[#e53e3e] hover:bg-gray-900/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
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

                    {/* Time Remaining */}
                    {!timeInfo.isExpired && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className={`text-sm ${timeInfo.color}`}>
                          {timeInfo.text} remaining
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
                About Receive
              </h3>
              <p className={`text-sm ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                <strong>Private Recipient Dossiers:</strong> View dossiers where you've been added as a private recipient by the owner
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
