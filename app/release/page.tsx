'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ContractService, type Dossier } from '@/app/lib/contract';
import { tacoService } from '@/app/lib/taco';
import type { Address } from 'viem';
import { useTheme } from '@/app/lib/theme-context';
import { Sun, Moon, Shield, ArrowLeft, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import ThemeAwareToaster from '@/app/components/ThemeAwareToaster';
import { useAccount, useDisconnect } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { useBurnerWallet } from '@/app/lib/burner-wallet-context';
import DossierDetailView from '@/app/components/DossierDetailView';
import DecryptionView from '@/app/components/DecryptionView';
import DemoDisclaimer from '@/app/components/DemoDisclaimer';
import Link from 'next/link';

interface DecryptedFile {
  data: Uint8Array;
  metadata: {
    name: string;
    type: string;
    size: number;
  };
}

interface DecryptionProgress {
  stage: 'fetching' | 'decrypting' | 'complete' | 'error';
  currentFile: number;
  totalFiles: number;
  currentFileName?: string;
  error?: string;
}

function ReleaseDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = searchParams.get('user') as Address | null;
  const dossierIdParam = searchParams.get('id');

  // Parse dossierId
  let dossierId: bigint | null = null;
  try {
    if (dossierIdParam !== null && dossierIdParam !== '') {
      dossierId = BigInt(dossierIdParam);
    }
  } catch (e) {
    console.error('Failed to parse dossierId:', e);
  }

  const { theme, toggleTheme } = useTheme();
  const { address: connectedAddress, isConnected } = useAccount();
  const { authenticated, user: privyUser, logout } = usePrivy();
  const { disconnect } = useDisconnect();
  const burnerWallet = useBurnerWallet();

  const [authMode, setAuthMode] = useState<'standard' | 'advanced'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('canary-auth-mode') as 'standard' | 'advanced') || 'standard';
    }
    return 'standard';
  });

  const hasWalletConnection = () => {
    return (authMode === 'advanced' && isConnected) || (authMode === 'standard' && authenticated);
  };

  const setAuthModeWithPersistence = (mode: 'standard' | 'advanced') => {
    setAuthMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('canary-auth-mode', mode);
    }
  };

  // Helper to get current address (prioritize burner wallet)
  const getCurrentAddress = () => {
    return burnerWallet.address || connectedAddress || null;
  };

  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Demo disclaimer state
  const [showDemoDisclaimer, setShowDemoDisclaimer] = useState(false);

  // Decryption state
  const [showDecryptionView, setShowDecryptionView] = useState(false);
  const [decryptionProgress, setDecryptionProgress] = useState<DecryptionProgress>({
    stage: 'fetching',
    currentFile: 0,
    totalFiles: 0,
  });
  const [decryptedFiles, setDecryptedFiles] = useState<DecryptedFile[]>([]);

  // Guardian confirmation state
  const [hasConfirmedRelease, setHasConfirmedRelease] = useState(false);

  // Update time every second for accurate status display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user || dossierId === null || dossierId === undefined) {
      setLoading(false);
      return;
    }

    const loadRelease = async () => {
      try {
        setLoading(true);
        const dossierData = await ContractService.getDossier(user, dossierId);
        setDossier(dossierData);

        // Check if current user has confirmed release (if they're a guardian)
        const currentAddress = getCurrentAddress();
        if (currentAddress && dossierData.guardians && dossierData.guardians.length > 0) {
          const isGuardian = dossierData.guardians.some(
            (guardian: string) => guardian.toLowerCase() === currentAddress.toLowerCase()
          );
          if (isGuardian) {
            try {
              const confirmed = await ContractService.hasGuardianConfirmed(user, dossierId, currentAddress);
              setHasConfirmedRelease(confirmed);
            } catch (error) {
              console.error('Failed to check guardian confirmation status:', error);
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to load release:', error);
        toast.error('Failed to load dossier details');
      } finally {
        setLoading(false);
      }
    };

    loadRelease();
  }, [user, dossierId, burnerWallet.address, connectedAddress]);

  const handleDecrypt = async () => {
    if (!dossier || !user || dossierId === null) return;

    try {
      console.log('🔓 Attempting decryption for dossier:', dossierId.toString());

      if (dossier.encryptedFileHashes.length === 0) {
        toast.error('No encrypted files found in this dossier.');
        return;
      }

      const isReleased = dossier.isReleased === true;
      const fileHashes = dossier.encryptedFileHashes;

      console.log(
        isReleased
          ? '🔓 Decrypting released dossier (deadman switch triggered)...'
          : '🔓 Attempting to decrypt dossier...'
      );
      console.log(`📋 Total files to decrypt: ${fileHashes.length} (1 manifest + ${fileHashes.length - 1} files)`);

      // Open decryption view and initialize progress
      setShowDecryptionView(true);
      setDecryptedFiles([]);
      setDecryptionProgress({
        stage: 'fetching',
        currentFile: 0,
        totalFiles: fileHashes.length,
      });

      // Initialize TACo
      console.log(`🔧 Initializing TACo...`);
      await tacoService.initialize();
      console.log(`✅ TACo initialized`);

      const { ThresholdMessageKit } = await import('@nucypher/taco');

      // Helper function to fetch and decrypt a file
      const fetchAndDecrypt = async (fileHash: string, description: string, fileName?: string) => {
        const ipfsHash = fileHash.replace('ipfs://', '');
        const ipfsGateways = [
          `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
          `https://ipfs.io/ipfs/${ipfsHash}`,
          `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
        ];

        console.log(`📥 Fetching ${description} from IPFS...`);
        setDecryptionProgress(prev => ({
          ...prev,
          stage: 'fetching',
          currentFileName: fileName,
        }));

        let retrievedData: Uint8Array | null = null;

        for (const gateway of ipfsGateways) {
          try {
            const response = await fetch(gateway);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              retrievedData = new Uint8Array(arrayBuffer);
              console.log(`✅ Retrieved ${description} (${retrievedData.length} bytes)`);
              break;
            }
          } catch (error) {
            console.log(`❌ Gateway failed:`, gateway);
          }
        }

        if (!retrievedData) {
          throw new Error(`Failed to retrieve ${description} from IPFS`);
        }

        // Reconstruct and decrypt
        console.log(`🔓 Decrypting ${description}...`);
        setDecryptionProgress(prev => ({
          ...prev,
          stage: 'decrypting',
          currentFileName: fileName,
        }));

        const messageKit = ThresholdMessageKit.fromBytes(retrievedData);
        const decryptedData = await tacoService.decryptFile(messageKit);
        console.log(`✅ ${description} decrypted (${decryptedData.length} bytes)`);

        return decryptedData;
      };

      // Step 1: Decrypt manifest (first file)
      console.log(`📋 Step 1/${fileHashes.length}: Decrypting manifest...`);
      setDecryptionProgress({
        stage: 'fetching',
        currentFile: 1,
        totalFiles: fileHashes.length,
        currentFileName: 'Manifest',
      });

      const manifestData = await fetchAndDecrypt(fileHashes[0], 'manifest', 'Manifest');
      const manifestJson = new TextDecoder().decode(manifestData);
      const manifest = JSON.parse(manifestJson);
      console.log(`✅ Manifest loaded:`, manifest);

      // Step 2: Decrypt all user files
      const decryptedFilesList: DecryptedFile[] = [];

      for (let i = 1; i < fileHashes.length; i++) {
        const fileMetadata = manifest.files[i - 1];
        const fileNum = i;
        const totalFiles = fileHashes.length - 1;

        console.log(`📄 Step ${i + 1}/${fileHashes.length}: Decrypting ${fileMetadata.name}...`);
        setDecryptionProgress({
          stage: 'fetching',
          currentFile: i + 1,
          totalFiles: fileHashes.length,
          currentFileName: fileMetadata.name,
        });

        const decryptedData = await fetchAndDecrypt(
          fileHashes[i],
          `file ${fileNum}/${totalFiles} (${fileMetadata.name})`,
          fileMetadata.name
        );

        const decryptedFile: DecryptedFile = {
          data: decryptedData,
          metadata: fileMetadata,
        };

        decryptedFilesList.push(decryptedFile);
        setDecryptedFiles(prev => [...prev, decryptedFile]);
      }

      // Step 3: Complete
      console.log(`✅ All files decrypted! ${decryptedFilesList.length} files ready.`);
      setDecryptionProgress({
        stage: 'complete',
        currentFile: fileHashes.length,
        totalFiles: fileHashes.length,
      });

      toast.success(`All ${decryptedFilesList.length} files decrypted successfully!`);
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      setDecryptionProgress({
        stage: 'error',
        currentFile: 0,
        totalFiles: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      toast.error(`Failed to decrypt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleConfirmRelease = async () => {
    if (!user || dossierId === null || !currentAddress) {
      toast.error('Missing required information to confirm release');
      return;
    }

    try {
      console.log('🔐 Confirming release as guardian...');
      toast.loading('Confirming release...');

      await ContractService.confirmRelease(user, dossierId);

      toast.dismiss();
      toast.success('Release confirmed successfully!');

      // Update confirmation status
      setHasConfirmedRelease(true);

      // Reload the dossier to get updated confirmation count
      const updatedDossier = await ContractService.getDossier(user, dossierId);
      setDossier(updatedDossier);

    } catch (error) {
      toast.dismiss();
      console.error('❌ Failed to confirm release:', error);
      toast.error(`Failed to confirm release: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-gray-50' : 'bg-black'}`}>
        <ThemeAwareToaster />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="border rounded-lg h-32 bg-gray-100 dark:bg-gray-800"></div>
              <div className="border rounded-lg h-32 bg-gray-100 dark:bg-gray-800"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!dossier || !user || dossierId === null) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'light' ? 'bg-gray-50' : 'bg-black'}`}>
        <ThemeAwareToaster />
        <div className={`text-center border rounded-lg p-12 ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black/40'}`}>
          <h2 className={`text-2xl font-semibold mb-3 ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
            Dossier Not Found
          </h2>
          <p className={`mb-6 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
            This dossier does not exist or has been removed.
          </p>
          <Link
            href="/"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded border transition-all ${
              theme === 'light'
                ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                : 'border-gray-600 text-gray-300 hover:bg-white/5'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const currentAddress = getCurrentAddress();
  const isOwner = !!(currentAddress && currentAddress.toLowerCase() === user.toLowerCase());

  // Debug logging for release page
  console.log('🔍 Release page state:', {
    user,
    dossierId,
    currentAddress,
    isOwner,
    hasConfirmedRelease,
    dossierGuardians: dossier?.guardians,
    dossierStatus: dossier?.isReleased ? 'released' : (dossier?.isActive ? 'active' : 'inactive'),
  });

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
      <ThemeAwareToaster />

      {/* Demo Banner */}
      <div className={`border-b flex-shrink-0 ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-black border-gray-600'}`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center h-8 gap-2">
            <span className={`text-xs font-medium tracking-wider uppercase ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
              FOR DEMONSTRATION PURPOSES ONLY
            </span>
            <button
              onClick={() => setShowDemoDisclaimer(true)}
              className={`text-xs hover:underline ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`}
            >
              [learn more]
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col" style={{ zoom: '0.8' }}>
        {/* Header Bar */}
        <header className={`border-b ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black'}`} style={{ marginTop: '0px' }}>
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between h-10">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <img
                src="/solo-canary.png"
                alt="Canary"
                className="h-10 w-auto"
                style={{
                  filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
                }}
              />
              <span className={`text-xl font-medium tracking-wide uppercase ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                CANARY
              </span>
            </div>

            {/* Right: Navigation and Auth Status */}
            <div className="flex items-center gap-8">
              {/* Simple Back to App Link - Always visible */}
              <Link
                href="/"
                className="nav-link"
              >
                ← BACK TO APP
              </Link>

              {/* Only show wallet status if authenticated */}
              {hasWalletConnection() && (
                <>
                  {/* Wallet Status and Theme Toggle - Desktop Only */}
                  <div className="hidden md:flex items-center gap-6">
                    {/* Theme Toggle */}
                    <button
                      onClick={toggleTheme}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
                      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                    >
                      {theme === 'light' ? (
                        <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>

                    {/* Authentication Status */}
                    <div className="flex items-center gap-4">
                      {authMode === 'advanced' && connectedAddress ? (
                        // Advanced mode: Show wallet address
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black/40'}`}>
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className={`monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                            {`${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`}
                          </span>
                        </div>
                      ) : authMode === 'standard' && authenticated ? (
                        // Standard mode: Show user email or authenticated status
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black/40'}`}>
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className={`monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                            {privyUser?.email?.address || 'SIGNED IN'}
                          </span>
                        </div>
                      ) : null}

                      <button
                        onClick={() => {
                          // Disconnect based on mode
                          if (authMode === 'advanced' && isConnected) {
                            disconnect();
                          }
                          if (authMode === 'standard' && authenticated) {
                            logout();
                          }
                          // Reset state
                          setAuthModeWithPersistence('standard');
                          // Redirect to main page (login)
                          window.location.href = '/';
                        }}
                        className="text-sm text-muted hover:text-primary transition-colors"
                      >
                        SIGN OUT
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className={`flex-1 overflow-auto ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
            <div className="max-w-7xl mx-auto px-6 py-8">
              {!showDecryptionView ? (
                <DossierDetailView
                  dossier={dossier}
                  owner={user}
                  theme={theme}
                  currentTime={currentTime}
                  isOwner={isOwner}
                  currentUserAddress={currentAddress}
                  onBack={() => router.push('/feed')}
                  onDecrypt={handleDecrypt}
                  onConfirmRelease={handleConfirmRelease}
                  hasConfirmedRelease={hasConfirmedRelease}
                  backButtonText="Back to Public Releases"
                />
              ) : (
                <DecryptionView
                  isOpen={true}
                  onClose={() => router.push('/')}
                  progress={decryptionProgress}
                  decryptedFiles={decryptedFiles}
                  inline={true}
                  dossierName={dossier.name.replace('Encrypted file: ', '')}
                  fileCount={dossier.encryptedFileHashes.length - 1}
                  onStartDecrypt={handleDecrypt}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className={`border-t flex-shrink-0 ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black'}`}>
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-center gap-6">
              <a
                href="https://canaryapp.io"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 text-xs transition-colors ${theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Website</span>
              </a>

              <a
                href="https://docs.canaryapp.io"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 text-xs transition-colors ${theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Docs</span>
              </a>

              <a
                href="https://github.com/TheThirdRoom/canary"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 text-xs transition-colors ${theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>Source</span>
              </a>

              <a
                href="mailto:contact@canaryapp.io"
                className={`flex items-center gap-1.5 text-xs transition-colors ${theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Contact</span>
              </a>
            </div>

            <div className={`text-center mt-2 pt-2 border-t ${theme === 'light' ? 'border-gray-300' : 'border-gray-600'}`}>
              <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                © 2025 Canary.
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Demo Disclaimer Modal */}
      <DemoDisclaimer
        theme={theme}
        forceShow={showDemoDisclaimer}
        onClose={() => setShowDemoDisclaimer(false)}
      />
    </div>
  );
}

export default function ReleaseDetail() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    }>
      <ReleaseDetailContent />
    </Suspense>
  );
}
