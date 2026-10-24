import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../auth/msalConfig';
import { MessageSquare, Bot } from 'lucide-react';
import { PublicChatCard } from './PublicChatCard';

export function LoginPage() {
    const { instance } = useMsal();
    const [isChatOpen, setIsChatOpen] = useState(false);

    const handleLogin = async () => {
        try {
            await instance.loginRedirect(loginRequest);
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat relative overflow-hidden font-sans"
            style={{ backgroundImage: 'url(/futuristic_background.png)' }}>

            {/* Alfapeople Logo - Upper Right */}
            <div className="absolute top-8 right-10 z-20 animate-fade-in flex items-center gap-4" style={{ animationDelay: '0.8s' }}>
                <span className="text-[10px] font-extralight text-white/30 tracking-wider italic">A product by</span>
                <img
                    src="/alfapeople_logo.png"
                    alt="AlfaPeople"
                    className="h-10 w-auto opacity-60 hover:opacity-100 transition-opacity duration-700"
                />
            </div>

            {/* Public Chat Toggle */}
            <div className="absolute bottom-8 right-10 z-50">
                <button
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className="w-14 h-14 rounded-full bg-white/5 border border-white/10 backdrop-blur-2xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 hover:scale-110 transition-all duration-500 group shadow-2xl overflow-hidden relative"
                >
                    <div className="absolute inset-0 bg-accent-blue/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Bot className={`w-6 h-6 z-10 transition-all duration-500 ${isChatOpen ? 'scale-0' : 'scale-100'}`} />
                    <div className={`absolute inset-0 flex items-center justify-center z-10 transition-all duration-500 ${isChatOpen ? 'scale-100' : 'scale-0 rotate-90'}`}>
                        <MessageSquare className="w-6 h-6" />
                    </div>
                </button>
            </div>

            {isChatOpen && (
                <PublicChatCard onClose={() => setIsChatOpen(false)} />
            )}

            {/* Dynamic Overlay for Depth and Cinematic feel */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/20 to-black/60 backdrop-blur-[2px]" />

            {/* Holographic light effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-blue/5 blur-[120px] rounded-full animate-pulse pointer-events-none" />

            <div className="flex flex-col items-center relative z-10 animate-fade-in w-full px-8">

                <div className="mb-20 text-center">
                    <h1 className="text-7xl font-extralight text-white mb-4 tracking-tighter filter drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                        Amalia <span className="font-light text-accent-blue">Core</span>
                    </h1>
                    <div className="flex items-center justify-center gap-4">
                        <div className="h-[1px] w-8 bg-white/20" />
                        <p className="text-white/40 text-[12px] font-extralight tracking-[0.6em]">
                            Powered by <span className="text-white/90 font-light">Azure</span>
                        </p>
                        <div className="h-[1px] w-8 bg-white/20" />
                    </div>
                </div>

                {/* Interaction Section */}
                <div className="flex flex-col items-center gap-10 group">
                    <button
                        onClick={handleLogin}
                        className="flex flex-col items-center gap-6 transition-all duration-700 hover:scale-110 active:scale-95"
                    >
                        {/* Minimal Microsoft Action Hub */}
                        <div className="relative">
                            {/* Outer Glow Ring */}
                            <div className="absolute -inset-4 bg-white/0 border border-white/0 rounded-[2.5rem] transition-all duration-700 group-hover:bg-white/5 group-hover:border-white/10 group-hover:backdrop-blur-3xl" />

                            <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-center backdrop-blur-2xl transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] group-hover:shadow-[0_0_40px_rgba(0,210,255,0.2)] group-hover:border-white/30 relative z-10">
                                <svg className="w-12 h-12" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                                    <path fill="#f3725e" d="M0 0h11.5v11.5H0z" />
                                    <path fill="#7fb900" d="M11.5 0H23v11.5H11.5z" />
                                    <path fill="#00a4ef" d="M0 11.5h11.5V23H0z" />
                                    <path fill="#ffb900" d="M11.5 11.5H23V23H11.5z" />
                                </svg>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <span className="text-white/40 text-[14px] font-extralight tracking-[0.1em] group-hover:text-white transition-all duration-700">
                                Login with Microsoft
                            </span>
                            <div className="h-[2px] w-0 bg-accent-blue transition-all duration-700 group-hover:w-full rounded-full shadow-[0_0_10px_#00d2ff]" />
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
