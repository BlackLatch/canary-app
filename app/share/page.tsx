'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useTheme } from '@/app/lib/theme-context';
import { Sun, Moon, Shield, Lock, Globe, Clock, AlertCircle, Eye, EyeOff, ArrowLeft, FileText, CheckCircle, User } from 'lucide-react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import type { DossierWithStatus } from '@/app/types/dossier';
import { ContractService } from '@/app/lib/contract';
import type { Address } from 'viem';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';

function ShareContent() {
  const searchParams = useSearchParams();
  const address = searchParams?.get('address') || '';
  const { theme, toggleTheme } = useTheme();
  
  // Authentication hooks
  const { authenticated, user, wallets } = usePrivy();
  const { address: wagmiAddress, isConnected } = useAccount();
  
  const [dossiers, setDossiers] = useState<DossierWithStatus[]>([]);
  const [userDossiers, setUserDossiers] = useState<DossierWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  
  // Get current user's wallet address
  const getCurrentUserAddress = () => {
    if (isConnected && wagmiAddress) return wagmiAddress;
    if (authenticated && wallets && wallets.length > 0) return wallets[0]?.address as Address | undefined;
    return undefined;
  };

  useEffect(() => {
    const fetchDossiers = async () => {
      if (!address) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        console.log('Fetching dossiers for address:', address);
        
        // Get dossier IDs from contract for the shared address
        const dossierIds = await ContractService.getUserDossierIds(address as Address);
        const fetchedDossiers: DossierWithStatus[] = [];
        
        // Process each dossier for the shared address
        for (const id of dossierIds) {
          try {
            const dossier = await ContractService.getDossier(address as Address, id);
            
            if (dossier) {
              // Calculate next check-in time
              const lastCheckInTime = Number(dossier.lastCheckIn) * 1000;
              const checkInIntervalMs = Number(dossier.checkInInterval) * 1000;
              const nextCheckInTime = new Date(lastCheckInTime + checkInIntervalMs);
              const now = new Date();
              const isExpired = now > nextCheckInTime && dossier.isActive;
              
              // Determine status
              let status: 'active' | 'inactive' | 'expired' | 'released' = 'inactive';
              if (dossier.dataReleased) {
                status = 'released';
              } else if (isExpired) {
                status = 'expired';
              } else if (dossier.isActive) {
                status = 'active';
              }
              
              // Get files associated with this dossier
              const storedFiles = JSON.parse(localStorage.getItem('canary-encrypted-files') || '[]');
              const dossierFiles = storedFiles.filter((file: any) => 
                file.dossierId === id.toString() || file.contractDossierId === id.toString()
              );
              
              const dossierWithStatus: DossierWithStatus = {
                id: id,
                name: dossier.name || `Dossier #${id}`,
                description: dossier.description || '',
                creator: dossier.creator,
                visibility: dossier.isPublic ? 'public' : 'private',
                lastCheckIn: dossier.lastCheckIn,
                checkInInterval: dossier.checkInInterval,
                isActive: dossier.isActive,
                dataReleased: dossier.dataReleased,
                nextCheckIn: nextCheckInTime.toISOString(),
                status: status,
                fileCount: dossierFiles.length
              };
              
              fetchedDossiers.push(dossierWithStatus);
            }
          } catch (error) {
            console.error(`Error fetching dossier ${id}:`, error);
          }
        }
        
        console.log('Fetched dossiers:', fetchedDossiers);
        setDossiers(fetchedDossiers);
        
        // If user is signed in, also fetch their accessible dossiers
        const currentUserAddress = getCurrentUserAddress();
        if (currentUserAddress && currentUserAddress !== address) {
          console.log('Fetching user accessible dossiers for:', currentUserAddress);
          const userDossierIds = await ContractService.getUserDossierIds(currentUserAddress as Address);
          const fetchedUserDossiers: DossierWithStatus[] = [];
          
          for (const id of userDossierIds) {
            try {
              const dossier = await ContractService.getDossier(currentUserAddress as Address, id);
              
              if (dossier) {
                // Calculate next check-in time
                const lastCheckInTime = Number(dossier.lastCheckIn) * 1000;
                const checkInIntervalMs = Number(dossier.checkInInterval) * 1000;
                const nextCheckInTime = new Date(lastCheckInTime + checkInIntervalMs);
                const now = new Date();
                const isExpired = now > nextCheckInTime && dossier.isActive;
                
                // Determine status
                let status: 'active' | 'inactive' | 'expired' | 'released' = 'inactive';
                if (dossier.dataReleased) {
                  status = 'released';
                } else if (isExpired) {
                  status = 'expired';
                } else if (dossier.isActive) {
                  status = 'active';
                }
                
                // Get files associated with this dossier
                const storedFiles = JSON.parse(localStorage.getItem('canary-encrypted-files') || '[]');
                const dossierFiles = storedFiles.filter((file: any) => 
                  file.dossierId === id.toString() || file.contractDossierId === id.toString()
                );
                
                const dossierWithStatus: DossierWithStatus = {
                  id: id,
                  name: dossier.name || `Dossier #${id}`,
                  description: dossier.description || '',
                  creator: dossier.creator,
                  visibility: dossier.isPublic ? 'public' : 'private',
                  lastCheckIn: dossier.lastCheckIn,
                  checkInInterval: dossier.checkInInterval,
                  isActive: dossier.isActive,
                  dataReleased: dossier.dataReleased,
                  nextCheckIn: nextCheckInTime.toISOString(),
                  status: status,
                  fileCount: dossierFiles.length
                };
                
                fetchedUserDossiers.push(dossierWithStatus);
              }
            } catch (error) {
              console.error(`Error fetching user dossier ${id}:`, error);
            }
          }
          
          console.log('Fetched user dossiers:', fetchedUserDossiers);
          setUserDossiers(fetchedUserDossiers);
        } else {
          setUserDossiers([]);
        }
      } catch (error) {
        console.error('Error fetching dossiers:', error);
        toast.error('Failed to load dossiers');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDossiers();
    
    // Set up polling for updates
    const interval = setInterval(fetchDossiers, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [address, authenticated, wallets, isConnected, wagmiAddress]);

  // Filter dossiers based on visibility and active status
  const filterDossiers = (dossiersToFilter: DossierWithStatus[]) => {
    return dossiersToFilter.filter(dossier => {
      // Filter by active status
      if (!showInactive && dossier.status === 'inactive') return false;
      
      // Filter by visibility
      if (visibilityFilter === 'public' && dossier.visibility !== 'public') return false;
      if (visibilityFilter === 'private' && dossier.visibility !== 'private') return false;
      
      return true;
    });
  };
  
  const filteredDossiers = filterDossiers(dossiers);
  const filteredUserDossiers = filterDossiers(userDossiers);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return theme === 'light' 
          ? 'text-green-700 bg-green-100 border-green-300'
          : 'text-green-400 bg-green-900/20 border-green-800';
      case 'expired':
        return theme === 'light'
          ? 'text-red-700 bg-red-100 border-red-300'
          : 'text-red-400 bg-red-900/20 border-red-800';
      case 'released':
        return theme === 'light'
          ? 'text-blue-700 bg-blue-100 border-blue-300'
          : 'text-blue-400 bg-blue-900/20 border-blue-800';
      default:
        return theme === 'light'
          ? 'text-gray-700 bg-gray-100 border-gray-300'
          : 'text-gray-400 bg-gray-900/20 border-gray-800';
    }
  };

  const formatTimeRemaining = (nextCheckIn: string | undefined) => {
    if (!nextCheckIn) return 'N/A';
    
    const now = new Date();
    const checkInTime = new Date(nextCheckIn);
    const diff = checkInTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'EXPIRED';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  if (!address) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${
        theme === 'light' ? 'bg-gray-50' : 'bg-black'
      } flex items-center justify-center`}>
        <div className={`border rounded-lg px-8 py-12 text-center max-w-md ${
          theme === 'light'
            ? 'border-gray-300 bg-white'
            : 'border-gray-600 bg-black/40'
        }`}>
          <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${
            theme === 'light' ? 'text-amber-600' : 'text-amber-400'
          }`} />
          <h3 className={`text-lg font-semibold mb-2 ${
            theme === 'light' ? 'text-gray-900' : 'text-gray-100'
          }`}>
            No Address Provided
          </h3>
          <p className={`text-sm mb-4 ${
            theme === 'light' ? 'text-gray-600' : 'text-gray-400'
          }`}>
            Please provide an address in the URL to view their dossiers.
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
            <span>Go to Home</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'light' ? 'bg-gray-50' : 'bg-black'
    }`}>
      <Toaster position="bottom-right" />
      
      {/* Header */}
      <header className={`border-b ${
        theme === 'light' ? 'border-gray-300 bg-white' : 'border-gray-700 bg-black/40'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link 
                href="/"
                className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all ${
                  theme === 'light'
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'border-gray-600 text-gray-300 hover:bg-white/5'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </Link>
              
              <div className="flex items-center gap-2">
                <Shield className={`w-5 h-5 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`} />
                <h1 className={`text-lg font-semibold ${
                  theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                }`}>
                  Shared Dossiers
                </h1>
              </div>
            </div>
            
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg border transition-all ${
                theme === 'light'
                  ? 'border-gray-300 hover:bg-gray-50'
                  : 'border-gray-600 hover:bg-white/5'
              }`}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-gray-600" />
              ) : (
                <Sun className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Address Display */}
        <div className={`border rounded-lg px-6 py-4 mb-8 ${
          theme === 'light' 
            ? 'border-gray-300 bg-white'
            : 'border-gray-600 bg-black/40'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm font-medium uppercase tracking-wider mb-1 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                Monitoring Dossiers For
              </div>
              <div className={`font-mono text-lg ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}>
                {address}
              </div>
            </div>
            
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              theme === 'light'
                ? 'border-green-300 bg-green-50'
                : 'border-green-800 bg-green-900/20'
            }`}>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className={`text-sm font-medium ${
                theme === 'light' ? 'text-green-700' : 'text-green-400'
              }`}>
                Live Monitoring
              </span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            {/* Visibility Filter */}
            <div className="flex items-center gap-1">
              {(['all', 'public', 'private'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setVisibilityFilter(filter)}
                  className={`px-3 py-1.5 text-sm font-medium rounded border transition-all ${
                    visibilityFilter === filter
                      ? theme === 'light'
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-black border-white'
                      : theme === 'light'
                        ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        : 'bg-black/40 text-gray-300 border-gray-600 hover:bg-white/5'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter === 'public' ? (
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      Public
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Private
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Show Inactive Toggle */}
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded border transition-all ${
              showInactive
                ? theme === 'light'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-black border-white'
                : theme === 'light'
                  ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  : 'bg-black/40 text-gray-300 border-gray-600 hover:bg-white/5'
            }`}
          >
            {showInactive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {showInactive ? 'Showing All' : 'Active Only'}
          </button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`border rounded-lg p-6 min-h-[200px] ${
                  theme === 'light'
                    ? 'border-gray-300 bg-white'
                    : 'border-gray-600 bg-black/40'
                }`}
              >
                <div className="animate-pulse">
                  <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-1/2 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded"></div>
                    <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredDossiers.length === 0 && filteredUserDossiers.length === 0 ? (
          <div className={`border rounded-lg px-8 py-12 text-center ${
            theme === 'light'
              ? 'border-gray-300 bg-white'
              : 'border-gray-600 bg-black/40'
          }`}>
            <FileText className={`w-12 h-12 mx-auto mb-4 ${
              theme === 'light' ? 'text-gray-400' : 'text-gray-600'
            }`} />
            <h3 className={`text-lg font-semibold mb-2 ${
              theme === 'light' ? 'text-gray-900' : 'text-gray-100'
            }`}>
              No Dossiers Found
            </h3>
            <p className={`text-sm ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>
              {dossiers.length === 0 && userDossiers.length === 0
                ? 'No dossiers available.'
                : 'No dossiers match your current filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Shared Address Dossiers */}
            {filteredDossiers.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Globe className={`w-5 h-5 ${
                    theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <h2 className={`font-semibold uppercase tracking-wider text-sm ${
                    theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                  }`}>
                    Shared Dossiers
                  </h2>
                  <span className={`text-sm ${
                    theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    ({filteredDossiers.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredDossiers.map((dossier) => (
              <div
                key={dossier.id}
                className={`border rounded-lg px-6 py-5 min-h-[200px] transition-all duration-300 ease-out hover:-translate-y-1 ${
                  theme === 'light'
                    ? 'border-gray-300 bg-white hover:border-[#e53e3e]'
                    : 'border-gray-600 bg-black/40 hover:border-[#e53e3e]'
                }`}
              >
                {/* Card Header */}
                <div className={`border-b pb-3 mb-4 ${
                  theme === 'light' ? 'border-gray-200' : 'border-gray-700'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-2">
                      <h3 className={`font-semibold text-lg mb-1 ${
                        theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                      }`}>
                        {dossier.name?.replace('Encrypted file: ', '') || 'Unnamed Dossier'}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        {/* Visibility Badge */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                          dossier.visibility === 'public'
                            ? theme === 'light'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-blue-900/20 text-blue-400'
                            : theme === 'light'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-gray-900/20 text-gray-400'
                        }`}>
                          {dossier.visibility === 'public' ? (
                            <>
                              <Globe className="w-3 h-3" />
                              Public
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              Private
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(dossier.status)}`}>
                      {dossier.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="space-y-3">
                  {dossier.description && (
                    <p className={`text-sm line-clamp-2 ${
                      theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {dossier.description}
                    </p>
                  )}

                  {/* Time Remaining */}
                  {dossier.status === 'active' && (
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${
                        theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                      }`} />
                      <span className={`text-sm font-medium ${
                        formatTimeRemaining(dossier.nextCheckIn) === 'EXPIRED'
                          ? 'text-red-600'
                          : theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                      }`}>
                        {formatTimeRemaining(dossier.nextCheckIn) === 'EXPIRED' 
                          ? 'Check-in Required'
                          : `Next check-in: ${formatTimeRemaining(dossier.nextCheckIn)}`
                        }
                      </span>
                    </div>
                  )}

                  {/* Files Count */}
                  {dossier.fileCount > 0 && (
                    <div className="flex items-center gap-2">
                      <FileText className={`w-4 h-4 ${
                        theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                      }`} />
                      <span className={`text-sm ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        {dossier.fileCount} file{dossier.fileCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}

                  {/* Released Status */}
                  {dossier.status === 'released' && (
                    <div className={`flex items-center gap-2 mt-3 p-2 rounded ${
                      theme === 'light'
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-green-900/20 border border-green-800'
                    }`}>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className={`text-sm font-medium ${
                        theme === 'light' ? 'text-green-700' : 'text-green-400'
                      }`}>
                        Released - Files can be decrypted
                      </span>
                    </div>
                  )}
                </div>
              </div>
                    ))}
                </div>
              </div>
            )}

            {/* User Accessible Dossiers */}
            {filteredUserDossiers.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <User className={`w-5 h-5 ${
                    theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <h2 className={`font-semibold uppercase tracking-wider text-sm ${
                    theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                  }`}>
                    Your Accessible Dossiers
                  </h2>
                  <span className={`text-sm ${
                    theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    ({filteredUserDossiers.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredUserDossiers.map((dossier) => (
                    <div
                      key={`user-${dossier.id}`}
                      className={`border rounded-lg px-6 py-5 min-h-[200px] transition-all duration-300 ease-out hover:-translate-y-1 ${
                        theme === 'light'
                          ? 'border-gray-300 bg-white hover:border-[#e53e3e]'
                          : 'border-gray-600 bg-black/40 hover:border-[#e53e3e]'
                      }`}
                    >
                      {/* Card Header */}
                      <div className={`border-b pb-3 mb-4 ${
                        theme === 'light' ? 'border-gray-200' : 'border-gray-700'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1 pr-2">
                            <h3 className={`font-semibold text-lg mb-1 ${
                              theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                            }`}>
                              {dossier.name?.replace('Encrypted file: ', '') || 'Unnamed Dossier'}
                            </h3>
                            <div className="flex items-center gap-2 mt-2">
                              {/* Visibility Badge */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                                dossier.visibility === 'public'
                                  ? theme === 'light'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-blue-900/20 text-blue-400'
                                  : theme === 'light'
                                    ? 'bg-gray-100 text-gray-700'
                                    : 'bg-gray-900/20 text-gray-400'
                              }`}>
                                {dossier.visibility === 'public' ? (
                                  <>
                                    <Globe className="w-3 h-3" />
                                    Public
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3 h-3" />
                                    Private
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(dossier.status)}`}>
                            {dossier.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="space-y-3">
                        {dossier.description && (
                          <p className={`text-sm line-clamp-2 ${
                            theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            {dossier.description}
                          </p>
                        )}

                        {/* Time Remaining */}
                        {dossier.status === 'active' && (
                          <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${
                              theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                            }`} />
                            <span className={`text-sm font-medium ${
                              formatTimeRemaining(dossier.nextCheckIn) === 'EXPIRED'
                                ? 'text-red-600'
                                : theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                            }`}>
                              {formatTimeRemaining(dossier.nextCheckIn) === 'EXPIRED' 
                                ? 'Check-in Required'
                                : `Next check-in: ${formatTimeRemaining(dossier.nextCheckIn)}`
                              }
                            </span>
                          </div>
                        )}

                        {/* Files Count */}
                        {dossier.fileCount > 0 && (
                          <div className="flex items-center gap-2">
                            <FileText className={`w-4 h-4 ${
                              theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                            }`} />
                            <span className={`text-sm ${
                              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              {dossier.fileCount} file{dossier.fileCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}

                        {/* Released Status */}
                        {dossier.status === 'released' && (
                          <div className={`flex items-center gap-2 mt-3 p-2 rounded ${
                            theme === 'light'
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-green-900/20 border border-green-800'
                          }`}>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className={`text-sm font-medium ${
                              theme === 'light' ? 'text-green-700' : 'text-green-400'
                            }`}>
                              Released - Files can be decrypted
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Box - Following Card Style Guide */}
        <div className={`mt-8 border rounded-lg px-6 py-5 ${
          theme === 'light'
            ? 'border-gray-300 bg-white'
            : 'border-gray-600 bg-black/40'
        }`}>
          <div className="flex gap-3">
            <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`} />
            <div className="space-y-2">
              <h3 className={`font-semibold uppercase tracking-wider text-sm ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}>
                About This Page
              </h3>
              <p className={`text-sm ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                You are viewing the public dossier status for the address above. 
                This page shows all dossiers associated with this address, their current status, 
                and when they require check-ins. Released dossiers can be decrypted if you have 
                the necessary permissions.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    }>
      <ShareContent />
    </Suspense>
  );
}