import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

async function checkTables() {
    const tables = [
        'new_banktransaction',
        'new_erpcashledger',
        'new_bankreconmatch',
        'new_dimsites',
        'new_dimemployees',
        'new_dimprocesses',
        'new_factactivity',
        'new_pettycashrequests'
    ];

    console.log('🔍 Checking which tables exist in Dataverse...\n');

    for (const table of tables) {
        try {
            await ppService.makeRequest('GET', `api/data/v9.2/EntityDefinitions(LogicalName='${table}')`);
            console.log('✅', table);
        } catch (e) {
            console.log('❌', table);
        }
    }
}

checkTables();
