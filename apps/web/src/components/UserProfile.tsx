import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';

export function UserProfile() {
    const { user, logout } = useAuth();

    if (!user) return null;

    return (
        <div className="flex items-center gap-4 px-2 py-1 hover:bg-white/5 transition-all duration-300 rounded-lg">
            <div className="flex flex-col items-end">
                <span className="text-white/90 text-xs font-light leading-tight">{user.name}</span>
                <span className="text-[9px] text-white/40 font-extralight tracking-wider">{user.username}</span>
            </div>
            <div className="w-[1px] h-6 bg-white/10" />
            <button
                onClick={logout}
                className="p-1.5 rounded-full hover:bg-red-500/20 group transition-all duration-300"
                title="Cerrar sesión"
            >
                <LogOut size={14} className="text-white/50 group-hover:text-red-400" />
            </button>
        </div>
    );
}
