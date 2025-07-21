'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Mic, Video, Square, Play, Pause, Download, X } from 'lucide-react';

interface MediaRecorderProps {
  onFileReady: (file: File) => void;
  onCancel?: () => void;
}

type RecordingMode = 'audio' | 'video' | null;
type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export default function MediaRecorder({ onFileReady, onCancel }: MediaRecorderProps) {
  const [mode, setMode] = useState<RecordingMode>(null);
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
    <div className="w-full max-w-2xl mx-auto editorial-card">
      {/* Mode Selection */}
      {!mode && (
        <div className="spacing-medium">
          <h3 className="editorial-header text-gray-900 dark:text-gray-100 text-center spacing-small">Choose Recording Type</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => startRecording('audio')}
              className="editorial-card-bordered hover:border-gray-900 dark:hover:border-gray-400 transition-all flex flex-col items-center gap-3 p-8"
            >
              <Mic className="w-8 h-8 text-blue-600" />
              <span className="editorial-body font-semibold text-gray-900 dark:text-gray-100">Voice Recording</span>
            </button>
            <button
              onClick={() => startRecording('video')}
              className="editorial-card-bordered hover:border-gray-900 dark:hover:border-gray-400 transition-all flex flex-col items-center gap-3 p-8"
            >
              <Video className="w-8 h-8 text-red-600" />
              <span className="editorial-body font-semibold text-gray-900 dark:text-gray-100">Video Recording</span>
            </button>
          </div>
        </div>
      )}

      {/* Recording Interface */}
      {mode && (
        <div className="spacing-medium">
          <div className="flex items-center justify-between spacing-small">
            <h3 className="editorial-header text-gray-900 dark:text-gray-100">
              {mode === 'audio' ? 'Voice' : 'Video'} Recording
            </h3>
            <button
              onClick={reset}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Cancel recording"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Preview Area */}
          <div className="bg-gray-100 dark:bg-gray-700 overflow-hidden spacing-medium">
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
                  <div className="spacing-medium">
                    <Mic className={`w-20 h-20 mx-auto spacing-small ${recordingState === 'recording' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
                    <p className="editorial-header-large monospace-accent text-gray-700 dark:text-gray-300 spacing-tiny">{formatDuration(recordingDuration)}</p>
                    <p className="editorial-body text-gray-500 dark:text-gray-400">
                      {recordingState === 'recording' ? 'Recording...' : recordingState === 'paused' ? 'Paused' : 'Ready'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 spacing-medium">
            {recordingState !== 'stopped' && (
              <>
                {recordingState === 'idle' && (
                  <button
                    onClick={() => startRecording(mode)}
                    className="editorial-button-primary flex items-center gap-2"
                    style={{ backgroundColor: '#DC2626', color: 'white' }}
                  >
                    <div className="w-3 h-3 bg-white rounded-full" />
                    Start Recording
                  </button>
                )}
                
                {(recordingState === 'recording' || recordingState === 'paused') && (
                  <>
                    <button
                      onClick={togglePauseResume}
                      className="editorial-button flex items-center gap-2"
                    >
                      {recordingState === 'recording' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {recordingState === 'recording' ? 'Pause' : 'Resume'}
                    </button>
                    
                    <button
                      onClick={stopRecording}
                      className="editorial-button flex items-center gap-2"
                      style={{ backgroundColor: '#DC2626', color: 'white' }}
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
                  className="editorial-button"
                >
                  Record Again
                </button>
                
                <button
                  onClick={saveRecording}
                  className="editorial-button-primary flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Use This Recording
                </button>
              </>
            )}
          </div>

          {/* Duration Display for Video */}
          {mode === 'video' && recordingState !== 'stopped' && (
            <div className="text-center spacing-small">
              <p className="editorial-header monospace-accent text-gray-700 dark:text-gray-300">{formatDuration(recordingDuration)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}