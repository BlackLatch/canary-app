'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ContractService, type Dossier } from '@/app/lib/contract';
import { tacoService } from '@/app/lib/taco';
import type { Address } from 'viem';
import { useTheme } from '@/app/lib/theme-context';
import { Sun, Moon, Shield, ArrowLeft, Settings } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import DossierDetailView from '@/app/components/DossierDetailView';
import Link from 'next/link';

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
  const { address: connectedAddress } = useAccount();
  const { authenticated, login } = usePrivy();

  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

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
      } catch (error) {
        console.error('❌ Failed to load release:', error);
        toast.error('Failed to load dossier details');
      } finally {
        setLoading(false);
      }
    };

    loadRelease();
  }, [user, dossierId]);

  const handleDecrypt = async () => {
    if (!dossier || !user || dossierId === null) return;

    let decryptToast: any;
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

      decryptToast = toast.loading('Decrypting manifest...');

      // Initialize TACo
      console.log(`🔧 Initializing TACo...`);
      const { DossierManifest } = await import('@/app/lib/taco');
      await tacoService.initialize();
      console.log(`✅ TACo initialized`);

      const { ThresholdMessageKit } = await import('@nucypher/taco');

      // Helper function to fetch and decrypt a file
      const fetchAndDecrypt = async (fileHash: string, description: string) => {
        const ipfsHash = fileHash.replace('ipfs://', '');
        const ipfsGateways = [
          `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
          `https://ipfs.io/ipfs/${ipfsHash}`,
          `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
        ];

        console.log(`📥 Fetching ${description} from IPFS...`);
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
        const messageKit = ThresholdMessageKit.fromBytes(retrievedData);
        const decryptedData = await tacoService.decryptFile(messageKit);
        console.log(`✅ ${description} decrypted (${decryptedData.length} bytes)`);

        return decryptedData;
      };

      // Step 1: Decrypt manifest (first file)
      console.log(`📋 Step 1/${fileHashes.length}: Decrypting manifest...`);
      const manifestData = await fetchAndDecrypt(fileHashes[0], 'manifest');
      const manifestJson = new TextDecoder().decode(manifestData);
      const manifest = JSON.parse(manifestJson);
      console.log(`✅ Manifest loaded:`, manifest);

      // Step 2: Decrypt all user files
      const decryptedFiles: Array<{ data: Uint8Array; metadata: any }> = [];

      for (let i = 1; i < fileHashes.length; i++) {
        const fileMetadata = manifest.files[i - 1];
        const fileNum = i;
        const totalFiles = fileHashes.length - 1;

        console.log(`📄 Step ${i + 1}/${fileHashes.length}: Decrypting ${fileMetadata.name}...`);
        toast.loading(`Decrypting file ${fileNum}/${totalFiles}: ${fileMetadata.name}`, { id: decryptToast });

        const decryptedData = await fetchAndDecrypt(
          fileHashes[i],
          `file ${fileNum}/${totalFiles} (${fileMetadata.name})`
        );

        decryptedFiles.push({
          data: decryptedData,
          metadata: fileMetadata,
        });
      }

      // Step 3: Download or view files
      console.log(`✅ All files decrypted! Processing ${decryptedFiles.length} files...`);
      toast.success(`All ${decryptedFiles.length} files decrypted successfully!`, { id: decryptToast });

      // Download each file with original name
      for (const { data, metadata } of decryptedFiles) {
        const blob = new Blob([data], { type: metadata.type });
        const url = URL.createObjectURL(blob);

        // Check if it's a media file that can be viewed in browser
        const isMedia =
          metadata.type.startsWith('image/') ||
          metadata.type.startsWith('video/') ||
          metadata.type.startsWith('audio/') ||
          metadata.type === 'application/pdf';

        if (isMedia) {
          window.open(url, '_blank');
          console.log(`👁️ Opened ${metadata.name} for viewing in browser`);
        }

        // Always download as well
        const link = document.createElement('a');
        link.href = url;
        link.download = metadata.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (!isMedia) {
          URL.revokeObjectURL(url);
        } else {
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }

        console.log(`💾 Downloaded ${metadata.name}`);
      }
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      toast.error(`Failed to decrypt: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        id: decryptToast,
      });
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-gray-50' : 'bg-black'}`}>
        <Toaster position="bottom-right" />
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
        <Toaster position="bottom-right" />
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

  const isOwner = connectedAddress && connectedAddress.toLowerCase() === user.toLowerCase();

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
      <Toaster position="bottom-right" />

      {/* Header Bar */}
      <header className={`border-b ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black'}`}>
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
              {/* Main Navigation */}
              <nav className="flex items-center gap-6 h-full">
                <Link href="/" className="nav-link">
                  CHECK IN
                </Link>
                <Link href="/?view=documents" className="nav-link">
                  DOSSIERS
                </Link>
                <Link href="/?view=monitor" className="nav-link">
                  MONITOR
                </Link>
                <Link href="/feed" className="nav-link">
                  PUBLIC RELEASES
                </Link>
                <Link
                  href="/?view=settings"
                  className={`p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/10 ${
                    theme === 'light'
                      ? 'text-gray-500 hover:text-gray-700'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </nav>

              {/* Auth Status and Theme Toggle */}
              <div className="flex items-center gap-6">
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
                {authenticated && connectedAddress ? (
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-black/40'}`}>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className={`monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                        {`${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={login}
                    className={`px-4 py-1.5 text-sm font-medium rounded border transition-all ${
                      theme === 'light'
                        ? 'border-gray-900 bg-gray-900 text-white hover:bg-gray-800'
                        : 'border-white bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    SIGN IN
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className={`${theme === 'light' ? 'bg-gray-50' : 'bg-black'} min-h-[calc(100vh-57px)]`}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <DossierDetailView
            dossier={dossier}
            owner={user}
            theme={theme}
            currentTime={currentTime}
            isOwner={isOwner}
            onBack={() => router.push('/')}
            onDecrypt={handleDecrypt}
          />
        </div>
      </div>
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
