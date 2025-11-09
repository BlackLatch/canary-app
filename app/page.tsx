"use client";

import React, { useState, useRef, useEffect, Fragment, Suspense } from "react";
import {
  Upload,
  Shield,
  Download,
  Copy,
  AlertCircle,
  Github,
  Sun,
  Moon,
  Mic,
  Video,
  Settings,
  FileText,
} from "lucide-react";
import {
  commitEncryptedFileToPinata,
  DeadmanCondition,
  DossierManifest,
  encryptFileWithDossier,
  createDossierManifest,
  encryptAndCommitDossierManifest,
  CommitResult,
} from "./lib/taco";
import { useTheme } from "./lib/theme-context";
import MediaRecorder from "./components/MediaRecorder";
import NoDocumentsPlaceholder from "./components/NoDocumentsPlaceholder";
import AcceptableUsePolicy, { checkAUPSigned } from "./components/AcceptableUsePolicy";
import SettingsView from "./components/SettingsView";
import MonitorView from "./components/MonitorView";
import DemoDisclaimer from "./components/DemoDisclaimer";
import BurnAccountWarningModal from "./components/BurnAccountWarningModal";
import { useSearchParams, useRouter } from "next/navigation";

import { useConnect, useAccount, useDisconnect } from "wagmi";
import { usePrivy, useWallets, useConnectWallet } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useBurnerWallet } from "./lib/burner-wallet-context";
import { hasBurnerWallet, getBurnerWalletAddress } from "./lib/burner-wallet";
import Jazzicon from 'react-jazzicon';
import { polygonAmoy } from "wagmi/chains";
import { Address, encodeFunctionData } from "viem";
import {
  ContractService,
  CANARY_DOSSIER_ADDRESS,
  CANARY_DOSSIER_ABI,
  Dossier,
  isOnStatusNetwork,
  getNetworkName,
} from "./lib/contract";
import { statusSepolia } from "./lib/chains/status";
import toast, { Toaster } from "react-hot-toast";
import { getMimeType } from "./lib/mime-types";
import { useNetworkGuard } from "./lib/hooks/useNetworkGuard";

// Extended dossier interface with accurate decryptable status
interface DossierWithStatus extends Dossier {
  isDecryptable: boolean;
}

// Component that uses useSearchParams
const HomeContent = ({
  onViewChange,
}: {
  onViewChange: (view: "checkin" | "documents" | "monitor" | "settings") => void;
}) => {
  const searchParams = useSearchParams();

  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "documents") {
      onViewChange("documents");
    } else if (view === "checkin") {
      onViewChange("checkin");
    } else if (view === "monitor") {
      onViewChange("monitor");
    } else if (view === "settings") {
      onViewChange("settings");
    }
  }, [searchParams, onViewChange]);

  return null;
};

