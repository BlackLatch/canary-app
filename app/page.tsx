'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Shield, Download, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { encryptFileWithCondition, commitEncryptedFileToPinata, DeadmanCondition, TraceJson } from './lib/taco';
import Onboarding from './components/Onboarding';
import CanaryGuideStandalone from './components/CanaryGuideStandalone';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [emergencyContacts, setEmergencyContacts] = useState<string[]>(['']);
  const [releaseMode, setReleaseMode] = useState<'public' | 'contacts'>('public');
  const [currentView, setCurrentView] = useState<'checkin' | 'documents' | 'guide'>('checkin');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        name
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
          // COMPREHENSIVE DEBUGGING BEFORE CONTRACT CALL
          console.log('🔍🔍🔍 DEBUGGING CONTRACT PARAMETERS BEFORE TRANSACTION 🔍🔍🔍');
          try {
            const debugResult = await ContractService.debugCreateDossierParams(
              dossierName,
              checkInMinutes,
              recipients,
              fileHashes
            );
            
            console.log('📊 DEBUG RESULT:', debugResult);
            
            if (!debugResult.isValid) {
              console.error('❌ CONTRACT PARAMETER VALIDATION FAILED:');
              debugResult.errors.forEach(error => console.error('   🚨', error));
              throw new Error(`Contract validation failed: ${debugResult.errors.join(', ')}`);
            }
            
            console.log('✅ CONTRACT PARAMETERS VALIDATED - PROCEEDING WITH TRANSACTION');
            
          } catch (debugError) {
            console.error('❌ DEBUG VALIDATION FAILED:', debugError);
            throw new Error(`Pre-transaction validation failed: ${debugError}`);
          }

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

  // Load user's dossiers from contract with accurate decryptable status
  const loadUserDossiers = async () => {
    if (!isConnected || !address) return;
    
    try {
      console.log('📋 Loading user dossiers from contract...');
      const dossierIds = await ContractService.getUserDossierIds(address as Address);
      
      const dossiers: DossierWithStatus[] = [];
      for (const id of dossierIds) {
        const dossier = await ContractService.getDossier(address as Address, id);
        
        // Check the actual decryptable status according to contract
        let shouldStayEncrypted = true;
        let isDecryptable = false;
        try {
          shouldStayEncrypted = await ContractService.shouldDossierStayEncrypted(address as Address, id);
          isDecryptable = !shouldStayEncrypted;
        } catch (error) {
          console.warn(`Could not check encryption status for dossier #${id.toString()}:`, error);
          // Fallback to time-based calculation if contract call fails
          const timeSinceLastCheckIn = Date.now() / 1000 - Number(dossier.lastCheckIn);
          const gracePeriod = 3600; // 1 hour grace period (should match contract)
          isDecryptable = !dossier.isActive || timeSinceLastCheckIn > (Number(dossier.checkInInterval) + gracePeriod);
        }
        
        // Add accurate decryptable status to dossier object
        const dossierWithStatus: DossierWithStatus = {
          ...dossier,
          isDecryptable: isDecryptable
        };
        
        dossiers.push(dossierWithStatus);
        
        // Log the true status for debugging
        console.log(`📄 Dossier #${id.toString()}: isActive=${dossier.isActive}, shouldStayEncrypted=${shouldStayEncrypted}, isDecryptable=${isDecryptable}`);
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
        `}
      </style>
      
             <div className="min-h-screen canary-grid-background relative" style={{ zoom: '0.8' }}>
        {/* Logo - Fixed Top Left */}
        <div className="absolute top-6 left-6 z-50">
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
        <header className="border-b border-gray-200/30 px-4 py-6">
                  <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div></div> {/* Spacer for layout balance */}
            
            <div className="flex items-center gap-8">
            <nav className="flex gap-8">
              <button 
                onClick={() => setCurrentView('checkin')}
                className={`editorial-body font-semibold transition-colors ${
                                      currentView === 'checkin' ? 'text-gray-900 border-b-2 border-gray-900 pb-1' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Check In
              </button>
              <button 
                onClick={() => setCurrentView('documents')}
                className={`editorial-body font-semibold transition-colors ${
                                      currentView === 'documents' ? 'text-gray-900 border-b-2 border-gray-900 pb-1' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Documents
              </button>
              <button 
                onClick={() => setCurrentView('guide')}
                className={`editorial-body font-semibold transition-colors ${
                                      currentView === 'guide' ? 'text-gray-900 border-b-2 border-gray-900 pb-1' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Guide
              </button>
            </nav>
            
            {/* Wallet Status */}
            {isConnected && address ? (
              <div className="flex items-center gap-3">
                <div className="editorial-body text-sm border-2 border-gray-300 px-3 py-2 rounded-lg bg-white">
                  <span className="text-green-600 font-semibold">●</span> {address.slice(0, 6)}...{address.slice(-4)}
        </div>
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
                  {isConnected && userDossiers.length > 0 ? 'Next release in:' : 'Status:'}
                </div>
                <div className={`editorial-header text-5xl ${getRemainingTime().color} font-bold font-mono tracking-wide`}>
                  {getRemainingTime().display}
                </div>
                {getRemainingTime().expired && (
                  <div className="editorial-body text-sm text-red-600 font-semibold">
                    ⚠ Release condition met
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-center gap-4">
                {/* Check In Button */}
                <button
                  onClick={handleCheckIn}
                  disabled={isCheckingIn || !isConnected || userDossiers.filter(d => d.isActive).length === 0}
                  className="bg-white text-gray-900 border-4 border-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none px-12 py-8 editorial-header text-xl font-bold tracking-[0.15em] shadow-xl transform hover:scale-105 transition-colors duration-200 uppercase"
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
                {isConnected && address && (
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/share/${address}`;
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
                    className="bg-white text-gray-900 border-4 border-gray-900 hover:bg-gray-900 hover:text-white px-6 py-4 editorial-header text-sm font-bold tracking-[0.15em] shadow-xl transform hover:scale-105 transition-colors duration-200 uppercase"
                    title={`Copy shareable link: ${window.location.origin}/share/${address?.slice(0,6)}...${address?.slice(-4)}`}
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
                {isConnected && userDossiers.length > 0 ? (
                  `${userDossiers.filter(d => d.isActive).length} active of ${userDossiers.length} total documents`
                ) : (
                  isConnected ? 'No documents created yet' : 'Wallet not connected'
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
              {isConnected && (
                <div className="border-2 border-gray-800 mb-12">
                  <div className="bg-gray-800 p-3">
                    <div className="flex justify-between items-center">
                      <h2 style={{color: '#ffffff'}} className="editorial-header text-lg tracking-[0.2em] font-bold">Your Documents</h2>
                      <span style={{color: '#ffffff'}} className="editorial-body text-xs">
                        {userDossiers.length > 0 
                          ? `${userDossiers.filter(d => d.isActive).length} active of ${userDossiers.length} total`
                          : 'No documents created yet'
                        }
                      </span>
                    </div>
                  </div>
                  <div className="bg-white/90 backdrop-blur-sm p-6">
                    {userDossiers.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {/* Add New Document Card */}
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
                        
                        {userDossiers.map((dossier, index) => {
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
                                    dossier.isActive 
                                      ? 'border-green-600 text-green-700 bg-green-50' 
                                      : 'border-gray-400 text-gray-600 bg-gray-100'
                                  }`}>
                                    {dossier.isActive ? 'Active' : 'Deactivated'}
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
                                          ? 'border-gray-900 text-gray-900 bg-white hover:bg-gray-900 hover:text-white' 
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
                                  {dossier.isDecryptable && dossier.encryptedFileHashes.length > 0 ? (
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
                                      🔓 DECRYPT EXPIRED DOCUMENT
                                    </button>
                                  ) : (
                                    <div className="w-full text-center py-2 editorial-body text-xs text-gray-500">
                                      {!dossier.isActive ? 'Document deactivated' : 
                                       !dossier.isDecryptable ? 'Not yet expired' : 
                                       'No files available'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-16 px-4 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className="text-gray-400 mb-4">
                            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="space-y-2">
                            <h3 className="editorial-header text-xl font-bold text-gray-600">No Documents Yet</h3>
                            <p className="editorial-body text-base text-gray-500">
                              You haven't created any deadman switch documents yet.
                            </p>
                            <button
                              onClick={() => setShowCreateForm(true)}
                              className="mt-4 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 editorial-body font-bold transition-colors"
                            >
                              CREATE FIRST DOCUMENT
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
                        {[1, 2, 3, 4].map((segment) => (
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
                        {[1, 2, 3, 4, 5].map((step) => (
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
                               'Review'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="editorial-body text-sm text-gray-600">
                      Step {currentStep} of 5: {
                        currentStep === 1 ? 'Document Name' :
                        currentStep === 2 ? 'File Upload' :
                        currentStep === 3 ? 'Check-in Frequency' :
                        currentStep === 4 ? 'Release Mode' :
                        'Review & Encrypt'
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
                              className="w-full bg-white text-gray-900 border-4 border-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed py-8 editorial-header text-xl font-bold tracking-[0.15em] shadow-xl transform hover:scale-105 transition-colors duration-200 uppercase"
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

                          {encryptedCapsule && !traceJson && (
                            <button
                              onClick={commitToCodex}
                              disabled={isCommitting}
                              className="w-full bg-white text-gray-900 border-4 border-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed py-8 editorial-header text-xl font-bold tracking-[0.15em] shadow-xl transform hover:scale-105 transition-colors duration-200 uppercase"
                            >
                              {isCommitting ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-3"></div>
                                  Uploading...
                                </div>
                              ) : (
                                <>
                                  <Upload className="inline mr-3" size={28} />
                                  Upload
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
                </div>

                {/* Navigation */}
                {currentStep < 5 && !traceJson && (
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
                        setCurrentStep(Math.min(5, currentStep + 1));
                      }}
                      className="px-6 py-2 bg-gray-900 text-white hover:bg-gray-800 editorial-body font-semibold transition-colors rounded"
                    >
                      {currentStep === 4 ? 'Review' : 'Next'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

        {/* Toaster for notifications */}
        <Toaster position="top-right" />
      </div>
    </>
  );
}
