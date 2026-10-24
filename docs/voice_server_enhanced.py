import os
import sys
import asyncio
import json
import logging
import base64
import re
import websockets
import numpy as np
import aiohttp
from dotenv import load_dotenv
from azure.core.credentials import AzureKeyCredential
from azure.ai.voicelive.aio import connect
from azure.ai.voicelive.models import (
    ServerEventType, 
    InputAudioFormat, 
    OutputAudioFormat,
    RequestSession,
    AzureStandardVoice,
    ServerVad,
    AudioEchoCancellation,
    AudioNoiseReduction,
    FunctionTool,
    FunctionCallOutputItem,
    AvatarConfig,
    ClientEventSessionAvatarConnect,
    VideoParams,
    VideoResolution,
    Modality
)

# Add src and prompts directories to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'prompts'))

from audioCapture import get_audio_capture_service
from pronunciation_analysis import get_pronunciation_analyzer
from vocabulary_trainer import get_instructions_for_topic
from tts_service import generate_reference_audio

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("VoiceServer")

PORT = 8000
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")


class VoiceSessionTracker:
    """Tracks voice session for cost analytics using duration-based estimation"""
    
    # Estimation: ~75 tokens per second of conversation (average for voice chat)
    # This accounts for both input (user speech) and output (AI response)
    TOKENS_PER_SECOND = 75
    
    # Split: 40% input, 60% output (typical for conversational AI)
    INPUT_RATIO = 0.4
    OUTPUT_RATIO = 0.6
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.session_id = None
        self.start_time = None
        self.end_time = None
        
    async def start_session(self):
        """Start tracking session via backend API"""
        import time
        self.start_time = time.time()
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{BACKEND_URL}/api/voice/session/start",
                    json={"userId": self.user_id}
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.session_id = data.get("sessionId")
                        logger.info(f"[VoiceTracking] Started session {self.session_id} for user {self.user_id}")
                    else:
                        logger.error(f"[VoiceTracking] Failed to start session: {response.status}")
        except Exception as e:
            logger.error(f"[VoiceTracking] Error starting session: {e}")
    
    async def end_session(self):
        """End tracking session and calculate tokens based on duration"""
        import time
        
        if not self.session_id or not self.start_time:
            return
        
        self.end_time = time.time()
        duration_seconds = self.end_time - self.start_time
        
        # Estimate tokens based on duration
        total_tokens = int(duration_seconds * self.TOKENS_PER_SECOND)
        input_tokens = int(total_tokens * self.INPUT_RATIO)
        output_tokens = int(total_tokens * self.OUTPUT_RATIO)
        
        logger.info(f"[VoiceTracking] Session duration: {duration_seconds:.1f}s, estimated tokens: {total_tokens} (input: {input_tokens}, output: {output_tokens})")
        
        # Track the estimated tokens
        if total_tokens > 0:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{BACKEND_URL}/api/voice/session/track",
                        json={
                            "sessionId": self.session_id,
                            "userId": self.user_id,
                            "inputTokens": input_tokens,
                            "outputTokens": output_tokens
                        }
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            logger.info(f"[VoiceTracking] Tracked {total_tokens} tokens (duration-based), cost: ${data.get('cost', 0):.4f}")
                        else:
                            logger.error(f"[VoiceTracking] Failed to track tokens: {response.status}")
            except Exception as e:
                logger.error(f"[VoiceTracking] Error tracking tokens: {e}")
        
        # End the session
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{BACKEND_URL}/api/voice/session/end",
                    json={"sessionId": self.session_id}
                ) as response:
                    if response.status == 200:
                        logger.info(f"[VoiceTracking] Ended session {self.session_id}. Duration: {duration_seconds:.1f}s, Total tokens: {total_tokens}")
                    else:
                        logger.error(f"[VoiceTracking] Failed to end session: {response.status}")
        except Exception as e:
            logger.error(f"[VoiceTracking] Error ending session: {e}")


