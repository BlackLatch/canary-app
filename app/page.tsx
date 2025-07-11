'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Shield, Download, Copy, CheckCircle, AlertCircle, Github } from 'lucide-react';
import { commitEncryptedFileToPinata, DeadmanCondition, TraceJson, encryptFileWithDossier } from './lib/taco';
import Onboarding from './components/Onboarding';
import CanaryGuideStandalone from './components/CanaryGuideStandalone';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { usePrivy, useWallets, useConnectWallet } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { polygonAmoy } from 'wagmi/chains';
import { Address } from 'viem';
import { ContractService, CANARY_DOSSIER_ADDRESS, Dossier } from './lib/contract';
import toast, { Toaster } from 'react-hot-toast';

// Extended dossier interface with accurate decryptable status
interface DossierWithStatus extends Dossier {
  isDecryptable: boolean;
}

export default function Home() {
  const { connectors, connect, isPending } = useConnect();
  

  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { connectWallet } = useConnectWallet();
  
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  // Removed userProfile - using dossier-only storage model
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [checkInInterval, setCheckInInterval] = useState('60'); // Default to 1 hour in minutes
  const [name, setName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [traceJson, setTraceJson] = useState<TraceJson | null>(null);
  const [encryptedCapsule, setEncryptedCapsule] = useState<any>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const [userDossiers, setUserDossiers] = useState<DossierWithStatus[]>([]);
  const [currentDossierId, setCurrentDossierId] = useState<bigint | null>(null);
  const [contractConstants, setContractConstants] = useState<{
    minInterval: bigint;
    maxInterval: bigint;
    gracePeriod: bigint;
    maxDossiers: bigint;
  } | null>(null);
  const [uploads, setUploads] = useState<Array<{
    id: string;
    filename: string;
    status: 'encrypted' | 'committed';
    storageType: 'codex' | 'ipfs' | 'pinata';
    encryptionType: 'real' | 'dossier-enhanced' | 'dossier-only';
    payloadUri?: string;
    contractDossierId?: string;
    contractTxHash?: string;
    createdAt: Date;
  }>>([]);
  const [activityLog, setActivityLog] = useState([
    { type: 'Check in confirmed', date: 'Apr 31, 2026, 16:01 AM' },
    { type: 'Pre-registeral nor-contact', date: 'Apr-32, 3093, 26:3 PM' },
    { type: 'Trigger created', date: 'Apr 13, 2021, 18:00 AM' }
  ]);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [emergencyContacts, setEmergencyContacts] = useState<string[]>(['']);
  const [releaseMode, setReleaseMode] = useState<'public' | 'contacts'>('public');
  const [currentView, setCurrentView] = useState<'checkin' | 'documents' | 'guide'>('checkin');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showInactiveDocuments, setShowInactiveDocuments] = useState(false);
  const [showAlphaBanner, setShowAlphaBanner] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to check if we have a valid wallet connection (wagmi or Privy)
  const hasWalletConnection = () => {
    return (isConnected && address) || (authenticated && wallets.length > 0);
  };

  // Helper function to get current wallet address (wagmi or Privy)
  const getCurrentAddress = () => {
    return address || (wallets.length > 0 ? wallets[0]?.address : null);
  };

  // Update current time every second for real-time countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Debug: Add contract verification on mount (temporary)
  useEffect(() => {
    if (isConnected && process.env.NODE_ENV === 'development') {
      const runDebugCheck = async () => {
        try {
          console.log('🔍 Running debug contract verification...');
          const healthCheck = await ContractService.quickHealthCheck();
          if (!healthCheck) {
            console.log('📋 Running detailed verification...');
            const detailed = await ContractService.verifyContractDeployment();
            console.log('📊 Detailed verification result:', detailed);
          }
        } catch (error) {
          console.error('❌ Debug verification failed:', error);
        }
      };
      
      // Run after a short delay to let wallet connect
      setTimeout(runDebugCheck, 2000);
    }
  }, [isConnected]);

  // Apply background to body based on current view
  useEffect(() => {
    const body = document.body;
    body.classList.remove('guide-dark', 'guide-light');
    
    if (currentView === 'guide') {
      body.classList.add('guide-dark');
    } else {
      body.classList.add('guide-light');
    }
    
    // Cleanup function to remove classes when component unmounts
    return () => {
      body.classList.remove('guide-dark', 'guide-light');
    };
  }, [currentView]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const processCanaryTrigger = async () => {
    if (!uploadedFile) {
      toast.error('Please select a file first');
      return;
    }

    if (!checkInInterval || parseInt(checkInInterval) <= 0) {
      toast.error('Please set a valid check-in interval');
      return;
    }

    // Require wallet connection for dossier-only mode
    if (!isConnected || !address) {
      toast.error('Please connect your wallet to create encrypted documents');
      return;
    }

    // Check if we're on the right network
    if (chainId !== polygonAmoy.id) {
      console.warn('⚠️ Wrong network! Please switch to Polygon Amoy');
      toast.error('Please switch to Polygon Amoy network in your wallet');
      return;
    }

    setIsProcessing(true);
    const processingToast = toast.loading('Creating encrypted document with dossier conditions...');

    try {
      console.log('🔐 Starting dossier-only encryption flow...');
      
      // Step 1: Get next dossier ID
      console.log('🔍 Step 1: Getting next dossier ID...');
      const userDossierIds = await ContractService.getUserDossierIds(address as Address);
      const nextDossierId = BigInt(userDossierIds.length);
      console.log('🆔 Next dossier ID will be:', nextDossierId.toString());
      
      // Step 2: Encrypt with Dossier condition
      console.log('🔒 Step 2: Encrypting with Dossier contract condition...');
      const condition: DeadmanCondition = {
        type: 'no_checkin',
        duration: `${checkInInterval} MINUTES`,
        dossierId: nextDossierId,
        userAddress: address
      };

      const encryptionResult = await encryptFileWithDossier(
        uploadedFile,
        condition,
        name,
        nextDossierId,
        address
      );
      
      console.log('✅ File encrypted with Dossier contract condition');
      
      // Step 3: Upload encrypted file
      console.log('📦 Step 3: Uploading encrypted file...');
      const { commitResult, traceJson } = await commitEncryptedFileToPinata(encryptionResult);
      console.log('📦 Storage result:', commitResult);
      
      // Step 4: Create dossier on-chain
      console.log('📝 Step 4: Creating dossier on-chain...');
      const dossierName = name || `Encrypted document #${nextDossierId.toString()}`;
      const checkInMinutes = parseInt(checkInInterval);
      const recipients = [address];
      const fileHashes = [traceJson.payload_uri];
      
      let dossierId: bigint;
      let contractTxHash: string;
      
      try {
        const result = await ContractService.createDossier(
          dossierName,
          checkInMinutes,
          recipients,
          fileHashes
        );
        
        dossierId = result.dossierId;
        contractTxHash = result.txHash;
        setCurrentDossierId(dossierId);
        
        console.log('✅ Dossier created on-chain!');
        console.log('🆔 Dossier ID:', dossierId.toString());
        console.log('🔗 Contract TX:', contractTxHash);
        
        // Verify the ID matches our prediction
        if (dossierId !== nextDossierId) {
          console.warn(`⚠️ Dossier ID mismatch: predicted ${nextDossierId}, got ${dossierId}`);
        } else {
          console.log('✅ Dossier ID prediction was correct!');
        }
        
      } catch (error) {
        console.error('❌ Failed to create dossier:', error);
        toast.error(`Failed to create dossier: ${error}`, { id: processingToast });
        return;
      }

      // Step 5: Store results
      setEncryptedCapsule(encryptionResult);
      
      // Create enhanced trace JSON with dossier information
      const enhancedTraceJson = {
        ...traceJson,
        dossier_id: dossierId.toString(),
        user_address: address,
        contract_address: CANARY_DOSSIER_ADDRESS,
        contract_chain_id: polygonAmoy.id.toString(),
        contract_tx_hash: contractTxHash,
        check_in_interval_minutes: checkInMinutes,
        condition_type: 'dossier_contract_verification',
        encryption_method: 'dossier_only'
      };
      
      setTraceJson(enhancedTraceJson);
      
      // Add to uploads table
      const uploadId = `upload-${Date.now()}`;
      setUploads(prev => [...prev, {
        id: uploadId,
        filename: uploadedFile.name,
        status: 'committed',
        storageType: commitResult.storageType,
        encryptionType: 'dossier-only',
        createdAt: new Date(),
        payloadUri: commitResult.payloadUri,
        contractDossierId: dossierId.toString(),
        contractTxHash: contractTxHash
      }]);
      
      // Load updated dossiers
      await loadUserDossiers();
      
      // Add to activity log
      setActivityLog(prev => [
        { type: `✅ Dossier #${dossierId.toString()} created with contract condition`, date: new Date().toLocaleString() },
        { type: `🔒 File encrypted with Dossier-only condition`, date: new Date().toLocaleString() },
        { type: `📁 IPFS hash ${traceJson.payload_uri} stored on-chain`, date: new Date().toLocaleString() },
        { type: `📦 File committed to ${commitResult.storageType}`, date: new Date().toLocaleString() },
        ...prev
      ]);
      
      toast.success('🎉 Document created with dossier-only encryption!', { id: processingToast });
      
      // Reset form and navigate back to documents view
      setShowCreateForm(false);
      setCurrentStep(1);
      setEncryptedCapsule(null);
      setTraceJson(null);
      setUploadedFile(null);
      setName('');
      setEmergencyContacts(['']);
      setReleaseMode('public');
      
    } catch (error) {
      console.error('Error in dossier encryption flow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown encryption error';
      
      toast.error(`Dossier encryption failed: ${errorMessage}`, { id: processingToast });
      
      setActivityLog(prev => [
        { type: 'Dossier encryption failed', date: new Date().toLocaleString() },
        ...prev
      ]);
    } finally {
      setIsProcessing(false);
    }
  };



  const copyTraceJson = () => {
    if (traceJson) {
      navigator.clipboard.writeText(JSON.stringify(traceJson, null, 2));
    }
  };

  const downloadTraceJson = () => {
    if (traceJson) {
      const blob = new Blob([JSON.stringify(traceJson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'trace.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const downloadEncryptedFile = async () => {
    if (!encryptedCapsule) {
      toast.error('No encrypted file available in memory. Please encrypt a file first.');
      return;
    }
    
    try {
      console.log('📥 Downloading encrypted file from browser memory');
      console.log('📦 Original file:', encryptedCapsule.originalFileName);
      console.log('📦 Encrypted size:', encryptedCapsule.encryptedData.length, 'bytes');
      
      // Create filename based on original file name
      const originalName = encryptedCapsule.originalFileName;
      const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
      const filename = `${baseName}-encrypted.bin`;
      
      // Create blob from encrypted data in memory
      const blob = new Blob([encryptedCapsule.encryptedData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up URL
      URL.revokeObjectURL(url);
      
      console.log('🎉 MEMORY DOWNLOAD SUCCESS!');
      console.log('📦 Downloaded as:', filename);
      console.log('📦 Size:', encryptedCapsule.encryptedData.length, 'bytes');
      
      // Add to activity log
      setActivityLog(prev => [
        { type: 'Encrypted file downloaded from memory', date: new Date().toLocaleString() },
        ...prev
      ]);
      
    } catch (error) {
      console.error('❌ Memory download failed:', error);
      toast.error('Failed to download encrypted file from memory. Check console for details.');
    }
  };

  const testDecryption = async () => {
    if (!encryptedCapsule) {
      toast.error('No encrypted file available. Please encrypt a file first.');
      return;
    }

    try {
      console.log('🔓 Testing TACo decryption...');
      
      // Import the decryption function
      const { tacoService } = await import('./lib/taco');
      
      // Attempt to decrypt the messageKit
      const decryptedData = await tacoService.decryptFile(encryptedCapsule.messageKit);
      
      console.log('🎉 Decryption test successful!');
      console.log('📦 Decrypted size:', decryptedData.length, 'bytes');
      
      // Download the decrypted file
      const originalName = encryptedCapsule.originalFileName;
      const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
      const extension = originalName.substring(originalName.lastIndexOf('.')) || '';
      const filename = `${baseName}-decrypted${extension}`;
      
      const blob = new Blob([decryptedData]);
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      // Add to activity log
      setActivityLog(prev => [
        { type: 'TACo decryption test successful', date: new Date().toLocaleString() },
        ...prev
      ]);
      
      toast.success('🎉 TACo decryption successful! Check your downloads for the decrypted file.');
      
    } catch (error) {
      console.error('❌ Decryption test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let displayMessage = errorMessage;
      if (errorMessage.includes('time condition')) {
        displayMessage = 'Decryption failed. The dossier condition may not be met yet.';
      }
      toast.error(`❌ Decryption test failed: ${displayMessage}. Check console for details.`);
      
      // Add to activity log
      setActivityLog(prev => [
        { type: 'TACo decryption test failed', date: new Date().toLocaleString() },
        ...prev
      ]);
    }
  };

  // Load user's dossiers from contract with accurate decryptable status
  const loadUserDossiers = async () => {
    const currentAddress = address || (wallets.length > 0 ? wallets[0]?.address : null);
    if (!currentAddress) {
      console.log('No wallet address available for loading dossiers');
      return;
    }
    
    try {
      console.log('📋 Loading user dossiers from contract for address:', currentAddress);
      const dossierIds = await ContractService.getUserDossierIds(currentAddress as Address);
      
      const dossiers: DossierWithStatus[] = [];
      for (const id of dossierIds) {
        const dossier = await ContractService.getDossier(currentAddress as Address, id);
        
        // Check the actual decryptable status according to contract
        let shouldStayEncrypted = true;
        let isDecryptable = false;
        try {
          shouldStayEncrypted = await ContractService.shouldDossierStayEncrypted(currentAddress as Address, id);
          isDecryptable = !shouldStayEncrypted;
        } catch (error) {
          console.warn(`Could not check encryption status for dossier #${id.toString()}:`, error);
          // If contract call fails, assume not decryptable for security
          isDecryptable = false;
          console.log(`⚠️ Contract call failed for dossier #${id.toString()}, assuming encrypted for security`);
        }
        
        // Add accurate decryptable status to dossier object
        const dossierWithStatus: DossierWithStatus = {
          ...dossier,
          isDecryptable: isDecryptable
        };
        
        dossiers.push(dossierWithStatus);
        
        // Log the true status for debugging
        console.log(`📄 Dossier #${id.toString()}: isActive=${dossier.isActive}, shouldStayEncrypted=${shouldStayEncrypted}, isDecryptable=${isDecryptable}, fileHashes=${dossier.encryptedFileHashes.length}`);
      }
      
      setUserDossiers(dossiers);
      console.log(`✅ Loaded ${dossiers.length} dossiers with accurate decryptable status`);
      
    } catch (error) {
      console.error('❌ Failed to load dossiers:', error);
    }
  };

  const handleCheckIn = async () => {
    if (isCheckingIn) return; // Prevent double-clicks
    
    const now = new Date();
    
    // Check in on-chain if wallet connected and active dossiers exist
    if (isConnected && address && userDossiers.length > 0) {
      const activeDossiers = userDossiers.filter(d => d.isActive);
      
      if (activeDossiers.length === 0) {
        toast.error('No active documents to check in for');
        return;
      }

      setIsCheckingIn(true);
      
      try {
        console.log('✅ Performing bulk on-chain check-in for all active dossiers...');
        
        // Show loading state
        const checkInToast = toast.loading('Checking in to all active documents...');
        
        // Use the efficient checkInAll function - single transaction for all dossiers
        console.log('🚀 Using bulk check-in for efficiency...');
        const txHash = await ContractService.checkInAll();
        
        // Success - all active dossiers checked in with single transaction
        toast.success(`✅ Successfully checked in to all ${activeDossiers.length} active documents!`, { id: checkInToast });
        
        setActivityLog(prev => [
          { type: `✅ Bulk check-in successful for ${activeDossiers.length} documents (TX: ${txHash.slice(0, 10)}...)`, date: now.toLocaleString() },
          ...prev
        ]);
        
        // Reload dossiers to get updated lastCheckIn times
        await loadUserDossiers();
        
      } catch (error) {
        console.error('❌ Bulk check-in failed:', error);
        
        // Enhanced error handling with specific messages
        let errorMessage = 'Bulk check-in failed. Please try again.';
        if (error instanceof Error) {
          if (error.message.includes('No dossiers found')) {
            errorMessage = 'No documents found to check in to.';
          } else if (error.message.includes('No active dossiers')) {
            errorMessage = 'No active documents found to check in to.';
          } else if (error.message.includes('user rejected')) {
            errorMessage = 'Transaction was rejected. Check-in cancelled.';
          } else if (error.message.includes('insufficient funds')) {
            errorMessage = 'Insufficient funds for transaction fees.';
          } else if (error.message.includes('Network mismatch')) {
            errorMessage = 'Please switch to Polygon Amoy network.';
          } else if (error.message.includes('wallet provider')) {
            errorMessage = 'Wallet connection issue. Please reconnect your wallet.';
          }
        }
        
        toast.error(errorMessage);
        setActivityLog(prev => [
          { type: `❌ Bulk check-in failed: ${errorMessage}`, date: now.toLocaleString() },
          ...prev
        ]);
      } finally {
        setIsCheckingIn(false);
      }
    } else if (!isConnected) {
      toast.error('Please connect your wallet to check in');
    } else if (!address) {
      toast.error('Wallet address not available');
    } else if (userDossiers.length === 0) {
      toast.error('No documents created yet. Create a document first.');
    } else {
      // Fallback to local check-in only
      setActivityLog(prev => [
        { type: 'Local check-in confirmed', date: now.toLocaleString() },
        ...prev
      ]);
    }
  };

  const getTimeSinceLastCheckIn = () => {
    // If connected and have dossiers, use the most recent on-chain check-in
    if (hasWalletConnection() && userDossiers.length > 0) {
      let mostRecentCheckIn = 0;
      
      for (const dossier of userDossiers) {
        if (!dossier.isActive) continue;
        
        const checkInTime = Number(dossier.lastCheckIn);
        if (checkInTime > mostRecentCheckIn) {
          mostRecentCheckIn = checkInTime;
        }
      }
      
      if (mostRecentCheckIn === 0) {
        return 'No active dossiers';
      }
      
      const diffMs = currentTime.getTime() - (mostRecentCheckIn * 1000);
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffHours > 0) {
        return `${diffHours}h ${diffMinutes}m ago`;
      } else {
        return `${diffMinutes}m ago`;
      }
    }
    
    // If connected but no dossiers, show appropriate message
    if (hasWalletConnection() && userDossiers.length === 0) {
      return 'No documents created yet';
    }
    
    // If not connected, show disconnected status
    return 'Wallet not connected';
  };

  const getRemainingTime = () => {
    // If connected and have dossiers, use contract status
    if (hasWalletConnection() && userDossiers.length > 0) {
      const activeDossiers = userDossiers.filter(d => d.isActive);
      
      // If no active dossiers, show inactive status
      if (activeDossiers.length === 0) {
        return { expired: false, display: 'NO ACTIVE DOSSIERS', color: 'text-gray-500' };
      }
      
      // Check if any dossier is decryptable (expired)
      const hasExpiredDossiers = activeDossiers.some(d => d.isDecryptable);
      
      if (hasExpiredDossiers) {
        return { expired: true, display: 'DECRYPTABLE', color: 'text-red-600' };
      }
      
      // All active dossiers are still encrypted
      return { expired: false, display: 'ENCRYPTED', color: 'text-green-600' };
    }
    
    // If connected but no dossiers, show status
    if (isConnected && userDossiers.length === 0) {
      return { expired: false, display: 'NO DOCUMENTS', color: 'text-gray-500' };
    }
    
    // If not connected, show disconnected status
    return { expired: false, display: 'DISCONNECTED', color: 'text-gray-500' };
  };

  const getCountdownTime = () => {
    // If connected and have dossiers, calculate actual countdown
    if (hasWalletConnection() && userDossiers.length > 0) {
      const activeDossiers = userDossiers.filter(d => d.isActive);
      
      // If no active dossiers, show inactive status
      if (activeDossiers.length === 0) {
        return { expired: false, display: 'NO ACTIVE DOSSIERS', color: 'text-gray-500' };
      }
      
      // Find the dossier with the shortest remaining time
      let shortestRemainingMs = Infinity;
      let hasExpiredDossier = false;
      
      for (const dossier of activeDossiers) {
        const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
        const intervalMs = Number(dossier.checkInInterval) * 1000;
        const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
        const remainingMs = intervalMs - timeSinceLastCheckIn;
        
        if (remainingMs <= 0) {
          hasExpiredDossier = true;
        } else if (remainingMs < shortestRemainingMs) {
          shortestRemainingMs = remainingMs;
        }
      }
      
      // If any dossier has expired, show expired status
      if (hasExpiredDossier) {
        return { expired: true, display: '⚠ EXPIRED', color: 'text-red-600' };
      }
      
      // If we have a valid remaining time, format it
      if (shortestRemainingMs !== Infinity && shortestRemainingMs > 0) {
        const remainingHours = Math.floor(shortestRemainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((shortestRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const remainingSeconds = Math.floor((shortestRemainingMs % (1000 * 60)) / 1000);
        
        let color = 'text-green-600';
        if (shortestRemainingMs < 5 * 60 * 1000) {
          color = 'text-red-600';
        } else if (shortestRemainingMs < 30 * 60 * 1000) {
          color = 'text-orange-500';
        } else if (shortestRemainingMs < 2 * 60 * 60 * 1000) {
          color = 'text-yellow-600';
        }
        
        let display = '';
        if (remainingHours > 0) {
          display = `${remainingHours}H ${remainingMinutes}M ${remainingSeconds}S`;
        } else if (remainingMinutes > 0) {
          display = `${remainingMinutes}M ${remainingSeconds}S`;
        } else {
          display = `${remainingSeconds}S`;
        }
        
        return { expired: false, display, color };
      }
    }
    
    // If connected but no dossiers, show status
    if (isConnected && userDossiers.length === 0) {
      return { expired: false, display: 'NO DOCUMENTS', color: 'text-gray-500' };
    }
    
    // If not connected, show disconnected status
    return { expired: false, display: 'DISCONNECTED', color: 'text-gray-500' };
  };

  const handleOnboardingComplete = (userChoices: Record<string, string[]>) => {
    setOnboardingComplete(true);
    
    // Set default check-in interval based on user's risk level
    const riskLevel = userChoices.risk?.[0];
    if (riskLevel === 'Immediate danger') {
      setCheckInInterval('1');
    } else if (riskLevel === 'High risk') {
      setCheckInInterval('6');
    } else if (riskLevel === 'Moderate risk') {
      setCheckInInterval('12');
    } else if (riskLevel === 'Low risk') {
      setCheckInInterval('60'); // 1 hour for low risk
    } else {
      setCheckInInterval('1'); // Default to 1 minute for testing
    }
  };

  const handleSignIn = (method: string) => {
    console.log('Sign in method:', method);
    
    if (method === 'Web3 Wallet') {
      // Use Privy's connectWallet for external wallet connections
      console.log('Using Privy connectWallet for external wallet...');
      try {
        connectWallet();
      } catch (error) {
        console.error('Failed to connect external wallet via Privy:', error);
      }
    } else if (method === 'Email') {
      // Email sign-in via Privy
      console.log('Privy states:', { ready, authenticated, signedIn });
      if (ready) {
        if (!authenticated) {
          console.log('Calling Privy login()...');
          login();
        } else if (!signedIn) {
          console.log('User already authenticated, setting signedIn to true');
          setSignedIn(true);
        } else {
          console.log('User already signed in');
        }
      } else {
        console.log('Privy not ready yet, waiting...');
      }
    } else {
      // Fallback for other methods
      setSignedIn(true);
    }
  };

  // Clear wagmi wallet connection on page refresh/load only if Privy is authenticated
  useEffect(() => {
    // Only disconnect wagmi if user is authenticated with Privy (to avoid conflicts)
    if (isConnected && authenticated) {
      console.log('🔌 Disconnecting wagmi wallet on page refresh (Privy authenticated)...');
      disconnect();
    }
    // Don't reset signedIn here - let the auto sign-in effect handle Privy authentication
  }, []); // Run only once on mount

  // Auto sign-in if wallet is already connected (but not if Privy is handling auth)
  useEffect(() => {
    if (isConnected && !signedIn && !authenticated) {
      console.log('Auto-signing in wagmi wallet user...');
      setSignedIn(true);
    }
  }, [isConnected, signedIn, authenticated]);

  // Auto sign-in if Privy is authenticated
  useEffect(() => {
    console.log('Auto sign-in effect triggered:', { ready, authenticated, signedIn });
    if (ready && authenticated && !signedIn) {
      console.log('Auto-signing in authenticated Privy user...');
      setSignedIn(true);
    }
  }, [ready, authenticated]);

  // Auto-connect Privy embedded wallet to wagmi
  useEffect(() => {
    if (ready && authenticated && wallets.length > 0 && !isConnected) {
      console.log('Auto-connecting Privy embedded wallet...', { wallets });
      const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
      if (embeddedWallet) {
        console.log('Found embedded wallet:', embeddedWallet);
        setActiveWallet(embeddedWallet).then(() => {
          console.log('Embedded wallet set as active');
        }).catch(error => {
          console.error('Failed to set embedded wallet as active:', error);
        });
      }
    }
  }, [ready, authenticated, wallets, isConnected, setActiveWallet]);

  // Return to sign-in screen if BOTH wallet and Privy are disconnected
  useEffect(() => {
    if (!isConnected && !authenticated && signedIn) {
      console.log('Both wagmi and Privy disconnected, signing out...');
      setSignedIn(false);
    }
  }, [isConnected, authenticated, signedIn]);

  // Load contract data when wallet connects (wagmi or Privy embedded)
  useEffect(() => {
    const currentAddress = address || (wallets.length > 0 ? wallets[0]?.address : null);
    if ((isConnected && address) || (authenticated && currentAddress)) {
      console.log('Loading contract data for address:', currentAddress);
      loadUserDossiers();
      
      // Load contract constants
      ContractService.getConstants()
        .then(constants => {
          setContractConstants(constants);
          // Set default check-in interval to minimum allowed
          const minIntervalMinutes = Number(constants.minInterval / BigInt(60));
          setCheckInInterval(minIntervalMinutes.toString());
          console.log('📊 Contract constants loaded:', constants);
        })
        .catch(error => {
          console.error('❌ Failed to load contract constants:', error);
        });
    }
  }, [isConnected, address, authenticated, wallets]);

  // Show onboarding if not completed
  if (!onboardingComplete) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Show sign-in page if onboarding complete but not signed in
  if (!signedIn) {
  return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-8 relative" style={{ zoom: '0.8' }}>
        {/* Logo - Top Left */}
        <div className="absolute top-6 left-6">
          <img 
            src="/canary.png" 
            alt="Canary" 
            className="h-16 md:h-20 w-auto"
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15))'
            }}
          />
        </div>
        
        <div className="max-w-2xl w-full text-center">
          {/* Sign in */}
          <h2 className="editorial-header text-3xl md:text-4xl lg:text-5xl mb-6 md:mb-8 leading-tight">
            Welcome to Canary
          </h2>

          <div className="space-y-3 md:space-y-4 max-w-md mx-auto">
            <button
              className="editorial-button w-full py-3 md:py-4 text-base md:text-lg bg-slate-700 hover:bg-slate-800 text-white font-medium transition-all duration-200 hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed border-2 border-slate-600 hover:border-slate-700"
              onClick={() => handleSignIn('Web3 Wallet')}
              disabled={isPending}
            >
              {isPending ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Connecting...
                </div>
              ) : (
                'Connect Web3 Wallet'
              )}
            </button>
            
            <button
              className="editorial-button w-full py-3 md:py-4 text-base md:text-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105 transform bg-white"
              onClick={() => handleSignIn('Email')}
              disabled={!ready}
            >
              {!ready ? 'Loading...' : 'Sign in with Email'}
            </button>
          </div>

          <p className="editorial-body text-gray-600 mt-6 md:mt-8 text-sm md:text-base">
            Your truth protection starts now.
          </p>
          
          {/* Support Section */}
          <div className="mt-8 md:mt-12 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="editorial-body text-gray-500 text-xs md:text-sm mb-3">
                Support this open-source project
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => {
                    const supportAddress = '0x60646c03b1576E75539b64352C18F1230F99EEa3';
                    navigator.clipboard.writeText(supportAddress).then(() => {
                      toast.success('💝 Donation address copied to clipboard!\n\nETH/Polygon: ' + supportAddress, {
                        duration: 6000,
                        style: {
                          background: '#10B981',
                          color: 'white',
                          maxWidth: '500px',
                        },
                      });
                    }).catch(() => {
                      toast.error('Failed to copy address');
                    });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm border-2 border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-all duration-200 editorial-body font-medium"
                  title="Click to copy donation address"
                >
                  <span>💝</span>
                  <span>Donate ETH/Polygon</span>
                </button>
                <button
                  onClick={() => window.open('https://github.com/TheThirdRoom/canary', '_blank')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm border-2 border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-all duration-200 editorial-body font-medium"
                  title="View source code on GitHub"
                >
                  <Github size={16} />
                  <span>View on GitHub</span>
                </button>
              </div>
              <p className="editorial-body text-gray-400 text-xs mt-2">
                Open-source and community-driven
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const intervalOptions = [
    { value: '1', label: '1 Minute (Testing)' },
    { value: '5', label: '5 Minutes' },
    { value: '15', label: '15 Minutes' },
    { value: '60', label: '1 Hour' },
    { value: '360', label: '6 Hours' },
    { value: '720', label: '12 Hours' },
    { value: '1440', label: '24 Hours' }
  ];

  return (
    <>
      {/* Global Grid Animation Styles */}
      <style>
        {`
          @keyframes gridMove {
            0% { background-position: 0px 0px; }
            100% { background-position: 80px -80px; }
          }
          
          .canary-grid-background {
            background-color: #f8f9fa;
            background-image: 
              linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px);
            background-size: 80px 80px;
            animation: gridMove 12s linear infinite;
          }
          
          .canary-grid-background-dark {
            background-color: #1a1a1a;
            background-image: 
              linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
            background-size: 80px 80px;
            animation: gridMove 12s linear infinite;
          }
          
          body.guide-dark {
            background-color: #1a1a1a !important;
            background-image: 
              linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px) !important;
            background-size: 80px 80px !important;
            animation: gridMove 12s linear infinite !important;
          }
          
          body.guide-light {
            background-color: #f8f9fa !important;
            background-image: 
              linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px) !important;
            background-size: 80px 80px !important;
            animation: gridMove 12s linear infinite !important;
          }
        `}
      </style>
      
             <div className="min-h-screen h-auto relative" style={{ zoom: '0.8', minHeight: '100vh' }}>
        {/* Alpha Warning Banner */}
        {showAlphaBanner && (
          <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-b border-amber-200/50 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div></div>
                <div className="text-center">
                  <div className="editorial-header font-bold text-amber-900 tracking-wide text-sm mb-1">ALPHA SOFTWARE</div>
                  <div className="editorial-body text-amber-800 text-sm">Testnet demo with no guarantees for data security or service availability. Not for production use.</div>
                </div>
                <button
                  onClick={() => setShowAlphaBanner(false)}
                  className="flex items-center justify-center w-6 h-6 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-md transition-colors mt-1"
                  aria-label="Close banner"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Logo - Fixed Top Left */}
        <div className={`absolute left-6 z-50 transition-all duration-300 ${showAlphaBanner ? 'top-28' : 'top-6'}`}>
          <img 
            src="/canary.png" 
            alt="Canary" 
            className="h-20 w-auto"
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15))'
            }}
          />
        </div>

        {/* Header */}
        <header className="border-b border-gray-200/30 px-4 py-6" style={{ marginTop: '0px' }}>
                  <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div></div> {/* Spacer for layout balance */}
            
            <div className="flex items-center gap-8">
            <nav className="flex gap-8">
              <button 
                onClick={() => setCurrentView('checkin')}
                className={`editorial-body font-semibold transition-colors ${
                  currentView === 'guide' 
                    ? '!text-white hover:!text-gray-200'
                    : currentView === 'checkin' 
                      ? 'text-gray-900 border-b-2 border-gray-900 pb-1' 
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Check In
              </button>
              <button 
                onClick={() => setCurrentView('documents')}
                className={`editorial-body font-semibold transition-colors ${
                  currentView === 'guide' 
                    ? '!text-white hover:!text-gray-200'
                    : currentView === 'documents' 
                      ? 'text-gray-900 border-b-2 border-gray-900 pb-1' 
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Documents
              </button>
              <button 
                onClick={() => setCurrentView('guide')}
                className={`editorial-body font-semibold transition-colors ${
                  currentView === 'guide' 
                    ? '!text-white border-b-2 border-white pb-1'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Guide
              </button>
              <button 
                onClick={() => {
                  const supportAddress = '0x60646c03b1576E75539b64352C18F1230F99EEa3';
                  navigator.clipboard.writeText(supportAddress).then(() => {
                    toast.success('💝 Support address copied to clipboard!', {
                      duration: 4000,
                      style: {
                        background: '#10B981',
                        color: 'white',
                      },
                    });
                  }).catch(() => {
                    toast.error('Failed to copy address');
                  });
                }}
                className={`editorial-body font-semibold transition-colors ${
                  currentView === 'guide' 
                    ? '!text-white hover:!text-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Support project development - Click to copy donation address"
              >
                💝 Support
              </button>
              <button 
                onClick={() => window.open('https://github.com/TheThirdRoom/canary', '_blank')}
                className={`editorial-body font-semibold transition-colors ${
                  currentView === 'guide' 
                    ? '!text-white hover:!text-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="View source code on GitHub"
              >
                <Github size={18} />
              </button>
            </nav>
            
            {/* Wallet Status */}
            {(isConnected && address) || (authenticated && wallets.length > 0) ? (
              <div className="flex items-center gap-3">
                <div className={`editorial-body text-sm border-2 px-3 py-2 rounded-lg ${
                  currentView === 'guide' 
                    ? 'border-gray-600 bg-gray-800 !text-white' 
                    : 'border-gray-300 bg-white text-gray-900'
                }`}>
                  <span className="text-green-400 font-semibold">●</span> {
                    address 
                      ? `${address.slice(0, 6)}...${address.slice(-4)}` 
                      : wallets[0]?.address 
                        ? `${wallets[0].address.slice(0, 6)}...${wallets[0].address.slice(-4)}`
                        : 'Wallet'
                  }
                  {!isConnected && authenticated && (
                    <span className="ml-2 text-xs opacity-75">(Email)</span>
                  )}
        </div>
                <button
                  onClick={() => {
                    // Disconnect wagmi wallet
                    if (isConnected) {
                      disconnect();
                    }
                    // Logout from Privy if authenticated
                    if (authenticated) {
                      logout();
                    }
                    // Reset local state
                    setSignedIn(false);
                  }}
                  className={`editorial-body text-sm underline ${
                    currentView === 'guide' 
                      ? '!text-gray-300 hover:!text-white' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Log out
                </button>
        </div>
            ) : (
              <div className={`editorial-body text-sm ${
                currentView === 'guide' ? '!text-gray-300' : 'text-gray-500'
              }`}>
                Not Connected
              </div>
            )}
          </div>
        </div>
      </header>

      {currentView === 'guide' ? (
        // Guide View - Full Content Area
        <div className="w-full">
          <CanaryGuideStandalone />
        </div>
      ) : currentView === 'checkin' ? (
        // Check In View - Normal Container
        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* Safety Check-in with Countdown */}
          <div className="text-center mb-16">
            <div className="space-y-6">
              {/* Countdown Display */}
              <div className="space-y-2">
                <div className="editorial-body text-sm text-gray-500">
                  {hasWalletConnection() && userDossiers.length > 0 ? 'Next release in:' : ''}
                </div>
                <div className={`editorial-header text-5xl ${getCountdownTime().color} font-bold font-mono tracking-wide`}>
                  {getCountdownTime().display}
                </div>
                {getCountdownTime().expired && (
                  <div className="editorial-body text-sm text-red-600 font-semibold">
                    ⚠ Release condition met
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-center gap-4">
                {/* Check In Button */}
                <button
                  onClick={handleCheckIn}
                  disabled={isCheckingIn || !hasWalletConnection() || userDossiers.filter(d => d.isActive).length === 0}
                  className="bg-white text-gray-900 border-4 border-gray-900 hover:bg-gray-800 hover:!text-white hover:[&>*]:!text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none px-12 py-8 editorial-header text-xl font-bold tracking-[0.15em] shadow-xl transform hover:scale-105 transition-all duration-200 uppercase"
                >
                  {isCheckingIn ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-current mr-4"></div>
                      CHECKING IN...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="inline mr-4" size={28} />
                      CHECK IN NOW
                    </>
                  )}
                </button>
                
                {/* Share Button */}
                {hasWalletConnection() && (
                  <button
                    onClick={() => {
                      const currentAddress = getCurrentAddress();
                      const shareUrl = `${window.location.origin}/share/${currentAddress}`;
                      navigator.clipboard.writeText(shareUrl).then(() => {
                        toast.success('📋 Share link copied to clipboard!', {
                          duration: 3000,
                          style: {
                            background: '#10B981',
                            color: 'white',
                          },
                        });
                        setActivityLog(prev => [
                          { type: `📤 Share link copied: ${shareUrl}`, date: new Date().toLocaleString() },
                          ...prev
                        ]);
                      }).catch(() => {
                        toast.error('Failed to copy share link');
                      });
                    }}
                    className="bg-white text-gray-900 border-4 border-gray-900 hover:bg-gray-800 hover:!text-white hover:[&>*]:!text-white px-6 py-4 editorial-header text-sm font-bold tracking-[0.15em] shadow-xl transform hover:scale-105 transition-all duration-200 uppercase"
                    title={`Copy shareable link: ${window.location.origin}/share/${getCurrentAddress()?.slice(0,6)}...${getCurrentAddress()?.slice(-4)}`}
                  >
                    <svg className="inline w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    SHARE
                  </button>
                )}
              </div>
              
              {/* Document Summary */}
              <div className="editorial-body text-sm text-gray-600">
                {hasWalletConnection() && userDossiers.length > 0 ? (
                  `${userDossiers.filter(d => d.isActive).length} active of ${userDossiers.length} total documents`
                ) : (
                  hasWalletConnection() ? '' : 'Wallet not connected'
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Documents View - Normal Container
        <div className="max-w-7xl mx-auto px-4 py-12">
          {!showCreateForm ? (
            <>
              {/* Your Documents */}
              {hasWalletConnection() && (
                <div className="border-2 border-gray-800 mb-12">
                  <div className="bg-gray-800 p-3">
                    <div className="flex justify-between items-center">
                      <h2 style={{color: '#ffffff'}} className="editorial-header text-lg tracking-[0.2em] font-bold">Your Documents</h2>
                      <div className="flex items-center gap-4">
                        <span style={{color: '#ffffff'}} className="editorial-body text-xs">
                          {userDossiers.length > 0 
                            ? `${userDossiers.filter(d => d.isActive).length} active of ${userDossiers.length} total`
                            : ''
                          }
                        </span>
                        {userDossiers.length > 0 && userDossiers.some(d => !d.isActive) && (
                          <button
                            onClick={() => setShowInactiveDocuments(!showInactiveDocuments)}
                            className={`px-3 py-1 editorial-body text-xs font-bold border-2 transition-all duration-200 ${
                              showInactiveDocuments
                                ? 'bg-white text-gray-900 border-white hover:bg-gray-200'
                                : 'bg-transparent text-white border-white hover:bg-white hover:text-gray-900'
                            }`}
                          >
                            {showInactiveDocuments ? 'HIDE INACTIVE' : 'SHOW INACTIVE'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/90 backdrop-blur-sm p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {/* Add New Document Card - Always shown */}
                      <div 
                        onClick={() => setShowCreateForm(true)}
                        className="border-2 border-dashed border-gray-400 bg-gray-50 hover:border-gray-900 hover:bg-gray-100 transition-all duration-200 cursor-pointer group"
                      >
                        <div className="h-full flex flex-col items-center justify-center p-8 min-h-[300px]">
                          <div className="text-gray-400 group-hover:text-gray-900 transition-colors mb-4">
                            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <h3 className="editorial-header text-lg font-bold text-gray-600 group-hover:text-gray-900 transition-colors text-center">
                            CREATE NEW DOCUMENT
                          </h3>
                          <p className="editorial-body text-sm text-gray-500 group-hover:text-gray-700 transition-colors text-center mt-2">
                            Encrypt and upload a new file to the deadman switch
                          </p>
                        </div>
                      </div>

                      {/* Existing documents */}
                      {userDossiers
                          .filter(dossier => showInactiveDocuments || dossier.isActive)
                          .map((dossier, index) => {
                          const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
                          const intervalMs = Number(dossier.checkInInterval) * 1000;
                          const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
                          const remainingMs = intervalMs - timeSinceLastCheckIn;
                          const isExpired = remainingMs <= 0;
                          
                          let timeColor = 'text-green-600';
                          if (remainingMs < 5 * 60 * 1000) {
                            timeColor = 'text-red-600';
                          } else if (remainingMs < 30 * 60 * 1000) {
                            timeColor = 'text-orange-500';
                          } else if (remainingMs < 2 * 60 * 60 * 1000) {
                            timeColor = 'text-yellow-600';
                          }
                          
                          let timeDisplay = '';
                          if (!dossier.isActive) {
                            timeDisplay = 'Deactivated';
                            timeColor = 'text-gray-400';
                          } else if (isExpired) {
                            timeDisplay = '⚠ EXPIRED';
                            timeColor = 'text-red-600';
                          } else {
                            const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                            const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                            const remainingSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
                            
                            if (remainingHours > 0) {
                              timeDisplay = `${remainingHours}H ${remainingMinutes}M`;
                            } else if (remainingMinutes > 0) {
                              timeDisplay = `${remainingMinutes}M ${remainingSeconds}S`;
                            } else {
                              timeDisplay = `${remainingSeconds}S`;
                            }
                          }
                          
                          return (
                            <div
                              key={dossier.id.toString()}
                              className="border-2 border-gray-300 bg-white hover:border-gray-800 hover:shadow-lg transition-all duration-200"
                            >
                              {/* Card Header */}
                              <div className="border-b border-gray-200 p-4">
                                <h3 className="editorial-header text-base font-bold text-gray-900 leading-tight mb-3" title={dossier.name.replace('Encrypted file: ', '')}>
                                  {(() => {
                                    const displayName = dossier.name.replace('Encrypted file: ', '');
                                    return displayName.length > 40 ? `${displayName.substring(0, 40)}...` : displayName;
                                  })()}
                                </h3>
                                <div className="flex justify-end items-start">
                                  <div className={`editorial-body text-xs font-semibold px-2 py-1 border ${
                                    (() => {
                                      // First check if document is deactivated
                                      if (!dossier.isActive) {
                                        return 'border-gray-400 text-gray-600 bg-gray-100';
                                      }
                                      
                                      // Then check if expired by time calculation (only for active documents)
                                      const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
                                      const intervalMs = Number(dossier.checkInInterval) * 1000;
                                      const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
                                      const remainingMs = intervalMs - timeSinceLastCheckIn;
                                      const isTimeExpired = remainingMs <= 0;
                                      
                                      if (isTimeExpired) {
                                        return 'border-red-600 text-red-700 bg-red-50';
                                      } else {
                                        return 'border-green-600 text-green-700 bg-green-50';
                                      }
                                    })()
                                  }`}>
                                    {(() => {
                                      // First check if document is deactivated
                                      if (!dossier.isActive) {
                                        return 'Deactivated';
                                      }
                                      
                                      // Then check if expired by time calculation (only for active documents)
                                      const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
                                      const intervalMs = Number(dossier.checkInInterval) * 1000;
                                      const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
                                      const remainingMs = intervalMs - timeSinceLastCheckIn;
                                      const isTimeExpired = remainingMs <= 0;
                                      
                                      if (isTimeExpired) {
                                        return 'Expired';
                                      } else {
                                        return 'Active';
                                      }
                                    })()}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Card Body */}
                              <div className="p-4">
                                {/* Time Remaining - Most Prominent */}
                                <div className="text-center mb-4">
                                  <div className="editorial-body text-xs text-gray-500 mb-1">TIME REMAINING</div>
                                  <div className={`editorial-header text-2xl font-bold ${timeColor} font-mono tracking-wide`}>
                                    {timeDisplay}
                                  </div>
                                </div>
                                
                                {/* Details Grid */}
                                <div className="grid grid-cols-2 gap-4 text-center border-t border-gray-200 pt-4">
                                  <div>
                                    <div className="editorial-body text-xs text-gray-500">INTERVAL</div>
                                    <div className="editorial-body text-sm font-bold text-gray-900 font-mono">
                                      {Number(dossier.checkInInterval / BigInt(60))}M
                                    </div>
                                  </div>
                                  <div>
                                    <div className="editorial-body text-xs text-gray-500">RECIPIENTS</div>
                                    <div className="editorial-body text-sm font-bold text-gray-900">
                                      {dossier.recipients.length}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="text-center mt-4 pt-4 border-t border-gray-200">
                                  <div className="editorial-body text-xs text-gray-500">LAST CHECK-IN</div>
                                  <div className="editorial-body text-xs font-mono text-gray-600">
                                    {new Date(Number(dossier.lastCheckIn) * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(Number(dossier.lastCheckIn) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Card Footer - Action Buttons */}
                              <div className="border-t border-gray-200 p-4">
                                <div className="space-y-2">
                                  {/* Top Row - Check In and Deactivate */}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={async () => {
                                        try {
                                          await ContractService.checkIn(dossier.id);
                                          await loadUserDossiers();
                                          setActivityLog(prev => [
                                            { 
                                              type: `Check-in performed for document #${dossier.id.toString()}`, 
                                              date: new Date().toLocaleString() 
                                            },
                                            ...prev
                                          ]);
                                        } catch (error) {
                                          console.error('Failed to check in:', error);
                                          toast.error('Failed to check in. Please try again.');
                                        }
                                      }}
                                      disabled={!dossier.isActive}
                                      className={`flex-1 editorial-body text-xs px-3 py-2 border-2 font-bold transition-colors ${
                                        dossier.isActive 
                                          ? 'border-gray-900 text-gray-900 bg-white hover:bg-gray-800 hover:!text-white hover:[&>*]:!text-white' 
                                          : 'border-gray-300 text-gray-500 bg-gray-100 cursor-not-allowed'
                                      }`}
                                    >
                                      CHECK IN
                                    </button>
                                    
                                    <button
                                      onClick={async () => {
                                        try {
                                          if (dossier.isActive) {
                                            await ContractService.deactivateDossier(dossier.id);
                                          } else {
                                            await ContractService.reactivateDossier(dossier.id);
                                          }
                                          await loadUserDossiers();
                                          setActivityLog(prev => [
                                            { 
                                              type: `Document #${dossier.id.toString()} ${dossier.isActive ? 'deactivated' : 'resumed'}`, 
                                              date: new Date().toLocaleString() 
                                            },
                                            ...prev
                                          ]);
                                        } catch (error) {
                                          console.error('Failed to toggle document status:', error);
                                          toast.error('Failed to update document status. Please try again.');
                                        }
                                      }}
                                      className="flex-1 editorial-body text-xs px-3 py-2 border-2 border-gray-400 text-gray-600 hover:border-gray-600 hover:text-gray-700 font-bold transition-colors"
                                    >
                                      {dossier.isActive ? 'DEACTIVATE' : 'RESUME'}
                                    </button>
                                  </div>
                                  
                                  {/* Bottom Row - Decrypt (Full Width) */}
                                  {(() => {
                                    // Check if document is expired based on time calculation
                                    const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
                                    const intervalMs = Number(dossier.checkInInterval) * 1000;
                                    const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
                                    const remainingMs = intervalMs - timeSinceLastCheckIn;
                                    const isTimeExpired = remainingMs <= 0;
                                    
                                    // Show decrypt button if document is expired OR contract says it's decryptable, AND has files
                                    const shouldShowButton = (isTimeExpired || dossier.isDecryptable) && dossier.encryptedFileHashes.length > 0;
                                    
                                    console.log(`🔍 Decrypt button check for dossier #${dossier.id.toString()}: isTimeExpired=${isTimeExpired}, isDecryptable=${dossier.isDecryptable}, fileHashes=${dossier.encryptedFileHashes.length}, showButton=${shouldShowButton}`);
                                    return shouldShowButton;
                                  })() ? (
                                    <button
                                      onClick={async () => {
                                        let decryptToast: any;
                                        try {
                                          console.log('🔓 Attempting decryption for dossier:', dossier.id.toString());
                                          console.log('📄 Dossier details:', {
                                            id: dossier.id.toString(),
                                            name: dossier.name,
                                            fileHashes: dossier.encryptedFileHashes.length,
                                            recipients: dossier.recipients.length,
                                            isActive: dossier.isActive
                                          });
                                          
                                          // Use dossier's encrypted file data directly
                                          if (dossier.encryptedFileHashes.length > 0) {
                                            // Perform real decryption from stored file hash
                                            const fileHash = dossier.encryptedFileHashes[0];
                                              if (!fileHash) {
                                                throw new Error('No encrypted file hash found in dossier');
                                              }
                                              
                                              console.log('🔓 Attempting to decrypt expired document...');
                                              decryptToast = toast.loading('Decrypting expired document...');
                                              
                                              // Step 1: Fetch encrypted data from IPFS
                                              const ipfsHash = fileHash.replace('ipfs://', '');
                                              const ipfsGateways = [
                                                `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
                                                `https://ipfs.io/ipfs/${ipfsHash}`,
                                                `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
                                              ];
                                              
                                              let retrievedData: Uint8Array | null = null;
                                              let gatewayUsed = '';
                                              
                                              for (const gateway of ipfsGateways) {
                                                try {
                                                  console.log(`🌐 Trying IPFS gateway: ${gateway}`);
                                                  const response = await fetch(gateway);
                                                  if (response.ok) {
                                                    const arrayBuffer = await response.arrayBuffer();
                                                    retrievedData = new Uint8Array(arrayBuffer);
                                                    gatewayUsed = gateway;
                                                    console.log(`✅ Retrieved ${retrievedData.length} bytes from ${gateway}`);
                                                    console.log(`🔍 First 50 bytes:`, Array.from(retrievedData.slice(0, 50)));
                                                    break;
                                                  }
                                                } catch (error) {
                                                  console.log(`❌ Gateway ${gateway} failed:`, error);
                                                  continue;
                                                }
                                              }
                                              
                                              if (!retrievedData) {
                                                throw new Error('Failed to fetch encrypted data from all IPFS gateways');
                                              }
                                              
                                              // Step 2: Verify and reconstruct messageKit
                                              console.log(`🔍 Data verification:`);
                                              console.log(`   - File hash: ${fileHash}`);
                                              console.log(`   - IPFS hash: ${ipfsHash}`);
                                              console.log(`   - Gateway used: ${gatewayUsed}`);
                                              console.log(`   - Data length: ${retrievedData.length} bytes`);
                                              console.log(`   - Data type: ${Object.prototype.toString.call(retrievedData)}`);
                                              
                                                                                           // Step 2a: Initialize TACo before reconstruction
                                              console.log(`🔧 Initializing TACo...`);
                                              const { tacoService } = await import('./lib/taco');
                                              await tacoService.initialize();
                                              console.log(`✅ TACo initialized`);
                                              
                                              // Step 2b: Import and reconstruct MessageKit  
                                              const { ThresholdMessageKit } = await import('@nucypher/taco');
                                              console.log(`🔍 Attempting to reconstruct MessageKit from ${retrievedData.length} bytes...`);
                                              
                                              const messageKit = ThresholdMessageKit.fromBytes(retrievedData);
                                              console.log(`✅ MessageKit reconstructed successfully`);
                                              
                                              // Step 3: Decrypt using TACo  
                                              const decryptedData = await tacoService.decryptFile(messageKit);
                                              
                                              // Step 4: Download the decrypted file
                                              const originalFileName = dossier.name.replace('Encrypted file: ', '') || 'decrypted-document';
                                              const blob = new Blob([decryptedData]);
                                              const url = URL.createObjectURL(blob);
                                              
                                              const link = document.createElement('a');
                                              link.href = url;
                                              link.download = originalFileName;
                                              document.body.appendChild(link);
                                              link.click();
                                              document.body.removeChild(link);
                                              URL.revokeObjectURL(url);
                                              
                                              toast.success('🎉 Document decrypted and downloaded successfully!', { id: decryptToast });
                                              
                                              setActivityLog(prev => [
                                                { 
                                                  type: `🔓 Document #${dossier.id.toString()} decrypted and downloaded`, 
                                                  date: new Date().toLocaleString() 
                                                },
                                                ...prev
                                              ]);
                                          } else {
                                            toast.error(`No encrypted files found in this dossier. Dossier #${dossier.id.toString()} appears to be empty or corrupted.`);
                                          }
                                        } catch (error) {
                                          console.error('❌ Failed to decrypt:', error);
                                          
                                          let errorMessage = 'Failed to decrypt document. ';
                                          if (error instanceof Error) {
                                            if (error.message.includes('Failed to fetch encrypted data')) {
                                              errorMessage += 'Could not retrieve file from IPFS. The file may be unavailable.';
                                            } else if (error.message.includes('fromBytes')) {
                                              errorMessage += 'Invalid encrypted file format.';
                                            } else if (error.message.includes('decrypt')) {
                                              errorMessage += 'Decryption failed. The time condition may not be met yet.';
                                            } else {
                                              errorMessage += error.message;
                                            }
                                          } else {
                                            errorMessage += 'Unknown error occurred.';
                                          }
                                          
                                          toast.error(errorMessage, { id: decryptToast });
                                          
                                          setActivityLog(prev => [
                                            { 
                                              type: `❌ Decryption failed for document #${dossier.id.toString()}`, 
                                              date: new Date().toLocaleString() 
                                            },
                                            ...prev
                                          ]);
                                        }
                                      }}
                                      className="w-full editorial-body text-xs px-3 py-2 border-2 border-red-600 text-red-700 hover:bg-red-600 hover:text-white font-bold transition-colors"
                                    >
                                      DECRYPT
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                                                })}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Document Creation Flow - Full Screen
            <div className="border-2 border-gray-800 mb-12">
              <div className="bg-gray-800 p-3">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      // Reset form when going back
                      setCurrentStep(1);
                      setEncryptedCapsule(null);
                      setTraceJson(null);
                      setUploadedFile(null);
                      setName('');
                      setEmergencyContacts(['']);
                      setReleaseMode('public');
                    }}
                    style={{color: '#ffffff'}}
                    className="editorial-body text-xs font-bold hover:text-gray-300 transition-colors"
                  >
                    ← BACK TO DOCUMENTS
                  </button>
                  <h3 style={{color: '#ffffff'}} className="editorial-header text-sm tracking-[0.2em] font-bold">Document Creation</h3>
                  <div className="w-24"></div> {/* Spacer for center alignment */}
                </div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm p-6">
                {/* Progress Indicator */}
                <div className="mb-8">
                  {/* Back Button */}
                  {currentStep > 1 && !traceJson && (
                    <div className="mb-4">
                      <button
                        onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                        className="flex items-center text-gray-600 hover:text-gray-900 editorial-body text-sm font-semibold transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Previous Step
                      </button>
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <div className="relative">
                      {/* Background lines - full width */}
                      <div className="absolute top-5 left-5 right-5 h-1 bg-gray-300"></div>
                      
                      {/* Progress lines */}
                      <div className="absolute top-5 left-5 right-5 h-1 flex">
                        {[1, 2, 3, 4, 5, 6].map((segment) => (
                          <div key={segment} className="flex-1 relative">
                            <div className={`h-1 absolute top-0 left-0 transition-all duration-500 ${
                              segment < currentStep ? 'w-full bg-green-600' :
                              segment === currentStep ? 'w-1/2 bg-gray-900' :
                              'w-0 bg-gray-300'
                            }`}></div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Steps container */}
                      <div className="flex items-start justify-between relative z-10">
                        {[1, 2, 3, 4, 5, 6].map((step) => (
                          <div key={step} className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                              step === currentStep ? 'bg-gray-900 text-white border-gray-900 shadow-lg scale-110' :
                              step < currentStep ? 'bg-green-600 text-white border-green-600 shadow-md' :
                              'bg-white text-gray-600 border-gray-300 shadow-sm'
                            }`}>
                              {step < currentStep ? '✓' : step}
                            </div>
                            <div className="mt-2 text-xs editorial-body font-medium text-gray-600 text-center w-16">
                              {step === 1 ? 'Name' :
                               step === 2 ? 'Upload' :
                               step === 3 ? 'Interval' :
                               step === 4 ? 'Mode' :
                               step === 5 ? 'Review' :
                               'Finalize'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="editorial-body text-sm text-gray-600">
                      Step {currentStep} of 6: {
                        currentStep === 1 ? 'Document Name' :
                        currentStep === 2 ? 'File Upload' :
                        currentStep === 3 ? 'Check-in Frequency' :
                        currentStep === 4 ? 'Release Mode' :
                        currentStep === 5 ? 'Review & Encrypt' :
                        'Finalize & Upload'
                      }
                    </p>
                  </div>
                </div>

                {/* Step Content */}
                <div className="min-h-[300px]">
                  {/* Step 1: Document Name */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <h3 className="editorial-header text-xl font-bold mb-2">Name Your Document</h3>
                        <p className="editorial-body text-sm text-gray-600">
                          Give your encrypted document a memorable name for easy identification
                        </p>
                      </div>
                      <div className="max-w-md mx-auto">
                        <input
                          type="text"
                          placeholder="Enter document name..."
                          className="w-full border-2 border-gray-300 p-4 editorial-body text-base focus:border-gray-900 focus:outline-none rounded"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          autoFocus
                        />
                        <p className="editorial-body text-xs text-gray-500 mt-2 text-center">
                          This name will help you identify the document later
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 2: File Upload */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <h3 className="editorial-header text-xl font-bold mb-2">Upload Your File</h3>
                        <p className="editorial-body text-sm text-gray-600">
                          Select the file you want to encrypt and protect with the deadman switch
                        </p>
                      </div>
                      <div className="max-w-lg mx-auto">
                        <div
                          className="border-2 border-dashed border-gray-400 text-center py-12 cursor-pointer hover:border-gray-900 transition-colors bg-gray-50 rounded"
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="mx-auto mb-4 text-gray-600" size={48} />
                          <p className="editorial-body text-base font-semibold text-gray-700 mb-2">
                            {uploadedFile ? uploadedFile.name : 'Drop your file here'}
                          </p>
                          <p className="editorial-body text-sm text-gray-500">
                            {uploadedFile ? 'File ready for encryption' : 'Click to browse or drag and drop'}
                          </p>
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Check-in Frequency */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <h3 className="editorial-header text-xl font-bold mb-2">Set Check-in Frequency</h3>
                        <p className="editorial-body text-sm text-gray-600">
                          How often do you need to check in to prevent the document from being released?
                        </p>
                      </div>
                      <div className="max-w-md mx-auto">
                        <select 
                          className="w-full border-2 border-gray-300 p-4 editorial-body text-base focus:border-gray-900 focus:outline-none font-mono rounded"
                          value={checkInInterval}
                          onChange={(e) => setCheckInInterval(e.target.value)}
                        >
                          {intervalOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="editorial-body text-xs text-gray-500 mt-2 text-center">
                          The document will be released automatically if no check-in is received within this timeframe
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Release Mode */}
                  {currentStep === 4 && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <h3 className="editorial-header text-xl font-bold mb-2">Choose Release Mode</h3>
                        <p className="editorial-body text-sm text-gray-600">
                          How should your document be released if the deadman switch is triggered?
                        </p>
                      </div>
                      <div className="max-w-lg mx-auto space-y-4">
                        <div 
                          className={`border-2 p-4 rounded cursor-pointer transition-all ${
                            releaseMode === 'public' ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                          }`}
                          onClick={() => setReleaseMode('public')}
                        >
                          <div className="flex items-start">
                            <div className={`w-5 h-5 rounded-full border-2 mr-3 mt-0.5 ${
                              releaseMode === 'public' ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                            }`}>
                              {releaseMode === 'public' && <div className="w-full h-full rounded-full bg-white scale-50"></div>}
                            </div>
                            <div>
                              <h4 className="editorial-body font-bold text-base">Public Release</h4>
                              <p className="editorial-body text-sm text-gray-600 mt-1">
                                Document will be made publicly accessible when triggered
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          className={`border-2 p-4 rounded cursor-pointer transition-all ${
                            releaseMode === 'contacts' ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                          }`}
                          onClick={() => setReleaseMode('contacts')}
                        >
                          <div className="flex items-start">
                            <div className={`w-5 h-5 rounded-full border-2 mr-3 mt-0.5 ${
                              releaseMode === 'contacts' ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                            }`}>
                              {releaseMode === 'contacts' && <div className="w-full h-full rounded-full bg-white scale-50"></div>}
                            </div>
                            <div className="flex-1">
                              <h4 className="editorial-body font-bold text-base">Emergency Contacts</h4>
                              <p className="editorial-body text-sm text-gray-600 mt-1 mb-3">
                                Document will be sent to specific people when triggered
                              </p>
                              {releaseMode === 'contacts' && (
                                <div className="space-y-2">
                                  {emergencyContacts.map((contact, index) => (
                                    <div key={index} className="flex gap-2">
                                      <input
                                        type="text"
                                        placeholder="Email address or Ethereum address"
                                        className="flex-1 border border-gray-300 p-2 editorial-body text-sm focus:border-gray-900 focus:outline-none rounded"
                                        value={contact}
                                        onChange={(e) => {
                                          const newContacts = [...emergencyContacts];
                                          newContacts[index] = e.target.value;
                                          setEmergencyContacts(newContacts);
                                        }}
                                      />
                                      {emergencyContacts.length > 1 && (
                                        <button
                                          onClick={() => {
                                            const newContacts = emergencyContacts.filter((_, i) => i !== index);
                                            setEmergencyContacts(newContacts);
                                          }}
                                          className="px-3 py-2 border border-red-300 text-red-600 hover:border-red-500 rounded editorial-body text-sm"
                                        >
                                          Remove
                                        </button>
                                      )}
    </div>
                                  ))}
                                  <button
                                    onClick={() => setEmergencyContacts([...emergencyContacts, ''])}
                                    className="text-sm editorial-body text-gray-600 hover:text-gray-900"
                                  >
                                    + Add another contact
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Review & Encrypt */}
                  {currentStep === 5 && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <h3 className="editorial-header text-xl font-bold mb-2">Review & Encrypt</h3>
                        <p className="editorial-body text-sm text-gray-600">
                          Please review your settings before encrypting the document
                        </p>
                      </div>
                      <div className="max-w-lg mx-auto space-y-4">
                        <div className="border border-gray-300 rounded p-4 space-y-3">
                          <div className="flex justify-between">
                            <span className="editorial-body text-sm font-semibold">Document Name:</span>
                            <span className="editorial-body text-sm text-gray-700">{name || 'Untitled'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="editorial-body text-sm font-semibold">File:</span>
                            <span className="editorial-body text-sm text-gray-700">{uploadedFile?.name || 'No file selected'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="editorial-body text-sm font-semibold">Check-in Frequency:</span>
                            <span className="editorial-body text-sm text-gray-700">
                              {intervalOptions.find(opt => opt.value === checkInInterval)?.label}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="editorial-body text-sm font-semibold">Release Mode:</span>
                            <span className="editorial-body text-sm text-gray-700">
                              {releaseMode === 'public' ? 'Public Release' : 'Emergency Contacts'}
                            </span>
                          </div>
                          {releaseMode === 'contacts' && (
                            <div className="pt-2 border-t border-gray-200">
                              <span className="editorial-body text-sm font-semibold block mb-2">Emergency Contacts:</span>
                              {emergencyContacts.filter(c => c.trim()).map((contact, index) => (
                                <div key={index} className="editorial-body text-sm text-gray-700 pl-4">
                                  • {contact}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Encrypt Button */}
                        <div className="space-y-3">
                          {!encryptedCapsule && (
                            <button
                              onClick={processCanaryTrigger}
                              disabled={!uploadedFile || isProcessing || !name.trim()}
                              className="w-full bg-white text-gray-900 border-4 border-gray-900 hover:bg-gray-800 hover:!text-white hover:[&>*]:!text-white disabled:opacity-50 disabled:cursor-not-allowed py-8 editorial-header text-xl font-bold tracking-[0.15em] shadow-xl transform hover:scale-105 transition-all duration-200 uppercase"
                            >
                              {isProcessing ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-3"></div>
                                  Encrypting...
                                </div>
                              ) : (
                                <>
                                  <Shield className="inline mr-3" size={28} />
                                  Encrypt
                                </>
                              )}
                            </button>
                          )}



                          {/* Reset Button - shown after everything is complete */}
                          {traceJson && (
                            <button
                              onClick={() => {
                                setCurrentStep(1);
                                setEncryptedCapsule(null);
                                setTraceJson(null);
                                setUploadedFile(null);
                                setName('');
                                setEmergencyContacts(['']);
                                setReleaseMode('public');
                              }}
                              className="w-full border-2 border-gray-400 text-gray-600 hover:border-gray-900 hover:text-gray-900 py-4 editorial-body font-semibold transition-all duration-200 rounded"
                            >
                              Create New Document
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 6 && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <h3 className="editorial-header text-xl font-bold mb-2">Finalize & Upload</h3>
                        <p className="editorial-body text-sm text-gray-600">
                          This is the final step. Your document will be encrypted, uploaded, and registered on the blockchain.
                        </p>
                      </div>
                      <div className="max-w-lg mx-auto space-y-4">
                        <div className="border border-gray-300 rounded p-4 space-y-3">
                          <div className="flex justify-between">
                            <span className="editorial-body text-sm font-semibold">Document Name:</span>
                            <span className="editorial-body text-sm text-gray-700">{name || 'Untitled'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="editorial-body text-sm font-semibold">File:</span>
                            <span className="editorial-body text-sm text-gray-700">{uploadedFile?.name || 'No file selected'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="editorial-body text-sm font-semibold">Check-in Frequency:</span>
                            <span className="editorial-body text-sm text-gray-700">
                              {intervalOptions.find(opt => opt.value === checkInInterval)?.label}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="editorial-body text-sm font-semibold">Release Mode:</span>
                            <span className="editorial-body text-sm text-gray-700 capitalize">{releaseMode}</span>
                          </div>
                        </div>
                        <button
                          onClick={processCanaryTrigger}
                          disabled={isProcessing}
                          className="w-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed py-4 editorial-body font-semibold transition-all duration-200 rounded"
                        >
                          {isProcessing ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                              Finalizing document...
                            </div>
                          ) : (
                            'Finalize & Upload'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                {currentStep < 6 && !traceJson && (
                  <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                      disabled={currentStep === 1}
                      className="px-6 py-2 border-2 border-gray-300 text-gray-600 hover:border-gray-500 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed editorial-body font-semibold transition-colors rounded"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => {
                        if (currentStep === 1 && !name.trim()) {
                          toast.error('Please enter a document name');
                          return;
                        }
                        if (currentStep === 2 && !uploadedFile) {
                          toast.error('Please upload a file');
                          return;
                        }
                        if (currentStep === 4 && releaseMode === 'contacts' && !emergencyContacts.some(c => c.trim())) {
                          toast.error('Please add at least one emergency contact');
                          return;
                        }
                        setCurrentStep(Math.min(6, currentStep + 1));
                      }}
                      className="px-6 py-2 bg-gray-900 text-white hover:bg-gray-800 hover:!text-white hover:[&>*]:!text-white editorial-body font-semibold transition-colors rounded"
                    >
                      {currentStep === 5 ? 'Finalize' : 'Next'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

        
      </div>
    </>
  );
}
