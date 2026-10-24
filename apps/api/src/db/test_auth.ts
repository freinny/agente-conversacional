import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { dataverseRequest } from './dataverse';

async function test() {
    console.log("🧪 Testing Basic Dataverse Web API (WhoAmI)...");
    try {
        const response = await dataverseRequest('GET', 'WhoAmI');
        console.log("🎉 Web API Auth successful!");
        console.log("BusinessUnitId:", response.data.BusinessUnitId);
        console.log("UserId:", response.data.UserId);
        console.log("OrganizationId:", response.data.OrganizationId);

        console.log("🧪 Testing MCP Endpoint via Axios (GET)...");
        try {
            const mcpResp = await dataverseRequest('GET', '../../mcp_preview');
            // Note: dataverseRequest appends /api/data/v9.2/. mcp is usually at /api/mcp_preview
            console.log("🎉 MCP Endpoint accessible via Axios!");
            console.log(`Status: ${mcpResp.status}`);
        } catch (mcpErr: any) {
            console.error("💀 MCP Endpoint failed via Axios:");
            if (mcpErr.response) {
                console.error(`Status: ${mcpErr.response.status}`);
                console.error(`Headers: ${JSON.stringify(mcpErr.response.headers, null, 2)}`);
            } else {
                console.error(mcpErr.message);
            }
        }
        process.exit(0);
    } catch (err: any) {
        console.error("💀 Web API Auth failed:");
        if (err.response) {
            console.error(`Status: ${err.response.status}`);
            console.error(`Data: ${JSON.stringify(err.response.data, null, 2)}`);
        } else {
            console.error(err.message);
        }
        process.exit(1);
    }
}

test();