class PronunciationTracker:
    """Tracks the current state of pronunciation practice"""
    
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.current_word = None
        self.tutor_audio_chunks = []
        self.user_audio_chunks = []
        self.is_capturing_tutor = False
        self.is_capturing_user = False
        self.awaiting_user_pronunciation = False
        self.last_user_audio = None  # Buffer for the most recent user utterance
        self.last_user_audio_word = None # Word associated with the last audio if any
        self.pending_call_id = None  # Store MCP tool call_id for response
        self.word_attempts = {} # Track attempts per word
        
    def start_tutor_capture(self, word: str):
        """Start capturing tutor's pronunciation of a word"""
        self.current_word = word
        self.tutor_audio_chunks = []
        self.is_capturing_tutor = True
        logger.info(f"[PronunciationTracker] Started capturing tutor audio for '{word}'")
    
    def stop_tutor_capture(self):
        """Stop capturing tutor's audio"""
        self.is_capturing_tutor = False
        logger.info(f"[PronunciationTracker] Stopped capturing tutor audio")
    
    def start_user_capture(self):
        """Start capturing user's pronunciation"""
        self.user_audio_chunks = []
        self.is_capturing_user = True
        self.awaiting_user_pronunciation = True
        logger.info(f"[PronunciationTracker] Started capturing user audio for '{self.current_word}'")
    
    def stop_user_capture(self):
        """Stop capturing user's audio and buffer it"""
        self.is_capturing_user = False
        # Do NOT reset awaiting_user_pronunciation here, as we might be waiting for the tool call
        # self.awaiting_user_pronunciation = False 
        
        # Buffer the audio we just captured
        self.last_user_audio = self.get_user_audio()
        logger.info(f"[PronunciationTracker] Stopped capturing user audio. Buffered {len(self.last_user_audio)} bytes (base64).")
    
    def add_tutor_chunk(self, audio_chunk: str):
        """Add a chunk of tutor audio"""
        if self.is_capturing_tutor:
            self.tutor_audio_chunks.append(audio_chunk)
    
    def add_user_chunk(self, audio_chunk: str):
        """Add a chunk of user audio - ALWAYS buffer, regardless of capture state"""
        self.user_audio_chunks.append(audio_chunk)
    
    def get_tutor_audio(self) -> str:
        """Get concatenated tutor audio"""
        if not self.tutor_audio_chunks:
            return ""
        # Decode all chunks, concatenate, then re-encode
        audio_bytes = b''.join([base64.b64decode(chunk) for chunk in self.tutor_audio_chunks])
        return base64.b64encode(audio_bytes).decode('utf-8')
    
    def get_user_audio(self) -> str:
        """Get concatenated user audio"""
        if not self.user_audio_chunks:
            return ""
        audio_bytes = b''.join([base64.b64decode(chunk) for chunk in self.user_audio_chunks])
        return base64.b64encode(audio_bytes).decode('utf-8')


