# Voice and Video Recording Implementation in Canary Next.js App

## Executive Summary

The Canary application implements a comprehensive voice and video recording system that allows users to create media files directly within their browser and integrate them with encrypted dossiers. The system uses the Web Audio API and MediaRecorder API for capturing media, stores recordings as WebM files, and integrates seamlessly with the encryption and dossier management flow.

---

## 1. Architecture Overview

### Component Structure
- **MediaRecorder Component** (`/app/components/MediaRecorder.tsx`): Standalone reusable component for recording both audio and video
- **Home Page Integration** (`/app/page.tsx`): Orchestrates MediaRecorder with dossier creation workflow
- **TACo Service** (`/app/lib/taco.ts`): Handles encryption of recorded files

### Key Characteristics
- **Browser-based**: All recording happens client-side using native browser APIs
- **No external recording services**: Pure client-side Web API implementation
- **Integrated with encryption**: Recorded files can be encrypted and stored with dossier conditions
- **Theme support**: Responsive UI with light/dark theme support

---

## 2. Dossier Creation Flow with Recording

### Step-by-Step User Flow

```
1. User clicks "Create New Document" → Opens dossier creation wizard
2. Steps 1-3: Configure name, description, visibility, and check-in interval
3. Step 4: ENCRYPTION STEP - User adds files
   ├─ Option A: Upload traditional files via file picker or drag-drop
   ├─ Option B: Record voice message → Creates audio file
   └─ Option C: Record video message → Creates video file
4. Files added to uploadedFiles array
5. Step 5: FINALIZE - Review and submit
6. Encryption: Each file encrypted with dossier contract condition
7. Storage: Encrypted files committed to IPFS/Pinata
8. Contract: Dossier metadata stored on blockchain
```

### Recording Flow Integration (Step 4)
```
User clicks "Voice Recording" or "Video Recording"
    ↓
MediaRecorder modal opens with theme-aware UI
    ↓
User grants microphone/camera permissions (browser native)
    ↓
MediaRecorder component handles recording lifecycle
    ↓
User clicks "Stop" → Preview recording
    ↓
User clicks "Use This Recording" → onFileReady callback fires
    ↓
File added to uploadedFiles array
    ↓
Modal closes, file appears in file list
    ↓
User continues with encryption/submission
```

---

## 3. MediaRecorder Component Deep Dive

### File Location
`/Users/k/Git/canary/app/components/MediaRecorder.tsx`

### Component Props
```typescript
interface MediaRecorderProps {
  onFileReady: (file: File) => void;      // Callback when recording is saved
  onCancel?: () => void;                   // Callback when modal is closed
  initialMode?: 'audio' | 'video';         // Auto-start recording in this mode
  theme?: string;                          // 'light' or 'dark' for UI theming
}
```

### Internal State Management
```typescript
const [mode, setMode] = useState<RecordingMode>(initialMode || null);
const [recordingState, setRecordingState] = useState<RecordingState>('idle' | 'recording' | 'paused' | 'stopped');
const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
const [recordingDuration, setRecordingDuration] = useState(0);
const [isPlaying, setIsPlaying] = useState(false);
```

### Ref Management
```typescript
const mediaRecorderRef = useRef<MediaRecorder | null>(null);  // Browser MediaRecorder API
const streamRef = useRef<MediaStream | null>(null);           // Active media stream
const chunksRef = useRef<Blob[]>([]);                         // Recorded data chunks
const videoPreviewRef = useRef<HTMLVideoElement>(null);       // Video preview element
const audioPreviewRef = useRef<HTMLAudioElement>(null);       // Audio preview element
const durationIntervalRef = useRef<NodeJS.Timeout | null>(null); // Duration timer
```

---

## 4. Recording Capture Details

### Audio Recording

**Constraints:**
```typescript
const constraints = {
  audio: true,
  video: false
}
```

**MIME Type:**
```
audio/webm;codecs=opus
```

**Codec Details:**
- Container: WebM
- Audio Codec: Opus (advanced lossy audio codec optimized for speech)
- Bitrate: Browser-dependent (typically 128kbps)

### Video Recording

**Constraints:**
```typescript
const constraints = {
  audio: true,
  video: {
    width: 1280,
    height: 720
  }
}
```

