// @ts-nocheck
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

async function getEntitySetNames() {
    const tables = [
        'new_dimsites',
        'new_dimemployees',
        'new_dimprocesses',
        'new_factactivity',
        'new_pettycashrequests',
        'new_banktransaction',
        'new_erpcashledger',
        'new_bankreconmatch'
    ];

    console.log('📋 Entity Set Names:\n');
    for (const table of tables) {
        const result = await ppService.makeRequest('GET', `api/data/v9.2/EntityDefinitions(LogicalName='${table}')`);
        console.log(`${table} → ${result.EntitySetName}`);
    }
}

getEntitySetNames();
