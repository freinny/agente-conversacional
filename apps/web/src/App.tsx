import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { AvatarDisplay } from './components/AvatarDisplay';
import { EvidencePanel } from './components/EvidencePanel';
import type { EvidenceItem, ChatResponse } from '@repo/shared';
import { useAzureSpeech } from './hooks/useAzureSpeech';
import { Send, Cpu } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const {
    speak,
    startListening,
    recognizing,
    speaking,
    connectAvatar,
    disconnectAvatar,
    avatarStream,
    status,
    evidence: azureEvidence,
    transcript: azureTranscript,
    isExecutingTool,
    activeToolName
  } = useAzureSpeech();

  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [assistantText, setAssistantText] = useState("");
  const [isIdle, setIsIdle] = useState(true);
  const [inputText, setInputText] = useState("");
  const [isGreetingPending, setIsGreetingPending] = useState(false);

  // Sync state from Azure Hook
  useEffect(() => {
    if (status === "En línea") {
      if (azureEvidence.length > 0) setEvidence(azureEvidence);
      if (azureTranscript) setAssistantText(azureTranscript);

      // Trigger pending greeting
      if (isGreetingPending) {
        setIsGreetingPending(false);
        const text = "¡Hola Aminael! Soy AmalIA, tu socia de operación virtual. Estoy conectada a Productivity, Petty Cash, Conciliaciones y cuento con toda la documentación oficial para proveedores.";
        setAssistantText(text);
        speak(text);
      }
    }
  }, [azureEvidence, azureTranscript, status, isGreetingPending, speak]);

  useEffect(() => {
    // Initial welcome message (static)
    setAssistantText("AmalIA Core está activo. Inicia una sesión para comenzar.");
    setIsIdle(true);
  }, []);

  const handleStartCall = async () => {
    setIsIdle(false);
    setIsGreetingPending(true);
    connectAvatar();
  };

  const handleMicClick = () => {
    setIsIdle(false);
    startListening((text) => {
      handleProcessText(text);
    });
  };

  const handleEndCall = () => {
    disconnectAvatar();
    setEvidence([]);
    setAssistantText("Sesión finalizada. AmalIA está en modo de espera.");
    setIsIdle(true);
  };

  const handleProcessText = async (text: string) => {
    if (!text.trim()) return;
    setIsIdle(false);

    // Check if Avatar is Connected
    if (status === "En línea") {
      console.log('[App] 🤖 Routing text through AmalIA Session');
      speak(text);
      return;
    }

    // Fallback to legacy REST API for offline/text-only mode
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText: text })
      });
      const data: ChatResponse = await res.json();

      setAssistantText(data.assistantText);
      setEvidence(data.evidence || []);

      if (data.audio?.ttsText) {
        speak(data.audio.ttsText);
      }
    } catch (e) {
      console.error(e);
      setAssistantText("Excepción en enlace de datos.");
      speak("Lo siento, tuve un problema conectando con el núcleo de datos.");
    }
  };

  const handleSendText = () => {
    handleProcessText(inputText);
    setInputText("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-premium-slate flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent-blue/20 border-t-accent-blue rounded-full animate-spin" />
          <span className="text-white/40 text-xs font-light tracking-wider">Validando acceso...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Layout isAnimating={isExecutingTool} activeTool={activeToolName}>
      {/* Left Panel: Avatar - Constrained */}
      <div className="flex-[0.35] min-w-[380px] flex justify-center items-start h-fit sticky top-0">
        <AvatarDisplay
          isListening={recognizing}
          isSpeaking={speaking}
          onMicClick={handleMicClick}
          onEndCall={handleEndCall}
          onStartCall={handleStartCall}
          stream={avatarStream}
          status={status}
        />
      </div>

      {/* Right Panel: Evidence - Constrained */}
      <div className="flex-[0.65] min-w-[600px] flex flex-col justify-between min-h-full">
        <EvidencePanel
          evidence={evidence}
          assistantText={assistantText}
          isIdle={isIdle}
        />

        {/* Compact Input Area */}
        <div className="mt-3 flex flex-col gap-2">
          <div className="relative group">
            <input
              type="text"
              className="w-full glass-input pr-14 py-3 text-[13px] text-white placeholder:text-white/50 font-medium tracking-wide shadow-2xl group-hover:bg-white/10 transition-all duration-300"
              placeholder="Escribe una consulta para AmalIA..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            />
            <button
              onClick={handleSendText}
              disabled={!inputText.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-accent-blue/20 flex items-center justify-center text-accent-blue hover:bg-accent-blue hover:text-white disabled:opacity-0 transition-all duration-300"
            >
              <Send size={14} />
            </button>
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className={`w-1 h-1 rounded-full ${status ? 'bg-accent-blue animate-pulse' : 'bg-white/40'}`} />
              <span className="text-[7.5px] font-extralight text-white/60 tracking-[0.05em]">Enlace: {status === "En línea" ? "en línea" : (status || "fuera de línea")}</span>
            </div>
            {/* hidden test trigger */}
            <div
              className="flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity cursor-help"
              onClick={() => {
                console.log("[Test] Toggling connectivity animation");
                // We'll use a hacky way to trigger it if we don't want to add more states
                const event = new CustomEvent('test-animation');
                window.dispatchEvent(event);
              }}
            >
              <Cpu size={9} className="text-accent-blue" />
              <span className="text-[7.5px] font-extralight text-white/60 tracking-[0.05em]">Verificar flujo ERP</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default App;
