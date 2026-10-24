import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { getAccessToken } from './dataverse';

async function test() {
    const dataverseUrl = process.env.DATAVERSE_URL;
    const token = await getAccessToken();
    const mcpUrl = `${dataverseUrl}/api/mcp_preview`;

    try {
        const initMsg = {
            jsonrpc: "2.0", id: 1, method: "initialize",
            params: {
                protocolVersion: "2024-11-05", capabilities: {},
                clientInfo: { name: "amalia-test", version: "1.0.0" }
            }
        };
        const mcpResp = await fetch(mcpUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(initMsg)
        });
        await mcpResp.json();
        console.log("🎉 MCP Initialized!");

        // List Tools
        const listMsg = {
            jsonrpc: "2.0", id: 2, method: "tools/list", params: {}
        };
        const listResp = await fetch(mcpUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(listMsg)
        });
        const listData = await listResp.json();
        console.log("🛠️ Tools:", JSON.stringify(listData.result.tools, null, 2));

    } catch (e: any) {
        console.error("💀 Error:", e.message);
    }
}

test();
