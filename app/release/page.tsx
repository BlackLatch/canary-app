'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ContractService, type Dossier } from '@/app/lib/contract';
import { getMimeType } from '@/app/lib/mime-types';
import { tacoService } from '@/app/lib/taco';
import VerifyReleaseModal from '@/app/components/VerifyReleaseModal';
import type { Address } from 'viem';
import { useTheme } from '@/app/lib/theme-context';
import { Sun, Moon, Shield, Share2, CheckCircle, Lock, AlertTriangle, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount } from 'wagmi';
import { switchToPolygonAmoy } from '@/app/lib/network-switch';

export default function ReleaseDetail() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = searchParams.get('user') as Address | null;
  const dossierIdParam = searchParams.get('id');
  
  // Parse dossierId with better handling
  let dossierId: bigint | null = null;
  try {
    if (dossierIdParam !== null && dossierIdParam !== '') {
      dossierId = BigInt(dossierIdParam);
    }
  } catch (e) {
    console.error('Failed to parse dossierId:', e);
  }
  
  const { theme, toggleTheme } = useTheme();
  const { chainId } = useAccount();
  
  // Debug logging for parameters
  console.log('🔍 Release Page Parameters:');
  console.log('  - Raw user param:', searchParams.get('user'));
  console.log('  - Raw id param:', searchParams.get('id'));
  console.log('  - Parsed user:', user);
  console.log('  - Parsed dossierId:', dossierId?.toString());
  console.log('  - dossierId is 0n?', dossierId === 0n);
  console.log('  - Current chain:', chainId);
  
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [decryptedFiles, setDecryptedFiles] = useState<Array<{
    name: string;
    type: string;
    content: string | Blob;
  }>>([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  useEffect(() => {
    // Apply theme-based background class
    document.body.classList.remove('guide-dark', 'guide-light');
    document.body.classList.add(theme === 'dark' ? 'guide-dark' : 'guide-light');
    
    return () => {
      document.body.classList.remove('guide-dark', 'guide-light');
    };
  }, [theme]);

  useEffect(() => {
    console.log('📌 useEffect triggered for loading release');
    console.log('  - user:', user);
    console.log('  - dossierId:', dossierId?.toString());
    console.log('  - typeof dossierId:', typeof dossierId);
    
    if (!user || dossierId === null || dossierId === undefined) {
      console.log('⚠️ Missing required parameters, not loading release');
      console.log('  - user is null?', user === null);
      console.log('  - dossierId is null?', dossierId === null);
      console.log('  - dossierId is undefined?', dossierId === undefined);
      console.log('  - !dossierId evaluates to:', !dossierId);
      console.log('  - dossierId === 0n?', dossierId === 0n);
      setLoading(false);
      return;
    }

    const loadRelease = async () => {
      console.log('📋 Loading release details...');
      console.log('  - User:', user);
      console.log('  - Dossier ID:', dossierId?.toString());
      
      try {
        setLoading(true);
        
        // Load dossier details
        console.log('🔍 Fetching dossier from contract...');
        const dossierData = await ContractService.getDossier(user, dossierId);
        console.log('📦 Dossier data:', dossierData);
        setDossier(dossierData);
        
        // Check if unlocked
        const shouldStayEncrypted = await ContractService.shouldDossierStayEncrypted(user, dossierId);
        const unlocked = !shouldStayEncrypted && dossierData.isActive;
        setIsUnlocked(unlocked);
        
        // If unlocked, decrypt files
        if (unlocked) {
          console.log('🔓 Dossier is unlocked, starting decryption...');
          await decryptFiles(dossierData);
        } else {
          console.log('🔒 Dossier is still locked, skipping decryption');
        }
        
      } catch (error) {
        console.error('❌ Failed to load release:', error);
        console.error('  - Error type:', typeof error);
        console.error('  - Error message:', error instanceof Error ? error.message : 'Unknown error');
        console.error('  - Full error:', error);
        setDecryptionError('Failed to load release details');
        // Don't clear the dossier if we had an error
        // setDossier(null);
      } finally {
        console.log('📌 Setting loading to false');
        setLoading(false);
      }
    };

    loadRelease();
  }, [user, dossierId]);

  const decryptFiles = async (dossierData: Dossier) => {
    console.log('🔓 Starting decryption process for dossier:', dossierId?.toString());
    console.log('📦 Dossier encrypted file hashes:', dossierData.encryptedFileHashes);
    
    try {
      // Get the encrypted data CID from the dossier - it's stored in encryptedFileHashes array
      const encryptedFileHashes = dossierData.encryptedFileHashes;
      
      if (!encryptedFileHashes || encryptedFileHashes.length === 0) {
        console.log('⚠️ No encrypted file hashes found in dossier');
        setDecryptionError('No encrypted data found for this release');
        return;
      }
      
      // Use the first hash as the CID (for now, we'll handle multiple files later)
      let encryptedDataCid = encryptedFileHashes[0];
      
      // Remove ipfs:// prefix if present
      if (encryptedDataCid.startsWith('ipfs://')) {
        encryptedDataCid = encryptedDataCid.replace('ipfs://', '');
      }

      console.log('📦 Fetching encrypted data from IPFS, CID:', encryptedDataCid);
      
      // Try fetching from Pinata gateway first
      const ipfsUrl = `https://purple-certain-guan-605.mypinata.cloud/ipfs/${encryptedDataCid}`;
      console.log('🌐 Fetching from:', ipfsUrl);
      
      const response = await fetch(ipfsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
      }
      
      const encryptedDataBuffer = await response.arrayBuffer();
      const encryptedData = new Uint8Array(encryptedDataBuffer);
      console.log('✅ Retrieved encrypted data, size:', encryptedData.length, 'bytes');
      
      // Initialize TACo if needed
      console.log('🔐 Initializing TACo service...');
      await tacoService.initialize();
      
      // Reconstruct MessageKit from bytes
      console.log('📦 Reconstructing MessageKit from encrypted data...');
      const { ThresholdMessageKit } = await import('@nucypher/taco');
      const messageKit = ThresholdMessageKit.fromBytes(encryptedData);
      
      // Attempt decryption
      console.log('🔓 Attempting to decrypt with TACo...');
      console.log('  - User address:', user);
      console.log('  - Dossier ID:', dossierId?.toString());
      console.log('  - Should stay encrypted:', await ContractService.shouldDossierStayEncrypted(user!, dossierId!));
      
      const decryptedData = await tacoService.decryptFile(messageKit);
      console.log('✅ Decryption successful! Size:', decryptedData.length, 'bytes');
      
      // Process the decrypted data
      // The data might be a JSON string with file metadata or raw file data
      let fileData: any;
      try {
        // Try parsing as JSON first (in case it contains metadata)
        const jsonString = new TextDecoder().decode(decryptedData);
        fileData = JSON.parse(jsonString);
        console.log('📄 Decrypted data is JSON:', fileData);
      } catch {
        // If not JSON, treat as raw file data
        console.log('📄 Decrypted data is raw binary');
        // Assume it's a single file - try to guess the type
        const blob = new Blob([decryptedData]);
        const mimeType = getMimeType('unknown.txt'); // Default to text
        
        setDecryptedFiles([{
          name: 'Decrypted File',
          type: mimeType,
          content: mimeType.startsWith('text/') ? new TextDecoder().decode(decryptedData) : blob
        }]);
        return;
      }
      
      // If we have structured data with files
      if (fileData.files && Array.isArray(fileData.files)) {
        console.log(`📁 Processing ${fileData.files.length} decrypted files`);
        const processedFiles = fileData.files.map((file: any) => {
          const mimeType = getMimeType(file.name || 'unknown');
          let content: string | Blob;
          
          if (file.content) {
            // If content is base64, decode it
            if (file.encoding === 'base64') {
              const binaryString = atob(file.content);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              content = new Blob([bytes], { type: mimeType });
            } else {
              // Plain text content
              content = file.content;
            }
          } else {
            content = 'No content available';
          }
          
          return {
            name: file.name || 'Unnamed File',
            type: mimeType,
            content
          };
        });
        
        setDecryptedFiles(processedFiles);
        console.log('✅ All files processed successfully');
      } else if (fileData.content) {
        // Single file with content
        const mimeType = getMimeType(fileData.name || 'unknown.txt');
        setDecryptedFiles([{
          name: fileData.name || 'Decrypted File',
          type: mimeType,
          content: fileData.content
        }]);
        console.log('✅ Single file processed successfully');
      } else {
        console.warn('⚠️ Unexpected data structure:', fileData);
        setDecryptionError('Unexpected data format in decrypted content');
      }
      
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      
      // Check if it's a condition not met error
      if (error instanceof Error) {
        if (error.message.includes('switch to Polygon Amoy')) {
          console.log('🔗 Wrong network for decryption');
          setIsWrongNetwork(true);
          setDecryptionError(error.message);
        } else if (error.message.includes('No contract found') || error.message.includes('Coordinator')) {
          console.log('🔗 TACo contract not found - wrong network');
          setIsWrongNetwork(true);
          setDecryptionError('Please switch to Polygon Amoy testnet to decrypt this content. The TACo Coordinator contract is not available on the current network.');
        } else if (error.message.includes('condition') || error.message.includes('shouldDossierStayEncrypted')) {
          console.log('🔒 Decryption conditions not yet met');
          setDecryptionError('Release conditions have not been met. The content remains encrypted.');
        } else {
          setDecryptionError(`Decryption failed: ${error.message}`);
        }
      } else {
        setDecryptionError('An unexpected error occurred during decryption');
      }
    }
  };

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleNetworkSwitch = async () => {
    try {
      console.log('🔄 Manual network switch requested...');
      await switchToPolygonAmoy();
      
      // Reset error state
      setIsWrongNetwork(false);
      setDecryptionError(null);
      
      // Reload the page to retry with correct network
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch network:', error);
      toast.error('Failed to switch network. Please switch manually in your wallet.');
    }
  };

  const shareRelease = async () => {
    const url = window.location.href;
    const text = `${dossier?.name || 'Untitled Dossier'} has been unlocked`;
    
    try {
      if (navigator.share) {
        await navigator.share({ title: dossier?.name, text, url });
        toast.success('Release shared successfully');
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Failed to share release');
      }
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme === 'light' ? 'mesh-background-light' : 'mesh-background-dark'}`}>
        <Toaster position="top-right" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="editorial-card-bordered h-32"></div>
              <div className="editorial-card-bordered h-32"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!dossier || !user || dossierId === null) {
    console.log('🚫 Rendering "Release Not Found" because:');
    console.log('  - dossier is null?', dossier === null);
    console.log('  - user is null?', user === null);  
    console.log('  - dossierId is null?', dossierId === null);
    console.log('  - dossierId value:', dossierId?.toString());
    console.log('  - loading?', loading);
    
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'light' ? 'mesh-background-light' : 'mesh-background-dark'}`}>
        <Toaster position="top-right" />
        <div className="text-center editorial-card-bordered p-12">
          <h2 className="editorial-header text-gray-900 dark:text-gray-100 mb-3">
            Release Not Found
          </h2>
          <p className="editorial-body text-gray-600 dark:text-gray-400 mb-6">
            This release does not exist or has been removed.
          </p>
          <button
            onClick={() => router.push('/')}
            className="editorial-button editorial-button-primary"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-white' : 'bg-gray-900'}`}>
      <Toaster position="top-right" />
      
      {/* Header Bar */}
      <header className={`border-b backdrop-blur-sm ${theme === 'light' ? 'border-gray-200 bg-white/80' : 'border-gray-700 bg-gray-900/80'}`}>
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between h-10">
            {/* Left: Logo and Back Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  theme === 'light' 
                    ? 'text-gray-600 hover:text-gray-900' 
                    : 'text-gray-400 hover:text-gray-100'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
              <img 
                src="/canary.png" 
                alt="Canary" 
                className="h-8 w-auto"
                style={{
                  filter: 'drop-shadow(0 1px 4px rgba(0, 0, 0, 0.1))'
                }}
              />
            </div>
            
            {/* Right: Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className={`${theme === 'light' ? 'mesh-background-light' : 'mesh-background-dark'} min-h-[calc(100vh-57px)]`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Page Header */}
          <div className="editorial-card p-8 mb-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h1 className="editorial-header-large text-gray-900 dark:text-gray-100 mb-4">
                  {dossier.name || 'UNTITLED DOSSIER'}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="editorial-label-small text-gray-600 dark:text-gray-400">
                    DOSSIER #{dossierId.toString()}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Created {formatDate(dossier.lastCheckIn)}
                  </span>
                  {isUnlocked && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Unlocked
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Shield className={`w-12 h-12 ${
                isUnlocked ? 'text-green-500' : 'text-gray-400'
              }`} />
            </div>
          </div>

          {/* Status Banner */}
          <div className={`p-6 mb-8 editorial-card ${
            isUnlocked 
              ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800'
          }`}>
          <div className="flex items-start gap-3">
            {isUnlocked ? (
              <>
                <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="editorial-label-small uppercase tracking-wider text-green-800 dark:text-green-200 mb-2">
                    Release Status: Public
                  </p>
                  <p className="editorial-body text-green-700 dark:text-green-300">
                    This dossier's contents are now publicly accessible
                  </p>
                </div>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="editorial-label-small uppercase tracking-wider text-yellow-800 dark:text-yellow-200 mb-2">
                    Release Status: Pending
                  </p>
                  <p className="editorial-body text-yellow-700 dark:text-yellow-300">
                    Contents will unlock if no check-in occurs within {Math.floor(Number(dossier.checkInInterval) / 86400)} days
                  </p>
                </div>
              </>
            )}
          </div>
          </div>

          {/* Content Area */}
          <div className="editorial-card p-8 mb-8">
          {isUnlocked ? (
            decryptedFiles.length > 0 ? (
              <div className="space-y-6">
                {decryptedFiles.map((file, index) => (
                  <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      {file.name}
                    </h3>
                    {file.type.startsWith('text/') && (
                      <div className="prose dark:prose-invert max-w-none">
                        {String(file.content)}
                      </div>
                    )}
                    {file.type.startsWith('image/') && file.content instanceof Blob && (
                      <img 
                        src={URL.createObjectURL(file.content)} 
                        alt={file.name}
                        className="max-w-full h-auto rounded"
                      />
                    )}
                    {file.type.startsWith('video/') && file.content instanceof Blob && (
                      <video 
                        controls 
                        className="max-w-full h-auto rounded"
                      >
                        <source src={URL.createObjectURL(file.content)} type={file.type} />
                      </video>
                    )}
                  </div>
                ))}
              </div>
            ) : decryptionError ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Decryption Failed
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {decryptionError}
                </p>
                {isWrongNetwork && (
                  <button
                    onClick={handleNetworkSwitch}
                    className="editorial-button editorial-button-primary px-6 py-2 mx-auto"
                  >
                    Switch to Polygon Amoy
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">
                  Decrypting files...
                </p>
              </div>
            )
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-3">
                Content Locked
              </h3>
              <p className="editorial-body text-gray-600 dark:text-gray-400">
                This content will unlock when the inactivity condition is met
              </p>
            </div>
          )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-4">
            <button
              onClick={shareRelease}
              className="flex-1 editorial-button-primary flex items-center justify-center gap-2 px-6 py-3"
            >
              <Share2 className="w-4 h-4" />
              <span className="font-medium">Share Release</span>
            </button>
            <button
              onClick={() => setShowVerifyModal(true)}
              className="editorial-button px-6 py-3 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">Verify</span>
            </button>
          </div>
        </div>
      </div>

      {/* Verify Modal */}
      {showVerifyModal && dossier && user && dossierId && (
        <VerifyReleaseModal
          user={user}
          dossierId={dossierId}
          dossier={dossier}
          isUnlocked={isUnlocked}
          onClose={() => setShowVerifyModal(false)}
        />
      )}
    </div>
  );
}