**MIME Type:**
```
video/webm;codecs=vp9,opus
```

**Codec Details:**
- Container: WebM
- Video Codec: VP9 (modern open-source video codec)
- Audio Codec: Opus
- Resolution: 1280x720 (HD)
- Frame rate: Browser-dependent (typically 30fps)

### Recording Process

```typescript
// 1. Get user media stream
const stream = await navigator.mediaDevices.getUserMedia(constraints);

// 2. Show preview (for video mode)
if (selectedMode === 'video' && videoPreviewRef.current) {
  videoPreviewRef.current.srcObject = stream;
  videoPreviewRef.current.muted = true;
  await videoPreviewRef.current.play();
}

// 3. Create MediaRecorder instance
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: isTypeSupported ? mimeType : undefined
});

// 4. Collect data chunks as recording happens
mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    chunksRef.current.push(event.data);
  }
};

// 5. On stop, assemble blob from chunks
mediaRecorder.onstop = () => {
  const blob = new Blob(chunksRef.current, {
    type: selectedMode === 'audio' ? 'audio/webm' : 'video/webm'
  });
  setRecordedBlob(blob);
  setRecordingState('stopped');
};

// 6. Start recording and duration timer
mediaRecorder.start();
setRecordingState('recording');
durationIntervalRef.current = setInterval(() => {
  setRecordingDuration(prev => prev + 1);
}, 1000);
```

---

## 5. Recording UI/UX Components

### Mode Selection Screen
```
┌─────────────────────────────────────┐
│      Choose Recording Type          │
├──────────────┬──────────────────────┤
│   🎤 Voice   │   📹 Video Recording │
│ Recording    │                      │
└──────────────┴──────────────────────┘
```

### Recording Interface

**Audio Mode Recording:**
```
┌───────────────────────────────────────┐
│  Voice Recording              [X]    │
├───────────────────────────────────────┤
│                                       │
│            🎤 (pulsing red)          │
│                                       │
│            00:45                     │
│         Recording...                  │
│                                       │
├───────────────────────────────────────┤
│  [Pause]  [Stop]                     │
└───────────────────────────────────────┘
```

**Video Mode Recording:**
```
┌───────────────────────────────────────┐
│  Video Recording              [X]    │
├───────────────────────────────────────┤
│                                       │
│   [Live video preview from camera]   │
│                                       │
│            02:15                     │
│                                       │
├───────────────────────────────────────┤
│  [Pause]  [Stop]                     │
└───────────────────────────────────────┘
```

**Recording Controls:**
- **Start Recording Button**: Red button with record indicator (white dot)
- **Pause Button**: Gray button - pauses recording, stops duration timer
- **Resume Button**: Gray button - resumes from pause
- **Stop Button**: Red button - stops recording, triggers blob creation

**Stopped State (Preview):**
```
┌───────────────────────────────────────┐
│  Voice Recording              [X]    │
├───────────────────────────────────────┤
│                                       │
│   <audio controls />                 │
│   (shows play/pause and duration)    │
│                                       │
├───────────────────────────────────────┤
│  [Record Again]  [Use This Recording] │
└───────────────────────────────────────┘
```

### Preview/Playback System

**Audio Preview:**
```html
<audio ref={audioPreviewRef} controls className="w-full" />
```

**Video Preview:**
```html
<video
  ref={videoPreviewRef}
  className="w-full h-[400px] object-contain bg-black"
  controls={recordingState === 'stopped'}
/>
```

**Duration Display:**
- Real-time: Shows MM:SS format (e.g., "00:45")
- Updated every second during recording
- Persists during pause (timer stops)
- Format: `formatDuration(seconds)` → `MM:SS`

---

## 6. File Creation and Storage

### File Creation on Save

```typescript
const saveRecording = useCallback(() => {
  if (!recordedBlob || !mode) {
    console.error('Cannot save recording: recordedBlob or mode is missing');
    return;
  }
  
  // Create filename with timestamp
  const fileName = `${mode === 'audio' ? 'voice' : 'video'}_recording_${Date.now()}.webm`;
  
  // Create File object from blob
  const file = new File([recordedBlob], fileName, {
    type: recordedBlob.type,                    // 'audio/webm' or 'video/webm'
    lastModified: Date.now()
  });
  
  console.log('Saving recording:', {
    fileName,
    size: file.size,
    type: file.type
  });
  
  // Trigger callback to parent component
  onFileReady(file);
}, [recordedBlob, mode, onFileReady]);
```

