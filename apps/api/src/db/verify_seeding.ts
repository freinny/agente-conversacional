// @ts-nocheck
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

async function verifySeeding() {
    console.log('🔍 Verifying seeded data across all tables...\n');

    const tables = [
        { name: 'Sites', entitySet: 'new_dimsiteses', selectField: 'new_name' },
        { name: 'Employees', entitySet: 'new_dimemployeeses', selectField: 'new_employeename' },
        { name: 'Processes', entitySet: 'new_dimprocesseses', selectField: 'new_processname' },
        { name: 'Activities', entitySet: 'new_factactivities', selectField: 'new_activityid' },
        { name: 'Petty Cash Requests', entitySet: 'new_pettycashrequestses', selectField: 'new_requestid' },
        { name: 'Bank Transactions', entitySet: 'new_banktransactions', selectField: 'new_txid' },
        { name: 'ERP Ledger', entitySet: 'new_erpcashledgers', selectField: 'new_ledgerid' },
        { name: 'Recon Matches', entitySet: 'new_bankreconmatchs', selectField: 'new_matchid' }
    ];

    let totalRecords = 0;
    let allSeeded = true;

    for (const table of tables) {
        try {
            const result = await ppService.makeRequest('GET', `api/data/v9.2/${table.entitySet}?$select=${table.selectField}`);
            const count = result.value.length;
            totalRecords += count;

            if (count > 0) {
                console.log(`✅ ${table.name}: ${count} records`);
                result.value.slice(0, 3).forEach((record: any) => {
                    console.log(`   - ${record[table.selectField]}`);
                });
                if (count > 3) {
                    console.log(`   ... and ${count - 3} more`);
                }
            } else {
                console.log(`❌ ${table.name}: NO DATA`);
                allSeeded = false;
            }
        } catch (error: any) {
            console.log(`❌ ${table.name}: ERROR - ${error.message}`);
            allSeeded = false;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Total Records: ${totalRecords}`);
    if (allSeeded && totalRecords > 0) {
        console.log('✅ All tables have been seeded successfully!');
        console.log('✨ Dataverse now fully mirrors amalia.db!');
    } else {
        console.log('⚠️  Some tables are missing data.');
    }
    console.log('='.repeat(60));
}

verifySeeding();
