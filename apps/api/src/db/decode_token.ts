import { getAccessToken } from './dataverse';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function decode() {
    try {
        const token = await getAccessToken();
        const parts = token.split('.');
        if (parts.length !== 3) {
            console.log("Invalid JWT format");
            return;
        }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log("🔑 Token Payload:", JSON.stringify(payload, null, 2));
    } catch (e) {
        console.error(e);
    }
}
decode();
