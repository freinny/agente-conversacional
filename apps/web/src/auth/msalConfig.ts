import { type Configuration, type PopupRequest, LogLevel } from '@azure/msal-browser';

export const msalConfig: Configuration = {
    auth: {
        clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
        redirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: 'localStorage',
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    console.log("[MSAL PII]", message);
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        console.error("[MSAL Error]", message);
                        return;
                    case LogLevel.Info:
                        console.info("[MSAL Info]", message);
                        return;
                    case LogLevel.Verbose:
                        console.debug("[MSAL Verbose]", message);
                        return;
                    case LogLevel.Warning:
                        console.warn("[MSAL Warning]", message);
                        return;
                    default:
                        return;
                }
            },
            piiLoggingEnabled: true,
            logLevel: LogLevel.Verbose
        }
    }
};

export const loginRequest: PopupRequest = {
    scopes: ['User.Read', 'email', 'profile', 'openid']
};