### File Naming Convention
- **Voice Recording**: `voice_recording_1730627424123.webm`
- **Video Recording**: `video_recording_1730627424456.webm`
- Timestamp ensures uniqueness (milliseconds since epoch)
- Always .webm extension

### File Object Properties
```typescript
{
  name: string;              // e.g., "voice_recording_1730627424123.webm"
  size: number;              // Blob size in bytes
  type: "audio/webm" | "video/webm";
  lastModified: number;      // Timestamp of creation
  // Blob methods available:
  slice(), stream(), text(), arrayBuffer()
}
```

---

## 7. Integration with Dossier Creation

### Modal Integration in Page.tsx

**Location in Component Tree:**
```typescript
// Line 190-191: State for media recorder
const [showMediaRecorder, setShowMediaRecorder] = useState(false);
const [mediaRecorderType, setMediaRecorderType] = useState<'voice' | 'video'>('voice');

// Line 5687-5725: Recording buttons in Step 4
<button onClick={() => {
  setMediaRecorderType('voice');
  setShowMediaRecorder(true);
}}>
  <Mic className="w-6 h-6 text-blue-600" />
  Voice Recording
</button>

<button onClick={() => {
  setMediaRecorderType('video');
  setShowMediaRecorder(true);
}}>
  <Video className="w-6 h-6 text-red-600" />
  Video Recording
</button>

// Line 5827-5857: Modal container
{showMediaRecorder && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
    <div className={`relative z-10 w-full max-w-2xl mx-6 p-6 rounded-2xl`}>
      <MediaRecorder
        initialMode={mediaRecorderType === 'voice' ? 'audio' : 'video'}
        onFileReady={(file: File) => {
          setUploadedFiles(prev => [...prev, file]);  // Add to file list
          if (!uploadedFile) {
            setUploadedFile(file);
          }
          setShowMediaRecorder(false);  // Close modal
        }}
        onCancel={() => setShowMediaRecorder(false)}
        theme={theme}
      />
    </div>
  </div>
)}
```

### File List Management

**After Recording:**
```typescript
setUploadedFiles(prev => [...prev, file]);
```

**File Display (Line 5581-5678):**
```typescript
{uploadedFiles.length > 0 && (
  <div className="space-y-3">
    {uploadedFiles.map((file, index) => (
      <div key={index} className={`flex items-center justify-between p-3 rounded-lg`}>
        <div>
          <p className="font-medium">{file.name}</p>
          <p className="text-sm text-gray-500">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
        <button onClick={() => {
          setUploadedFiles(prev => prev.filter((_, i) => i !== index));
          if (uploadedFiles.length === 1) {
            setUploadedFile(null);
          }
        }}>
          <X className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
)}
```

---

## 8. Encryption Integration

### File Encryption Pipeline

```
Recorded File (File object)
        ↓
encryptFileWithDossier(file, condition, ...)
        ↓
TacoService.encryptFile()
        ↓
Converts file to Uint8Array
        ↓
Applies TACo encryption with Dossier contract condition
        ↓
Returns EncryptionResult:
  {
    messageKit: any,                    // Encrypted capsule
    encryptedData: Uint8Array,
    originalFileName: string,           // e.g., "voice_recording_1730627424123.webm"
    condition: DeadmanCondition,
    description: string,
    capsuleUri: string
  }
        ↓
commitEncryptedFileToPinata()
        ↓
Upload to IPFS/Pinata
        ↓
Create TraceJson metadata
        ↓
Contract storage via blockchain
```

### Encryption Function (Line 411-421 of taco.ts)

```typescript
export async function encryptFileWithDossier(
  file: File,                                    // Recorded file
  condition: DeadmanCondition,                   // "no_checkin" type
  description: string = '',                      // Optional description
  dossierId: bigint,                             // Dossier identifier
  userAddress: string,                           // User's wallet address
  walletProvider?: any,                          // Privy or Web3 provider
  burnerWallet?: any                             // Local wallet instance
): Promise<EncryptionResult> {
  return await tacoService.encryptFile(
    file,
    condition,
    description,
    dossierId,
    userAddress,
    walletProvider,
    burnerWallet
  );
}
```

