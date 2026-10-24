import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

async function seedSimpleTables() {
    console.log('🌱 Seeding simple tables (no lookups)...\n');

    try {
        // 1. Seed Petty Cash
        console.log('💰 Seeding Petty Cash Requests...');
        const pcCheck: any = await ppService.makeRequest('GET', 'api/data/v9.2/new_pettycashrequestses?$select=new_requestid');

        if (pcCheck.value.length === 0) {
            const pettycash = [
                { new_name: 'PC-0001', new_requestid: 'PC-0001', new_cinecode: 'CINE-021', new_requestername: 'María Rojas', new_requestedat: '2025-12-10T09:12:00', new_amount: 120.50, new_currency: 'MXN', new_category: 'Mantenimiento', new_status: 'PENDING_APPROVAL', new_notes: 'Cambio de focos' },
                { new_name: 'PC-0002', new_requestid: 'PC-0002', new_cinecode: 'CINE-105', new_requestername: 'Jorge Pérez', new_requestedat: '2025-12-11T14:40:00', new_amount: 560.00, new_currency: 'MXN', new_category: 'Operación', new_status: 'PENDING_APPROVAL', new_notes: 'Compra insumos urgentes' },
                { new_name: 'PC-0003', new_requestid: 'PC-0003', new_cinecode: 'CINE-033', new_requestername: 'Laura Cruz', new_requestedat: '2025-12-05T10:01:00', new_amount: 80.00, new_currency: 'MXN', new_category: 'Limpieza', new_status: 'APPROVED', new_approvername: 'Aminael', new_notes: 'Aprobado para compra' },
                { new_name: 'PC-0004', new_requestid: 'PC-0004', new_cinecode: 'CINE-021', new_requestername: 'Iván Torres', new_requestedat: '2025-12-01T08:33:00', new_amount: 950.00, new_currency: 'MXN', new_category: 'Seguridad', new_status: 'REJECTED', new_approvername: 'Aminael', new_notes: 'Monto excede política' }
            ];
            for (const pc of pettycash) {
                await ppService.makeRequest('POST', 'api/data/v9.2/new_pettycashrequestses', pc);
                console.log(`  ✅ ${pc.new_requestid} - ${pc.new_requestername}`);
            }
        } else {
            console.log(`  ℹ️  ${pcCheck.value.length} petty cash requests already exist, skipping...`);
        }

        // 2. Seed Bank Transactions
        console.log('\n🏦 Seeding Bank Transactions...');
        const btCheck: any = await ppService.makeRequest('GET', 'api/data/v9.2/new_banktransactions?$select=new_txid');

        if (btCheck.value.length === 0) {
            const bankTxs = [
                { new_name: 'BT-0001', new_txid: 'BT-0001', new_accountno: 'MX-001', new_txdate: '2025-12-12', new_description: 'DEPÓSITO TAQUILLA CINE-021', new_amount: 15000, new_currency: 'MXN', new_direction: 'IN' },
                { new_name: 'BT-0002', new_txid: 'BT-0002', new_accountno: 'MX-001', new_txdate: '2025-12-12', new_description: 'DEPÓSITO TAQUILLA CINE-105', new_amount: 22000, new_currency: 'MXN', new_direction: 'IN' },
                { new_name: 'BT-0003', new_txid: 'BT-0003', new_accountno: 'MX-001', new_txdate: '2025-12-13', new_description: 'COMISIÓN BANCARIA', new_amount: 120, new_currency: 'MXN', new_direction: 'OUT' },
                { new_name: 'BT-0004', new_txid: 'BT-0004', new_accountno: 'MX-001', new_txdate: '2025-12-14', new_description: 'DEPÓSITO CONSOLIDADO SEMANAL', new_amount: 55000, new_currency: 'MXN', new_direction: 'IN' }
            ];
            for (const tx of bankTxs) {
                await ppService.makeRequest('POST', 'api/data/v9.2/new_banktransactions', tx);
                console.log(`  ✅ ${tx.new_txid} - ${tx.new_description}`);
            }
        } else {
            console.log(`  ℹ️  ${btCheck.value.length} bank transactions already exist, skipping...`);
        }

        // 3. Seed ERP Ledger
        console.log('\n📒 Seeding ERP Cash Ledger...');
        const erpCheck: any = await ppService.makeRequest('GET', 'api/data/v9.2/new_erpcashledgers?$select=new_ledgerid');

        if (erpCheck.value.length === 0) {
            const erpLedger = [
                { new_name: 'GL-9001', new_ledgerid: 'GL-9001', new_sourcesystem: 'PeopleSoft', new_docref: 'DEP-021-20251212', new_postingdate: '2025-12-12', new_description: 'Depósito cine 021', new_amount: 15000, new_currency: 'MXN', new_direction: 'IN' },
                { new_name: 'GL-9002', new_ledgerid: 'GL-9002', new_sourcesystem: 'PeopleSoft', new_docref: 'DEP-105-20251212', new_postingdate: '2025-12-12', new_description: 'Depósito cine 105', new_amount: 21950, new_currency: 'MXN', new_direction: 'IN' },
                { new_name: 'GL-9003', new_ledgerid: 'GL-9003', new_sourcesystem: 'PeopleSoft', new_docref: 'FEE-20251213', new_postingdate: '2025-12-13', new_description: 'Comisión bancaria', new_amount: 120, new_currency: 'MXN', new_direction: 'OUT' },
                { new_name: 'GL-9004', new_ledgerid: 'GL-9004', new_sourcesystem: 'PeopleSoft', new_docref: 'DOC-A-20251214', new_postingdate: '2025-12-14', new_description: 'Venta Dulcería Sem 50', new_amount: 30000, new_currency: 'MXN', new_direction: 'IN' },
                { new_name: 'GL-9005', new_ledgerid: 'GL-9005', new_sourcesystem: 'PeopleSoft', new_docref: 'DOC-B-20251214', new_postingdate: '2025-12-14', new_description: 'Venta Boletos Sem 50', new_amount: 25000, new_currency: 'MXN', new_direction: 'IN' }
            ];
            for (const ledger of erpLedger) {
                await ppService.makeRequest('POST', 'api/data/v9.2/new_erpcashledgers', ledger);
                console.log(`  ✅ ${ledger.new_ledgerid} - ${ledger.new_description}`);
            }
        } else {
            console.log(`  ℹ️  ${erpCheck.value.length} ERP ledger entries already exist, skipping...`);
        }

        console.log('\n✅ Simple tables seeded successfully!');
        console.log('\nℹ️  Note: Activities and reconciliation matches require manual seeding via Power Apps UI');
        console.log('   due to complex lookup relationships.');
    } catch (error: any) {
        console.error('\n❌ Seeding failed:', error.response?.data || error.message);
        throw error;
    }
}

seedSimpleTables();
