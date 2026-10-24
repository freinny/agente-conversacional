import { dataverseRequest } from './dataverse';

async function provision() {
    console.log('🚀 Starting Dataverse Provisioning...');

    try {
        // Table 1: Petty Cash Request
        await createEntity('amalia_PettyCashRequest', 'Petty Cash Request', 'amalia_pettycashrequests', [
            { SchemaName: 'amalia_RequestId', DisplayName: 'Request ID', Type: 'String' },
            { SchemaName: 'amalia_CineCode', DisplayName: 'Cinema Code', Type: 'String' },
            { SchemaName: 'amalia_RequesterName', DisplayName: 'Requester', Type: 'String' },
            { SchemaName: 'amalia_Amount', DisplayName: 'Amount', Type: 'Decimal' },
            { SchemaName: 'amalia_Category', DisplayName: 'Category', Type: 'String' },
            { SchemaName: 'amalia_Status', DisplayName: 'Status', Type: 'String' },
            { SchemaName: 'amalia_Notes', DisplayName: 'Notes', Type: 'Memo' }
        ]);

        // Table 2: Productivity
        await createEntity('amalia_GBSProductivity', 'GBS Productivity', 'amalia_gbsproductivity', [
            { SchemaName: 'amalia_Process', DisplayName: 'Process', Type: 'String' },
            { SchemaName: 'amalia_Subprocess', DisplayName: 'Subprocess', Type: 'String' },
            { SchemaName: 'amalia_Productivity', DisplayName: 'Productivity Value', Type: 'Decimal' },
            { SchemaName: 'amalia_SLAPercent', DisplayName: 'SLA %', Type: 'Double' }
        ]);

        console.log('✅ Provisioning complete! Please publish changes in Power Apps.');
    } catch (error) {
        console.error('❌ Provisioning failed:', error);
    }
}

async function createEntity(schemaName: string, displayName: string, collectionName: string, attributes: any[]) {
    console.log(`📦 Creating/Checking Entity: ${schemaName}...`);
    // Note: Creating entities via API is extremely verbose and session-dependent.
    // For this demo, we will provide a simplified OData payload.
    // However, the Service Principal needs "System Administrator" or similar role.

    // Check if exists
    try {
        await dataverseRequest('GET', `EntityDefinitions(LogicalName='${schemaName.toLowerCase()}')`);
        console.log(`ℹ️ Entity ${schemaName} already exists.`);
        return;
    } catch (e) { }

    const payload = {
        "@odata.type": "Microsoft.Dynamics.CRM.EntityDefinition",
        "SchemaName": schemaName,
        "DisplayName": {
            "LocalizedLabels": [
                {
                    "Label": displayName,
                    "LanguageCode": 1033
                }
            ]
        },
        "DisplayCollectionName": {
            "LocalizedLabels": [
                {
                    "Label": displayName + "s",
                    "LanguageCode": 1033
                }
            ]
        },
        "Attributes": attributes.map(attr => ({
            "@odata.type": `Microsoft.Dynamics.CRM.${attr.Type}AttributeMetadata`,
            "SchemaName": attr.SchemaName,
            "DisplayName": {
                "LocalizedLabels": [{ "Label": attr.DisplayName, "LanguageCode": 1033 }]
            },
            "RequiredLevel": { "Value": "None" }
        })),
        "OwnershipType": "UserOwned",
        "IsActivity": false,
        "HasNotes": true
    };

    await dataverseRequest('POST', 'EntityDefinitions', payload);
}

provision();
