'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Clock, Shield, Download, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { encryptFileWithCondition, DeadmanCondition, TraceJson } from './lib/taco';

export default function Home() {
  const [isActive, setIsActive] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [checkInInterval, setCheckInInterval] = useState('24'); // hours
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [traceJson, setTraceJson] = useState<TraceJson | null>(null);
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

      // Try to use real TACo encryption, fallback to mock data
      const { traceJson: newTraceJson } = await encryptFileWithCondition(
        uploadedFile,
        condition,
        description
      );
      
      setTraceJson(newTraceJson);
      
      // Add to activity log
      setActivityLog(prev => [
        { type: 'Capsule created', date: new Date().toLocaleString() },
        ...prev
      ]);
      
    } catch (error) {
      console.error('Error processing file:', error);
      
      // Fallback to mock data for demonstration
      const mockTraceJson: TraceJson = {
        payload_uri: `ipfs://QmX7Y8Z9A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U/${uploadedFile.name}`,
        taco_capsule_uri: 'taco://capsule-abc123def456ghi789jkl012mno345pqr678stu901vwx234yzab567cde890fgh123',
        condition: `No check-in for ${checkInInterval} hours`,
        description: description || `Encrypted file: ${uploadedFile.name}`,
        created_at: new Date().toISOString()
      };
      
      setTraceJson(mockTraceJson);
      
      setActivityLog(prev => [
        { type: 'Capsule created (demo mode)', date: new Date().toLocaleString() },
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
    <div className="min-h-screen bg-gray-50" style={{ zoom: '0.8' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="editorial-header text-3xl tracking-[0.2em]">CANARY</h1>
          <nav className="flex gap-8">
            <a href="#" className="editorial-body font-semibold hover:text-blue-600">Home</a>
            <a href="#" className="editorial-body font-semibold hover:text-blue-600">Triggers</a>
            <a href="#" className="editorial-body font-semibold hover:text-blue-600">Settings</a>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Main Controls */}
        <div className="text-center mb-12">
          {/* Master Switch & Check-in Controls */}
          <div className="flex justify-center items-stretch gap-12 mb-12">
            {/* Master Switch */}
            <div className="flex flex-col items-center">
              <div className="editorial-card text-center p-8 w-[280px] h-[200px] flex flex-col justify-between">
                <h3 className="editorial-subheader">Master Switch</h3>
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
                <div className="editorial-body text-sm">
                  System {isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>

            {/* Check-in Button */}
            <div className="flex flex-col items-center">
              <div className="editorial-card text-center p-8 w-[280px] h-[200px] flex flex-col justify-between">
                <h3 className="editorial-subheader">Safety Check-in</h3>
                <div className="flex flex-col items-center justify-center flex-1">
                  <button
                    onClick={handleCheckIn}
                    className="bg-slate-700 text-white hover:bg-slate-800 w-32 h-16 text-sm font-semibold rounded-lg transition-all duration-200 mb-4 flex items-center justify-center shadow-sm"
                  >
                    <CheckCircle className="inline mr-2" size={18} />
                    Check In Now
                  </button>
                </div>
                <div className="editorial-body text-sm">
                  Last: {getTimeSinceLastCheckIn()}
                </div>
              </div>
            </div>
          </div>

          {/* Condition Card */}
          <div className="flex justify-center mb-12">
            <div className="editorial-card text-center max-w-md">
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
              <h3 className="editorial-subheader mb-4">File Upload</h3>
              <div
                className="editorial-card border-dashed border-2 border-gray-300 text-center py-12 cursor-pointer hover:border-blue-400 transition-colors"
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
              <h3 className="editorial-subheader mb-4">Check-in Settings</h3>
              <div className="editorial-card space-y-4">
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
                  disabled={!uploadedFile || isProcessing}
                  className="editorial-button bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Creating Capsule...
                    </div>
                  ) : (
                    <>
                      <Shield className="inline mr-2" size={20} />
                      Create Encrypted Capsule
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Activity Log */}
            <div>
              <h3 className="editorial-subheader mb-4">Activity Log</h3>
              <div className="editorial-card space-y-3">
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
