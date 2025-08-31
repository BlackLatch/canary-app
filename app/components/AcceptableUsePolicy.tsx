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
      <div className="fixed inset-0 flex items-center justify-center z-[10001] p-4">
        <div className={`editorial-card-bordered max-w-md w-full ${
          theme === 'light' 
            ? 'bg-white border-gray-300' 
            : 'bg-black border-gray-700'
        }`}>
          
          {currentStep === 'demo' ? (
            <>
              {/* Demo Disclaimer Step */}
              <div className={`editorial-card-header py-3 px-4 ${
                theme === 'light' ? 'border-gray-300' : 'border-gray-700'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <div>
                      <h2 className="editorial-header text-lg">
                        Demo Environment
                      </h2>
                      <p className={`editorial-label-small text-xs ${
                        theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        PLEASE READ BEFORE CONTINUING
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className={`p-1 rounded transition-colors ${
                      theme === 'light' 
                        ? 'hover:bg-gray-100' 
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <X size={16} className={theme === 'light' ? 'text-gray-500' : 'text-gray-400'} />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className={`editorial-card-bordered p-3 ${
                  theme === 'light' 
                    ? 'bg-amber-50 border-amber-300' 
                    : 'bg-amber-900/10 border-amber-900/50'
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className={`editorial-label-small font-semibold text-xs mb-1 ${
                        theme === 'light' ? 'text-amber-900' : 'text-amber-400'
                      }`}>
                        IMPORTANT NOTICE
                      </p>
                      <p className="editorial-body text-xs leading-relaxed">
                        This is a demonstration version of Canary running on the Polygon Amoy testnet. It is intended for testing and evaluation purposes only.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className={`editorial-label uppercase tracking-wider text-xs mb-2 ${
                    theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                  }`}>
                    DEMO LIMITATIONS:
                  </h3>
                  <ul className="space-y-1">
                    <li className="editorial-body text-xs flex items-start gap-2">
                      <span className={`${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>•</span>
                      <span>Encrypted files may be periodically cleared</span>
                    </li>
                    <li className="editorial-body text-xs flex items-start gap-2">
                      <span className={`${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>•</span>
                      <span>Smart contract state may be reset without notice</span>
                    </li>
                    <li className="editorial-body text-xs flex items-start gap-2">
                      <span className={`${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>•</span>
                      <span>Features may be unstable or incomplete</span>
                    </li>
                    <li className="editorial-body text-xs flex items-start gap-2">
                      <span className={`${theme === 'light' ? 'text-gray-400' : 'text-gray-600'}`}>•</span>
                      <span>Not suitable for sensitive or production data</span>
                    </li>
                  </ul>
                </div>

                <div className={`editorial-card p-2 ${
                  theme === 'light' ? 'bg-gray-50' : 'bg-gray-900/50'
                }`}>
                  <p className={`editorial-body text-xs leading-relaxed ${
                    theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    By continuing, you acknowledge that this is a test environment and agree not to store any sensitive or critical information.
                  </p>
                </div>
              </div>

              <div className={`editorial-card-footer py-3 px-4 ${
                theme === 'light' ? 'border-gray-300' : 'border-gray-700'
              }`}>
                <button
                  onClick={handleContinueToLegal}
                  className={`w-full py-2 px-3 rounded text-sm font-medium transition-all ${
                    theme === 'light'
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'bg-white text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  I Understand, Continue
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Legal Acceptance Step */}
              <div className={`editorial-card-header py-3 px-4 ${
                theme === 'light' ? 'border-gray-300' : 'border-gray-700'
              }`}>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <div>
                    <h2 className="editorial-header text-lg">
                      Terms & Policies
                    </h2>
                    <p className={`editorial-label-small text-xs ${
                      theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      REVIEW AND ACCEPT TO CONTINUE
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <p className="editorial-body text-xs">
                  To use Canary, you must review and accept our policies:
                </p>
                
                <div className={`editorial-card-bordered p-3 ${
                  theme === 'light' 
                    ? 'bg-gray-50 border-gray-200' 
                    : 'bg-gray-900/50 border-gray-700'
                }`}>
                  <div className="space-y-2">
                    <a
                      href="/acceptable-use-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 editorial-body text-xs hover:underline ${
                        theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                      }`}
                    >
                      <FileText size={12} />
                      Acceptable Use Policy
                    </a>
                    <a
                      href="/terms-of-service"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 editorial-body text-xs hover:underline ${
                        theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                      }`}
                    >
                      <FileText size={12} />
                      Terms of Service
                    </a>
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 editorial-body text-xs hover:underline ${
                        theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                      }`}
                    >
                      <FileText size={12} />
                      Privacy Policy
                    </a>
                  </div>
                </div>

                <div className={`editorial-card p-2 ${
                  theme === 'light' ? 'bg-gray-100' : 'bg-black/40'
                }`}>
                  <div className={`monospace-accent text-xs space-y-0.5 ${
                    theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    <div>Version: {POLICY_VERSION}</div>
                    <div>Policy Hash: {POLICY_HASH.slice(0, 12)}...</div>
                  </div>
                </div>

                <p className={`editorial-body text-xs leading-relaxed ${
                  theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  By accepting, you'll sign a message acknowledging your agreement. This signature will be stored locally.
                </p>
              </div>

              <div className={`editorial-card-footer py-3 px-4 flex gap-2 ${
                theme === 'light' ? 'border-gray-300' : 'border-gray-700'
              }`}>
                <button
                  onClick={handleDecline}
                  disabled={isSigning}
                  className={`flex-1 py-2 px-3 rounded border text-sm font-medium transition-all ${
                    theme === 'light'
                      ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      : 'border-gray-600 text-gray-300 hover:bg-gray-800'
                  } disabled:opacity-50`}
                >
                  Decline
                </button>
                <button
                  onClick={handleSign}
                  disabled={isSigning}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all ${
                    theme === 'light'
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'bg-white text-gray-900 hover:bg-gray-100'
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