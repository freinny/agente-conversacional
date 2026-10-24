import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

async function seedDataDirectly() {
    console.log('🚀 Creating tables by seeding data directly...');

    try {
        // Create Bank Transaction by inserting a record
        console.log('📦 Creating new_banktransaction table...');
        await ppService.makeRequest('POST', 'api/data/v9.2/new_banktransactions', {
            "new_name": "BT-0001",
            "new_txid": "BT-0001",
            "new_accountno": "4152313469781234",
            "new_txdate": "2024-01-15",
            "new_description": "PAGO NOMINA QUINCENAL",
            "new_amount": -125000.00,
            "new_currency": "MXN",
            "new_direction": "OUT"
        });
        console.log('✅ new_banktransaction created');

        // Create ERP Cash Ledger by inserting a record
        console.log('📦 Creating new_erpcashledger table...');
        await ppService.makeRequest('POST', 'api/data/v9.2/new_erpcashledgers', {
            "new_name": "PC-0001",
            "new_ledgerid": "PC-0001",
            "new_sourcesystem": "SAP",
            "new_docref": "DOC-2024-0115-001",
            "new_postingdate": "2024-01-15",
            "new_description": "Pago de nómina quincenal",
            "new_amount": -125000.00,
            "new_currency": "MXN",
            "new_direction": "OUT"
        });
        console.log('✅ new_erpcashledger created');

        // Create Bank Recon Match by inserting a record
        console.log('📦 Creating new_bankreconmatch table...');
        await ppService.makeRequest('POST', 'api/data/v9.2/new_bankreconmatches', {
            "new_name": "M-0001",
            "new_matchid": "M-0001",
            "new_matchstatus": "MATCHED",
            "new_confidence": 0.95,
            "new_reason": "Exact amount and date match"
        });
        console.log('✅ new_bankreconmatch created');

        console.log('✅ All tables created successfully via direct data insertion!');
        console.log('📝 Note: You can now add lookup fields manually in Power Apps or continue with more data seeding.');
    } catch (error: any) {
        console.error('❌ Error:', error.response?.data || error.message);

        // If tables don't exist, we need to create them first via Power Apps UI
        console.log('\n⚠️  Tables may not exist yet. Please create them manually in Power Apps:');
        console.log('   1. Go to https://make.powerapps.com');
        console.log('   2. Select your environment');
        console.log('   3. Go to Tables > New table');
        console.log('   4. Create these tables:');
        console.log('      - new_banktransaction (with columns: new_txid, new_accountno, new_txdate, new_description, new_amount, new_currency, new_direction)');
        console.log('      - new_erpcashledger (with columns: new_ledgerid, new_sourcesystem, new_docref, new_postingdate, new_description, new_amount, new_currency, new_direction)');
        console.log('      - new_bankreconmatch (with columns: new_matchid, new_matchstatus, new_confidence, new_reason)');
        console.log('   5. Then run this script again to seed data');
    }
}

seedDataDirectly();
