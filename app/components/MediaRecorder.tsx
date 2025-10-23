'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Mic, Video, Square, Play, Pause, Download, X } from 'lucide-react';

interface MediaRecorderProps {
  onFileReady: (file: File) => void;
  onCancel?: () => void;
  initialMode?: 'audio' | 'video';
  theme?: string;
}

type RecordingMode = 'audio' | 'video' | null;
type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export default function MediaRecorder({ onFileReady, onCancel, initialMode, theme = 'light' }: MediaRecorderProps) {
  const [mode, setMode] = useState<RecordingMode>(initialMode || null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  // Start recording
  const startRecording = useCallback(async (selectedMode: RecordingMode) => {
    try {
      if (!selectedMode) return;
      
      setMode(selectedMode);
      chunksRef.current = [];
      
      const constraints = selectedMode === 'audio' 
        ? { audio: true, video: false }
        : { audio: true, video: { width: 1280, height: 720 } };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Show video preview if recording video
      if (selectedMode === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true;
        await videoPreviewRef.current.play();
      }
      
      const mimeType = selectedMode === 'audio' 
        ? 'audio/webm;codecs=opus' 
        : 'video/webm;codecs=vp9,opus';
      
      // Check if the browser supports MediaRecorder
      const MediaRecorderClass = window.MediaRecorder;
      if (!MediaRecorderClass) {
        throw new Error('MediaRecorder is not supported in this browser');
      }
      
      const mediaRecorder = new MediaRecorderClass(stream, {
        mimeType: MediaRecorderClass.isTypeSupported && MediaRecorderClass.isTypeSupported(mimeType) ? mimeType : undefined
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { 
          type: selectedMode === 'audio' ? 'audio/webm' : 'video/webm' 
        });
        setRecordedBlob(blob);
        setRecordingState('stopped');
        
        // Clean up preview
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecordingState('recording');
      
      // Start duration timer
      setRecordingDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please ensure you have granted microphone/camera permissions.');
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Clear duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, []);

  // Toggle pause/resume
  const togglePauseResume = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    
    if (recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      
      // Pause duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    } else if (recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      
      // Resume duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
  }, [recordingState]);

  // Play/pause preview
  const togglePlayback = useCallback(() => {
    const mediaElement = mode === 'audio' ? audioPreviewRef.current : videoPreviewRef.current;
    if (!mediaElement) return;
    
    if (isPlaying) {
      mediaElement.pause();
    } else {
      mediaElement.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, mode]);

  // Save recording
  const saveRecording = useCallback(() => {
    if (!recordedBlob || !mode) {
      console.error('Cannot save recording: recordedBlob or mode is missing', { recordedBlob, mode });
      return;
    }
    
    const fileName = `${mode === 'audio' ? 'voice' : 'video'}_recording_${Date.now()}.webm`;
    const file = new File([recordedBlob], fileName, { 
      type: recordedBlob.type,
      lastModified: Date.now()
    });
    
    console.log('Saving recording:', { fileName, size: file.size, type: file.type });
    onFileReady(file);
  }, [recordedBlob, mode, onFileReady]);

  // Reset component
  const reset = useCallback(() => {
    stopRecording();
    setMode(null);
    setRecordingState('idle');
    setRecordedBlob(null);
    setRecordingDuration(0);
    setIsPlaying(false);
    
    if (onCancel) {
      onCancel();
    }
  }, [stopRecording, onCancel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Auto-start recording if initial mode is provided
  useEffect(() => {
    if (initialMode) {
      startRecording(initialMode);
    }
  }, [initialMode, startRecording]);

  // Update preview when blob changes
  useEffect(() => {
    if (recordedBlob && mode) {
      const url = URL.createObjectURL(recordedBlob);
      
      if (mode === 'audio' && audioPreviewRef.current) {
        audioPreviewRef.current.src = url;
      } else if (mode === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.src = url;
        videoPreviewRef.current.muted = false;
      }
      
      return () => URL.revokeObjectURL(url);
    }
  }, [recordedBlob, mode]);

  return (
    <div className="w-full">
      {/* Mode Selection */}
      {!mode && (
        <div>
          <h2 className={`text-lg font-semibold mb-4 ${
            theme === 'light' ? 'text-gray-900' : 'text-gray-100'
          }`}>
            Choose Recording Type
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => startRecording('audio')}
              className={`border rounded-lg p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex flex-col items-center gap-3 ${
                theme === 'light'
                  ? 'border-gray-300 hover:border-gray-400'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <Mic className="w-8 h-8 text-[#e53e3e]" />
              <span className={`font-medium ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}>Voice Recording</span>
            </button>
            <button
              onClick={() => startRecording('video')}
              className={`border rounded-lg p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex flex-col items-center gap-3 ${
                theme === 'light'
                  ? 'border-gray-300 hover:border-gray-400'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <Video className="w-8 h-8 text-[#e53e3e]" />
              <span className={`font-medium ${
                theme === 'light' ? 'text-gray-900' : 'text-gray-100'
              }`}>Video Recording</span>
            </button>
          </div>
        </div>
      )}

      {/* Recording Interface */}
      {mode && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${
              theme === 'light' ? 'text-gray-900' : 'text-gray-100'
            }`}>
              {mode === 'audio' ? 'Voice' : 'Video'} Recording
            </h2>
            <button
              onClick={reset}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'light'
                  ? 'hover:bg-gray-100 text-gray-600'
                  : 'hover:bg-gray-800 text-gray-400'
              }`}
              title="Cancel recording"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preview Area */}
          <div className={`rounded-lg overflow-hidden mb-6 ${
            theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'
          }`}>
            {mode === 'video' && (
              <video
                ref={videoPreviewRef}
                className="w-full h-[400px] object-contain bg-black"
                controls={recordingState === 'stopped'}
              />
            )}
            
            {mode === 'audio' && (
              <div className="p-12 text-center">
                {recordingState === 'stopped' ? (
                  <audio
                    ref={audioPreviewRef}
                    controls
                    className="w-full"
                  />
                ) : (
                  <div>
                    <Mic className={`w-20 h-20 mx-auto mb-4 ${
                      recordingState === 'recording' ? 'text-[#e53e3e] animate-pulse' : 'text-gray-400'
                    }`} />
                    <p className={`text-3xl font-mono font-bold mb-2 ${
                      theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                    }`}>{formatDuration(recordingDuration)}</p>
                    <p className={`text-sm ${
                      theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      {recordingState === 'recording' ? 'Recording...' : recordingState === 'paused' ? 'Paused' : 'Ready'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-3">
            {recordingState !== 'stopped' && (
              <>
                {recordingState === 'idle' && (
                  <button
                    onClick={() => startRecording(mode)}
                    className="px-4 py-2.5 bg-[#e53e3e] text-white rounded-lg font-medium hover:bg-[#d32e2e] transition-colors flex items-center gap-2"
                  >
                    <div className="w-3 h-3 bg-white rounded-full" />
                    Start Recording
                  </button>
                )}

                {(recordingState === 'recording' || recordingState === 'paused') && (
                  <>
                    <button
                      onClick={togglePauseResume}
                      className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        theme === 'light'
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {recordingState === 'recording' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {recordingState === 'recording' ? 'Pause' : 'Resume'}
                    </button>

                    <button
                      onClick={stopRecording}
                      className="px-4 py-2.5 bg-[#e53e3e] text-white rounded-lg font-medium hover:bg-[#d32e2e] transition-colors flex items-center gap-2"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  </>
                )}
              </>
            )}

            {recordingState === 'stopped' && recordedBlob && (
              <>
                <button
                  onClick={reset}
                  className={`px-4 py-2.5 rounded-lg font-medium transition-colors border ${
                    theme === 'light'
                      ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  Record Again
                </button>

                <button
                  onClick={saveRecording}
                  className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    theme === 'light'
                      ? 'bg-gray-900 text-white hover:bg-black'
                      : 'bg-white text-black hover:bg-gray-100'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Use This Recording
                </button>
              </>
            )}
          </div>

          {/* Duration Display for Video */}
          {mode === 'video' && recordingState !== 'stopped' && (
            <div className="text-center mt-4">
              <p className={`text-lg font-mono font-bold ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>{formatDuration(recordingDuration)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}