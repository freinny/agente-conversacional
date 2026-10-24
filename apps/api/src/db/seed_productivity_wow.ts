
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

async function seedProductivityWow() {
    console.log('🌱 Seeding high-density productivity records to Dataverse (The WOW Factor)...');

    const emps = [
        '5e9903c2-f405-f111-8406-7c1e526a291e', // Ana García
        '03aba5c5-f405-f111-8406-000d3a4e66fb', // Luis Hernández
        '5f9903c2-f405-f111-8406-7c1e526a291e', // Sofía Martínez
        '2b5860c3-f405-f111-8407-7c1e525b5242'  // Diego López
    ];

    const procs = [
        '13aba5c5-f405-f111-8406-000d3a4e66fb', // CP - Registro
        '14aba5c5-f405-f111-8406-000d3a4e66fb', // CP - Conciliación
        'edd83cc8-f405-f111-8406-7c1e526a291e', // Compras - Validación
        '325860c3-f405-f111-8407-7c1e525b5242'  // Ingresos - Conciliación
    ];

    const baseActivities = [
        // CP - Registro (High SLA, Mid Quality)
        { proc: procs[0], sla: 1, quality: 98, vol: 45 },
        { proc: procs[0], sla: 1, quality: 96, vol: 38 },
        { proc: procs[0], sla: 0, quality: 99, vol: 52 },
        { proc: procs[0], sla: 1, quality: 97, vol: 41 },

        // CP - Conciliación (Mid SLA, High Quality)
        { proc: procs[1], sla: 1, quality: 100, vol: 12 },
        { proc: procs[1], sla: 0, quality: 98, vol: 15 },
        { proc: procs[1], sla: 1, quality: 99, vol: 10 },
        { proc: procs[1], sla: 1, quality: 97, vol: 18 },

        // Compras - Validación (High SLA, High Quality)
        { proc: procs[2], sla: 1, quality: 95, vol: 88 },
        { proc: procs[2], sla: 1, quality: 96, vol: 92 },
        { proc: procs[2], sla: 1, quality: 94, vol: 75 },
        { proc: procs[2], sla: 1, quality: 98, vol: 80 },

        // Ingresos - Conciliación (Low SLA, Mid Quality)
        { proc: procs[3], sla: 0, quality: 90, vol: 25 },
        { proc: procs[3], sla: 1, quality: 88, vol: 30 },
        { proc: procs[3], sla: 0, quality: 92, vol: 22 },
        { proc: procs[3], sla: 0, quality: 85, vol: 28 }
    ];

    let count = 2000;
    for (const base of baseActivities) {
        const emp = emps[Math.floor(Math.random() * emps.length)];
        const activity = {
            new_name: `WOW-${count}`,
            new_activityid: `WOW-${count}`,
            new_activitydate: new Date().toISOString(),
            new_slamet: base.sla,
            new_qualityscore: base.quality,
            new_volumeunits: base.vol,
            new_reworkflag: Math.random() > 0.8 ? 1 : 0,
            'new_employeeid@odata.bind': `/new_dimemployeeses(${emp})`,
            'new_processid@odata.bind': `/new_dimprocesseses(${base.proc})`
        };

        try {
            await ppService.makeRequest('POST', 'api/data/v9.2/new_factactivities', activity);
            console.log(`✅ Seeded ${activity.new_name} for process ${base.proc}`);
        } catch (e: any) {
            console.error(`❌ Failed ${activity.new_name}:`, e.response?.data || e.message);
        }
        count++;
    }
}

seedProductivityWow();
