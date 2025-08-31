'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { Shield, ExternalLink } from 'lucide-react';

const POLICY_VERSION = '1.0.0';
const POLICY_HASH = '0x1234567890abcdef'; // Replace with actual hash of policy content

// EIP-712 Domain
const domain = {
  name: 'Canary',
  version: '1',
  chainId: 80002, // Polygon Amoy
} as const;

// EIP-712 Types
const types = {
  AcceptableUsePolicy: [
    { name: 'statement', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'policyHash', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

interface AcceptableUsePolicyProps {
  onAccepted: () => void;
  theme: 'light' | 'dark';
}

export default function AcceptableUsePolicy({ onAccepted, theme }: AcceptableUsePolicyProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const { address, isConnected } = useAccount();
  const { user, authenticated } = usePrivy();
  const { signTypedDataAsync } = useSignTypedData();

  // Check if user has already signed
  useEffect(() => {
    const checkSignature = () => {
      const identifier = address || user?.email?.address || user?.id;
      if (!identifier) return;
      
      const storageKey = `canary_aup_signature_${identifier}`;
      const existingSignature = localStorage.getItem(storageKey);
      
      if (existingSignature) {
        const parsed = JSON.parse(existingSignature);
        // Check if signature is for current version
        if (parsed.version === POLICY_VERSION) {
          console.log('✅ User has already accepted AUP version', POLICY_VERSION);
          setIsOpen(false);
          return;
        }
      }
      
      // Show modal if not signed or outdated version
      setIsOpen(true);
    };

    // Check when user authenticates
    if (authenticated || isConnected) {
      // Small delay to ensure wallet is ready
      setTimeout(checkSignature, 500);
    }
  }, [authenticated, isConnected, address, user]);

  const handleSign = async () => {
    try {
      setIsSigning(true);
      
      const identifier = address || user?.email?.address || user?.id;
      if (!identifier) {
        throw new Error('No user identifier available');
      }

      const message = {
        statement: `I acknowledge that I have read and agree to the Canary Acceptable Use Policy, Terms of Service, and Privacy Policy.`,
        version: POLICY_VERSION,
        policyHash: POLICY_HASH,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      };

      let signature: string;
      
      if (isConnected && address) {
        // Use wagmi for Web3 wallets
        signature = await signTypedDataAsync({
          domain,
          types,
          primaryType: 'AcceptableUsePolicy',
          message,
        });
      } else {
        // For Privy embedded wallets, we'll just store acceptance
        // (Privy doesn't expose direct signing methods for embedded wallets)
        signature = 'privy_embedded_acceptance_' + Date.now();
      }

      // Store signature locally
      const storageKey = `canary_aup_signature_${identifier}`;
      const signatureData = {
        signature,
        message,
        version: POLICY_VERSION,
        timestamp: Date.now(),
        identifier,
      };
      
      localStorage.setItem(storageKey, JSON.stringify(signatureData));
      console.log('✅ AUP signature stored locally');
      
      setIsOpen(false);
      onAccepted();
    } catch (error) {
      console.error('Failed to sign AUP:', error);
    } finally {
      setIsSigning(false);
    }
  };

  const handleDecline = () => {
    // User declined, disconnect and redirect
    window.location.href = 'https://canaryapp.io';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]" />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[10001] p-4">
        <div className={`max-w-lg w-full rounded-lg shadow-xl ${
          theme === 'light' ? 'bg-white' : 'bg-gray-900'
        }`}>
          {/* Header */}
          <div className={`p-6 border-b ${
            theme === 'light' ? 'border-gray-200' : 'border-gray-700'
          }`}>
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600" />
              <h2 className={`text-xl font-bold ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}>
                Acceptable Use Policy
              </h2>
            </div>
          </div>

          {/* Content */}
          <div className={`p-6 space-y-4 ${
            theme === 'light' ? 'text-gray-700' : 'text-gray-300'
          }`}>
            <p>
              By using Canary, you agree to our policies and terms. Please review:
            </p>
            
            <div className="space-y-2">
              <a
                href="/acceptable-use-policy"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 text-sm hover:underline ${
                  theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                }`}
              >
                <ExternalLink size={14} />
                Acceptable Use Policy
              </a>
              <a
                href="/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 text-sm hover:underline ${
                  theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                }`}
              >
                <ExternalLink size={14} />
                Terms of Service
              </a>
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 text-sm hover:underline ${
                  theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                }`}
              >
                <ExternalLink size={14} />
                Privacy Policy
              </a>
            </div>

            <div className={`p-3 rounded-lg text-xs font-mono ${
              theme === 'light' ? 'bg-gray-100' : 'bg-black/40'
            }`}>
              <div>Version: {POLICY_VERSION}</div>
              <div>Policy Hash: {POLICY_HASH}</div>
            </div>

            <p className="text-sm">
              You will sign a message acknowledging your acceptance. This signature 
              will be stored locally and you won't be asked again for this version.
            </p>
          </div>

          {/* Actions */}
          <div className={`p-6 border-t flex gap-3 ${
            theme === 'light' ? 'border-gray-200' : 'border-gray-700'
          }`}>
            <button
              onClick={handleDecline}
              disabled={isSigning}
              className={`flex-1 py-2.5 px-4 rounded-lg border font-medium transition-colors ${
                theme === 'light'
                  ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  : 'border-gray-600 text-gray-300 hover:bg-white/5'
              } disabled:opacity-50`}
            >
              Decline
            </button>
            <button
              onClick={handleSign}
              disabled={isSigning}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                theme === 'light'
                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'bg-white text-gray-900 hover:bg-gray-100'
              } disabled:opacity-50`}
            >
              {isSigning ? 'Signing...' : 'Accept & Sign'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}