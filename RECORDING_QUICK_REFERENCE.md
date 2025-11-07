# Voice & Video Recording - Quick Reference Guide

## Quick Navigation

| Topic | Location | Lines |
|-------|----------|-------|
| MediaRecorder Component | `/app/components/MediaRecorder.tsx` | 1-413 |
| Integration in Home Page | `/app/page.tsx` | 190-191, 5687-5857 |
| Encryption Service | `/app/lib/taco.ts` | 411-421 |
| File Metadata | `/app/lib/mime-types.ts` | 16-34 (audio/video) |

---

## Recording Types

### Audio Recording
```typescript
Type: audio/webm;codecs=opus
Codec: Opus (128kbps, optimized for speech)
Size: ~2-3 MB/min
File: voice_recording_TIMESTAMP.webm
```

### Video Recording
```typescript
Type: video/webm;codecs=vp9,opus
Codecs: VP9 (video) + Opus (audio)
Resolution: 1280x720 (HD)
Size: ~15-25 MB/min
File: video_recording_TIMESTAMP.webm
```

---

## Component Props

```typescript
<MediaRecorder
  initialMode="audio"           // 'audio' or 'video'
  onFileReady={(file) => {}}    // Called when saved
  onCancel={() => {}}           // Called when closed
  theme="light"                 // 'light' or 'dark'
/>
```

---

## Recording States

```
idle → recording → [paused] → stopped → (playback + save/retry)
```

**State Values:**
- `idle` - No recording, mode selection screen shown
- `recording` - Currently recording
- `paused` - Recording paused, can resume
- `stopped` - Recording finished, preview shown

---

## File Generation

```typescript
// Naming: {type}_recording_{timestamp}.webm
voice_recording_1730627424123.webm
video_recording_1730627424456.webm

// File object:
{
  name: string,
  size: number,
  type: "audio/webm" | "video/webm",
  lastModified: number
}
```

---

## Integration Flow

```
Step 4: Encryption
├─ Upload files (traditional)
├─ Record voice (browser API)
├─ Record video (browser API)
└─ Multiple files supported

↓

Files added to uploadedFiles array

↓

Step 5: Finalize
├─ Review configuration
├─ Submit dossier
└─ Each file encrypted

↓

encryptFileWithDossier()
├─ TACo encryption
├─ Dossier contract condition
└─ IPFS/Pinata storage

↓

Encrypted dossier on blockchain
```

---

## Key Functions

### In MediaRecorder.tsx

```typescript
// Get user media (audio or video)
navigator.mediaDevices.getUserMedia(constraints)

// Create recorder
new MediaRecorder(stream, { mimeType })

// On data available
mediaRecorder.ondataavailable = (event) => chunks.push(event.data)

// On stop - create blob
new Blob(chunks, { type: mimeType })

// Format duration
formatDuration(seconds) → "MM:SS"

// Save recording
onFileReady(new File([blob], fileName, { type, lastModified }))
```

### In page.tsx

```typescript
// Open recording modal
setShowMediaRecorder(true)
setMediaRecorderType('voice') // or 'video'

// Handle recorded file
onFileReady={(file) => {
  setUploadedFiles(prev => [...prev, file])
  setShowMediaRecorder(false)
}}

// Later: encrypt file
const result = await encryptFileWithDossier(
  file,
  condition,
  description,
  dossierId,
  userAddress,
  walletProvider,
  burnerWallet
)
```

---

## UI Elements

### Recording Buttons (Step 4)
```
┌─────────────┐  ┌──────────────┐
│   🎤 Voice  │  │  📹 Video    │
│ Recording   │  │ Recording    │
└─────────────┘  └──────────────┘
```

### Controls During Recording
- **Pause/Resume** - Stop/start recording (timer pauses too)
- **Stop** - End recording, go to preview
- **Cancel (X)** - Exit without saving

### Preview Controls
- **Audio** - Browser `<audio>` element with play/pause
- **Video** - Browser `<video>` element with controls
- **Record Again** - Start new recording
- **Use This Recording** - Save and close

---

## Duration Format

```
Seconds → MM:SS
  45 → "00:45"
 125 → "02:05"
3661 → "61:01"
```

Implementation:
```typescript
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
```

---

## Permission Dialog

### Audio Recording
```
Browser: "Canary wants to use your microphone"
         [Block] [Allow]
```

### Video Recording
```
Browser: "Canary wants to use your camera and microphone"
         [Block] [Allow]
```

---

## Error Cases

| Error | Message | Action |
|-------|---------|--------|
| Permission denied | "Failed to start recording..." | Alert shown, recording aborted |
| No MediaRecorder API | "not supported in this browser" | Alert shown, recording aborted |
| File save fails | console.error logged | Modal stays open |

---

## Storage & Encryption

### Recording → File → Encryption → Storage

```
Blob (WebM bytes)
  ↓
File object with name + type
  ↓
Added to uploadedFiles array
  ↓
On submit: encryptFileWithDossier()
  ↓
TACo encrypted with condition
  ↓
Uploaded to IPFS/Pinata
  ↓
TraceJson metadata created
  ↓
Stored in dossier on blockchain
```