const Home = () => {
  const router = useRouter();
  const { connectors, connect, isPending } = useConnect();

  // Load version info
  const [version, setVersion] = useState<{ commit: string; date: string; branch: string; buildTime: string } | null>(null);

  useEffect(() => {
    // Fetch version.json on mount
    fetch('/version.json')
      .then(res => res.json())
      .then(data => setVersion(data))
      .catch(() => setVersion(null));
  }, []);

  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { connectWallet } = useConnectWallet();
  const { client: smartWalletClient } = useSmartWallets();
  const { theme, toggleTheme } = useTheme();
  const burnerWallet = useBurnerWallet();

  const [signedIn, setSignedIn] = useState(false);
  const [hasExistingAnonymousAccount, setHasExistingAnonymousAccount] = useState(false);
  const [existingAnonymousAddress, setExistingAnonymousAddress] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"standard" | "advanced">(() => {
    // Load auth mode from localStorage, default to standard
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("canary-auth-mode") as "standard" | "advanced") ||
        "standard"
      );
    }
    return "standard";
  });

  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInStandaloneMode, setIsInStandaloneMode] = useState(false);

  // Burn account warning modal state
  const [showBurnWarningModal, setShowBurnWarningModal] = useState(false);
  // Removed userProfile - using dossier-only storage model
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [checkInInterval, setCheckInInterval] = useState(""); // No default - user must select
  const [customInterval, setCustomInterval] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [dossierManifest, setDossierManifest] = useState<DossierManifest | null>(null);
  const [manifestStorageUrl, setManifestStorageUrl] = useState<string | null>(null);
  const [encryptedCapsule, setEncryptedCapsule] = useState<any>(null);
  const [allEncryptedFiles, setAllEncryptedFiles] = useState<Array<{
    encryptionResult: any;
    commitResult: CommitResult;
    originalFile: File;
  }>>([]);
  const [isCommitting, setIsCommitting] = useState(false);

  const [userDossiers, setUserDossiers] = useState<DossierWithStatus[]>([]);
  const [isLoadingDossiers, setIsLoadingDossiers] = useState(true);
  const [viewingUserAddress, setViewingUserAddress] = useState<Address | null>(null); // Address of user whose dossiers we're viewing
  const [currentDossierId, setCurrentDossierId] = useState<bigint | null>(null);
  const [contractConstants, setContractConstants] = useState<{
    minInterval: bigint;
    maxInterval: bigint;
    gracePeriod: bigint;
    maxDossiers: bigint;
  } | null>(null);
  const [uploads, setUploads] = useState<
    Array<{
      id: string;
      filename: string;
      status: "encrypted" | "committed";
      storageType: "codex" | "ipfs" | "pinata";
      encryptionType: "real" | "dossier-enhanced" | "dossier-only";
      payloadUri?: string;
      contractDossierId?: string;
      contractTxHash?: string;
      createdAt: Date;
    }>
  >([]);
  interface ActivityLogEntry {
    type: string;
    date: string;
    txHash?: string;
  }
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([
    { type: "Check in confirmed", date: "Apr 31, 2026, 16:01 AM" },
    { type: "Pre-registeral nor-contact", date: "Apr-32, 3093, 26:3 PM" },
    { type: "Trigger created", date: "Apr 13, 2021, 18:00 AM" },
  ]);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [emergencyContacts, setEmergencyContacts] = useState<string[]>([""]);
  const [releaseMode, setReleaseMode] = useState<"public" | "contacts" | "">(
    "",
  );
  const [currentView, setCurrentView] = useState<"checkin" | "documents" | "monitor" | "settings">(
    "checkin",
  );
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showInactiveDocuments, setShowInactiveDocuments] = useState(false);
  const [dummyMasterSwitch, setDummyMasterSwitch] = useState(true); // Dummy UI state for master switch
  const [selectedDocument, setSelectedDocument] =
    useState<DossierWithStatus | null>(null);
  const [documentDetailView, setDocumentDetailView] = useState(false);
  const [showMediaRecorder, setShowMediaRecorder] = useState(false);
  const [mediaRecorderType, setMediaRecorderType] = useState<'voice' | 'video'>('voice');
  const [showDisableConfirm, setShowDisableConfirm] = useState<bigint | null>(
    null,
  );
  const [showReleaseConfirm, setShowReleaseConfirm] = useState<bigint | null>(
    null,
  );
  const [showEditSchedule, setShowEditSchedule] = useState(false);
  const [showAddFiles, setShowAddFiles] = useState(false);
  const [newCheckInInterval, setNewCheckInInterval] = useState("");
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [showAUPForEncrypt, setShowAUPForEncrypt] = useState(false);
  const [hasAcceptedAUP, setHasAcceptedAUP] = useState(false);
  const [showDemoDisclaimer, setShowDemoDisclaimer] = useState(false);
  const [showImportKeyModal, setShowImportKeyModal] = useState(false);
  const [importKeyValue, setImportKeyValue] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFilesInputRef = useRef<HTMLInputElement>(null);

  // Check AUP status when entering encryption step (but don't auto-show popup)
  useEffect(() => {
    if (currentStep === 4 && showCreateForm) {
      const identifier = getCurrentAddress() || user?.email?.address || user?.id;
      const isSigned = checkAUPSigned(identifier);
      setHasAcceptedAUP(isSigned);
      // Don't automatically show the popup - user must click the button
    }
  }, [currentStep, showCreateForm, address, user]);

  // Dossier detail navigation
  const openDocumentDetail = (document: DossierWithStatus) => {
    setSelectedDocument(document);
    setDocumentDetailView(true);
    // Update URL without navigating
    const currentAddress = getCurrentAddress();
    if (currentAddress) {
      const url = `/?user=${currentAddress}&id=${document.id.toString()}`;
      window.history.pushState({}, '', url);
    }
  };

  const closeDocumentDetail = () => {
    setSelectedDocument(null);
    setDocumentDetailView(false);
    // Reset URL to dossiers view (with user param)
    const currentAddress = getCurrentAddress();
    if (currentAddress) {
      window.history.pushState({}, '', `/?user=${currentAddress}`);
    }
  };

  // Check if viewing own dossiers (used to show/hide action buttons)
  const isViewingOwnDossiers = () => {
    const currentAddress = getCurrentAddress();
    if (!currentAddress || !viewingUserAddress) return false;
    return currentAddress.toLowerCase() === viewingUserAddress.toLowerCase();
  };

  // Check if we can view dossiers (either connected OR viewing someone's dossiers via URL)
  const canViewDossiers = () => {
    return hasWalletConnection() || hasUserParam;
  };

  const intervalOptions = [
    { value: "60", label: "1 Hour" },
    { value: "1440", label: "1 Day" },
    { value: "10080", label: "1 Week" },
    { value: "43200", label: "1 Month" },
    { value: "525600", label: "1 Year" },
    { value: "custom", label: "Custom" },
  ];

  // Helper function to check if we have a valid wallet connection (wagmi, Privy, or burner)
  const hasWalletConnection = () => {
    return (isConnected && address) || (authenticated && wallets.length > 0) || burnerWallet.isConnected;
  };

  // Helper function to get current wallet address (wagmi, Privy, or burner)
  const getCurrentAddress = () => {
    // Priority: burner wallet (if connected) > wagmi > Privy
    return burnerWallet.address || address || (wallets.length > 0 ? wallets[0]?.address : null);
  };

  // Helper function to set auth mode and persist to localStorage
  const setAuthModeWithPersistence = (mode: "standard" | "advanced") => {
    setAuthMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("canary-auth-mode", mode);
    }
  };

  // Helper function to check if a form step is completed
  const isStepCompleted = (step: number): boolean => {
    switch (step) {
      case 1: // NAME - requires name and description
        return name.trim().length > 0 && description.trim().length > 0;
      case 2: // VISIBILITY - requires release mode selection (no default)
        return releaseMode !== "" && (releaseMode === "public" || (releaseMode === "contacts" && emergencyContacts.some(c => c.trim().length > 0)));
      case 3: // SCHEDULE - requires check-in interval selection (no default)
        return checkInInterval !== "" && (checkInInterval !== "custom" || customInterval.trim().length > 0);
      case 4: // ENCRYPT - requires at least one file
        return uploadedFiles.length > 0 || uploadedFile !== null;
      case 5: // FINALIZE - this step is never "completed" until submission
        return false;
      default:
        return false;
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
    if (isConnected && process.env.NODE_ENV === "development") {
      const runDebugCheck = async () => {
        try {
          console.log("🔍 Running debug contract verification...");
          const healthCheck = await ContractService.quickHealthCheck();
          if (!healthCheck) {
            console.log("📋 Running detailed verification...");
            const detailed = await ContractService.verifyContractDeployment();
            console.log("📊 Detailed verification result:", detailed);
          }
        } catch (error) {
          console.error("❌ Debug verification failed:", error);
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

  // Check for existing anonymous account on mount
  useEffect(() => {
    // Check after a small delay to ensure localStorage is ready
    const checkExistingAccount = () => {
      try {
        const hasAccount = hasBurnerWallet();
        console.log('🔍 Checking for existing anonymous account:', hasAccount);

        // Also log what's actually in localStorage for debugging
        if (typeof window !== 'undefined') {
          const storedKey = localStorage.getItem('canary-burner-wallet-private-key');
          console.log('🔑 localStorage key exists:', storedKey !== null);
          if (storedKey) {
            console.log('🔑 Key preview:', storedKey.substring(0, 10) + '...');
          }
        }

        setHasExistingAnonymousAccount(hasAccount);

        // Get the address if account exists
        if (hasAccount) {
          const address = getBurnerWalletAddress();
          setExistingAnonymousAddress(address);
          console.log('📍 Existing account address:', address);
        }
      } catch (error) {
        console.error('❌ Error checking for existing account:', error);
        setHasExistingAnonymousAccount(false);
        setExistingAnonymousAddress(null);
      }
    };

    // Check immediately
    checkExistingAccount();

    // Also check after a small delay in case of timing issues
    setTimeout(checkExistingAccount, 100);
  }, []);

  // PWA Install prompt handling
  useEffect(() => {
    // Check if iOS
    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      const isIOSSafari = isIOSDevice && /safari/.test(userAgent) && !/crios/.test(userAgent) && !/fxios/.test(userAgent);
      const isIOSChrome = isIOSDevice && /crios/.test(userAgent);
      setIsIOS(isIOSDevice);

      // Check if already installed as PWA
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone === true;
      setIsInStandaloneMode(isStandalone);

      // Show install button for iOS if not in standalone mode
      if ((isIOSSafari || isIOSChrome) && !isStandalone) {
        setShowInstallButton(true);
        console.log('📱 iOS device detected - showing install instructions');
      }
    };

    checkIOS();

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show the install button
      setShowInstallButton(true);
      console.log('📱 PWA install prompt available');
    };

    const handleAppInstalled = () => {
      // Hide the install button after successful install
      setShowInstallButton(false);
      setDeferredPrompt(null);
      console.log('✅ PWA installed successfully');
      toast.success('Canary installed! You can now use it as an app.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
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
    // Use uploadedFiles array if it has files, otherwise fall back to single uploadedFile
    const filesToProcess = uploadedFiles.length > 0 ? uploadedFiles : (uploadedFile ? [uploadedFile] : []);
    
    if (filesToProcess.length === 0) {
      toast.error("Please add at least one file");
      return;
    }

    if (!checkInInterval || (checkInInterval === "custom" && !customInterval)) {
      toast.error("Please set a valid check-in interval");
      return;
    }

    if (checkInInterval === "custom") {
      const hours = parseInt(customInterval);
      if (isNaN(hours) || hours < 1 || hours > 720) {
        toast.error(
          "Custom interval must be between 1 hour and 30 days (720 hours)",
        );
        return;
      }
    }

    // Require wallet connection for dossier-only mode
    const currentAddress = burnerWallet.address || address;
    const isWalletConnected = burnerWallet.isConnected || isConnected;

    if (!isWalletConnected || !currentAddress) {
      toast.error(
        authMode === "standard"
          ? "Please sign in to create documents"
          : "Please connect your wallet to create encrypted documents",
      );
      return;
    }

    // Network check is handled by useNetworkGuard wrapper

    // Check if smart wallet is available for gasless transactions
    if (!smartWalletClient) {
      console.warn(
        "⚠️ Smart wallet not available, transactions will require gas",
      );
    }

    setIsProcessing(true);
    setProcessingStatus("Initializing encryption...");
    setProcessingProgress(0);
    const processingToast = toast.loading(
      authMode === "standard"
        ? "Securing your document..."
        : "Creating encrypted document with dossier conditions...",
    );

    try {
      console.log("🔐 Starting dossier-only encryption flow...");

      // For standard mode, ensure the embedded wallet is ready
      if (authMode === "standard" && wallets.length === 0) {
        toast.dismiss(processingToast);
        toast.error(
          "Please wait a moment for your account to be fully set up, then try again.",
        );
        setIsProcessing(false);
        return;
      }

      // Step 1: Get next dossier ID
      console.log("🔍 Step 1: Getting next dossier ID...");
      // Determine which address to use based on auth mode
      let queryAddress: string | null;
      if (burnerWallet.isConnected && burnerWallet.address) {
        queryAddress = burnerWallet.address; // Use burner wallet address
        console.log(
          "🔥 Burner wallet mode - using burner wallet for query:",
          queryAddress,
        );
      } else if (authMode === "advanced") {
        queryAddress = address; // Use Web3 wallet address
        console.log(
          "🔧 Advanced mode - using Web3 wallet for query:",
          queryAddress,
        );
      } else {
        queryAddress = smartWalletClient?.account?.address || address;
        console.log(
          "🎯 Standard mode - using smart wallet for query:",
          queryAddress,
        );
      }

      const userDossierIds = await ContractService.getUserDossierIds(
        queryAddress as Address,
      );
      const nextDossierId = BigInt(userDossierIds.length);
      console.log("🆔 Next dossier ID will be:", nextDossierId.toString());

      // Step 2: Encrypt with Dossier condition
      console.log("🔒 Step 2: Encrypting with Dossier contract condition...");

      // Prepare recipients list for private dossiers (emergency contacts)
      // Map UI releaseMode: "contacts" -> private with recipients, "public" -> public with no recipients
      const isPrivate = releaseMode === 'contacts';
      const recipientsList = isPrivate
        ? emergencyContacts.filter(addr => addr && addr.trim() !== '')
        : [];
      const normalizedReleaseMode: 'public' | 'private' = isPrivate ? 'private' : 'public';

      const condition: DeadmanCondition = {
        type: "no_checkin",
        duration: `${checkInInterval} MINUTES`,
        dossierId: nextDossierId,
        userAddress: queryAddress,
        releaseMode: normalizedReleaseMode,
        recipients: recipientsList,
      };

      console.log(`🔓 Dossier release mode: ${releaseMode} (normalized: ${normalizedReleaseMode})`);
      if (isPrivate) {
        console.log(`👥 Emergency contacts: ${recipientsList.length} addresses`);
      }

      // Get the wallet provider for encryption based on auth mode
      let walletProvider = null;
      let burnerWalletInstance = null;

      if (burnerWallet.isConnected) {
        // Burner wallet mode: Get the wallet instance directly
        burnerWalletInstance = burnerWallet.getWalletForEncryption();
        console.log("✅ Using burner wallet for encryption");
      } else if (authMode === "standard") {
        // Standard mode: Use Privy embedded wallet transparently
        if (wallets.length > 0) {
          const privyWallet =
            wallets.find((w) => w.walletClientType === "privy") || wallets[0];
          if (
            privyWallet &&
            typeof privyWallet.getEthereumProvider === "function"
          ) {
            try {
              walletProvider = await privyWallet.getEthereumProvider();
              console.log("✅ Using Privy embedded wallet provider");

              // Add a small delay to ensure wallet is fully initialized
              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (error) {
              console.error("Failed to get wallet provider:", error);
              toast.dismiss(processingToast);
              toast.error(
                "Your account is still being set up. Please wait a moment and try again.",
              );
              setIsProcessing(false);
              return;
            }
          }
        }

        // If we still don't have a wallet provider, the wallet isn't ready
        if (!walletProvider) {
          toast.dismiss(processingToast);
          toast.error(
            "Your account is still being set up. Please wait a moment and try again.",
          );
          setIsProcessing(false);
          return;
        }
      } else {
        // Advanced mode: Use the connected Web3 wallet provider
        if (typeof window !== "undefined" && window.ethereum) {
          walletProvider = window.ethereum;
          console.log("✅ Using Web3 wallet provider");
        }
      }

      // Step 2b: Encrypt all files
      console.log(`🔒 Step 2b: Encrypting ${filesToProcess.length} file(s)...`);
      const encryptedFiles = [];

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const fileProgress = Math.round((i / filesToProcess.length) * 50); // 0-50% for encryption
        
        setProcessingStatus(`Encrypting file ${i + 1}/${filesToProcess.length}: ${file.name}`);
        setProcessingProgress(fileProgress);
        toast.loading(`Encrypting ${file.name}...`, { id: processingToast });
        
        console.log(`📄 Encrypting file ${i + 1}/${filesToProcess.length}: ${file.name}`);
        
        const encryptionResult = await encryptFileWithDossier(
          file,
          condition,
          name,
          nextDossierId,
          queryAddress,
          walletProvider,
          burnerWalletInstance,
        );
        
        console.log(`✅ File ${i + 1} encrypted`);
        
        // Step 3: Upload each encrypted file
        const uploadProgress = Math.round(((i + 0.5) / filesToProcess.length) * 50); // 50% progress for upload
        setProcessingStatus(`Uploading encrypted file ${i + 1}/${filesToProcess.length}...`);
        setProcessingProgress(50 + uploadProgress);
        toast.loading(`Uploading encrypted ${file.name}...`, { id: processingToast });
        
        console.log(`📦 Uploading encrypted file ${i + 1}...`);
        const commitResult = await commitEncryptedFileToPinata(encryptionResult);
        console.log(`📦 File ${i + 1} stored:`, commitResult.storageType);

        encryptedFiles.push({ encryptionResult, commitResult, originalFile: file });
      }

      console.log(`✅ All ${filesToProcess.length} files encrypted and uploaded`);

      // Step 4: Create and encrypt manifest BEFORE creating dossier on-chain
      setProcessingStatus("Creating dossier manifest...");
      setProcessingProgress(85);
      toast.loading("Creating manifest...", { id: processingToast });
      console.log("📋 Step 4: Creating dossier manifest...");

      const dossierName = name || `Encrypted dossier with ${filesToProcess.length} file(s)`;
      const checkInMinutes =
        checkInInterval === "custom"
          ? parseInt(customInterval) * 60 // Convert hours to minutes
          : parseInt(checkInInterval);

      console.log("🔍 DEBUG: Check-in interval values:");
      console.log("  - checkInInterval (raw):", checkInInterval);
      console.log("  - checkInInterval type:", typeof checkInInterval);
      console.log("  - Is custom?:", checkInInterval === "custom");
      console.log("  - customInterval:", customInterval);
      console.log("  - checkInMinutes (parsed):", checkInMinutes);
      console.log("  - checkInMinutes type:", typeof checkInMinutes);
      console.log("  - Expected seconds:", checkInMinutes * 60);
      console.log("  - Expected seconds as BigInt:", BigInt(checkInMinutes * 60).toString());

      // Recipients for contract: always include owner, plus emergency contacts for private
      // Public dossiers: [owner only]
      // Private dossiers: [owner, ...emergency contacts]
      const recipients = [queryAddress, ...recipientsList];

      // Create manifest from encrypted files
        const manifest = await createDossierManifest(
          nextDossierId.toString(),
          dossierName,
          checkInMinutes * 60, // Convert minutes to seconds
          normalizedReleaseMode,
          recipientsList,
          encryptedFiles.map((ef) => ({
            commitResult: ef.commitResult,
            originalFile: ef.originalFile,
          }))
        );

        console.log("✅ Manifest created");

        // Encrypt and upload manifest
        setProcessingStatus("Encrypting manifest...");
        setProcessingProgress(88);
        toast.loading("Encrypting manifest...", { id: processingToast });
        console.log("🔐 Encrypting manifest...");

        const manifestResult = await encryptAndCommitDossierManifest(
          manifest,
          condition,
          queryAddress,
          walletProvider,
          burnerWalletInstance
        );

        console.log("✅ Manifest encrypted and stored:", manifestResult.manifestStorageUrl);

        // Store manifest for display
        setDossierManifest(manifest);
        setManifestStorageUrl(manifestResult.manifestStorageUrl);

        // Build complete file hashes array with manifest FIRST, then files
        const allFileHashes = [
          manifestResult.manifestStorageUrl,
          ...encryptedFiles.map(ef => ef.commitResult.payloadUri)
        ];

        console.log("📋 Complete file hash array:");
        console.log("  [0] Manifest:", manifestResult.manifestStorageUrl);
        encryptedFiles.forEach((ef, i) => {
          console.log(`  [${i + 1}] File #${i + 1}:`, ef.commitResult.payloadUri);
        });

        // Now create dossier with complete file list (manifest + files)
        const fileHashes = allFileHashes;

        // Step 5: Create dossier on-chain with manifest + files
        setProcessingStatus("Creating dossier on blockchain...");
        setProcessingProgress(90);
        toast.loading("Creating dossier on blockchain...", { id: processingToast });
        console.log("📝 Step 5: Creating dossier on-chain with all file hashes...");
        console.log(`   Total hashes: ${fileHashes.length} (1 manifest + ${encryptedFiles.length} files)`);
        console.log(`   Recipients: ${recipients.length === 1 ? 'Public (owner only)' : `Private (owner + ${recipients.length - 1} emergency contact(s))`}`);

      let dossierId: bigint;
      let contractTxHash: string;

      try {
        // Use smart wallet for gasless transaction only in standard mode
        let result;
        if (smartWalletClient && authMode === "standard") {
          // Create the transaction data for enhanced features
          const txData = encodeFunctionData({
            abi: CANARY_DOSSIER_ABI,
            functionName: "createDossier",
            args: [
              dossierName,
              description || "",
              BigInt(checkInMinutes * 60),
              recipients,
              fileHashes,
            ],
          });

          console.log(
            "🚀 Using smart wallet for gasless transaction...",
          );
          const txHash = await smartWalletClient.sendTransaction({
            account: smartWalletClient.account,
            chain: polygonAmoy,
            to: CANARY_DOSSIER_ADDRESS,
            data: txData,
          });

          console.log("✅ Transaction sent:", txHash);

          // Wait for transaction to be mined and get dossier ID
          console.log("⏳ Waiting for transaction to be mined...");
          let retries = 0;
          let dossierId = null;

          while (retries < 10 && !dossierId) {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            try {
              // Query using smart wallet address
              const smartAddress = smartWalletClient.account.address;
              const dossierIds = await ContractService.getUserDossierIds(
                smartAddress as Address,
              );
              console.log(
                `📊 Attempt ${retries + 1}: Smart wallet ${smartAddress} has ${dossierIds.length} dossiers`,
              );

              const previousCount = userDossierIds.length;
              if (dossierIds.length > previousCount) {
                dossierId = dossierIds[dossierIds.length - 1];
                console.log("🆔 New dossier ID found:", dossierId?.toString());
                break;
              }
            } catch (error) {
              console.warn(`Attempt ${retries + 1} failed:`, error);
            }

            retries++;
          }

          if (!dossierId) {
            console.warn(
              "⚠️ Could not retrieve dossier ID immediately, but transaction was successful",
            );
            // Use the expected ID as fallback
            dossierId = nextDossierId;
          }

          result = { dossierId, txHash };
        } else {
          // Fallback to regular transaction
          console.log(
            "⚠️ Smart wallet not available, using regular transaction",
          );

          console.log(
            "📝 Creating dossier...",
          );
          result = await ContractService.createDossier(
            dossierName,
            description || "",
            checkInMinutes,
            recipients,
            fileHashes,
            burnerWalletInstance,
          );
          toast.success("Dossier created successfully");
        }

        dossierId = result.dossierId;
        contractTxHash = result.txHash;
        setCurrentDossierId(dossierId);

        console.log("✅ Dossier created on-chain!");
        console.log("🆔 Dossier ID:", dossierId?.toString() || "Unknown");
        console.log("🔗 Contract TX:", contractTxHash);

        // Verify the ID matches our prediction
        if (dossierId && dossierId !== nextDossierId) {
          console.warn(
            `⚠️ Dossier ID mismatch: predicted ${nextDossierId}, got ${dossierId}`,
          );
        } else if (dossierId) {
          console.log("✅ Dossier ID prediction was correct!");
        }
      } catch (error) {
        console.error("❌ Failed to create dossier:", error);

        // Handle specific error types gracefully
        let errorMessage = "Failed to create document";
        if (error instanceof Error) {
          if (error.message.includes("rejected by user")) {
            errorMessage = "Transaction cancelled";
            toast.dismiss(processingToast);
            toast(errorMessage);
            setIsProcessing(false);
            return;
          } else if (error.message.includes("insufficient funds")) {
            // Check if using smart wallet (sponsored transactions)
            if (smartWalletClient && authMode === "standard") {
              errorMessage = "Transaction sponsorship temporarily unavailable. The paymaster may be out of funds. Please try again later or switch to an external wallet.";
            } else {
              errorMessage = "Insufficient funds for transaction. Please add MATIC to your wallet.";
            }
          } else if (
            error.message.includes("Check-in interval must be between")
          ) {
            errorMessage = error.message;
          } else if (
            error.message.includes("Maximum number of dossiers reached")
          ) {
            errorMessage =
              "You have reached the maximum number of documents allowed.";
          } else if (error.message.includes("Wrong network")) {
            errorMessage =
              "Please switch to Polygon Amoy network in your wallet.";
          } else {
            errorMessage = error.message || "Failed to create document";
          }
        }

        toast.error(errorMessage, { id: processingToast });
        setIsProcessing(false);
        return;
      }

      // Store all encrypted files for download
      setAllEncryptedFiles(encryptedFiles);

      // Store the first encrypted file's data for backward compatibility
      if (encryptedFiles.length > 0) {
        setEncryptedCapsule(encryptedFiles[0].encryptionResult);
      }

      // Add all files to uploads table
      encryptedFiles.forEach((file, index) => {
        const uploadId = `upload-${Date.now()}-${index}`;
        setUploads((prev) => [
          ...prev,
          {
            id: uploadId,
            filename: filesToProcess[index].name,
            status: "committed",
            storageType: file.commitResult.storageType,
            encryptionType: "dossier-only",
            createdAt: new Date(),
            payloadUri: file.commitResult.payloadUri,
            contractDossierId: dossierId?.toString() || "pending",
            contractTxHash: contractTxHash,
          },
        ]);
      });

      // Load updated dossiers
      await fetchUserDossiers();

      // Add to activity log
      setActivityLog((prev) => [
        {
          type: `✅ Dossier #${dossierId?.toString() || "pending"} created with ${encryptedFiles.length} file(s)${smartWalletClient && authMode === "standard" ? " (gasless)" : ""}`,
          date: new Date().toLocaleString(),
        },
        {
          type: `🔒 ${encryptedFiles.length} file(s) encrypted with Dossier-only condition`,
          date: new Date().toLocaleString(),
        },
        {
          type: `📁 ${fileHashes.length} IPFS hash(es) stored on-chain`,
          date: new Date().toLocaleString(),
        },
        {
          type: `📦 Files committed to ${encryptedFiles[0]?.commitResult.storageType || "storage"}`,
          date: new Date().toLocaleString(),
        },
        ...prev,
      ]);

      setProcessingStatus("Complete!");
      setProcessingProgress(100);
      
      const successMessage =
        authMode === "standard"
          ? `🎉 Dossier secured! Remember to check in every ${checkInInterval} days.`
          : `🎉 Dossier #${dossierId} created! Check-in required every ${checkInInterval} days.`;
      toast.success(successMessage, { id: processingToast });

      // Reset form and navigate back to documents view
      setShowCreateForm(false);
      setCurrentStep(1);
      setEncryptedCapsule(null);
      setAllEncryptedFiles([]);
      setDossierManifest(null);
      setManifestStorageUrl(null);
      setUploadedFile(null);
      setUploadedFiles([]);
      setName("");
      setEmergencyContacts([""]);
      setReleaseMode("public");
      setProcessingStatus("");
      setProcessingProgress(0);
    } catch (error) {
      console.error("Error in dossier encryption flow:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown encryption error";

      toast.error(
        authMode === "standard"
          ? "Failed to secure your document. Please try again."
          : `Dossier encryption failed: ${errorMessage}`,
        { id: processingToast },
      );

      setActivityLog((prev) => [
        {
          type: "Dossier encryption failed",
          date: new Date().toLocaleString(),
        },
        ...prev,
      ]);
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
      setProcessingProgress(0);
    }
  };

  // Wrap processCanaryTrigger with network guard for automatic network switching
  const processCanaryTriggerWithNetworkGuard = useNetworkGuard(processCanaryTrigger);

  const copyManifest = () => {
    if (dossierManifest) {
      navigator.clipboard.writeText(JSON.stringify(dossierManifest, null, 2));
      toast.success("Manifest copied to clipboard");
    }
  };

  const downloadManifest = () => {
    if (dossierManifest) {
      const blob = new Blob([JSON.stringify(dossierManifest, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dossier_${dossierManifest.dossierId}_manifest.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Manifest downloaded");
    }
  };

  const downloadEncryptedFile = async () => {
    if (!encryptedCapsule) {
      toast.error(
        "No encrypted file available in memory. Please encrypt a file first.",
      );
      return;
    }

    try {
      console.log("📥 Downloading encrypted file from browser memory");
      console.log("📦 Original file:", encryptedCapsule.originalFileName);
      console.log(
        "📦 Encrypted size:",
        encryptedCapsule.encryptedData.length,
        "bytes",
      );

      // Create filename based on original file name
      const originalName = encryptedCapsule.originalFileName;
      const baseName =
        originalName.substring(0, originalName.lastIndexOf(".")) ||
        originalName;
      const filename = `${baseName}-encrypted.bin`;

      // Create blob from encrypted data in memory
      const blob = new Blob([encryptedCapsule.encryptedData], {
        type: "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);

      // Create download link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up URL
      URL.revokeObjectURL(url);

      console.log("🎉 MEMORY DOWNLOAD SUCCESS!");
      console.log("📦 Downloaded as:", filename);
      console.log("📦 Size:", encryptedCapsule.encryptedData.length, "bytes");

      // Add to activity log
      setActivityLog((prev) => [
        {
          type: "Encrypted file downloaded from memory",
          date: new Date().toLocaleString(),
        },
        ...prev,
      ]);
    } catch (error) {
      console.error("❌ Memory download failed:", error);
      toast.error(
        "Failed to download encrypted file from memory. Check console for details.",
      );
    }
  };

  const testDecryption = async () => {
    if (!encryptedCapsule) {
      toast.error("No encrypted file available. Please encrypt a file first.");
      return;
    }

    try {
      console.log("🔓 Testing TACo decryption...");

      // Import the decryption function
      const { tacoService } = await import("./lib/taco");

      // Get burner wallet if in anonymous mode
      const burnerWalletInstance = burnerWallet.wallet;

      // Attempt to decrypt the messageKit
      const decryptedData = await tacoService.decryptFile(
        encryptedCapsule.messageKit,
        burnerWalletInstance
      );

      console.log("🎉 Decryption test successful!");
      console.log("📦 Decrypted size:", decryptedData.length, "bytes");

      // Download the decrypted file
      const originalName = encryptedCapsule.originalFileName;
      const baseName =
        originalName.substring(0, originalName.lastIndexOf(".")) ||
        originalName;
      const extension =
        originalName.substring(originalName.lastIndexOf(".")) || "";
      const filename = `${baseName}-decrypted${extension}`;

      const mimeType = getMimeType(originalName);
      const blob = new Blob([decryptedData], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      // Add to activity log
      setActivityLog((prev) => [
        {
          type: "TACo decryption test successful",
          date: new Date().toLocaleString(),
        },
        ...prev,
      ]);

      toast.success("Decryption successful");
    } catch (error) {
      console.error("❌ Decryption test failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      let displayMessage = errorMessage;
      if (errorMessage.includes("time condition")) {
        displayMessage =
          "Decryption failed. The dossier condition may not be met yet.";
      }
      toast.error(`Decryption failed: ${displayMessage}`);

      // Add to activity log
      setActivityLog((prev) => [
        {
          type: "TACo decryption test failed",
          date: new Date().toLocaleString(),
        },
        ...prev,
      ]);
    }
  };

  // Load user's dossiers from contract with accurate decryptable status
  const fetchUserDossiers = async (targetAddress?: Address) => {
    setIsLoadingDossiers(true);
    let addressToFetch: string | null = null;

    if (targetAddress) {
      // Fetching specific user's dossiers (for viewing someone else's profile)
      addressToFetch = targetAddress;
      console.log("📋 Loading dossiers for user:", addressToFetch);
    } else {
      // Fetching own dossiers
      // In advanced mode, use the connected wallet address (Web3 wallet or burner wallet)
      // In standard mode, use smart wallet if available, otherwise embedded wallet
      if (authMode === "advanced") {
        addressToFetch = getCurrentAddress(); // Gets burner wallet, wagmi, or Privy address
        console.log(
          "🔧 Advanced mode - using wallet address:",
          addressToFetch,
        );
      } else {
        // Standard mode: prefer smart wallet for gasless transactions
        const smartWalletAddress = smartWalletClient?.account?.address;
        const embeddedWalletAddress =
          wallets.length > 0 ? wallets[0]?.address : null;
        addressToFetch = smartWalletAddress || embeddedWalletAddress;
        console.log(
          "🎯 Standard mode - smart wallet:",
          smartWalletAddress,
          "embedded:",
          embeddedWalletAddress,
        );
      }
    }

    if (!addressToFetch) {
      console.log("No wallet address available for loading dossiers");
      setIsLoadingDossiers(false);
      return;
    }

    // Update the viewing user address
    setViewingUserAddress(addressToFetch as Address);

    try {
      console.log("📋 Loading user dossiers from contract");
      console.log("🔑 Auth mode:", authMode);
      console.log("🎯 Using address:", addressToFetch);

      // Get dossier IDs from contract
      const dossierIds = await ContractService.getUserDossierIds(
        addressToFetch as Address,
      );

      const dossiers: DossierWithStatus[] = [];

      // Process dossiers
      for (const id of dossierIds) {
        try {
          const dossier = await ContractService.getDossier(
            addressToFetch as Address,
            id,
          );
          
          const currentTime = Date.now() / 1000;
          const timeSinceLastCheckIn = currentTime - Number(dossier.lastCheckIn);
          const shouldStayEncrypted = timeSinceLastCheckIn < Number(dossier.checkInInterval);
          const isDecryptable = dossier.isActive && !shouldStayEncrypted;

          const dossierWithStatus: DossierWithStatus = {
            ...dossier,
            isDecryptable: isDecryptable,
          };

          dossiers.push(dossierWithStatus);

          console.log(
            `📄 Dossier #${id.toString()}: isActive=${dossier.isActive}, shouldStayEncrypted=${shouldStayEncrypted}, isDecryptable=${isDecryptable}, fileHashes=${dossier.encryptedFileHashes.length}`,
          );
        } catch (error) {
          console.error(`❌ Failed to load dossier #${id.toString()}:`, error);

          // Show user-friendly error for ABI mismatch
          if (error instanceof Error && error.message.includes('ABI mismatch')) {
            toast.error(
              `Contract ABI mismatch detected. Please check that the deployed contract matches the expected version.`,
              { duration: 8000, id: 'abi-mismatch' }
            );
          }
        }
      }

      setUserDossiers(dossiers);
      setIsLoadingDossiers(false);
      console.log(
        `✅ Loaded ${dossiers.length} dossiers with accurate decryptable status`,
      );

      // If user has no dossiers and is on documents view, optionally show create form
      // Don't force navigation or automatically open create form
      if (dossiers.length === 0 && currentView === "documents") {
        // User can click the create button when ready
        console.log("📝 No dossiers found - user can create one when ready");
      }
    } catch (error) {
      console.error("❌ Failed to load dossiers:", error);
      setIsLoadingDossiers(false);
    }
  };

  const handleCheckIn = async () => {
    if (isCheckingIn) return; // Prevent double-clicks

    const now = new Date();
    const currentAddress = getCurrentAddress();

    // Check in on-chain if wallet connected and active dossiers exist
    if (hasWalletConnection() && currentAddress && userDossiers.length > 0) {
      const activeDossiers = userDossiers.filter((d) => d.isActive);

      if (activeDossiers.length === 0) {
        toast.error("No active dossiers to check in for");
        return;
      }

      setIsCheckingIn(true);

      // Show loading state first
      const checkInToast = toast.loading(
        authMode === "standard" ? "Checking in..." : "Checking in now...",
      );

      try {
        console.log(
          "✅ Performing bulk on-chain check-in for all active dossiers...",
        );

        // Use smart wallet for gasless check-in only in standard mode
        let txHash;
        if (smartWalletClient && authMode === "standard") {
          console.log("🚀 Using smart wallet for gasless check-in...");

          // Create the transaction data for checkInAll
          const txData = encodeFunctionData({
            abi: CANARY_DOSSIER_ABI,
            functionName: "checkInAll",
            args: [],
          });

          txHash = await smartWalletClient.sendTransaction({
            account: smartWalletClient.account,
            chain: polygonAmoy,
            to: CANARY_DOSSIER_ADDRESS,
            data: txData,
          });
        } else if (burnerWallet.isConnected && burnerWallet.wallet) {
          console.log("🔥 Using burner wallet for check-in...");

          try {
            // For burner wallets on Status Network (gasless)
            const { ethers } = await import("ethers");
            const provider = new ethers.providers.JsonRpcProvider('https://public.sepolia.rpc.status.network');
            const signer = burnerWallet.wallet.connect(provider);

            // Create contract instance on Status Network Sepolia
            const contract = new ethers.Contract(CANARY_DOSSIER_ADDRESS, CANARY_DOSSIER_ABI, signer);

            // Status Network is gasless - set gas to 0
            const tx = await contract.checkInAll({
              gasPrice: 0
            });
            const receipt = await tx.wait();
            txHash = receipt.transactionHash;

            console.log("✅ Burner wallet check-in transaction:", txHash);
          } catch (burnerError: any) {
            // Status Network is gasless, so these shouldn't be gas errors
            // Log the actual error for debugging
            console.error('❌ Burner wallet transaction failed:', burnerError);

            // Re-throw with more helpful error message
            throw new Error(
              `Transaction failed on Status Network (gasless).\n\n` +
              `Error: ${burnerError.message || 'Unknown error'}\n\n` +
              `Please try again or check your network connection.`
            );
          }
        } else {
          console.log(
            "⚠️ Using regular wallet transaction",
          );
          txHash = await ContractService.checkInAll();
        }

        // Success - all active dossiers checked in with single transaction
        toast.success(
          authMode === "standard"
            ? `Check-in successful`
            : `Check-in successful`,
          { id: checkInToast },
        );

        setActivityLog((prev) => [
          {
            type: `✅ Bulk check-in successful for ${activeDossiers.length} dossiers`,
            date: now.toLocaleString(),
            txHash: txHash,
          },
          ...prev,
        ]);

        // Reload dossiers to get updated lastCheckIn times
        await fetchUserDossiers();
      } catch (error) {
        console.error("❌ Bulk check-in failed:", error);

        // Enhanced error handling with specific messages
        let errorMessage = "Check-in failed. Please try again.";
        let isUserRejection = false;

        if (error instanceof Error) {
          if (error.message.includes("No dossiers found")) {
            errorMessage = "No dossiers found to check in to.";
          } else if (error.message.includes("No active dossiers")) {
            errorMessage = "No active dossiers found to check in to.";
          } else if (
            error.message.includes("user rejected") ||
            error.message.includes("rejected by user")
          ) {
            errorMessage = "Check-in cancelled";
            isUserRejection = true;
          } else if (error.message.includes("insufficient funds")) {
            // Check if using smart wallet (sponsored transactions)
            if (smartWalletClient && authMode === "standard") {
              errorMessage = "Transaction sponsorship temporarily unavailable. The paymaster may be out of funds. Please try again later or switch to an external wallet.";
            } else {
              errorMessage = "Insufficient funds for transaction fees. Please add MATIC to your wallet.";
            }
          } else if (error.message.includes("Network mismatch")) {
            errorMessage =
              "Please switch to Polygon Amoy network in your wallet.";
          } else if (error.message.includes("wallet provider")) {
            errorMessage =
              "Wallet connection issue. Please reconnect your wallet.";
          } else if (error.message.includes("Both bulk and individual")) {
            errorMessage =
              "Network issue prevented check-in. Please try again.";
          }
        }

        // Handle user rejection more gracefully
        if (isUserRejection) {
          toast.dismiss(checkInToast);
          toast(errorMessage);
          // Don't log cancellations as failures
          setActivityLog((prev) => [
            {
              type: `ℹ️ Check-in cancelled by user`,
              date: now.toLocaleString(),
            },
            ...prev,
          ]);
        } else {
          toast.error(errorMessage, { id: checkInToast });
          setActivityLog((prev) => [
            {
              type: `❌ Check-in failed: ${errorMessage}`,
              date: now.toLocaleString(),
            },
            ...prev,
          ]);
        }
      } finally {
        setIsCheckingIn(false);
      }
    } else if (!hasWalletConnection()) {
      toast.error(
        authMode === "standard"
          ? "Please sign in to update your documents"
          : "Please connect your wallet to check in",
      );
    } else if (!currentAddress) {
      toast.error("Wallet address not available");
    } else if (userDossiers.length === 0) {
      toast.error("No dossiers created yet. Create a dossier first.");
    } else {
      // Fallback to local check-in only
      setActivityLog((prev) => [
        { type: "Local check-in confirmed", date: now.toLocaleString() },
        ...prev,
      ]);
    }
  };

  // Wrap handleCheckIn with network guard for automatic network switching
  const handleCheckInWithNetworkGuard = useNetworkGuard(handleCheckIn);

  // Create wrapped versions of dossier management actions
  const pauseOrResumeDossier = useNetworkGuard(async (dossierId: bigint, isActive: boolean) => {
    const txHash = isActive
      ? await ContractService.pauseDossier(
          dossierId,
          burnerWallet.isConnected ? burnerWallet.wallet : undefined
        )
      : await ContractService.resumeDossier(
          dossierId,
          burnerWallet.isConnected ? burnerWallet.wallet : undefined
        );
    return txHash;
  });

  const disableDossier = useNetworkGuard(async (dossierId: bigint) => {
    return await ContractService.permanentlyDisableDossier(
      dossierId,
      burnerWallet.isConnected ? burnerWallet.wallet : undefined
    );
  });

  const releaseDossier = useNetworkGuard(async (dossierId: bigint) => {
    return await ContractService.releaseNow(
      dossierId,
      burnerWallet.isConnected ? burnerWallet.wallet : undefined
    );
  });

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
        return "No active dossiers";
      }

      const diffMs = currentTime.getTime() - mostRecentCheckIn * 1000;
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
      return "No dossiers created yet";
    }

    // If not connected, show disconnected status
    return "Wallet not connected";
  };

  const getRemainingTime = () => {
    // If connected and have dossiers, use contract status
    if (hasWalletConnection() && userDossiers.length > 0) {
      const activeDossiers = userDossiers.filter((d) => d.isActive);

      // If no active dossiers, show inactive status
      if (activeDossiers.length === 0) {
        return {
          expired: false,
          display: "NO ACTIVE DOSSIERS",
          color: "text-gray-500 dark:text-gray-400",
        };
      }

      // Check if any dossier is decryptable (expired)
      const hasExpiredDossiers = activeDossiers.some((d) => d.isDecryptable);

      if (hasExpiredDossiers) {
        return { expired: true, display: "DECRYPTABLE", color: "text-red-600" };
      }

      // All active dossiers are still encrypted
      return { expired: false, display: "ENCRYPTED", color: "text-green-600" };
    }

    // If connected but no dossiers, show status
    if (isConnected && userDossiers.length === 0) {
      return { expired: false, display: "NO DOSSIERS", color: "text-muted" };
    }

    // If not connected, show disconnected status
    return {
      expired: false,
      display: "DISCONNECTED",
      color: "text-gray-500 dark:text-gray-400",
    };
  };

  const getCountdownTime = () => {
    // If connected and have dossiers, calculate actual countdown
    if (hasWalletConnection() && userDossiers.length > 0) {
      const activeDossiers = userDossiers.filter((d) => d.isActive);

      // If no active dossiers, show inactive status
      if (activeDossiers.length === 0) {
        return {
          expired: false,
          display: "NO ACTIVE DOSSIERS",
          color: "text-gray-500 dark:text-gray-400",
        };
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
        return {
          expired: true,
          display: "⚠ EXPIRED",
          color: "text-red-600 dark:text-red-400",
        };
      }

      // If we have a valid remaining time, format it
      if (shortestRemainingMs !== Infinity && shortestRemainingMs > 0) {
        const remainingHours = Math.floor(
          shortestRemainingMs / (1000 * 60 * 60),
        );
        const remainingMinutes = Math.floor(
          (shortestRemainingMs % (1000 * 60 * 60)) / (1000 * 60),
        );
        const remainingSeconds = Math.floor(
          (shortestRemainingMs % (1000 * 60)) / 1000,
        );

        let color = "text-gray-900 dark:text-gray-100";
        if (shortestRemainingMs < 5 * 60 * 1000) {
          color = "text-red-600 dark:text-red-400";
        } else if (shortestRemainingMs < 30 * 60 * 1000) {
          color = "text-orange-600 dark:text-orange-400";
        } else if (shortestRemainingMs < 2 * 60 * 60 * 1000) {
          color = "text-yellow-700 dark:text-yellow-400";
        }

        let display = "";
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
      return { expired: false, display: "NO DOSSIERS", color: "text-muted" };
    }

    // If not connected, show disconnected status
    return {
      expired: false,
      display: "DISCONNECTED",
      color: "text-gray-500 dark:text-gray-400",
    };
  };

  const handleImportPrivateKey = () => {
    setShowImportKeyModal(true);
    setImportKeyValue("");
  };

  const handleConfirmImportKey = async () => {
    const privateKey = importKeyValue;

    if (!privateKey || privateKey.trim() === "") {
      toast.error("Please enter a private key");
      return;
    }

    // Basic validation - check if it looks like a private key
    const cleanKey = privateKey.trim();
    const isValid = /^(0x)?[a-fA-F0-9]{64}$/.test(cleanKey);

    if (!isValid) {
      toast.error("Invalid private key format. Please enter a valid Ethereum private key.");
      return;
    }

    try {
      setAuthModeWithPersistence("advanced");

      // Add 0x prefix if not present
      const formattedKey = cleanKey.startsWith("0x") ? cleanKey : `0x${cleanKey}`;

      // Import the wallet
      await burnerWallet.importPrivateKey(formattedKey);

      // Close modal on success
      setShowImportKeyModal(false);
      setImportKeyValue("");

      // Update UI state
      setSignedIn(true);
      setHasExistingAnonymousAccount(true);
      setExistingAnonymousAddress(burnerWallet.address);

      toast.success("Private key imported successfully!");
    } catch (error) {
      console.error("Failed to import private key:", error);
      toast.error("Failed to import private key. Please check the key and try again.");
    }
  };

  const handleCreateNewAnonymousAccount = async () => {
    // Show the custom warning modal
    setShowBurnWarningModal(true);
  };

  const handleConfirmCreateNewAccount = async () => {
    // Close the modal
    setShowBurnWarningModal(false);

    console.log("Creating new anonymous account, clearing existing...");
    setAuthModeWithPersistence("advanced");
    try {
      // Clear the existing wallet
      burnerWallet.clearWallet();
      // Create a new one
      const walletInfo = await burnerWallet.connect();
      console.log("🔥 New burner wallet created:", walletInfo.address);
      setSignedIn(true);
      toast.success("New anonymous wallet created! Your private key is saved locally.");
      // Update state
      setHasExistingAnonymousAccount(true);
      setExistingAnonymousAddress(walletInfo.address);
    } catch (error) {
      console.error("Failed to create new burner wallet:", error);
      toast.error("Failed to create new anonymous wallet. Please try again.");
    }
  };

  const handleSignIn = async (method: string) => {
    console.log("Sign in method:", method);

    if (method === "Burner Wallet" || method === "Restore Burner") {
      // Anonymous burner wallet login
      console.log("Connecting burner wallet...");
      setAuthModeWithPersistence("advanced"); // Set advanced mode for burner wallet
      try {
        const walletInfo = await burnerWallet.connect();
        console.log("🔥 Burner wallet connected:", walletInfo.address);
        setSignedIn(true);
        toast.success(
          walletInfo.isNew
            ? "Anonymous wallet created! Your private key is saved locally."
            : "Welcome back! Anonymous wallet restored."
        );
        // Update state after connecting
        setHasExistingAnonymousAccount(true);
        setExistingAnonymousAddress(walletInfo.address);
      } catch (error) {
        console.error("Failed to connect burner wallet:", error);
        toast.error("Failed to connect anonymous wallet. Please try again.");
      }
    } else if (method === "Web3 Wallet") {
      // Use Privy's connectWallet for external wallet connections
      console.log("Using Privy connectWallet for external wallet...");
      setAuthModeWithPersistence("advanced"); // Set advanced mode for Web3 wallet
      try {
        // Pass walletList to only show MetaMask and WalletConnect
        // Explicitly exclude Coinbase Wallet and Rainbow
        connectWallet({
          walletList: ['metamask', 'wallet_connect']
        });
      } catch (error) {
        console.error("Failed to connect external wallet via Privy:", error);
      }
    } else if (method === "Email") {
      // Email sign-in via Privy
      console.log("Privy states:", { ready, authenticated, signedIn });
      setAuthModeWithPersistence("standard"); // Set standard mode for email auth
      if (ready) {
        if (!authenticated) {
          console.log("Calling Privy login()...");
          login();
        } else if (!signedIn) {
          console.log("User already authenticated, setting signedIn to true");
          setSignedIn(true);
        } else {
          console.log("User already signed in");
        }
      } else {
        console.log("Privy not ready yet, waiting...");
      }
    } else {
      // Fallback for other methods
      setSignedIn(true);
    }
  };

  const handleLogout = () => {
    console.log("Logging out...", { authMode, authenticated, isConnected, burnerConnected: burnerWallet.isConnected });

    // Disconnect based on mode and wallet type
    if (authMode === "advanced") {
      if (burnerWallet.isConnected) {
        console.log("Disconnecting burner wallet...");
        burnerWallet.disconnect();
      }
      if (isConnected) {
        console.log("Disconnecting wagmi wallet...");
        disconnect();
      }
    }
    if (authMode === "standard" && authenticated) {
      console.log("Logging out from Privy...");
      logout();
    }

    // Clear URL parameters to ensure sign-in screen shows
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }

    // Reset all states and redirect to login
    setSignedIn(false);
    setAuthModeWithPersistence("standard");
    setCurrentView("checkin"); // Reset to default view
    setShowCreateForm(false); // Close any open forms
    setDocumentDetailView(false); // Close document detail
    setSelectedDocument(null); // Clear selected document
    // Clear dossiers data
    setUserDossiers([]);
    setIsLoadingDossiers(true);
    setViewingUserAddress(null);

    console.log("Logout complete");
  };

  const handleInstallClick = async () => {
    // iOS-specific instructions
    if (isIOS) {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isChrome = /crios/.test(userAgent);

      if (isChrome) {
        // iOS Chrome instructions
        toast(
          <div>
            <p className="font-semibold mb-2">Install Canary as PWA:</p>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Open this page in Safari</li>
              <li>Tap the Share button (square with arrow)</li>
              <li>Select "Add to Home Screen"</li>
              <li>Tap "Add"</li>
            </ol>
            <p className="text-xs mt-2 opacity-75">✓ Full PWA with offline support & app-like experience</p>
            <p className="text-xs mt-1 opacity-75">Note: iOS requires Safari for PWA installation</p>
          </div>,
          { duration: 10000 }
        );
      } else {
        // iOS Safari instructions
        toast(
          <div>
            <p className="font-semibold mb-2">Install Canary as PWA:</p>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Tap the Share button (square with arrow)</li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Name it and tap "Add"</li>
            </ol>
            <p className="text-xs mt-2 opacity-75">✓ This installs a real PWA with offline capabilities</p>
          </div>,
          { duration: 8000 }
        );
      }
      return;
    }

    // Standard install for other browsers
    if (!deferredPrompt) {
      toast.error('Install prompt not available. Try visiting in Chrome or Edge.');
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('📱 User accepted the install prompt');
      toast.success('Installing Canary...');
    } else {
      console.log('📱 User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  // Clear wagmi wallet connection on page refresh/load only if Privy is authenticated
  useEffect(() => {
    // Only disconnect wagmi if user is authenticated with Privy (to avoid conflicts)
    if (isConnected && authenticated) {
      console.log(
        "🔌 Disconnecting wagmi wallet on page refresh (Privy authenticated)...",
      );
      disconnect();
    }
    // Don't reset signedIn here - let the auto sign-in effect handle Privy authentication
  }, []); // Run only once on mount

  // Auto sign-in if wallet is already connected (but not if Privy is handling auth)
  useEffect(() => {
    if (isConnected && !signedIn && !authenticated) {
      console.log("Auto-signing in wagmi wallet user...");
      setAuthModeWithPersistence("advanced"); // User connected with Web3 wallet
      setSignedIn(true);
    }
  }, [isConnected, signedIn, authenticated]);

  // Auto sign-in if Privy is authenticated
  useEffect(() => {
    console.log("Auto sign-in effect triggered:", {
      ready,
      authenticated,
      signedIn,
    });
    if (ready && authenticated && !signedIn) {
      console.log("Auto-signing in authenticated Privy user...");
      setAuthModeWithPersistence("standard"); // User authenticated with email/Privy
      setSignedIn(true);
    }
  }, [ready, authenticated]);

  // Log smart wallet status
  useEffect(() => {
    console.log("💜 Smart wallet status:", {
      hasSmartWallet: !!smartWalletClient,
      smartWalletAccount: smartWalletClient?.account?.address,
      userSmartWallet: user?.smartWallet,
      authenticated,
      wallets: wallets.length,
    });
  }, [smartWalletClient, user, authenticated, wallets]);

  // Auto-connect Privy embedded wallet to wagmi
  useEffect(() => {
    if (ready && authenticated && wallets.length > 0 && !isConnected) {
      console.log("Auto-connecting Privy embedded wallet...", { wallets });
      const embeddedWallet = wallets.find(
        (wallet) => wallet.walletClientType === "privy",
      );
      if (embeddedWallet) {
        console.log("Found embedded wallet:", embeddedWallet);
        setActiveWallet(embeddedWallet)
          .then(() => {
            console.log("Embedded wallet set as active");
          })
          .catch((error) => {
            console.error("Failed to set embedded wallet as active:", error);
          });
      }
    }
  }, [ready, authenticated, wallets, isConnected, setActiveWallet]);

  // Return to sign-in screen if ALL wallets (wagmi, Privy, and burner) are disconnected
  useEffect(() => {
    if (!isConnected && !authenticated && !burnerWallet.isConnected && signedIn) {
      console.log("All wallets disconnected, signing out...");
      setSignedIn(false);
    }
  }, [isConnected, authenticated, burnerWallet.isConnected, signedIn]);

  // Load contract data when wallet connects (wagmi, Privy, or burner)
  useEffect(() => {
    const currentAddress = getCurrentAddress();
    if ((isConnected && address) || (authenticated && wallets.length > 0) || burnerWallet.isConnected) {
      console.log("Loading contract data for address:", currentAddress);
      fetchUserDossiers();

      // Load contract constants
      ContractService.getConstants()
        .then((constants) => {
          setContractConstants(constants);
          // Don't set any default - user must explicitly choose
          console.log("📊 Contract constants loaded:", constants);
        })
        .catch((error) => {
          console.error("❌ Failed to load contract constants:", error);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, authenticated, wallets, authMode, burnerWallet.isConnected]);

  // Reload dossiers when smart wallet becomes available in standard mode
  useEffect(() => {
    if (smartWalletClient && signedIn && authMode === "standard") {
      console.log(
        "🔄 Smart wallet now available in standard mode, reloading dossiers...",
      );
      fetchUserDossiers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartWalletClient, signedIn, authMode]);

  // Handle URL params to show user's dossiers and optionally open detail view
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get('user');
      const idParam = urlParams.get('id');

      if (userParam) {
        const targetAddress = userParam as Address;

        // Check if we need to fetch different user's dossiers
        if (!viewingUserAddress || viewingUserAddress.toLowerCase() !== targetAddress.toLowerCase()) {
          console.log('📍 URL changed to view user:', targetAddress);
          fetchUserDossiers(targetAddress);
          setCurrentView('documents'); // Switch to documents view
        }

        // If there's also an ID param, open that dossier's detail view
        if (idParam && userDossiers.length > 0) {
          const dossierId = BigInt(idParam);
          const dossier = userDossiers.find(d => d.id === dossierId);
          if (dossier && !documentDetailView) {
            setSelectedDocument(dossier);
            setDocumentDetailView(true);
          }
        }
      } else if (viewingUserAddress) {
        // No user param in URL, reset to own dossiers
        const currentAddress = getCurrentAddress();
        if (currentAddress && viewingUserAddress.toLowerCase() !== currentAddress.toLowerCase()) {
          console.log('📍 URL cleared, resetting to own dossiers');
          fetchUserDossiers();
        }
      }

      // Handle closing detail view when no ID param
      if (!idParam && documentDetailView) {
        setSelectedDocument(null);
        setDocumentDetailView(false);
      }
    };

    // Handle initial load
    handleUrlChange();

    // Handle browser back/forward
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [userDossiers, documentDetailView, viewingUserAddress]);

  // Check if there's a user param in URL (viewing someone's dossiers while logged out)
  const hasUserParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('user');

  // Show sign-in page if not signed in (always require login first)
  if (!signedIn) {
    return (
      <div className={theme}>
        <Toaster position="top-right" />
        <div
          className={`min-h-screen flex flex-col ${theme === "light" ? "bg-gray-50" : "bg-black"}`}
        >
          <div
            className={`flex-1 flex items-center justify-center relative overflow-y-auto ${theme === "light" ? "bg-gray-50" : "bg-black"}`}
          >
            {/* Theme Toggle Button - Top Right */}
            <button
              onClick={toggleTheme}
              className="absolute top-6 right-6 p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors z-10"
              title={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
            >
              {theme === "light" ? (
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>

            {/* Cryptographic Pattern Accent */}
            <div className="crypto-dot-matrix absolute inset-0 pointer-events-none"></div>

            {/* Main Sign-in Area */}
            <div className="max-w-xl w-full mx-auto px-6 sm:px-8 py-12 sm:py-8">
              <div className="text-center">
                {/* Logo and Text - Centered Above Title */}
                <div className="mb-8 flex flex-col items-center gap-4">
                  <img
                    src="/solo-canary.png"
                    alt="Canary"
                    className="h-14 w-auto opacity-90"
                    style={{
                      filter: "drop-shadow(0 1px 3px rgba(31, 31, 31, 0.1))",
                    }}
                  />
                  <span
                    className={`text-2xl font-medium tracking-wide uppercase ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                  >
                    CANARY
                  </span>
                </div>

                {/* Title and Subtitle */}
                <div className="mb-12">
                  <h1
                    className={`editorial-header-large text-center mb-4 ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                  >
                    Canary Testnet Demo
                  </h1>
                  <p
                    className={`editorial-body-large max-w-sm mx-auto font-medium ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                  >
                    If you go silent,{" "}
                    <span className="text-red-600">Canary</span> speaks for you.
                  </p>
                </div>

                {/* Sign-in Buttons */}
                <div className="space-y-4 max-w-sm mx-auto mb-16">
                  <button
                    className={`w-full py-4 px-6 font-medium text-base rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out border ${
                      theme === "light"
                        ? "bg-black text-white border-black hover:border-[#e53e3e] hover:bg-gray-800"
                        : "bg-black/40 text-white border-gray-600 hover:border-[#e53e3e] hover:bg-[rgba(229,62,62,0.1)]"
                    }`}
                    onClick={() => handleSignIn("Email")}
                    disabled={!ready}
                  >
                    {!ready ? "Initializing..." : "Sign in with Email"}
                  </button>

                  <div className="text-center">
                    <div className="flex items-center gap-3 my-6">
                      <div
                        className={`flex-1 h-px ${theme === "light" ? "bg-gray-300" : "bg-gray-600"}`}
                      ></div>
                      <span
                        className={`text-xs font-medium tracking-widest ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}
                      >
                        ADVANCED
                      </span>
                      <div
                        className={`flex-1 h-px ${theme === "light" ? "bg-gray-300" : "bg-gray-600"}`}
                      ></div>
                    </div>

                    <div className="space-y-3">
                      {hasExistingAnonymousAccount && existingAnonymousAddress ? (
                        <div className="space-y-3">
                          {/* Restore existing account button */}
                          <button
                            className={`w-full py-4 px-6 font-medium text-base rounded-lg transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed border ${
                              theme === "light"
                                ? "bg-white text-gray-900 border-gray-300 hover:border-[#e53e3e] hover:bg-gray-50"
                                : "bg-black/40 text-gray-100 border-gray-600 hover:border-[#e53e3e] hover:bg-[rgba(229,62,62,0.1)]"
                            }`}
                            onClick={() => handleSignIn("Restore Burner")}
                            disabled={burnerWallet.isLoading}
                            title={`Restore saved account: ${existingAnonymousAddress}`}
                          >
                            {burnerWallet.isLoading ? (
                              <div className="flex items-center justify-center gap-3">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                <span>Connecting...</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-3">
                                <Jazzicon diameter={20} seed={parseInt(existingAnonymousAddress.slice(2, 10), 16)} />
                                <span>Restore Account</span>
                                <code className="text-xs font-mono opacity-50">
                                  {existingAnonymousAddress.slice(0, 6)}...{existingAnonymousAddress.slice(-4)}
                                </code>
                              </div>
                            )}
                          </button>

                          {/* Create new account button */}
                          <button
                            className={`w-full py-4 px-6 text-base font-medium rounded-lg transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed border ${
                              theme === "light"
                                ? "bg-white text-gray-900 border-gray-300 hover:border-[#e53e3e] hover:bg-gray-50"
                                : "bg-black/40 text-gray-100 border-gray-600 hover:border-[#e53e3e] hover:bg-[rgba(229,62,62,0.1)]"
                            }`}
                            onClick={handleCreateNewAnonymousAccount}
                            disabled={burnerWallet.isLoading}
                            title="Create a new anonymous account (will replace the existing one)"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              <span>Create New Anonymous Account</span>
                            </div>
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            className={`w-full py-4 px-6 font-medium text-base rounded-lg transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed border ${
                              theme === "light"
                                ? "bg-white text-gray-900 border-gray-300 hover:border-[#e53e3e] hover:bg-gray-50"
                                : "bg-black/40 text-gray-100 border-gray-600 hover:border-[#e53e3e] hover:bg-[rgba(229,62,62,0.1)]"
                            }`}
                            onClick={() => handleSignIn("Burner Wallet")}
                            disabled={burnerWallet.isLoading}
                            title="Anonymous wallet stored locally in your browser"
                          >
                            {burnerWallet.isLoading ? (
                              <div className="flex items-center justify-center gap-3">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                <span>Connecting...</span>
                              </div>
                            ) : (
                              "Anonymous Account"
                            )}
                          </button>
                        </>
                      )}

                      {/* Import from Private Key - Always Available */}
                      <button
                        className={`w-full py-4 px-6 font-medium text-base rounded-lg transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed border ${
                          theme === "light"
                            ? "bg-white text-gray-900 border-gray-300 hover:border-[#e53e3e] hover:bg-gray-50"
                            : "bg-black/40 text-gray-100 border-gray-600 hover:border-[#e53e3e] hover:bg-[rgba(229,62,62,0.1)]"
                        }`}
                        onClick={handleImportPrivateKey}
                        title="Import an anonymous account using your private key"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7h3a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h3m6 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v2m6 0h-6" />
                          </svg>
                          <span>Import from Private Key</span>
                        </div>
                      </button>

                      <button
                        className={`w-full py-4 px-6 font-medium text-base rounded-lg transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed border ${
                          theme === "light"
                            ? "bg-white text-gray-900 border-gray-300 hover:border-[#e53e3e] hover:bg-gray-50"
                            : "bg-black/40 text-gray-100 border-gray-600 hover:border-[#e53e3e] hover:bg-[rgba(229,62,62,0.1)]"
                        }`}
                        onClick={() => handleSignIn("Web3 Wallet")}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <div className="flex items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                            <span>Connecting...</span>
                          </div>
                        ) : (
                          "Connect Web3 Wallet"
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Public Releases Link */}
                <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-center">
                    <p
                      className={`text-sm mb-4 ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                    >
                      Want to see public releases?
                    </p>
                    <a
                      href="/feed"
                      className={`inline-flex items-center gap-2 px-6 py-3 font-medium text-base rounded-lg transition-all duration-300 ease-out border ${
                        theme === "light"
                          ? "text-gray-900 border-gray-300 hover:border-[#e53e3e] hover:text-[#e53e3e] hover:bg-[rgba(229,62,62,0.05)]"
                          : "text-gray-100 border-gray-600 hover:border-[#e53e3e] hover:text-[#e53e3e] hover:bg-[rgba(229,62,62,0.1)]"
                      }`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                      </svg>
                      VIEW PUBLIC RELEASES
                    </a>
                  </div>
                </div>

                {/* PWA Install Button */}
                {showInstallButton && (
                  <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 pb-safe">
                    <div className="text-center">
                      <p
                        className={`text-sm mb-4 ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                      >
                        Install Canary as a mobile app
                      </p>
                      <button
                        onClick={handleInstallClick}
                        className={`inline-flex items-center gap-2 px-6 py-3 font-medium text-base rounded-lg transition-all duration-300 ease-out border ${
                          theme === "light"
                            ? "text-gray-900 border-gray-300 hover:border-[#e53e3e] hover:text-[#e53e3e] hover:bg-[rgba(229,62,62,0.05)]"
                            : "text-gray-100 border-gray-600 hover:border-[#e53e3e] hover:text-[#e53e3e] hover:bg-[rgba(229,62,62,0.1)]"
                        }`}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                        {isIOS ? 'HOW TO INSTALL' : 'INSTALL MOBILE APP'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Burn Account Warning Modal */}
          {showBurnWarningModal && (
            <BurnAccountWarningModal
              onConfirm={handleConfirmCreateNewAccount}
              onCancel={() => setShowBurnWarningModal(false)}
            />
          )}

          {/* Import Private Key Modal */}
          {showImportKeyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => {
                  setShowImportKeyModal(false);
                  setImportKeyValue("");
                }}
              />

              {/* Modal Content */}
              <div className={`relative z-10 w-full max-w-md mx-6 p-6 rounded-2xl ${
                theme === 'light'
                  ? 'bg-white border border-gray-300'
                  : 'bg-gray-900 border border-gray-700'
              }`}>
                <h2 className={`text-lg font-semibold mb-4 ${
                  theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                }`}>
                  Enter your private key to import:
                </h2>

                {/* Warning Message */}
                <div className={`mb-4 p-3 rounded-lg border ${
                  theme === 'light'
                    ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                    : 'bg-yellow-900/20 border-yellow-700 text-yellow-300'
                }`}>
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-sm">
                      <p className="font-semibold mb-1">SECURITY WARNING:</p>
                      <ul className="space-y-1">
                        <li>• Never share your private key with anyone</li>
                        <li>• Make sure no one is watching your screen</li>
                        <li>• This will replace any existing anonymous account</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Input Field */}
                <input
                  type="password"
                  value={importKeyValue}
                  onChange={(e) => setImportKeyValue(e.target.value)}
                  placeholder="Enter your private key (0x...)"
                  className={`w-full px-4 py-3 rounded-lg border font-mono text-sm ${
                    theme === 'light'
                      ? 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-[#e53e3e] focus:ring-1 focus:ring-[#e53e3e]'
                      : 'bg-black/50 border-gray-700 text-gray-100 placeholder-gray-500 focus:border-[#e53e3e] focus:ring-1 focus:ring-[#e53e3e]'
                  } focus:outline-none transition-colors`}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleConfirmImportKey();
                    }
                  }}
                />

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowImportKeyModal(false);
                      setImportKeyValue("");
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                      theme === 'light'
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmImportKey}
                    disabled={!importKeyValue.trim()}
                    className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      theme === 'light'
                        ? 'bg-gray-900 text-white hover:bg-black disabled:hover:bg-gray-900'
                        : 'bg-white text-black hover:bg-gray-100 disabled:hover:bg-white'
                    }`}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer
            className={`border-t flex-shrink-0 ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black"}`}
          >
            <div className="max-w-7xl mx-auto px-6 py-4">
              {/* Main footer links */}
              <div className="flex items-center justify-center gap-6 mb-3">
                <a
                  href="https://canaryapp.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 text-xs transition-colors ${theme === "light" ? "text-gray-600 hover:text-gray-900" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Website</span>
                </a>

                <a
                  href="https://docs.canaryapp.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 text-xs transition-colors ${theme === "light" ? "text-gray-600 hover:text-gray-900" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Docs</span>
                </a>

                <a
                  href="https://github.com/TheThirdRoom/canary"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 text-xs transition-colors ${theme === "light" ? "text-gray-600 hover:text-gray-900" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <Github size={18} />
                  <span>Source</span>
                </a>

                <a
                  href="mailto:contact@canaryapp.io"
                  className={`flex items-center gap-1.5 text-xs transition-colors ${theme === "light" ? "text-gray-600 hover:text-gray-900" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Contact</span>
                </a>
              </div>

              {/* Legal links */}
              <div
                className={`text-center mt-2 pt-2 border-t ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <a
                    href="/acceptable-use-policy"
                    className={`text-xs transition-colors ${
                      theme === "light" ? "text-gray-500 hover:text-gray-700" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Acceptable Use
                  </a>
                  <span className={`text-xs ${theme === "light" ? "text-gray-400" : "text-gray-600"}`}>•</span>
                  <a
                    href="/terms-of-service"
                    className={`text-xs transition-colors ${
                      theme === "light" ? "text-gray-500 hover:text-gray-700" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Terms
                  </a>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <p className={`text-xs ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}>
                    © 2025 Canary
                  </p>
                  {version && (
                    <>
                      <span className={`text-xs ${theme === "light" ? "text-gray-400" : "text-gray-600"}`}>•</span>
                      <a
                        href={`https://github.com/BlackLatch/canary-app/commit/${version.commit}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs font-mono transition-colors ${theme === "light" ? "text-gray-500 hover:text-gray-700" : "text-gray-500 hover:text-gray-300"}`}
                        title={`Built: ${new Date(version.buildTime).toLocaleString()}\nBranch: ${version.branch}`}
                      >
                        {version.commit}
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  // Main app content for signed-in users
  return (
    <div className={theme}>
      <Toaster position="top-right" />
      <DemoDisclaimer 
        theme={theme} 
        forceShow={showDemoDisclaimer}
        onClose={() => setShowDemoDisclaimer(false)}
      />
      <Suspense fallback={null}>
        <HomeContent onViewChange={setCurrentView} />
      </Suspense>
      <div
        className={`min-h-screen flex flex-col ${theme === "light" ? "bg-white" : "bg-black"}`}
      >
        {/* Alpha Status Indicator - Non-dismissable */}
        <div
          className={`border-b flex-shrink-0 ${theme === "light" ? "bg-white border-gray-200" : "bg-black border-gray-600"}`}
        >
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-center h-8 gap-2">
              <span
                className={`text-xs font-medium tracking-wider uppercase ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
              >
                FOR DEMONSTRATION PURPOSES ONLY
              </span>
              <button
                onClick={() => setShowDemoDisclaimer(true)}
                className={`text-xs hover:underline ${theme === "light" ? "text-red-600" : "text-red-400"}`}
              >
                [learn more]
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col" style={{ zoom: "0.8" }}>
          {/* Header */}
          <header
            className={`border-b ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black"}`}
            style={{ marginTop: "0px" }}
          >
            <div className="max-w-7xl mx-auto px-6 py-3">
              <div className="flex items-center justify-between h-10">
                {/* Left: Logo and Text */}
                <div className="flex items-center gap-3">
                  <img
                    src="/solo-canary.png"
                    alt="Canary"
                    className="h-10 w-auto"
                    style={{
                      filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))",
                    }}
                  />
                  <span
                    className={`text-xl font-medium tracking-wide uppercase ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                  >
                    CANARY
                  </span>
                </div>

                {/* Right: Navigation and Wallet Status */}
                <div className="flex items-center gap-8">
                  {/* Main Navigation */}
                  <nav className="flex items-center gap-6 h-full">
                    <button
                      onClick={() => setCurrentView("checkin")}
                      className={`nav-link ${
                        currentView === "checkin" ? "nav-link-active" : ""
                      }`}
                    >
                      CHECK IN
                    </button>
                    <button
                      onClick={() => {
                        setCurrentView("documents");
                        // Update URL to include user param when viewing dossiers
                        const currentAddress = getCurrentAddress();
                        if (currentAddress) {
                          window.history.pushState({}, '', `/?user=${currentAddress}`);
                        }
                      }}
                      className={`nav-link ${
                        currentView === "documents" ? "nav-link-active" : ""
                      }`}
                    >
                      DOSSIERS
                    </button>
                    <button
                      onClick={() => setCurrentView("monitor")}
                      className={`nav-link ${
                        currentView === "monitor" ? "nav-link-active" : ""
                      }`}
                    >
                      MONITOR
                    </button>
                    <a href="/feed" className="nav-link">
                      PUBLIC RELEASES
                    </a>
                    <button
                      onClick={() => setCurrentView("settings")}
                      className={`p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/10 ${
                        currentView === "settings" 
                          ? theme === "light" 
                            ? "bg-gray-100 text-gray-900" 
                            : "bg-white/10 text-white"
                          : theme === "light"
                            ? "text-gray-500 hover:text-gray-700"
                            : "text-gray-400 hover:text-gray-200"
                      }`}
                      aria-label="Settings"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </nav>

                  {/* Wallet Status and Theme Toggle */}
                  <div className="flex items-center gap-6">
                    {/* Theme Toggle */}
                    <button
                      onClick={toggleTheme}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
                      title={
                        theme === "light"
                          ? "Switch to dark mode"
                          : "Switch to light mode"
                      }
                    >
                      {theme === "light" ? (
                        <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>

                    {/* Authentication Status */}
                    {hasWalletConnection() ? (
                      <div className="flex items-center gap-4">
                        {authMode === "advanced" && getCurrentAddress() ? (
                          <>
                            {/* Advanced mode: Show wallet address (Web3, Burner, or Privy) */}
                            <div
                              className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                            >
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span
                                className={`monospace-accent ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                              >
                                {`${getCurrentAddress()!.slice(0, 6)}...${getCurrentAddress()!.slice(-4)}`}
                              </span>
                            </div>
                          </>
                        ) : authMode === "standard" && authenticated ? (
                          // Standard mode: Show user email or authenticated status
                          <div
                            className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                          >
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span
                              className={`monospace-accent ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                            >
                              {user?.email?.address || "Signed In"}
                            </span>
                          </div>
                        ) : null}

                        <button
                          onClick={handleLogout}
                          className="text-sm text-muted hover:text-primary transition-colors"
                        >
                          SIGN OUT
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleLogout}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                      >
                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                        <span className={`monospace-accent ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}>
                          Not Signed In
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {currentView === "history" ? (
              // Check-in History View
              <div
                className={`flex-1 overflow-auto ${theme === "light" ? "bg-white" : "bg-black"}`}
              >
                <div className="max-w-7xl mx-auto px-6 py-8">
                  {/* Page Header */}
                  <div
                    className={`mb-12 border-b pb-8 ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h1 className="editorial-header-large text-black dark:text-gray-100 mb-3">
                          CHECK-IN HISTORY
                        </h1>
                        <p className="editorial-body dark:text-gray-400">
                          View all system activity and check-in events
                        </p>
                      </div>
                      <button
                        onClick={() => setCurrentView("checkin")}
                        className={`px-4 py-2 border rounded-lg font-medium text-sm transition-colors ${
                          theme === "light"
                            ? "border-gray-300 text-gray-700 hover:bg-gray-50"
                            : "border-gray-600 text-gray-300 hover:bg-white/5"
                        }`}
                      >
                        ← Back to Check In
                      </button>
                    </div>
                  </div>

                  {/* History Content */}
                  {activityLog.length > 0 ? (
                    <div className="space-y-4">
                      {activityLog.map((activity, index) => (
                        <div
                          key={index}
                          className={`border rounded-lg px-6 py-5 transition-all duration-300 ease-out hover:-translate-y-1 ${
                            theme === "light"
                              ? "border-gray-300 bg-white hover:border-[#e53e3e]"
                              : "border-gray-600 bg-black/40 hover:border-[#e53e3e]"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p
                                className={`text-base font-medium ${
                                  theme === "light"
                                    ? "text-gray-900"
                                    : "text-gray-100"
                                }`}
                              >
                                {activity.type}
                              </p>
                              <div className="flex items-center gap-4 mt-2">
                                <p
                                  className={`text-sm ${
                                    theme === "light"
                                      ? "text-gray-500"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {activity.date}
                                </p>
                                {activity.txHash && (
                                  <a
                                    href={`https://amoy.polygonscan.com/tx/${activity.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-sm flex items-center gap-1 underline transition-colors ${
                                      theme === "light"
                                        ? "text-blue-600 hover:text-blue-800"
                                        : "text-blue-400 hover:text-blue-300"
                                    }`}
                                  >
                                    <svg
                                      className="w-3 h-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                      />
                                    </svg>
                                    View on Polygon
                                  </a>
                                )}
                              </div>
                            </div>
                            {activity.type.includes("✅") && (
                              <div className="flex-shrink-0 ml-4">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                              </div>
                            )}
                            {activity.type.includes("❌") && (
                              <div className="flex-shrink-0 ml-4">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                              </div>
                            )}
                            {activity.type.includes("ℹ️") && (
                              <div className="flex-shrink-0 ml-4">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                              </div>
                            )}
                            {activity.type.includes("🔓") && (
                              <div className="flex-shrink-0 ml-4">
                                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                              </div>
                            )}
                            {activity.type.includes("🚫") && (
                              <div className="flex-shrink-0 ml-4">
                                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className={`text-center py-16 border rounded-lg ${
                        theme === "light"
                          ? "border-gray-300 bg-white"
                          : "border-gray-600 bg-black/40"
                      }`}
                    >
                      <svg
                        className="w-16 h-16 mx-auto mb-6 opacity-30"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p
                        className={`text-lg font-medium ${
                          theme === "light" ? "text-gray-500" : "text-gray-400"
                        }`}
                      >
                        No activity recorded yet
                      </p>
                      <p
                        className={`text-sm mt-2 ${
                          theme === "light" ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        Check-in events and system activity will appear here
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : currentView === "checkin" ? (
              // Check In View - Matching Public Releases Layout
              <div
                className={`flex-1 overflow-auto ${theme === "light" ? "bg-white" : "bg-black"}`}
              >
                <div className="max-w-7xl mx-auto px-6 py-8">
                  {/* Page Header - Like Public Releases */}
                  <div
                    className={`mb-12 border-b pb-8 ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h1 className="editorial-header-large text-black dark:text-gray-100">
                          CHECK IN
                        </h1>
                      </div>
                      {/* Share Status Button - Prominent in upper right */}
                      <button
                        onClick={() => {
                          const currentAddress = getCurrentAddress();
                          const shareUrl = `${window.location.origin}/?user=${currentAddress}`;
                          navigator.clipboard
                            .writeText(shareUrl)
                            .then(() => {
                              toast.success("Share link copied!", {
                                duration: 3000,
                              });
                            })
                            .catch(() => {
                              toast.error("Failed to copy share link");
                            });
                        }}
                        className={`px-6 py-3 rounded-lg font-medium text-sm uppercase tracking-wider transition-all duration-200 ${
                          theme === "light"
                            ? "bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow-md"
                            : "bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                            />
                          </svg>
                          <span>SHARE STATUS</span>
                        </div>
                      </button>
                    </div>
                    <p className="editorial-body dark:text-gray-400">
                      Maintain your system status and manage your encrypted
                      documents
                    </p>
                  </div>

                  {hasWalletConnection() && isLoadingDossiers ? (
                    // Loading State for Check-in View
                    <div className="space-y-8">
                      {/* System Control Card Skeleton */}
                      <div
                        className={`border rounded-lg px-6 py-5 ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                      >
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
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`border rounded-lg px-6 py-5 ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                          >
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
                      <div
                        className={`border rounded-lg overflow-hidden mb-12 transition-all duration-300 ease-out hover:-translate-y-1 ${theme === "light" ? "border-gray-300 bg-white hover:border-[#e53e3e]" : "border-gray-600 bg-black/40 hover:border-[#e53e3e]"}`}
                      >
                        {/* System Control Header */}
                        <div
                          className={`px-6 py-5 flex items-center justify-between border-b ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}
                        >
                          <span className="editorial-label text-gray-700 dark:text-gray-400">
                            SYSTEM CONTROL
                          </span>
                          {/* Toggle Switch */}
                          <button
                            onClick={() =>
                              setDummyMasterSwitch(!dummyMasterSwitch)
                            }
                            className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${
                              dummyMasterSwitch
                                ? "bg-green-600"
                                : "bg-gray-300 dark:bg-gray-700"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                                dummyMasterSwitch
                                  ? "translate-x-7"
                                  : "translate-x-0"
                              }`}
                            />
                            <span
                              className={`absolute inset-0 flex items-center ${
                                dummyMasterSwitch
                                  ? "justify-start pl-2"
                                  : "justify-end pr-2"
                              }`}
                            >
                              <span className="text-[10px] font-bold text-white">
                                {dummyMasterSwitch ? "ON" : "OFF"}
                              </span>
                            </span>
                          </button>
                        </div>

                        {/* Status and Check-in Section - Inside the same card */}
                        <div className="px-6 py-8 text-center">
                          <h2
                            className={`text-5xl font-bold mb-10 ${
                              dummyMasterSwitch
                                ? "dark:text-white"
                                : "dark:text-gray-500"
                            }`}
                            style={{
                              color: dummyMasterSwitch
                                ? typeof window !== "undefined" &&
                                  !document.documentElement.classList.contains(
                                    "dark",
                                  )
                                  ? "#000000"
                                  : undefined
                                : typeof window !== "undefined" &&
                                    !document.documentElement.classList.contains(
                                      "dark",
                                    )
                                  ? "#9ca3af"
                                  : undefined,
                            }}
                          >
                            {dummyMasterSwitch ? "ACTIVE" : "INACTIVE"}
                          </h2>

                          {/* Check In Button - Editorial Style */}
                          <button
                            onClick={handleCheckInWithNetworkGuard}
                            disabled={
                              isCheckingIn ||
                              !dummyMasterSwitch ||
                              userDossiers.filter((d) => d.isActive).length ===
                                0
                            }
                            className={`max-w-md mx-auto block px-8 py-4 rounded-lg font-medium text-base uppercase tracking-wider transition-all duration-300 ease-out border ${
                              dummyMasterSwitch && !isCheckingIn
                                ? theme === "light"
                                  ? "bg-black text-white border-black hover:bg-gray-800 hover:border-[#e53e3e]"
                                  : "bg-black text-white border-gray-600 hover:bg-gray-900 hover:border-[#e53e3e]"
                                : theme === "light"
                                  ? "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
                                  : "bg-gray-900 text-gray-600 border-gray-700 cursor-not-allowed"
                            }`}
                          >
                            {isCheckingIn ? (
                              <div className="flex items-center justify-center gap-3">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent"></div>
                                <span>CHECKING IN...</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-3">
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                <span>CHECK IN NOW</span>
                              </div>
                            )}
                          </button>
                        </div>
                      </div>


                      {/* Status Information - Horizontal Grid on Desktop */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* System Status Card */}
                        <div
                          className={`border rounded-lg px-6 py-5 flex items-center justify-between transition-all duration-300 ease-out hover:-translate-y-1 ${theme === "light" ? "border-gray-300 bg-white hover:border-[#e53e3e]" : "border-gray-600 bg-black/40 hover:border-[#e53e3e]"}`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                getCountdownTime().display === "EXPIRED"
                                  ? "bg-red-500 animate-pulse"
                                  : "bg-green-500"
                              }`}
                            />
                            <div>
                              <div
                                className={`text-sm font-medium uppercase tracking-wider ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                              >
                                SYSTEM STATUS
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                                {getCountdownTime().display === "EXPIRED"
                                  ? "Check-in required"
                                  : "System healthy"}
                              </div>
                            </div>
                          </div>
                          <div
                            className={`text-sm font-medium ${getCountdownTime().color}`}
                          >
                            {getCountdownTime().display}
                          </div>
                        </div>

                        {/* Last Check-in Card - Clickable */}
                        <div
                          onClick={() => setCurrentView("history")}
                          className={`border rounded-lg px-6 py-5 flex items-center justify-between transition-all duration-300 ease-out hover:-translate-y-1 cursor-pointer ${theme === "light" ? "border-gray-300 bg-white hover:border-[#e53e3e]" : "border-gray-600 bg-black/40 hover:border-[#e53e3e]"}`}
                        >
                          <div>
                            <div
                              className={`text-sm font-medium uppercase tracking-wider ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                            >
                              LAST CHECK-IN
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                              Time since last activity
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 monospace-accent">
                              {getTimeSinceLastCheckIn()}
                            </div>
                            <svg
                              className={`w-5 h-5 ${theme === "light" ? "text-gray-400" : "text-gray-500"}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>

                        {/* Active Documents Card - Clickable */}
                        <div
                          onClick={() => setCurrentView("documents")}
                          className={`border rounded-lg px-6 py-5 flex items-center justify-between transition-all duration-300 ease-out hover:-translate-y-1 cursor-pointer ${theme === "light" ? "border-gray-300 bg-white hover:border-[#e53e3e]" : "border-gray-600 bg-black/40 hover:border-[#e53e3e]"}`}
                        >
                          <div>
                            <div
                              className={`text-sm font-medium uppercase tracking-wider ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                            >
                              ACTIVE DOSSIERS
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                              Protected with encryption
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div
                              className={`text-2xl font-bold ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                            >
                              {userDossiers.filter((d) => d.isActive).length}
                            </div>
                            <svg
                              className={`w-5 h-5 ${theme === "light" ? "text-gray-400" : "text-gray-500"}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : !hasWalletConnection() ? (
                    // Connection Prompt - Clean style
                    <div>
                      <div
                        className={`text-center py-16 border rounded-lg ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                      >
                        <div className="inline-flex items-center justify-center w-20 h-20 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-black/30 rounded-full mb-6">
                          <svg
                            className="w-10 h-10 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </div>
                        <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-3">
                          Connect to Begin
                        </h3>
                        <p className="editorial-body text-gray-600 dark:text-gray-400 mb-6">
                          Connect your wallet or sign in with email to start
                          protecting your documents
                        </p>
                        <button
                          onClick={handleLogout}
                          className={`inline-flex items-center gap-2 px-6 py-3 font-medium text-base rounded-lg transition-all duration-300 ease-out border ${
                            theme === "light"
                              ? "text-gray-900 border-gray-300 hover:border-[#e53e3e] hover:text-[#e53e3e] hover:bg-[rgba(229,62,62,0.05)]"
                              : "text-gray-100 border-gray-600 hover:border-[#e53e3e] hover:text-[#e53e3e] hover:bg-[rgba(229,62,62,0.1)]"
                          }`}
                        >
                          Log In
                        </button>
                      </div>
                    </div>
                  ) : (
                    // No Documents State
                    <NoDocumentsPlaceholder
                      theme={theme}
                      onCreateClick={() => {
                        setCurrentView("documents");
                        setShowCreateForm(true);
                        setCurrentStep(1);
                      }}
                      title="NO ACTIVE DOSSIERS"
                      description="Create your first encrypted document to get started"
                    />
                  )}
                </div>
              </div>
            ) : currentView === "settings" ? (
              // Settings View
              <SettingsView onBack={() => setCurrentView("checkin")} />
            ) : currentView === "monitor" ? (
              // Monitor View
              <MonitorView
                onBack={() => setCurrentView("checkin")}
                onViewDossiers={(address: Address) => {
                  // Navigate to dossiers view for the specified address
                  fetchUserDossiers(address);
                  setCurrentView("documents");
                  // Update URL to reflect the address
                  window.history.pushState({}, '', `/?user=${address}`);
                }}
              />
            ) : (
              // Documents View - Matching Public Releases Layout
              <div
                className={`flex-1 overflow-auto ${theme === "light" ? "bg-white" : "bg-black"}`}
              >
                <div className="max-w-7xl mx-auto px-6 py-8">
                  {documentDetailView && selectedDocument ? (
                    // Dossier Detail View
                    <div className="spacing-section">
                      {/* Navigation Header */}
                      <div className="mb-6">
                        <button
                          onClick={closeDocumentDetail}
                          className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                            theme === "light"
                              ? "text-gray-600 hover:text-gray-900"
                              : "text-gray-400 hover:text-gray-100"
                          }`}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                          Back to Dossiers
                        </button>
                      </div>

                      {/* Dossier Detail Content */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Information Panel */}
                        <div className="lg:col-span-2 space-y-6">
                          {/* Dossier Overview */}
                          <div
                            className={`border rounded-lg px-6 py-5 ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                          >
                            <div
                              className={`border-b pb-4 mb-4 ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 pr-4">
                                  <h1 className="editorial-header-large text-black dark:text-gray-100 mb-2">
                                    {selectedDocument.name.replace(
                                      "Encrypted file: ",
                                      "",
                                    )}
                                  </h1>
                                  <div className="flex items-center gap-4">
                                    <div
                                      className={`status-indicator text-xs ${(() => {
                                        if (
                                          selectedDocument.isPermanentlyDisabled ===
                                          true
                                        )
                                          return "status-expired";
                                        if (
                                          selectedDocument.isReleased === true
                                        )
                                          return "status-active";
                                        if (!selectedDocument.isActive)
                                          return "status-inactive";

                                        const lastCheckInMs =
                                          Number(selectedDocument.lastCheckIn) *
                                          1000;
                                        const intervalMs =
                                          Number(
                                            selectedDocument.checkInInterval,
                                          ) * 1000;
                                        const timeSinceLastCheckIn =
                                          currentTime.getTime() - lastCheckInMs;
                                        const remainingMs =
                                          intervalMs - timeSinceLastCheckIn;
                                        const isTimeExpired = remainingMs <= 0;

                                        return isTimeExpired
                                          ? "status-expired"
                                          : "status-active";
                                      })()}`}
                                    >
                                      <div className="status-dot"></div>
                                      <span>
                                        {(() => {
                                          if (
                                            selectedDocument.isPermanentlyDisabled ===
                                            true
                                          )
                                            return "Permanently Disabled";
                                          if (
                                            selectedDocument.isReleased === true
                                          )
                                            return "Released";
                                          if (!selectedDocument.isActive)
                                            return "Paused";

                                          const lastCheckInMs =
                                            Number(
                                              selectedDocument.lastCheckIn,
                                            ) * 1000;
                                          const intervalMs =
                                            Number(
                                              selectedDocument.checkInInterval,
                                            ) * 1000;
                                          const timeSinceLastCheckIn =
                                            currentTime.getTime() -
                                            lastCheckInMs;
                                          const remainingMs =
                                            intervalMs - timeSinceLastCheckIn;
                                          const isTimeExpired =
                                            remainingMs <= 0;

                                          return isTimeExpired
                                            ? "Expired"
                                            : "Active";
                                        })()}
                                      </span>
                                    </div>
                                    <div
                                      className={`text-xs font-medium ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                    >
                                      Dossier #{selectedDocument.id.toString()}
                                    </div>
                                    {/* Release Visibility Badge */}
                                    <div
                                      className={`inline-flex items-center gap-2 px-5 py-2.5 font-medium text-sm rounded-lg border transition-colors ${
                                        selectedDocument.recipients &&
                                        selectedDocument.recipients.length > 1
                                          ? theme === "light"
                                            ? "bg-black text-white border-black"
                                            : "bg-white text-gray-900 border-white"
                                          : theme === "light"
                                            ? "bg-white text-gray-700 border-gray-300"
                                            : "bg-black/20 text-gray-300 border-gray-600"
                                      }`}
                                    >
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        {selectedDocument.recipients &&
                                        selectedDocument.recipients.length >
                                          1 ? (
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                          />
                                        ) : (
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                          />
                                        )}
                                      </svg>
                                      {selectedDocument.recipients &&
                                      selectedDocument.recipients.length > 1
                                        ? "Private"
                                        : "Public"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Timing Information */}
                          <div
                            className={`border rounded-lg px-6 py-5 ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                          >
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="editorial-header text-gray-900 dark:text-gray-100">
                                Timing & Schedule
                              </h3>
                              {selectedDocument.isActive &&
                                selectedDocument.isReleased !== true && (
                                  <button
                                    onClick={() => {
                                      setNewCheckInInterval(
                                        String(
                                          Number(
                                            selectedDocument.checkInInterval,
                                          ) / 60,
                                        ),
                                      );
                                      setShowEditSchedule(true);
                                    }}
                                    className={`px-3 py-1 text-xs font-medium border rounded transition-all ${
                                      theme === "light"
                                        ? "border-gray-300 text-gray-700 hover:bg-gray-50"
                                        : "border-gray-600 text-gray-300 hover:bg-white/5"
                                    }`}
                                  >
                                    Edit Schedule
                                  </button>
                                )}
                            </div>
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <div
                                    className={`editorial-label-small ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                  >
                                    Check-in Interval
                                  </div>
                                  <div
                                    className={`text-lg font-semibold monospace-accent ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                                  >
                                    {(() => {
                                      const hours = Math.floor(
                                        Number(
                                          selectedDocument.checkInInterval,
                                        ) / 3600,
                                      );
                                      const minutes = Math.floor(
                                        (Number(
                                          selectedDocument.checkInInterval,
                                        ) %
                                          3600) /
                                          60,
                                      );
                                      if (hours > 0 && minutes > 0)
                                        return `${hours}h ${minutes}m`;
                                      if (hours > 0) return `${hours} hours`;
                                      return `${minutes} minutes`;
                                    })()}
                                  </div>
                                </div>
                                <div>
                                  <div
                                    className={`editorial-label-small ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                  >
                                    LAST CHECK-IN
                                  </div>
                                  <div
                                    className={`text-lg font-semibold monospace-accent ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                                  >
                                    {new Date(
                                      Number(selectedDocument.lastCheckIn) *
                                        1000,
                                    ).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* File Information */}
                          <div
                            className={`border rounded-lg px-6 py-5 ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                          >
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="editorial-header text-gray-900 dark:text-gray-100">
                                Encrypted Files
                              </h3>
                              {selectedDocument.isActive &&
                                selectedDocument.isReleased !== true && (
                                  <button
                                    onClick={() => setShowAddFiles(true)}
                                    className={`px-3 py-1 text-xs font-medium border rounded transition-all ${
                                      theme === "light"
                                        ? "border-gray-300 text-gray-700 hover:bg-gray-50"
                                        : "border-gray-600 text-gray-300 hover:bg-white/5"
                                    }`}
                                  >
                                    Add Files
                                  </button>
                                )}
                            </div>
                            <div className="space-y-3">
                              {selectedDocument.encryptedFileHashes.map(
                                (hash, index) => {
                                  // Extract CID from ipfs:// URL
                                  const cid = hash.startsWith("ipfs://")
                                    ? hash.replace("ipfs://", "")
                                    : hash;
                                  const ipldExplorerUrl = `https://explore.ipld.io/#/explore/${cid}`;

                                  return (
                                    <div
                                      key={index}
                                      className={`p-3 border rounded ${theme === "light" ? "border-gray-200 bg-gray-50" : "border-gray-600 bg-black/40"}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div
                                            className={`text-sm font-medium mb-1 ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                                          >
                                            {index === 0 ? (
                                              <span className="inline-flex items-center gap-1">
                                                📋 Manifest
                                                <span className={`text-xs font-normal ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}>
                                                  (Dossier Metadata)
                                                </span>
                                              </span>
                                            ) : (
                                              `File #${index}`
                                            )}
                                          </div>
                                          <a
                                            href={ipldExplorerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`text-xs monospace-accent break-all inline-flex items-center gap-1 hover:underline ${
                                              theme === "light"
                                                ? "text-blue-600 hover:text-blue-700"
                                                : "text-blue-400 hover:text-blue-300"
                                            }`}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {hash}
                                            <svg
                                              className="w-3 h-3 flex-shrink-0"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                              />
                                            </svg>
                                          </a>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(hash);
                                            toast.success(
                                              "Hash copied to clipboard",
                                            );
                                          }}
                                          className={`ml-2 p-1 rounded text-xs ${
                                            theme === "light"
                                              ? "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                                              : "text-gray-400 hover:text-gray-200 hover:bg-white/10"
                                          }`}
                                          title="Copy to clipboard"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Panel */}
                        <div className="space-y-6">
                          {/* Quick Actions */}
                          <div
                            className={`border rounded-lg px-6 py-5 ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                          >
                            <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-4">
                              Actions
                            </h3>
                            <div className="space-y-3">
                              {/* Released Message */}
                              {selectedDocument.isReleased === true && (
                                <div
                                  className={`p-3 border rounded-lg text-center ${
                                    theme === "light"
                                      ? "bg-green-50 border-green-300 text-green-700"
                                      : "bg-green-900/30 border-green-600 text-green-400"
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-2">
                                    <svg
                                      className="w-5 h-5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <span className="font-medium">
                                      DOCUMENT RELEASED
                                    </span>
                                  </div>
                                  <p className="text-sm mt-1 opacity-90">
                                    This document has been permanently released
                                    and cannot be modified
                                  </p>
                                </div>
                              )}
                              {/* Check In Button - Disabled if released */}
                              {selectedDocument.isActive &&
                                selectedDocument.isReleased !== true && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await handleCheckIn();
                                    }}
                                    disabled={
                                      isCheckingIn ||
                                      selectedDocument.isReleased === true
                                    }
                                    className={`w-full py-2 px-3 text-sm font-medium border rounded-lg transition-all ${theme === "light" ? "bg-gray-900 text-white hover:bg-gray-800 border-gray-900" : "bg-white text-gray-900 hover:bg-gray-100 border-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
                                  >
                                    {isCheckingIn
                                      ? "CHECKING IN..."
                                      : "CHECK IN"}
                                  </button>
                                )}

                              {/* Decrypt Button */}
                              {(() => {
                                const lastCheckInMs =
                                  Number(selectedDocument.lastCheckIn) * 1000;
                                const intervalMs =
                                  Number(selectedDocument.checkInInterval) *
                                  1000;
                                const timeSinceLastCheckIn =
                                  currentTime.getTime() - lastCheckInMs;
                                const remainingMs =
                                  intervalMs - timeSinceLastCheckIn;
                                const isTimeExpired = remainingMs <= 0;

                                // Check if dossier is decryptable
                                const isDecryptable = (isTimeExpired ||
                                  selectedDocument.isDecryptable ||
                                  selectedDocument.isReleased === true) &&
                                selectedDocument.encryptedFileHashes.length > 0;

                                // For private dossiers, check if current user is in recipients list
                                const isPrivate = selectedDocument.recipients && selectedDocument.recipients.length > 1;
                                let canAccessPrivate = true;
                                if (isPrivate) {
                                  const currentAddress = getCurrentAddress();
                                  if (currentAddress) {
                                    canAccessPrivate = selectedDocument.recipients?.some(
                                      (recipient) => recipient.toLowerCase() === currentAddress.toLowerCase()
                                    ) ?? false;
                                  } else {
                                    canAccessPrivate = false;
                                  }
                                }

                                const shouldShowButton = isDecryptable && canAccessPrivate;

                                return shouldShowButton ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Navigate to dedicated dossier view page
                                      const owner = viewingUserAddress || getCurrentAddress();
                                      if (owner) {
                                        router.push(`/release?user=${owner}&id=${selectedDocument.id.toString()}`);
                                      } else {
                                        toast.error('Unable to view dossier: No wallet address found');
                                      }
                                    }}
                                    className={`w-full py-2 px-3 text-sm font-medium border rounded-lg transition-all ${
                                      theme === "light"
                                        ? "bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                                        : "bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                                    }`}
                                  >
                                    <div className="flex items-center justify-center gap-2">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      <span>VIEW DOSSIER</span>
                                    </div>
                                  </button>
                                ) : null;
                              })()}


                              {/* Pause/Resume Button - Hidden if released or permanently disabled */}
                              {selectedDocument.isPermanentlyDisabled !==
                                true &&
                                selectedDocument.isReleased !== true && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const txHash = await pauseOrResumeDossier(
                                          selectedDocument.id,
                                          selectedDocument.isActive
                                        );

                                        await fetchUserDossiers();
                                        setActivityLog((prev) => [
                                          {
                                            type: `Dossier #${selectedDocument.id.toString()} ${selectedDocument.isActive ? "paused" : "resumed"}`,
                                            date: new Date().toLocaleString(),
                                            txHash: txHash,
                                          },
                                          ...prev,
                                        ]);
                                      } catch (error) {
                                        console.error(
                                          "Failed to toggle document status:",
                                          error,
                                        );
                                        toast.error(
                                          "Failed to update document status. Please try again.",
                                        );
                                      }
                                    }}
                                    className={`w-full py-2 px-3 text-sm font-medium border rounded-lg transition-all ${theme === "light" ? "bg-white text-gray-900 hover:bg-gray-50 border-gray-300" : "bg-transparent text-gray-100 hover:bg-white/10 border-gray-600"}`}
                                  >
                                    <div className="flex items-center justify-center gap-2">
                                      {selectedDocument.isActive ? (
                                        <svg
                                          className="w-4 h-4"
                                          fill="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <rect
                                            x="6"
                                            y="4"
                                            width="4"
                                            height="16"
                                          />
                                          <rect
                                            x="14"
                                            y="4"
                                            width="4"
                                            height="16"
                                          />
                                        </svg>
                                      ) : (
                                        <svg
                                          className="w-4 h-4"
                                          fill="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <polygon points="8,5 8,19 19,12" />
                                        </svg>
                                      )}
                                      <span>
                                        {selectedDocument.isActive
                                          ? "PAUSE CHECK-INS"
                                          : "RESUME CHECK-INS"}
                                      </span>
                                    </div>
                                  </button>
                                )}

                              {/* Release Now Button - Hidden if already released or permanently disabled */}
                              {selectedDocument.isPermanentlyDisabled !==
                                true &&
                                selectedDocument.isReleased !== true && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowReleaseConfirm(
                                        selectedDocument.id,
                                      );
                                    }}
                                    className={`w-full py-2 px-3 text-sm font-medium border rounded-lg transition-all ${
                                      theme === "light"
                                        ? "bg-green-50 text-green-700 hover:bg-green-100 border-green-300"
                                        : "bg-green-900/30 text-green-400 hover:bg-green-900/50 border-green-600"
                                    }`}
                                  >
                                    <div className="flex items-center justify-center gap-2">
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                                        />
                                      </svg>
                                      <span>RELEASE NOW</span>
                                    </div>
                                  </button>
                                )}

                              {/* Permanently Disable Button - Hidden if already disabled or released */}
                              {selectedDocument.isPermanentlyDisabled !==
                                true &&
                                selectedDocument.isReleased !== true && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowDisableConfirm(
                                        selectedDocument.id,
                                      );
                                    }}
                                    className={`w-full py-2 px-3 text-sm font-medium border rounded-lg transition-all ${
                                      theme === "light"
                                        ? "bg-red-50 text-red-700 hover:bg-red-100 border-red-300"
                                        : "bg-red-900/20 text-red-400 hover:bg-red-900/40 border-red-800"
                                    }`}
                                  >
                                    <div className="flex items-center justify-center gap-2">
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                      <span>PERMANENTLY DISABLE</span>
                                    </div>
                                  </button>
                                )}
                            </div>
                          </div>

                          {/* Recipients List */}
                          <div
                            className={`border rounded-lg px-6 py-5 ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                          >
                            <h3 className="editorial-header text-gray-900 dark:text-gray-100 mb-4">
                              Recipients
                            </h3>
                            <div className="space-y-2">
                              {selectedDocument.recipients.map(
                                (recipient, index) => (
                                  <div
                                    key={index}
                                    className={`p-3 border rounded ${theme === "light" ? "border-gray-200 bg-gray-50" : "border-gray-600 bg-black/40"}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div
                                          className={`text-xs ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                        >
                                          Recipient #{index + 1}
                                        </div>
                                        <div
                                          className={`text-sm monospace-accent ${theme === "light" ? "text-gray-900" : "text-gray-100"} break-all`}
                                        >
                                          {recipient}
                                        </div>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(
                                            recipient,
                                          );
                                          toast.success(
                                            "Address copied to clipboard",
                                          );
                                        }}
                                        className={`ml-2 p-1 rounded text-xs ${
                                          theme === "light"
                                            ? "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                                            : "text-gray-400 hover:text-gray-200 hover:bg-white/10"
                                        }`}
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : !showCreateForm ? (
                    <>
                      {/* Page Header - Like Public Releases */}
                      <div
                        className={`mb-12 border-b pb-8 ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}
                      >
                        <h1 className="editorial-header-large text-black dark:text-gray-100 mb-3">
                          DOSSIERS
                        </h1>
                        <p className="editorial-body dark:text-gray-400">
                          Create and manage encrypted dossiers with conditional
                          release triggers
                        </p>
                      </div>

                      {/* Documents Content */}
                      {canViewDossiers() && isLoadingDossiers ? (
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

                          {/* Dossier cards skeleton with shimmer */}
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className="relative min-h-[180px] border-2 border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden"
                              >
                                {/* Shimmer effect */}
                                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent"></div>

                                <div className="p-6">
                                  {/* Header skeleton */}
                                  <div className="border-b border-gray-200 dark:border-gray-600 pb-3 mb-4">
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
                      ) : (
                        canViewDossiers() && (
                          <div className="spacing-section">
                            <div className="spacing-medium">
                              {/* Viewing Other User Banner */}
                              {!isViewingOwnDossiers() && viewingUserAddress && (
                                <div className={`mb-6 p-4 rounded-lg border ${
                                  theme === 'light'
                                    ? 'bg-blue-50 border-blue-200'
                                    : 'bg-blue-900/10 border-blue-800'
                                }`}>
                                  <div className="flex items-center gap-3">
                                    <svg className={`w-5 h-5 flex-shrink-0 ${
                                      theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    <div className="flex-1">
                                      <p className={`text-sm font-medium ${
                                        theme === 'light' ? 'text-blue-900' : 'text-blue-100'
                                      }`}>
                                        Viewing dossiers for
                                      </p>
                                      <code className={`text-xs font-mono ${
                                        theme === 'light' ? 'text-blue-700' : 'text-blue-300'
                                      }`}>
                                        {viewingUserAddress}
                                      </code>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Filter Controls */}
                              <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-6">
                                  <span className="editorial-label text-gray-500 dark:text-gray-400">
                                    {
                                      userDossiers.filter(
                                        (d) =>
                                          showInactiveDocuments || d.isActive || !isViewingOwnDossiers(),
                                      ).length
                                    }{" "}
                                    DOSSIER
                                    {userDossiers.filter(
                                      (d) =>
                                        showInactiveDocuments || d.isActive || !isViewingOwnDossiers(),
                                    ).length !== 1
                                      ? "S"
                                      : ""}
                                  </span>
                                </div>

                                {/* Right side: Show All Button - Only show when viewing own dossiers */}
                                {isViewingOwnDossiers() &&
                                  userDossiers.length > 0 &&
                                  userDossiers.some((d) => !d.isActive) && (
                                    <button
                                      onClick={() =>
                                        setShowInactiveDocuments(
                                          !showInactiveDocuments,
                                        )
                                      }
                                      className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors ${
                                        showInactiveDocuments
                                          ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                                          : "bg-white dark:bg-black/20 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5"
                                      }`}
                                    >
                                      {showInactiveDocuments
                                        ? "Hide Inactive"
                                        : "Show All"}
                                    </button>
                                  )}
                              </div>

                              {userDossiers.length === 0 && isViewingOwnDossiers() && (
                                <NoDocumentsPlaceholder
                                  theme={theme}
                                  onCreateClick={() => setShowCreateForm(true)}
                                />
                              )}
                              {userDossiers.length === 0 && !isViewingOwnDossiers() && (
                                <div className="text-center py-12">
                                  <p className={`text-lg ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                                    This user has no dossiers yet.
                                  </p>
                                </div>
                              )}
                            </div>

                            {userDossiers.length > 0 && (
                              <div className="">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                  {/* Add New Dossier Card - Only shown when viewing own dossiers */}
                                  {isViewingOwnDossiers() && (
                                    <div
                                      onClick={() => setShowCreateForm(true)}
                                      className={`border rounded-lg px-6 py-5 min-h-[180px] flex flex-col cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 ${
                                        theme === "light"
                                          ? "border-gray-200 bg-white hover:bg-gray-50 hover:border-[#e53e3e]"
                                          : "border-gray-600 bg-black/40 hover:bg-[rgba(229,62,62,0.05)] hover:border-[#e53e3e]"
                                      }`}
                                    >
                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                      <div
                                        className={`mb-4 ${
                                          theme === "light"
                                            ? "text-gray-400"
                                            : "text-gray-500 hover:text-gray-300"
                                        }`}
                                      >
                                        <svg
                                          className="w-12 h-12"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M12 4v16m8-8H4"
                                          />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h3
                                          className={`editorial-header-small uppercase tracking-wider mb-2 ${
                                            theme === "light"
                                              ? "text-gray-900"
                                              : "text-gray-100 hover:text-white"
                                          }`}
                                        >
                                          CREATE DOSSIER
                                        </h3>
                                        <p
                                          className={`editorial-body-small break-words ${
                                            theme === "light"
                                              ? "text-gray-600"
                                              : "text-gray-400 hover:text-gray-200"
                                          }`}
                                        >
                                          Encrypt and protect a new dossier
                                        </p>
                                      </div>
                                    </div>
                                    </div>
                                  )}

                                  {/* Existing documents */}
                                  {userDossiers
                                    .filter(
                                      (dossier) =>
                                        showInactiveDocuments ||
                                        dossier.isActive ||
                                        !isViewingOwnDossiers(), // Show all dossiers when viewing others
                                    )
                                    .map((dossier, index) => {
                                      const lastCheckInMs =
                                        Number(dossier.lastCheckIn) * 1000;
                                      const intervalMs =
                                        Number(dossier.checkInInterval) * 1000;
                                      const timeSinceLastCheckIn =
                                        currentTime.getTime() - lastCheckInMs;
                                      const remainingMs =
                                        intervalMs - timeSinceLastCheckIn;
                                      const isExpired = remainingMs <= 0;

                                      // Calculate grace period stats
                                      const gracePeriodMs =
                                        contractConstants?.gracePeriod
                                          ? Number(
                                              contractConstants.gracePeriod,
                                            ) * 1000
                                          : 3600000; // Default 1 hour
                                      const totalTimeWithGrace =
                                        intervalMs + gracePeriodMs;
                                      const remainingWithGraceMs =
                                        totalTimeWithGrace -
                                        timeSinceLastCheckIn;
                                      const inGracePeriod =
                                        remainingMs <= 0 &&
                                        remainingWithGraceMs > 0;
                                      const fullyExpired =
                                        remainingWithGraceMs <= 0;

                                      let timeColor = "text-green-600";
                                      if (fullyExpired) {
                                        timeColor = "text-red-600";
                                      } else if (inGracePeriod) {
                                        timeColor = "text-orange-600";
                                      } else if (remainingMs < 5 * 60 * 1000) {
                                        timeColor = "text-red-600";
                                      } else if (remainingMs < 30 * 60 * 1000) {
                                        timeColor = "text-orange-500";
                                      } else if (
                                        remainingMs <
                                        2 * 60 * 60 * 1000
                                      ) {
                                        timeColor = "text-yellow-600";
                                      }

                                      let timeDisplay = "";
                                      let graceDisplay = "";

                                      if (
                                        dossier.isPermanentlyDisabled === true
                                      ) {
                                        timeDisplay = "Permanently Disabled";
                                        timeColor = "text-red-500";
                                      } else if (dossier.isReleased === true) {
                                        timeDisplay = "Released";
                                        timeColor = "text-green-500";
                                      } else if (!dossier.isActive) {
                                        timeDisplay = "Paused";
                                        timeColor = "text-yellow-500";
                                      } else if (fullyExpired) {
                                        timeDisplay = "⚠ FULLY EXPIRED";
                                        timeColor = "text-red-600";
                                      } else if (inGracePeriod) {
                                        timeDisplay = "⚠ IN GRACE PERIOD";
                                        // Calculate remaining grace time
                                        const graceRemainingMs =
                                          remainingWithGraceMs;
                                        const graceHours = Math.floor(
                                          graceRemainingMs / (1000 * 60 * 60),
                                        );
                                        const graceMinutes = Math.floor(
                                          (graceRemainingMs %
                                            (1000 * 60 * 60)) /
                                            (1000 * 60),
                                        );
                                        const graceSeconds = Math.floor(
                                          (graceRemainingMs % (1000 * 60)) /
                                            1000,
                                        );

                                        if (graceHours > 0) {
                                          graceDisplay = `${graceHours}H ${graceMinutes}M remaining`;
                                        } else if (graceMinutes > 0) {
                                          graceDisplay = `${graceMinutes}M ${graceSeconds}S remaining`;
                                        } else {
                                          graceDisplay = `${graceSeconds}S remaining`;
                                        }
                                      } else {
                                        const remainingHours = Math.floor(
                                          remainingMs / (1000 * 60 * 60),
                                        );
                                        const remainingMinutes = Math.floor(
                                          (remainingMs % (1000 * 60 * 60)) /
                                            (1000 * 60),
                                        );
                                        const remainingSeconds = Math.floor(
                                          (remainingMs % (1000 * 60)) / 1000,
                                        );

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
                                          onClick={() =>
                                            openDocumentDetail(dossier)
                                          }
                                          className={`border rounded-lg px-6 py-5 min-h-[180px] flex flex-col cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 ${theme === "light" ? "border-gray-200 bg-white hover:bg-gray-50 hover:border-[#e53e3e]" : "border-gray-600 bg-black/40 hover:bg-[rgba(229,62,62,0.05)] hover:border-[#e53e3e]"}`}
                                        >
                                          {/* Card Header */}
                                          <div
                                            className={`border-b pb-3 mb-4 ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}
                                          >
                                            <div className="flex justify-between items-start">
                                              <h3
                                                className="editorial-header text-primary flex-1 pr-4"
                                                title={dossier.name.replace(
                                                  "Encrypted file: ",
                                                  "",
                                                )}
                                              >
                                                {(() => {
                                                  const displayName =
                                                    dossier.name.replace(
                                                      "Encrypted file: ",
                                                      "",
                                                    );
                                                  return displayName.length > 28
                                                    ? `${displayName.substring(0, 28)}...`
                                                    : displayName;
                                                })()}
                                              </h3>

                                              <div
                                                className={`status-indicator flex-shrink-0 ${(() => {
                                                  if (!dossier.isActive)
                                                    return "status-inactive";

                                                  const lastCheckInMs =
                                                    Number(
                                                      dossier.lastCheckIn,
                                                    ) * 1000;
                                                  const intervalMs =
                                                    Number(
                                                      dossier.checkInInterval,
                                                    ) * 1000;
                                                  const timeSinceLastCheckIn =
                                                    currentTime.getTime() -
                                                    lastCheckInMs;
                                                  const remainingMs =
                                                    intervalMs -
                                                    timeSinceLastCheckIn;
                                                  const isTimeExpired =
                                                    remainingMs <= 0;

                                                  return isTimeExpired
                                                    ? "status-released"
                                                    : "status-active";
                                                })()}`}
                                              >
                                                <div className="status-dot"></div>
                                                <span>
                                                  {(() => {
                                                    if (!dossier.isActive)
                                                      return "Inactive";

                                                    const lastCheckInMs =
                                                      Number(
                                                        dossier.lastCheckIn,
                                                      ) * 1000;
                                                    const intervalMs =
                                                      Number(
                                                        dossier.checkInInterval,
                                                      ) * 1000;
                                                    const timeSinceLastCheckIn =
                                                      currentTime.getTime() -
                                                      lastCheckInMs;
                                                    const remainingMs =
                                                      intervalMs -
                                                      timeSinceLastCheckIn;
                                                    const isTimeExpired =
                                                      remainingMs <= 0;

                                                    return isTimeExpired
                                                      ? "Released"
                                                      : "Active";
                                                  })()}
                                                </span>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Card Body - Simplified */}
                                          <div className="flex-1 mb-4">
                                            {/* Release Visibility Indicator */}
                                            <div className="text-center mb-4">
                                              <div
                                                className={`inline-flex items-center gap-2 px-5 py-2.5 font-medium text-sm rounded-lg border transition-colors ${
                                                  dossier.recipients &&
                                                  dossier.recipients.length > 1
                                                    ? theme === "light"
                                                      ? "bg-black text-white border-black"
                                                      : "bg-white text-gray-900 border-white"
                                                    : theme === "light"
                                                      ? "bg-white text-gray-700 border-gray-300"
                                                      : "bg-black/20 text-gray-300 border-gray-600"
                                                }`}
                                              >
                                                <svg
                                                  className="w-4 h-4"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  {dossier.recipients &&
                                                  dossier.recipients.length >
                                                    1 ? (
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      strokeWidth={1.5}
                                                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                                    />
                                                  ) : (
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      strokeWidth={1.5}
                                                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                    />
                                                  )}
                                                </svg>
                                                {dossier.recipients &&
                                                dossier.recipients.length > 1
                                                  ? "Private"
                                                  : "Public"}
                                              </div>
                                            </div>

                                            {/* Time Display */}
                                            <div className="text-center">
                                              <div className="editorial-label-small text-secondary mb-2">
                                                Time Remaining
                                              </div>
                                              <div
                                                className={`${timeColor} monospace-accent text-xl font-bold`}
                                              >
                                                {timeDisplay}
                                              </div>
                                              {/* Grace Period Display - Simplified */}
                                              {graceDisplay && (
                                                <div className="mt-3 pt-2 border-t border-gray-300 dark:border-gray-600">
                                                  <div
                                                    className={`monospace-accent text-sm font-medium ${theme === "light" ? "text-orange-600" : "text-orange-400"}`}
                                                  >
                                                    Grace:{" "}
                                                    <span className="font-bold">
                                                      {graceDisplay}
                                                    </span>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Card Footer - Single Action Button */}
                                          <div className="border-t border-gray-300 dark:border-gray-600 pt-4 mt-auto">
                                            {(() => {
                                              // Check if document is expired/released
                                              const lastCheckInMs =
                                                Number(dossier.lastCheckIn) *
                                                1000;
                                              const intervalMs =
                                                Number(
                                                  dossier.checkInInterval,
                                                ) * 1000;
                                              const gracePeriodMs =
                                                Number(
                                                  contractConstants?.gracePeriod ||
                                                    BigInt(86400),
                                                ) * 1000; // 24 hours default
                                              const timeSinceLastCheckIn =
                                                currentTime.getTime() -
                                                lastCheckInMs;
                                              const graceRemainingMs =
                                                intervalMs +
                                                gracePeriodMs -
                                                timeSinceLastCheckIn;
                                              const fullyExpired =
                                                graceRemainingMs <= 0;

                                              // Show VIEW RELEASE for expired/released documents (but NOT permanently disabled)
                                              const isReleasedOrExpired =
                                                (dossier.isReleased === true ||
                                                (!dossier.isActive &&
                                                  fullyExpired)) &&
                                                dossier.isPermanentlyDisabled !== true;

                                              return (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedDocument(
                                                      dossier,
                                                    );
                                                    setDocumentDetailView(true);
                                                  }}
                                                  className={`w-full py-2.5 px-3 text-sm font-medium border rounded-lg transition-all uppercase tracking-wider ${
                                                    isReleasedOrExpired
                                                      ? theme === "light"
                                                        ? "bg-green-50 text-green-700 hover:bg-green-100 border-green-300"
                                                        : "bg-green-900/30 text-green-400 hover:bg-green-900/50 border-green-600"
                                                      : theme === "light"
                                                        ? "bg-white text-gray-900 hover:bg-gray-50 border-gray-300"
                                                        : "bg-transparent text-gray-100 hover:bg-white/10 border-gray-600"
                                                  }`}
                                                >
                                                  <div className="flex items-center justify-center gap-2">
                                                    {isReleasedOrExpired ? (
                                                      <>
                                                        <svg
                                                          className="w-4 h-4"
                                                          fill="none"
                                                          stroke="currentColor"
                                                          viewBox="0 0 24 24"
                                                        >
                                                          <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                          />
                                                          <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                          />
                                                        </svg>
                                                        <span>
                                                          VIEW RELEASE
                                                        </span>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <svg
                                                          className="w-4 h-4"
                                                          fill="none"
                                                          stroke="currentColor"
                                                          viewBox="0 0 24 24"
                                                        >
                                                          <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                                                          />
                                                        </svg>
                                                        <span>MORE</span>
                                                      </>
                                                    )}
                                                  </div>
                                                </button>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </>
                  ) : (
                    // Dossier Creation Flow - Editorial Layout
                    <div className="spacing-section">
                      <div className="flex justify-between items-center spacing-medium">
                        <button
                          onClick={() => {
                            setShowCreateForm(false);
                            // Reset form when going back
                            setCurrentStep(1);
                            setEncryptedCapsule(null);
                            setAllEncryptedFiles([]);
                            setDossierManifest(null);
                            setManifestStorageUrl(null);
                            setUploadedFile(null);
                            setProcessingStatus("");
                            setProcessingProgress(0);
                            setUploadedFiles([]);
                            setName("");
                            setDescription("");
                            setCheckInInterval("");
                            setCustomInterval("");
                            setEmergencyContacts([""]);
                            setReleaseMode("");
                          }}
                          className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 transition-colors text-sm font-semibold"
                          style={{
                            color: theme === "light" ? "#000000" : "#f3f4f6",
                          }}
                        >
                          ← Back to Dossiers
                        </button>
                        <h2 className="editorial-header text-2xl font-bold text-gray-900 dark:text-gray-100">
                          Dossier Creation
                        </h2>
                        <div className="w-32"></div>{" "}
                        {/* Spacer for center alignment */}
                      </div>

                      <div
                        className={`border rounded-lg ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black/40"}`}
                      >
                        {/* Compact Progress Header */}
                        <div
                          className={`px-6 py-4 border-b ${theme === "light" ? "border-gray-200" : "border-gray-700"}`}
                        >
                          <div className="flex items-center justify-between">
                            {/* Step indicators with labels */}
                            <div className="flex items-center gap-3">
                              {[1, 2, 3, 4, 5].map((step, index) => (
                                <React.Fragment key={step}>
                                  <div
                                    className={`flex items-center gap-2 cursor-pointer`}
                                    onClick={() => {
                                      // Allow free navigation between all steps
                                      if (!isProcessing && !dossierManifest) {
                                        setCurrentStep(step);
                                      }
                                    }}
                                  >
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                        step === currentStep
                                          ? theme === "light"
                                            ? "bg-black text-white"
                                            : "bg-white text-black border-2 border-white"
                                          : isStepCompleted(step)
                                            ? theme === "light"
                                              ? "bg-[#e53e3e] text-white hover:bg-[#d32e2e]"
                                              : "bg-[#e53e3e] text-white hover:bg-[#d32e2e]"
                                            : theme === "light"
                                              ? "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                      }`}
                                    >
                                      {isStepCompleted(step) ? "✓" : step}
                                    </div>
                                    <span
                                      className={`text-xs font-medium uppercase tracking-wider hidden sm:block select-none ${
                                        step === currentStep
                                          ? theme === "light"
                                            ? "text-gray-900"
                                            : "text-gray-100"
                                          : theme === "light"
                                            ? "text-gray-600 hover:text-gray-900"
                                            : "text-gray-400 hover:text-gray-100"
                                      }`}
                                    >
                                      {step === 1
                                        ? "NAME"
                                        : step === 2
                                          ? "VISIBILITY"
                                          : step === 3
                                            ? "SCHEDULE"
                                            : step === 4
                                              ? "ENCRYPT"
                                              : "FINALIZE"}
                                    </span>
                                  </div>
                                  {index < 4 && (
                                    <div
                                      className={`h-px w-8 ${
                                        theme === "light"
                                          ? "bg-gray-300"
                                          : "bg-gray-600"
                                      }`}
                                    />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Content Area */}
                        <div className="px-6 py-8">
                          {/* Step Content */}
                          <div
                            className={`${currentStep === 1 ? "max-w-4xl" : "max-w-6xl"} mx-auto`}
                          >
                            {/* Step 1: Dossier Details */}
                            {currentStep === 1 && (
                              <div className="space-y-6">
                                <div className="text-center">
                                  <h3
                                    className={`editorial-header text-2xl font-bold mb-2 ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                                  >
                                    Dossier Details
                                  </h3>
                                  <p
                                    className={`editorial-body text-sm ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                  >
                                    Step 1 of 5
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                  {/* Left Column - Form Fields Card */}
                                  <div
                                    className={`p-6 rounded-lg border ${
                                      theme === "light"
                                        ? "bg-white border-gray-200"
                                        : "bg-black/40 border-gray-700"
                                    }`}
                                  >
                                    <div className="space-y-6">
                                      <div>
                                        <label
                                          className={`block text-sm font-semibold mb-2 ${theme === "light" ? "text-gray-700" : "text-gray-300"}`}
                                        >
                                          Dossier Name{" "}
                                          <span className="text-red-500">
                                            *
                                          </span>
                                        </label>
                                        <div className="relative">
                                          <input
                                            type="text"
                                            placeholder="Name your dossier"
                                            className="w-full px-4 py-3 pr-20 border rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                                            style={{
                                              borderColor:
                                                theme === "light"
                                                  ? "#e5e7eb"
                                                  : "#4b5563",
                                              backgroundColor:
                                                theme === "light"
                                                  ? "#ffffff"
                                                  : "rgba(0,0,0,0.2)",
                                              color:
                                                theme === "light"
                                                  ? "#000000"
                                                  : "#f3f4f6",
                                            }}
                                            value={name}
                                            onChange={(e) =>
                                              setName(e.target.value)
                                            }
                                            autoFocus
                                          />
                                          <button
                                            onClick={() => {
                                              // Generate a random name - neutral codeword-friendly names
                                              const adjectives = [
                                                "Blue",
                                                "Red",
                                                "Green",
                                                "Silver",
                                                "Gold",
                                                "Alpha",
                                                "Beta",
                                                "Delta",
                                                "Echo",
                                                "Falcon",
                                                "Tiger",
                                                "Eagle",
                                                "Phoenix",
                                                "Storm",
                                                "Lightning",
                                                "Thunder",
                                                "Shadow",
                                                "Crystal",
                                                "Diamond",
                                                "Steel",
                                              ];
                                              const nouns = [
                                                "Dossier",
                                                "Package",
                                                "Bundle",
                                                "Archive",
                                                "Collection",
                                                "Set",
                                                "Group",
                                                "Batch",
                                                "Series",
                                                "Unit",
                                                "Assembly",
                                                "Kit",
                                              ];
                                              const randomAdj =
                                                adjectives[
                                                  Math.floor(
                                                    Math.random() *
                                                      adjectives.length,
                                                  )
                                                ];
                                              const randomNoun =
                                                nouns[
                                                  Math.floor(
                                                    Math.random() *
                                                      nouns.length,
                                                  )
                                                ];
                                              const randomNum = Math.floor(
                                                Math.random() * 9999,
                                              )
                                                .toString()
                                                .padStart(4, "0");
                                              setName(
                                                `${randomAdj} ${randomNoun} ${randomNum}`,
                                              );
                                            }}
                                            className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs rounded border transition-colors ${
                                              theme === "light"
                                                ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                                                : "border-gray-600 text-gray-400 hover:bg-white/5"
                                            }`}
                                            type="button"
                                            title="Generate a random name"
                                          >
                                            Random Name
                                          </button>
                                        </div>
                                        <p
                                          className={`text-xs mt-1 ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}
                                        >
                                          A unique title to identify this
                                          dossier
                                        </p>
                                      </div>

                                      <div>
                                        <label
                                          className={`block text-sm font-semibold mb-2 ${theme === "light" ? "text-gray-700" : "text-gray-300"}`}
                                        >
                                          Description{" "}
                                          <span className="text-gray-400">
                                            (Optional)
                                          </span>
                                        </label>
                                        <textarea
                                          placeholder="Add a description of what this dossier contains..."
                                          className="w-full px-4 py-3 border rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 resize-none"
                                          style={{
                                            borderColor:
                                              theme === "light"
                                                ? "#e5e7eb"
                                                : "#4b5563",
                                            backgroundColor:
                                              theme === "light"
                                                ? "#ffffff"
                                                : "rgba(0,0,0,0.2)",
                                            color:
                                              theme === "light"
                                                ? "#000000"
                                                : "#f3f4f6",
                                          }}
                                          value={description}
                                          onChange={(e) =>
                                            setDescription(e.target.value)
                                          }
                                          rows={4}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right Column - Explainer Card */}
                                  <div
                                    className={`p-6 rounded-lg border ${
                                      theme === "light"
                                        ? "bg-white border-gray-200"
                                        : "bg-black/40 border-gray-700"
                                    }`}
                                  >
                                    <h4
                                      className={`text-sm font-semibold mb-3 ${
                                        theme === "light"
                                          ? "text-gray-700"
                                          : "text-gray-300"
                                      }`}
                                    >
                                      About the Description Field
                                    </h4>
                                    <div
                                      className={`space-y-3 text-sm ${
                                        theme === "light"
                                          ? "text-gray-600"
                                          : "text-gray-400"
                                      }`}
                                    >
                                      <p>
                                        The description is{" "}
                                        <strong>public information</strong>{" "}
                                        stored on the blockchain. It is not
                                        encrypted and can be viewed by anyone.
                                      </p>
                                      <p>
                                        Use it to help you and others identify:
                                      </p>
                                      <ul className="space-y-1 ml-4">
                                        <li className="flex items-start">
                                          <span className="mr-2">•</span>
                                          <span>
                                            What this dossier contains
                                          </span>
                                        </li>
                                        <li className="flex items-start">
                                          <span className="mr-2">•</span>
                                          <span>Who it's from (optional)</span>
                                        </li>
                                        <li className="flex items-start">
                                          <span className="mr-2">•</span>
                                          <span>Any special instructions</span>
                                        </li>
                                        <li className="flex items-start">
                                          <span className="mr-2">•</span>
                                          <span>Context for recipients</span>
                                        </li>
                                      </ul>
                                      <p
                                        className={`pt-2 border-t ${
                                          theme === "light"
                                            ? "border-gray-200"
                                            : "border-gray-700"
                                        }`}
                                      >
                                        <strong>Important:</strong> Do not
                                        include sensitive information in the
                                        description. All sensitive data should
                                        be in the encrypted files only.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Step 2: Visibility */}
                            {currentStep === 2 && (
                              <div className="space-y-6">
                                <div className="text-center">
                                  <h3
                                    className={`editorial-header text-2xl font-bold mb-2 ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                                  >
                                    Visibility
                                  </h3>
                                  <p
                                    className={`editorial-body text-sm ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                  >
                                    Step 2 of 5
                                  </p>
                                </div>

                                <div className="text-center">
                                  <p
                                    className={`editorial-body mb-8 ${theme === "light" ? "text-gray-700" : "text-gray-300"}`}
                                  >
                                    Choose how your dossier will be released
                                    upon expiration
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                  {/* Public Release Option */}
                                  <div
                                    className={`border rounded-lg p-6 cursor-pointer transition-all ${
                                      releaseMode === "public"
                                        ? theme === "light"
                                          ? "border-black bg-gray-50"
                                          : "border-white bg-white/5"
                                        : theme === "light"
                                          ? "border-gray-300 hover:border-gray-400 bg-white"
                                          : "border-gray-600 hover:border-gray-500 bg-black/20"
                                    }`}
                                    onClick={() => setReleaseMode("public")}
                                  >
                                    <div className="space-y-5">
                                      <div className="flex items-center justify-between">
                                        <h4
                                          className={`editorial-header text-xl font-bold ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                                        >
                                          Public Release
                                        </h4>
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                            releaseMode === "public"
                                              ? theme === "light"
                                                ? "border-[#e53e3e] bg-[#e53e3e]"
                                                : "border-[#e53e3e] bg-[#e53e3e]"
                                              : theme === "light"
                                                ? "border-gray-400 bg-white"
                                                : "border-gray-500 bg-black/40"
                                          }`}
                                        >
                                          {releaseMode === "public" && (
                                            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          )}
                                        </div>
                                      </div>

                                      <div
                                        className={`space-y-4 ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                      >
                                        <p className="text-base leading-relaxed">
                                          Your document will be automatically
                                          decrypted and made publicly accessible
                                          if no check-in occurs by your selected
                                          deadline.
                                        </p>
                                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                          <p className="font-semibold mb-3 text-sm">
                                            Recommended when:
                                          </p>
                                          <ul className="space-y-2 text-sm">
                                            <li>
                                              • You intend for the document to become public
                                            </li>
                                            <li>
                                              • Broad visibility or long-term access is desired
                                            </li>
                                            <li>
                                              • Recipients are undefined or not individually selected
                                            </li>
                                            <li>
                                              • You want to ensure availability regardless of personal access
                                            </li>
                                          </ul>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Emergency Contacts Option */}
                                  <div
                                    className={`border rounded-lg p-6 cursor-pointer transition-all ${
                                      releaseMode === "contacts"
                                        ? theme === "light"
                                          ? "border-black bg-gray-50"
                                          : "border-white bg-white/5"
                                        : theme === "light"
                                          ? "border-gray-300 hover:border-gray-400 bg-white"
                                          : "border-gray-600 hover:border-gray-500 bg-black/20"
                                    }`}
                                    onClick={() => setReleaseMode("contacts")}
                                  >
                                    <div className="space-y-5">
                                      <div className="flex items-center justify-between">
                                        <h4
                                          className={`editorial-header text-xl font-bold ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                                        >
                                          Emergency Contacts
                                        </h4>
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                            releaseMode === "contacts"
                                              ? theme === "light"
                                                ? "border-[#e53e3e] bg-[#e53e3e]"
                                                : "border-[#e53e3e] bg-[#e53e3e]"
                                              : theme === "light"
                                                ? "border-gray-400 bg-white"
                                                : "border-gray-500 bg-black/40"
                                          }`}
                                        >
                                          {releaseMode === "contacts" && (
                                            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          )}
                                        </div>
                                      </div>

                                      <div
                                        className={`space-y-4 ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                      >
                                        <p className="text-base leading-relaxed">
                                          Your document will be privately sent
                                          to specific contacts if no check-in
                                          occurs by your selected deadline.
                                        </p>
                                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                          <p className="font-semibold mb-3 text-sm">
                                            Recommended when:
                                          </p>
                                          <ul className="space-y-2 text-sm">
                                            <li>
                                              • You want to share with selected individuals only
                                            </li>
                                            <li>
                                              • Privacy and discretion are priorities
                                            </li>
                                            <li>
                                              • You need direct delivery without public exposure
                                            </li>
                                            <li>• Recipients are trusted and known in advance</li>
                                          </ul>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Contact Input Fields */}
                                {releaseMode === "contacts" && (
                                  <div
                                    className={`mt-6 p-6 border rounded-lg ${
                                      theme === "light"
                                        ? "border-gray-300 bg-gray-50"
                                        : "border-gray-600 bg-black/40"
                                    }`}
                                  >
                                    <h5
                                      className={`font-semibold mb-3 ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                                    >
                                      Add Emergency Contacts
                                    </h5>
                                    <p
                                      className={`text-sm mb-4 ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                    >
                                      These addresses will receive access to
                                      decrypt your dossier upon release.
                                    </p>
                                    <div className="space-y-3">
                                      {emergencyContacts.map(
                                        (contact, index) => (
                                          <div
                                            key={index}
                                            className="flex gap-2"
                                          >
                                            <input
                                              type="text"
                                              placeholder="Ethereum address (0x...)"
                                              className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                                              style={{
                                                borderColor:
                                                  theme === "light"
                                                    ? "#e5e7eb"
                                                    : "#4b5563",
                                                backgroundColor:
                                                  theme === "light"
                                                    ? "#ffffff"
                                                    : "rgba(0,0,0,0.2)",
                                                color:
                                                  theme === "light"
                                                    ? "#000000"
                                                    : "#f3f4f6",
                                              }}
                                              value={contact}
                                              onChange={(e) => {
                                                const newContacts = [
                                                  ...emergencyContacts,
                                                ];
                                                newContacts[index] =
                                                  e.target.value;
                                                setEmergencyContacts(
                                                  newContacts,
                                                );
                                              }}
                                              onKeyDown={(e) => {
                                                if (
                                                  e.key === "Enter" &&
                                                  contact.trim()
                                                ) {
                                                  if (
                                                    index ===
                                                    emergencyContacts.length - 1
                                                  ) {
                                                    setEmergencyContacts([
                                                      ...emergencyContacts,
                                                      "",
                                                    ]);
                                                  }
                                                }
                                              }}
                                            />
                                            {emergencyContacts.length > 1 && (
                                              <button
                                                onClick={() => {
                                                  const newContacts =
                                                    emergencyContacts.filter(
                                                      (_, i) => i !== index,
                                                    );
                                                  setEmergencyContacts(
                                                    newContacts,
                                                  );
                                                }}
                                                className={`px-3 py-2 border rounded-lg text-sm transition-colors ${
                                                  theme === "light"
                                                    ? "border-red-300 text-red-600 hover:bg-red-50"
                                                    : "border-red-800 text-red-400 hover:bg-red-900/20"
                                                }`}
                                              >
                                                Remove
                                              </button>
                                            )}
                                          </div>
                                        ),
                                      )}
                                      <button
                                        onClick={() =>
                                          setEmergencyContacts([
                                            ...emergencyContacts,
                                            "",
                                          ])
                                        }
                                        className={`px-3 py-2 border rounded-lg text-sm transition-colors ${
                                          theme === "light"
                                            ? "border-gray-300 text-gray-700 hover:bg-gray-100"
                                            : "border-gray-600 text-gray-300 hover:bg-white/5"
                                        }`}
                                      >
                                        + Add another contact
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Step 3: Check-in Schedule */}
                            {currentStep === 3 && (
                              <div className="space-y-6">
                                <div className="text-center">
                                  <h3
                                    className={`editorial-header text-2xl font-bold mb-2 ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                                  >
                                    Check-in Schedule
                                  </h3>
                                  <p
                                    className={`editorial-body text-sm ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                  >
                                    Step 3 of 5
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                  {/* Left Column - Schedule Selection Card */}
                                  <div
                                    className={`p-6 rounded-lg border h-fit ${
                                      theme === "light"
                                        ? "bg-white border-gray-200"
                                        : "bg-black/40 border-gray-700"
                                    }`}
                                  >
                                    <h4
                                      className={`editorial-label-small uppercase tracking-wider mb-4 ${
                                        theme === "light"
                                          ? "text-black"
                                          : "text-gray-300"
                                      }`}
                                    >
                                      Quick Selection
                                    </h4>
                                    
                                    {/* Quick Time Buttons */}
                                    <div className="grid grid-cols-4 gap-2 mb-6">
                                      {[
                                        { value: "60", label: "1H", hours: 1 },
                                        { value: "1440", label: "24H", hours: 24 },
                                        { value: "43200", label: "30D", hours: 720 },
                                        { value: "525600", label: "1Y", hours: 8760 }
                                      ].map((option) => (
                                        <button
                                          key={option.value}
                                          onClick={() => {
                                            setCheckInInterval(option.value);
                                            setCustomInterval("");
                                          }}
                                          className={`py-3 px-2 rounded border font-semibold monospace-accent transition-all ${
                                            checkInInterval === option.value
                                              ? theme === "light"
                                                ? "bg-black text-white border-black"
                                                : "bg-white text-black border-white"
                                              : theme === "light"
                                                ? "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
                                                : "bg-black/40 text-gray-300 border-gray-600 hover:border-gray-400"
                                          }`}
                                        >
                                          {option.label}
                                        </button>
                                      ))}
                                    </div>
                                    
                                    {/* Custom Duration */}
                                    <div className="space-y-3">
                                      <label
                                        className={`block text-sm font-semibold ${
                                          theme === "light" ? "text-gray-700" : "text-gray-300"
                                        }`}
                                      >
                                        Custom Duration
                                      </label>
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="number"
                                          min="1"
                                          max="8760"
                                          placeholder="Enter hours"
                                          className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg text-center font-medium monospace-accent focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                                          style={{
                                            backgroundColor:
                                              theme === "light"
                                                ? "#ffffff"
                                                : "rgba(0,0,0,0.2)",
                                            color:
                                              theme === "light"
                                                ? "#000000"
                                                : "#f3f4f6",
                                          }}
                                          value={customInterval}
                                          onChange={(e) => {
                                            const hours = parseInt(e.target.value);
                                            if (!isNaN(hours) && hours >= 1 && hours <= 8760) {
                                              setCustomInterval(e.target.value);
                                              setCheckInInterval("custom");
                                            } else if (e.target.value === "") {
                                              setCustomInterval("");
                                            }
                                          }}
                                        />
                                        <span
                                          className={`text-sm font-medium ${
                                            theme === "light" ? "text-gray-700" : "text-gray-300"
                                          }`}
                                        >
                                          hours
                                        </span>
                                      </div>
                                      <p
                                        className={`text-xs ${
                                          theme === "light" ? "text-gray-500" : "text-gray-400"
                                        }`}
                                      >
                                        Min: 1 hour | Max: 1 year (8760 hours)
                                      </p>
                                    </div>

                                    {/* Live Preview */}
                                    <div className="mt-6">
                                      <h5
                                        className={`text-sm font-semibold mb-3 ${
                                          theme === "light" ? "text-gray-700" : "text-gray-300"
                                        }`}
                                      >
                                        Next Check-in Times
                                      </h5>
                                      <div className="space-y-2">
                                        {(() => {
                                          // Determine the interval hours from selected option
                                          let intervalHours: number | null = null;

                                          if (checkInInterval === "custom") {
                                            const parsed = parseInt(customInterval);
                                            if (!isNaN(parsed) && parsed > 0) {
                                              intervalHours = parsed;
                                            }
                                          } else if (checkInInterval) {
                                            const parsed = parseInt(checkInInterval);
                                            if (!isNaN(parsed) && parsed > 0) {
                                              // Quick selection values are stored in MINUTES, convert to hours
                                              intervalHours = parsed / 60;
                                            }
                                          }

                                          // If no valid interval selected, show placeholder
                                          if (intervalHours === null) {
                                            return (
                                              <div
                                                className={`py-8 text-center rounded border ${
                                                  theme === "light"
                                                    ? "bg-gray-50 border-gray-200"
                                                    : "bg-black/20 border-gray-700"
                                                }`}
                                              >
                                                <span className={`text-sm ${
                                                  theme === "light" ? "text-gray-500" : "text-gray-500"
                                                }`}>
                                                  Select an interval to see check-in schedule
                                                </span>
                                              </div>
                                            );
                                          }

                                          // Calculate and display next check-in times
                                          const now = new Date();
                                          return [1, 2, 3].map((multiplier) => {
                                            const nextDate = new Date(now.getTime() + (intervalHours! * multiplier * 60 * 60 * 1000));
                                            return (
                                              <div
                                                key={multiplier}
                                                className={`flex justify-between items-center py-2 px-3 rounded border ${
                                                  theme === "light"
                                                    ? "bg-gray-50 border-gray-200"
                                                    : "bg-black/20 border-gray-700"
                                                }`}
                                              >
                                                <span className={`text-xs ${
                                                  theme === "light" ? "text-gray-600" : "text-gray-400"
                                                }`}>
                                                  Check-in #{multiplier}
                                                </span>
                                                <span className={`text-sm monospace-accent font-medium ${
                                                  theme === "light" ? "text-gray-900" : "text-gray-100"
                                                }`}>
                                                  {nextDate.toLocaleDateString()} {nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </div>

                                    {/* Important Notice */}
                                    <div
                                      className={`mt-6 p-4 rounded-lg border ${
                                        theme === "light"
                                          ? "bg-amber-50 border-amber-200"
                                          : "bg-amber-900/10 border-amber-800"
                                      }`}
                                    >
                                      <p
                                        className={`text-sm monospace-accent ${theme === "light" ? "text-amber-800" : "text-amber-400"}`}
                                      >
                                        <span className="font-semibold uppercase tracking-wider">Important:</span> The dossier
                                        will be automatically released if you
                                        don't check in within this timeframe.
                                      </p>
                                    </div>
                                  </div>

                                  {/* Right Column - Explainer */}
                                  <div
                                    className={`p-6 rounded-lg border h-fit ${
                                      theme === "light"
                                        ? "bg-gray-50 border-gray-200"
                                        : "bg-white/5 border-gray-700"
                                    }`}
                                  >
                                    <h4
                                      className={`editorial-label-small uppercase tracking-wider mb-4 ${
                                        theme === "light"
                                          ? "text-gray-700"
                                          : "text-gray-300"
                                      }`}
                                    >
                                      Your Check-in Schedule
                                    </h4>
                                    <div
                                      className={`space-y-3 text-sm ${
                                        theme === "light"
                                          ? "text-gray-600"
                                          : "text-gray-400"
                                      }`}
                                    >
                                      <p>
                                        Set how often you need to check in.
                                        If you don't check in on schedule, your designated
                                        recipients will gain access to your dossier.
                                      </p>

                                      <div className="space-y-2">
                                        <p className="font-semibold">
                                          Choose your check-in frequency:
                                        </p>
                                        <ul className="space-y-2 ml-4">
                                          <li className="flex items-start">
                                            <span className="mr-2">•</span>
                                            <span>
                                              <strong>Daily:</strong> For time-sensitive
                                              situations where quick response is important
                                            </span>
                                          </li>
                                          <li className="flex items-start">
                                            <span className="mr-2">•</span>
                                            <span>
                                              <strong>Weekly:</strong> Balanced option
                                              for regular monitoring
                                            </span>
                                          </li>
                                          <li className="flex items-start">
                                            <span className="mr-2">•</span>
                                            <span>
                                              <strong>Monthly:</strong>{" "}
                                              For long-term storage with
                                              occasional check-ins
                                            </span>
                                          </li>
                                          <li className="flex items-start">
                                            <span className="mr-2">•</span>
                                            <span>
                                              <strong>Custom:</strong> Define your
                                              own schedule that fits your needs
                                            </span>
                                          </li>
                                        </ul>
                                      </div>

                                      <div
                                        className={`pt-3 mt-3 border-t ${
                                          theme === "light"
                                            ? "border-gray-200"
                                            : "border-gray-700"
                                        }`}
                                      >
                                        <p className="font-semibold mb-2">
                                          Grace Period:
                                        </p>
                                        <p>
                                          If you miss a scheduled check-in, you have
                                          an additional 48 hours to check in
                                          before your dossier becomes available to
                                          designated recipients.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Step 4: File Encryption */}
                            {currentStep === 4 && (
                              <div className="space-y-6">
                                <div className="text-center">
                                  <h3
                                    className={`editorial-header text-2xl font-bold mb-2 ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                                  >
                                    File Encryption
                                  </h3>
                                  <p
                                    className={`editorial-body text-sm ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                  >
                                    Step 4 of 5
                                  </p>
                                </div>
                                
                                {/* AUP Accept Terms Button */}
                                {!hasAcceptedAUP && (
                                  <div className={`editorial-card-bordered p-6 mb-6 ${
                                    theme === "light" 
                                      ? "bg-amber-50 border-amber-200" 
                                      : "bg-amber-900/10 border-amber-800"
                                  }`}>
                                    <div className="flex items-start gap-4">
                                      <AlertCircle className="w-5 h-5 text-amber-600 mt-1" />
                                      <div className="flex-1">
                                        <h4 className={`editorial-label mb-3 ${
                                          theme === "light" ? "text-gray-900" : "text-gray-100"
                                        }`}>
                                          Terms & Policies Required
                                        </h4>
                                        <p className={`editorial-body mb-4 ${
                                          theme === "light" ? "text-gray-700" : "text-gray-300"
                                        }`}>
                                          Before encrypting files, you must accept our Acceptable Use Policy and Terms of Service.
                                        </p>
                                        <button
                                          onClick={() => setShowAUPForEncrypt(true)}
                                          className={`px-5 py-2.5 font-medium text-sm rounded-lg border transition-colors w-fit ${
                                            theme === "light"
                                              ? "bg-black text-white border-black hover:bg-gray-800"
                                              : "bg-white text-gray-900 border-white hover:bg-gray-100"
                                          }`}
                                        >
                                          Accept Terms to Continue
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Left Column - Files List and Add Options */}
                                    <div
                                      className={`p-6 rounded-lg border h-fit ${
                                        theme === "light"
                                          ? "bg-white border-gray-200"
                                          : "bg-black/40 border-gray-700"
                                      }`}
                                    >
                                      <h4
                                        className={`editorial-label-small uppercase tracking-wider mb-4 ${
                                          theme === "light"
                                            ? "text-gray-700"
                                            : "text-gray-300"
                                        }`}
                                      >
                                        Files to Encrypt
                                      </h4>
                                      
                                      {/* Files List */}
                                      {uploadedFiles.length > 0 && (
                                        <div className="mb-4 space-y-2">
                                          {uploadedFiles.map((file, index) => (
                                            <div
                                              key={index}
                                              className={`flex items-center justify-between p-3 rounded border ${
                                                theme === "light"
                                                  ? "bg-gray-50 border-gray-200"
                                                  : "bg-black/20 border-gray-600"
                                              }`}
                                            >
                                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                                {file.type.startsWith("audio/") ? (
                                                  <Mic className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                ) : file.type.startsWith("video/") ? (
                                                  <Video className="w-4 h-4 text-red-600 flex-shrink-0" />
                                                ) : (
                                                  <Upload className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                                )}
                                                <span className={`text-sm truncate ${
                                                  theme === "light" ? "text-gray-900" : "text-gray-100"
                                                }`}>
                                                  {file.name}
                                                </span>
                                                <span className={`text-xs ${
                                                  theme === "light" ? "text-gray-500" : "text-gray-400"
                                                }`}>
                                                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                                </span>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                                                  if (uploadedFiles.length === 1) {
                                                    setUploadedFile(null);
                                                  }
                                                }}
                                                className={`ml-2 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors`}
                                              >
                                                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* Add Files Section */}
                                      <div className="space-y-3">
                                        {/* File Upload */}
                                        <div
                                          className={`border-2 border-dashed text-center py-6 px-4 rounded-lg cursor-pointer transition-all duration-200 group ${
                                            theme === "light"
                                              ? "bg-gray-50 border-gray-300 hover:border-gray-900 hover:bg-white"
                                              : "bg-black/20 border-gray-600 hover:border-gray-500 hover:bg-white/5"
                                          }`}
                                          onDragOver={handleDragOver}
                                          onDrop={(e) => {
                                            e.preventDefault();
                                            const files = Array.from(e.dataTransfer.files);
                                            setUploadedFiles(prev => [...prev, ...files]);
                                            if (files.length > 0 && !uploadedFile) {
                                              setUploadedFile(files[0]);
                                            }
                                          }}
                                          onClick={() => fileInputRef.current?.click()}
                                        >
                                          <Upload className="mx-auto mb-2 text-gray-400" size={24} />
                                          <p className={`text-sm font-medium ${
                                            theme === "light" ? "text-gray-700" : "text-gray-300"
                                          }`}>
                                            Click to browse or drag files here
                                          </p>
                                          <p className={`text-xs mt-1 ${
                                            theme === "light" ? "text-gray-500" : "text-gray-400"
                                          }`}>
                                            Multiple files allowed (up to 100MB each)
                                          </p>
                                          <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            onChange={(e) => {
                                              if (e.target.files) {
                                                const files = Array.from(e.target.files);
                                                setUploadedFiles(prev => [...prev, ...files]);
                                                if (files.length > 0 && !uploadedFile) {
                                                  setUploadedFile(files[0]);
                                                }
                                              }
                                            }}
                                            className="hidden"
                                          />
                                        </div>
                                        
                                        {/* OR Divider */}
                                        <div className="flex items-center gap-3">
                                          <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tracking-widest">
                                            OR
                                          </span>
                                          <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                                        </div>
                                        
                                        {/* Recording Options */}
                                        <div className="grid grid-cols-2 gap-3">
                                          <button
                                            onClick={() => {
                                              setMediaRecorderType('voice');
                                              setShowMediaRecorder(true);
                                            }}
                                            className={`p-4 border rounded-lg transition-all duration-200 hover:shadow-sm ${
                                              theme === "light"
                                                ? "bg-white border-gray-300 hover:border-gray-900"
                                                : "bg-black/40 border-gray-600 hover:border-gray-500"
                                            } flex flex-col items-center gap-2`}
                                          >
                                            <Mic className="w-6 h-6 text-blue-600" />
                                            <span className={`text-sm font-medium ${
                                              theme === "light" ? "text-gray-900" : "text-gray-100"
                                            }`}>
                                              Voice Recording
                                            </span>
                                          </button>
                                          
                                          <button
                                            onClick={() => {
                                              setMediaRecorderType('video');
                                              setShowMediaRecorder(true);
                                            }}
                                            className={`p-4 border rounded-lg transition-all duration-200 hover:shadow-sm ${
                                              theme === "light"
                                                ? "bg-white border-gray-300 hover:border-gray-900"
                                                : "bg-black/40 border-gray-600 hover:border-gray-500"
                                            } flex flex-col items-center gap-2`}
                                          >
                                            <Video className="w-6 h-6 text-red-600" />
                                            <span className={`text-sm font-medium ${
                                              theme === "light" ? "text-gray-900" : "text-gray-100"
                                            }`}>
                                              Video Recording
                                            </span>
                                          </button>
                                        </div>
                                      </div>
                                      
                                      {/* File Count Summary */}
                                      {uploadedFiles.length > 0 && (
                                        <div className={`mt-4 p-3 rounded-lg border ${
                                          theme === "light"
                                            ? "bg-green-50 border-green-200"
                                            : "bg-green-900/10 border-green-800"
                                        }`}>
                                          <p className={`text-sm font-medium ${
                                            theme === "light" ? "text-green-800" : "text-green-400"
                                          }`}>
                                            {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""} ready for encryption
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    {/* Right Column - Explainer */}
                                    <div
                                      className={`p-6 rounded-lg border h-fit ${
                                        theme === "light"
                                          ? "bg-gray-50 border-gray-200"
                                          : "bg-white/5 border-gray-700"
                                      }`}
                                    >
                                      <h4
                                        className={`editorial-label-small uppercase tracking-wider mb-4 ${
                                          theme === "light"
                                            ? "text-gray-700"
                                            : "text-gray-300"
                                        }`}
                                      >
                                        How It Works
                                      </h4>
                                      <div
                                        className={`space-y-3 text-sm ${
                                          theme === "light"
                                            ? "text-gray-600"
                                            : "text-gray-400"
                                        }`}
                                      >
                                        <p>
                                          Your files are encrypted directly in your browser
                                          before being uploaded. Only you control who can
                                          access your encrypted content and when.
                                        </p>

                                        <div className="space-y-2">
                                          <p className="font-semibold">
                                            What You Can Upload:
                                          </p>
                                          <ul className="space-y-2 ml-4">
                                            <li className="flex items-start">
                                              <span className="mr-2">•</span>
                                              <span>
                                                <strong>Files:</strong> Documents, 
                                                images, or any file up to 100MB
                                              </span>
                                            </li>
                                            <li className="flex items-start">
                                              <span className="mr-2">•</span>
                                              <span>
                                                <strong>Voice:</strong> Record
                                                audio messages directly in your
                                                browser
                                              </span>
                                            </li>
                                            <li className="flex items-start">
                                              <span className="mr-2">•</span>
                                              <span>
                                                <strong>Video:</strong> Record
                                                video content directly in your
                                                browser
                                              </span>
                                            </li>
                                          </ul>
                                        </div>

                                        <div
                                          className={`pt-3 mt-3 border-t ${
                                            theme === "light"
                                              ? "border-gray-200"
                                              : "border-gray-700"
                                          }`}
                                        >
                                          <p className="font-semibold mb-2">
                                            Your Privacy:
                                          </p>
                                          <p>
                                            All encryption happens locally on your device.
                                            Your files are never uploaded unencrypted, and
                                            only authorized recipients can access them
                                            according to the conditions you set.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                
                                {/* Media Recorder Modal */}
                                {showMediaRecorder && (
                                  <div className="fixed inset-0 z-50 flex items-center justify-center">
                                    {/* Backdrop */}
                                    <div
                                      className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                                      onClick={() => setShowMediaRecorder(false)}
                                    />

                                    {/* Modal Content */}
                                    <div className={`relative z-10 w-full max-w-2xl mx-6 p-6 rounded-2xl ${
                                      theme === 'light'
                                        ? 'bg-white border border-gray-300'
                                        : 'bg-gray-900 border border-gray-700'
                                    }`}>
                                      <MediaRecorder
                                        initialMode={mediaRecorderType === 'voice' ? 'audio' : 'video'}
                                        onFileReady={(file: File) => {
                                          setUploadedFiles(prev => [...prev, file]);
                                          if (!uploadedFile) {
                                            setUploadedFile(file);
                                          }
                                          setShowMediaRecorder(false);
                                        }}
                                        onCancel={() =>
                                          setShowMediaRecorder(false)
                                        }
                                        theme={theme}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Step 5: Finalize */}
                            {currentStep === 5 && (
                              <div className="space-y-6">
                                <div className="text-center">
                                  <h3
                                    className={`editorial-header text-2xl font-bold mb-2 ${theme === "light" ? "text-gray-900" : "text-gray-100"}`}
                                  >
                                    Finalize
                                  </h3>
                                  <p
                                    className={`editorial-body text-sm ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
                                  >
                                    Step 5 of 5
                                  </p>
                                </div>

                                {/* Cards Container */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                  {/* Left Column - Configuration Summary Card */}
                                  <div
                                    className={`p-6 rounded-lg border h-fit ${
                                      theme === "light"
                                        ? "bg-white border-gray-200"
                                        : "bg-black/40 border-gray-700"
                                    }`}
                                  >
                                    <h4
                                      className={`editorial-label-small uppercase tracking-wider mb-4 ${
                                        theme === "light"
                                          ? "text-gray-700"
                                          : "text-gray-300"
                                      }`}
                                    >
                                      Configuration Summary
                                    </h4>

                                    <div className="space-y-4">
                                      <div className="flex justify-between items-center">
                                        <span className="editorial-label-small text-black dark:text-gray-300">
                                          Dossier Name
                                        </span>
                                        <span className="editorial-header text-sm monospace-accent text-primary">
                                          {name || "Untitled"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="editorial-label-small text-black dark:text-gray-300">
                                          Release Visibility
                                        </span>
                                        <span className="editorial-body text-sm text-primary font-semibold">
                                          {releaseMode === "public"
                                            ? "Public Release"
                                            : "Emergency Contacts"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="editorial-label-small text-black dark:text-gray-300">
                                          Check-in Frequency
                                        </span>
                                        <span className="monospace-accent text-sm text-primary font-semibold">
                                          {checkInInterval === "custom"
                                            ? `${customInterval} hour${customInterval !== "1" ? "s" : ""}`
                                            : intervalOptions.find(
                                                (opt) =>
                                                  opt.value === checkInInterval,
                                              )?.label}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="editorial-label-small text-black dark:text-gray-300">
                                          Files
                                        </span>
                                        <span className="editorial-body text-sm text-primary font-semibold">
                                          {uploadedFiles.length > 0
                                            ? `${uploadedFiles.length} file${uploadedFiles.length !== 1 ? "s" : ""} ready`
                                            : uploadedFile?.name ||
                                              "No files selected"}
                                        </span>
                                      </div>
                                      {releaseMode === "contacts" && (
                                        <div className="pt-3 border-t border-gray-300 dark:border-gray-600">
                                          <div className="editorial-label-small spacing-tiny text-black dark:text-gray-300 mb-2">
                                            Emergency Contacts
                                          </div>
                                          {emergencyContacts
                                            .filter((c) => c.trim())
                                            .map((contact, index) => (
                                              <div
                                                key={index}
                                                className="editorial-body text-sm text-primary font-semibold monospace-accent"
                                              >
                                                • {contact}
                                              </div>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right Column - What Happens Next Card */}
                                  <div
                                    className={`p-6 rounded-lg border h-fit ${
                                      theme === "light"
                                        ? "bg-gray-50 border-gray-200"
                                        : "bg-white/5 border-gray-700"
                                    }`}
                                  >
                                    <h4
                                      className={`editorial-label-small uppercase tracking-wider mb-4 ${
                                        theme === "light"
                                          ? "text-gray-700"
                                          : "text-gray-300"
                                      }`}
                                    >
                                      What Happens Next
                                    </h4>
                                    <div
                                      className={`space-y-3 text-sm ${
                                        theme === "light"
                                          ? "text-gray-600"
                                          : "text-gray-400"
                                      }`}
                                    >
                                      <p>
                                        When you click "Finalize", the
                                        following actions will occur:
                                      </p>

                                      <ol className="space-y-2 ml-4">
                                        <li className="flex items-start">
                                          <span className="mr-2 font-semibold">
                                            1.
                                          </span>
                                          <span>
                                            <strong>Encryption:</strong> Your
                                            file will be encrypted locally in
                                            your browser using TACo protocol
                                          </span>
                                        </li>
                                        <li className="flex items-start">
                                          <span className="mr-2 font-semibold">
                                            2.
                                          </span>
                                          <span>
                                            <strong>Storage:</strong> The
                                            encrypted file will be uploaded to
                                            IPFS for decentralized storage
                                          </span>
                                        </li>
                                        <li className="flex items-start">
                                          <span className="mr-2 font-semibold">
                                            3.
                                          </span>
                                          <span>
                                            <strong>Smart Contract:</strong> A
                                            blockchain record will be created
                                            with your conditions
                                          </span>
                                        </li>
                                        <li className="flex items-start">
                                          <span className="mr-2 font-semibold">
                                            4.
                                          </span>
                                          <span>
                                            <strong>Activation:</strong> Your
                                            check-in timer will start
                                            immediately
                                          </span>
                                        </li>
                                      </ol>

                                      <div
                                        className={`pt-3 mt-3 border-t ${
                                          theme === "light"
                                            ? "border-gray-200"
                                            : "border-gray-700"
                                        }`}
                                      >
                                        <p className="font-semibold mb-2">
                                          Important Reminders:
                                        </p>
                                        <ul className="space-y-1 ml-4">
                                          <li className="flex items-start">
                                            <span className="mr-2">•</span>
                                            <span>
                                              Save your dossier link for easy
                                              access
                                            </span>
                                          </li>
                                          <li className="flex items-start">
                                            <span className="mr-2">•</span>
                                            <span>
                                              Set calendar reminders for
                                              check-ins
                                            </span>
                                          </li>
                                          <li className="flex items-start">
                                            <span className="mr-2">•</span>
                                            <span>
                                              Test the decryption process after
                                              creation
                                            </span>
                                          </li>
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                {isProcessing && processingProgress > 0 && (
                                  <div className={`mb-6 p-4 rounded-lg border ${
                                    theme === "light"
                                      ? "bg-gray-50 border-gray-200"
                                      : "bg-white/5 border-gray-700"
                                  }`}>
                                    <div className="mb-2 flex justify-between items-center">
                                      <span className={`text-sm font-medium ${
                                        theme === "light" ? "text-gray-700" : "text-gray-300"
                                      }`}>
                                        {processingStatus}
                                      </span>
                                      <span className={`text-sm ${
                                        theme === "light" ? "text-gray-500" : "text-gray-400"
                                      }`}>
                                        {processingProgress}%
                                      </span>
                                    </div>
                                    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5`}>
                                      <div 
                                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                        style={{ width: `${processingProgress}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                )}

                                {/* Encrypt Button Container */}
                                <div className="flex justify-center">
                                  {!encryptedCapsule && (
                                    <button
                                      onClick={processCanaryTriggerWithNetworkGuard}
                                      disabled={
                                        (uploadedFiles.length === 0 && !uploadedFile) ||
                                        isProcessing ||
                                        !name.trim()
                                      }
                                      className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-3 min-w-[280px] ${
                                        (uploadedFiles.length === 0 && !uploadedFile) || !name.trim()
                                          ? "opacity-50 cursor-not-allowed"
                                          : "hover:shadow-lg transform hover:-translate-y-0.5"
                                      } ${
                                        theme === "light"
                                          ? "bg-gray-900 text-white border border-gray-900 hover:bg-gray-800"
                                          : "bg-white text-gray-900 border border-white hover:bg-gray-100"
                                      } disabled:hover:transform-none disabled:hover:shadow-none`}
                                    >
                                      {isProcessing ? (
                                        <>
                                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                                          <span>{processingStatus || "Processing..."}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Shield size={20} />
                                          <span>Finalize</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Navigation */}
                          {currentStep < 5 && !dossierManifest && (
                            <div
                              className={`flex justify-between pt-6 mt-6 border-t ${theme === "light" ? "border-gray-200" : "border-gray-700"}`}
                            >
                              <button
                                onClick={() =>
                                  setCurrentStep(Math.max(1, currentStep - 1))
                                }
                                disabled={currentStep === 1}
                                className={`px-5 py-2.5 font-medium text-sm rounded-lg border transition-colors ${
                                  currentStep === 1
                                    ? "opacity-50 cursor-not-allowed"
                                    : theme === "light"
                                      ? "border-gray-300 text-gray-700 hover:bg-gray-50"
                                      : "border-gray-600 text-gray-300 hover:bg-white/5"
                                }`}
                              >
                                Previous
                              </button>
                              <button
                                onClick={() => {
                                  if (currentStep === 1 && !name.trim()) {
                                    toast.error("Please enter a document name");
                                    return;
                                  }
                                  if (currentStep === 4) {
                                    if (!hasAcceptedAUP) {
                                      toast.error("Please accept the Terms & Policies first");
                                      return;
                                    }
                                    if (uploadedFiles.length === 0 && !uploadedFile) {
                                      toast.error("Please add at least one file");
                                      return;
                                    }
                                  }
                                  // Validate step 2 - must select a visibility mode
                                  if (currentStep === 2 && !releaseMode) {
                                    toast.error(
                                      "Please select a release visibility option",
                                    );
                                    return;
                                  }
                                  if (
                                    currentStep === 2 &&
                                    releaseMode === "contacts" &&
                                    !emergencyContacts.some((c) => c.trim())
                                  ) {
                                    toast.error(
                                      "Please add at least one emergency contact",
                                    );
                                    return;
                                  }
                                  // Validate step 3 - must select a check-in interval
                                  if (currentStep === 3 && !checkInInterval) {
                                    toast.error(
                                      "Please select a check-in schedule",
                                    );
                                    return;
                                  }
                                  if (
                                    currentStep === 3 &&
                                    checkInInterval === "custom" &&
                                    !customInterval
                                  ) {
                                    toast.error(
                                      "Please enter a custom interval in hours",
                                    );
                                    return;
                                  }
                                  setCurrentStep(Math.min(5, currentStep + 1));
                                }}
                                className={`px-5 py-2.5 font-medium text-sm rounded-lg border transition-colors ${
                                  theme === "light"
                                    ? "bg-black text-white border-black hover:bg-gray-800"
                                    : "bg-white text-gray-900 border-white hover:bg-gray-100 hover:text-white"
                                }`}
                              >
                                {currentStep === 4 ? "Finalize" : "Next"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer
            className={`border-t flex-shrink-0 ${theme === "light" ? "border-gray-300 bg-white" : "border-gray-600 bg-black"}`}
          >
            <div className="max-w-7xl mx-auto px-6 py-4">
              {/* Main footer links */}
              <div className="flex items-center justify-center gap-6 mb-3">
                <a
                  href="https://canaryapp.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 text-xs transition-colors ${theme === "light" ? "text-gray-600 hover:text-gray-900" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Website</span>
                </a>

                <a
                  href="https://docs.canaryapp.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 text-xs transition-colors ${theme === "light" ? "text-gray-600 hover:text-gray-900" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Docs</span>
                </a>

                <a
                  href="https://github.com/TheThirdRoom/canary"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 text-xs transition-colors ${theme === "light" ? "text-gray-600 hover:text-gray-900" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <Github size={18} />
                  <span>Source</span>
                </a>

                <a
                  href="mailto:contact@canaryapp.io"
                  className={`flex items-center gap-1.5 text-xs transition-colors ${theme === "light" ? "text-gray-600 hover:text-gray-900" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Contact</span>
                </a>
              </div>

              {/* Legal links */}
              <div
                className={`text-center mt-2 pt-2 border-t ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <a
                    href="/acceptable-use-policy"
                    className={`text-xs transition-colors ${
                      theme === "light" ? "text-gray-500 hover:text-gray-700" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Acceptable Use
                  </a>
                  <span className={`text-xs ${theme === "light" ? "text-gray-400" : "text-gray-600"}`}>•</span>
                  <a
                    href="/terms-of-service"
                    className={`text-xs transition-colors ${
                      theme === "light" ? "text-gray-500 hover:text-gray-700" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Terms
                  </a>
                </div>
                <p
                  className={`text-xs ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}
                >
                  © 2025 Canary.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Permanently Disable Confirmation Popup */}
      {showDisableConfirm !== null && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] animate-fade-in"
            onClick={() => setShowDisableConfirm(null)}
          />

          {/* Popup */}
          <div className="fixed inset-0 flex items-center justify-center z-[10000] pointer-events-none">
            <div
              className={`pointer-events-auto max-w-md w-full mx-4 animate-slide-up editorial-card-bordered ${
                theme === "light"
                  ? "bg-white border-gray-300"
                  : "bg-black border-gray-600"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className={`flex items-center justify-between p-6 border-b ${
                  theme === "light" ? "border-gray-300" : "border-gray-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h2
                    className={`editorial-header-small uppercase tracking-wide ${
                      theme === "light" ? "text-gray-900" : "text-gray-100"
                    }`}
                  >
                    Confirm Permanent Disable
                  </h2>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p
                  className={`editorial-body mb-4 ${
                    theme === "light" ? "text-gray-700" : "text-gray-300"
                  }`}
                >
                  Are you sure you want to permanently disable this document?
                  The encrypted data will become inaccessible forever.
                </p>

                <div
                  className={`p-4 rounded border ${
                    theme === "light"
                      ? "bg-red-50 border-red-200"
                      : "bg-red-900/20 border-red-800"
                  }`}
                >
                  <p
                    className={`text-sm font-medium mb-2 ${
                      theme === "light" ? "text-red-900" : "text-red-400"
                    }`}
                  >
                    ⚠️ Warning: Data Will Stay Encrypted Forever
                  </p>
                  <ul
                    className={`text-sm space-y-1 ${
                      theme === "light" ? "text-red-700" : "text-red-500"
                    }`}
                  >
                    <li>• The data will remain encrypted permanently</li>
                    <li>• No one will be able to decrypt the data</li>
                    <li>• This cannot be reversed or released</li>
                    <li>• This action is recorded on the blockchain</li>
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div
                className={`p-6 border-t flex gap-3 ${
                  theme === "light" ? "border-gray-300" : "border-gray-600"
                }`}
              >
                <button
                  onClick={() => setShowDisableConfirm(null)}
                  className={`flex-1 py-3 px-6 font-medium text-base rounded-lg transition-all duration-300 ease-out border ${
                    theme === "light"
                      ? "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                      : "bg-black/40 text-white border-gray-600 hover:bg-white/5"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    let disableToast: any;
                    try {
                      // Find the dossier to disable
                      const dossierToDisable = userDossiers.find(
                        (d) => d.id === showDisableConfirm,
                      );
                      if (!dossierToDisable) {
                        toast.error("Dossier not found");
                        setShowDisableConfirm(null);
                        return;
                      }

                      disableToast = toast.loading(
                        "Disabling dossier...",
                      );

                      // Call the contract to permanently disable the dossier (irreversible)
                      const txHash = await disableDossier(
                          showDisableConfirm
                        );

                      toast.success("Dossier permanently disabled", {
                        id: disableToast,
                      });

                      // Reload dossiers to reflect the change
                      await fetchUserDossiers();

                      // Close the detail view if we're viewing the disabled document
                      if (selectedDocument?.id === showDisableConfirm) {
                        closeDocumentDetail();
                      }

                      // Add to activity log
                      setActivityLog((prev) => [
                        {
                          type: `🚫 Dossier #${showDisableConfirm.toString()} permanently disabled`,
                          date: new Date().toLocaleString(),
                          txHash: txHash,
                        },
                        ...prev,
                      ]);

                      setShowDisableConfirm(null);
                    } catch (error: any) {
                      console.error(
                        "❌ Failed to permanently disable dossier:",
                        error,
                      );
                      
                      // Dismiss loading toast if it exists
                      if (disableToast) {
                        toast.dismiss(disableToast);
                      }
                      
                      // Handle specific error cases
                      let errorMessage = "Failed to disable dossier";
                      
                      if (error.message?.includes("insufficient funds") || 
                          error.message?.includes("Wallet has insufficient funds")) {
                        // Check if using smart wallet (sponsored transactions)
                        if (smartWalletClient && authMode === "standard") {
                          errorMessage = "Transaction sponsorship temporarily unavailable. The paymaster may be out of funds. Please try again later or switch to an external wallet.";
                        } else {
                          errorMessage = "Insufficient MATIC balance to pay for transaction fees. Please add MATIC to your wallet on Polygon Amoy.";
                        }
                      } else if (error.message?.includes("user rejected") || 
                                 error.message?.includes("rejected by user")) {
                        errorMessage = "Transaction cancelled";
                      } else if (error.message?.includes("Network mismatch") ||
                                 error.message?.includes("Wrong network")) {
                        errorMessage = "Please switch to Polygon Amoy network in your wallet";
                      }
                      
                      toast.error(errorMessage);
                    }
                  }}
                  className={`flex-1 py-3 px-6 font-medium text-base rounded-lg transition-all duration-300 ease-out border ${
                    theme === "light"
                      ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
                      : "bg-red-600 text-white border-red-600 hover:bg-red-700"
                  }`}
                >
                  Permanently Disable
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Release Now Confirmation Popup */}
      {showReleaseConfirm !== null && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] animate-fade-in"
            onClick={() => setShowReleaseConfirm(null)}
          />

          {/* Popup */}
          <div className="fixed inset-0 flex items-center justify-center z-[10000] pointer-events-none">
            <div
              className={`pointer-events-auto max-w-md w-full mx-4 animate-slide-up editorial-card-bordered ${
                theme === "light"
                  ? "bg-white border-gray-300"
                  : "bg-black border-gray-600"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className={`flex items-center justify-between p-6 border-b ${
                  theme === "light" ? "border-gray-300" : "border-gray-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                    />
                  </svg>
                  <h2
                    className={`editorial-header-small uppercase tracking-wide ${
                      theme === "light" ? "text-gray-900" : "text-gray-100"
                    }`}
                  >
                    Confirm Release Now
                  </h2>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p
                  className={`text-sm mb-4 ${
                    theme === "light" ? "text-gray-700" : "text-gray-300"
                  }`}
                >
                  <strong className="text-red-600">Warning:</strong> This action
                  is permanent and cannot be undone. Once released, your
                  encrypted data will be immediately accessible to all
                  designated recipients.
                </p>

                <ul
                  className={`list-none space-y-2 text-sm ${
                    theme === "light" ? "text-green-700" : "text-green-500"
                  }`}
                >
                  <li>• The document data will be released immediately</li>
                  <li>• Recipients will be able to decrypt the data</li>
                  <li>• This action is recorded on the blockchain</li>
                  <li>• This cannot be reversed or stopped</li>
                </ul>
              </div>

              {/* Actions */}
              <div
                className={`flex gap-3 p-6 border-t ${
                  theme === "light" ? "border-gray-300" : "border-gray-600"
                }`}
              >
                <button
                  onClick={() => setShowReleaseConfirm(null)}
                  className={`flex-1 py-2.5 px-4 border rounded-lg transition-all font-medium ${
                    theme === "light"
                      ? "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                      : "bg-transparent text-gray-100 border-gray-600 hover:bg-white/10"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Find the dossier to release
                      const dossierToRelease = userDossiers.find(
                        (d) => d.id === showReleaseConfirm,
                      );
                      if (!dossierToRelease) {
                        toast.error("Dossier not found");
                        setShowReleaseConfirm(null);
                        return;
                      }

                      const releaseToast = toast.loading(
                        "Releasing dossier...",
                      );

                      // Call the contract to release the dossier data
                      const txHash = await releaseDossier(showReleaseConfirm);

                      toast.success("Dossier released", { id: releaseToast });

                      // Reload dossiers to reflect the change
                      await fetchUserDossiers();

                      // Close the detail view if we're viewing the released document
                      if (selectedDocument?.id === showReleaseConfirm) {
                        closeDocumentDetail();
                      }

                      // Add to activity log
                      setActivityLog((prev) => [
                        {
                          type: `🔓 Dossier #${showReleaseConfirm.toString()} data released`,
                          date: new Date().toLocaleString(),
                          txHash: txHash,
                        },
                        ...prev,
                      ]);

                      setShowReleaseConfirm(null);
                    } catch (error) {
                      console.error("Failed to release document:", error);
                      toast.error("Failed to release dossier");
                    }
                  }}
                  className={`flex-1 py-2.5 px-4 border rounded-lg transition-all font-medium ${
                    theme === "light"
                      ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                      : "bg-green-600 text-white border-green-600 hover:bg-green-700"
                  }`}
                >
                  Release Now
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Schedule Modal */}
      {showEditSchedule && selectedDocument && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] animate-fade-in"
            onClick={() => setShowEditSchedule(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[10000] pointer-events-none">
            <div
              className={`pointer-events-auto max-w-md w-full mx-4 animate-slide-up editorial-card-bordered ${
                theme === "light"
                  ? "bg-white border-gray-300"
                  : "bg-black border-gray-600"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className={`flex items-center justify-between p-6 border-b ${
                  theme === "light" ? "border-gray-300" : "border-gray-600"
                }`}
              >
                <h2
                  className={`editorial-header-small uppercase tracking-wide ${
                    theme === "light" ? "text-gray-900" : "text-gray-100"
                  }`}
                >
                  Edit Check-in Schedule
                </h2>
                <button
                  onClick={() => setShowEditSchedule(false)}
                  className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="mb-4">
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === "light" ? "text-gray-700" : "text-gray-300"
                    }`}
                  >
                    Check-in Interval (minutes)
                  </label>
                  <select
                    value={newCheckInInterval}
                    onChange={(e) => setNewCheckInInterval(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      theme === "light"
                        ? "border-gray-300 bg-white text-gray-900"
                        : "border-gray-600 bg-black text-gray-100"
                    }`}
                  >
                    {intervalOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {newCheckInInterval === "custom" && (
                    <input
                      type="number"
                      placeholder="Enter minutes"
                      className={`mt-2 w-full px-3 py-2 border rounded-lg ${
                        theme === "light"
                          ? "border-gray-300 bg-white text-gray-900"
                          : "border-gray-600 bg-black text-gray-100"
                      }`}
                      onChange={(e) => setCustomInterval(e.target.value)}
                      value={customInterval}
                    />
                  )}
                </div>

                <p
                  className={`text-sm mb-4 ${
                    theme === "light" ? "text-gray-600" : "text-gray-400"
                  }`}
                >
                  Note: Changing the check-in interval will update the schedule
                  for future check-ins. This action will be recorded on the
                  blockchain.
                </p>
              </div>

              {/* Footer */}
              <div
                className={`flex gap-3 p-6 border-t ${
                  theme === "light" ? "border-gray-300" : "border-gray-600"
                }`}
              >
                <button
                  onClick={() => setShowEditSchedule(false)}
                  className={`flex-1 py-2.5 px-4 border rounded-lg transition-all ${
                    theme === "light"
                      ? "border-gray-300 text-gray-700 hover:bg-gray-50"
                      : "border-gray-600 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const intervalInMinutes =
                        newCheckInInterval === "custom"
                          ? parseInt(customInterval)
                          : parseInt(newCheckInInterval);

                      if (!intervalInMinutes || intervalInMinutes <= 0) {
                        toast.error("Please enter a valid interval");
                        return;
                      }

                      const intervalInSeconds = intervalInMinutes * 60;

                      // Update check-in interval using V2 contract
                      try {
                        // Check if this is a V1 dossier (created before V2 deployment)
                        // V1 dossiers cannot be updated with the new features
                        // For now, show a helpful message
                        toast.error(
                          "Legacy dossier. Create new dossiers for enhanced features.",
                        );

                        // Close the modal
                        setShowEditSchedule(false);

                        // TODO: In the future, we could:
                        // 1. Detect V1 vs V2 dossiers
                        // 2. Create a migration system
                        // 3. Or recreate the dossier in V2
                      } catch (updateError) {
                        console.error(
                          "Failed to update schedule:",
                          updateError,
                        );
                        toast.error(
                          "Failed to update schedule. This feature requires dossiers created with the V2 contract.",
                        );
                      }
                    } catch (error) {
                      console.error("Failed to update schedule:", error);
                      toast.error("Failed to update schedule");
                    }
                  }}
                  className={`flex-1 py-2.5 px-4 border rounded-lg transition-all font-medium ${
                    theme === "light"
                      ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-800"
                      : "bg-white text-gray-900 border-white hover:bg-gray-100"
                  }`}
                >
                  Update Schedule
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Files Modal */}
      {showAddFiles && selectedDocument && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] animate-fade-in"
            onClick={() => {
              setShowAddFiles(false);
              setAdditionalFiles([]);
            }}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[10000] pointer-events-none">
            <div
              className={`pointer-events-auto max-w-md w-full mx-4 animate-slide-up editorial-card-bordered ${
                theme === "light"
                  ? "bg-white border-gray-300"
                  : "bg-black border-gray-600"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className={`flex items-center justify-between p-6 border-b ${
                  theme === "light" ? "border-gray-300" : "border-gray-600"
                }`}
              >
                <h2
                  className={`editorial-header-small uppercase tracking-wide ${
                    theme === "light" ? "text-gray-900" : "text-gray-100"
                  }`}
                >
                  Add Files to Dossier
                </h2>
                <button
                  onClick={() => {
                    setShowAddFiles(false);
                    setAdditionalFiles([]);
                  }}
                  className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="mb-4">
                  <input
                    ref={additionalFilesInputRef}
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setAdditionalFiles(Array.from(e.target.files));
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    onClick={() => additionalFilesInputRef.current?.click()}
                    className={`w-full py-3 px-4 border-2 border-dashed rounded-lg transition-all ${
                      theme === "light"
                        ? "border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                        : "border-gray-600 text-gray-400 hover:border-gray-500 hover:bg-gray-900"
                    }`}
                  >
                    <Upload className="w-5 h-5 mx-auto mb-2" />
                    <div>Click to select files</div>
                    <div className="text-xs mt-1 opacity-70">
                      Multiple files allowed
                    </div>
                  </button>
                </div>

                {/* Selected Files List */}
                {additionalFiles.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <div
                      className={`text-sm font-medium ${
                        theme === "light" ? "text-gray-700" : "text-gray-300"
                      }`}
                    >
                      Selected Files:
                    </div>
                    {additionalFiles.map((file, index) => (
                      <div
                        key={index}
                        className={`p-2 border rounded flex items-center justify-between ${
                          theme === "light"
                            ? "border-gray-200 bg-gray-50"
                            : "border-gray-700 bg-gray-900"
                        }`}
                      >
                        <span className="text-sm truncate">{file.name}</span>
                        <button
                          onClick={() => {
                            setAdditionalFiles((prev) =>
                              prev.filter((_, i) => i !== index),
                            );
                          }}
                          className={`ml-2 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600`}
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p
                  className={`text-sm ${
                    theme === "light" ? "text-gray-600" : "text-gray-400"
                  }`}
                >
                  Files will be encrypted with the same conditions as the
                  original dossier and added to the encrypted files list.
                </p>
              </div>

              {/* Footer */}
              <div
                className={`flex gap-3 p-6 border-t ${
                  theme === "light" ? "border-gray-300" : "border-gray-600"
                }`}
              >
                <button
                  onClick={() => {
                    setShowAddFiles(false);
                    setAdditionalFiles([]);
                  }}
                  className={`flex-1 py-2.5 px-4 border rounded-lg transition-all ${
                    theme === "light"
                      ? "border-gray-300 text-gray-700 hover:bg-gray-50"
                      : "border-gray-600 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (additionalFiles.length === 0) {
                      toast.error("Please select files to add");
                      return;
                    }

                    try {
                      setIsProcessing(true);

                      // Process each file
                      for (const file of additionalFiles) {
                        // Encrypt the file with the same dossier conditions
                        const encryptionResult = await encryptFileWithDossier(
                          file,
                          selectedDocument.id,
                          getCurrentAddress()!,
                          selectedDocument.name || file.name,
                          selectedDocument.description || "",
                        );

                        // Commit to storage
                        const { commitResult } =
                          await commitEncryptedFileToPinata(
                            encryptionResult,
                            selectedDocument.id,
                          );

                        // Note: Adding files to existing dossiers requires V2 contract
                        // V1 dossiers cannot have files added after creation
                        const fileHash = `ipfs://${commitResult.IpfsHash}`;

                        try {
                          await ContractService.addFileHash(
                            selectedDocument.id,
                            fileHash,
                          );
                          toast.success(`Added ${file.name} to dossier`);
                        } catch (contractError) {
                          console.warn(
                            "V2 contract method failed, this is likely a V1 dossier",
                          );
                          toast.error(
                            "Legacy dossier. File encrypted but not linked to contract.",
                          );
                        }
                      }

                      // Refresh dossier data
                      await fetchUserDossiers();
                      setShowAddFiles(false);
                      setAdditionalFiles([]);
                    } catch (error) {
                      console.error("Failed to add files:", error);
                      toast.error("Failed to add files to dossier");
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  disabled={additionalFiles.length === 0 || isProcessing}
                  className={`flex-1 py-2.5 px-4 border rounded-lg transition-all font-medium ${
                    theme === "light"
                      ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-800 disabled:bg-gray-300"
                      : "bg-white text-gray-900 border-white hover:bg-gray-100 disabled:bg-gray-600"
                  } disabled:cursor-not-allowed`}
                >
                  {isProcessing ? "Adding Files..." : "Add Files"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* AUP Modal - Only shown when triggered from encryption step */}
      <AcceptableUsePolicy 
        theme={theme}
        shouldCheck={showAUPForEncrypt}
        skipDemoStep={true}
        onAccepted={() => {
          console.log('AUP accepted from encryption step');
          setHasAcceptedAUP(true);
          setShowAUPForEncrypt(false);
        }}
        onSignatureCheck={(isSigned) => {
          setHasAcceptedAUP(isSigned);
          if (isSigned) {
            setShowAUPForEncrypt(false);
          }
        }}
        onDismissed={() => {
          // User dismissed the modal, reset the trigger state
          setShowAUPForEncrypt(false);
        }}
      />
    </div>
  );
};

export default Home;
