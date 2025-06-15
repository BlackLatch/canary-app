'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Clock, Shield, Download, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { encryptFileWithCondition, commitEncryptedFile, DeadmanCondition, TraceJson, EncryptionResult } from './lib/taco';
import Onboarding from './components/Onboarding';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { metaMask, coinbaseWallet, walletConnect } from 'wagmi/connectors';

export default function Home() {
  const { connect, connectors, isPending } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [checkInInterval, setCheckInInterval] = useState('24'); // hours
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [traceJson, setTraceJson] = useState<TraceJson | null>(null);
  const [encryptedCapsule, setEncryptedCapsule] = useState<any>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<Date>(new Date(Date.now() - 2 * 60 * 60 * 1000)); // 2 hours ago
  const [activityLog, setActivityLog] = useState([
    { type: 'Check in confirmed', date: 'Apr 31, 2026, 16:01 AM' },
    { type: 'Pre-registeral nor-contact', date: 'Apr-32, 3093, 26:3 PM' },
    { type: 'Trigger created', date: 'Apr 13, 2021, 18:00 AM' }
  ]);
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
    
    try {
      const condition: DeadmanCondition = {
        type: 'no_checkin',
        duration: `${checkInInterval} HOURS`
      };

      // Encrypt the file with TACo (no upload yet)
      const encryptionResult = await encryptFileWithCondition(
        uploadedFile,
        condition,
        description
      );
      
      setEncryptedCapsule(encryptionResult);
      
      // Add to activity log
      setActivityLog(prev => [
        { type: 'Capsule encrypted', date: new Date().toLocaleString() },
        ...prev
      ]);
      
    } catch (error) {
      console.error('Error encrypting file:', error);
      
      // Fallback to mock encryption
      const mockEncryption: EncryptionResult = {
        messageKit: { isMock: true },
        encryptedData: new Uint8Array([1, 2, 3, 4, 5]), // Mock data
        originalFileName: uploadedFile.name,
        condition: {
          type: 'no_checkin',
          duration: `${checkInInterval} HOURS`
        },
        description: description || `Encrypted file: ${uploadedFile.name}`,
        capsuleUri: 'taco://mock-capsule-123'
      };
      
      setEncryptedCapsule(mockEncryption);
      
      setActivityLog(prev => [
        { type: 'Capsule encrypted (demo mode)', date: new Date().toLocaleString() },
        ...prev
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const commitToCodex = async () => {
    if (!encryptedCapsule) return;
    
    setIsCommitting(true);
    
    try {
      const { commitResult, traceJson: newTraceJson } = await commitEncryptedFile(encryptedCapsule);
      
      setTraceJson(newTraceJson);
      
      // Add to activity log
      setActivityLog(prev => [
        { type: 'Capsule committed to Local Codex', date: new Date().toLocaleString() },
        ...prev
      ]);
      
    } catch (error) {
      console.error('Error committing to Codex:', error);
      
      // Fallback with mock trace JSON
      const mockTraceJson: TraceJson = {
        payload_uri: `ipfs://QmMock${Date.now()}/${encryptedCapsule.originalFileName}`,
        taco_capsule_uri: encryptedCapsule.capsuleUri,
        condition: `No check-in for ${checkInInterval} hours`,
        description: encryptedCapsule.description,
        storage_type: 'mock',
        created_at: new Date().toISOString()
      };
      
      setTraceJson(mockTraceJson);
      
      setActivityLog(prev => [
        { type: 'Capsule committed (fallback)', date: new Date().toLocaleString() },
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

  const handleCheckIn = () => {
    const now = new Date();
    setLastCheckIn(now);
    
    // Add to activity log
    setActivityLog(prev => [
      { type: 'Check in confirmed', date: now.toLocaleString() },
      ...prev
    ]);
  };

  const getTimeSinceLastCheckIn = () => {
    const diffMs = currentTime.getTime() - lastCheckIn.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m ago`;
    } else {
      return `${diffMinutes}m ago`;
    }
  };

  const getRemainingTime = () => {
    const intervalMs = parseInt(checkInInterval) * 60 * 60 * 1000; // Convert hours to milliseconds
    const timeSinceLastCheckIn = currentTime.getTime() - lastCheckIn.getTime();
    const remainingMs = intervalMs - timeSinceLastCheckIn;
    
    if (remainingMs <= 0) {
      return { expired: true, display: 'EXPIRED', color: 'text-red-600' };
    }
    
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const remainingSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
    
    // Color coding based on urgency
    let color = 'text-green-600';
    if (remainingMs < 60 * 60 * 1000) { // Less than 1 hour
      color = 'text-red-600';
    } else if (remainingMs < 6 * 60 * 60 * 1000) { // Less than 6 hours
      color = 'text-orange-500';
    } else if (remainingMs < 24 * 60 * 60 * 1000) { // Less than 24 hours
      color = 'text-yellow-600';
    }
    
    if (remainingHours > 0) {
      return { 
        expired: false, 
        display: `${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`, 
        color 
      };
    } else if (remainingMinutes > 0) {
      return { 
        expired: false, 
        display: `${remainingMinutes}m ${remainingSeconds}s`, 
        color 
      };
    } else {
      return { 
        expired: false, 
        display: `${remainingSeconds}s`, 
        color 
      };
    }
  };

  const handleOnboardingComplete = (userChoices: Record<string, string>) => {
    setUserProfile(userChoices);
    setOnboardingComplete(true);
    
    // Set default check-in interval based on user's risk level
    if (userChoices.risk === 'Immediate danger') {
      setCheckInInterval('1');
    } else if (userChoices.risk === 'High risk') {
      setCheckInInterval('6');
    } else if (userChoices.risk === 'Moderate risk') {
      setCheckInInterval('12');
    } else {
      setCheckInInterval('24');
    }
  };

  const handleSignIn = (method: string) => {
    console.log('Sign in method:', method);
    console.log('User profile:', userProfile);
    
    if (method === 'Web3 Wallet') {
      // Connect to the first available connector (usually MetaMask)
      const connector = connectors.find(c => c.id === 'metaMask') || connectors[0];
      if (connector) {
        connect({ connector });
      }
    } else if (method === 'Demo') {
      setSignedIn(true);
    } else {
      // For email sign-in, just simulate for now
      setSignedIn(true);
    }
  };

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

  // Show onboarding if not completed
  if (!onboardingComplete) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Show sign-in page if onboarding complete but not signed in
  if (!signedIn) {
    return (
      <div className="min-h-screen grid-background flex items-center justify-center p-4 md:p-8" style={{ zoom: '0.8' }}>
        <div className="max-w-2xl w-full text-center">
          {/* Canary logo and wordmark */}
          <div className="flex flex-col items-center mb-8 md:mb-12">
            <img 
              src="/canary.png" 
              alt="Canary Logo" 
              className="max-w-40 max-h-40 md:max-w-48 md:max-h-48 mb-4 object-contain"
            />
            <h1 className="editorial-header text-xl md:text-2xl tracking-[0.2em]">CANARY</h1>
          </div>

          {/* Setup summary (if user went through onboarding) */}
          {Object.keys(userProfile).length > 0 && (
            <div className="editorial-card mb-6 md:mb-8">
              <h3 className="editorial-subheader mb-3 md:mb-4">Your Canary Setup:</h3>
              <p className="editorial-body text-sm md:text-base text-gray-600 leading-relaxed">
                {Object.entries(userProfile).map(([key, value]) => value).join(' • ')}
              </p>
            </div>
          )}

          {/* Sign in */}
          <h2 className="editorial-header text-3xl md:text-4xl lg:text-5xl mb-6 md:mb-8 leading-tight">
            {Object.keys(userProfile).length > 0 ? 'Complete Your Canary Setup' : 'Welcome to Canary'}
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

            <div className="pt-4 border-t border-gray-200">
              <button
                className="editorial-body text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
                onClick={() => handleSignIn('Demo')}
              >
                Continue with demo mode
              </button>
            </div>
          </div>

          <p className="editorial-body text-gray-600 mt-6 md:mt-8 text-sm md:text-base">
            Your truth protection starts now.
          </p>
        </div>
      </div>
    );
  }

  const intervalOptions = [
    { value: '1', label: '1 Hour' },
    { value: '6', label: '6 Hours' },
    { value: '12', label: '12 Hours' },
    { value: '24', label: '24 Hours' },
    { value: '48', label: '48 Hours' },
    { value: '72', label: '72 Hours' },
    { value: '168', label: '1 Week' }
  ];

  return (
    <div className="min-h-screen grid-background design-board" style={{ zoom: '0.8' }}>
      {/* Animated connection lines */}
      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
        {/* Animated curved lines */}
        <path
          d="M 300 200 Q 500 150 700 250"
          className="connection-line"
          style={{ 
            strokeDasharray: '5,5',
            animation: 'dashMove 4s linear infinite'
          }}
        />
        <path
          d="M 150 400 Q 400 350 650 450"
          className="connection-line"
          style={{ 
            strokeDasharray: '3,7',
            animation: 'dashMove 6s linear infinite reverse'
          }}
        />
        <path
          d="M 800 300 Q 1000 200 1200 350"
          className="connection-line"
          style={{ 
            strokeDasharray: '4,6',
            animation: 'dashMove 5s linear infinite'
          }}
        />
        <path
          d="M 200 600 Q 500 550 800 650"
          className="connection-line"
          style={{ 
            strokeDasharray: '6,4',
            animation: 'dashMove 7s linear infinite reverse'
          }}
        />
        
        {/* Animated circles */}
        <circle cx="300" cy="200" r="6" fill="rgba(255, 255, 255, 0.8)">
          <animate attributeName="r" values="4;8;4" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="700" cy="250" r="6" fill="rgba(255, 255, 255, 0.8)">
          <animate attributeName="r" values="6;10;6" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="150" cy="400" r="5" fill="rgba(255, 255, 255, 0.8)">
          <animate attributeName="r" values="3;7;3" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="650" cy="450" r="7" fill="rgba(255, 255, 255, 0.8)">
          <animate attributeName="r" values="5;9;5" dur="3.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="800" cy="300" r="6" fill="rgba(255, 255, 255, 0.8)">
          <animate attributeName="r" values="4;8;4" dur="4.5s" repeatCount="indefinite" />
        </circle>
      </svg>

      <div className="max-w-7xl mx-auto px-4 py-12 relative z-10">
        {/* Main Controls */}
        <div className="text-center mb-12">
          {/* Master Switch & Check-in Controls */}
          <div className="flex justify-center items-stretch gap-12 mb-12">
            {/* Master Switch */}
            <div className="flex flex-col items-center">
              <div className="design-card" style={{ width: '280px', height: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0', color: '#000' }}>Master Switch</h3>
                <div className="flex flex-col items-center justify-center flex-1">
                  <button
                    onClick={() => setIsActive(!isActive)}
                    className={clsx(
                      "relative inline-flex h-16 w-32 items-center rounded-full transition-colors duration-300 mb-4",
                      isActive ? "bg-slate-700" : "bg-gray-300"
                    )}
                  >
                    <span
                      className={clsx(
                        "inline-block h-12 w-12 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                        isActive ? "translate-x-16" : "translate-x-2"
                      )}
                    />
                    <span
                      className={clsx(
                        "absolute left-4 text-white font-playfair font-bold text-lg",
                        isActive ? "opacity-100" : "opacity-0"
                      )}
                    >
                      ON
                    </span>
                  </button>
                </div>
                <div style={{ fontSize: '13px', color: '#555' }}>
                  System {isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>

            {/* Check-in Button */}
            <div className="flex flex-col items-center">
              <div className="design-card" style={{ width: '280px', height: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0', color: '#000' }}>Safety Check-in</h3>
                <div className="flex flex-col items-center justify-center flex-1">
                  <button
                    onClick={handleCheckIn}
                    className="bg-slate-700 text-white hover:bg-slate-800 w-32 h-16 text-sm font-semibold rounded-lg transition-all duration-200 mb-4 flex items-center justify-center shadow-sm"
                  >
                    <CheckCircle className="inline mr-2" size={18} />
                    Check In Now
                  </button>
                </div>
                <div style={{ fontSize: '13px', color: '#555' }}>
                  Last: {getTimeSinceLastCheckIn()}
                </div>
              </div>
            </div>
          </div>

          {/* Condition Card */}
          <div className="flex justify-center mb-12">
            <div className="design-card" style={{ textAlign: 'center', maxWidth: '400px' }}>
              <div className="editorial-body mb-2">Release files if no check-in for</div>
              <div className="editorial-header text-3xl mb-4">{checkInInterval} HOURS</div>
              <div className="border-t border-gray-200 pt-4">
                <div className="editorial-body text-sm mb-1">Time remaining:</div>
                <div className={`text-2xl font-bold ${getRemainingTime().color}`}>
                  {getRemainingTime().display}
                  {getRemainingTime().expired && (
                    <div className="text-sm mt-1 text-red-600">Trigger would have activated</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column */}
          <div className="space-y-8">
            {/* File Upload */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', color: '#000' }}>File Upload</h3>
              <div
                className="design-card border-dashed border-2 border-gray-300 text-center py-12 cursor-pointer hover:border-blue-400 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                <p className="editorial-body">
                  {uploadedFile ? uploadedFile.name : 'Drag and drop file, or browse'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Check-in Settings */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', color: '#000' }}>Check-in Settings</h3>
              <div className="design-card space-y-4">
                <div>
                  <label className="editorial-body font-semibold mb-2 block">
                    Check-in Interval
                  </label>
                  <select 
                    className="editorial-input"
                    value={checkInInterval}
                    onChange={(e) => setCheckInInterval(e.target.value)}
                  >
                    {intervalOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="editorial-body text-sm text-gray-500 mt-2">
                    Files will be released if you don't check in within this timeframe
                  </p>
                </div>
                
                <textarea
                  placeholder="Description (optional)"
                  className="editorial-input h-24 resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                
                <button
                  onClick={processCanaryTrigger}
                  disabled={!uploadedFile || isProcessing || encryptedCapsule}
                  className="editorial-button bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Encrypting...
                    </div>
                  ) : encryptedCapsule ? (
                    <>
                      <CheckCircle className="inline mr-2" size={20} />
                      Capsule Encrypted
                    </>
                  ) : (
                    <>
                      <Shield className="inline mr-2" size={20} />
                      Create Encrypted Capsule
                    </>
                  )}
                </button>

                {/* Commit Button - shown after encryption */}
                {encryptedCapsule && !traceJson && (
                  <button
                    onClick={commitToCodex}
                    disabled={isCommitting}
                    className="editorial-button bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed w-full mt-4"
                  >
                    {isCommitting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                                  Committing to Local Codex...
                      </div>
                    ) : (
                      <>
                        <Upload className="inline mr-2" size={20} />
                                                  Commit to Local Codex
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
                    className="editorial-button border-2 border-slate-300 text-slate-700 hover:bg-slate-50 w-full mt-4"
                  >
                    Create New Capsule
                  </button>
                )}
              </div>
            </div>

            {/* Activity Log */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', color: '#000' }}>Activity Log</h3>
              <div className="design-card space-y-3">
                {activityLog.map((log, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <span className="editorial-body">{log.type}</span>
                    <span className="editorial-body text-sm text-gray-500">{log.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Encrypted Capsule Details - shown after encryption, before commit */}
            {encryptedCapsule && !traceJson && (
              <div>
                <h3 className="editorial-subheader mb-4">Encrypted Capsule</h3>
                <div className="editorial-card">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="editorial-body font-semibold">Status</span>
                      <span className="text-orange-600 font-semibold">Ready to Commit</span>
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

                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="flex items-center">
                        <AlertCircle size={16} className="text-yellow-600 mr-2" />
                        <span className="editorial-body text-sm text-yellow-800">
                          Click "Commit to Local Codex" to upload your encrypted capsule to your local Codex node
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Trace JSON Display */}
            {traceJson && (
              <div>
                <h3 className="editorial-subheader mb-4">Trace Capsule</h3>
                <div className="editorial-card">
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
                    </div>
                  </div>
                  <pre className="bg-gray-100 p-4 rounded font-mono text-sm overflow-x-auto">
                    {JSON.stringify(traceJson, null, 2)}
                  </pre>
                  
                  {/* TACo & Codex Integration Status */}
                  <div className="mt-4 space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="flex items-center">
                        <Shield size={16} className="text-blue-600 mr-2" />
                        <span className="editorial-body text-sm text-blue-800">
                          {traceJson.taco_capsule_uri.includes('mock') ? 
                            'Demo Mode - Using mock encryption for testing' : 
                            'TACo Network - Real threshold cryptographic protection'
                          }
                        </span>
                      </div>
                    </div>
                    
                    <div className={`p-3 border rounded ${
                      traceJson.payload_uri.startsWith('codex://') 
                        ? traceJson.payload_uri.includes('Mock') 
                          ? 'bg-yellow-50 border-yellow-200' 
                          : 'bg-green-50 border-green-200'
                        : traceJson.payload_uri.startsWith('ipfs://') 
                          ? traceJson.payload_uri.includes('Mock') || traceJson.payload_uri.match(/^ipfs:\/\/Qm[A-Za-z0-9]{44}$/) 
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-purple-50 border-purple-200'
                          : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center">
                        <Upload size={16} className={`mr-2 ${
                          traceJson.payload_uri.startsWith('codex://') 
                            ? traceJson.payload_uri.includes('Mock') 
                              ? 'text-yellow-600' 
                              : 'text-green-600'
                            : traceJson.payload_uri.startsWith('ipfs://') 
                              ? traceJson.payload_uri.includes('Mock') || traceJson.payload_uri.match(/^ipfs:\/\/Qm[A-Za-z0-9]{44}$/)
                                ? 'text-yellow-600'
                                : 'text-purple-600'
                              : 'text-red-600'
                        }`} />
                        <span className={`editorial-body text-sm ${
                          traceJson.payload_uri.startsWith('codex://') 
                            ? traceJson.payload_uri.includes('Mock') 
                              ? 'text-yellow-800' 
                              : 'text-green-800'
                            : traceJson.payload_uri.startsWith('ipfs://') 
                              ? traceJson.payload_uri.includes('Mock') || traceJson.payload_uri.match(/^ipfs:\/\/Qm[A-Za-z0-9]{44}$/)
                                ? 'text-yellow-800'
                                : 'text-purple-800'
                              : 'text-red-800'
                        }`}>
                          {traceJson.payload_uri.startsWith('codex://') ? 
                            traceJson.payload_uri.includes('Mock') ?
                              'Mock Codex - Simulated upload (no real Codex node)' :
                              'Local Codex Node - Stored on localhost:8080' :
                            traceJson.payload_uri.startsWith('ipfs://') ?
                              traceJson.payload_uri.includes('Mock') || traceJson.payload_uri.match(/^ipfs:\/\/Qm[A-Za-z0-9]{44}$/) ?
                                'Mock IPFS - Simulated fallback storage' :
                                'Real IPFS Network - Uploaded to ipfs.io gateway!' :
                              'Unknown Storage - Error in upload process'
                          }
                        </span>
                      </div>
                      
                      {/* Show gateway link for real IPFS uploads */}
                      {traceJson.payload_uri.startsWith('ipfs://') && !traceJson.payload_uri.includes('Mock') && !traceJson.payload_uri.match(/^ipfs:\/\/Qm[A-Za-z0-9]{44}$/) && (
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
                      
                      {(traceJson.payload_uri.includes('Mock') || traceJson.payload_uri.match(/^ipfs:\/\/Qm[A-Za-z0-9]{44}$/)) && (
                        <div className="mt-2 text-xs text-yellow-700">
                          💡 Real uploads will happen automatically when services are available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Emergency Contacts */}
            <div>
              <h3 className="editorial-subheader mb-4">Emergency Contacts</h3>
              <div className="editorial-card space-y-3">
                <div className="flex justify-between items-center">
                  <span className="editorial-body font-semibold">Alles Smith</span>
                  <CheckCircle className="text-green-500" size={20} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="editorial-body font-semibold">Beb Johnson</span>
                  <CheckCircle className="text-green-500" size={20} />
                </div>
              </div>
            </div>

            {/* Status */}
            <div>
              <h3 className="editorial-subheader mb-4">System Status</h3>
              <div className="editorial-card">
                <div className="flex items-center mb-3">
                  <CheckCircle className="text-green-500 mr-3" size={24} />
                  <div>
                    <div className="editorial-body font-semibold">System Active</div>
                    <div className="editorial-body text-sm text-gray-500">Check-in monitoring enabled</div>
                  </div>
                </div>
                <div className="flex items-center mb-4">
                  <Clock className="text-blue-500 mr-3" size={24} />
                  <div>
                    <div className="editorial-body font-semibold">Last Check-in</div>
                    <div className="editorial-body text-sm text-gray-500">{getTimeSinceLastCheckIn()}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
