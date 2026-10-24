// @ts-nocheck
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

async function seedDataverse() {
    console.log('🌱 Seeding Dataverse with demo data from amalia.db...\n');

    try {
        // 1. Seed Sites
        console.log('📍 Seeding Sites...');
        const sites = [
            { new_name: 'CDMX - Corporativo', new_sitename: 'CDMX - Corporativo', new_country: 'MX' },
            { new_name: 'Guadalajara - SSC', new_sitename: 'Guadalajara - SSC', new_country: 'MX' },
            { new_name: 'Monterrey - SSC', new_sitename: 'Monterrey - SSC', new_country: 'MX' }
        ];
        const siteIds = [];
        for (const site of sites) {
            const result = await ppService.makeRequest('POST', 'api/data/v9.2/new_dimsiteses', site);
            siteIds.push(result.new_dimsitesid);
            console.log(`  ✅ ${site.new_name}`);
        }

        // 2. Seed Employees
        console.log('\n👥 Seeding Employees...');
        const employees = [
            { new_name: 'Ana García', new_employeeid: 'E0001', new_employeename: 'Ana García', new_role: 'Analista', new_team: 'AP', new_fte: 1.0, 'new_siteid@odata.bind': `/new_dimsiteses(${siteIds[1]})` },
            { new_name: 'Luis Hernández', new_employeeid: 'E0002', new_employeename: 'Luis Hernández', new_role: 'Analista Sr', new_team: 'AP', new_fte: 1.0, 'new_siteid@odata.bind': `/new_dimsiteses(${siteIds[1]})` },
            { new_name: 'Sofía Martínez', new_employeeid: 'E0003', new_employeename: 'Sofía Martínez', new_role: 'Analista', new_team: 'Revenue', new_fte: 0.5, 'new_siteid@odata.bind': `/new_dimsiteses(${siteIds[2]})` },
            { new_name: 'Diego López', new_employeeid: 'E0004', new_employeename: 'Diego López', new_role: 'Coordinador', new_team: 'Procurement', new_fte: 1.0, 'new_siteid@odata.bind': `/new_dimsiteses(${siteIds[0]})` }
        ];
        const employeeIds = [];
        for (const emp of employees) {
            const result = await ppService.makeRequest('POST', 'api/data/v9.2/new_dimemployeeses', emp);
            employeeIds.push(result.new_dimemployeesesid);
            console.log(`  ✅ ${emp.new_employeename}`);
        }

        // 3. Seed Processes
        console.log('\n⚙️  Seeding Processes...');
        const processes = [
            { new_name: 'Cuentas por Pagar - Registro de facturas', new_processname: 'Cuentas por Pagar', new_subprocessname: 'Registro de facturas' },
            { new_name: 'Cuentas por Pagar - Conciliación y aclaraciones', new_processname: 'Cuentas por Pagar', new_subprocessname: 'Conciliación y aclaraciones' },
            { new_name: 'Compras - Validación de requisiciones', new_processname: 'Compras', new_subprocessname: 'Validación de requisiciones' },
            { new_name: 'Ingresos - Conciliación de depósitos', new_processname: 'Ingresos', new_subprocessname: 'Conciliación de depósitos' }
        ];
        const processIds = [];
        for (const proc of processes) {
            const result = await ppService.makeRequest('POST', 'api/data/v9.2/new_dimprocesseses', proc);
            processIds.push(result.new_dimprocessesesid);
            console.log(`  ✅ ${proc.new_processname} - ${proc.new_subprocessname}`);
        }

        // 4. Seed Activities
        console.log('\n📊 Seeding Activities...');
        const activities = [
            { new_name: 'A1001', new_activityid: 'A1001', new_activitydate: '2025-12-01', new_handletimemin: 18, new_queuetimemin: 12, new_cycletimemin: 30, new_slatargetmin: 60, new_slamet: 1, new_reworkflag: 0, new_errorflag: 0, new_qualityscore: 97, new_volumeunits: 5, new_automationassisted: 0, 'new_employeeid@odata.bind': `/new_dimemployeeses(${employeeIds[0]})`, 'new_processid@odata.bind': `/new_dimprocesseses(${processIds[0]})` },
            { new_name: 'A1002', new_activityid: 'A1002', new_activitydate: '2025-12-01', new_handletimemin: 14, new_queuetimemin: 10, new_cycletimemin: 24, new_slatargetmin: 60, new_slamet: 1, new_reworkflag: 0, new_errorflag: 0, new_qualityscore: 98, new_volumeunits: 6, new_automationassisted: 1, 'new_employeeid@odata.bind': `/new_dimemployeeses(${employeeIds[1]})`, 'new_processid@odata.bind': `/new_dimprocesseses(${processIds[0]})` },
            { new_name: 'A1003', new_activityid: 'A1003', new_activitydate: '2025-12-02', new_handletimemin: 28, new_queuetimemin: 40, new_cycletimemin: 68, new_slatargetmin: 240, new_slamet: 1, new_reworkflag: 1, new_errorflag: 0, new_qualityscore: 90, new_volumeunits: 2, new_automationassisted: 0, 'new_employeeid@odata.bind': `/new_dimemployeeses(${employeeIds[0]})`, 'new_processid@odata.bind': `/new_dimprocesseses(${processIds[1]})` },
            { new_name: 'A1004', new_activityid: 'A1004', new_activitydate: '2025-12-02', new_handletimemin: 22, new_queuetimemin: 90, new_cycletimemin: 112, new_slatargetmin: 480, new_slamet: 1, new_reworkflag: 0, new_errorflag: 0, new_qualityscore: 95, new_volumeunits: 3, new_automationassisted: 0, 'new_employeeid@odata.bind': `/new_dimemployeeses(${employeeIds[2]})`, 'new_processid@odata.bind': `/new_dimprocesseses(${processIds[3]})` },
            { new_name: 'A1005', new_activityid: 'A1005', new_activitydate: '2025-12-03', new_handletimemin: 35, new_queuetimemin: 15, new_cycletimemin: 50, new_slatargetmin: 120, new_slamet: 0, new_reworkflag: 1, new_errorflag: 1, new_qualityscore: 82, new_volumeunits: 1, new_automationassisted: 0, 'new_employeeid@odata.bind': `/new_dimemployeeses(${employeeIds[3]})`, 'new_processid@odata.bind': `/new_dimprocesseses(${processIds[2]})` }
        ];
        for (const act of activities) {
            await ppService.makeRequest('POST', 'api/data/v9.2/new_factactivities', act);
            console.log(`  ✅ ${act.new_activityid}`);
        }

        // 5. Seed Petty Cash Requests
        console.log('\n💰 Seeding Petty Cash Requests...');
        const pettycash = [
            { new_name: 'PC-0001', new_requestid: 'PC-0001', new_cinecode: 'CINE-021', new_requestername: 'María Rojas', new_requestedat: '2025-12-10T09:12:00', new_amount: 120.50, new_currency: 'MXN', new_category: 'Mantenimiento', new_status: 'PENDING_APPROVAL', new_approvername: null, new_notes: 'Cambio de focos' },
            { new_name: 'PC-0002', new_requestid: 'PC-0002', new_cinecode: 'CINE-105', new_requestername: 'Jorge Pérez', new_requestedat: '2025-12-11T14:40:00', new_amount: 560.00, new_currency: 'MXN', new_category: 'Operación', new_status: 'PENDING_APPROVAL', new_approvername: null, new_notes: 'Compra insumos urgentes' },
            { new_name: 'PC-0003', new_requestid: 'PC-0003', new_cinecode: 'CINE-033', new_requestername: 'Laura Cruz', new_requestedat: '2025-12-05T10:01:00', new_amount: 80.00, new_currency: 'MXN', new_category: 'Limpieza', new_status: 'APPROVED', new_approvername: 'Aminael', new_notes: 'Aprobado para compra' },
            { new_name: 'PC-0004', new_requestid: 'PC-0004', new_cinecode: 'CINE-021', new_requestername: 'Iván Torres', new_requestedat: '2025-12-01T08:33:00', new_amount: 950.00, new_currency: 'MXN', new_category: 'Seguridad', new_status: 'REJECTED', new_approvername: 'Aminael', new_notes: 'Monto excede política' }
        ];
        for (const pc of pettycash) {
            await ppService.makeRequest('POST', 'api/data/v9.2/new_pettycashrequestses', pc);
            console.log(`  ✅ ${pc.new_requestid} - ${pc.new_requestername}`);
        }

        // 6. Seed Bank Transactions
        console.log('\n🏦 Seeding Bank Transactions...');
        const bankTxs = [
            { new_name: 'BT-0001', new_txid: 'BT-0001', new_accountno: 'MX-001', new_txdate: '2025-12-12', new_description: 'DEPÓSITO TAQUILLA CINE-021', new_amount: 15000, new_currency: 'MXN', new_direction: 'IN' },
            { new_name: 'BT-0002', new_txid: 'BT-0002', new_accountno: 'MX-001', new_txdate: '2025-12-12', new_description: 'DEPÓSITO TAQUILLA CINE-105', new_amount: 22000, new_currency: 'MXN', new_direction: 'IN' },
            { new_name: 'BT-0003', new_txid: 'BT-0003', new_accountno: 'MX-001', new_txdate: '2025-12-13', new_description: 'COMISIÓN BANCARIA', new_amount: -120, new_currency: 'MXN', new_direction: 'OUT' },
            { new_name: 'BT-0004', new_txid: 'BT-0004', new_accountno: 'MX-001', new_txdate: '2025-12-14', new_description: 'DEPÓSITO CONSOLIDADO SEMANAL', new_amount: 55000, new_currency: 'MXN', new_direction: 'IN' }
        ];
        const bankTxIds = [];
        for (const tx of bankTxs) {
            const result = await ppService.makeRequest('POST', 'api/data/v9.2/new_banktransactions', tx);
            bankTxIds.push(result.new_banktransactionid);
            console.log(`  ✅ ${tx.new_txid} - ${tx.new_description}`);
        }

        // 7. Seed ERP Cash Ledger
        console.log('\n📒 Seeding ERP Cash Ledger...');
        const erpLedger = [
            { new_name: 'GL-9001', new_ledgerid: 'GL-9001', new_sourcesystem: 'PeopleSoft', new_docref: 'DEP-021-20251212', new_postingdate: '2025-12-12', new_description: 'Depósito cine 021', new_amount: 15000, new_currency: 'MXN', new_direction: 'IN' },
            { new_name: 'GL-9002', new_ledgerid: 'GL-9002', new_sourcesystem: 'PeopleSoft', new_docref: 'DEP-105-20251212', new_postingdate: '2025-12-12', new_description: 'Depósito cine 105', new_amount: 21950, new_currency: 'MXN', new_direction: 'IN' },
            { new_name: 'GL-9003', new_ledgerid: 'GL-9003', new_sourcesystem: 'PeopleSoft', new_docref: 'FEE-20251213', new_postingdate: '2025-12-13', new_description: 'Comisión bancaria', new_amount: -120, new_currency: 'MXN', new_direction: 'OUT' },
            { new_name: 'GL-9004', new_ledgerid: 'GL-9004', new_sourcesystem: 'PeopleSoft', new_docref: 'DOC-A-20251214', new_postingdate: '2025-12-14', new_description: 'Venta Dulcería Sem 50', new_amount: 30000, new_currency: 'MXN', new_direction: 'IN' },
            { new_name: 'GL-9005', new_ledgerid: 'GL-9005', new_sourcesystem: 'PeopleSoft', new_docref: 'DOC-B-20251214', new_postingdate: '2025-12-14', new_description: 'Venta Boletos Sem 50', new_amount: 25000, new_currency: 'MXN', new_direction: 'IN' }
        ];
        const erpLedgerIds = [];
        for (const ledger of erpLedger) {
            const result = await ppService.makeRequest('POST', 'api/data/v9.2/new_erpcashledgers', ledger);
            erpLedgerIds.push(result.new_erpcashledgerid);
            console.log(`  ✅ ${ledger.new_ledgerid} - ${ledger.new_description}`);
        }

        // 8. Seed Bank Recon Matches
        console.log('\n🔗 Seeding Bank Reconciliation Matches...');
        const matches = [
            { new_name: 'M-0001', new_matchid: 'M-0001', new_matchstatus: 'MATCHED', new_confidence: 0.99, new_reason: 'Monto y fecha exactos', 'new_banktransactionid@odata.bind': `/new_banktransactions(${bankTxIds[0]})`, 'new_erpcashledgerid@odata.bind': `/new_erpcashledgers(${erpLedgerIds[0]})` },
            { new_name: 'M-0002', new_matchid: 'M-0002', new_matchstatus: 'EXCEPTION', new_confidence: 0.72, new_reason: 'Diferencia de 50 MXN (posible ajuste)', 'new_banktransactionid@odata.bind': `/new_banktransactions(${bankTxIds[1]})`, 'new_erpcashledgerid@odata.bind': `/new_erpcashledgers(${erpLedgerIds[1]})` },
            { new_name: 'M-0003', new_matchid: 'M-0003', new_matchstatus: 'MATCHED', new_confidence: 0.98, new_reason: 'Descripción y monto coinciden', 'new_banktransactionid@odata.bind': `/new_banktransactions(${bankTxIds[2]})`, 'new_erpcashledgerid@odata.bind': `/new_erpcashledgers(${erpLedgerIds[2]})` },
            { new_name: 'M-0004', new_matchid: 'M-0004', new_matchstatus: 'MATCHED', new_confidence: 0.95, new_reason: 'Parte de consolidado semanal', 'new_banktransactionid@odata.bind': `/new_banktransactions(${bankTxIds[3]})`, 'new_erpcashledgerid@odata.bind': `/new_erpcashledgers(${erpLedgerIds[3]})` },
            { new_name: 'M-0005', new_matchid: 'M-0005', new_matchstatus: 'MATCHED', new_confidence: 0.95, new_reason: 'Parte de consolidado semanal', 'new_banktransactionid@odata.bind': `/new_banktransactions(${bankTxIds[3]})`, 'new_erpcashledgerid@odata.bind': `/new_erpcashledgers(${erpLedgerIds[4]})` }
        ];
        for (const match of matches) {
            await ppService.makeRequest('POST', 'api/data/v9.2/new_bankreconmatchs', match);
            console.log(`  ✅ ${match.new_matchid} - ${match.new_matchstatus}`);
        }

        console.log('\n🎉 ALL DATA SEEDED SUCCESSFULLY!');
        console.log('\n📊 Summary:');
        console.log(`  ✅ ${sites.length} Sites`);
        console.log(`  ✅ ${employees.length} Employees`);
        console.log(`  ✅ ${processes.length} Processes`);
        console.log(`  ✅ ${activities.length} Activities`);
        console.log(`  ✅ ${pettycash.length} Petty Cash Requests`);
        console.log(`  ✅ ${bankTxs.length} Bank Transactions`);
        console.log(`  ✅ ${erpLedger.length} ERP Ledger Entries`);
        console.log(`  ✅ ${matches.length} Reconciliation Matches`);
        console.log('\n✨ Dataverse now fully mirrors amalia.db!');
    } catch (error: any) {
        console.error('\n❌ Seeding failed:', error.response?.data || error.message);
        throw error;
    }
}

seedDataverse();
