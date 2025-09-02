'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { AlertTriangle, FileText, Shield, X } from 'lucide-react';

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
  const [currentStep, setCurrentStep] = useState<'demo' | 'legal'>('demo');
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
      setCurrentStep('demo'); // Start with demo disclaimer
    };

    // Check when user authenticates
    if (authenticated || isConnected) {
      // Small delay to ensure wallet is ready
      setTimeout(checkSignature, 500);
    }
  }, [authenticated, isConnected, address, user]);

  const handleContinueToLegal = () => {
    setCurrentStep('legal');
  };

  const handleSign = async () => {
    try {
      setIsSigning(true);
      
      const identifier = address || user?.email?.address || user?.id;
      if (!identifier) {
        throw new Error('No user identifier available');
      }

      const message = {
        statement: `I acknowledge that I have read and agree to the Canary Acceptable Use Policy and Terms of Service.`,
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
        message: {
          ...message,
          timestamp: message.timestamp.toString() // Convert BigInt to string for JSON serialization
        },
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

  const handleClose = () => {
    if (currentStep === 'demo') {
      handleContinueToLegal();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]" />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[10001] pointer-events-none">
        <div className={`pointer-events-auto max-w-md w-full mx-4 animate-slide-up editorial-card-bordered ${
          theme === 'light' 
            ? 'bg-white border-gray-300' 
            : 'bg-black border-gray-600'
        }`}>
          
          {currentStep === 'demo' ? (
            <>
              {/* Demo Disclaimer Step */}
              <div className={`flex items-center justify-between p-6 border-b ${
                theme === 'light' ? 'border-gray-300' : 'border-gray-600'
              }`}>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h2 className={`editorial-header-small uppercase tracking-wide ${
                    theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                  }`}>
                    Demo Only
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className={`p-1.5 rounded-full transition-colors ${
                    theme === 'light' 
                      ? 'hover:bg-gray-100 text-gray-600' 
                      : 'hover:bg-white/10 text-gray-400'
                  }`}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <p className={`editorial-body mb-4 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  This is an early demo of <span className="font-medium">Canary</span>. It is not ready for real-world use 
                  and should not be trusted with sensitive or important data.
                </p>
                
                <p className={`editorial-body ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  Future updates may reset or change how this demo works, which could affect access to anything created here.
                </p>
              </div>

              <div className={`p-6 border-t ${
                theme === 'light' ? 'border-gray-300' : 'border-gray-600'
              }`}>
                <button
                  onClick={handleContinueToLegal}
                  className={`w-full py-3 px-6 font-medium text-base rounded-lg transition-all duration-300 ease-out border ${
                    theme === 'light'
                      ? 'bg-black text-white border-black hover:bg-gray-800'
                      : 'bg-black/40 text-white border-gray-600 hover:bg-black/60'
                  }`}
                >
                  I Understand, Continue
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Legal Acceptance Step */}
              <div className={`flex items-center justify-between p-6 border-b ${
                theme === 'light' ? 'border-gray-300' : 'border-gray-600'
              }`}>
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <h2 className={`editorial-header-small uppercase tracking-wide ${
                    theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                  }`}>
                    Terms & Policies
                  </h2>
                </div>
                <button
                  onClick={() => setCurrentStep('demo')}
                  className={`p-1.5 rounded-full transition-colors ${
                    theme === 'light' 
                      ? 'hover:bg-gray-100 text-gray-600' 
                      : 'hover:bg-white/10 text-gray-400'
                  }`}
                  aria-label="Back"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <p className={`editorial-body mb-4 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  To continue, please review and accept our policies. These set out how Canary can be used 
                  and what's expected of you.
                </p>
                
                <div className={`p-4 rounded border mb-4 ${
                  theme === 'light' 
                    ? 'bg-gray-50 border-gray-200' 
                    : 'bg-white/5 border-gray-700'
                }`}>
                  <p className={`text-sm font-medium mb-3 ${
                    theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                  }`}>
                    Required Documents
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
                      <span className={`${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>•</span>
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
                      <span className={`${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>•</span>
                      Terms of Service
                    </a>
                  </div>
                </div>

                <div className={`p-4 rounded border ${
                  theme === 'light' 
                    ? 'bg-gray-50 border-gray-200' 
                    : 'bg-white/5 border-gray-700'
                }`}>
                  <p className={`text-sm font-medium mb-2 ${
                    theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                  }`}>
                    Your Agreement
                  </p>
                  <p className={`text-sm mb-2 ${
                    theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    Accepting will create a signed record on this device confirming you agreed to version {POLICY_VERSION} of our policies.
                  </p>
                  <ul className={`text-sm space-y-1 ${
                    theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>This record stays only on your device.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Nothing is transmitted or stored by Canary.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className={`p-6 border-t flex gap-3 ${
                theme === 'light' ? 'border-gray-300' : 'border-gray-600'
              }`}>
                <button
                  onClick={handleDecline}
                  disabled={isSigning}
                  className={`flex-1 py-3 px-6 font-medium text-base rounded-lg transition-all duration-300 ease-out border ${
                    theme === 'light'
                      ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      : 'bg-black/20 text-gray-300 border-gray-600 hover:bg-black/30'
                  } disabled:opacity-50`}
                >
                  Decline
                </button>
                <button
                  onClick={handleSign}
                  disabled={isSigning}
                  className={`flex-1 py-3 px-6 font-medium text-base rounded-lg transition-all duration-300 ease-out border ${
                    theme === 'light'
                      ? 'bg-black text-white border-black hover:bg-gray-800'
                      : 'bg-white/10 text-white border-gray-600 hover:bg-white/20'
                  } disabled:opacity-50`}
                >
                  {isSigning ? 'Signing...' : 'Accept & Sign'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}