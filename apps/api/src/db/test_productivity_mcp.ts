
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { tool_gbs_productivity } from '../tools/index';

async function testProductivity() {
    console.log('🧪 Testing tool_gbs_productivity...');

    try {
        const result = await tool_gbs_productivity({ query: 'mostrar reporte de productividad' });
        console.log('✅ Tool Result Narrative:', result.narrativeAnswer);

        if (result.evidence && result.evidence.length > 0) {
            const evidence = result.evidence[0];
            console.log('\n📊 Evidence Summary:');
            console.log('Title:', evidence.title);
            console.log('SQL Used:', evidence.sql);
            console.log('Records Found:', evidence.rowsPreview?.length);

            if (evidence.chartData) {
                console.log('\n📈 Chart Data:');
                console.log('Labels:', evidence.chartData.labels);
                console.log('Datasets:', evidence.chartData.datasets[0].data);
            }

            if (evidence.rowsPreview && evidence.rowsPreview.length > 0) {
                console.log('\n📄 Data Preview (Top 2):');
                console.table(evidence.rowsPreview.slice(0, 2));
                console.log('✨ SUCCESS: Productivity data retrieved from Dataverse!');
            } else {
                console.log('\n⚠️  WARNING: No productivity records found. Table might be empty or seeding failed.');
            }
        } else {
            console.log('❌ FAILED: No evidence returned.');
        }

    } catch (error: any) {
        console.error('❌ Test failed with error:', error.message);
    }
}

testProductivity();
