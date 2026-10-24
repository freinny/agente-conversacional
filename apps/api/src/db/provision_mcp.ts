import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { callDataverseMcpTool } from './mcp_client';

async function provisionViaMcp() {
    console.log('🚀 Starting MCP-Based Dataverse Provisioning...');

    try {
        // 1. Create Bank Transaction Table
        console.log('📦 Creating new_BankTransaction...');
        await createTable('new_banktransaction', 'Bank Transaction', [
            { name: 'new_txid', type: 'String', required: false, description: 'Transaction ID' },
            { name: 'new_accountno', type: 'String', required: false, description: 'Account Number' },
            { name: 'new_txdate', type: 'String', required: false, description: 'Transaction Date' },
            { name: 'new_description', type: 'String', required: false, description: 'Description' },
            { name: 'new_amount', type: 'Money', required: false, description: 'Amount' },
            { name: 'new_currency', type: 'String', required: false, description: 'Currency' },
            { name: 'new_direction', type: 'String', required: false, description: 'Direction (IN/OUT)' }
        ]);

        // 2. Create ERP Cash Ledger Table
        console.log('📦 Creating new_ErpCashLedger...');
        await createTable('new_erpcashledger', 'ERP Cash Ledger', [
            { name: 'new_ledgerid', type: 'String', required: false, description: 'Ledger ID' },
            { name: 'new_sourcesystem', type: 'String', required: false, description: 'Source System' },
            { name: 'new_docref', type: 'String', required: false, description: 'Document Reference' },
            { name: 'new_postingdate', type: 'String', required: false, description: 'Posting Date' },
            { name: 'new_description', type: 'String', required: false, description: 'Description' },
            { name: 'new_amount', type: 'Money', required: false, description: 'Amount' },
            { name: 'new_currency', type: 'String', required: false, description: 'Currency' },
            { name: 'new_direction', type: 'String', required: false, description: 'Direction (IN/OUT)' }
        ]);

        // 3. Create Bank Recon Match Table
        console.log('📦 Creating new_BankReconMatch...');
        await createTable('new_bankreconmatch', 'Bank Recon Match', [
            { name: 'new_matchid', type: 'String', required: false, description: 'Match ID' },
            { name: 'new_matchstatus', type: 'String', required: false, description: 'Match Status' },
            { name: 'new_confidence', type: 'Double', required: false, description: 'Confidence Score' },
            { name: 'new_reason', type: 'multiline text', required: false, description: 'Reason' },
            { name: 'new_bt_id', type: 'lookup', required: false, description: 'Bank Transaction', relatedtable: 'new_banktransaction' },
            { name: 'new_erp_id', type: 'lookup', required: false, description: 'ERP Ledger', relatedtable: 'new_erpcashledger' }
        ]);

        console.log('✅ All tables created successfully via MCP!');
    } catch (error) {
        console.error('❌ Provisioning failed:', error);
        throw error;
    }
}

async function createTable(tablename: string, displayname: string, columns: any[]) {
    const result = await callDataverseMcpTool("tools/call", {
        name: "create_table",
        arguments: {
            tablename,
            displayname,
            description: `Amalia Reconciliation: ${displayname}`,
            item: JSON.stringify(columns)
        }
    });

    if (result.isError) {
        console.error(`❌ Failed to create ${tablename}:`, result.content[0].text);
        throw new Error(result.content[0].text);
    } else {
        console.log(`✨ Table ${tablename} created successfully.`);
        console.log("   Result:", result.content[0].text);
    }
}

provisionViaMcp();