### Condition Details (Line 523-528 of page.tsx)

```typescript
const condition: DeadmanCondition = {
  type: "no_checkin",
  duration: `${checkInInterval} MINUTES`,      // e.g., "1440 MINUTES" for 1 day
  dossierId: nextDossierId,                    // BigInt ID from contract
  userAddress: queryAddress,                   // User's signing address
};
```

### Contract Verification (TACo nodes verify)

```typescript
// The encryption uses ContractCondition that calls:
{
  contractAddress: CANARY_DOSSIER_ADDRESS,
  chain: Status Sepolia Chain ID,
  method: 'shouldDossierStayEncrypted',
  parameters: [userAddress, dossierId.toString()],
  returnValueTest: {
    comparator: '==',
    value: false  // Decryption allowed when function returns false
  }
}
```

---

## 9. Storage Details

### Encrypted File Storage

**Storage Backends (in order of priority):**
1. **Codex** - Decentralized file storage
2. **Pinata** - IPFS pinning service
3. **Local IPFS** - Fallback

**Metadata Storage:**
```typescript
interface TraceJson {
  payload_uri: string;                          // e.g., "ipfs://QmXxxx"
  taco_capsule_uri: string;                     // TACo capsule reference
  condition: string;                            // Readable condition text
  description: string;                          // File description
  storage_type: 'codex' | 'ipfs' | 'pinata';
  created_at: string;                           // ISO timestamp
  
  // Dossier integration fields:
  dossier_id: string;                           // Dossier number
  user_address: string;                         // User's address
  contract_address: string;                     // Dossier contract address
  original_filename: string;                    // e.g., "voice_recording_1730627424123.webm"
}
```

**Example TraceJson for Voice Recording:**
```json
{
  "payload_uri": "ipfs://QmVoiceRecordingHash123",
  "taco_capsule_uri": "taco://dossier-42-1730627424123",
  "condition": "Dossier #42 contract verification (1440 MINUTES)",
  "description": "Voice message",
  "storage_type": "pinata",
  "created_at": "2024-11-03T15:30:24.123Z",
  "dossier_id": "42",
  "user_address": "0x1234567890abcdef...",
  "contract_address": "0xCanaryDossierAddress...",
  "original_filename": "voice_recording_1730627424123.webm"
}
```

### Blockchain Storage

**Dossier Contract Stores:**
- Dossier ID
- Creator address
- Name and description
- Visibility (public/private)
- Check-in interval
- Last check-in timestamp
- File reference (TraceJson)
- Active/expired status

---

## 10. Permission Handling

### Browser Permissions

**Audio Recording:**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: false
});
// Browser prompts: "Canary wants to use your microphone"
```

**Video Recording:**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: { width: 1280, height: 720 }
});
// Browser prompts: "Canary wants to use your camera and microphone"
```

**Error Handling:**
```typescript
try {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
} catch (error) {
  console.error('Error starting recording:', error);
  alert('Failed to start recording. Please ensure you have granted microphone/camera permissions.');
}
```

### Permission States
- **Granted**: Recording can proceed
- **Denied**: Alert shown, recording disabled
- **Not Prompted Yet**: Browser shows permission dialog on first use
- **Revoked**: User can re-grant in browser settings

---

## 11. Media Cleanup and Resource Management

### Stream Cleanup

```typescript
// On stop recording:
if (streamRef.current) {
  streamRef.current.getTracks().forEach(track => track.stop());
  streamRef.current = null;
}

// On component unmount:
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
```

### Preview URL Management

```typescript
// When recording completes:
useEffect(() => {
  if (recordedBlob && mode) {
    const url = URL.createObjectURL(recordedBlob);
    
    if (mode === 'audio' && audioPreviewRef.current) {
      audioPreviewRef.current.src = url;
    } else if (mode === 'video' && videoPreviewRef.current) {
      videoPreviewRef.current.src = url;
      videoPreviewRef.current.muted = false;
    }
    
    // Cleanup on unmount
    return () => URL.revokeObjectURL(url);
  }
}, [recordedBlob, mode]);
```