def extract_word_from_text(text: str) -> str:
    """
    Extract the vocabulary word being taught from tutor's text.
    Looks for patterns like "Let's learn 'word'" or "the term 'word'"
    """
    # Pattern 1: "Let's learn the term 'word'" or "Let's learn 'word'" (with quotes)
    match = re.search(r"(?:learn|term|word|practice|say)\s+(?:the\s+)?(?:word\s+)?['\"]([^'\"]+)['\"]", text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Pattern 2: Word in quotes at start of sentence
    match = re.search(r"^['\"]([^'\"]+)['\"]", text.strip())
    if match:
        return match.group(1)

    # Pattern 3: "The word is X" or "Let's practice X" (without quotes, single word)
    # Be careful not to match common words, so we look for specific intro phrases
    match = re.search(r"(?:the word is|let's practice|how about)\s+([a-zA-Z]+)(?=[.!?]|$)", text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    return None


async def handle_client(websocket):
    logger.info("New client connected")
    
    endpoint = os.getenv("AZURE_VOICELIVE_ENDPOINT")
    api_key = os.getenv("AZURE_VOICELIVE_API_KEY")
    model = os.getenv("AZURE_VOICELIVE_MODEL")
    voice_name = os.getenv("AZURE_VOICELIVE_VOICE", "en-US-Ava:DragonHDLatestNeural")

    if not all([endpoint, api_key, model]):
        logger.error("Missing Azure credentials")
        await websocket.close(1011, "Server configuration error")
        return

    try:
        credential = AzureKeyCredential(api_key)
        
        logger.info(f"Connecting to Azure VoiceLive: {endpoint}")
        
        # Initialize services
        audio_capture = get_audio_capture_service()
        analyzer = get_pronunciation_analyzer()
        
        # Create session
        session_id = f"session_{id(websocket)}"
        audio_capture.create_session(session_id)
        
        # Create pronunciation tracker
        tracker = PronunciationTracker(session_id)
        
        # TODO: Get user_id from client authentication
        # For now, using demo user (id=1)
        user_id = 1
        
        # Create voice session tracker for cost analytics
        voice_tracker = VoiceSessionTracker(user_id)
        await voice_tracker.start_session()
        
        async with connect(
            endpoint=endpoint,
            credential=credential,
            model=model
        ) as azure_connection:
            logger.info("Connected to Azure VoiceLive")
            
            async def receive_from_client():
                try:
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            
                            if data['type'] == 'session.update':
                                logger.info("Received session update from client")
                                custom_instructions = data.get('instructions', "")
                                target_language = data.get('targetLanguage', 'en')
                                logger.info(f"Target language: {target_language}")
                                logger.info(f"Custom instructions length: {len(custom_instructions)} chars")
                                
                                # Voice mapping by language
                                voice_mapping = {
                                    'en': 'en-US-AvaNeural',
                                    'pt': 'pt-BR-FranciscaNeural',
                                    'fr': 'fr-FR-DeniseNeural',
                                    'es': 'es-MX-DaliaNeural',
                                    'de': 'de-DE-KatjaNeural',
                                    'zh': 'zh-CN-XiaoxiaoNeural'
                                }
                                selected_voice = voice_mapping.get(target_language, voice_name)
                                logger.info(f"Using voice: {selected_voice}")
                                
                                # Check if custom instructions are provided (simulation mode)
                                if custom_instructions and len(custom_instructions) > 100:
                                    # Use custom instructions directly (simulation mode)
                                    instructions = custom_instructions
                                    logger.info(f"✅ Using custom simulation instructions ({len(instructions)} chars)")
                                    # logger.info(f"Instructions preview: {instructions[:200]}...")
                                else:
                                    # Load language-specific instructions from file (tutor mode)
                                    # logger.info("Loading default tutor instructions from file")
                                    instructions_path = os.path.join(
                                        os.path.dirname(__file__), 
                                        'prompts', 
                                        target_language, 
                                        'text_agent_instructions.md'
                                    )
                                    
                                    # Fallback to English if not found
                                    if not os.path.exists(instructions_path):
                                        logger.warning(f"Instructions not found for '{target_language}', using English")
                                        instructions_path = os.path.join(
                                            os.path.dirname(__file__), 
                                            'prompts', 
                                            'en', 
                                            'text_agent_instructions.md'
                                        )
                                    
                                    # Load instructions from file
                                    try:
                                        with open(instructions_path, 'r', encoding='utf-8') as f:
                                            base_instructions = f.read()
                                        
                                        # Add language directive
                                        language_names = {
                                            'en': 'English',
                                            'pt': 'Portuguese (Brazilian)',
                                            'fr': 'French',
                                            'es': 'Spanish',
                                            'de': 'German',
                                            'zh': 'Chinese (Mandarin)'
                                        }
                                        language_name = language_names.get(target_language, 'English')
                                        
                                        instructions = f"""{base_instructions}

CRITICAL: You MUST respond exclusively in {language_name}. Never use any other language."""
                                        
                                        logger.info(f"Loaded tutor instructions for {target_language}")
                                    except Exception as e:
                                        logger.error(f"Error loading instructions: {e}")
                                        topic = custom_instructions if custom_instructions else "Basic Vocabulary"
                                        instructions = get_instructions_for_topic(topic)
                                
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
                                
                                # Configure session with necessary modalities in specific order
                                modalities = [Modality.TEXT, Modality.AUDIO]
                                if voice_service_mode == 'avatar':
                                    modalities.append(Modality.AVATAR)
                                    modalities.append(Modality.ANIMATION)

                                session_config = RequestSession(
                                    modalities=modalities,
                                    instructions=instructions,
                                    temperature=0.8,
                                    # Use a simpler voice name for Avatar compatibility
                                    voice=AzureStandardVoice(name=selected_voice.split(':')[0]),
                                    input_audio_format=InputAudioFormat.PCM16,
                                    output_audio_format=OutputAudioFormat.PCM16,
                                    avatar=avatar_options,
                                    turn_detection=ServerVad(
                                        threshold=0.5,
                                        prefix_padding_ms=300,
                                        silence_duration_ms=500
                                    ),
                                    input_audio_echo_cancellation=AudioEchoCancellation(),
                                    input_audio_noise_reduction=AudioNoiseReduction(type="azure_deep_noise_suppression"),
                                    tools=[
                                        FunctionTool(
                                            name="assess_pronunciation",
                                            description="Assess the user's pronunciation of a specific vocabulary word. Call this AFTER the user has repeated the word.",
                                            parameters={
                                                "type": "object",
                                                "properties": {
                                                    "word": {
                                                        "type": "string",
                                                        "description": "The vocabulary word to assess"
                                                    }
                                                },
                                                "required": ["word"]
                                            }
                                        ),
                                        FunctionTool(
                                            name="update_simulation_state",
                                            description="Update the simulation's RPG state including your current emotion, the user's progress, and any private feedback. Call this whenever the situation changes or the user does something significant.",
                                            parameters={
                                                "type": "object",
                                                "properties": {
                                                    "ai_emotional_state": {
                                                        "type": "string",
                                                        "enum": ["neutral", "cooperative", "satisfied", "impatient", "frustrated", "angry", "surprised"],
                                                        "description": "Your current emotional state based on the conversation"
                                                    },
                                                    "task_progress": {
                                                        "type": "integer",
                                                        "minimum": 0,
                                                        "maximum": 100,
                                                        "description": "The learner's progress towards the objective (0-100)"
                                                    },
                                                    "feedback": {
                                                        "type": "string",
                                                        "description": "A short, private coaching note for the learner (e.g. 'Good empathy shown', 'Too pushy here')"
                                                    }
                                                },
                                                "required": ["ai_emotional_state", "task_progress", "feedback"]
                                            }
                                        )
                                    ]
                                )
                                await azure_connection.session.update(session=session_config)
                                logger.info("Session configuration sent to Azure")
                                
                                # For simulation mode (custom instructions), trigger the AI to speak first
                                # to make it answer the call naturally
                                if custom_instructions and len(custom_instructions) > 100:
                                    logger.info("🎭 Simulation mode detected - triggering AI to answer call")
                                    # Create a response without user input to make AI speak first
                                    await azure_connection.response.create()
                                    logger.info("✅ Initial greeting trigger sent to AI")
                                
                            elif data['type'] == 'audio.append':
                                # User audio - capture if we're expecting pronunciation
                                await azure_connection.input_audio_buffer.append(audio=data['audio'])
                                tracker.add_user_chunk(data['audio'])
                            
                            elif data['type'] == 'session.avatar.offer':
                                # Proxy SDP offer for Avatar WebRTC connection
                                sdp_offer = data.get('sdp')
                                logger.info(f"🌐 Received WebRTC SDP Offer (length: {len(sdp_offer)})")
                                logger.debug(f"📄 Full SDP Offer:\n{sdp_offer}")
                                
                                # Check for ICE candidates in SDP
                                candidates = [line for line in sdp_offer.splitlines() if 'a=candidate' in line]
                                logger.info(f"❄️ Found {len(candidates)} ICE candidates in SDP")
                                
                                # Use send() with ClientEventSessionAvatarConnect for SDP negotiation
                                # Azure service strictly expects a JSON wrapper {"type": "offer", "sdp": ...} 
                                # encoded in Base64 for the client_sdp field.
                                logger.info("📦 Wrapping and encoding SDP offer to Base64")
                                sdp_wrapper = json.dumps({"type": "offer", "sdp": sdp_offer})
                                sdp_base64 = base64.b64encode(sdp_wrapper.encode('utf-8')).decode('utf-8')
                                
                                # Send as ClientEventSessionAvatarConnect
                                await azure_connection.send(ClientEventSessionAvatarConnect(client_sdp=sdp_base64))
                                logger.info("✅ Proxied Wrapped Base64 SDP offer to Azure")
                                
                        except json.JSONDecodeError:
                            logger.error("Failed to decode JSON from client")
                        except Exception as e:
                            logger.error(f"Error processing client message: {e}")
                except websockets.exceptions.ConnectionClosed:
                    logger.info("Client disconnected")

            async def perform_analysis(word: str, user_audio: str):
                """Helper function to perform analysis and send results"""
                try:
                    logger.info(f"🚀 Starting analysis for word: '{word}'")
                    
                    # 1. Generate Reference Audio (Tutor) via TTS
                    logger.info(f"🔊 Generating reference audio for '{word}'...")
                    tutor_audio_b64 = generate_reference_audio(word)
                    
                    if not tutor_audio_b64:
                        logger.error("Failed to generate reference audio")
                        return

                    # 2. Store both audios
                    # Store Tutor Audio (Reference)
                    audio_capture.store_audio(
                        session_id,
                        word,
                        tutor_audio_b64,
                        "tutor",
                        24000 # Sample rate might differ for MP3, but analysis handles it
                    )
                    
                    # Store User Audio
                    audio_capture.store_audio(
                        session_id,
                        word,
                        user_audio,
                        "user",
                        24000
                    )
                    
                    # 3. Analyze
                    # We need to handle the fact that TTS might be MP3 and User is PCM16
                    # The analyzer uses librosa.load which handles formats automatically
                    
                    # Get audio pair (this retrieves them as temporary files)
                    audio_pair = audio_capture.get_audio_pair(session_id, word)
                    
                    if audio_pair:
                        tutor_seg, user_seg = audio_pair
                        
                        # Analyze
                        tutor_analysis = analyzer.analyze_audio(tutor_seg.audio_data, tutor_seg.sample_rate)
                        user_analysis = analyzer.analyze_audio(user_seg.audio_data, user_seg.sample_rate)
                        comparison = analyzer.compare_pronunciations(tutor_analysis, user_analysis)
                        
                        # Send results to frontend
                        result_data = {
                            'type': 'pronunciation.analysis',
                            'word': word,
                            'overallSimilarity': round(comparison.overall_similarity, 2),
                            'pitchAccuracy': round(comparison.pitch_accuracy, 2),
                            'timingAccuracy': round(comparison.timing_accuracy, 2),
                            'amplitudeMatch': round(comparison.amplitude_match, 2),
                            'feedback': comparison.feedback,
                            'tutor': {
                                # Use the generated TTS audio for playback
                                'audio': tutor_audio_b64, 
                                'duration': round(tutor_analysis.duration, 3),
                                'waveform': {
                                    'time': tutor_analysis.waveform.time.tolist(),
                                    'amplitude': tutor_analysis.waveform.amplitude.tolist()
                                },
                                'pitchContour': {
                                    'time': tutor_analysis.pitch_contour.time.tolist(),
                                    'pitch': tutor_analysis.pitch_contour.pitch.tolist()
                                },
                                'spectrogram': {
                                    'time': tutor_analysis.spectrogram.time.tolist(),
                                    'frequencies': tutor_analysis.spectrogram.frequencies.tolist(),
                                    'magnitude': tutor_analysis.spectrogram.magnitude.tolist()
                                }
                            },
                            'user': {
                                'audio': user_seg.audio_data_base64 if hasattr(user_seg, 'audio_data_base64') else base64.b64encode((user_seg.audio_data * 32768).astype(np.int16).tobytes()).decode('utf-8'),
                                'duration': round(user_analysis.duration, 3),
                                'waveform': {
                                    'time': user_analysis.waveform.time.tolist(),
                                    'amplitude': user_analysis.waveform.amplitude.tolist()
                                },
                                'pitchContour': {
                                    'time': user_analysis.pitch_contour.time.tolist(),
                                    'pitch': user_analysis.pitch_contour.pitch.tolist()
                                },
                                'spectrogram': {
                                    'time': user_analysis.spectrogram.time.tolist(),
                                    'frequencies': user_analysis.spectrogram.frequencies.tolist(),
                                    'magnitude': user_analysis.spectrogram.magnitude.tolist()
                                }
                            }
                        }
                        
                        await websocket.send(json.dumps(result_data))
                        logger.info(f"✅ Analysis Complete for '{word}'")
                        logger.info(f"📊 Metrics: Similarity={comparison.overall_similarity:.1f}%, Pitch={comparison.pitch_accuracy:.1f}%, Timing={comparison.timing_accuracy:.1f}%")
                        
                        # Return result data for MCP tool response
                        return result_data
                        
                    else:
                        logger.warning(f"⚠️ Could not find audio pair for '{word}'")
                        return None

                except Exception as e:
                    logger.error(f"❌ Error analyzing pronunciation: {e}")
                    import traceback
                    traceback.print_exc()
                    return None

            async def receive_from_azure():
                should_terminate = False # Local flag to track termination request
                try:
                    async for event in azure_connection:
                        if event.type == ServerEventType.RESPONSE_AUDIO_DELTA:
                            # Tutor audio - send to client and capture if needed
                            delta_b64 = base64.b64encode(event.delta).decode('utf-8') if isinstance(event.delta, bytes) else event.delta
                            
                            await websocket.send(json.dumps({
                                'type': 'audio.delta',
                                'delta': delta_b64
                            }))
                            
                            # Capture tutor audio if we're in capture mode
                            tracker.add_tutor_chunk(delta_b64)
                        
                        elif event.type == ServerEventType.RESPONSE_AUDIO_TRANSCRIPT_DELTA:
                            # We don't need to capture tutor audio anymore since we use TTS for reference
                            pass
                        
                        elif event.type == ServerEventType.RESPONSE_DONE:
                            # Response finished generating/streaming
                            if should_terminate:
                                logger.info("🛑 Session termination requested. Closing connection now that response is done.")
                                # Allow a brief moment for the last audio chunk to flush to client
                                await asyncio.sleep(0.5)
                                await websocket.close()
                                break
                                
                        elif event.type == ServerEventType.RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE:
                            # Model decided to call a tool!
                            if event.name == "assess_pronunciation":
                                try:
                                    logger.info(f"🔍 [INTENTION DETECTED] Model wants to assess pronunciation")
                                    args = json.loads(event.arguments)
                                    word = args.get("word")
                                    call_id = event.call_id  # Store the call_id to respond later
                                    logger.info(f"🛠️ [TOOL CALL] Calling assess_pronunciation(word='{word}', call_id='{call_id}')")
                                    
                                    # Update tracker with the official word from the model
                                    tracker.current_word = word
                                    tracker.pending_call_id = call_id  # Store call_id for later
                                    
                                    # We should have already captured tutor audio (via regex or continuous buffer)
                                    # And user audio should be captured when speech stops
                                    
                                    # Signal that we are ready to analyze
                                    tracker.awaiting_user_pronunciation = True
                                    
                                    # Check if we already have the user audio buffered (timing mismatch fix)
                                    if tracker.last_user_audio:
                                        logger.info(f"⚡ Found buffered user audio for '{word}'. Triggering analysis immediately.")
                                        result = await perform_analysis(word, tracker.last_user_audio)
                                        
                                        # Track attempts
                                        tracker.word_attempts[word] = tracker.word_attempts.get(word, 0) + 1
                                        attempts = tracker.word_attempts[word]
                                        
                                        # Construct message with flow guidance
                                        base_msg = f"Pronunciation analysis complete. Overall similarity: {result.get('overallSimilarity', 0)}%. {result.get('feedback', '')}"
                                        
                                        if attempts >= 2:
                                            flow_guidance = " (Attempt 2/2. Max attempts reached. PLEASE PRAISE EFFORT AND MOVE ON IMMEDIATELY.)"
                                        else:
                                            flow_guidance = f" (Attempt {attempts}/2)"
                                            
                                        final_message = base_msg + flow_guidance

                                        # Send tool output back to Azure
                                        if result and call_id:
                                            # Create output item via SDK
                                            try:
                                                await azure_connection.conversation.item.create(
                                                    item=FunctionCallOutputItem(
                                                        call_id=call_id,
                                                        output=json.dumps({
                                                            "success": True,
                                                            "word": word,
                                                            "similarity": result.get("overallSimilarity", 0),
                                                            "feedback": result.get("feedback", "Analysis complete"),
                                                            "message": final_message,
                                                            "attempt": attempts
                                                        })
                                                    )
                                                )
                                                
                                                # Trigger response generation via SDK with explicit instructions if needed
                                                # Trigger response generation via SDK with explicit instructions if needed
                                                try:
                                                    if attempts >= 2:
                                                        logger.info(f"🚫 Max attempts reached for '{word}'. Terminating session.")
                                                        # Force a goodbye message
                                                        await azure_connection.response.create(
                                                            response={
                                                                "instructions": f"The user has reached the maximum attempts (2) for '{word}'. Briefly praise their effort, say 'Good job! Closing this session now.', and then stop speaking."
                                                            }
                                                        )
                                                        # Signal to close the connection after response (handled by client logic or server closure)
                                                        # We can't easily wait for the audio to finish here before closing if we close immediately.
                                                        # But effectively, if we want to "close the call", we should let the response generate and then close?
                                                        # Or just close immediately? User said "close the voice call", but probably wants to hear the verdict.
                                                        # Best approach: Use a flag to close loop.
                                                        should_terminate = True
                                                    else:
                                                        await azure_connection.response.create()
                                                except Exception as resp_error:
                                                    if "active response" in str(resp_error):
                                                        logger.info("⚠️ Response already active, skipping creation call.")
                                                    else:
                                                        # If error on final response, still terminate
                                                        if attempts >= 2:
                                                            should_terminate = True
                                                        raise resp_error
                                                    
                                                logger.info(f"✅ Sent tool output back to Azure for call_id: {call_id}")
                                            except Exception as e:
                                                logger.error(f"❌ Error sending tool output to Azure: {e}")
                                                import traceback
                                                traceback.print_exc()
                                        
                                        # Clear buffer to avoid re-analyzing
                                        tracker.last_user_audio = None
                                        tracker.awaiting_user_pronunciation = False
                                        tracker.pending_call_id = None
                                    else:
                                        logger.info(f"⏳ Waiting for user audio for '{word}'...")
                                    
                                except json.JSONDecodeError:
                                    logger.error("Failed to decode function arguments")
                            
                            elif event.name == "update_simulation_state":
                                try:
                                    args = json.loads(event.arguments)
                                    call_id = event.call_id
                                    logger.info(f"📊 [TOOL CALL] update_simulation_state(emotion='{args.get('ai_emotional_state')}', progress={args.get('task_progress')})")
                                    
                                    # Send to frontend
                                    await websocket.send(json.dumps({
                                        'type': 'simulation.state_update',
                                        'aiEmotionalState': args.get('ai_emotional_state'),
                                        'taskProgress': args.get('task_progress'),
                                        'feedback': args.get('feedback')
                                    }))
                                    
                                    # Respond to Azure
                                    await azure_connection.conversation.item.create(
                                        item=FunctionCallOutputItem(
                                            call_id=call_id,
                                            output=json.dumps({"success": True})
                                        )
                                    )
                                    await azure_connection.response.create()
                                    logger.info(f"✅ Simulation state updated and synced to frontend")
                                except Exception as e:
                                    logger.error(f"Error handling update_simulation_state: {e}")
                        
                        elif event.type == ServerEventType.RESPONSE_AUDIO_DONE:
                            # Tutor finished speaking
                            tracker.stop_tutor_capture() # Just in case
                            tracker.start_user_capture()
                        
                        elif event.type == ServerEventType.INPUT_AUDIO_BUFFER_SPEECH_STARTED:
                            logger.info("User speech started")
                            # Reset user audio buffer for new utterance
                            tracker.user_audio_chunks = []
                            await websocket.send(json.dumps({
                                'type': 'speech.started'
                            }))
                            
                        elif event.type == ServerEventType.INPUT_AUDIO_BUFFER_SPEECH_STOPPED:
                            logger.info("User speech stopped")
                            
                            tracker.stop_user_capture()
                            
                            # If we were ALREADY waiting for pronunciation (rare case where tool call happened BEFORE speech ended?)
                            # OR if we just want to be safe
                            if tracker.awaiting_user_pronunciation and tracker.current_word and tracker.last_user_audio:
                                logger.info(f"⚡ Speech stopped and we were waiting for '{tracker.current_word}'. Analyzing now.")
                                result = await perform_analysis(tracker.current_word, tracker.last_user_audio)
                                
                                # Track attempts
                                word = tracker.current_word
                                tracker.word_attempts[word] = tracker.word_attempts.get(word, 0) + 1
                                attempts = tracker.word_attempts[word]
                                
                                # Construct message with flow guidance
                                base_msg = f"Pronunciation analysis complete. Overall similarity: {result.get('overallSimilarity', 0)}%. {result.get('feedback', '')}"
                                
                                if attempts >= 2:
                                    flow_guidance = " (Attempt 2/2. Max attempts reached. PLEASE PRAISE EFFORT AND MOVE ON IMMEDIATELY.)"
                                else:
                                    flow_guidance = f" (Attempt {attempts}/2)"
                                    
                                final_message = base_msg + flow_guidance
                                
                                # Send tool output back to Azure
                                if result and tracker.pending_call_id:
                                    # Create output item via SDK
                                    try:
                                        await azure_connection.conversation.item.create(
                                            item=FunctionCallOutputItem(
                                                call_id=tracker.pending_call_id,
                                                output=json.dumps({
                                                    "success": True,
                                                    "word": tracker.current_word,
                                                    "similarity": result.get("overallSimilarity", 0),
                                                    "feedback": result.get("feedback", "Analysis complete"),
                                                    "message": final_message,
                                                    "attempt": attempts
                                                })
                                            )
                                        )
                                        
                                        # Trigger response generation via SDK with explicit instructions if needed
                                        # Trigger response generation via SDK with explicit instructions if needed
                                        try:
                                            if attempts >= 2:
                                                logger.info(f"🚫 Max attempts reached for '{tracker.current_word}'. Terminating session.")
                                                await azure_connection.response.create(
                                                    response={
                                                        "instructions": f"The user has reached the maximum attempts (2) for '{tracker.current_word}'. Briefly praise their effort, say 'Good job! Closing this session now.', and then stop speaking."
                                                    }
                                                )
                                                should_terminate = True
                                            else:
                                                await azure_connection.response.create()
                                        except Exception as resp_error:
                                            if "active response" in str(resp_error):
                                                logger.info("⚠️ Response already active, skipping creation call.")
                                            else:
                                                if attempts >= 2:
                                                    should_terminate = True
                                                raise resp_error
                                            
                                        logger.info(f"✅ Sent tool output back to Azure for call_id: {tracker.pending_call_id}")
                                    except Exception as e:
                                        logger.error(f"❌ Error sending tool output to Azure: {e}")
                                        import traceback
                                        traceback.print_exc()
                                
                                tracker.awaiting_user_pronunciation = False
                                tracker.last_user_audio = None
                                tracker.pending_call_id = None
                            
                        elif event.type == ServerEventType.SESSION_UPDATED:
                            logger.info("✅ Session updated")
                            if hasattr(event, 'session'):
                                logger.info(f"   Model: {event.session.model}")
                                if hasattr(event.session, 'avatar') and event.session.avatar:
                                    logger.info(f"   Avatar Character: {event.session.avatar.character}")
                                    
                                    # Send ICE servers if provided
                                    if hasattr(event.session.avatar, 'ice_servers') and event.session.avatar.ice_servers:
                                        ice_servers_list = []
                                        logger.info(f"   ❄️ ICE Servers provided by Azure: {len(event.session.avatar.ice_servers)}")
                                        for i, ice in enumerate(event.session.avatar.ice_servers):
                                            logger.info(f"     [{i}] {ice.urls}")
                                            # Also log if credentials exist
                                            if hasattr(ice, 'username'):
                                                logger.info(f"         Username: {ice.username}")
                                            
                                            ice_servers_list.append({
                                                'urls': ice.urls,
                                                'username': getattr(ice, 'username', None),
                                                'credential': getattr(ice, 'credential', None)
                                            })
                                        
                                        # Send to client
                                        await websocket.send(json.dumps({
                                            'type': 'session.ice_servers',
                                            'ice_servers': ice_servers_list
                                        }))
                                        logger.info("   📡 ICE servers sent to client")
                        
                        elif event.type == ServerEventType.SESSION_AVATAR_CONNECTING:
                            logger.info("🎬 Session Avatar Connecting - Received Server SDP")
                            if hasattr(event, 'server_sdp'):
                                raw_sdp = event.server_sdp
                                processed_sdp = raw_sdp
                                
                                # Azure sometimes returns wrapped JSON in Base64 for the server_sdp too
                                if raw_sdp and not raw_sdp.startswith("v=0"):
                                    try:
                                        logger.info("🔍 Attempting to decode potentially wrapped Server SDP")
                                        decoded_bytes = base64.b64decode(raw_sdp)
                                        decoded_text = decoded_bytes.decode('utf-8')
                                        try:
                                            payload = json.loads(decoded_text)
                                            if isinstance(payload, dict) and "sdp" in payload:
                                                processed_sdp = payload["sdp"]
                                                logger.info("✅ Successfully extracted SDP from Server JSON wrapper")
                                            else:
                                                processed_sdp = decoded_text
                                        except json.JSONDecodeError:
                                            processed_sdp = decoded_text
                                    except Exception as e:
                                        logger.warning(f"⚠️ Could not decode Server SDP as Base64/JSON: {e}")
                                
                                await websocket.send(json.dumps({
                                    'type': 'session.avatar.answer',
                                    'sdp': processed_sdp
                                }))
                                logger.info("   📡 Answer SDP sent to client")
                            
                        elif event.type == ServerEventType.ERROR:
                            logger.error(f"❌ Azure Error Event: {event.error.message}")
                            if hasattr(event, 'error'):
                                if hasattr(event.error, 'code'):
                                    logger.error(f"   Code: {event.error.code}")
                                if hasattr(event.error, 'type'):
                                    logger.error(f"   Type: {event.error.type}")
                                if hasattr(event.error, 'param'):
                                    logger.error(f"   Param: {event.error.param}")
                                if hasattr(event.error, 'inner_error'):
                                    logger.error(f"   Inner: {event.error.inner_error}")
                            
                except Exception as e:
                    logger.error(f"Error receiving from Azure: {e}")

            # Run both tasks concurrently
            client_task = asyncio.create_task(receive_from_client())
            azure_task = asyncio.create_task(receive_from_azure())
            
            done, pending = await asyncio.wait(
                [client_task, azure_task],
                return_when=asyncio.FIRST_COMPLETED
            )
            
            for task in pending:
                task.cancel()
            
            # Cleanup
            audio_capture.clear_session(session_id)
            
            # End voice tracking session
            await voice_tracker.end_session()
                
    except Exception as e:
        logger.error(f"Connection error: {e}")
        await websocket.close(1011, "Upstream connection error")


async def main():
    logger.info(f"Starting Enhanced Voice Server with Pronunciation Analysis on port {PORT}")
    async with websockets.serve(handle_client, "0.0.0.0", PORT):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
