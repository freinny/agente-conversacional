import React from 'react';
import { Mic, MicOff, PhoneOff, Bot, Video, Radio, Activity } from 'lucide-react';

interface AvatarDisplayProps {
    isListening: boolean;
    isSpeaking: boolean;
    onMicClick: () => void;
    onEndCall: () => void;
    onStartCall: () => void;
    stream?: MediaStream | null;
    status?: string;
}

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
    isListening,
    isSpeaking,
    onMicClick,
    onEndCall,
    onStartCall,
    stream,
    status
}) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);

    React.useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(console.error);
        }
    }, [stream]);

    return (
        <div className="max-w-[420px] w-full flex flex-col items-center gap-4 sm:gap-6 sticky top-0">
            {/* Avatar Container */}
            <div className={`relative w-full overflow-hidden bg-[#05080e] shadow-[0_30px_80px_rgba(0,0,0,0.8)] premium-border transition-all duration-700 ${stream ? 'opacity-100 scale-100' : 'opacity-90 scale-[0.98]'} rounded-[32px] aspect-[3/4] max-h-[min(550px,60vh)]`}>
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

                {/* Video Stream or Call Initiation UI */}
                {stream ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover object-top animate-in fade-in zoom-in-95 duration-1000"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-transparent to-black/40">
                        {status === "Conectando..." ? (
                            <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full border-t-2 border-accent-blue animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Radio className="w-7 h-7 text-accent-blue animate-pulse" />
                                    </div>
                                </div>
                                <h3 className="text-white text-lg font-light tracking-wider">Sincronizando...</h3>
                                <p className="text-white/70 text-[10px] leading-relaxed max-w-[200px] font-extralight">Estableciendo enlace neuronal Cinepolis...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center max-w-[280px]">
                                <div className="w-32 h-32 rounded-[24px] bg-white/[0.03] backdrop-blur-3xl flex items-center justify-center mb-6 border border-white/10 group-hover:scale-105 transition-transform duration-700 relative overflow-hidden">
                                    <div className="absolute inset-0 rounded-full bg-accent-blue/5 animate-pulse duration-[4000ms]" />
                                    <img
                                        src="/logos/amalia_glass.png"
                                        className="w-20 h-auto opacity-80 [mix-blend-mode:screen]"
                                        alt="AmalIA"
                                    />
                                </div>

                                <h3 className="text-white text-3xl font-light mb-3 tracking-tighter">Amal<span className="text-accent-blue">IA</span> Core</h3>
                                <p className="text-white/70 text-[11px] mb-8 leading-relaxed font-medium">
                                    Socia de Operación Virtual <br /> Núcleo de Analítica de Nueva Gen
                                </p>

                                <button
                                    onClick={onStartCall}
                                    className="bg-white text-premium-slate px-8 py-3.5 rounded-2xl font-light tracking-[0.05em] text-[10px] hover:bg-accent-blue hover:text-white transition-all duration-500 shadow-2xl active:scale-95 flex items-center gap-3 group"
                                >
                                    <Bot className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                    Iniciar sesión
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Status HUD Overlays */}
                <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
                    <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-3xl px-4 py-1.5 rounded-xl border border-white/20 shadow-xl">
                        <div className={`w-2 h-2 rounded-full ${stream ? 'bg-accent-blue shadow-[0_0_12px_rgba(0,210,255,1)]' : 'bg-white/40'}`} />
                        <span className="text-[8px] font-light text-white tracking-[0.05em] leading-none">
                            {status === "En línea" ? "en línea" : (status || "fuera de línea")}
                        </span>
                    </div>
                </div>

                <div className="absolute top-6 right-6 z-20 flex gap-2">
                    {stream && (
                        <div className="bg-white/5 backdrop-blur-3xl px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2.5 shadow-xl">
                            <Video className="w-3.5 h-3.5 text-accent-blue" />
                            <div className="flex gap-1 h-2.5">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-[1.5px] bg-accent-blue/40 rounded-full animate-pulse" style={{ height: '100%', animationDelay: `${i * 150}ms` }} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Status Indicators (Listening/Speaking) */}
                {stream && (
                    <div className="absolute inset-x-6 bottom-24 z-20 flex justify-between items-end pointer-events-none">
                        <StatusPill isListening={isListening} isSpeaking={isSpeaking} />
                        {isSpeaking && (
                            <div className="flex items-end gap-1 mb-1">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="w-1 bg-accent-blue/80 rounded-full animate-bounce" style={{ height: `${10 + Math.random() * 20}px`, animationDelay: `${i * 0.1}s` }} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Light/Reflect layer */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Controls */}
            {(stream || status === "Conectando...") && (
                <div className="flex items-center gap-4 sm:gap-6 animate-in slide-in-from-bottom-6 duration-700">
                    {stream && (
                        <button
                            onClick={onMicClick}
                            className={`
                                w-16 h-16 rounded-[24px] flex items-center justify-center transition-all duration-500 shadow-xl relative group
                                ${isListening
                                    ? 'bg-red-500 shadow-red-500/30 ring-6 ring-red-500/10 scale-105'
                                    : 'bg-white/5 hover:bg-white/10 backdrop-blur-3xl border border-white/10'}
                            `}
                        >
                            {isListening ? (
                                <MicOff className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                            ) : (
                                <Mic className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                            )}
                            {isListening && <div className="absolute inset-0 rounded-[24px] border-2 border-white/30 animate-ping pointer-events-none" />}
                        </button>
                    )}

                    <button
                        onClick={onEndCall}
                        className="w-12 h-12 rounded-[20px] bg-white/5 backdrop-blur-3xl border border-white/5 hover:bg-red-500/20 hover:border-red-500/50 flex items-center justify-center transition-all duration-500 text-white/30 hover:text-red-500 group shadow-lg"
                        title="Disconnect"
                    >
                        <PhoneOff className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    </button>
                </div>
            )}
        </div>
    );
};

const StatusPill = ({ isListening, isSpeaking }: { isListening: boolean; isSpeaking: boolean }) => {
    if (isListening) return (
        <div className="px-7 py-4 bg-red-500/90 backdrop-blur-3xl text-white text-xs font-light tracking-[0.05em] rounded-2xl border border-white/20 flex items-center gap-4 animate-in slide-in-from-left-6 shadow-2xl">
            <Activity className="w-5 h-5 animate-pulse" />
            Señal bio: escuchando
        </div>
    );
    if (isSpeaking) return (
        <div className="px-7 py-4 bg-accent-blue/90 backdrop-blur-3xl text-white text-xs font-light tracking-[0.05em] rounded-2xl border border-white/20 flex items-center gap-4 animate-in slide-in-from-left-6 shadow-2xl">
            <Radio className="w-5 h-5 animate-pulse" />
            Voz sintética: activa
        </div>
    );
    return null;
};

