import { getAccessToken } from "./dataverse";
import axios from "axios";

export interface McpToolResponse {
    result?: {
        content: Array<{
            type: string;
            text: string;
        }>;
    };
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

export async function callDataverseMcpTool(method: string, params: any = {}): Promise<any> {
    const dataverseUrl = process.env.DATAVERSE_URL;
    if (!dataverseUrl) throw new Error("❌ DATAVERSE_URL not set");

    const token = await getAccessToken();
    const url = `${dataverseUrl}/api/mcp_preview`; // Using preview for latest tools

    const body = {
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params
    };

    try {
        const response = await axios.post<McpToolResponse>(url, body, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (response.data.error) {
            console.error(`❌ MCP Tool Error [${method}]:`, response.data.error);
            throw new Error(response.data.error.message);
        }

        return response.data.result;
    } catch (error: any) {
        console.error(`❌ MCP Tool Request Failed [${method}]:`, error.message);
        throw error;
    }
}

/**
 * Convenience method to list tools or verify connection
 */
export async function listDataverseTools() {
    return callDataverseMcpTool("tools/list");
}

/**
 * Specialized method to run a natural language query via MCP search/fetch
 */
export async function queryDataverse(prompt: string) {
    return callDataverseMcpTool("tools/call", {
        name: "read_query", // or use execute_prompt/search depending on goal
        arguments: {
            query: prompt
        }
    });
}
