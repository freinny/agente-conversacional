
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { tool_create_pettycash, tool_pettycash_approvals } from '../tools/index';

async function testCreatePettyCash() {
    console.log('🧪 Testing tool_create_pettycash...');

    const args = {
        requesterName: 'Aminael',
        amount: 350.50,
        category: 'Limpieza',
        notes: 'Compra de insumos químicos (Prueba de Integración Dataverse)',
        cineCode: 'CINE-PUE'
    };

    try {
        const result = await tool_create_pettycash(args);
        console.log('✅ Tool Result:', JSON.stringify(result, null, 2));

        console.log('\n🔍 Verifying via tool_pettycash_approvals...');
        const verifyResult = await tool_pettycash_approvals({ status: 'PENDING_APPROVAL' });

        const createdRecord = verifyResult.evidence[0].rowsPreview.find((r: any) =>
            r.RequesterName === 'Aminael' && r.Amount === 350.50
        );

        if (createdRecord) {
            console.log('✨ SUCCESS: Record found in Dataverse!');
            console.log('Record ID:', createdRecord.RequestId);
        } else {
            console.log('❌ FAILED: Record not found in verification list.');
        }

    } catch (error: any) {
        console.error('❌ Test failed with error:', error.message);
    }
}

testCreatePettyCash();
