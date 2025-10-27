'use client';

import { useState, useEffect } from 'react';
import { Shield, Bell, Database, Key, ChevronLeft, AlertTriangle, Wallet, ExternalLink, LogOut, Activity, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../lib/theme-context';
import { clearDemoDisclaimerPreference } from './DemoDisclaimer';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useDisconnect } from 'wagmi';
import { useBurnerWallet } from '../lib/burner-wallet-context';
import { useHeartbeat } from '../lib/heartbeat-context';
import { NETWORK_CONFIG, CANARY_DOSSIER_ADDRESS } from '../lib/network-config';
import { ContractService } from '../lib/contract';
import BurnConfirmationModal from './BurnConfirmationModal';
import toast from 'react-hot-toast';

interface PrivateKeyExportProps {
  burnerWallet: any;
  theme: string;
}

function PrivateKeyExport({ burnerWallet, theme }: PrivateKeyExportProps) {
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRevealKey = () => {
    if (!showPrivateKey) {
      const key = burnerWallet.exportPrivateKey();
      if (key) {
        setPrivateKey(key);
        setShowPrivateKey(true);
      } else {
        toast.error('Failed to export private key');
      }
    } else {
      setShowPrivateKey(false);
      setPrivateKey(null);
    }
  };

  const handleCopyKey = () => {
    if (privateKey) {
      navigator.clipboard.writeText(privateKey);
      setCopied(true);
      toast.success('Private key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      {!showPrivateKey ? (
        <button
          onClick={handleRevealKey}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            theme === 'light'
              ? 'bg-gray-900 text-white hover:bg-black'
              : 'bg-white text-black hover:bg-gray-100'
          }`}
        >
          <Eye className="w-4 h-4" />
          Reveal Private Key
        </button>
      ) : (
        <>
          <div className={`p-3 rounded-lg font-mono text-xs break-all ${
            theme === 'light'
              ? 'bg-gray-100 border border-gray-300'
              : 'bg-gray-900 border border-gray-700'
          }`}>
            {privateKey}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyKey}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                theme === 'light'
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Key
                </>
              )}
            </button>
            <button
              onClick={handleRevealKey}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                theme === 'light'
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hide Key
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface SettingsViewProps {
  onBack: () => void;
}

export default function SettingsView({ onBack }: SettingsViewProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'wallet' | 'storage' | 'privacy' | 'heartbeat' | 'advanced'>('wallet');

  // Wallet hooks
  const { authenticated, user, wallets, logout } = usePrivy();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const burnerWallet = useBurnerWallet();
  const heartbeat = useHeartbeat();

  // Local state for code phrase copy
  const [codePhrasecopied, setCodePhraseCopied] = useState(false);

  // State for burn confirmation modal
  const [showBurnConfirmModal, setShowBurnConfirmModal] = useState(false);
  const [hasActiveDossiers, setHasActiveDossiers] = useState(false);

  // Helper to get current address (prioritize burner wallet)
  const getCurrentAddress = () => {
    return burnerWallet.address || address || (wallets && wallets.length > 0 ? wallets[0]?.address : null);
  };
  
  // Settings state
  const [debugMode, setDebugMode] = useState(false);
  const [storagePreference, setStoragePreference] = useState<'pinata' | 'ipfs' | 'codex'>('pinata');
  
  // Load settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDebugMode = localStorage.getItem('canary-debug-mode');
      const savedStorage = localStorage.getItem('canary-storage-preference');
      
      if (savedDebugMode !== null) setDebugMode(savedDebugMode === 'true');
      if (savedStorage) setStoragePreference(savedStorage as 'pinata' | 'ipfs' | 'codex');
    }
  }, []);
  
  // Save settings to localStorage
  const saveSetting = (key: string, value: string | boolean) => {
    localStorage.setItem(key, value.toString());
  };
  
  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all local data? This action cannot be undone.')) {
      // Clear specific Canary data, but preserve theme
      const themeToPreserve = localStorage.getItem('theme');
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('canary') && !key.includes('theme')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
      if (themeToPreserve) localStorage.setItem('theme', themeToPreserve);
      
      alert('Local data cleared successfully');
    }
  };

  return (
    <div className={`flex-1 overflow-auto ${theme === "light" ? "bg-white" : "bg-black"}`}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className={`mb-8 border-b pb-6 ${theme === "light" ? "border-gray-300" : "border-gray-600"}`}>
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onBack}
              className={`p-2 rounded-full transition-colors ${
                theme === 'light' 
                  ? 'hover:bg-gray-100 text-gray-600' 
                  : 'hover:bg-white/10 text-gray-400'
              }`}
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="editorial-header-large text-gray-900 dark:text-gray-100">
              SETTINGS
            </h1>
          </div>
          <p className="editorial-body text-gray-600 dark:text-gray-400">
            Configure your preferences and manage your account
          </p>
        </div>

        {/* Settings Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('wallet')}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'wallet'
                    ? theme === 'light' 
                      ? 'bg-gray-100 text-gray-900 font-medium' 
                      : 'bg-white/10 text-white font-medium'
                    : theme === 'light'
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                <Wallet className="w-4 h-4" />
                Wallet
              </button>
              <button
                onClick={() => setActiveTab('storage')}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'storage'
                    ? theme === 'light' 
                      ? 'bg-gray-100 text-gray-900 font-medium' 
                      : 'bg-white/10 text-white font-medium'
                    : theme === 'light'
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                <Database className="w-4 h-4" />
                Storage
              </button>
              <button
                onClick={() => setActiveTab('privacy')}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'privacy'
                    ? theme === 'light'
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'bg-white/10 text-white font-medium'
                    : theme === 'light'
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                <Shield className="w-4 h-4" />
                Privacy & Security
              </button>
              <button
                onClick={() => setActiveTab('heartbeat')}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'heartbeat'
                    ? theme === 'light'
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'bg-white/10 text-white font-medium'
                    : theme === 'light'
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                <Activity className="w-4 h-4" />
                Heartbeat
                {heartbeat.isEnabled && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'advanced'
                    ? theme === 'light'
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'bg-white/10 text-white font-medium'
                    : theme === 'light'
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                <Key className="w-4 h-4" />
                Advanced
              </button>
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <div className={`p-6 rounded-lg border ${
              theme === 'light' 
                ? 'bg-white border-gray-200' 
                : 'bg-black border-gray-700'
            }`}>
              {activeTab === 'wallet' && (
                <div className="space-y-8">
                  <div>
                    <h2 className={`text-lg font-medium mb-6 flex items-center gap-2 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      <Wallet className="w-5 h-5" />
                      Wallet Connection
                    </h2>
                    
                    {/* Connection Status */}
                    <div className={`p-4 rounded-lg border mb-6 ${
                      (isConnected || authenticated || burnerWallet.isConnected)
                        ? theme === 'light'
                          ? 'bg-white border-gray-300'
                          : 'bg-black/40 border-gray-600'
                        : theme === 'light'
                          ? 'bg-white border-gray-300'
                          : 'bg-black/40 border-gray-600'
                    }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-3 h-3 rounded-full ${
                          (isConnected || authenticated || burnerWallet.isConnected)
                            ? 'bg-green-500 animate-pulse'
                            : 'bg-gray-400'
                        }`} />
                        <span className={`font-medium ${
                          theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                        }`}>
                          {(isConnected || authenticated || burnerWallet.isConnected) ? 'Connected' : 'Not Connected'}
                        </span>
                      </div>

                      {/* Wallet Details */}
                      {(isConnected || authenticated || burnerWallet.isConnected) && (
                        <div className="space-y-3">
                          {/* Address */}
                          <div>
                            <span className={`text-sm font-medium block mb-1 ${
                              theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                            }`}>
                              Wallet Address
                            </span>
                            <div className="flex items-center gap-2">
                              <code className={`text-sm font-mono px-2 py-1 rounded ${
                                theme === 'light'
                                  ? 'bg-gray-50 text-gray-900'
                                  : 'bg-white/5 text-gray-100'
                              }`}>
                                {getCurrentAddress() || 'Unknown'}
                              </code>
                              <button
                                onClick={() => {
                                  const addr = getCurrentAddress();
                                  if (addr) {
                                    navigator.clipboard.writeText(addr);
                                  }
                                }}
                                className={`p-1 rounded transition-colors ${
                                  theme === 'light'
                                    ? 'hover:bg-gray-100 text-gray-600'
                                    : 'hover:bg-white/10 text-gray-400'
                                }`}
                                title="Copy address"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Wallet Type */}
                          <div>
                            <span className={`text-sm font-medium block mb-1 ${
                              theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                            }`}>
                              Wallet Type
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${
                                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                              }`}>
                                {burnerWallet.isConnected ? (
                                  'Anonymous Account'
                                ) : isConnected && !authenticated ? (
                                  'External Web3 Wallet'
                                ) : authenticated && wallets && wallets.length > 0 ? (
                                  wallets[0]?.walletClientType === 'privy' ?
                                    'Privy Embedded Wallet' :
                                    `${wallets[0]?.walletClientType || 'Unknown'} Wallet`
                                ) : (
                                  'Unknown'
                                )}
                              </span>
                              {authenticated && wallets && wallets.length > 0 && wallets[0]?.walletClientType === 'privy' && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  theme === 'light'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-blue-900/20 text-blue-400'
                                }`}>
                                  Managed
                                </span>
                              )}
                            </div>
                          </div>

                          {/* User Email (if Privy) */}
                          {authenticated && user?.email?.address && (
                            <div>
                              <span className={`text-sm font-medium block mb-1 ${
                                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                              }`}>
                                Associated Email
                              </span>
                              <span className={`text-sm ${
                                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                              }`}>
                                {user.email.address}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Anonymous Account Private Key Export */}
                    {burnerWallet.isConnected && (
                      <div className={`p-4 rounded-lg border mb-6 ${
                        theme === 'light'
                          ? 'bg-white border-gray-300'
                          : 'bg-black/40 border-gray-600'
                      }`}>
                        <h3 className={`font-medium mb-3 flex items-center gap-2 ${
                          theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                        }`}>
                          <Key className="w-4 h-4" />
                          Backup Private Key
                        </h3>
                        <p className={`text-sm mb-4 ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Your anonymous account is stored locally in this browser. Export your private key to:
                        </p>
                        <ul className={`text-sm mb-4 space-y-1 ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          <li>• Back it up securely</li>
                          <li>• Restore it on another device</li>
                          <li>• Import it into a wallet app</li>
                        </ul>

                        <div className={`p-3 rounded-lg border mb-4 ${
                          theme === 'light'
                            ? 'bg-white border-[#e53e3e]'
                            : 'bg-black/40 border-[#e53e3e]'
                        }`}>
                          <p className={`text-sm flex items-start gap-2 ${
                            theme === 'light' ? 'text-[#e53e3e]' : 'text-[#e53e3e]'
                          }`}>
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>
                              <strong>Warning:</strong> Never share your private key. Anyone with access to it can control your account and funds.
                            </span>
                          </p>
                        </div>

                        <PrivateKeyExport
                          burnerWallet={burnerWallet}
                          theme={theme}
                        />
                      </div>
                    )}

                    {/* Burn Anonymous Account */}
                    {burnerWallet.isConnected && (
                      <div className={`p-4 rounded-lg border mb-6 ${
                        theme === 'light'
                          ? 'bg-red-50 border-red-300'
                          : 'bg-red-900/10 border-red-800'
                      }`}>
                        <h3 className={`font-medium mb-3 flex items-center gap-2 ${
                          theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                        }`}>
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          Burn Anonymous Account
                        </h3>
                        <p className={`text-sm mb-4 ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          Remove your anonymous account from this browser. This action:
                        </p>
                        <ul className={`text-sm mb-4 space-y-1 ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          <li>• <strong>Cannot be undone</strong></li>
                          <li>• Deletes the private key from browser storage</li>
                          <li>• Without the private key backup, you lose access forever</li>
                          <li>• Any funds or assets become inaccessible without the key</li>
                        </ul>

                        <div className={`p-3 rounded-lg border mb-4 ${
                          theme === 'light'
                            ? 'bg-white border-red-400'
                            : 'bg-black/40 border-red-400'
                        }`}>
                          <p className={`text-sm flex items-start gap-2 text-red-500`}>
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>
                              <strong>Final Warning:</strong> Use "Backup Private Key" above to save your key before burning. This is your only way to recover the account!
                            </span>
                          </p>
                        </div>

                        <button
                          onClick={async () => {
                            // Check for active dossiers before showing the modal
                            try {
                              if (burnerWallet.address) {
                                const dossierIds = await ContractService.getUserDossierIds(burnerWallet.address);
                                let activeCount = 0;

                                // Check each dossier to see if it's active
                                for (const dossierId of dossierIds) {
                                  try {
                                    const dossier = await ContractService.getDossier(burnerWallet.address, dossierId);
                                    if (dossier.isActive && !dossier.isPermanentlyDisabled && !dossier.isReleased) {
                                      activeCount++;
                                    }
                                  } catch (err) {
                                    console.error(`Failed to check dossier ${dossierId}:`, err);
                                  }
                                }

                                setHasActiveDossiers(activeCount > 0);

                                if (activeCount > 0) {
                                  toast.error(`⚠️ Warning: You have ${activeCount} active dossier${activeCount > 1 ? 's' : ''} that will be released!`, {
                                    duration: 5000
                                  });
                                }
                              }
                            } catch (error) {
                              console.error('Failed to check dossiers:', error);
                              // Still show the modal even if check fails
                            }

                            setShowBurnConfirmModal(true);
                          }}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            theme === 'light'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Burn Anonymous Account
                        </button>
                      </div>
                    )}

                    {/* Disconnect Button */}
                    {(isConnected || authenticated || burnerWallet.isConnected) && (
                      <div className={`p-4 rounded-lg border ${
                        theme === 'light'
                          ? 'bg-white border-gray-300'
                          : 'bg-black/40 border-gray-600'
                      }`}>
                        <h3 className={`font-medium mb-2 ${
                          theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                        }`}>
                          Disconnect Wallet
                        </h3>
                        <p className={`text-sm mb-4 ${
                          theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          This will disconnect your wallet and you'll need to reconnect to access your dossiers.
                          {burnerWallet.isConnected && (
                            <span className="block mt-2 text-green-600 dark:text-green-400 font-medium">
                              ✓ Your anonymous account will remain saved and can be restored later.
                            </span>
                          )}
                        </p>
                        <button
                          onClick={() => {
                            if (burnerWallet.isConnected) {
                              burnerWallet.disconnect();
                            }
                            if (isConnected) {
                              disconnect();
                            }
                            if (authenticated) {
                              logout();
                            }
                          }}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            theme === 'light'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          <LogOut className="w-4 h-4" />
                          Disconnect Wallet
                        </button>
                      </div>
                    )}

                    {/* Connection Instructions */}
                    {!(isConnected || authenticated) && (
                      <div className={`p-4 rounded-lg border ${
                        theme === 'light' 
                          ? 'bg-white border-gray-300' 
                          : 'bg-black/40 border-gray-600'
                      }`}>
                        <p className={`text-sm ${
                          theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                        }`}>
                          Connect your wallet from the main page to access dossier features and manage your encrypted files.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Network Information */}
                  <div>
                    <h3 className={`text-lg font-medium mb-4 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      Network Information
                    </h3>
                    
                    <div className={`p-4 rounded-lg border space-y-3 ${
                      theme === 'light' 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-white/5 border-gray-700'
                    }`}>
                      <div className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">Network:</span> {NETWORK_CONFIG.name}
                      </div>
                      <div className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">Chain ID:</span> {NETWORK_CONFIG.chainId}
                      </div>
                      <div className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">RPC:</span> {NETWORK_CONFIG.rpcUrls.default}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'storage' && (
                <div className="space-y-8">
                  <div>
                    <h3 className={`text-lg font-medium mb-4 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      Storage Preference
                    </h3>
                    
                    <select
                      value={storagePreference}
                      onChange={(e) => {
                        const value = e.target.value as 'pinata' | 'ipfs' | 'codex';
                        setStoragePreference(value);
                        saveSetting('canary-storage-preference', value);
                      }}
                      className={`w-full max-w-xs px-3 py-2 rounded border ${
                        theme === 'light'
                          ? 'bg-white border-gray-300 text-gray-900'
                          : 'bg-black border-gray-600 text-white'
                      }`}
                    >
                      <option value="pinata">Pinata (Recommended)</option>
                      <option value="ipfs">IPFS</option>
                      <option value="codex">Codex (Experimental)</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="space-y-8">
                  <div>
                    <h2 className={`text-lg font-medium mb-6 flex items-center gap-2 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      <Shield className="w-5 h-5" />
                      Privacy & Security
                    </h2>
                    
                    <div className={`p-4 rounded-lg ${
                      theme === 'light' 
                        ? 'bg-gray-50 border border-gray-200' 
                        : 'bg-white/5 border border-gray-700'
                    }`}>
                      <p className={`text-sm mb-4 font-medium ${
                        theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                      }`}>
                        Your data privacy is important to us:
                      </p>
                      <ul className={`text-sm space-y-3 ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>All encryption happens locally in your browser</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>Private keys never leave your device</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-lg font-medium mb-4 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      Local Data Management
                    </h3>
                    
                    <div className={`p-4 rounded-lg border ${
                      theme === 'light' 
                        ? 'bg-yellow-50 border-yellow-200' 
                        : 'bg-yellow-900/10 border-yellow-800'
                    }`}>
                      <p className={`text-sm mb-4 ${
                        theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                      }`}>
                        Clear all locally stored preferences and cached data. This will not affect your encrypted documents.
                      </p>
                      <button
                        onClick={handleClearData}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          theme === 'light'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                      >
                        Clear Local Data
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {activeTab === 'heartbeat' && (
                <div className="space-y-8">
                  <div>
                    <h2 className={`text-lg font-medium mb-6 flex items-center gap-2 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      <Activity className="w-5 h-5" />
                      Heartbeat Monitor
                    </h2>

                    {!(isConnected || authenticated || burnerWallet.isConnected) ? (
                      <div className={`p-4 rounded-lg border ${
                        theme === 'light'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-yellow-900/10 border-yellow-800'
                      }`}>
                        <p className={`text-sm ${
                          theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                        }`}>
                          Connect your wallet to enable heartbeat monitoring.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Heartbeat Status */}
                        <div className={`p-4 rounded-lg border mb-6 ${
                          heartbeat.isEnabled
                            ? theme === 'light'
                              ? 'bg-green-50 border-green-200'
                              : 'bg-green-900/10 border-green-800'
                            : theme === 'light'
                              ? 'bg-white border-gray-300'
                              : 'bg-black/40 border-gray-600'
                        }`}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-3 h-3 rounded-full ${
                              heartbeat.isEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                            }`} />
                            <span className={`font-medium ${
                              theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                            }`}>
                              {heartbeat.isEnabled ? 'Heartbeat Active' : 'Heartbeat Inactive'}
                            </span>
                          </div>

                          {heartbeat.isEnabled && (
                            <p className={`text-sm ${
                              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              Broadcasting heartbeat pings every 5 minutes. Others can monitor your status using your code phrase.
                            </p>
                          )}
                        </div>

                        {/* Toggle Heartbeat */}
                        <div className={`p-4 rounded-lg border mb-6 ${
                          theme === 'light'
                            ? 'bg-white border-gray-300'
                            : 'bg-black/40 border-gray-600'
                        }`}>
                          <h3 className={`font-medium mb-2 ${
                            theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                          }`}>
                            {heartbeat.isEnabled ? 'Stop Heartbeat' : 'Start Heartbeat'}
                          </h3>
                          <p className={`text-sm mb-4 ${
                            theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            {heartbeat.isEnabled
                              ? 'Stop broadcasting heartbeat pings. Your subscribers will be notified if no signal is received.'
                              : 'Start broadcasting periodic heartbeat pings. Share your code phrase with trusted contacts so they can monitor your status.'}
                          </p>
                          <button
                            onClick={async () => {
                              const currentAddr = getCurrentAddress();
                              if (heartbeat.isEnabled) {
                                heartbeat.stopHeartbeat();
                                toast.success('Heartbeat stopped');
                              } else if (currentAddr) {
                                try {
                                  await heartbeat.startHeartbeat(currentAddr);
                                  toast.success('Heartbeat started! Share your code phrase with trusted contacts.');
                                } catch (error) {
                                  toast.error('Failed to start heartbeat');
                                }
                              }
                            }}
                            disabled={heartbeat.isInitializing}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              heartbeat.isEnabled
                                ? theme === 'light'
                                  ? 'bg-red-600 text-white hover:bg-red-700'
                                  : 'bg-red-600 text-white hover:bg-red-700'
                                : theme === 'light'
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {heartbeat.isInitializing ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Initializing...
                              </>
                            ) : heartbeat.isEnabled ? (
                              <>
                                <Activity className="w-4 h-4" />
                                Stop Heartbeat
                              </>
                            ) : (
                              <>
                                <Activity className="w-4 h-4" />
                                Start Heartbeat
                              </>
                            )}
                          </button>
                        </div>

                        {/* Code Phrase Sharing */}
                        {heartbeat.isEnabled && heartbeat.codePhrase && (
                          <div className={`p-4 rounded-lg border ${
                            theme === 'light'
                              ? 'bg-blue-50 border-blue-200'
                              : 'bg-blue-900/10 border-blue-800'
                          }`}>
                            <h3 className={`font-medium mb-2 ${
                              theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                            }`}>
                              Your Code Phrase
                            </h3>
                            <p className={`text-sm mb-4 ${
                              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              Share this code phrase with trusted contacts so they can subscribe to your heartbeat. Keep it private!
                            </p>
                            <div className="flex items-center gap-2">
                              <code className={`flex-1 text-lg font-mono font-bold px-4 py-2 rounded ${
                                theme === 'light'
                                  ? 'bg-white text-gray-900 border border-gray-300'
                                  : 'bg-black text-gray-100 border border-gray-600'
                              }`}>
                                {heartbeat.codePhrase}
                              </code>
                              <button
                                onClick={() => {
                                  if (heartbeat.codePhrase) {
                                    navigator.clipboard.writeText(heartbeat.codePhrase);
                                    setCodePhraseCopied(true);
                                    toast.success('Code phrase copied!');
                                    setTimeout(() => setCodePhraseCopied(false), 2000);
                                  }
                                }}
                                className={`p-2 rounded transition-colors ${
                                  theme === 'light'
                                    ? 'hover:bg-blue-100 text-blue-600'
                                    : 'hover:bg-blue-900/20 text-blue-400'
                                }`}
                                title="Copy code phrase"
                              >
                                {codePhrasecopied ? (
                                  <Check className="w-5 h-5" />
                                ) : (
                                  <Copy className="w-5 h-5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* How It Works */}
                        {!heartbeat.isEnabled && (
                          <div className={`p-4 rounded-lg border ${
                            theme === 'light'
                              ? 'bg-gray-50 border-gray-200'
                              : 'bg-white/5 border-gray-700'
                          }`}>
                            <h3 className={`font-medium mb-2 ${
                              theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                            }`}>
                              How Heartbeat Works
                            </h3>
                            <ul className={`text-sm space-y-2 ${
                              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">•</span>
                                <span>Your device broadcasts encrypted "heartbeat" pings every 5 minutes via Waku network</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">•</span>
                                <span>You get a unique code phrase generated from your wallet address</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">•</span>
                                <span>Trusted contacts can subscribe using your code phrase to monitor your status</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">•</span>
                                <span>If no heartbeat is received for 15 minutes, subscribers are alerted</span>
                              </li>
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'advanced' && (
                <div className="space-y-8">
                  <div>
                    <h2 className={`text-lg font-medium mb-6 flex items-center gap-2 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      <Key className="w-5 h-5" />
                      Developer Options
                    </h2>
                    
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div>
                          <label className={`text-sm font-medium block ${
                            theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                          }`}>
                            Debug Mode
                          </label>
                          <p className={`text-sm mt-1 ${
                            theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            Show additional logging in browser console
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={debugMode}
                        onChange={(e) => {
                          setDebugMode(e.target.checked);
                          saveSetting('canary-debug-mode', e.target.checked);
                        }}
                        className="mt-1 rounded"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-lg font-medium mb-4 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      Network Information
                    </h3>
                    
                    <div className={`p-4 rounded-lg border space-y-3 ${
                      theme === 'light' 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-white/5 border-gray-700'
                    }`}>
                      <div className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">Network:</span> {NETWORK_CONFIG.name}
                      </div>
                      <div className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">Chain ID:</span> {NETWORK_CONFIG.chainId}
                      </div>
                      <div className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">Contract Version:</span> DossierV2
                      </div>
                      <div className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        <span className="font-medium">Contract Address:</span>
                        <span className="font-mono text-xs ml-2">{CANARY_DOSSIER_ADDRESS.slice(0, 6)}...{CANARY_DOSSIER_ADDRESS.slice(-4)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-lg font-medium mb-4 ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}>
                      About Canary
                    </h3>
                    
                    <div className={`space-y-2 ${
                      theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      <p className="text-sm">Version: 0.1.0 (Alpha)</p>
                      <p className="text-sm">Build: Testnet Demo</p>
                      <p className="text-sm">© 2025 Canary. All rights reserved.</p>
                      <div className="pt-4">
                        <a 
                          href="https://github.com/TheThirdRoom/canary" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`text-sm hover:underline ${
                            theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                          }`}
                        >
                          View on GitHub →
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Burn Confirmation Modal */}
      {showBurnConfirmModal && (
        <BurnConfirmationModal
          hasActiveDossiers={hasActiveDossiers}
          onConfirm={() => {
            setShowBurnConfirmModal(false);
            try {
              // Call the burnWallet method to permanently delete the burner wallet
              burnerWallet.burnWallet();
              toast.success('Anonymous account has been permanently deleted');
              // The burner wallet context will handle the cleanup and state update
            } catch (error) {
              console.error('Failed to burn wallet:', error);
              toast.error('Failed to burn anonymous account');
            }
          }}
          onCancel={() => {
            setShowBurnConfirmModal(false);
            toast.error('Burn cancelled');
          }}
        />
      )}
    </div>
  );
}