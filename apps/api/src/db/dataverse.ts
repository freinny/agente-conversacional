import axios from 'axios';
import * as msal from '@azure/msal-node';

let cca: msal.ConfidentialClientApplication | null = null;

function getCCA() {
    if (cca) return cca;

    const tenantId = process.env.DATAVERSE_TENANT_ID;
    const clientId = process.env.DATAVERSE_CLIENT_ID;
    const clientSecret = process.env.DATAVERSE_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
        throw new Error('❌ Missing Dataverse configuration in .env. Ensure dotenv.config() is called before getAccessToken().');
    }

    const msalConfig = {
        auth: {
            clientId: clientId,
            authority: `https://login.microsoftonline.com/${tenantId}/v2.0`,
            clientSecret: clientSecret,
        }
    };

    cca = new msal.ConfidentialClientApplication(msalConfig);
    return cca;
}

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function getAccessToken(): Promise<string> {
    const dataverseUrl = process.env.DATAVERSE_URL;
    if (!dataverseUrl) throw new Error('❌ DATAVERSE_URL not set');

    const now = Date.now();
    if (cachedToken && now < tokenExpiry) {
        return cachedToken;
    }

    const tokenRequest = {
        scopes: [`${dataverseUrl}/.default`],
    };

    try {
        const ccaInstance = getCCA();
        const response = await ccaInstance.acquireTokenByClientCredential(tokenRequest);
        if (response && response.accessToken) {
            console.log(`🔑 Token acquired successfully. Starts with: ${response.accessToken.substring(0, 10)}...`);
            cachedToken = response.accessToken;
            // Set expiry with a 5-minute safety margin
            tokenExpiry = response.expiresOn ? response.expiresOn.getTime() - (5 * 60 * 1000) : now + (3500 * 1000);
            return cachedToken;
        }
        throw new Error('Failed to acquire access token');
    } catch (error) {
        console.error('❌ Error acquiring Dataverse token:', error);
        throw error;
    }
}

export async function dataverseRequest(method: string, path: string, data?: any) {
    const dataverseUrl = process.env.DATAVERSE_URL;
    if (!dataverseUrl) throw new Error('❌ DATAVERSE_URL not set');

    const token = await getAccessToken();
    const url = `${dataverseUrl}/api/data/v9.2/${path}`;

    try {
        const response = await axios({
            method,
            url,
            data,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
            }
        });
        return response.data;
    } catch (error: any) {
        console.error(`❌ Dataverse Request Error [${method} ${path}]:`, error.response?.data || error.message);
        throw error;
    }
}