---

## 12. Complete User Flow Example

### Voice Message Creation Flow

```
1. User on Step 4 (Encryption) of dossier creation
2. Clicks "Voice Recording" button
3. Browser prompts: "Allow Canary to access your microphone?"
4. User clicks "Allow"
5. MediaRecorder modal opens
   - Shows "Choose Recording Type"
   - Has two buttons: "Voice Recording" and "Video Recording"
6. Voice Recording button already triggered auto-start
7. MediaRecorder component state:
   - mode = 'audio'
   - recordingState = 'recording'
   - Duration timer starts counting: 00:01, 00:02, ...
8. User speaks message for 45 seconds
9. User clicks "Stop" button
10. Recording stops, duration timer stops: 00:45
11. recordedBlob created from audio chunks
12. Preview audio element shows with play/pause controls
13. User clicks "Use This Recording"
14. onFileReady callback fires:
    - File object created: {
        name: "voice_recording_1730627424123.webm",
        type: "audio/webm",
        size: 87520,
        lastModified: 1730627424123
      }
    - Added to uploadedFiles array
    - Modal closes
15. Back in dossier form, file visible in list:
    - Filename: "voice_recording_1730627424123.webm"
    - Size: "0.08 MB"
    - Delete button available
16. User continues with other files or proceeds to Step 5 (Finalize)
17. On submission:
    - File encrypted with dossier contract condition
    - Encrypted bytes uploaded to IPFS/Pinata
    - TraceJson created with metadata
    - Dossier stored on blockchain with file reference
18. Voice recording is now part of encrypted dossier
    - Only accessible when dossier condition allows decryption
    - Check-in must happen on schedule to keep encrypted
    - Auto-releases if check-in fails (dead man's switch)
```

### Video Message Creation Flow

```
Same as voice, but:
- Requests both microphone AND camera permissions
- Shows live video preview during recording
- Captures both video (VP9) and audio (Opus)
- File size typically larger (HD 720p video)
- Preview shows video player with controls
- Filename: "video_recording_1730627424456.webm"
```

---

## 13. Key Features Summary

### Supported Features
- ✓ Real-time audio recording (voice messages)
- ✓ Real-time video recording (video messages)
- ✓ Live preview during video recording
- ✓ Recording pause/resume capability
- ✓ Preview playback after recording
- ✓ Duration tracking (MM:SS format)
- ✓ Multiple file support (upload + record)
- ✓ Dark/light theme support
- ✓ Full encryption integration
- ✓ Blockchain dossier integration
- ✓ IPFS/Pinata storage
- ✓ Permission handling
- ✓ Resource cleanup on unmount
- ✓ Modal workflow integration
- ✓ File list management with deletion
- ✓ Responsive UI (mobile-friendly)

### Limitations/Constraints
- WebM format only (no MP4, WAV, etc.)
- Browser-dependent codec support (fallback for unsupported browsers)
- Requires browser MediaRecorder API support
- Requires browser getUserMedia API support
- Video limited to 1280x720 resolution
- No server-side recording limits enforced (client only)
- Single recording at a time (sequential)
- Live preview only for video (audio uses waveform icon)

---

## 14. File References

### Component Files
```
/Users/k/Git/canary/app/components/MediaRecorder.tsx    [413 lines]
```

### Integration Files
```
/Users/k/Git/canary/app/page.tsx                         [~8000+ lines]
  - Lines 190-191: MediaRecorder state
  - Lines 5687-5725: Recording buttons in UI
  - Lines 5827-5857: MediaRecorder modal
  - Lines 5843-5844: onFileReady callback
```

### Encryption/Storage Files
```
/Users/k/Git/canary/app/lib/taco.ts                      [443 lines]
  - Lines 411-421: encryptFileWithDossier function
  - Lines 121-206: TacoService.encryptFile method
  - Lines 365-401: TraceJson creation

/Users/k/Git/canary/app/lib/mime-types.ts                [142 lines]
  - Audio MIME types (line 27-34)
  - Video MIME types (line 16-25)
  - getMimeType function (line 89-97)

/Users/k/Git/canary/app/lib/pinata.ts
/Users/k/Git/canary/app/lib/ipfs.ts
/Users/k/Git/canary/app/lib/codex.ts
```

