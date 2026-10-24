
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { callDataverseMcpTool } from './mcp_client';

async function seedProductivity() {
    console.log('🌱 Seeding fact_activity records to Dataverse (Simple Lookup)...');

    const employeeId = '1d9403c2-f405-f111-8406-7c1e526a291e'; // Ana García
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
            new_employeeid: employeeId,
            new_processid: p1
        },
        {
            new_name: 'ACT-0002',
            new_activityid: 'ACT-0002',
            new_activitydate: new Date().toISOString(),
            new_slamet: 1,
            new_volumeunits: 120,
            new_qualityscore: 95,
            new_reworkflag: 0,
            new_employeeid: employeeId,
            new_processid: p2
        }
    ];

    for (const act of activities) {
        try {
            const result = await callDataverseMcpTool('tools/call', {
                name: 'create_record',
                arguments: {
                    tablename: 'new_factactivity',
                    item: JSON.stringify(act)
                }
            });
            console.log(`✅ Seeded ${act.new_activityid}:`, JSON.stringify(result, null, 2));
        } catch (e: any) {
            console.error(`❌ Failed to seed ${act.new_activityid}:`, e.message);
        }
    }
}

seedProductivity();
