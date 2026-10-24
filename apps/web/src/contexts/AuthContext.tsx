import { createContext, useContext, type ReactNode, useEffect, useState } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { type AccountInfo } from '@azure/msal-browser';

interface AuthContextType {
    isAuthenticated: boolean;
    user: AccountInfo | null;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { instance, accounts, inProgress } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const [user, setUser] = useState<AccountInfo | null>(null);

    useEffect(() => {
        if (accounts.length > 0) {
            setUser(accounts[0]);
        } else {
            setUser(null);
        }
    }, [accounts, inProgress, isAuthenticated]);

    const logout = () => {
        instance.logoutRedirect({
            postLogoutRedirectUri: '/',
        });
    };

    const isLoading = inProgress !== 'none';

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            user,
            logout,
            isLoading
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
