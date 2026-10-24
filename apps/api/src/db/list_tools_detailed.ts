import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { listDataverseTools } from './mcp_client';

async function listToolsDetailed() {
    console.log("🧪 Listing Dataverse MCP Tools with Full Detail...");
    try {
        const tools = await listDataverseTools();
        console.log("🛠️ Tools Detail:");
        console.log(JSON.stringify(tools, null, 2));
        process.exit(0);
    } catch (err) {
        console.error("💀 Failed to list tools:", err);
        process.exit(1);
    }
}

listToolsDetailed();