### TraceJson for Voice Recording

```json
{
  "original_filename": "voice_recording_1730627424123.webm",
  "payload_uri": "ipfs://QmXxxxxxx",
  "dossier_id": "42",
  "user_address": "0x1234...",
  "condition": "Dossier #42 contract verification (1440 MINUTES)"
}
```

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| MediaRecorder | 49+ | 25+ | 14.1+ | 79+ |
| getUserMedia | 21+ | 17+ | 11+ | 12+ |
| WebM/VP9 | ✓ | ✓ | ✗ | ✓ |
| WebM/Opus | ✓ | ✓ | ✓ | ✓ |

---

## Resource Cleanup

```typescript
// On stop:
streamRef.current.getTracks().forEach(track => track.stop())
clearInterval(durationIntervalRef.current)
URL.revokeObjectURL(previewUrl)

// On unmount:
useEffect(() => {
  return () => {
    stopAllTracks()
    clearAllTimers()
    revokeAllUrls()
  }
}, [])
```

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Max audio bitrate | Browser-dependent |
| Max video resolution | 1280x720 |
| Max video fps | Browser-dependent (30) |
| Audio codec | Opus (RFC 6716) |
| Video codec | VP9 (WebM spec) |
| Container | WebM |
| Typical audio size/min | 2-3 MB |
| Typical video size/min | 15-25 MB |

---

## Common Workflows

### Adding Voice Message to Dossier

1. Click "Voice Recording" button in Step 4
2. Grant microphone permission
3. Speak message (~45 sec)
4. Click "Stop"
5. Preview with play button
6. Click "Use This Recording"
7. File appears in list
8. Continue to Step 5 (Finalize)
9. File encrypted on submit

### Adding Video Message to Dossier

1. Click "Video Recording" button in Step 4
2. Grant camera + microphone permission
3. Record message with live preview (~2 min)
4. Click "Stop"
5. Preview with video player
6. Click "Use This Recording"
7. File appears in list
8. Continue to Step 5 (Finalize)
9. File encrypted on submit

### Recording Multiple Files

1. Record voice message (→ uploaded)
2. Record video message (→ uploaded)
3. Upload document file (→ uploaded)
4. All three files shown in list
5. All encrypted together on submit
6. All included in dossier

---

## File Naming Logic

```typescript
const fileName = `${mode === 'audio' ? 'voice' : 'video'}_recording_${Date.now()}.webm`;

// Examples:
voice_recording_1730627424123.webm  // Nov 3, 2024, 6:43:44 PM UTC
video_recording_1730627425456.webm  // 1 second later
```

**Why timestamp?**
- Ensures unique filenames
- Preserves order of recording
- Human-readable (milliseconds since epoch)

---

## Testing Checklist

- [ ] Voice recording in light theme
- [ ] Voice recording in dark theme
- [ ] Video recording with live preview
- [ ] Pause/resume during recording
- [ ] Duration counter accuracy
- [ ] Preview playback works
- [ ] File deletion from list
- [ ] Multiple recordings in sequence
- [ ] Permission denied handling
- [ ] Mobile device testing
- [ ] Cross-browser testing
- [ ] Encryption of recordings
- [ ] Dossier creation with recordings

---

## Debug Tips

**Check recording state:**
```typescript
console.log({
  mode,
  recordingState,
  recordingDuration,
  recordedBlobSize: recordedBlob?.size
})
```

**Check file before encryption:**
```typescript
console.log('File to encrypt:', {
  name: file.name,
  size: file.size,
  type: file.type,
  lastModified: file.lastModified
})
```

**Check encryption result:**
```typescript
console.log('Encryption result:', {
  originalFileName: result.originalFileName,
  encryptedSize: result.encryptedData.length,
  capsuleUri: result.capsuleUri
})
```

---

## Performance Notes

- Recording held in memory (chunks array)
- Cleared after blob creation
- Preview URLs created on demand
- Preview URLs revoked after use
- Stream tracks stopped immediately on stop
- Timers cleared on unmount
- No disk storage during recording
- Browser handles encoding (hardware accelerated)

---

## Security Notes

- Microphone/camera access explicitly requested
- User must grant permission in browser
- Permission tied to origin (domain)
- Can be revoked in browser settings
- All encryption client-side (TACo)
- No unencrypted data sent to server
- Dossier contract controls decryption
- Dead man's switch: auto-release on expiry

---

## Codec Info

**Opus Audio Codec:**
- RFC 6716 standard
- Optimized for speech (low bitrate)
- Typical: 128kbps
- Better than MP3 at same bitrate

**VP9 Video Codec:**
- Google's open-source codec
- Used in WebM container
- Good quality at low bitrate
- Hardware acceleration available

---

**For full details, see:** `/Users/k/Git/canary/VOICE_VIDEO_RECORDING_ANALYSIS.md`
