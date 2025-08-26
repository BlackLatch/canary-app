'use client';

import React, { useState, useRef, useEffect, Fragment, Suspense } from 'react';
import { Upload, Shield, Download, Copy, AlertCircle, Github, Sun, Moon, Mic, Video } from 'lucide-react';
import { commitEncryptedFileToPinata, DeadmanCondition, TraceJson, encryptFileWithDossier } from './lib/taco';
import { useTheme } from './lib/theme-context';
import MediaRecorder from './components/MediaRecorder';
import { useSearchParams } from 'next/navigation';

import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { usePrivy, useWallets, useConnectWallet } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { polygonAmoy } from 'wagmi/chains';
import { Address, encodeFunctionData } from 'viem';
import { ContractService, CANARY_DOSSIER_ADDRESS, CANARY_DOSSIER_ABI, Dossier, isOnPolygonAmoy, getNetworkName } from './lib/contract';
import toast, { Toaster } from 'react-hot-toast';
import { getMimeType } from './lib/mime-types';

// Extended dossier interface with accurate decryptable status
interface DossierWithStatus extends Dossier {
  isDecryptable: boolean;
}

// Component that uses useSearchParams
const HomeContent = ({ onViewChange }: { onViewChange: (view: 'checkin' | 'documents') => void }) => {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'documents') {
      onViewChange('documents');
    } else if (view === 'checkin') {
      onViewChange('checkin');
    }
  }, [searchParams, onViewChange]);
  
  return null;
};

