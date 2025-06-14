'use client';

import { useState, useRef } from 'react';
import { Upload, Clock, Shield, Download, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { encryptFileWithCondition, DeadmanCondition, TraceJson } from './lib/taco';

export default function Home() {
  const [isActive, setIsActive] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [condition, setCondition] = useState<DeadmanCondition>({ type: 'no_activity', duration: '5 DAYS' });
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [traceJson, setTraceJson] = useState<TraceJson | null>(null);
  const [activityLog, setActivityLog] = useState([
    { type: 'Check in confirmed', date: 'Apr 31, 2026, 16:01 AM' },
    { type: 'Pre-registeral nor-contact', date: 'Apr-32, 3093, 26:3 PM' },
    { type: 'Trigger created', date: 'Apr 13, 2021, 18:00 AM' }
  ]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const processDeadmanSwitch = async () => {
    if (!uploadedFile) return;
    
    setIsProcessing(true);
    
    try {
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
        condition: formatConditionText(condition),
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

  const formatConditionText = (condition: DeadmanCondition): string => {
    switch (condition.type) {
      case 'no_activity':
        return `No activity for ${condition.duration || '24 HOURS'}`;
      case 'no_checkin':
        return `No check-in from ${condition.timeWindow?.start || '11 AM'} to ${condition.timeWindow?.end || '1 PM'}`;
      case 'location':
        return `Location outside the ${condition.location || 'U.S.'} for ${condition.duration || '24 HOURS'}`;
      case 'keyword':
        return `Email containing ${condition.keyword || 'KEYWORD'}`;
      default:
        return `Conditional access: ${condition.duration || '24 HOURS'}`;
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

  const updateCondition = (field: string, value: string) => {
    setCondition(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="editorial-header text-3xl tracking-[0.2em]">DEAD MAN SWITCH</h1>
          <nav className="flex gap-8">
            <a href="#" className="editorial-body font-semibold hover:text-blue-600">Home</a>
            <a href="#" className="editorial-body font-semibold hover:text-blue-600">Triggers</a>
            <a href="#" className="editorial-body font-semibold hover:text-blue-600">Settings</a>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Main Title */}
        <div className="text-center mb-12">
          <h2 className="editorial-header text-4xl md:text-6xl mb-8 text-gray-800">
            Sophisticated journalistic<br />
            dead man switch app
          </h2>
          
          {/* Toggle Switch */}
          <div className="flex justify-center mb-12">
            <div className="relative">
              <button
                onClick={() => setIsActive(!isActive)}
                className={clsx(
                  "relative inline-flex h-20 w-40 items-center rounded-full transition-colors duration-300",
                  isActive ? "bg-slate-700" : "bg-gray-300"
                )}
              >
                <span
                  className={clsx(
                    "inline-block h-16 w-16 transform rounded-full bg-white transition-transform duration-300",
                    isActive ? "translate-x-20" : "translate-x-2"
                  )}
                />
                <span
                  className={clsx(
                    "absolute left-6 text-white font-playfair font-bold text-xl",
                    isActive ? "opacity-100" : "opacity-0"
                  )}
                >
                  ON
                </span>
              </button>
            </div>
          </div>

          {/* Condition Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <div className="editorial-card text-center">
              <div className="editorial-body mb-2">No activity</div>
              <div className="editorial-header text-2xl">for 5 DAYS</div>
            </div>
            <div className="editorial-card text-center">
              <div className="editorial-body mb-2">No check in from</div>
              <div className="editorial-header text-2xl">11 AM to 1 PM</div>
            </div>
            <div className="editorial-card text-center">
              <div className="editorial-body mb-2">Location outside the</div>
              <div className="editorial-header text-2xl">U.S. for 24 HOURS</div>
            </div>
            <div className="editorial-card text-center">
              <div className="editorial-body mb-2">Email canaiting</div>
              <div className="editorial-header text-2xl">KEYWORD</div>
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

            {/* Condition Setup */}
            <div>
              <h3 className="editorial-subheader mb-4">Dead Man Switch Condition</h3>
              <div className="editorial-card space-y-4">
                <select 
                  className="editorial-input"
                  value={condition.type}
                  onChange={(e) => setCondition({...condition, type: e.target.value as any})}
                >
                  <option value="no_activity">No Activity</option>
                  <option value="no_checkin">No Check-in</option>
                  <option value="location">Location-based</option>
                  <option value="keyword">Keyword Trigger</option>
                </select>
                
                {(condition.type === 'no_activity' || condition.type === 'location') && (
                  <input
                    type="text"
                    placeholder="Duration (e.g., 5 DAYS, 72 HOURS)"
                    className="editorial-input"
                    value={condition.duration || ''}
                    onChange={(e) => updateCondition('duration', e.target.value)}
                  />
                )}
                
                {condition.type === 'location' && (
                  <input
                    type="text"
                    placeholder="Location (e.g., U.S., Europe)"
                    className="editorial-input"
                    value={condition.location || ''}
                    onChange={(e) => updateCondition('location', e.target.value)}
                  />
                )}
                
                {condition.type === 'keyword' && (
                  <input
                    type="text"
                    placeholder="Keyword to trigger release"
                    className="editorial-input"
                    value={condition.keyword || ''}
                    onChange={(e) => updateCondition('keyword', e.target.value)}
                  />
                )}
                
                <textarea
                  placeholder="Description (optional)"
                  className="editorial-input h-24 resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                
                <button
                  onClick={processDeadmanSwitch}
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
                    <div className="editorial-body text-sm text-gray-500">All triggers monitoring</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <Clock className="text-blue-500 mr-3" size={24} />
                  <div>
                    <div className="editorial-body font-semibold">Last Check-in</div>
                    <div className="editorial-body text-sm text-gray-500">2 hours ago</div>
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
