'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { ContractService, type Dossier } from '../../lib/contract';
import type { Address } from 'viem';

export default function SharedDossierView() {
  const params = useParams();
  const sharedAddress = params.address as Address;
  
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [decryptingDossier, setDecryptingDossier] = useState<string | null>(null);

  // Update time every second for real-time countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load shared dossiers
  useEffect(() => {
    loadSharedDossiers();
  }, [sharedAddress]);

  const loadSharedDossiers = async () => {
    if (!sharedAddress) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('📋 Loading shared dossiers for address:', sharedAddress);
      
      // Check if address has any dossiers
      const userExists = await ContractService.userExists(sharedAddress);
      if (!userExists) {
        setError('This address has no dossiers to share');
        return;
      }

      // Get dossier IDs for the shared address
      const dossierIds = await ContractService.getUserDossierIds(sharedAddress);
      console.log(`📄 Found ${dossierIds.length} dossiers for shared address`);

      if (dossierIds.length === 0) {
        setError('This address has no dossiers to share');
        return;
      }

      // Load all dossiers
      const loadedDossiers: Dossier[] = [];
      for (const dossierId of dossierIds) {
        try {
          const dossier = await ContractService.getDossier(sharedAddress, dossierId);
          loadedDossiers.push(dossier);
        } catch (error) {
          console.error(`Failed to load dossier #${dossierId.toString()}:`, error);
        }
      }

      setDossiers(loadedDossiers);
      console.log(`✅ Loaded ${loadedDossiers.length} shared dossiers`);
      
    } catch (error) {
      console.error('❌ Failed to load shared dossiers:', error);
      setError('Failed to load shared dossiers. Please check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecryption = async (dossier: Dossier) => {
    if (!dossier.encryptedFileHashes.length) {
      toast.error('No encrypted files found in this dossier');
      return;
    }

    setDecryptingDossier(dossier.id.toString());
    let decryptToast: any;

    try {
      console.log('🔓 Attempting decryption for shared dossier:', dossier.id.toString());
      
      const fileHash = dossier.encryptedFileHashes[0];
      if (!fileHash) {
        throw new Error('No encrypted file hash found');
      }
      
      decryptToast = toast.loading('Decrypting shared document...');
      
      // Fetch encrypted data from IPFS
      const ipfsHash = fileHash.replace('ipfs://', '');
      const ipfsGateways = [
        `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
        `https://ipfs.io/ipfs/${ipfsHash}`,
        `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
      ];
      
      let retrievedData: Uint8Array | null = null;
      
      for (const gateway of ipfsGateways) {
        try {
          const response = await fetch(gateway);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            retrievedData = new Uint8Array(arrayBuffer);
            break;
          }
        } catch (error) {
          console.log(`Gateway ${gateway} failed:`, error);
          continue;
        }
      }
      
      if (!retrievedData) {
        throw new Error('Failed to fetch encrypted data from IPFS');
      }
      
      // Initialize TACo and decrypt
      const { tacoService } = await import('../../lib/taco');
      await tacoService.initialize();
      
      const { ThresholdMessageKit } = await import('@nucypher/taco');
      const messageKit = ThresholdMessageKit.fromBytes(retrievedData);
      
      const decryptedData = await tacoService.decryptFile(messageKit);
      
      // Download the decrypted file
      const originalFileName = dossier.name.replace('Encrypted file: ', '') || 'shared-document';
      const blob = new Blob([decryptedData]);
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = originalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('🎉 Shared document decrypted and downloaded!', { id: decryptToast });
      
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      
      let errorMessage = 'Failed to decrypt shared document. ';
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch encrypted data')) {
          errorMessage += 'Could not retrieve file from IPFS.';
        } else if (error.message.includes('decrypt')) {
          errorMessage += 'The time condition may not be met yet.';
        } else {
          errorMessage += error.message;
        }
      }
      
      toast.error(errorMessage, { id: decryptToast });
    } finally {
      setDecryptingDossier(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen canary-grid-background relative" style={{ zoom: '0.8' }}>
        <div className="absolute top-6 left-6 z-50">
          <img src="/canary.png" alt="Canary" className="h-20 w-auto" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 py-12 flex items-center justify-center min-h-screen">
          <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900 mb-4"></div>
            <h1 className="editorial-header text-2xl mb-2">Loading Shared Dossiers</h1>
            <p className="editorial-body text-gray-600">Loading dossiers for {sharedAddress?.slice(0, 6)}...{sharedAddress?.slice(-4)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen canary-grid-background relative" style={{ zoom: '0.8' }}>
        <div className="absolute top-6 left-6 z-50">
          <img src="/canary.png" alt="Canary" className="h-20 w-auto" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 py-12 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="editorial-header text-2xl mb-2 text-red-600">Error</h1>
            <p className="editorial-body text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.href = '/'}
                              className="editorial-body px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate overall status
  const activeDossiers = dossiers.filter(d => d.isActive);
  let shortestRemainingMs = Number.MAX_SAFE_INTEGER;
  let hasExpiredDossiers = false;

  for (const dossier of activeDossiers) {
    const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
    const intervalMs = Number(dossier.checkInInterval) * 1000;
    const timeSinceLastCheckIn = currentTime.getTime() - lastCheckInMs;
    const remainingMs = intervalMs - timeSinceLastCheckIn;
    
    if (remainingMs <= 0) {
      hasExpiredDossiers = true;
    } else if (remainingMs < shortestRemainingMs) {
      shortestRemainingMs = remainingMs;
    }
  }

  let overallStatus = '';
  let statusColor = '';
  
  if (activeDossiers.length === 0) {
    overallStatus = 'NO ACTIVE DOSSIERS';
    statusColor = 'text-gray-500';
  } else if (hasExpiredDossiers) {
    overallStatus = 'SOME EXPIRED';
    statusColor = 'text-red-600';
  } else if (shortestRemainingMs < 5 * 60 * 1000) {
    overallStatus = 'EXPIRING SOON';
    statusColor = 'text-red-600';
  } else if (shortestRemainingMs < 30 * 60 * 1000) {
    overallStatus = 'EXPIRING SOON';
    statusColor = 'text-orange-500';
  } else {
    overallStatus = 'ACTIVE';
    statusColor = 'text-green-600';
  }

  return (
    <>
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
        {/* Logo */}
        <div className="absolute top-6 left-6 z-50">
          <img src="/canary.png" alt="Canary" className="h-20 w-auto" />
        </div>

        {/* Header */}
        <header className="border-b border-gray-200/30 px-4 py-6">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div></div>
            
            <div className="flex items-center gap-8">
              <button 
                onClick={() => window.location.href = '/'}
                className="editorial-body font-semibold text-gray-600 hover:text-black transition-colors"
              >
                ← Back to Home
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* Shared Status Display */}
          <div className="text-center mb-16">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="editorial-body text-sm text-gray-500">
                  Shared Dossiers Status for:
                </div>
                <div className="editorial-body text-lg font-mono text-gray-700 mb-4">
                  {sharedAddress}
                </div>
                <div className={`editorial-header text-4xl ${statusColor} font-bold font-mono tracking-wide`}>
                  {overallStatus}
                </div>
              </div>
              
              <div className="editorial-body text-sm text-gray-600">
                {activeDossiers.length} active of {dossiers.length} total shared documents
              </div>
            </div>
          </div>

          {/* Shared Documents */}
          <div className="border-2 border-gray-800 mb-12">
            <div className="bg-gray-800 p-3">
              <div className="flex justify-between items-center">
                <h2 style={{color: '#ffffff'}} className="editorial-header text-lg tracking-[0.2em] font-bold">Shared Documents</h2>
                <span style={{color: '#ffffff'}} className="editorial-body text-xs">
                  {dossiers.length} documents shared • Read-only view
                </span>
              </div>
            </div>
            <div className="bg-white/90 backdrop-blur-sm p-6">
              {dossiers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {dossiers.map((dossier) => {
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
                          <div className="flex justify-between items-start">
                            <div className="editorial-body text-xs text-gray-500 font-bold">
                              SHARED DOCUMENT
                            </div>
                                                            <div className={`editorial-body text-xs font-semibold px-2 py-1 border ${
                                  (() => {
                                    // Check if expired by time calculation
                                    const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
                                    const intervalMs = Number(dossier.checkInInterval) * 1000;
                                    const timeSinceLastCheckIn = Date.now() - lastCheckInMs;
                                    const remainingMs = intervalMs - timeSinceLastCheckIn;
                                    const isTimeExpired = remainingMs <= 0;
                                    
                                    if (isTimeExpired) {
                                      return 'border-red-600 text-red-700 bg-red-50';
                                    } else if (dossier.isActive) {
                                      return 'border-green-600 text-green-700 bg-green-50';
                                    } else {
                                      return 'border-gray-400 text-gray-600 bg-gray-100';
                                    }
                                  })()
                                }`}>
                                  {(() => {
                                    // Check if expired by time calculation
                                    const lastCheckInMs = Number(dossier.lastCheckIn) * 1000;
                                    const intervalMs = Number(dossier.checkInInterval) * 1000;
                                    const timeSinceLastCheckIn = Date.now() - lastCheckInMs;
                                    const remainingMs = intervalMs - timeSinceLastCheckIn;
                                    const isTimeExpired = remainingMs <= 0;
                                    
                                    if (isTimeExpired) {
                                      return 'Expired';
                                    } else {
                                      return dossier.isActive ? 'Active' : 'Deactivated';
                                    }
                                  })()}
                                </div>
                          </div>
                        </div>
                        
                        {/* Card Body */}
                        <div className="p-4">
                          {/* Time Remaining */}
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
                              <div className="editorial-body text-xs text-gray-500">FILES</div>
                              <div className="editorial-body text-sm font-bold text-black">
                                {dossier.encryptedFileHashes.length}
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
                        
                        {/* Card Footer - Decryption */}
                        <div className="border-t border-gray-200 p-4">
                          {isExpired && dossier.isActive && dossier.encryptedFileHashes.length > 0 ? (
                            <button
                              onClick={() => handleDecryption(dossier)}
                              disabled={decryptingDossier === dossier.id.toString()}
                              className="w-full editorial-body text-xs px-3 py-2 border-2 border-red-600 text-red-700 hover:bg-red-600 hover:text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {decryptingDossier === dossier.id.toString() ? (
                                <>
                                  <div className="inline-block animate-spin rounded-full h-3 w-3 border-b border-current mr-2"></div>
                                  DECRYPTING...
                                </>
                              ) : (
                                '🔓 DECRYPT EXPIRED DOCUMENT'
                              )}
                            </button>
                          ) : (
                            <div className="w-full text-center py-2 editorial-body text-xs text-gray-500">
                              {!dossier.isActive ? 'Document deactivated' : 
                               !isExpired ? 'Not yet expired' : 
                               'No files available'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 px-4 text-center">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="editorial-header text-xl font-bold text-gray-600 mb-2">No Shared Documents</h3>
                  <p className="editorial-body text-base text-gray-500">
                    This address has no documents to share.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 