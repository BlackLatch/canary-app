'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Shield, Download, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { encryptFileWithCondition, commitEncryptedFileToPinata, DeadmanCondition, TraceJson } from './lib/taco';
import Onboarding from './components/Onboarding';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { polygonAmoy } from 'wagmi/chains';
import { Address } from 'viem';
import { ContractService, CANARY_DOSSIER_ADDRESS, Dossier } from './lib/contract';
import toast, { Toaster } from 'react-hot-toast';

export default function Home() {
  const { connectors, connect, isPending } = useConnect();
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  // Removed userProfile - using dossier-only storage model
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [checkInInterval, setCheckInInterval] = useState('60'); // Default to 1 hour in minutes
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [traceJson, setTraceJson] = useState<TraceJson | null>(null);
  const [encryptedCapsule, setEncryptedCapsule] = useState<any>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const [userDossiers, setUserDossiers] = useState<Dossier[]>([]);
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
    encryptionType: 'real';
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update current time every second for real-time countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
    if (!uploadedFile) return;
    
    setIsProcessing(true);
    
    const encryptionToast = toast.loading('Encrypting file with TACo...');
    
    try {
      const condition: DeadmanCondition = {
        type: 'no_checkin',
        duration: `${checkInInterval} MINUTES`
      };

      // Encrypt the file with TACo (no upload yet)
      const encryptionResult = await encryptFileWithCondition(
        uploadedFile,
        condition,
        description
      );
      
      setEncryptedCapsule(encryptionResult);
      
      // Add to uploads table
      const uploadId = `upload-${Date.now()}`;
      setUploads(prev => [...prev, {
        id: uploadId,
        filename: uploadedFile.name,
        status: 'encrypted',
        storageType: 'codex', // Will be updated when committed
        encryptionType: 'real',
        createdAt: new Date()
      }]);
      
      // Add to activity log
      setActivityLog(prev => [
        { type: 'File encrypted with TACo', date: new Date().toLocaleString() },
        ...prev
      ]);
      
      toast.success('File encrypted successfully!', { id: encryptionToast });
      
    } catch (error) {
      console.error('Error encrypting file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown encryption error';
      
      toast.error(`Encryption failed: ${errorMessage}`, { id: encryptionToast });
      
      setActivityLog(prev => [
        { type: 'File encryption failed', date: new Date().toLocaleString() },
        ...prev
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const commitToCodex = async () => {
    if (!encryptedCapsule) return;
    
    setIsCommitting(true);
    
    const commitToast = toast.loading('Committing to storage and blockchain...');
    
    try {
      console.log('🔗 Starting integrated commit: storage + on-chain dossier...');
      
      // Step 1: Commit to storage (Codex/IPFS/etc)
      const { commitResult, traceJson: newTraceJson } = await commitEncryptedFileToPinata(encryptedCapsule);
      
      console.log('📦 Storage commit result:', commitResult);
      console.log('📄 Generated traceJson:', newTraceJson);
      console.log('🔗 File hash to be stored on-chain:', newTraceJson.payload_uri);
      
      // Store trace JSON for download
      setTraceJson(newTraceJson);
      
      // Step 2: Create dossier on-chain if connected
      let dossierId: bigint | null = null;
      let contractTxHash: string | null = null;
      
      if (isConnected && address) {
        console.log('📝 Creating dossier on Polygon Amoy contract...');
        
        // Validate prerequisites
        console.log('🔍 Pre-flight checks:');
        console.log('   - Wallet connected:', isConnected);
        console.log('   - Address:', address);
        console.log('   - Chain ID:', chainId);
        console.log('   - Target chain:', polygonAmoy.id);
        console.log('   - IPFS hash:', newTraceJson.payload_uri);
        
        // Check if we're on the right network
        if (chainId !== polygonAmoy.id) {
          console.warn('⚠️ Wrong network! Please switch to Polygon Amoy');
          toast.error('Please switch to Polygon Amoy network in your wallet');
          return;
        }
        
        const dossierName = `Encrypted file: ${encryptedCapsule.originalFileName}`;
        const checkInMinutes = parseInt(checkInInterval);
        const recipients = [address]; // For now, only the creator is a recipient
        const fileHashes = [newTraceJson.payload_uri];
        
        console.log('🎯 Contract creation parameters:');
        console.log('   - Name:', dossierName);
        console.log('   - Check-in interval:', checkInMinutes, 'minutes');
        console.log('   - Recipients:', recipients);
        console.log('   - File hashes:', fileHashes);
        console.log('   - First file hash:', fileHashes[0]);
        
        // Validate that we have a proper file hash
        if (!fileHashes[0] || fileHashes[0] === 'undefined' || fileHashes[0] === '') {
          throw new Error(`Invalid file hash: ${fileHashes[0]}. Storage upload may have failed.`);
        }
        
        try {
          // Create dossier on-chain
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
          console.log('📍 Contract:', CANARY_DOSSIER_ADDRESS);
          console.log('🆔 Dossier ID:', dossierId.toString());
          console.log('🔗 Tx Hash:', contractTxHash);
          
          // Verify what actually got stored on-chain
          try {
            console.log('🔍 Verifying on-chain data...');
            // Wait a moment for transaction to be fully processed
            await new Promise(resolve => setTimeout(resolve, 2000));
            const createdDossier = await ContractService.getDossier(address as Address, dossierId);
            console.log('📋 Stored dossier data:');
            console.log('   - Name:', createdDossier.name);
            console.log('   - File hashes count:', createdDossier.encryptedFileHashes.length);
            console.log('   - File hashes:', createdDossier.encryptedFileHashes);
            console.log('   - Recipients:', createdDossier.recipients);
            
            // Check if the IPFS hash was stored correctly
            if (createdDossier.encryptedFileHashes.length === 0) {
              console.error('❌ WARNING: No file hashes stored on-chain!');
            } else if (createdDossier.encryptedFileHashes[0] !== newTraceJson.payload_uri) {
              console.error('❌ WARNING: Stored hash does not match uploaded hash!');
              console.error('   Expected:', newTraceJson.payload_uri);
              console.error('   Got:', createdDossier.encryptedFileHashes[0]);
            } else {
              console.log('✅ File hash verification successful!');
            }
          } catch (verifyError) {
            console.error('❌ Failed to verify on-chain data:', verifyError);
          }
          
          // Load updated dossiers
          await loadUserDossiers();
          
          setActivityLog(prev => [
            { type: `Dossier #${dossierId?.toString()} created on Polygon Amoy`, date: new Date().toLocaleString() },
            ...prev
          ]);
          
        } catch (error) {
          console.error('❌ Failed to create dossier:', error);
          
          // More detailed error analysis
          if (error instanceof Error) {
            console.error('❌ Error details:');
            console.error('   - Name:', error.name);
            console.error('   - Message:', error.message);
            console.error('   - Stack:', error.stack);
            
            // Check for specific error types
            if (error.message.includes('Network connection issue')) {
              console.error('   - Issue: Network/RPC connection problem');
              console.error('   - Solution: Check wallet connection and network');
            } else if (error.message.includes('Internal JSON-RPC error')) {
              console.error('   - Issue: Wallet/RPC communication error');
              console.error('   - Solution: Try switching networks or refreshing');
            } else if (error.message.includes('user rejected')) {
              console.error('   - Issue: User rejected transaction');
            } else if (error.message.includes('insufficient funds')) {
              console.error('   - Issue: Insufficient funds for gas');
            }
          }
          
          console.error('❌ Failed to create on-chain dossier:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toast.error(`Failed to create dossier: ${errorMessage}`, { id: commitToast });
          
          setActivityLog(prev => [
            { type: 'On-chain dossier creation failed (storage still committed)', date: new Date().toLocaleString() },
            ...prev
          ]);
        }
      }
      
      // Update uploads table - mark most recent upload as committed
      setUploads(prev => prev.map((upload, index) => 
        index === prev.length - 1 ? {
          ...upload,
          status: 'committed' as const,
          storageType: commitResult.storageType,
          payloadUri: commitResult.payloadUri,
          contractDossierId: dossierId?.toString(),
          contractTxHash: contractTxHash || undefined
        } : upload
      ));
      
      // Add to activity log
      setActivityLog(prev => [
        { type: `File committed to ${commitResult.storageType}`, date: new Date().toLocaleString() },
        ...prev
      ]);
      
      toast.success('File committed successfully!', { id: commitToast });
      
    } catch (error) {
      console.error('Error in integrated commit:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown commit error';
      
      toast.error(`Commit failed: ${errorMessage}`, { id: commitToast });
      
      setActivityLog(prev => [
        { type: 'File commit failed', date: new Date().toLocaleString() },
        ...prev
      ]);
    } finally {
      setIsCommitting(false);
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
      toast.error(`❌ Decryption test failed: ${errorMessage}. Check console for details.`);
      
      // Add to activity log
      setActivityLog(prev => [
        { type: 'TACo decryption test failed', date: new Date().toLocaleString() },
        ...prev
      ]);
    }
  };

  // Load user's dossiers from contract
  const loadUserDossiers = async () => {
    if (!isConnected || !address) return;
    
    try {
      console.log('📋 Loading user dossiers from contract...');
      const dossierIds = await ContractService.getUserDossierIds(address as Address);
      
      const dossiers: Dossier[] = [];
      for (const id of dossierIds) {
        const dossier = await ContractService.getDossier(address as Address, id);
        dossiers.push(dossier);
      }
      
      setUserDossiers(dossiers);
      console.log(`✅ Loaded ${dossiers.length} dossiers`);
      
    } catch (error) {
      console.error('❌ Failed to load dossiers:', error);
    }
  };

  const handleCheckIn = async () => {
    const now = new Date();
    
    // Check in on-chain if wallet connected and dossiers exist
    if (isConnected && address && currentDossierId !== null) {
      try {
        console.log('✅ Performing on-chain check-in...');
        const txHash = await ContractService.checkInAll(); // Check in for all dossiers
        
        setActivityLog(prev => [
          { type: 'On-chain check-in successful', date: now.toLocaleString() },
          ...prev
        ]);
        
        // Reload dossiers to get updated lastCheckIn times
        await loadUserDossiers();
        
      } catch (error) {
        console.error('❌ On-chain check-in failed:', error);
        setActivityLog(prev => [
          { type: 'On-chain check-in failed (local check-in recorded)', date: now.toLocaleString() },
          ...prev
        ]);
      }
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
    if (isConnected && userDossiers.length > 0) {
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
    if (isConnected && userDossiers.length === 0) {
      return 'No documents created yet';
    }
    
    // If not connected, show disconnected status
    return 'Wallet not connected';
  };

  const getRemainingTime = () => {
    // If connected and have dossiers, use actual on-chain data
    if (isConnected && userDossiers.length > 0) {
      let shortestRemainingMs = Number.MAX_SAFE_INTEGER;
      let hasActiveDossiers = false;
      
      // Find the dossier with the shortest remaining time
      for (const dossier of userDossiers) {
        if (!dossier.isActive) continue;
        
        hasActiveDossiers = true;
        const lastCheckInMs = Number(dossier.lastCheckIn) * 1000; // Convert to milliseconds
        const intervalMs = Number(dossier.checkInInterval) * 1000; // Convert to milliseconds
        const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
        const remainingMs = intervalMs - timeSinceLastCheckIn;
        
        if (remainingMs < shortestRemainingMs) {
          shortestRemainingMs = remainingMs;
        }
      }
      
      // If no active dossiers, show inactive status
      if (!hasActiveDossiers) {
        return { expired: false, display: 'NO ACTIVE DOSSIERS', color: 'text-gray-500' };
      }
      
      // Check if expired
      if (shortestRemainingMs <= 0) {
        return { expired: true, display: 'EXPIRED', color: 'text-red-600' };
      }
      
      // Format remaining time
      const remainingHours = Math.floor(shortestRemainingMs / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((shortestRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const remainingSeconds = Math.floor((shortestRemainingMs % (1000 * 60)) / 1000);
      
      // Color coding based on urgency
      let color = 'text-green-600';
      if (shortestRemainingMs < 5 * 60 * 1000) { // Less than 5 minutes
        color = 'text-red-600';
      } else if (shortestRemainingMs < 30 * 60 * 1000) { // Less than 30 minutes
        color = 'text-orange-500';
      } else if (shortestRemainingMs < 2 * 60 * 60 * 1000) { // Less than 2 hours
        color = 'text-yellow-600';
      }
      
      // Format display string
      let display = '';
      if (remainingHours > 0) {
        display = `${remainingHours}h ${remainingMinutes}m`;
      } else if (remainingMinutes > 0) {
        display = `${remainingMinutes}m ${remainingSeconds}s`;
      } else {
        display = `${remainingSeconds}s`;
      }
      
      return { expired: false, display, color };
    }
    
    // If connected but no dossiers, suspend countdown
    if (isConnected && userDossiers.length === 0) {
      return { expired: false, display: 'SUSPENDED', color: 'text-gray-500' };
    }
    
    // If not connected, show disconnected status
    return { expired: false, display: 'DISCONNECTED', color: 'text-gray-500' };
  };

  const handleOnboardingComplete = (userChoices: Record<string, string>) => {
    setOnboardingComplete(true);
    
    // Set default check-in interval based on user's risk level
    if (userChoices.risk === 'Immediate danger') {
      setCheckInInterval('1');
    } else if (userChoices.risk === 'High risk') {
      setCheckInInterval('6');
    } else if (userChoices.risk === 'Moderate risk') {
      setCheckInInterval('12');
    } else if (userChoices.risk === 'Low risk') {
      setCheckInInterval('60'); // 1 hour for low risk
    } else {
      setCheckInInterval('1'); // Default to 1 minute for testing
    }
  };

  const handleSignIn = (method: string) => {
    console.log('Sign in method:', method);
    
    if (method === 'Web3 Wallet') {
      // Connect to the first available connector (usually MetaMask)
      const connector = connectors.find(c => c.id === 'metaMask') || connectors[0];
      if (connector) {
        connect({ connector });
      }
    } else {
      // For email sign-in, just simulate for now
      setSignedIn(true);
    }
  };

  // Clear wallet connection on page refresh/load
  useEffect(() => {
    if (isConnected) {
      console.log('🔌 Disconnecting wallet on page refresh...');
      disconnect();
      setSignedIn(false);
    }
  }, []); // Run only once on mount

  // Auto sign-in if wallet is already connected
  useEffect(() => {
    if (isConnected && !signedIn) {
      setSignedIn(true);
    }
  }, [isConnected, signedIn]);

  // Return to sign-in screen if wallet is disconnected
  useEffect(() => {
    if (!isConnected && signedIn) {
      setSignedIn(false);
    }
  }, [isConnected, signedIn]);

  // Load contract data when wallet connects
  useEffect(() => {
    if (isConnected && address) {
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
  }, [isConnected, address]);

  // Show onboarding if not completed
  if (!onboardingComplete) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Show sign-in page if onboarding complete but not signed in
  if (!signedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-8" style={{ zoom: '0.8' }}>
        <div className="max-w-2xl w-full text-center">
          {/* Canary wordmark */}
          <h1 className="editorial-header text-xl md:text-2xl tracking-[0.2em] mb-8 md:mb-12">CANARY</h1>

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
            >
              Sign in with Email
            </button>
          </div>

          <p className="editorial-body text-gray-600 mt-6 md:mt-8 text-sm md:text-base">
            Your truth protection starts now.
          </p>
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
    <div className="min-h-screen bg-gray-50" style={{ zoom: '0.8' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="editorial-header text-3xl tracking-[0.2em]">CANARY</h1>
          
          <div className="flex items-center gap-8">
            <nav className="flex gap-8">
              <a href="#" className="editorial-body font-semibold hover:text-blue-600">Home</a>
              <a href="#" className="editorial-body font-semibold hover:text-blue-600">Triggers</a>
              <a href="#" className="editorial-body font-semibold hover:text-blue-600">Settings</a>
            </nav>
            
            {/* Wallet Status */}
            {isConnected && address ? (
              <div className="flex items-center gap-3">
                <div className="editorial-body text-sm border-2 border-gray-300 px-3 py-2 rounded-lg bg-white">
                  <span className="text-green-600 font-semibold">●</span> {address.slice(0, 6)}...{address.slice(-4)}
                </div>
                <a 
                  href={`https://amoy.polygonscan.com/address/${CANARY_DOSSIER_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
                  className="editorial-body text-xs px-2 py-1 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                  title={`View contract on Polygon Amoy: ${CANARY_DOSSIER_ADDRESS}`}
                >
                  📋 Polygon Amoy Contract
                </a>
                <button
                  onClick={() => disconnect()}
                  className="editorial-body text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="editorial-body text-sm text-gray-500">
                Not Connected
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Status Overview */}
        <div className="border-2 border-gray-800 mb-12">
          <div className="bg-gray-800 p-3">
            <h2 style={{color: '#ffffff'}} className="editorial-header text-center text-lg tracking-[0.2em] font-bold">Status Overview</h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-black">
            {/* Safety Check-in Section */}
            <div className="p-8 text-center">
              <div className="border-b border-gray-300 pb-4 mb-6">
                <h3 className="editorial-header text-lg tracking-[0.1em] mb-2">Safety Check-in</h3>
                <div className="editorial-body text-sm text-gray-600">
                  Last check-in: {getTimeSinceLastCheckIn()}
                </div>
              </div>
              <button
                onClick={handleCheckIn}
                className="bg-white text-black border-4 border-black hover:bg-black hover:text-white px-10 py-6 editorial-header text-lg font-bold tracking-[0.15em] shadow-lg transform hover:scale-105 transition-all duration-200 uppercase"
              >
                <CheckCircle className="inline mr-4" size={24} />
                CHECK IN NOW
              </button>
            </div>

            {/* Status Monitor */}
            <div className="p-8 text-center">
              <div className="border-b border-gray-300 pb-4 mb-6">
                <h3 className="editorial-header text-lg tracking-[0.1em] mb-2">Document Status</h3>
                {isConnected && userDossiers.length > 0 ? (
                  <div className="editorial-body text-sm text-gray-600">
                    {userDossiers.filter(d => d.isActive).length} active document{userDossiers.filter(d => d.isActive).length !== 1 ? 's' : ''} monitored
                  </div>
                ) : (
                  <div className="editorial-body text-sm text-gray-600">
                    {isConnected ? 'No documents created yet' : 'Wallet not connected'}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="editorial-body text-xs text-gray-500">
                  {isConnected && userDossiers.length > 0 ? 'Next release in:' : 'Countdown:'}
                </div>
                <div className={`editorial-header text-3xl ${getRemainingTime().color} font-bold`}>
                  {getRemainingTime().display}
                </div>
                {getRemainingTime().expired && (
                  <div className="editorial-body text-sm text-red-600 font-semibold">
                    ⚠ Release condition met
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Document Registry */}
        {isConnected && (
          <div className="border-2 border-gray-800 mb-12">
            <div className="bg-gray-800 p-3">
              <div className="flex justify-between items-center">
                <h2 style={{color: '#ffffff'}} className="editorial-header text-lg tracking-[0.2em] font-bold">Document Registry</h2>
                <div className="flex items-center gap-4">
                  <span style={{color: '#ffffff'}} className="editorial-body text-xs">
                    {userDossiers.length > 0 
                      ? `${userDossiers.filter(d => d.isActive).length} active of ${userDossiers.length} total`
                      : 'No documents created yet'
                    }
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        await ContractService.checkInAll();
                        await loadUserDossiers();
                        setActivityLog(prev => [
                          { 
                            type: `Check-in performed for all active documents`, 
                            date: new Date().toLocaleString() 
                          },
                          ...prev
                        ]);
                      } catch (error) {
                        console.error('Failed to perform group check-in:', error);
                        toast.error('Failed to perform group check-in. Please try again.');
                      }
                    }}
                    disabled={userDossiers.length === 0 || userDossiers.filter(d => d.isActive).length === 0}
                    className={`px-4 py-2 editorial-body text-xs font-bold border-2 transition-all duration-200 ${
                      userDossiers.length === 0 || userDossiers.filter(d => d.isActive).length === 0
                        ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-black hover:text-white border-white'
                    }`}
                  >
                    ✓ CHECK IN ALL
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black bg-gray-50">
                      <th className="text-left py-4 px-4 editorial-body font-bold text-xs text-black border-r border-gray-300">ID</th>
                      <th className="text-left py-4 px-4 editorial-body font-bold text-xs text-black border-r border-gray-300">Name</th>
                      <th className="text-left py-4 px-4 editorial-body font-bold text-xs text-black border-r border-gray-300">Status</th>
                      <th className="text-left py-4 px-4 editorial-body font-bold text-xs text-black border-r border-gray-300">Time Remaining</th>
                      <th className="text-left py-4 px-4 editorial-body font-bold text-xs text-black border-r border-gray-300">Interval</th>
                      <th className="text-left py-4 px-4 editorial-body font-bold text-xs text-black border-r border-gray-300">Files</th>
                      <th className="text-left py-4 px-4 editorial-body font-bold text-xs text-black border-r border-gray-300">Recipients</th>
                      <th className="text-left py-4 px-4 editorial-body font-bold text-xs text-black border-r border-gray-300">Last Check-in</th>
                      <th className="text-left py-4 px-4 editorial-body font-bold text-xs text-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userDossiers.length > 0 ? (
                      userDossiers.map((dossier, index) => (
                      <tr key={dossier.id.toString()} className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                        <td className="py-4 px-4 border-r border-gray-300">
                          <div className="editorial-body font-bold text-black text-sm">#{dossier.id.toString()}</div>
                        </td>
                        <td className="py-4 px-4 border-r border-gray-300">
                          <div className="editorial-body font-semibold text-black text-sm" title={dossier.name}>
                            {dossier.name}
                          </div>
                        </td>
                        <td className="py-4 px-4 border-r border-gray-300">
                          <div className={`editorial-body text-xs font-semibold px-2 py-1 border text-center ${
                            dossier.isActive 
                              ? 'border-green-600 text-green-700 bg-green-50' 
                              : 'border-gray-400 text-gray-600 bg-gray-100'
                          }`}>
                            {dossier.isActive ? 'Active' : 'Paused'}
                          </div>
                        </td>
                        <td className="py-4 px-4 border-r border-gray-300">
                          {dossier.isActive ? (
                            <div className="editorial-body text-sm font-bold">
                              {(() => {
                                const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
                                const intervalMs = Number(dossier.checkInInterval) * 1000;
                                const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
                                const remainingMs = intervalMs - timeSinceLastCheckIn;
                                
                                if (remainingMs <= 0) {
                                  return <span className="text-red-600 font-semibold">⚠ Expired</span>;
                                }
                                
                                const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                                const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                                const remainingSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
                                
                                let color = 'text-green-600';
                                if (remainingMs < 5 * 60 * 1000) {
                                  color = 'text-red-600';
                                } else if (remainingMs < 30 * 60 * 1000) {
                                  color = 'text-orange-500';
                                } else if (remainingMs < 2 * 60 * 60 * 1000) {
                                  color = 'text-yellow-600';
                                }
                                
                                let display = '';
                                if (remainingHours > 0) {
                                  display = `${remainingHours}H ${remainingMinutes}M`;
                                } else if (remainingMinutes > 0) {
                                  display = `${remainingMinutes}M ${remainingSeconds}S`;
                                } else {
                                  display = `${remainingSeconds}S`;
                                }
                                
                                return <span className={`${color} font-mono tracking-wide`}>{display}</span>;
                              })()}
                            </div>
                          ) : (
                            <div className="editorial-body text-sm text-gray-400 font-semibold">Paused</div>
                          )}
                        </td>
                        <td className="py-4 px-4 border-r border-gray-300">
                          <div className="editorial-body text-sm font-mono text-black">
                            {Number(dossier.checkInInterval / BigInt(60))}M
                          </div>
                        </td>
                        <td className="py-4 px-4 border-r border-gray-300">
                          <div className="editorial-body text-sm font-bold text-black">
                            {dossier.encryptedFileHashes.length}
                          </div>
                        </td>
                        <td className="py-4 px-4 border-r border-gray-300">
                          <div className="editorial-body text-sm font-bold text-black">
                            {dossier.recipients.length}
                          </div>
                        </td>
                        <td className="py-4 px-4 border-r border-gray-300">
                          <div className="editorial-body text-xs font-mono text-gray-600">
                            {new Date(Number(dossier.lastCheckIn) * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} {new Date(Number(dossier.lastCheckIn) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-1 flex-wrap">
                            {(() => {
                              const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
                              const intervalMs = Number(dossier.checkInInterval) * 1000;
                              const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
                              const remainingMs = intervalMs - timeSinceLastCheckIn;
                              const isExpired = remainingMs <= 0;
                              
                              return (
                                <>
                                  {isExpired && dossier.isActive && (
                                    <button
                                                                             onClick={async () => {
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
                                               const decryptToast = toast.loading('Decrypting expired document...');
                                               
                                               // TODO: Implement real decryption from stored hash
                                               // This would involve:
                                               // 1. Fetching the encrypted data from IPFS/Codex using the hash
                                               // 2. Using TACo to decrypt the data (condition should be satisfied)
                                               // 3. Downloading the decrypted file
                                               
                                               toast.error('Real decryption not yet implemented. Document hash: ' + fileHash, { id: decryptToast });
                                               
                                               setActivityLog(prev => [
                                                 { 
                                                   type: `🔓 Decryption attempted for document #${dossier.id.toString()}`, 
                                                   date: new Date().toLocaleString() 
                                                 },
                                                 ...prev
                                               ]);
                                           } else {
                                             toast.error(`No encrypted files found in this dossier. Dossier #${dossier.id.toString()} appears to be empty or corrupted.`);
                                           }
                                         } catch (error) {
                                           console.error('❌ Failed to decrypt:', error);
                                           toast.error('Failed to decrypt document. Please try again.');
                                         }
                                       }}
                                      className="editorial-body text-xs px-2 py-1 border border-red-600 text-red-700 hover:bg-red-600 hover:text-white font-semibold transition-colors"
                                    >
                                      Decrypt
                                    </button>
                                  )}
                                  
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
                                    className={`editorial-body text-xs px-3 py-2 border-2 font-bold transition-colors ${
                                      dossier.isActive 
                                        ? 'border-black text-black bg-white hover:bg-black hover:text-white' 
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
                                            type: `Document #${dossier.id.toString()} ${dossier.isActive ? 'paused' : 'resumed'}`, 
                                            date: new Date().toLocaleString() 
                                          },
                                          ...prev
                                        ]);
                                      } catch (error) {
                                        console.error('Failed to toggle document status:', error);
                                        toast.error('Failed to update document status. Please try again.');
                                      }
                                    }}
                                    className="editorial-body text-xs px-2 py-1 border border-gray-400 text-gray-600 hover:border-gray-600 hover:text-gray-700 font-semibold transition-colors"
                                  >
                                    {dossier.isActive ? 'Pause' : 'Resume'}
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))) : (
                      <tr>
                        <td colSpan={9} className="py-12 px-4 text-center">
                          <div className="flex flex-col items-center justify-center space-y-4">
                            <Shield className="text-gray-400" size={48} />
                            <div className="space-y-2">
                              <h3 className="editorial-body font-semibold text-lg text-gray-600">No Documents Yet</h3>
                              <p className="editorial-body text-sm text-gray-500">
                                Create your first encrypted document using the form on the left.
                              </p>
                              <p className="editorial-body text-xs text-gray-400">
                                Documents will appear here once you encrypt and upload files to the blockchain.
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Document Management Center */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Left Column - Document Creation */}
          <div className="border-2 border-gray-800">
            <div className="bg-gray-800 p-3">
              <h3 style={{color: '#ffffff'}} className="editorial-header text-sm tracking-[0.2em] font-bold text-center">Document Creation</h3>
            </div>
            <div className="bg-white p-6 space-y-6">
              {/* File Upload */}
              <div>
                <div className="border-b border-gray-300 pb-2 mb-4">
                  <h4 className="editorial-body font-semibold text-sm text-black">File Upload</h4>
                </div>
                <div
                  className="border-2 border-dashed border-gray-400 text-center py-8 cursor-pointer hover:border-black transition-colors bg-gray-50"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mx-auto mb-3 text-gray-600" size={32} />
                  <p className="editorial-body text-sm font-semibold text-gray-700">
                    {uploadedFile ? uploadedFile.name : 'Drop files here'}
                  </p>
                  <p className="editorial-body text-xs text-gray-500 mt-1">
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

              {/* Settings */}
              <div>
                <div className="border-b border-gray-300 pb-2 mb-4">
                  <h4 className="editorial-body font-semibold text-sm text-black">Settings</h4>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="editorial-body font-semibold text-sm text-black mb-3 block">
                      Check-in Frequency
                    </label>
                    <select 
                      className="w-full border-2 border-gray-300 p-3 editorial-body text-sm focus:border-black focus:outline-none font-mono"
                      value={checkInInterval}
                      onChange={(e) => setCheckInInterval(e.target.value)}
                    >
                      {intervalOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="editorial-body text-xs text-gray-500 mt-2">
                      Documents will be released automatically if no check-in is received within this timeframe
                    </p>
                  </div>
                  
                  <div>
                    <label className="editorial-body font-semibold text-sm text-black mb-3 block">
                      Description (Optional)
                    </label>
                    <textarea
                      placeholder="Enter description or notes..."
                      className="w-full border-2 border-gray-300 p-3 h-20 resize-none editorial-body text-sm focus:border-black focus:outline-none"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  
                  <button
                    onClick={processCanaryTrigger}
                    disabled={!uploadedFile || isProcessing || encryptedCapsule}
                    className="w-full bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed py-4 editorial-body font-semibold border-2 border-black transition-all duration-200"
                  >
                    {isProcessing ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        Encrypting file...
                      </div>
                    ) : encryptedCapsule ? (
                      <>
                        <CheckCircle className="inline mr-3" size={20} />
                        File encrypted
                      </>
                    ) : (
                      <>
                        <Shield className="inline mr-3" size={20} />
                        Encrypt file
                      </>
                    )}
                  </button>

                  {/* Commit Button - shown after encryption */}
                  {encryptedCapsule && !traceJson && (
                    <button
                      onClick={commitToCodex}
                      disabled={isCommitting}
                      className="w-full bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed py-4 editorial-body font-semibold border-2 border-gray-800 transition-all duration-200"
                    >
                      {isCommitting ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                          {isConnected ? 'Creating document...' : 'Uploading file...'}
                        </div>
                      ) : (
                        <>
                          <Upload className="inline mr-3" size={20} />
                          {isConnected ? 'Create document' : 'Upload file'}
                        </>
                      )}
                    </button>
                  )}

                  {/* Reset Button - shown after everything is complete */}
                  {traceJson && (
                    <button
                      onClick={() => {
                        setEncryptedCapsule(null);
                        setTraceJson(null);
                        setUploadedFile(null);
                      }}
                      className="w-full border-2 border-gray-400 text-gray-600 hover:border-black hover:text-black py-4 editorial-body font-semibold transition-all duration-200"
                    >
                      Create new document
                    </button>
                  )}
                </div>
                
                {/* Activity Log */}
                <div>
                  <div className="border-b border-gray-300 pb-2 mb-4">
                    <div className="flex justify-between items-center">
                      <h4 className="editorial-body font-semibold text-sm text-black">Activity Log</h4>
                      <button 
                        onClick={() => setShowActivityLog(!showActivityLog)}
                        className="editorial-body text-xs text-gray-500 hover:text-black font-semibold"
                      >
                        {showActivityLog ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  {showActivityLog && (
                    <div className="border border-gray-300 bg-gray-50">
                      <div className="max-h-48 overflow-y-auto">
                        {activityLog.map((log, index) => (
                          <div key={index} className="flex justify-between items-center py-2 px-3 border-b border-gray-200 last:border-b-0">
                            <span className="editorial-body text-xs font-semibold text-black">{log.type}</span>
                            <span className="editorial-body text-xs font-mono text-gray-600">{log.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Upload History */}
          <div className="border-2 border-gray-800">
            <div className="bg-gray-800 p-3">
              <h3 style={{color: '#ffffff'}} className="editorial-header text-sm tracking-[0.2em] font-bold text-center">Upload History</h3>
            </div>
            <div className="bg-white p-6 space-y-6">

              {/* File History */}
              {uploads.length > 0 && (
                <div>
                  <div className="border-b border-gray-300 pb-2 mb-4">
                    <h4 className="editorial-body font-semibold text-sm text-black">Recent Uploads</h4>
                  </div>
                  <div className="border border-gray-300 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b-2 border-black bg-gray-50">
                            <th className="text-left py-3 px-3 editorial-body font-bold text-xs text-black border-r border-gray-300">File</th>
                            <th className="text-left py-3 px-3 editorial-body font-bold text-xs text-black border-r border-gray-300">Status</th>
                            <th className="text-left py-3 px-3 editorial-body font-bold text-xs text-black border-r border-gray-300">Storage</th>
                            <th className="text-left py-3 px-3 editorial-body font-bold text-xs text-black border-r border-gray-300">Encryption</th>
                            <th className="text-left py-3 px-3 editorial-body font-bold text-xs text-black border-r border-gray-300">Document</th>
                            <th className="text-left py-3 px-3 editorial-body font-bold text-xs text-black">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uploads.map((upload, index) => (
                            <tr key={upload.id} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                              <td className="py-3 px-3 border-r border-gray-300">
                                <div className="editorial-body text-xs font-semibold text-black truncate max-w-24" title={upload.filename}>
                                  {upload.filename}
                                </div>
                              </td>
                              <td className="py-3 px-3 border-r border-gray-300">
                                <div className={`editorial-body text-xs font-semibold px-2 py-1 border text-center ${
                                  upload.status === 'committed' 
                                    ? 'border-green-600 text-green-700 bg-green-50' 
                                    : 'border-gray-400 text-gray-600 bg-gray-100'
                                }`}>
                                  {upload.status === 'committed' ? 'Complete' : 'Processing'}
                                </div>
                              </td>
                              <td className="py-3 px-3 border-r border-gray-300">
                                <div className={`editorial-body text-xs font-semibold ${
                                  upload.storageType === 'codex' ? 'text-blue-600' :
                                  upload.storageType === 'pinata' ? 'text-purple-600' :
                                  upload.storageType === 'ipfs' ? 'text-orange-600' :
                                  'text-gray-600'
                                }`}>
                                  {upload.storageType.charAt(0).toUpperCase() + upload.storageType.slice(1)}
                                </div>
                              </td>
                              <td className="py-3 px-3 border-r border-gray-300">
                                <div className="editorial-body text-xs font-semibold text-green-600">
                                  TACo
                                </div>
                              </td>
                              <td className="py-3 px-3 border-r border-gray-300">
                                <div className="editorial-body text-xs font-mono">
                                  {upload.contractDossierId ? (
                                    <span className="text-black font-semibold" title={`Tx: ${upload.contractTxHash}`}>
                                      #{upload.contractDossierId}
                                    </span>
                                  ) : isConnected ? (
                                    <span className="text-red-600 font-semibold">Failed</span>
                                  ) : (
                                    <span className="text-gray-400">No wallet</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="editorial-body text-xs font-mono text-gray-600">
                                  {upload.createdAt.toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: false
                                  })}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Encrypted File Details */}
              {encryptedCapsule && !traceJson && (
                <div>
                  <div className="border-b border-gray-300 pb-2 mb-4">
                    <h4 className="editorial-body font-semibold text-sm text-black">Encrypted File Details</h4>
                  </div>
                  <div className="border border-gray-300 bg-white p-4 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Shield className="text-blue-600" size={20} />
                      <h3 className="editorial-subheader">Encrypted Capsule</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isConnected && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                          Polygon Amoy Contract
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contract Test Button */}
                  {isConnected && (
                    <div className="space-y-2">
                      <button
                        onClick={async () => {
                          try {
                            const isConnected = await ContractService.testContractConnection();
                            if (isConnected) {
                              toast.success('✅ Contract is accessible!');
                            } else {
                              toast.error('❌ Contract connection failed');
                            }
                          } catch (error) {
                            console.error('Contract test failed:', error);
                            toast.error('❌ Contract test failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
                          }
                        }}
                        className="editorial-button border-2 border-blue-300 text-blue-700 hover:bg-blue-50 w-full"
                      >
                        Test Contract Connection
                      </button>
                      
                      <button
                        onClick={async () => {
                          try {
                            console.log('🔌 Reconnecting wallet...');
                            disconnect();
                            // Wait a moment for disconnect to complete
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            // Try to reconnect with MetaMask
                            const connector = connectors.find(c => c.id === 'metaMask') || connectors[0];
                            if (connector) {
                              connect({ connector });
                            }
                          } catch (error) {
                            console.error('Reconnection failed:', error);
                            toast.error('❌ Reconnection failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
                          }
                        }}
                        className="editorial-button border-2 border-orange-300 text-orange-700 hover:bg-orange-50 w-full"
                      >
                        🔄 Reconnect Wallet
                      </button>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="editorial-body font-semibold">Encryption</span>
                    <span className="font-semibold text-green-600">
                      🔒 TACo Encryption
                    </span>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="editorial-body text-sm text-gray-600">Original File:</span>
                      <span className="editorial-body text-sm font-medium">{encryptedCapsule.originalFileName}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="editorial-body text-sm text-gray-600">Encrypted Size:</span>
                      <span className="editorial-body text-sm font-medium">{encryptedCapsule.encryptedData.length} bytes</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="editorial-body text-sm text-gray-600">Condition:</span>
                      <span className="editorial-body text-sm font-medium">No check-in for {encryptedCapsule.condition.duration}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="editorial-body text-sm text-gray-600">TACo Capsule:</span>
                      <span className="editorial-body text-xs font-mono text-blue-600">
                        {encryptedCapsule.capsuleUri.slice(0, 30)}...
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="flex items-center">
                        <AlertCircle size={16} className="text-yellow-600 mr-2" />
                        <span className="editorial-body text-sm text-yellow-800">
                          Click "Upload" to upload your encrypted capsule to your local Codex node
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Download size={16} className="text-green-600 mr-2" />
                          <span className="editorial-body text-sm text-green-800">
                            Your encrypted file is ready to download from memory
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={downloadEncryptedFile}
                            className="editorial-button bg-purple-600 text-white hover:bg-purple-700 text-sm px-3 py-1"
                            title="Download encrypted file from browser memory"
                          >
                            <Download size={14} className="inline mr-1" />
                            Download
                          </button>
                          <button
                            onClick={testDecryption}
                            className="editorial-button bg-green-600 text-white hover:bg-green-700 text-sm px-3 py-1"
                            title="Test TACo decryption and download original file"
                          >
                            <Shield size={14} className="inline mr-1" />
                            Test Decrypt
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              )}

              {/* Document Report */}
              {traceJson && (
                <div>
                  <div className="border-b border-gray-300 pb-2 mb-4">
                    <h4 className="editorial-body font-semibold text-sm text-black">Document Report</h4>
                  </div>
                  <div className="border border-gray-300 bg-white p-4 space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="editorial-body font-semibold">trace.json</span>
                    <div className="flex gap-2">
                      <button
                        onClick={copyTraceJson}
                        className="editorial-button bg-blue-600 text-white hover:bg-blue-700 text-sm px-4 py-2"
                      >
                        <Copy size={16} className="inline mr-1" />
                        Copy
                      </button>
                      <button
                        onClick={downloadTraceJson}
                        className="editorial-button bg-green-600 text-white hover:bg-green-700 text-sm px-4 py-2"
                      >
                        <Download size={16} className="inline mr-1" />
                        Download
                      </button>
                      <button
                        onClick={downloadEncryptedFile}
                        disabled={!encryptedCapsule}
                        className="editorial-button bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm px-4 py-2"
                        title={
                          encryptedCapsule 
                            ? 'Download encrypted file from browser memory'
                            : 'No encrypted file available - encrypt a file first'
                        }
                      >
                        <Download size={16} className="inline mr-1" />
                        File
                      </button>
                      {encryptedCapsule && (
                        <button
                          onClick={testDecryption}
                          className="editorial-button bg-emerald-600 text-white hover:bg-emerald-700 text-sm px-4 py-2"
                          title="Test TACo decryption to verify encryption worked"
                        >
                          <Shield size={16} className="inline mr-1" />
                          Test Decrypt
                        </button>
                      )}
                    </div>
                  </div>
                  <pre className="bg-gray-100 p-4 rounded font-mono text-sm overflow-x-auto">
                    {JSON.stringify(traceJson, null, 2)}
                  </pre>
                  
                  {/* TACo & Codex Integration Status */}
                  <div className="mt-4 space-y-3">
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center">
                        <Shield size={16} className="mr-2 text-green-600" />
                        <span className="editorial-body text-sm text-green-800">
                          🔒 TACo Network - Real threshold cryptographic protection enabled
                        </span>
                      </div>
                    </div>
                    
                    <div className={`p-3 border rounded ${
                      traceJson.payload_uri.startsWith('codex://') 
                        ? 'bg-green-50 border-green-200'
                        : traceJson.storage_type === 'pinata'
                          ? 'bg-blue-50 border-blue-200'
                          : traceJson.payload_uri.startsWith('ipfs://')
                            ? 'bg-purple-50 border-purple-200'
                            : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center">
                        <Upload size={16} className={`mr-2 ${
                          traceJson.payload_uri.startsWith('codex://') 
                            ? 'text-green-600'
                            : traceJson.storage_type === 'pinata'
                              ? 'text-blue-600'
                              : traceJson.payload_uri.startsWith('ipfs://')
                                ? 'text-purple-600'
                                : 'text-red-600'
                        }`} />
                        <span className={`editorial-body text-sm ${
                          traceJson.payload_uri.startsWith('codex://') 
                            ? 'text-green-800'
                            : traceJson.storage_type === 'pinata'
                              ? 'text-blue-800'
                              : traceJson.payload_uri.startsWith('ipfs://')
                                ? 'text-purple-800'
                                : 'text-red-800'
                        }`}>
                          {traceJson.payload_uri.startsWith('codex://') ? 
                              'Local Codex Node - Stored on localhost:8080' :
                            traceJson.payload_uri.startsWith('ipfs://') ?
                                traceJson.storage_type === 'pinata' ?
                                  'Pinata IPFS - Professional IPFS pinning service!' :
                                  'Local IPFS Network - Uploaded via local node!' :
                              'Unknown Storage - Error in upload process'
                          }
                        </span>
                      </div>
                      
                      {/* Show gateway link for IPFS uploads */}
                      {traceJson.payload_uri.startsWith('ipfs://') && (
                        <div className="mt-2 space-y-1">
                          {traceJson.gateway_url && (
                            <div>
                              <a 
                                href={traceJson.gateway_url}
              target="_blank"
              rel="noopener noreferrer"
                                className="text-xs text-purple-600 hover:text-purple-800 underline"
                              >
                                🔗 View on {traceJson.gateway_url.includes('mypinata.cloud') ? 'Pinata Gateway (Primary)' : 'IPFS.io Gateway'}
                              </a>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <a 
                              href={`https://purple-certain-guan-605.mypinata.cloud/ipfs/${traceJson.payload_uri.replace('ipfs://', '')}`}
              target="_blank"
              rel="noopener noreferrer"
                              className="text-xs text-purple-600 hover:text-purple-800 underline"
                            >
                              📌 Pinata
            </a>
            <a
                              href={`https://ipfs.io/ipfs/${traceJson.payload_uri.replace('ipfs://', '')}`}
              target="_blank"
              rel="noopener noreferrer"
                              className="text-xs text-purple-600 hover:text-purple-800 underline"
                            >
                              🌐 IPFS.io
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {/* Download instructions */}
                      {encryptedCapsule && (
                        <div className="mt-2 text-xs text-green-700">
                          📥 Use the "File" button above to download your encrypted file from browser memory
                        </div>
                      )}

                    </div>
                  </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
