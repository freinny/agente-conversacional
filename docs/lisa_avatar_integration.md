# Lisa Avatar & Azure Voice Integration Guide

This document provides a detailed overview of the code required to summon the "Lisa" Avatar using Azure Live Voice services, based on the current implementation.

## 1. Backend Implementation (Python)

The core logic resides in `apps/backend/voice_server_enhanced.py`. It handles the WebSocket connection with the client and the connection to Azure AI Voice.

### Key Imports & Configuration
```python
from azure.ai.voicelive.models import (
    AvatarConfig,
    ClientEventSessionAvatarConnect,
    VideoParams,
    VideoResolution,
    Modality,
    RequestSession,
    AzureStandardVoice
)

# ...

# Avatar configuration
voice_service_mode = data.get('voiceServiceMode', 'mic')
avatar_options = None
if voice_service_mode == 'avatar':
    logger.info("🎨 Configuring Azure AI Avatar (Lisa - 720p H264)")
    avatar_options = AvatarConfig(
        character="lisa",
        customized=False,
        style="casual-sitting",
        video=VideoParams(
            codec="h264",
            bitrate=2000000,
            resolution=VideoResolution(width=1280, height=720)
        )
    )

# Configure session with necessary modalities
modalities = [Modality.TEXT, Modality.AUDIO]
if voice_service_mode == 'avatar':
    modalities.append(Modality.AVATAR)
    modalities.append(Modality.ANIMATION)

session_config = RequestSession(
    modalities=modalities,
    instructions=instructions,
    voice=AzureStandardVoice(name=selected_voice.split(':')[0]),
    avatar=avatar_options,
    # ... other config ...
)
await azure_connection.session.update(session=session_config)
```

### Handling WebRTC Signaling (SDP)
The backend acts as a proxy for the WebRTC SDP offer/answer between the client and Azure.

```python
# In the message loop receiving from client
elif data['type'] == 'session.avatar.offer':
    # Proxy SDP offer for Avatar WebRTC connection
    sdp_offer = data.get('sdp')
    
    # Send as ClientEventSessionAvatarConnect
    # Azure expects the SDP to be wrapped in a JSON object and Base64 encoded
    sdp_wrapper = json.dumps({"type": "offer", "sdp": sdp_offer})
    sdp_base64 = base64.b64encode(sdp_wrapper.encode('utf-8')).decode('utf-8')
    
    await azure_connection.send(ClientEventSessionAvatarConnect(client_sdp=sdp_base64))
```

## 2. Frontend Implementation (React/TypeScript)

The frontend logic is managed by `apps/web/src/hooks/useRealTimeVoice.ts`. It establishes the WebRTC connection.

### WebRTC Setup
```typescript
const setupWebRTC = async () => {
    console.log('[useRealTimeVoice] Setting up WebRTC for Avatar');

    // ICE servers are typically received from the backend/Azure
    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        ...(azureIceServersRef.current || [])
    ];

    const pc = new RTCPeerConnection({
        bundlePolicy: 'max-bundle',
        iceServers: iceServers
    });
    peerConnectionRef.current = pc;

    // Handle incoming video/audio tracks
    pc.ontrack = (event) => {
        if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(event.track);
        
        // Update state with the new stream
        const newStream = new MediaStream(remoteStreamRef.current.getTracks());
        setAvatarStream(newStream);
    };

    // Add transceivers (direction: recvonly because we only receive video/audio from avatar)
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    // Create and set local description (Offer)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete before sending the offer
    // This is crucial for a single-shot SDP exchange
    await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
            resolve();
        } else {
            const checkState = () => {
                if (pc.iceGatheringState === 'complete') {
                    pc.removeEventListener('icegatheringstatechange', checkState);
                    resolve();
                }
            };
            pc.addEventListener('icegatheringstatechange', checkState);
        }
    });

    // Send SDP Offer to backend
    socketRef.current?.send(JSON.stringify({
        type: 'session.avatar.offer',
        sdp: pc.localDescription?.sdp
    }));
};
```

### Handling SDP Answer
```typescript
// In ws.onmessage
} else if (data.type === 'session.avatar.answer') {
    console.log('[useRealTimeVoice] Received SDP Answer for Avatar');
    if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdp
        }));
    }
}
```

## 3. UI Component (AvatarDisplay)

The `apps/web/src/components/AvatarDisplay.tsx` component renders the media stream.

```tsx
export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({ stream, isConnecting, error }) => {
    const videoRef = useCallback((node: HTMLVideoElement | null) => {
        if (node && stream) {
            node.srcObject = stream;
            node.onloadedmetadata = () => {
                node.play().catch(e => console.error(e));
            };
        }
    }, [stream]);

    // Audio is often separate or included in the stream; ensure it's played
    const audioRef = useCallback((node: HTMLAudioElement | null) => {
        if (node && stream) {
            node.srcObject = stream;
            node.onloadedmetadata = () => {
                node.play().catch(e => console.error(e));
            };
        }
    }, [stream]);

    return (
        <div className="...">
            {/* ... Loading states ... */}
            {stream && (
                <div className="w-full h-full relative">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted // Muted to avoid feedback/autoplay issues, audio handled separately or via this element if allowed
                        className="w-full h-full object-cover"
                    />
                    <audio ref={audioRef} autoPlay hidden />
                </div>
            )}
        </div>
    );
};
```

## 4. Environment Variables

Ensure the following variables are set in your backend `.env` file:

```bash
AZURE_VOICELIVE_ENDPOINT="wss://<your-resource>.cognitiveservices.azure.com"
AZURE_VOICELIVE_API_KEY="<your-api-key>"
AZURE_VOICELIVE_MODEL="gpt-4o-realtime-preview"
AZURE_VOICELIVE_VOICE="en-US-Ava:DragonHDLatestNeural" # Or similar
```

## Summary of Flow

1.  **Client** calls `connect(..., 'avatar')`.
2.  **Client** creates `WebSocket` to Backend.
3.  **Backend** connects to `Azure AI VoiceLive`.
4.  **Backend** sends `session.update` to Azure with `AvatarConfig` and `Modalities` (Avtar+Animation).
5.  **Client** calls `setupWebRTC()`:
    *   Creates `RTCPeerConnection`.
    *   Adds transceivers.
    *   Creates Offer.
    *   Waits for ICE gathering to complete.
    *   Sends `session.avatar.offer` to Backend.
6.  **Backend** receives offer, wraps it, base64 encodes it, and sends `ClientEventSessionAvatarConnect` to Azure.
7.  **Azure** responds (eventually) with an Answer (via `session.avatar.answer`? *Note: In the code examined, the answer handling from Azure back to Client wasn't explicitly shown in the provided snippet of `receive_from_azure` but presumably it comes through an event or is handled by a similar mechanism where Azure sends a response that the backend forwards.*)
    *   *Correction*: In `voice_server_enhanced.py`, the specific part handling the *answer* from Azure back to the client wasn't fully visible in the 800-line chunk or might be implicitly handled if Azure sends it as a specific event type. However, the client logic expects `session.avatar.answer`.
