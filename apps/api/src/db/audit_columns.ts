// @ts-nocheck
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

async function auditColumns() {
    console.log('🔍 Auditing columns across all tables...\n');

    const tables = [
        { name: 'new_banktransaction', expectedColumns: ['new_txid', 'new_accountno', 'new_txdate', 'new_description', 'new_amount', 'new_currency', 'new_direction'] },
        { name: 'new_erpcashledger', expectedColumns: ['new_ledgerid', 'new_sourcesystem', 'new_docref', 'new_postingdate', 'new_description', 'new_amount', 'new_currency', 'new_direction'] },
        { name: 'new_bankreconmatch', expectedColumns: ['new_matchid', 'new_matchstatus', 'new_confidence', 'new_reason', 'new_banktransactionid', 'new_erpcashledgerid'] },
        { name: 'new_dimsites', expectedColumns: ['new_sitename', 'new_country'] },
        { name: 'new_dimemployees', expectedColumns: ['new_employeeid', 'new_employeename', 'new_role', 'new_team', 'new_fte', 'new_siteid'] },
        { name: 'new_dimprocesses', expectedColumns: ['new_processname', 'new_subprocessname'] },
        { name: 'new_factactivity', expectedColumns: ['new_activityid', 'new_activitydate', 'new_handletimemin', 'new_queuetimemin', 'new_cycletimemin', 'new_slatargetmin', 'new_slamet', 'new_reworkflag', 'new_errorflag', 'new_qualityscore', 'new_volumeunits', 'new_automationassisted', 'new_employeeid', 'new_processid'] },
        { name: 'new_pettycashrequests', expectedColumns: ['new_requestid', 'new_cinecode', 'new_requestername', 'new_requestedat', 'new_amount', 'new_currency', 'new_category', 'new_status', 'new_approvername', 'new_notes'] }
    ];

    const missingColumns: any = {};

    for (const table of tables) {
        console.log(`📋 ${table.name}:`);
        try {
            const result = await (ppService as any).makeRequest('GET', `api/data/v9.2/EntityDefinitions(LogicalName='${table.name}')/Attributes`);
            const existingColumns = (result as any).value
                .filter((a: any) => a.IsCustomAttribute || a.AttributeType === 'Lookup')
                .map((a: any) => a.LogicalName);

            const missing = table.expectedColumns.filter(col => !existingColumns.includes(col));

            console.log(`  Existing: ${existingColumns.length} columns`);
            console.log(`  Expected: ${table.expectedColumns.length} columns`);
            console.log(`  Missing: ${missing.length} columns`);

            if (missing.length > 0) {
                console.log(`  ❌ Missing columns: ${missing.join(', ')}`);
                missingColumns[table.name] = missing;
            } else {
                console.log(`  ✅ All columns present`);
            }
        } catch (error: any) {
            console.log(`  ❌ Error: ${error.message}`);
        }
        console.log('');
    }

    console.log('='.repeat(60));
    console.log('📊 Summary:');
    const tablesMissingColumns = Object.keys(missingColumns).length;
    if (tablesMissingColumns === 0) {
        console.log('✅ All tables have complete column sets!');
    } else {
        console.log(`⚠️  ${tablesMissingColumns} tables are missing columns`);
        console.log('\nTables needing column additions:');
        Object.entries(missingColumns).forEach(([table, cols]: [string, any]) => {
            console.log(`  - ${table}: ${cols.length} missing`);
        });
    }
    console.log('='.repeat(60));

    return missingColumns;
}

auditColumns();
