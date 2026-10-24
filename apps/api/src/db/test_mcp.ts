import dotenv from 'dotenv';
import path from 'path';
// Load .env from root of the project
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { listDataverseTools, callDataverseMcpTool } from './mcp_client';

async function test() {
    console.log("🧪 Testing Dataverse MCP Client...");
    try {
        const tools = await listDataverseTools();
        console.log(`🛠️ Native Dataverse Tools: ${tools.tools.map((t: any) => t.name).join(", ")}`);

        console.log("📊 Testing 'read_query' via MCP...");
        console.log("📊 Testing 'read_query' via MCP...");
        const queryResult = await callDataverseMcpTool("tools/call", {
            name: "read_query",
            arguments: {
                querytext: "SELECT * FROM amalia_banktransaction"
            }
        });
        if (queryResult.isError) {
            console.log("❌ Result Error:", queryResult.content[0].text);
        } else {
            console.log("📄 Query Result Success:", JSON.stringify(queryResult.content, null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error("💀 MCP Test failed:", err);
        process.exit(1);
    }
}

test();
