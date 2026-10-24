import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { callDataverseMcpTool } from './mcp_client';

async function testNLQuery() {
    const prompt = "lista las solicitudes de caja chica hechas por Laura Cruz";
    console.log(`🧪 Testing Natural Language Query via MCP: "${prompt}"`);

    try {
        console.log("📊 Calling 'search' tool with appUniqueName: 'msdynce_saleshub'...");
        const result = await callDataverseMcpTool("tools/call", {
            name: "search",
            arguments: {
                querytext: prompt,
                appUniqueName: "msdynce_saleshub"
            }
        });

        if (result.isError) {
            console.error("❌ NL Query Error:", result.content[0].text);
        } else {
            console.log("✅ NL Query Success!");
            console.log("📄 Content:", JSON.stringify(result.content, null, 2));

            // If empty, try a more direct search for the person name
            if (result.content[0].text === "[]") {
                console.log("\n⚠️ Result was empty. Retrying with just 'Laura Cruz'...");
                const result2 = await callDataverseMcpTool("tools/call", {
                    name: "search",
                    arguments: {
                        querytext: "Laura Cruz",
                        appUniqueName: "msdynce_saleshub"
                    }
                });
                console.log("📄 Retry Content:", JSON.stringify(result2.content, null, 2));
            }
        }

        process.exit(0);
    } catch (err) {
        console.error("💀 Test failed:", err);
        process.exit(1);
    }
}

testNLQuery();