### Contract/Chain Files
```
/Users/k/Git/canary/app/lib/contract.ts
/Users/k/Git/canary/app/lib/chains/status.ts
```

---

## 15. Technical Stack

### APIs Used
- **Browser MediaRecorder API** - Core recording functionality
- **Web Audio API** - Implicit (via MediaRecorder)
- **getUserMedia API** - Device access (camera/microphone)
- **Blob/File APIs** - File handling
- **URL.createObjectURL** - Preview generation
- **TACo (@nucypher/taco)** - Encryption with threshold cryptography
- **ethers.js** - Blockchain interaction
- **Privy SDK** - Account abstraction
- **Wagmi** - Web3 wallet integration

### Libraries
```json
{
  "@nucypher/taco": "^x.x.x",
  "ethers": "^5.x or ^6.x",
  "@privy-io/react-auth": "^x.x.x",
  "@privy-io/wagmi": "^x.x.x",
  "wagmi": "^x.x.x",
  "react": "^18.x",
  "lucide-react": "^x.x.x",  // Icons
  "react-hot-toast": "^x.x.x"  // Notifications
}
```

### Codecs Used
| Type | Codec | Standard | Browser Support |
|------|-------|----------|-----------------|
| Audio | Opus | RFC 6716 | Modern browsers |
| Video | VP9 | WebM spec | Chrome, Firefox, Edge |
| Container | WebM | VP8/VP9 | All modern browsers |

---

## 16. Security Considerations

### Data Privacy
- All recording happens in browser (not sent until encryption)
- Recordings encrypted client-side using TACo
- Encrypted files stored on IPFS/Pinata (content-addressed, immutable)
- Decryption controlled by dossier contract conditions
- Dead man's switch: auto-release if no check-ins

### Permission Model
- User explicitly grants microphone/camera permissions
- Permissions tied to browser origin
- Can be revoked anytime in browser settings
- Permissions NOT requested until recording button clicked

### Encryption Model
```
Recording File → TACo Encryption → Encrypted Blob
                      ↓
                 Contract Condition
                 (shouldDossierStayEncrypted)
                      ↓
                Can only decrypt when:
                - Function returns false
                - User authorized by dossier contract
                - OR dossier expires (dead man's switch)
```

---

## 17. Performance Notes

### Browser Resource Usage
- **Memory**: WebM chunks held in memory (cleared on save)
- **CPU**: Encoding to WebM codec (browser-native, hardware accelerated)
- **Network**: Only used during upload/encryption (not recording)
- **Storage**: Temporary blob storage (cleared on unmount)

### File Size Estimates
- **Audio**: ~2-3 MB per minute (Opus codec, 128kbps)
- **Video**: ~15-25 MB per minute (VP9 720p, 2-3Mbps)
- **Recording**: Limited by available browser memory (typically 1-2GB available)

### Optimization
- Chunk-based recording (data pushed to browser in real-time)
- Lazy blob assembly (only on stop)
- Preview URLs revoked after use
- Stream tracks stopped to free resources
- Timers cleared on unmount

---

## 18. Browser Compatibility

### Required APIs
- MediaRecorder API (Chrome 49+, Firefox 25+, Safari 14.1+, Edge 79+)
- getUserMedia API (Chrome 21+, Firefox 17+, Safari 11+, Edge 12+)
- Blob/File APIs (All modern browsers)
- Promise/async-await support (ES2017+)

### Optional Features
- VideoTrack processing (requires advanced codec support)
- AudioTrack processing (requires AudioContext)

### Known Limitations
- WebM container format not supported on Safari (MacOS) < 17.4
  - Fallback to browser default MIME type
- Some older browsers may not support VP9 codec
  - Falls back to browser default codec

---

## 19. Error Handling

### User Permission Denied
```
User denies microphone/camera access
        ↓
navigator.mediaDevices.getUserMedia() rejects
        ↓
catch (error) block catches it
        ↓
Alert: "Failed to start recording. Please ensure you have 
        granted microphone/camera permissions."
        ↓
Recording aborted
```

