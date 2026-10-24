import type React from 'react';
import { useState, useEffect } from 'react';
import { UserProfile } from './UserProfile';

interface LayoutProps {
    children: React.ReactNode;
    isAnimating?: boolean;
    activeTool?: string | null;
}

export const Layout: React.FC<LayoutProps> = ({ children, isAnimating: propIsAnimating = false, activeTool = null }) => {
    const [isTestAnimating, setIsTestAnimating] = useState(false);
    const isAnimating = propIsAnimating || isTestAnimating;

    useEffect(() => {
        const handleTest = () => {
            setIsTestAnimating(true);
            setTimeout(() => setIsTestAnimating(false), 5000); // 5 sec test
        };
        window.addEventListener('test-animation', handleTest);
        return () => window.removeEventListener('test-animation', handleTest);
    }, []);

    return (
        <div className="h-screen bg-premium-slate flex flex-col font-sans text-white relative overflow-hidden" style={{ fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif' }}>
            {/* Google Font Import */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                
                @keyframes pulse-connectivity {
                    0% { opacity: 0.3; stroke-dashoffset: 20; stroke: #00D2FF; }
                    50% { opacity: 1; stroke-dashoffset: 0; stroke: #34d399; }
                    100% { opacity: 0.3; stroke-dashoffset: -20; stroke: #00D2FF; }
                }
            `}} />

            {/* Ultra-Contrast Top Decorative Bar */}
            <div className="h-1 w-full premium-gradient z-[60] fixed top-0 left-0 shadow-[0_2px_10px_rgba(0,210,255,0.4)]" />

            {/* High-Contrast Info Bar */}
            <div className="h-8 w-full bg-white/[0.03] backdrop-blur-md border-b border-white/10 z-50 fixed top-1 left-0 flex items-center px-10">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
                        <span className="text-[10px] font-light tracking-[0.05em] text-white/70">Estado: activo</span>
                    </div>
                    <div className="h-3 w-[1px] bg-white/20" />
                    <span className="text-[10px] font-light tracking-[0.05em] text-white/70">Nodo: Cinepolis-CDMX</span>
                </div>
                <div className="ml-auto flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-light tracking-[0.05em] text-accent-blue">Entra ID secured</span>
                    </div>
                    <div className="h-4 w-[1px] bg-white/20" />
                    <UserProfile />
                </div>
            </div>

            {/* Background decorative glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-blue/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-purple/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Header */}
            <header className="px-4 sm:px-10 py-3 sm:py-4 flex justify-between items-center z-10 pt-12 sm:pt-14">
                <div className="flex items-center gap-6">
                    <div className="relative group cursor-pointer flex items-center gap-3">
                        <div className="absolute -inset-4 bg-accent-blue/10 blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-full" />
                        <img
                            src="/logos/amalia_glass.png"
                            alt="AmalIA"
                            className="h-14 w-auto object-contain relative z-10 hover:scale-105 transition-transform duration-500 [mix-blend-mode:screen]"
                        />
                        <div className="flex flex-col relative z-10">
                            <span className="text-3xl font-black tracking-tighter text-white">
                                Amal<span className="text-accent-blue">IA</span>
                            </span>
                            <p className="text-white/40 font-bold text-[7px] tracking-[0.2em] uppercase mt-[-4px]">
                                Powered by <span className="text-white/60">Azure</span>
                            </p>
                        </div>
                    </div>
                    <div className="hidden lg:block">
                        <div className="flex items-baseline gap-2 mb-0.5">
                            <p className="text-white font-light text-sm tracking-wider">
                                Gestor de operación virtual
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <p className="text-accent-blue/70 font-extralight text-[9px] tracking-[0.05em]">
                                Capa de orquestación AI
                            </p>
                        </div>
                    </div>
                </div>

                {/* Cinema Directory Visual Aid */}
                <div className="hidden xl:flex items-center gap-4 bg-white/[0.04] border border-white/10 px-8 py-3 rounded-full backdrop-blur-xl transition-all shadow-2xl">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.1em] border-r border-white/10 pr-6">Directorio de Cines</span>
                    <div className="flex gap-6">
                        <CinemaLabel city="Puebla" code="CINE-PUE" />
                        <CinemaLabel city="CDMX" code="CINE-CDMX" />
                        <CinemaLabel city="Monterrey" code="CINE-MTY" />
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2 mr-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                        <span className="text-[9px] font-light text-white/40 tracking-[0.05em]">
                            Fuentes de datos conectadas
                        </span>
                    </div>

                    {/* Integrated Data Panel */}
                    <div className="flex items-start gap-3 p-1 bg-white/[0.02] border border-white/5 rounded-[2rem] backdrop-blur-2xl pr-6">
                        {/* ERP + MCP Vertical Stack (Connection Target) */}
                        <div className="flex flex-col items-center gap-6 relative p-1.5">
                            <ToolBadge name="ERP" src="/logos/dataverse.png" highlight={isAnimating} />

                            {/* Animated Connectivity Line (Vertical) */}
                            <div className={`absolute top-[42px] left-1/2 -ml-[1px] w-[2px] h-[24px] z-10 overflow-visible transition-all duration-700 origin-top ${isAnimating ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'}`}>
                                <svg width="2" height="24" className="overflow-visible">
                                    <line x1="1" y1="0" x2="1" y2="24" stroke="#00D2FF" strokeWidth="2.5" strokeDasharray="4 6" style={{ animation: isAnimating ? 'pulse-connectivity 1s infinite linear' : 'none' }} />
                                    {/* Moving Glow Dot */}
                                    {isAnimating && (
                                        <circle r="3" fill="#00D2FF">
                                            <animate attributeName="cy" from="0" to="24" dur="1s" repeatCount="indefinite" />
                                            <animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite" />
                                        </circle>
                                    )}
                                </svg>
                            </div>

                            <ToolBadge name="MCP Server" src="/logos/mcp_premium.png" highlight={isAnimating} />
                        </div>

                        {/* Other Sources (Horizontal Row) */}
                        <div className="flex gap-2.5 pt-1.5">
                            <ToolBadge name="RAG" src="/logos/rag_premium.png" highlight={isAnimating && activeTool === 'tool_supplier_rag'} />
                            <ToolBadge name="CRM" src="/logos/crm.png" />
                            <ToolBadge name="Dataverse" src="/logos/powerautomate.png" />
                            <ToolBadge name="Mail" src="/logos/email_premium.png" highlight={isAnimating && (activeTool === 'tool_draft_email' || activeTool === 'tool_send_email')} />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-row overflow-auto p-4 sm:p-8 pt-2 gap-8 z-10 min-h-0">
                <div className="flex flex-row gap-8 w-fit min-w-full">
                    {children}
                </div>
            </main>

        </div>
    );
};

const ToolBadge = ({ name, src, highlight = false }: { name: string; src: string; highlight?: boolean }) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 group cursor-pointer ${highlight ? 'bg-accent-blue/20 border-accent-blue shadow-[0_0_15px_rgba(0,210,255,0.3)] scale-105' : 'bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/20'}`}>
        <div className="w-5 h-5 flex items-center justify-center relative">
            <div className={`absolute inset-0 rounded-full blur-sm transition-all ${highlight ? 'bg-accent-blue/40 opacity-100 animate-pulse' : 'bg-white/5 opacity-0 group-hover:opacity-100 group-hover:bg-accent-blue/20'}`} />
            <img src={src} alt={name} className={`w-full h-full object-contain relative z-10 transition-all scale-90 group-hover:scale-100 ${highlight ? 'opacity-100 scale-110 filter drop-shadow-[0_0_5px_#00d2ff]' : 'opacity-60 group-hover:opacity-100'}`} />
        </div>
        <span className={`text-[9px] font-light tracking-[0.1em] transition-colors ${highlight ? 'text-white' : 'text-white/40 group-hover:text-white'}`}>
            {name}
        </span>
    </div>
);

const CinemaLabel = ({ city, code }: { city: string; code: string }) => (
    <div className="flex flex-col gap-0.5 group cursor-help">
        <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-blue/50 group-hover:bg-accent-blue transition-all group-hover:scale-125" />
            <span className="text-[11px] font-light text-white/70 group-hover:text-white transition-colors">{city}</span>
        </div>
        <span className="text-[8px] font-extralight text-white/30 tracking-wider ml-3.5 transition-colors group-hover:text-white/50">{code}</span>
    </div>
);
