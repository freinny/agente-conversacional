import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication } from '@azure/msal-browser'
import { msalConfig } from './auth/msalConfig'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'
import App from './App.tsx'

const msalInstance = new PublicClientApplication(msalConfig);

// Ensure MSAL is initialized before rendering
msalInstance.initialize().then(() => {
  console.log("[MSAL] Initialized successfully.");
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MsalProvider>
    </StrictMode>,
  );
}).catch(err => {
  console.error("[MSAL] Initialization failed:", err);
});
