import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { callDataverseMcpTool } from './mcp_client';

async function testPettyCashHistory() {
    console.log("🧪 Testing Petty Cash History Retrieval via MCP...");
    try {
        // First describe the table to be 100% sure of the schema seen by MCP
        console.log("🔍 Describing 'new_pettycashrequests'...");
        const describeResult = await callDataverseMcpTool("tools/call", {
            name: "describe_table",
            arguments: {
                tablename: "new_pettycashrequests"
            }
        });
        console.log("📄 Table Description:", JSON.stringify(describeResult.content, null, 2));

        console.log("\n📊 Running SQL query for petty cash history...");
        // The MCP read_query tool expects 'querytext'
        const queryResult = await callDataverseMcpTool("tools/call", {
            name: "read_query",
            arguments: {
                querytext: "SELECT new_requestid, new_requestername, new_amount, new_status, new_requestedat FROM new_pettycashrequests"
            }
        });

        if (queryResult.isError) {
            console.error("❌ Query Error:", queryResult.content[0].text);
        } else {
            console.log("✅ Query Success!");
            console.log("📄 Content:", JSON.stringify(queryResult.content, null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error("💀 Test failed:", err);
        process.exit(1);
    }
}

testPettyCashHistory();