const Home = () => {
  const { connectors, connect, isPending } = useConnect();

  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { connectWallet } = useConnectWallet();
  const { client: smartWalletClient } = useSmartWallets();
  const { theme, toggleTheme } = useTheme();
  
  const [signedIn, setSignedIn] = useState(false);
  const [authMode, setAuthMode] = useState<'standard' | 'advanced'>(() => {
    // Load auth mode from localStorage, default to standard
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('canary-auth-mode') as 'standard' | 'advanced') || 'standard';
    }
    return 'standard';
  });
  // Removed userProfile - using dossier-only storage model
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [checkInInterval, setCheckInInterval] = useState('60'); // Default to 1 hour in minutes
  const [name, setName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [traceJson, setTraceJson] = useState<TraceJson | null>(null);
  const [encryptedCapsule, setEncryptedCapsule] = useState<any>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const [userDossiers, setUserDossiers] = useState<DossierWithStatus[]>([]);
  const [isLoadingDossiers, setIsLoadingDossiers] = useState(true);
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
  const [currentView, setCurrentView] = useState<'checkin' | 'documents'>('checkin');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showInactiveDocuments, setShowInactiveDocuments] = useState(false);
  const [showAlphaBanner, setShowAlphaBanner] = useState(true);
  const [dummyMasterSwitch, setDummyMasterSwitch] = useState(true); // Dummy UI state for master switch
  const [selectedDocument, setSelectedDocument] = useState<DossierWithStatus | null>(null);
  const [documentDetailView, setDocumentDetailView] = useState(false);
  const [showMediaRecorder, setShowMediaRecorder] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document detail navigation
  const openDocumentDetail = (document: DossierWithStatus) => {
    setSelectedDocument(document);
    setDocumentDetailView(true);
  };

  const closeDocumentDetail = () => {
    setSelectedDocument(null);
    setDocumentDetailView(false);
  };

  const intervalOptions = [
    { value: '1', label: '1 Minute (Testing)' },
    { value: '5', label: '5 Minutes' },
    { value: '15', label: '15 Minutes' },
    { value: '60', label: '1 Hour' },
    { value: '360', label: '6 Hours' },
    { value: '720', label: '12 Hours' },
    { value: '1440', label: '24 Hours' }
  ];

  // Helper function to check if we have a valid wallet connection (wagmi or Privy)
  const hasWalletConnection = () => {
    return (isConnected && address) || (authenticated && wallets.length > 0);
  };

  // Helper function to get current wallet address (wagmi or Privy)
  const getCurrentAddress = () => {
    return address || (wallets.length > 0 ? wallets[0]?.address : null);
  };

  // Helper function to set auth mode and persist to localStorage
  const setAuthModeWithPersistence = (mode: 'standard' | 'advanced') => {
    setAuthMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('canary-auth-mode', mode);
    }
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
    // Clean theme setup - no mesh backgrounds
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
      toast.error(authMode === 'standard' ? 'Please sign in to create documents' : 'Please connect your wallet to create encrypted documents');
      return;
    }

    // Check if we're on the right network - MUST be Polygon Amoy
    if (!isOnPolygonAmoy(chainId)) {
      const currentNetwork = getNetworkName(chainId);
      console.warn(`⚠️ Wrong network! Currently on ${currentNetwork}, need Polygon Amoy`);
      toast.error(`Please switch to Polygon Amoy network. Currently on ${currentNetwork}`);
      return;
    }

    // Check if smart wallet is available for gasless transactions
    if (!smartWalletClient) {
      console.warn('⚠️ Smart wallet not available, transactions will require gas');
    }

    setIsProcessing(true);
    const processingToast = toast.loading(
      authMode === 'standard' 
        ? 'Securing your document...' 
        : 'Creating encrypted document with dossier conditions...'
    );

    try {
      console.log('🔐 Starting dossier-only encryption flow...');
      
      // For standard mode, ensure the embedded wallet is ready
      if (authMode === 'standard' && wallets.length === 0) {
        toast.dismiss(processingToast);
        toast.error('Please wait a moment for your account to be fully set up, then try again.');
        setIsProcessing(false);
        return;
      }
      
      // Step 1: Get next dossier ID
      console.log('🔍 Step 1: Getting next dossier ID...');
      // Determine which address to use based on auth mode
      let queryAddress: string | null;
      if (authMode === 'advanced') {
        queryAddress = address; // Use Web3 wallet address
        console.log('🔧 Advanced mode - using Web3 wallet for query:', queryAddress);
      } else {
        queryAddress = smartWalletClient?.account?.address || address;
        console.log('🎯 Standard mode - using smart wallet for query:', queryAddress);
      }
      
      const userDossierIds = await ContractService.getUserDossierIds(queryAddress as Address);
      const nextDossierId = BigInt(userDossierIds.length);
      console.log('🆔 Next dossier ID will be:', nextDossierId.toString());
      
      // Step 2: Encrypt with Dossier condition
      console.log('🔒 Step 2: Encrypting with Dossier contract condition...');
      const condition: DeadmanCondition = {
        type: 'no_checkin',
        duration: `${checkInInterval} MINUTES`,
        dossierId: nextDossierId,
        userAddress: queryAddress
      };

      // Get the wallet provider for encryption based on auth mode
      let walletProvider = null;
      if (authMode === 'standard') {
        // Standard mode: Use Privy embedded wallet transparently
        if (wallets.length > 0) {
          const privyWallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];
          if (privyWallet && typeof privyWallet.getEthereumProvider === 'function') {
            try {
              walletProvider = await privyWallet.getEthereumProvider();
              console.log('✅ Using Privy embedded wallet provider');
              
              // Add a small delay to ensure wallet is fully initialized
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
              console.error('Failed to get wallet provider:', error);
              toast.dismiss(processingToast);
              toast.error('Your account is still being set up. Please wait a moment and try again.');
              setIsProcessing(false);
              return;
            }
          }
        }
        
        // If we still don't have a wallet provider, the wallet isn't ready
        if (!walletProvider) {
          toast.dismiss(processingToast);
          toast.error('Your account is still being set up. Please wait a moment and try again.');
          setIsProcessing(false);
          return;
        }
      } else {
        // Advanced mode: Use the connected Web3 wallet provider
        if (typeof window !== 'undefined' && window.ethereum) {
          walletProvider = window.ethereum;
          console.log('✅ Using Web3 wallet provider');
        }
      }

      const encryptionResult = await encryptFileWithDossier(
        uploadedFile,
        condition,
        name,
        nextDossierId,
        queryAddress,
        walletProvider
      );
      
      console.log('✅ File encrypted with Dossier contract condition');
      
      // Step 3: Upload encrypted file
      console.log('📦 Step 3: Uploading encrypted file...');
      const { commitResult, traceJson } = await commitEncryptedFileToPinata(encryptionResult);
      console.log('📦 Storage result:', commitResult);
      
      // Step 4: Create dossier on-chain
      console.log('📝 Step 4: Creating dossier on-chain...');
      const dossierName = name || `Encrypted file: ${traceJson.original_filename}`;
      const checkInMinutes = parseInt(checkInInterval);
      // Recipients should match the address used for creation
      const recipients = [queryAddress];
      const fileHashes = [traceJson.payload_uri];
      
      let dossierId: bigint;
      let contractTxHash: string;
      
      try {
        // Use smart wallet for gasless transaction only in standard mode
        let result;
        if (smartWalletClient && authMode === 'standard') {
          // Create the transaction data
          const txData = encodeFunctionData({
            abi: CANARY_DOSSIER_ABI,
            functionName: 'createDossier',
            args: [dossierName, BigInt(checkInMinutes * 60), recipients, fileHashes]
          });
          
          console.log('🚀 Using smart wallet for gasless transaction...');
          const txHash = await smartWalletClient.sendTransaction({
            account: smartWalletClient.account,
            chain: polygonAmoy,
            to: CANARY_DOSSIER_ADDRESS,
            data: txData,
          });
          
          console.log('✅ Transaction sent:', txHash);
          
          // Wait for transaction to be mined and get dossier ID
          console.log('⏳ Waiting for transaction to be mined...');
          let retries = 0;
          let dossierId = null;
          
          while (retries < 10 && !dossierId) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
              // Query using smart wallet address
              const smartAddress = smartWalletClient.account.address;
              const dossierIds = await ContractService.getUserDossierIds(smartAddress as Address);
              console.log(`📊 Attempt ${retries + 1}: Smart wallet ${smartAddress} has ${dossierIds.length} dossiers`);
              
              const previousCount = userDossierIds.length;
              if (dossierIds.length > previousCount) {
                dossierId = dossierIds[dossierIds.length - 1];
                console.log('🆔 New dossier ID found:', dossierId?.toString());
                break;
              }
            } catch (error) {
              console.warn(`Attempt ${retries + 1} failed:`, error);
            }
            
            retries++;
          }
          
          if (!dossierId) {
            console.warn('⚠️ Could not retrieve dossier ID immediately, but transaction was successful');
            // Use the expected ID as fallback
            dossierId = nextDossierId;
          }
          
          result = { dossierId, txHash };
        } else {
          // Fallback to regular transaction
          console.log('⚠️ Smart wallet not available, using regular transaction');
          result = await ContractService.createDossier(
            dossierName,
            checkInMinutes,
            recipients,
            fileHashes
          );
        }
        
        dossierId = result.dossierId;
        contractTxHash = result.txHash;
        setCurrentDossierId(dossierId);
        
        console.log('✅ Dossier created on-chain!');
        console.log('🆔 Dossier ID:', dossierId?.toString() || 'Unknown');
        console.log('🔗 Contract TX:', contractTxHash);
        
        // Verify the ID matches our prediction
        if (dossierId && dossierId !== nextDossierId) {
          console.warn(`⚠️ Dossier ID mismatch: predicted ${nextDossierId}, got ${dossierId}`);
        } else if (dossierId) {
          console.log('✅ Dossier ID prediction was correct!');
        }
        
      } catch (error) {
        console.error('❌ Failed to create dossier:', error);
        
        // Handle specific error types gracefully
        let errorMessage = 'Failed to create document';
        if (error instanceof Error) {
          if (error.message.includes('rejected by user')) {
            errorMessage = 'Transaction cancelled';
            toast.dismiss(processingToast);
            toast(errorMessage);
            setIsProcessing(false);
            return;
          } else if (error.message.includes('insufficient funds')) {
            errorMessage = 'Insufficient funds for transaction. Please add MATIC to your wallet.';
          } else if (error.message.includes('Check-in interval must be between')) {
            errorMessage = error.message;
          } else if (error.message.includes('Maximum number of dossiers reached')) {
            errorMessage = 'You have reached the maximum number of documents allowed.';
          } else if (error.message.includes('Wrong network')) {
            errorMessage = 'Please switch to Polygon Amoy network in your wallet.';
          } else {
            errorMessage = error.message || 'Failed to create document';
          }
        }
        
        toast.error(errorMessage, { id: processingToast });
        setIsProcessing(false);
        return;
      }

      // Step 5: Store results
      setEncryptedCapsule(encryptionResult);
      
      // Create enhanced trace JSON with dossier information
      const enhancedTraceJson = {
        ...traceJson,
        dossier_id: dossierId?.toString() || 'pending',
        user_address: address,
        contract_address: CANARY_DOSSIER_ADDRESS,
        contract_chain_id: polygonAmoy.id.toString(),
        contract_tx_hash: contractTxHash,
        check_in_interval_minutes: checkInMinutes,
        condition_type: 'dossier_contract_verification',
        encryption_method: 'dossier_only',
        gasless: !!smartWalletClient
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
        contractDossierId: dossierId?.toString() || 'pending',
        contractTxHash: contractTxHash
      }]);
      
      // Load updated dossiers
      await loadUserDossiers();
      
      // Add to activity log
      setActivityLog(prev => [
        { type: `✅ Dossier #${dossierId?.toString() || 'pending'} created with contract condition${smartWalletClient && authMode === 'standard' ? ' (gasless)' : ''}`, date: new Date().toLocaleString() },
        { type: `🔒 File encrypted with Dossier-only condition`, date: new Date().toLocaleString() },
        { type: `📁 IPFS hash ${traceJson.payload_uri} stored on-chain`, date: new Date().toLocaleString() },
        { type: `📦 File committed to ${commitResult.storageType}`, date: new Date().toLocaleString() },
        ...prev
      ]);
      
      const successMessage = authMode === 'standard'
        ? `🎉 Document secured! Remember to check in every ${checkInInterval} days.`
        : `🎉 Dossier #${dossierId} created! Check-in required every ${checkInInterval} days.`;
      toast.success(successMessage, { id: processingToast });
      
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
      
      toast.error(
        authMode === 'standard' 
          ? 'Failed to secure your document. Please try again.' 
          : `Dossier encryption failed: ${errorMessage}`, 
        { id: processingToast }
      );
      
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
      
      const mimeType = getMimeType(originalName);
      const blob = new Blob([decryptedData], { type: mimeType });
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
    setIsLoadingDossiers(true);
    let currentAddress: string | null = null;
    
    // In advanced mode, use the connected Web3 wallet address
    // In standard mode, use smart wallet if available, otherwise embedded wallet
    if (authMode === 'advanced') {
      currentAddress = address; // Web3 wallet address from wagmi
      console.log('🔧 Advanced mode - using Web3 wallet address:', currentAddress);
    } else {
      // Standard mode: prefer smart wallet for gasless transactions
      const smartWalletAddress = smartWalletClient?.account?.address;
      const embeddedWalletAddress = wallets.length > 0 ? wallets[0]?.address : null;
      currentAddress = smartWalletAddress || embeddedWalletAddress;
      console.log('🎯 Standard mode - smart wallet:', smartWalletAddress, 'embedded:', embeddedWalletAddress);
    }
    
    if (!currentAddress) {
      console.log('No wallet address available for loading dossiers');
      return;
    }
    
    try {
      console.log('📋 Loading user dossiers from contract');
      console.log('🔑 Auth mode:', authMode);
      console.log('🎯 Using address:', currentAddress);
      
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
      setIsLoadingDossiers(false);
      console.log(`✅ Loaded ${dossiers.length} dossiers with accurate decryptable status`);
      
    } catch (error) {
      console.error('❌ Failed to load dossiers:', error);
      setIsLoadingDossiers(false);
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
      
      // Show loading state first
      const checkInToast = toast.loading(authMode === 'standard' ? 'Updating your documents...' : 'Checking in to all active documents...');
      
      try {
        console.log('✅ Performing bulk on-chain check-in for all active dossiers...');
        
        // Use smart wallet for gasless check-in only in standard mode
        let txHash;
        if (smartWalletClient && authMode === 'standard') {
          console.log('🚀 Using smart wallet for gasless check-in...');
          
          // Create the transaction data for checkInAll
          const txData = encodeFunctionData({
            abi: CANARY_DOSSIER_ABI,
            functionName: 'checkInAll',
            args: []
          });
          
          txHash = await smartWalletClient.sendTransaction({
            account: smartWalletClient.account,
            chain: polygonAmoy,
            to: CANARY_DOSSIER_ADDRESS,
            data: txData,
          });
        } else {
          console.log('⚠️ Smart wallet not available, using regular transaction');
          txHash = await ContractService.checkInAll();
        }
        
        // Success - all active dossiers checked in with single transaction
        toast.success(
          authMode === 'standard' 
            ? `✅ All ${activeDossiers.length} documents updated!` 
            : `✅ Successfully checked in to all ${activeDossiers.length} active documents!`, 
          { id: checkInToast }
        );
        
        setActivityLog(prev => [
          { type: `✅ Bulk check-in successful for ${activeDossiers.length} documents (TX: ${txHash.slice(0, 10)}...)`, date: now.toLocaleString() },
          ...prev
        ]);
        
        // Reload dossiers to get updated lastCheckIn times
        await loadUserDossiers();
        
      } catch (error) {
        console.error('❌ Bulk check-in failed:', error);
        
        // Enhanced error handling with specific messages
        let errorMessage = 'Check-in failed. Please try again.';
        let isUserRejection = false;
        
        if (error instanceof Error) {
          if (error.message.includes('No dossiers found')) {
            errorMessage = 'No documents found to check in to.';
          } else if (error.message.includes('No active dossiers')) {
            errorMessage = 'No active documents found to check in to.';
          } else if (error.message.includes('user rejected') || error.message.includes('rejected by user')) {
            errorMessage = 'Check-in cancelled';
            isUserRejection = true;
          } else if (error.message.includes('insufficient funds')) {
            errorMessage = 'Insufficient funds for transaction fees. Please add MATIC to your wallet.';
          } else if (error.message.includes('Network mismatch')) {
            errorMessage = 'Please switch to Polygon Amoy network in your wallet.';
          } else if (error.message.includes('wallet provider')) {
            errorMessage = 'Wallet connection issue. Please reconnect your wallet.';
          } else if (error.message.includes('Both bulk and individual')) {
            errorMessage = 'Network issue prevented check-in. Please try again.';
          }
        }
        
        // Handle user rejection more gracefully
        if (isUserRejection) {
          toast.dismiss(checkInToast);
          toast(errorMessage);
          // Don't log cancellations as failures
          setActivityLog(prev => [
            { type: `ℹ️ Check-in cancelled by user`, date: now.toLocaleString() },
            ...prev
          ]);
        } else {
          toast.error(errorMessage, { id: checkInToast });
          setActivityLog(prev => [
            { type: `❌ Check-in failed: ${errorMessage}`, date: now.toLocaleString() },
            ...prev
          ]);
        }
      } finally {
        setIsCheckingIn(false);
      }
    } else if (!isConnected) {
      toast.error(authMode === 'standard' ? 'Please sign in to update your documents' : 'Please connect your wallet to check in');
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
        return { expired: false, display: 'NO ACTIVE DOSSIERS', color: 'text-gray-500 dark:text-gray-400' };
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
      return { expired: false, display: 'NO DOCUMENTS', color: 'text-muted' };
    }
    
    // If not connected, show disconnected status
    return { expired: false, display: 'DISCONNECTED', color: 'text-gray-500 dark:text-gray-400' };
  };

  const getCountdownTime = () => {
    // If connected and have dossiers, calculate actual countdown
    if (hasWalletConnection() && userDossiers.length > 0) {
      const activeDossiers = userDossiers.filter(d => d.isActive);
      
      // If no active dossiers, show inactive status
      if (activeDossiers.length === 0) {
        return { expired: false, display: 'NO ACTIVE DOSSIERS', color: 'text-gray-500 dark:text-gray-400' };
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
        return { expired: true, display: '⚠ EXPIRED', color: 'text-red-600 dark:text-red-400' };
      }
      
      // If we have a valid remaining time, format it
      if (shortestRemainingMs !== Infinity && shortestRemainingMs > 0) {
        const remainingHours = Math.floor(shortestRemainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((shortestRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const remainingSeconds = Math.floor((shortestRemainingMs % (1000 * 60)) / 1000);
        
        let color = 'text-gray-900 dark:text-gray-100';
        if (shortestRemainingMs < 5 * 60 * 1000) {
          color = 'text-red-600 dark:text-red-400';
        } else if (shortestRemainingMs < 30 * 60 * 1000) {
          color = 'text-orange-600 dark:text-orange-400';
        } else if (shortestRemainingMs < 2 * 60 * 60 * 1000) {
          color = 'text-yellow-700 dark:text-yellow-400';
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
      return { expired: false, display: 'NO DOCUMENTS', color: 'text-muted' };
    }
    
    // If not connected, show disconnected status
    return { expired: false, display: 'DISCONNECTED', color: 'text-gray-500 dark:text-gray-400' };
  };



  const handleSignIn = (method: string) => {
    console.log('Sign in method:', method);
    
    if (method === 'Web3 Wallet') {
      // Use Privy's connectWallet for external wallet connections
      console.log('Using Privy connectWallet for external wallet...');
      setAuthModeWithPersistence('advanced'); // Set advanced mode for Web3 wallet
      try {
        connectWallet();
      } catch (error) {
        console.error('Failed to connect external wallet via Privy:', error);
      }
    } else if (method === 'Email') {
      // Email sign-in via Privy
      console.log('Privy states:', { ready, authenticated, signedIn });
      setAuthModeWithPersistence('standard'); // Set standard mode for email auth
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
      setAuthModeWithPersistence('advanced'); // User connected with Web3 wallet
      setSignedIn(true);
    }
  }, [isConnected, signedIn, authenticated]);

  // Auto sign-in if Privy is authenticated
  useEffect(() => {
    console.log('Auto sign-in effect triggered:', { ready, authenticated, signedIn });
    if (ready && authenticated && !signedIn) {
      console.log('Auto-signing in authenticated Privy user...');
      setAuthModeWithPersistence('standard'); // User authenticated with email/Privy
      setSignedIn(true);
    }
  }, [ready, authenticated]);

  // Log smart wallet status
  useEffect(() => {
    console.log('💜 Smart wallet status:', {
      hasSmartWallet: !!smartWalletClient,
      smartWalletAccount: smartWalletClient?.account?.address,
      userSmartWallet: user?.smartWallet,
      authenticated,
      wallets: wallets.length
    });
  }, [smartWalletClient, user, authenticated, wallets]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, authenticated, wallets, authMode]);

  // Reload dossiers when smart wallet becomes available in standard mode
  useEffect(() => {
    if (smartWalletClient && signedIn && authMode === 'standard') {
      console.log('🔄 Smart wallet now available in standard mode, reloading dossiers...');
      loadUserDossiers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartWalletClient, signedIn, authMode]);

  // Show sign-in page if not signed in
  if (!signedIn) {
    return (
      <div className="light">
        <Toaster position="top-right" />
        <div className="h-screen flex flex-col">
          <div className="flex-1 bg-gray-50 flex items-center justify-center relative">
          
          {/* Cryptographic Pattern Accent */}
          <div className="crypto-dot-matrix absolute inset-0 pointer-events-none"></div>
          
          {/* Main Sign-in Area */}
          <div className="max-w-xl w-full mx-auto px-8">
            <div className="text-center">
              {/* Logo - Centered Above Title */}
              <div className="mb-8">
                <img 
                  src="/canary.png" 
                  alt="Canary" 
                  className="h-16 w-auto mx-auto opacity-90"
                  style={{
                    filter: 'drop-shadow(0 1px 3px rgba(31, 31, 31, 0.1))'
                  }}
                />
              </div>
              
              {/* Title and Subtitle */}
              <div className="mb-12">
                <h1 className="editorial-header-large text-center mb-4">
                  Try the Canary Testnet Demo
                </h1>
                <p className="editorial-body-large text-secondary max-w-sm mx-auto font-medium">
                  Truth protection through cryptographic deadman switches
                </p>
              </div>

              {/* Sign-in Buttons */}
              <div className="space-y-4 max-w-sm mx-auto mb-16">
                <button
                  className="w-full py-4 px-6 bg-black text-white font-medium text-base rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                  onClick={() => handleSignIn('Email')}
                  disabled={!ready}
                >
                  {!ready ? 'Initializing...' : 'Sign in with Email'}
                </button>
                
                <div className="text-center">
                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-gray-300"></div>
                    <span className="text-xs font-medium text-gray-500 tracking-widest">ADVANCED</span>
                    <div className="flex-1 h-px bg-gray-300"></div>
                  </div>
                  
                  <button
                    className="w-full py-4 px-6 bg-white text-gray-900 font-medium text-base rounded border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleSignIn('Web3 Wallet')}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        <span>Connecting...</span>
                      </div>
                    ) : (
                      'Connect Web3 Wallet'
                    )}
                  </button>
                </div>
              </div>


            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t backdrop-blur-sm flex-shrink-0 border-gray-200 bg-white/80">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-center gap-6">
              <a
                href="https://canaryapp.io"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs transition-colors text-gray-600 hover:text-gray-900"
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
                className="flex items-center gap-1.5 text-xs transition-colors text-gray-600 hover:text-gray-900"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Docs</span>
              </a>
              
              <a
                href="https://canaryapp.io/support"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs transition-colors text-gray-600 hover:text-gray-900"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>Support</span>
              </a>
              
              <a
                href="https://github.com/TheThirdRoom/canary"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs transition-colors text-gray-600 hover:text-gray-900"
              >
                <Github size={10} />
                <span>Source</span>
              </a>
              
              <a
                href="mailto:contact@canaryapp.io"
                className="flex items-center gap-1.5 text-xs transition-colors text-gray-600 hover:text-gray-900"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Contact</span>
              </a>
            </div>
            
            <div className="text-center mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                © 2025 Canary. Truth protection through cryptographic deadman switches.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
  }
  
  // Main app content for signed-in users
  return (
    <div>
      <Toaster position="top-right" />
      <Suspense fallback={null}>
        <HomeContent onViewChange={setCurrentView} />
      </Suspense>
      <div className={`h-screen flex flex-col ${theme === 'light' ? 'bg-white' : 'bg-gray-900'}`}>
        
        {/* Alpha Status Indicator */}
        {showAlphaBanner && (
        <div className={`border-b flex-shrink-0 ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-black border-gray-700'}`}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between h-12">
              <div className="w-4 h-4"></div>
              <div className="flex items-center justify-center flex-1">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  Testnet demo · No production guarantees · Use at your own risk
                </span>
              </div>
              <button
                onClick={() => setShowAlphaBanner(false)}
                className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors w-4 h-4 flex items-center justify-center flex-shrink-0"
                aria-label="Close banner"
              >
                ×
              </button>
            </div>
          </div>
        </div>
        )}
        
        <div className="flex-1" style={{ zoom: '0.8' }}>
        
        {/* Header */}
        <header className={`border-b backdrop-blur-sm ${theme === 'light' ? 'border-gray-200 bg-white/80' : 'border-gray-700 bg-gray-900/80'}`} style={{ marginTop: '0px' }}>
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between h-10">
              {/* Left: Logo */}
              <div className="flex items-center">
                <img 
                  src="/canary.png" 
                  alt="Canary" 
                  className="h-12 w-auto"
                  style={{
                    filter: 'drop-shadow(0 1px 4px rgba(0, 0, 0, 0.1))'
                  }}
                />
              </div>
              
              {/* Right: Navigation and Wallet Status */}
              <div className="flex items-center gap-8">
                {/* Main Navigation */}
                <nav className="flex items-center gap-6 h-full">
                  <button 
                    onClick={() => setCurrentView('checkin')}
                    className={`nav-link ${
                      currentView === 'checkin' ? 'nav-link-active' : ''
                    }`}
                  >
                    Check In
                  </button>
                  <button 
                    onClick={() => setCurrentView('documents')}
                    className={`nav-link ${
                      currentView === 'documents' ? 'nav-link-active' : ''
                    }`}
                  >
                    Documents
                  </button>
                  <a 
                    href="/feed"
                    className="nav-link"
                  >
                    Impact Feed
                  </a>
                </nav>
                
                {/* Wallet Status and Theme Toggle */}
                <div className="flex items-center gap-6">
                
                {/* Theme Toggle */}
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
                
                {/* Authentication Status */}
                {hasWalletConnection() ? (
                  <div className="flex items-center gap-4">
                    {authMode === 'advanced' && address ? (
                      // Advanced mode: Show wallet address
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-gray-800'}`}>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className={`monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                          {`${address.slice(0, 6)}...${address.slice(-4)}`}
                        </span>
                      </div>
                    ) : authMode === 'standard' && authenticated ? (
                      // Standard mode: Show user email or authenticated status
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-600 bg-gray-800'}`}>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className={`monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                          {user?.email?.address || 'Signed In'}
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
                        // Reset all states and redirect to login
                        setSignedIn(false);
                        setAuthModeWithPersistence('standard');
                        setCurrentView('checkin'); // Reset to default view
                        setShowCreateForm(false); // Close any open forms
                        setDocumentDetailView(false); // Close document detail
                        setSelectedDocument(null); // Clear selected document
                        // Clear dossiers data
                        setUserDossiers([]);
                        setIsLoadingDossiers(true);
                      }}
                      className="text-sm text-muted hover:text-primary transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <span>Not Signed In</span>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        </header>

      <div className="flex-1 overflow-auto">
      {currentView === 'checkin' ? (
        // Check In View - Matching Impact Feed Layout
        <div className={`min-h-screen ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Page Header - Like Impact Feed */}
          <div className="mb-12 border-b border-gray-200 dark:border-gray-700 pb-8">
            <h1 className="editorial-header-large text-gray-900 dark:text-gray-100 mb-3">
              CHECK IN
            </h1>
            <p className="editorial-body text-gray-600 dark:text-gray-400">
              Maintain your system status and manage your encrypted documents
            </p>
          </div>
            
          {hasWalletConnection() && isLoadingDossiers ? (
            // Loading State for Check-in View
            <div className="space-y-8">
              {/* System Control Card Skeleton */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                <div className="animate-pulse">
                  <div className="flex justify-between items-center mb-8">
                    <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-32"></div>
                    <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full w-16"></div>
                  </div>
                  <div className="flex justify-center mb-10">
                    <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-32"></div>
                  </div>
                  <div className="h-16 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg"></div>
                </div>
              </div>
              
              {/* Status Cards Skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                    <div className="animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-24 mb-2"></div>
                          <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-32"></div>
                        </div>
                        <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-16"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : hasWalletConnection() && userDossiers.length > 0 ? (
            <div>
              {/* Combined System Control Card */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-12" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                {/* System Control Header */}
                <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                  <span className="editorial-label text-gray-700 dark:text-gray-400">
                    SYSTEM CONTROL
                  </span>
                  {/* Toggle Switch */}
                  <button
                    onClick={() => setDummyMasterSwitch(!dummyMasterSwitch)}
                    className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${
                      dummyMasterSwitch ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                      dummyMasterSwitch ? 'translate-x-7' : 'translate-x-0'
                    }`} />
                    <span className={`absolute inset-0 flex items-center ${
                      dummyMasterSwitch ? 'justify-start pl-2' : 'justify-end pr-2'
                    }`}>
                      <span className="text-[10px] font-bold text-white">
                        {dummyMasterSwitch ? 'ON' : 'OFF'}
                      </span>
                    </span>
                  </button>
                </div>
                
                {/* Status and Check-in Section - Inside the same card */}
                <div className="px-6 py-8 text-center">
                <h2 
                  className={`text-5xl font-bold mb-10 ${
                    dummyMasterSwitch 
                      ? 'dark:text-white' 
                      : 'dark:text-gray-500'
                  }`}
                  style={{ 
                    color: dummyMasterSwitch 
                      ? (typeof window !== 'undefined' && !document.documentElement.classList.contains('dark') ? '#000000' : undefined)
                      : (typeof window !== 'undefined' && !document.documentElement.classList.contains('dark') ? '#9ca3af' : undefined)
                  }}
                >
                  {dummyMasterSwitch ? 'ACTIVE' : 'INACTIVE'}
                </h2>

                {/* Check In Button - Prominent with thin border */}
                <button
                  onClick={handleCheckIn}
                  disabled={isCheckingIn || !dummyMasterSwitch || userDossiers.filter(d => d.isActive).length === 0}
                  className={`max-w-md mx-auto block px-12 py-6 rounded-lg font-semibold text-lg transition-all ${
                    dummyMasterSwitch && !isCheckingIn
                      ? 'hover:bg-gray-50 dark:hover:bg-gray-800' 
                      : 'cursor-not-allowed'
                  }`}
                  style={{ 
                    backgroundColor: dummyMasterSwitch && !isCheckingIn ? (theme === 'light' ? 'white' : '#000000') : (theme === 'light' ? '#f9fafb' : '#111111'),
                    color: dummyMasterSwitch && !isCheckingIn ? (theme === 'light' ? '#111827' : 'white') : (theme === 'light' ? '#9ca3af' : '#6b7280'),
                    border: '1px solid',
                    borderColor: dummyMasterSwitch && !isCheckingIn ? (theme === 'light' ? '#e5e7eb' : 'white') : (theme === 'light' ? '#e5e7eb' : '#374151')
                  }}
                >
                  {isCheckingIn ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent"></div>
                      <span>Checking In...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Check In Now</span>
                    </div>
                  )}
                </button>
                </div>
              </div>

              {/* Status Information - Horizontal Grid on Desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* System Status Card */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5 flex items-center justify-between" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      getCountdownTime().display === 'EXPIRED' 
                        ? 'bg-red-500 animate-pulse' 
                        : 'bg-green-500'
                    }`} />
                    <div>
                      <div className="text-base font-medium" style={{ color: theme === 'light' ? '#000000' : '#f3f4f6' }}>
                        System Status
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                        {getCountdownTime().display === 'EXPIRED' ? 'Check-in required' : 'System healthy'}
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${getCountdownTime().color}`}>
                    {getCountdownTime().display}
                  </div>
                </div>

                {/* Last Check-in Card */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5 flex items-center justify-between" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                  <div>
                    <div className="text-base font-medium" style={{ color: theme === 'light' ? '#000000' : '#f3f4f6' }}>
                      Last Check-in
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      Time since last activity
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 monospace-accent">
                    {getTimeSinceLastCheckIn()}
                  </div>
                </div>

                {/* Active Documents Card */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5 flex items-center justify-between" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                  <div>
                    <div className="text-base font-medium" style={{ color: theme === 'light' ? '#000000' : '#f3f4f6' }}>
                      Active Documents
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      Protected with encryption
                    </div>
                  </div>
                  <div className="text-lg font-bold" style={{ color: theme === 'light' ? '#000000' : '#f3f4f6' }}>
                    {userDossiers.filter(d => d.isActive).length}
                  </div>
                </div>
              </div>

              {/* Share Status Button - Matching Impact Feed style */}
              <div className="mt-8">
                <button
                  onClick={() => {
                    const currentAddress = getCurrentAddress();
                    const shareUrl = `${window.location.origin}/share/${currentAddress}`;
                    navigator.clipboard.writeText(shareUrl).then(() => {
                      toast.success('Share link copied!', {
                        duration: 3000,
                      });
                    }).catch(() => {
                      toast.error('Failed to copy share link');
                    });
                  }}
                  className="w-full py-4 px-6 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  style={{ 
                    backgroundColor: theme === 'light' ? 'white' : '#000000',
                    color: theme === 'light' ? '#000000' : '#d1d5db'
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: theme === 'light' ? '#000000' : '#d1d5db' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    <span className="text-sm font-medium" style={{ color: theme === 'light' ? '#000000' : '#d1d5db' }}>Share Status</span>
                  </div>
                </button>
              </div>
            </div>
          ) : !hasWalletConnection() ? (

            // Connection Prompt - Clean style
            <div>
              <div className="text-center py-16 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-black">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full mb-6">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-3">
                  Connect to Begin
                </h3>
                <p className="editorial-body text-gray-600 dark:text-gray-400 mb-6">
                  Connect your wallet or sign in with email to start protecting your documents
                </p>
                <button
                  onClick={() => setCurrentView('documents')}
                  className="editorial-button editorial-button-primary inline-flex items-center gap-2"
                >
                  <span className="font-medium">Get Started</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            // No Documents State - Clean style
            <div>
              <div className="text-center py-16 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-black">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full mb-6">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-3">
                  No Active Documents
                </h3>
                <p className="editorial-body text-gray-600 dark:text-gray-400 mb-6">
                  Create your first encrypted document to get started
                </p>
                <button
                  onClick={() => setCurrentView('documents')}
                  className="editorial-button editorial-button-primary inline-flex items-center gap-2"
                >
                  <span className="font-medium">Create Document</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      ) : (
        // Documents View - Matching Impact Feed Layout
        <div className={`min-h-screen ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {documentDetailView && selectedDocument ? (
            // Document Detail View
            <div className="spacing-section">
              {/* Navigation Header */}
              <div className="mb-6">
                <button
                  onClick={closeDocumentDetail}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    theme === 'light' 
                      ? 'text-gray-600 hover:text-gray-900' 
                      : 'text-gray-400 hover:text-gray-100'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Documents
                </button>
              </div>

              {/* Document Detail Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Information Panel */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Document Overview */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <h1 className="editorial-header-large text-gray-900 dark:text-gray-100 mb-2">
                            {selectedDocument.name.replace('Encrypted file: ', '')}
                          </h1>
                          <div className="flex items-center gap-4">
                            <div className={`status-indicator text-xs ${
                              (() => {
                                if (!selectedDocument.isActive) return 'status-inactive';
                                
                                const lastCheckInMs = Number(selectedDocument.lastCheckIn) * 1000;
                                const intervalMs = Number(selectedDocument.checkInInterval) * 1000;
                                const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
                                const remainingMs = intervalMs - timeSinceLastCheckIn;
                                const isTimeExpired = remainingMs <= 0;
                                
                                return isTimeExpired ? 'status-expired' : 'status-active';
                              })()
                            }`}>
                              <div className="status-dot"></div>
                              <span>
                                {(() => {
                                  if (!selectedDocument.isActive) return 'Inactive';
                                  
                                  const lastCheckInMs = Number(selectedDocument.lastCheckIn) * 1000;
                                  const intervalMs = Number(selectedDocument.checkInInterval) * 1000;
                                  const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
                                  const remainingMs = intervalMs - timeSinceLastCheckIn;
                                  const isTimeExpired = remainingMs <= 0;
                                  
                                  return isTimeExpired ? 'Expired' : 'Active';
                                })()}
                              </span>
                            </div>
                            <div className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                              Document #{selectedDocument.id.toString()}
                            </div>
                          </div>
                        </div>
                        

                      </div>
                    </div>


                  </div>

                  {/* Timing Information */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                    <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-4">Timing & Schedule</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className={`editorial-label-small ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                            Check-in Interval
                          </div>
                          <div className={`text-lg font-semibold monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                            {(() => {
                              const hours = Math.floor(Number(selectedDocument.checkInInterval) / 3600);
                              const minutes = Math.floor((Number(selectedDocument.checkInInterval) % 3600) / 60);
                              if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
                              if (hours > 0) return `${hours} hours`;
                              return `${minutes} minutes`;
                            })()}
                          </div>
                        </div>
                        <div>
                          <div className={`editorial-label-small ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                            Last Check-in
                          </div>
                          <div className={`text-lg font-semibold monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                            {new Date(Number(selectedDocument.lastCheckIn) * 1000).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      

                    </div>
                  </div>

                  {/* File Information */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                    <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-4">Encrypted Files</h3>
                    <div className="space-y-3">
                      {selectedDocument.encryptedFileHashes.map((hash, index) => (
                        <div key={index} className={`p-3 border rounded ${theme === 'light' ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className={`text-sm font-medium ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                                File #{index + 1}
                              </div>
                              <div className={`text-xs monospace-accent ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'} break-all`}>
                                {hash}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(hash);
                                toast.success('Hash copied to clipboard');
                              }}
                              className={`ml-2 p-1 rounded text-xs ${
                                theme === 'light'
                                  ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                              }`}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Panel */}
                <div className="space-y-6">
                  {/* Quick Actions */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                    <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-4">Actions</h3>
                    <div className="space-y-3">
                      {/* Check In Button */}
                      {selectedDocument.isActive && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleCheckIn();
                          }}
                          disabled={isCheckingIn}
                          className="w-full py-3 px-4 editorial-button-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCheckingIn ? 'Checking In...' : 'Check In'}
                        </button>
                      )}
                      
                      {/* Decrypt Button */}
                      {(() => {
                        const lastCheckInMs = Number(selectedDocument.lastCheckIn) * 1000;
                        const intervalMs = Number(selectedDocument.checkInInterval) * 1000;
                        const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
                        const remainingMs = intervalMs - timeSinceLastCheckIn;
                        const isTimeExpired = remainingMs <= 0;
                        const shouldShowButton = (isTimeExpired || selectedDocument.isDecryptable) && selectedDocument.encryptedFileHashes.length > 0;
                        
                        return shouldShowButton ? (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              // Add decrypt logic here (reuse from the card view)
                              let decryptToast: any;
                              try {
                                console.log('🔓 Attempting decryption for dossier:', selectedDocument.id.toString());
                                
                                if (selectedDocument.encryptedFileHashes.length > 0) {
                                  const fileHash = selectedDocument.encryptedFileHashes[0];
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
                                      console.log(`🌐 Trying gateway: ${gateway}`);
                                      const response = await fetch(gateway);
                                      if (response.ok) {
                                        const arrayBuffer = await response.arrayBuffer();
                                        retrievedData = new Uint8Array(arrayBuffer);
                                        gatewayUsed = gateway;
                                        console.log(`✅ Successfully retrieved data from: ${gateway}`);
                                        break;
                                      } else {
                                        console.log(`❌ Gateway failed with status ${response.status}: ${gateway}`);
                                      }
                                    } catch (error) {
                                      console.log(`❌ Gateway error: ${gateway}`, error);
                                    }
                                  }
                                  
                                  if (!retrievedData) {
                                    throw new Error('Failed to retrieve encrypted data from IPFS using any gateway');
                                  }
                                  
                                  console.log(`📥 Successfully retrieved encrypted data:`);
                                  console.log(`   - IPFS hash: ${ipfsHash}`);
                                  console.log(`   - Gateway used: ${gatewayUsed}`);
                                  console.log(`   - Data length: ${retrievedData.length} bytes`);
                                  
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
                                  const originalFileName = selectedDocument.name.replace('Encrypted file: ', '') || 'decrypted-document';
                                  const mimeType = getMimeType(originalFileName);
                                  const blob = new Blob([decryptedData], { type: mimeType });
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
                                      type: `🔓 Document #${selectedDocument.id.toString()} decrypted and downloaded`, 
                                      date: new Date().toLocaleString() 
                                    },
                                    ...prev
                                  ]);
                                } else {
                                  toast.error(`No encrypted files found in this dossier. Dossier #${selectedDocument.id.toString()} appears to be empty or corrupted.`);
                                }
                              } catch (error) {
                                console.error('❌ Decryption failed:', error);
                                toast.error(`Failed to decrypt document: ${error}`, { id: decryptToast });
                              }
                            }}
                            className="w-full py-3 px-4 editorial-button"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              <span>Download</span>
                            </div>
                          </button>
                        ) : null;
                      })()}
                      
                      {/* Pause/Resume Button */}
                      <button
                                                 onClick={async (e) => {
                           e.stopPropagation();
                           try {
                             if (selectedDocument.isActive) {
                               await ContractService.deactivateDossier(selectedDocument.id);
                             } else {
                               await ContractService.reactivateDossier(selectedDocument.id);
                             }
                             
                             await loadUserDossiers();
                             setActivityLog(prev => [
                               { 
                                 type: `Document #${selectedDocument.id.toString()} ${selectedDocument.isActive ? 'deactivated' : 'resumed'}`, 
                                 date: new Date().toLocaleString() 
                               },
                               ...prev
                             ]);
                           } catch (error) {
                             console.error('Failed to toggle document status:', error);
                             toast.error('Failed to update document status. Please try again.');
                           }
                         }}
                        className="w-full editorial-button"
                      >
                        <div className="flex items-center justify-center gap-2">
                          {selectedDocument.isActive ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <rect x="6" y="4" width="4" height="16" />
                              <rect x="14" y="4" width="4" height="16" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <polygon points="8,5 8,19 19,12" />
                            </svg>
                          )}
                          <span>{selectedDocument.isActive ? 'Pause Document' : 'Resume Document'}</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Recipients List */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                    <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-4">Recipients</h3>
                    <div className="space-y-2">
                      {selectedDocument.recipients.map((recipient, index) => (
                        <div key={index} className={`p-3 border rounded ${theme === 'light' ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                                Recipient #{index + 1}
                              </div>
                              <div className={`text-sm monospace-accent ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'} break-all`}>
                                {recipient}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(recipient);
                                toast.success('Address copied to clipboard');
                              }}
                              className={`ml-2 p-1 rounded text-xs ${
                                theme === 'light'
                                  ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                              }`}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>


                </div>
              </div>
            </div>
          ) : !showCreateForm ? (
            <>
              {/* Page Header - Like Impact Feed */}
              <div className="mb-12 border-b border-gray-200 dark:border-gray-700 pb-8">
                <h1 className="editorial-header-large text-gray-900 dark:text-gray-100 mb-3">
                  DOCUMENTS
                </h1>
                <p className="editorial-body text-gray-600 dark:text-gray-400">
                  Create and manage encrypted documents with conditional release triggers
                </p>
              </div>

              {/* Documents Content */}
              {hasWalletConnection() && isLoadingDossiers ? (
                // Loading Animation for Documents
                <div className="space-y-6">
                  {/* Filter skeleton */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="animate-pulse">
                      <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-32"></div>
                    </div>
                    <div className="animate-pulse">
                      <div className="h-9 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-24"></div>
                    </div>
                  </div>
                  
                  {/* Document cards skeleton with shimmer */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="relative min-h-[180px] border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent"></div>
                        
                        <div className="p-6">
                          {/* Header skeleton */}
                          <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
                            <div className="flex justify-between items-start">
                              <div className="animate-pulse flex-1">
                                <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-3/4 mb-2"></div>
                              </div>
                              <div className="animate-pulse">
                                <div className="h-5 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-16"></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Body skeleton */}
                          <div className="text-center animate-pulse">
                            <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-24 mx-auto mb-2"></div>
                            <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-32 mx-auto mb-4"></div>
                          </div>
                          
                          {/* Footer skeleton */}
                          <div className="flex justify-between items-center animate-pulse">
                            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-20"></div>
                            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-20"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : hasWalletConnection() && (
                <div className="spacing-section">
                  <div className="spacing-medium">
                    {/* Filter Controls */}
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-6">
                        <span className="editorial-label text-gray-500 dark:text-gray-400">
                          {userDossiers.filter(d => showInactiveDocuments || d.isActive).length} DOCUMENT{userDossiers.filter(d => showInactiveDocuments || d.isActive).length !== 1 ? 'S' : ''}
                        </span>
                      </div>
                      
                      {/* Right side: Show All Button */}
                      {userDossiers.length > 0 && userDossiers.some(d => !d.isActive) && (
                        <button
                          onClick={() => setShowInactiveDocuments(!showInactiveDocuments)}
                          className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors ${
                            showInactiveDocuments 
                              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white' 
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750'
                          }`}
                        >
                          {showInactiveDocuments ? 'Hide Inactive' : 'Show All'}
                        </button>
                      )}
                    </div>
                    
                    {userDossiers.length === 0 && (
                      <div className="text-center py-16 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-black">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full mb-6">
                          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-3">
                          No Documents Yet
                        </h3>
                        <p className="editorial-body text-gray-600 dark:text-gray-400">
                          Create your first encrypted document to get started
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {userDossiers.length > 0 && (
                  <div className="">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {/* Add New Document Card - Always shown */}
                      <div 
                        onClick={() => setShowCreateForm(true)}
                        className="cursor-pointer group min-h-[180px] transition-all border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"
                        style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}
                      >
                        <div className="h-full flex flex-col items-center justify-center text-center p-6">
                          <div className={`transition-colors mb-6 ${
                            theme === 'light' 
                              ? 'text-gray-600 group-hover:text-gray-800' 
                              : 'text-gray-300 group-hover:text-white'
                          }`}>
                            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <div>
                            <h3 className={`text-xl font-semibold transition-colors mb-3 ${
                              theme === 'light' 
                                ? 'text-gray-900 group-hover:text-gray-800' 
                                : 'text-white group-hover:text-gray-100'
                            }`} style={{ fontFamily: 'var(--font-playfair)' }}>
                              Create Document
                            </h3>
                            <p className={`text-sm transition-colors ${
                              theme === 'light' 
                                ? 'text-gray-600 group-hover:text-gray-700' 
                                : 'text-gray-300 group-hover:text-gray-200'
                            }`}>
                              Encrypt and protect a new file with cryptographic deadman switches
                            </p>
                          </div>
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
                          
                          // Calculate grace period stats
                          const gracePeriodMs = contractConstants?.gracePeriod ? Number(contractConstants.gracePeriod) * 1000 : 3600000; // Default 1 hour
                          const totalTimeWithGrace = intervalMs + gracePeriodMs;
                          const remainingWithGraceMs = totalTimeWithGrace - timeSinceLastCheckIn;
                          const inGracePeriod = remainingMs <= 0 && remainingWithGraceMs > 0;
                          const fullyExpired = remainingWithGraceMs <= 0;
                          
                          let timeColor = 'text-green-600';
                          if (fullyExpired) {
                            timeColor = 'text-red-600';
                          } else if (inGracePeriod) {
                            timeColor = 'text-orange-600';
                          } else if (remainingMs < 5 * 60 * 1000) {
                            timeColor = 'text-red-600';
                          } else if (remainingMs < 30 * 60 * 1000) {
                            timeColor = 'text-orange-500';
                          } else if (remainingMs < 2 * 60 * 60 * 1000) {
                            timeColor = 'text-yellow-600';
                          }
                          
                          let timeDisplay = '';
                          let graceDisplay = '';
                          
                          if (!dossier.isActive) {
                            timeDisplay = 'Deactivated';
                            timeColor = 'text-muted';
                          } else if (fullyExpired) {
                            timeDisplay = '⚠ FULLY EXPIRED';
                            timeColor = 'text-red-600';
                          } else if (inGracePeriod) {
                            timeDisplay = '⚠ IN GRACE PERIOD';
                            // Calculate remaining grace time
                            const graceRemainingMs = remainingWithGraceMs;
                            const graceHours = Math.floor(graceRemainingMs / (1000 * 60 * 60));
                            const graceMinutes = Math.floor((graceRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
                            const graceSeconds = Math.floor((graceRemainingMs % (1000 * 60)) / 1000);
                            
                            if (graceHours > 0) {
                              graceDisplay = `${graceHours}H ${graceMinutes}M remaining`;
                            } else if (graceMinutes > 0) {
                              graceDisplay = `${graceMinutes}M ${graceSeconds}S remaining`;
                            } else {
                              graceDisplay = `${graceSeconds}S remaining`;
                            }
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
                              onClick={() => openDocumentDetail(dossier)}
                              className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5 min-h-[180px] flex flex-col cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-900"
                              style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}
                            >
                              {/* Card Header */}
                              <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
                                <div className="flex justify-between items-start">
                                  <h3 className="editorial-header text-primary flex-1 pr-4" title={dossier.name.replace('Encrypted file: ', '')}>
                                    {(() => {
                                      const displayName = dossier.name.replace('Encrypted file: ', '');
                                      return displayName.length > 28 ? `${displayName.substring(0, 28)}...` : displayName;
                                    })()}
                                  </h3>
                                  
                                  <div className={`status-indicator flex-shrink-0 ${
                                    (() => {
                                      if (!dossier.isActive) return 'status-inactive';
                                      
                                      const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
                                      const intervalMs = Number(dossier.checkInInterval) * 1000;
                                      const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
                                      const remainingMs = intervalMs - timeSinceLastCheckIn;
                                      const isTimeExpired = remainingMs <= 0;
                                      
                                      return isTimeExpired ? 'status-expired' : 'status-active';
                                    })()
                                  }`}>
                                    <div className="status-dot"></div>
                                    <span>
                                      {(() => {
                                        if (!dossier.isActive) return 'Inactive';
                                        
                                        const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
                                        const intervalMs = Number(dossier.checkInInterval) * 1000;
                                        const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
                                        const remainingMs = intervalMs - timeSinceLastCheckIn;
                                        const isTimeExpired = remainingMs <= 0;
                                        
                                        return isTimeExpired ? 'Expired' : 'Active';
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Card Body - Simplified */}
                              <div className="flex-1 mb-4">
                                {/* Time Display */}
                                <div className="text-center">
                                  <div className="editorial-label-small text-secondary mb-2">Time Remaining</div>
                                  <div className={`${timeColor} monospace-accent text-xl font-bold`}>
                                    {timeDisplay}
                                  </div>
                                  {/* Grace Period Display - Simplified */}
                                  {graceDisplay && (
                                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                                      <div className={`text-xs font-medium ${theme === 'light' ? 'text-orange-600' : 'text-orange-400'}`}>
                                        Grace: {graceDisplay}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Card Footer - Action Buttons */}
                              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-auto">
                                <div className="space-y-3">
                                  {/* Primary Actions */}
                                  <div className="flex gap-3">
                                    <button
                                      onClick={async () => {
                                        try {
                                          // Use smart wallet for gasless check-in only in standard mode
                                          if (smartWalletClient && authMode === 'standard') {
                                            const txData = encodeFunctionData({
                                              abi: CANARY_DOSSIER_ABI,
                                              functionName: 'checkIn',
                                              args: [dossier.id]
                                            });
                                            
                                            await smartWalletClient.sendTransaction({
                                              account: smartWalletClient.account,
                                              chain: polygonAmoy,
                                              to: CANARY_DOSSIER_ADDRESS,
                                              data: txData,
                                            });
                                          } else {
                                            await ContractService.checkIn(dossier.id);
                                          }
                                          
                                          await loadUserDossiers();
                                          setActivityLog(prev => [
                                            { 
                                              type: `Check-in performed for document #${dossier.id.toString()}${smartWalletClient && authMode === 'standard' ? ' (gasless)' : ''}`, 
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
                                      className={`flex-1 py-2 px-4 text-xs font-semibold border-2 transition-all ${
                                        dossier.isActive 
                                          ? 'editorial-button-primary' 
                                          : 'editorial-button'
                                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                      Check In
                                    </button>
                                    
                                    <button
                                      onClick={async () => {
                                        try {
                                          // Use smart wallet for gasless transaction only in standard mode
                                          if (smartWalletClient && authMode === 'standard') {
                                            const functionName = dossier.isActive ? 'deactivateDossier' : 'reactivateDossier';
                                            const txData = encodeFunctionData({
                                              abi: CANARY_DOSSIER_ABI,
                                              functionName,
                                              args: [dossier.id]
                                            });
                                            
                                            await smartWalletClient.sendTransaction({
                                              account: smartWalletClient.account,
                                              chain: polygonAmoy,
                                              to: CANARY_DOSSIER_ADDRESS,
                                              data: txData,
                                            });
                                          } else {
                                            if (dossier.isActive) {
                                              await ContractService.deactivateDossier(dossier.id);
                                            } else {
                                              await ContractService.reactivateDossier(dossier.id);
                                            }
                                          }
                                          
                                          await loadUserDossiers();
                                          setActivityLog(prev => [
                                            { 
                                              type: `Document #${dossier.id.toString()} ${dossier.isActive ? 'deactivated' : 'resumed'}${smartWalletClient && authMode === 'standard' ? ' (gasless)' : ''}`, 
                                              date: new Date().toLocaleString() 
                                            },
                                            ...prev
                                          ]);
                                        } catch (error) {
                                          console.error('Failed to toggle document status:', error);
                                          
                                          // Handle specific error types gracefully
                                          let errorMessage = 'Failed to update document status. Please try again.';
                                          if (error instanceof Error) {
                                                                        if (error.message.includes('rejected by user')) {
                              toast('Action cancelled');
                              return;
                                            } else if (error.message.includes('insufficient funds')) {
                                              errorMessage = 'Insufficient funds for transaction. Please add MATIC to your wallet.';
                                            } else if (error.message.includes('Network')) {
                                              errorMessage = 'Please ensure you are on Polygon Amoy network.';
                                            }
                                          }
                                          
                                          toast.error(errorMessage);
                                        }
                                      }}
                                      className="flex-1 py-2 px-4 text-xs font-semibold editorial-button"
                                    >
                                      <div className="flex items-center justify-center gap-1">
                                        {dossier.isActive ? (
                                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                            <rect x="6" y="4" width="4" height="16" />
                                            <rect x="14" y="4" width="4" height="16" />
                                          </svg>
                                        ) : (
                                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                            <polygon points="8,5 8,19 19,12" />
                                          </svg>
                                        )}
                                        <span>{dossier.isActive ? 'Pause' : 'Resume'}</span>
                                      </div>
                                    </button>
                                  </div>
                                  
                                  {/* Decrypt Action */}
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
                                              const mimeType = getMimeType(originalFileName);
                                              const blob = new Blob([decryptedData], { type: mimeType });
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
                                      className="w-full py-3 px-4 editorial-button"
                                    >
                                      <div className="flex items-center justify-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        <span>Download</span>
                                      </div>
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                                                })}
                    </div>
                  </div>
                  )}
                </div>
              )}
            </>
          ) : (
            // Document Creation Flow - Editorial Layout
            <div className="spacing-section">
              <div className="flex justify-between items-center spacing-medium">
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
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm font-semibold"
                  style={{ color: theme === 'light' ? '#000000' : '#f3f4f6' }}
                >
                  ← Back to Documents
                </button>
                <h2 className="editorial-header text-2xl font-bold text-gray-900 dark:text-gray-100">Document Creation</h2>
                <div className="w-32"></div> {/* Spacer for center alignment */}
              </div>
              
              <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                {/* Progress Indicator */}
                <div className="spacing-medium">
                  {/* Back Button */}
                  {currentStep > 1 && !traceJson && (
                    <div className="spacing-small">
                      <button
                        onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                        className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded transition-colors duration-200 ${
                          theme === 'light' 
                            ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400' 
                            : 'text-gray-300 bg-gray-700 border border-gray-600 hover:bg-gray-600 hover:border-gray-500'
                        }`}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Previous Step
                      </button>
                    </div>
                  )}
                  
                  <div className="spacing-small">
                    <div className="relative">
                      {/* Progress Rail */}
                      <div className={`absolute top-2 left-0 right-0 h-0.5 ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
                      
                      {/* Progress Fill */}
                      <div className={`absolute top-2 left-0 h-0.5 transition-all duration-300 ease-out ${theme === 'light' ? 'bg-gray-900' : 'bg-gray-100'}`}
                           style={{ width: `${((currentStep - 1) / 5) * 100}%` }}>
                      </div>
                      
                      {/* Steps container */}
                      <div className="flex items-start justify-between relative z-10">
                        {[1, 2, 3, 4, 5, 6].map((step) => (
                          <div key={step} className="flex flex-col items-center">
                            <div className={`w-6 h-6 flex items-center justify-center text-xs editorial-body transition-all duration-200 ${
                              step === currentStep 
                                ? theme === 'light' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
                                : step < currentStep 
                                ? theme === 'light' ? 'bg-gray-600 text-white' : 'bg-gray-500 text-white'
                                : theme === 'light' ? 'bg-gray-100 text-gray-400 border border-gray-200' : 'bg-gray-800 text-gray-500 border border-gray-700'
                            }`}>
                              {step < currentStep ? '✓' : step}
                            </div>
                            <div className={`mt-2 text-xs editorial-label-small text-center w-12 tracking-wide ${
                              step === currentStep 
                                ? theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                                : theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                            }`}>
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
                    <h3 className={`editorial-header text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                      {currentStep === 1 ? 'Document Name' :
                       currentStep === 2 ? 'File Upload' :
                       currentStep === 3 ? 'Check-in Frequency' :
                       currentStep === 4 ? 'Release Mode' :
                       currentStep === 5 ? 'Review & Encrypt' :
                       'Finalize & Upload'}
                    </h3>
                    <p className={`editorial-body text-sm font-semibold ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                      Step {currentStep} of 6
                    </p>
                  </div>
                </div>

                {/* Step Content */}
                <div className="min-h-[200px] max-w-2xl mx-auto">
                  {/* Step 1: Document Name */}
                  {currentStep === 1 && (
                    <div className="text-center spacing-medium">
                      <div className="spacing-medium">
                        <p className={`editorial-body max-w-md mx-auto font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                          Give your encrypted document a memorable name for easy identification.
                        </p>
                      </div>
                      <div className="max-w-sm mx-auto">
                        <input
                          type="text"
                          placeholder="Enter document name..."
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                          style={{ color: theme === 'light' ? '#000000' : '#f3f4f6' }}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && name.trim()) {
                              setCurrentStep(Math.min(6, currentStep + 1));
                            }
                          }}
                          autoFocus
                        />
                        <p className={`editorial-body text-sm spacing-tiny font-medium ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
                          This helps identify the document in your protected collection
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 2: File Upload */}
                  {currentStep === 2 && (
                    <div className="text-center spacing-medium">
                      <div className="spacing-medium">
                        <p className={`editorial-body max-w-md mx-auto font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                          Select or record the content you want to encrypt and protect with the deadman switch.
                        </p>
                      </div>
                      
                      {!showMediaRecorder ? (
                        <div className="max-w-md mx-auto space-y-4">
                          {/* File Upload Option */}
                          <div
                            className={`border-2 text-center py-8 cursor-pointer transition-all duration-200 group shadow-sm hover:shadow-md ${
                              theme === 'light' 
                                ? 'bg-gray-50 border-gray-300 hover:border-gray-900 hover:bg-white' 
                                : 'bg-gray-800 border-gray-600 hover:border-gray-400 hover:bg-gray-700'
                            }`}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="mx-auto spacing-small text-secondary group-hover:text-primary transition-colors" size={32} />
                            <div className="spacing-small">
                              <p className={`editorial-header text-base font-semibold transition-colors ${
                                theme === 'light' 
                                  ? 'text-gray-900 group-hover:text-black' 
                                  : 'text-gray-100 group-hover:text-white'
                              }`}>
                                {uploadedFile ? uploadedFile.name : 'Upload File'}
                              </p>
                              <p className={`editorial-body text-xs font-medium transition-colors ${
                                theme === 'light' 
                                  ? 'text-gray-700 group-hover:text-gray-900' 
                                  : 'text-gray-300 group-hover:text-gray-100'
                              }`}>
                                {uploadedFile ? 'File ready for encryption' : 'Click to browse or drag and drop'}
                              </p>
                            </div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                          </div>
                          
                          {/* OR Divider */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tracking-widest">OR</span>
                            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                          </div>
                          
                          {/* Recording Options */}
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => setShowMediaRecorder(true)}
                              className={`p-4 border-2 rounded transition-all duration-200 hover:shadow-sm ${
                                theme === 'light' 
                                  ? 'bg-gray-50 border-gray-300 hover:border-gray-900 hover:bg-white' 
                                  : 'bg-gray-800 border-gray-600 hover:border-gray-400 hover:bg-gray-700'
                              } flex flex-col items-center gap-2`}
                            >
                              <Mic className="w-6 h-6 text-blue-600" />
                              <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                                Voice Recording
                              </span>
                            </button>
                            
                            <button
                              onClick={() => setShowMediaRecorder(true)}
                              className={`p-4 border-2 rounded transition-all duration-200 hover:shadow-sm ${
                                theme === 'light' 
                                  ? 'bg-gray-50 border-gray-300 hover:border-gray-900 hover:bg-white' 
                                  : 'bg-gray-800 border-gray-600 hover:border-gray-400 hover:bg-gray-700'
                              } flex flex-col items-center gap-2`}
                            >
                              <Video className="w-6 h-6 text-red-600" />
                              <span className={`text-sm font-medium ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                                Video Recording
                              </span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="max-w-2xl mx-auto">
                          <MediaRecorder
                            onFileReady={(file: File) => {
                              setUploadedFile(file);
                              setShowMediaRecorder(false);
                            }}
                            onCancel={() => setShowMediaRecorder(false)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: Check-in Frequency */}
                  {currentStep === 3 && (
                    <div className="text-center spacing-medium">
                      <div className="spacing-medium">
                        <p className="editorial-body text-gray-900 max-w-lg mx-auto font-semibold">
                          How often do you need to check in to prevent the document from being released automatically?
                        </p>
                      </div>
                      <div className="max-w-sm mx-auto">
                        <select 
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg monospace-accent text-center cursor-pointer text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                          style={{ color: theme === 'light' ? '#000000' : '#f3f4f6' }}
                          value={checkInInterval}
                          onChange={(e) => setCheckInInterval(e.target.value)}
                        >
                          {intervalOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="editorial-body text-sm text-gray-700 spacing-tiny font-medium">
                          The document will be released if no check-in is received within this timeframe
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Release Mode */}
                  {currentStep === 4 && (
                    <div className="spacing-medium">
                      <div className="text-center spacing-medium">
                        <p className="editorial-body text-gray-900 max-w-lg mx-auto font-semibold">
                          How should your document be released if the deadman switch is triggered?
                        </p>
                      </div>
                      <div className="max-w-lg mx-auto space-y-4">
                        <div 
                          className={`editorial-card-bordered cursor-pointer transition-all ${
                            releaseMode === 'public' ? 'border-gray-900 bg-gray-50 dark:bg-gray-800' : 'hover:border-gray-600 dark:hover:border-gray-400'
                          }`}
                          onClick={() => setReleaseMode('public')}
                        >
                          <div className="flex items-start">
                            <div className={`w-4 h-4 rounded-full border-2 mr-4 mt-1 ${
                              releaseMode === 'public' ? 'border-gray-900 bg-gray-900 dark:bg-gray-100' : 'border-gray-400'
                            }`}>
                              {releaseMode === 'public' && <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 scale-50"></div>}
                            </div>
                            <div>
                              <h4 className="editorial-header text-sm text-gray-900 dark:text-gray-100">Public Release</h4>
                              <p className="editorial-body text-sm text-secondary font-medium text-gray-600 dark:text-gray-400">
                                Document will be made publicly accessible when triggered
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          className={`editorial-card-bordered cursor-pointer transition-all ${
                            releaseMode === 'contacts' ? 'border-gray-900 bg-gray-50 dark:bg-gray-800' : 'hover:border-gray-600 dark:hover:border-gray-400'
                          }`}
                          onClick={() => setReleaseMode('contacts')}
                        >
                          <div className="flex items-start">
                            <div className={`w-4 h-4 rounded-full border-2 mr-4 mt-1 ${
                              releaseMode === 'contacts' ? 'border-gray-900 bg-gray-900 dark:bg-gray-100' : 'border-gray-400'
                            }`}>
                              {releaseMode === 'contacts' && <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 scale-50"></div>}
                            </div>
                            <div className="flex-1">
                              <h4 className="editorial-header text-sm text-gray-900 dark:text-gray-100">Emergency Contacts</h4>
                              <p className="editorial-body text-sm text-secondary font-medium spacing-small">
                                Document will be sent to specific people when triggered
                              </p>
                              {releaseMode === 'contacts' && (
                                <div className="space-y-3">
                                  {emergencyContacts.map((contact, index) => (
                                    <div key={index} className="flex gap-2">
                                      <input
                                        type="text"
                                        placeholder="Email address or Ethereum address"
                                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                                        style={{ color: theme === 'light' ? '#000000' : '#f3f4f6' }}
                                        value={contact}
                                        onChange={(e) => {
                                          const newContacts = [...emergencyContacts];
                                          newContacts[index] = e.target.value;
                                          setEmergencyContacts(newContacts);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && contact.trim()) {
                                            setCurrentStep(Math.min(6, currentStep + 1));
                                          }
                                        }}
                                      />
                                      {emergencyContacts.length > 1 && (
                                        <button
                                          onClick={() => {
                                            const newContacts = emergencyContacts.filter((_, i) => i !== index);
                                            setEmergencyContacts(newContacts);
                                          }}
                                          className="px-2 py-1 border border-red-600 rounded-lg text-xs text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => setEmergencyContacts([...emergencyContacts, ''])}
                                    className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm"
                                  >
                                    + Add contact
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
                    <div className="text-center spacing-medium">
                      <div className="spacing-medium">
                        <p className={`editorial-body max-w-md mx-auto font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                          Please review your settings before encrypting the document.
                        </p>
                      </div>
                      <div className="max-w-lg mx-auto">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5 text-left space-y-4" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                          <div className="flex justify-between items-center">
                            <span className="editorial-label-small text-gray-700 dark:text-gray-300">Document Name</span>
                            <span className="editorial-header text-sm monospace-accent text-primary">{name || 'Untitled'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="editorial-label-small text-gray-700 dark:text-gray-300">File</span>
                            <span className="editorial-body text-sm text-primary font-semibold">{uploadedFile?.name || 'No file selected'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="editorial-label-small text-gray-700 dark:text-gray-300">Check-in Frequency</span>
                            <span className="monospace-accent text-sm text-primary font-semibold">
                              {intervalOptions.find(opt => opt.value === checkInInterval)?.label}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="editorial-label-small text-gray-700 dark:text-gray-300">Release Mode</span>
                            <span className="editorial-body text-sm text-primary font-semibold">
                              {releaseMode === 'public' ? 'Public Release' : 'Emergency Contacts'}
                            </span>
                          </div>
                          {releaseMode === 'contacts' && (
                            <div className="pt-3 border-t border-gray-200">
                              <div className="editorial-label-small spacing-tiny text-gray-700 dark:text-gray-300">Emergency Contacts</div>
                              {emergencyContacts.filter(c => c.trim()).map((contact, index) => (
                                <div key={index} className="editorial-body text-sm text-primary font-semibold monospace-accent">
                                  • {contact}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Encrypt Button */}
                        <div className="spacing-medium">
                          {!encryptedCapsule && (
                            <button
                              onClick={processCanaryTrigger}
                              disabled={!uploadedFile || isProcessing || !name.trim()}
                              className="w-full px-6 py-4 border border-gray-900 dark:border-gray-200 rounded-lg bg-gray-900 dark:bg-transparent text-white dark:text-gray-100 hover:bg-gray-800 dark:hover:bg-gray-900 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isProcessing ? (
                                <div className="flex items-center justify-center gap-3">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                                  <span>Encrypting...</span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-3">
                                  <Shield size={18} />
                                  <span>Encrypt Document</span>
                                </div>
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
                              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                            >
                              Create New Document
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 6 && (
                    <div className="text-center spacing-medium">
                      <div className="spacing-medium">
                        <p className={`editorial-body max-w-md mx-auto font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}>
                          This is the final step. Your document will be encrypted, uploaded, and registered on the blockchain.
                        </p>
                      </div>
                      <div className="max-w-lg mx-auto">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-6 py-5 text-left space-y-4 spacing-medium" style={{ backgroundColor: theme === 'light' ? 'white' : '#000000' }}>
                          <div className="flex justify-between items-center">
                            <span className={`editorial-label-small ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>Document Name</span>
                            <span className="editorial-header text-sm monospace-accent text-primary">{name || 'Untitled'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`editorial-label-small ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>File</span>
                            <span className="editorial-body text-sm text-primary font-semibold">{uploadedFile?.name || 'No file selected'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`editorial-label-small ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>Check-in Frequency</span>
                            <span className="monospace-accent text-sm text-primary font-semibold">
                              {intervalOptions.find(opt => opt.value === checkInInterval)?.label}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`editorial-label-small ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>Release Mode</span>
                            <span className="editorial-body text-sm text-primary font-semibold capitalize">{releaseMode}</span>
                          </div>
                        </div>
                        <button
                          onClick={processCanaryTrigger}
                          disabled={isProcessing}
                          className="editorial-button-primary editorial-button-large w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isProcessing ? (
                            <div className="flex items-center justify-center gap-3">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                              <span>{authMode === 'standard' ? 'Securing your document...' : 'Finalizing document...'}</span>
                            </div>
                          ) : (
                            authMode === 'standard' ? 'Secure Document' : 'Finalize & Upload'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                {currentStep < 6 && !traceJson && (
                  <div className={`flex justify-between mt-8 pt-6 border-t ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`}>
                    <button
                      onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                      disabled={currentStep === 1}
                      className="px-6 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ color: theme === 'light' ? '#000000' : '#d1d5db' }}
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
                      className="px-6 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                      style={{ color: theme === 'light' ? '#000000' : '#d1d5db' }}
                    >
                      {currentStep === 5 ? 'Finalize' : 'Next'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      )}
      </div>

      {/* Footer */}
      <footer className={`border-t backdrop-blur-sm flex-shrink-0 ${theme === 'light' ? 'border-gray-200 bg-white/80' : 'border-gray-700 bg-gray-900/80'}`}>
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
              href="https://canaryapp.io/support"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 text-xs transition-colors ${theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>Support</span>
            </a>
            
            <a
              href="https://github.com/TheThirdRoom/canary"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 text-xs transition-colors ${theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <Github size={10} />
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
          
          <div className={`text-center mt-2 pt-2 border-t ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`}>
            <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
              © 2025 Canary. Truth protection through cryptographic deadman switches.
            </p>
          </div>
        </div>
      </footer>
      </div>
    </div>
    </div>
  );
}

export default Home;
