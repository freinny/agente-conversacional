
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

async function seedReconMatches() {
    console.log('🌱 Seeding bank_recon_match records to Dataverse (Direct OData API)...');

    const matches = [
        {
            new_matchid: 'M-9001',
            new_name: 'BT-0001 <-> GL-9001',
            new_matchstatus: 'MATCHED',
            new_confidence: 0.95,
            new_reason: 'Exact amount and description match. Verified via sequence number.',
            'new_banktransactionid@odata.bind': '/new_banktransactions(509223e9-f505-f111-8406-7c1e526a291e)',
            'new_erpcashledgerid@odata.bind': '/new_erpcashledgers(4a660b07-f605-f111-8406-7c1e526a291e)'
        },
        {
            new_matchid: 'M-9004',
            new_name: 'BT-0002 <-> GL-9004',
            new_matchstatus: 'FLAGGED',
            new_confidence: 0.42,
            new_reason: 'Amount mismatch (950 vs 890). Automated logic flag for manual auditing.',
            'new_banktransactionid@odata.bind': '/new_banktransactions(519223e9-f505-f111-8406-7c1e526a291e)',
            'new_erpcashledgerid@odata.bind': '/new_erpcashledgers(3a88b508-f605-f111-8407-7c1e525b5242)'
        }
    ];

    for (const match of matches) {
        try {
            await ppService.makeRequest('POST', 'api/data/v9.2/new_bankreconmatchs', match);
            console.log(`✅ Seeded ${match.new_matchid}`);
        } catch (e: any) {
            console.error(`❌ Failed to seed ${match.new_matchid}:`, e.message);
        }
    }
}

seedReconMatches();