### Browser Not Supported
```
MediaRecorder API not available
        ↓
if (!window.MediaRecorder) throw Error
        ↓
Alert: "MediaRecorder is not supported in this browser"
        ↓
Recording aborted
```

### File Save Failure
```
No recordedBlob or mode available
        ↓
console.error logged
        ↓
onFileReady not called
        ↓
Modal stays open for user to try again
```

---

## 20. Example Code Snippets

### Starting a Voice Recording
```typescript
// Component usage
<MediaRecorder
  initialMode="audio"
  onFileReady={(file) => {
    console.log('Recording saved:', file.name, file.size);
    setUploadedFiles(prev => [...prev, file]);
  }}
  onCancel={() => console.log('Recording cancelled')}
  theme="light"
/>
```

### Processing Recorded File for Encryption
```typescript
// In page.tsx, from onFileReady callback
const recordedFile = file; // e.g., "voice_recording_1730627424123.webm"

const condition: DeadmanCondition = {
  type: "no_checkin",
  duration: "1440 MINUTES",  // 24 hours
  dossierId: nextDossierId,  // BigInt
  userAddress: currentAddress,
};

const encryptionResult = await encryptFileWithDossier(
  recordedFile,              // File object from MediaRecorder
  condition,                 // Dossier condition
  "Voice message",           // Description
  nextDossierId,             // Dossier ID
  currentAddress,            // User address
  walletProvider,            // Privy or Web3 provider
  burnerWalletInstance       // Optional burner wallet
);

// encryptionResult contains:
// - messageKit: Encrypted TACo capsule
// - encryptedData: Uint8Array of encrypted bytes
// - originalFileName: "voice_recording_1730627424123.webm"
// - condition: Enhanced with dossierId and userAddress
// - capsuleUri: Unique reference for decryption
```

### Publishing Recording to IPFS
```typescript
const { commitResult, traceJson } = await commitEncryptedFileToPinata(
  encryptionResult
);

// commitResult contains:
// - payloadUri: "ipfs://QmXxxxx" (IPFS hash)
// - storageType: "pinata"
// - pinataUploadResult: Upload details

// traceJson contains:
// - payload_uri: IPFS location
// - taco_capsule_uri: Encryption capsule reference
// - dossier_id: "42"
// - user_address: "0x1234..."
// - original_filename: "voice_recording_1730627424123.webm"
// - created_at: ISO timestamp
```

---

## 21. Testing Considerations

### Unit Test Scenarios
1. Recording state transitions (idle → recording → paused → stopped)
2. Duration tracking accuracy
3. File creation with correct naming
4. Preview playback functionality
5. Resource cleanup on unmount
6. Permission error handling

### Integration Test Scenarios
1. Recording flow in dossier creation wizard
2. Multiple file uploads with recordings
3. Encryption of recorded files
4. Storage and retrieval from IPFS
5. Decryption with dossier conditions
6. Cross-browser codec support

### Manual Testing Checklist
- [ ] Voice recording with microphone permission dialog
- [ ] Video recording with camera permission dialog
- [ ] Pause/resume recording
- [ ] Recording duration counter
- [ ] Preview playback after recording
- [ ] Delete recorded file from list
- [ ] Record multiple files in sequence
- [ ] File appears in encryption step
- [ ] Recorded file encrypts successfully
- [ ] Encrypted file appears in dossier
- [ ] Test on mobile device (permissions, UI)
- [ ] Test in dark theme
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)

---

## Summary

The Canary application implements a sophisticated voice and video recording system that seamlessly integrates with its encrypted dossier infrastructure. The system:

1. **Captures media** directly in the browser using native Web APIs
2. **Stores recordings** as WebM files with high-quality codecs (Opus audio, VP9 video)
3. **Integrates with workflow** through a modal interface in the dossier creation step
4. **Encrypts files** using TACo threshold cryptography with dossier contract conditions
5. **Stores encrypted data** on IPFS/Pinata with full blockchain reference
6. **Controls access** through dossier contract verification and dead man's switch mechanics
7. **Maintains privacy** with client-side encryption and no server-side storage of unencrypted data

The implementation is production-ready with proper error handling, resource cleanup, theme support, and browser compatibility considerations.

