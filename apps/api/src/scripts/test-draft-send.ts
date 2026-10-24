import { tool_draft_email, tool_send_email } from '../tools';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function testDraftAndSend() {
    console.log('🧪 Testing End-to-End Email Flow...');

    const recipient = 'aminael@intelixs.com';

    // 1. Test Drafting
    console.log('\n--- Step 1: Drafting ---');
    const draftResult = await tool_draft_email({
        to: recipient,
        subject: 'Test Final: Drafting Flow',
        body: '<p>Este es un <strong>test final</strong> para validar el flujo de borrador y envío a la dirección confirmada.</p>'
    });

    console.log('Narrative:', draftResult.narrativeAnswer);
    if (draftResult.evidence[0]?.emailDraft) {
        console.log('✅ Draft created successfully.');
    } else {
        console.error('❌ Failed to create draft.');
        process.exit(1);
    }

    // 2. Test Sending
    console.log('\n--- Step 2: Sending ---');
    const sendResult = await tool_send_email({});

    console.log('Narrative:', sendResult.narrativeAnswer);
    if (sendResult.evidence[0]?.tool === 'tool_send_email') {
        console.log('✅ Email sent successfully!');
    } else {
        console.error('❌ Failed to send email.');
        process.exit(1);
    }

    console.log('\n✨ E2E Flow Test Complete!');
}

testDraftAndSend().catch(err => {
    console.error('💥 Test failed:', err);
    process.exit(1);
});
