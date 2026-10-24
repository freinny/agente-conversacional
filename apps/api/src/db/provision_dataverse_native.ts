import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

const LANG_CODE = 3082; // Spanish (Spain)

async function provision() {
    console.log(`🚀 Starting Comprehensive Native Dataverse Provisioning (Language: ${LANG_CODE})...`);

    try {
        await createEntity('new_BankTransaction', 'Transacción Bancaria', 'new_banktransactions', 'new_TxId');
        await createEntity('new_ErpCashLedger', 'Libro de Caja ERP', 'new_erpcashledgers', 'new_LedgerId');
        await createEntity('new_BankReconMatch', 'Conciliación Bancaria', 'new_bankreconmatches', 'new_MatchId');

        console.log('✅ Entities provisioned. Proceeding to add attributes...');
        // Note: For this demo, we can proceed to add specific attributes in a later step
    } catch (error) {
        console.error('❌ Provisioning failed:', error);
    }
}

async function createEntity(schemaName: string, displayName: string, collectionName: string, primaryNameAttribute: string) {
    console.log(`📦 Creating Entity: ${schemaName}...`);

    try {
        await ppService.makeRequest('GET', `api/data/v9.2/EntityDefinitions(LogicalName='${schemaName.toLowerCase()}')`);
        console.log(`ℹ️ Entity ${schemaName} already exists.`);
        return;
    } catch (e) { }

    const payload = {
        "SchemaName": schemaName,
        "DisplayName": { "LocalizedLabels": [{ "Label": displayName, "LanguageCode": LANG_CODE }] },
        "DisplayCollectionName": { "LocalizedLabels": [{ "Label": collectionName, "LanguageCode": LANG_CODE }] },
        "OwnershipType": "UserOwned",
        "IsActivity": false,
        "HasActivities": false,
        "HasNotes": false,
        "HasFeedback": false,
        "PrimaryNameAttribute": primaryNameAttribute,
        "Attributes": [
            {
                "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
                "SchemaName": primaryNameAttribute,
                "DisplayName": { "LocalizedLabels": [{ "Label": "Nombre", "LanguageCode": LANG_CODE }] },
                "RequiredLevel": { "Value": "ApplicationRequired" },
                "FormatName": { "Value": "Text" },
                "MaxLength": 200
            }
        ]
    };

    try {
        await ppService.makeRequest('POST', 'api/data/v9.2/EntityDefinitions', payload);
        console.log(`✨ Entity ${schemaName} created successfully.`);
    } catch (err: any) {
        const errorData = err.response?.data || { message: err.message };
        require('fs').writeFileSync('provision_error.json', JSON.stringify(errorData, null, 2));
        console.error(`❌ Failed to create ${schemaName}. Check provision_error.json`);
        throw err;
    }
}

provision();
