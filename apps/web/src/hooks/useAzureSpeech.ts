import { useRef, useState, useEffect, useCallback } from 'react';
import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';
import type { EvidenceItem } from '@repo/shared';

const SPEECH_KEY = import.meta.env.VITE_AZURE_TTS_API_KEY;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const useAzureSpeech = () => {
    const [recognizing, setRecognizing] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [avatarStream, setAvatarStream] = useState<MediaStream | null>(null);
    const [status, setStatus] = useState<string>("Disponible");
    const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
    const [transcript, setTranscript] = useState<string>("");
    const [isExecutingTool, setIsExecutingTool] = useState(false);
    const [activeToolName, setActiveToolName] = useState<string | null>(null);

    // Refs
    const socketRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const synthesizerRef = useRef<speechsdk.SpeechSynthesizer | null>(null);
    const iceServersRef = useRef<any[]>([]);

    // Audio Capture Refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const toolAnimTimeoutRef = useRef<any>(null);

    useEffect(() => {
        if (SPEECH_KEY) {
            try {
                const endpoint = import.meta.env.VITE_AZURE_TTS_ENDPOINT;
                let speechConfig: speechsdk.SpeechConfig;

                if (endpoint && endpoint.includes('cognitiveservices.azure.com')) {
                    const url = new URL(endpoint);
                    speechConfig = speechsdk.SpeechConfig.fromEndpoint(url, SPEECH_KEY);
                } else {
                    speechConfig = speechsdk.SpeechConfig.fromSubscription(SPEECH_KEY, "eastus");
                }

                speechConfig.speechRecognitionLanguage = "es-MX";
                speechConfig.speechSynthesisVoiceName = "es-MX-DaliaNeural";
                const audioOutput = speechsdk.AudioConfig.fromDefaultSpeakerOutput();
                synthesizerRef.current = new speechsdk.SpeechSynthesizer(speechConfig, audioOutput);
            } catch (e) {
                console.error("Speech SDK Init Error:", e);
            }
        }

        return () => {
            synthesizerRef.current?.close();
            socketRef.current?.close();
            pcRef.current?.close();
            stopMic();
        };
    }, []);

    const stopMic = useCallback(() => {
        console.log('[useAzureSpeech] 🎤 Stopping Mic');
        processorRef.current?.disconnect();
        audioCtxRef.current?.close().catch(() => undefined);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        processorRef.current = null;
        audioCtxRef.current = null;
        mediaStreamRef.current = null;
        setRecognizing(false);
    }, []);

    const startMic = useCallback(async () => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            console.warn('[useAzureSpeech] ⚠️ WebSocket not ready for mic streaming');
            return;
        }

        try {
            console.log('[useAzureSpeech] 🎙️ Starting WebSocket Audio Stream (PCM16)...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // Azure Realtime usually likes 24kHz or 16kHz
            const audioContext = new AudioContext({ sampleRate: 24000 });
            audioCtxRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0);

                // Float32 to Int16 conversion
                const pcm16 = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    const s = Math.max(-1, Math.min(1, input[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Unit8Array for base64 encoding
                const buffer = new Uint8Array(pcm16.buffer);
                let binary = "";
                for (let i = 0; i < buffer.length; i++) {
                    binary += String.fromCharCode(buffer[i]);
                }
                const base64 = btoa(binary);

                if (socketRef.current?.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({
                        type: 'input_audio_buffer.append',
                        audio: base64
                    }));
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
            setRecognizing(true);
            console.log('[useAzureSpeech] ✅ Mic Streaming Active');
        } catch (err) {
            console.error('[useAzureSpeech] ❌ Failed to start mic:', err);
            setStatus("Error: Micrófono no disponible");
        }
    }, [socketRef]);

    const setupWebRTC = useCallback(async (azureIceServers: any[] = []) => {
        console.log('[useAzureSpeech] 🛠️ Setting up WebRTC (Downstream-Only)...');

        if (pcRef.current) {
            pcRef.current.close();
        }

        const pc = new RTCPeerConnection({
            bundlePolicy: 'max-bundle',
            iceServers: azureIceServers.length > 0 ? azureIceServers : [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });
        pcRef.current = pc;

        // Logging local ICE state
        pc.onicegatheringstatechange = () => {
            console.log('[useAzureSpeech] ❄️ ICE Gathering State:', pc.iceGatheringState);
        };

        // Handle incoming tracks (Lisa's Video and Voice)
        const remoteStream = new MediaStream();
        pc.ontrack = (event) => {
            console.log('[useAzureSpeech] 📺 Received remote track:', event.track.kind);
            remoteStream.addTrack(event.track);
            setAvatarStream(new MediaStream(remoteStream.getTracks()));
        };

        // Downstream Only
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        // Create and set local offer
        console.log('[useAzureSpeech] 📝 Creating Offer...');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Acelerated Handshake: Wait for ICE gathering with 1.5s Timeout
        // This prevents the 40s hang observed in some network environments.
        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                console.log('[useAzureSpeech] ❄️ ICE Gathering timed out (1.5s), proceeding with available candidates');
                resolve();
            }, 1500);

            const check = () => {
                if (pc.iceGatheringState === 'complete') {
                    console.log('[useAzureSpeech] ❄️ ICE Gathering complete');
                    clearTimeout(timeout);
                    resolve();
                }
            };
            pc.addEventListener('icegatheringstatechange', check);
            if (pc.iceGatheringState === 'complete') check();
        });

        // Send Offer to Proxy
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            console.log('[useAzureSpeech] 🚀 Sending SDP Offer to proxy');
            socketRef.current.send(JSON.stringify({
                type: 'session.avatar.offer',
                sdp: pc.localDescription?.sdp
            }));
        }
    }, []);

    const connectAvatar = useCallback(async () => {
        console.log('[useAzureSpeech] 🚀 Connecting to Realtime Avatar Proxy...');
        setStatus("Conectando...");
        iceServersRef.current = [];

        const wsUrl = API_URL.replace('http', 'ws') + '/api/realtime';
        console.log('[useAzureSpeech] 🔗 Proxy WS URL:', wsUrl);
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log('[useAzureSpeech] ✅ Proxy Connected');
            // We start mic streaming immediately upon connection if desired, 
            // or wait for explicit startListening call.
            // For now, let's wait for the ICE servers to setup the full WebRTC.
        };

        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            // Minimal logging for delta messages to avoid flooding
            if (data.type !== 'response.audio.delta') {
                console.log('[useAzureSpeech] 📥 Incoming Event:', data.type);
            }

            if (data.type === 'session.ice_servers') {
                console.log('[useAzureSpeech] ❄️ ICE Servers received, starting WebRTC handshake...');
                iceServersRef.current = data.ice_servers;
                setupWebRTC(data.ice_servers);

                // Once we have ICE servers and are setting up WebRTC, 
                // we can also start the audio upload stream.
                startMic();
            }

            if (data.type === 'session.avatar.answer') {
                console.log('[useAzureSpeech] ✅ Received SDP Answer');
                if (data.sdp && pcRef.current) {
                    try {
                        await pcRef.current.setRemoteDescription(new RTCSessionDescription({
                            type: 'answer',
                            sdp: data.sdp
                        }));
                        console.log('[useAzureSpeech] 🎯 Remote description set - Avatar Connection Established');
                        setStatus("En línea");
                    } catch (e) {
                        console.error('[useAzureSpeech] ❌ Failed to set remote description:', e);
                    }
                }
            }

            // Realtime Response Handling
            if (data.type === 'response.created') {
                setTranscript("");
                setEvidence([]); // Reset evidence for new response
            }

            if (data.type === 'response.text.delta') {
                setTranscript(prev => prev + data.delta);
            }

            if (data.type === 'evidence') {
                console.log('[useAzureSpeech] 📊 Received Evidence:', data.evidence);
                setEvidence(prev => [...prev, ...data.evidence]);

                // Keep animation for at least a short duration even if data is instant
                if (toolAnimTimeoutRef.current) clearTimeout(toolAnimTimeoutRef.current);
                toolAnimTimeoutRef.current = setTimeout(() => {
                    setIsExecutingTool(false);
                    setActiveToolName(null);
                    toolAnimTimeoutRef.current = null;
                }, 2500); // 2.5s duration for high visibility
            }

            if (data.type === 'tool_call.start') {
                console.log('[useAzureSpeech] ⚙️ Tool Execution Started:', data.tool);
                if (toolAnimTimeoutRef.current) {
                    clearTimeout(toolAnimTimeoutRef.current);
                    toolAnimTimeoutRef.current = null;
                }
                setIsExecutingTool(true);
                setActiveToolName(data.tool);
            }

            if (data.type === 'input_audio_buffer.speech_started') {
                console.log('[useAzureSpeech] 🗣️ User Speech Detected');
                setRecognizing(true);
            }
            if (data.type === 'input_audio_buffer.speech_stopped') {
                console.log('[useAzureSpeech] 🤫 User Speech Stopped');
                setRecognizing(false);
            }
            if (data.type === 'response.audio.delta') {
                // console.log('[useAzureSpeech] 🔊 Receiving audio delta'); // Too noisy
                setSpeaking(true);
            }
            if (data.type === 'response.done') {
                console.log('[useAzureSpeech] 🛑 Avatar finished speaking (response.done)');
                setSpeaking(false);
            }

            if (data.type === 'error') {
                const errorMsg = data.error?.message || data.message || JSON.stringify(data);
                console.error('[useAzureSpeech] ❌ Server Side Error:', errorMsg, data);
                setStatus(`Error: ${errorMsg}`);
                // Only stop mic if it's a fatal error. 
                // Usually OpenAI errors in realtime are fatal for the session.
                stopMic();
            }
        };

        ws.onerror = (err) => {
            console.error('[useAzureSpeech] ❌ WS Error:', err);
            setStatus("Error de conexión");
        };

        ws.onclose = () => {
            console.log('[useAzureSpeech] 🔌 WS Closed');
            setStatus("Disponible");
            setAvatarStream(null);
            stopMic();
        };
    }, [setupWebRTC, startMic, stopMic, setStatus, setAvatarStream, setTranscript, setEvidence, setRecognizing, setSpeaking]);

    const disconnectAvatar = useCallback(() => {
        console.log('[useAzureSpeech] 🔌 Disconnecting Avatar...');
        stopMic();
        socketRef.current?.close();
        socketRef.current = null;
        pcRef.current?.close();
        pcRef.current = null;
        setAvatarStream(null);
        setStatus("Disponible");
    }, [stopMic, setAvatarStream, setStatus]);

    const speak = useCallback((text: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            console.log('[useAzureSpeech] 💬 Sending response.create via WebSocket');
            // Reset state
            setTranscript("");
            setEvidence([]);

            socketRef.current.send(JSON.stringify({
                type: 'response.create',
                response: {
                    modalities: ['text', 'audio'],
                    instructions: text
                }
            }));
        } else if (synthesizerRef.current) {
            setSpeaking(true);
            synthesizerRef.current.speakTextAsync(text, () => setSpeaking(false), () => setSpeaking(false));
        }
    }, []);

    const startListening = useCallback((_onText: (text: string) => void) => {
        // Toggle Mic
        if (recognizing) {
            stopMic();
        } else {
            startMic();
        }
    }, [recognizing, startMic, stopMic]);

    return {
        speak,
        startListening,
        recognizing,
        speaking,
        connectAvatar,
        disconnectAvatar,
        avatarStream,
        status,
        evidence,
        transcript,
        isExecutingTool,
        activeToolName
    };
};
