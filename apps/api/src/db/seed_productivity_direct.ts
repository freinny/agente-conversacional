
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

async function seedProductivityDirect() {
    console.log('🌱 Seeding fact_activity records to Dataverse (Direct OData API - Final Fix)...');

    const anaGarciaId = '5e9903c2-f405-f111-8406-7c1e526a291e';
    const p1 = '13aba5c5-f405-f111-8406-000d3a4e66fb'; // Cuentas por Pagar / Registro de facturas
    const p2 = 'edd83cc8-f405-f111-8406-7c1e526a291e'; // Compras / Validación de requisiciones

    const activities = [
        {
            new_name: 'ACT-0001',
            new_activityid: 'ACT-0001',
            new_activitydate: new Date().toISOString(),
            new_slamet: 1,
            new_volumeunits: 150,
            new_qualityscore: 98,
            new_reworkflag: 0,
            'new_employeeid@odata.bind': `/new_dimemployeeses(${anaGarciaId})`,
            'new_processid@odata.bind': `/new_dimprocesseses(${p1})`
        },
        {
            new_name: 'ACT-0002',
            new_activityid: 'ACT-0002',
            new_activitydate: new Date().toISOString(),
            new_slamet: 1,
            new_volumeunits: 120,
            new_qualityscore: 95,
            new_reworkflag: 0,
            'new_employeeid@odata.bind': `/new_dimemployeeses(${anaGarciaId})`,
            'new_processid@odata.bind': `/new_dimprocesseses(${p2})`
        }
    ];

    for (const act of activities) {
        try {
            await ppService.makeRequest('POST', 'api/data/v9.2/new_factactivities', act);
            console.log(`✅ Seeded ${act.new_activityid}`);
        } catch (e: any) {
            const errorData = e.response?.data || e.message;
            console.error(`❌ Failed to seed ${act.new_activityid}:`, JSON.stringify(errorData, null, 2));
        }
    }
}

seedProductivityDirect();
