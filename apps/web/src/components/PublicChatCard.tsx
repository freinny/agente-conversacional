import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Loader2 } from 'lucide-react';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

interface PublicChatCardProps {
    onClose: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const PublicChatCard: React.FC<PublicChatCardProps> = ({ onClose }) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'Hola, soy el asistente público de AmalIA. Puedo ayudarte con dudas sobre nuestra documentación y manuales (RAG). ¿En qué puedo apoyarte?',
            sender: 'bot',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userText: input,
                    isPublic: true // Restricted mode
                })
            });
            const data = await res.json();

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: data.assistantText || 'Lo siento, tuve un problema procesando tu solicitud.',
                sender: 'bot',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: 'Error de conexión. Por favor intenta más tarde.',
                sender: 'bot',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-24 right-10 w-80 sm:w-96 h-[500px] bg-black/60 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-500 z-50">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center border border-accent-blue/30">
                        <Bot size={16} className="text-accent-blue" />
                    </div>
                    <div>
                        <h4 className="text-white text-xs font-bold tracking-tight">AmalIA Public Chat</h4>
                        <span className="text-[10px] text-accent-blue/70 font-medium">Solo consultas RAG</span>
                    </div>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40">
                    <X size={16} />
                </button>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
            >
                {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-[12px] leading-relaxed ${m.sender === 'user'
                                ? 'bg-accent-blue text-white rounded-tr-none'
                                : 'bg-white/5 text-white/90 border border-white/10 rounded-tl-none'
                            }`}>
                            {m.text}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white/5 border border-white/10 p-3 rounded-2xl rounded-tl-none">
                            <Loader2 size={14} className="text-accent-blue animate-spin" />
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white/5 border-t border-white/10">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Pregunta sobre manuales..."
                        className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 pl-4 pr-12 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-accent-blue/50 transition-all"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-accent-blue/20 flex items-center justify-center text-accent-blue hover:bg-accent-blue hover:text-white disabled:opacity-30 transition-all"
                    >
                        <Send size={14} />
                    </button>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 grayscale brightness-50 opacity-40">
                    <img src="/logos/amalia_glass.png" alt="Amalia" className="h-3 w-auto" />
                    <span className="text-[8px] text-white font-bold uppercase tracking-widest">Secured Layer</span>
                </div>
            </div>
        </div>
    );
};
