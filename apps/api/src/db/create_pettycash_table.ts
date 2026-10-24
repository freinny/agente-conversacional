import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

const LANG_CODE = 3082;

function createLocalizedLabel(text: string, languageCode: number = LANG_CODE) {
    return {
        LocalizedLabels: [
            {
                Label: text,
                LanguageCode: languageCode,
                IsManaged: false,
                MetadataId: "00000000-0000-0000-0000-000000000000"
            }
        ],
        UserLocalizedLabel: {
            Label: text,
            LanguageCode: languageCode,
            IsManaged: false,
            MetadataId: "00000000-0000-0000-0000-000000000000"
        }
    };
}

async function wait(ms: number) {
    console.log(`⏳ Waiting ${ms / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, ms));
}

async function createPettyCashTable() {
    console.log('🚀 Creating final table: new_PettyCashRequests...\n');

    try {
        console.log('📦 Creating new_PettyCashRequests...');
        await createTable({
            logicalName: 'new_pettycashrequests',
            schemaName: 'new_PettyCashRequests',
            displayName: 'Solicitudes de Caja Chica',
            displayCollectionName: 'Solicitudes de Caja Chica',
            description: 'Petty cash approval requests',
            primaryNameLogicalName: 'new_name',
            primaryNameSchemaName: 'new_Name'
        });
        await wait(5000);

        console.log('Adding columns to new_pettycashrequests...');
        await addColumn('new_pettycashrequests', { logicalName: 'new_requestid', schemaName: 'new_RequestId', displayName: 'ID de Solicitud', type: 'String', maxLength: 50 });
        await wait(3000);
        await addColumn('new_pettycashrequests', { logicalName: 'new_cinecode', schemaName: 'new_CineCode', displayName: 'Código de Cine', type: 'String', maxLength: 50 });
        await wait(3000);
        await addColumn('new_pettycashrequests', { logicalName: 'new_requestername', schemaName: 'new_RequesterName', displayName: 'Solicitante', type: 'String', maxLength: 200 });
        await wait(3000);
        await addColumn('new_pettycashrequests', { logicalName: 'new_requestedat', schemaName: 'new_RequestedAt', displayName: 'Fecha de Solicitud', type: 'String', maxLength: 50 });
        await wait(3000);
        await addColumn('new_pettycashrequests', { logicalName: 'new_amount', schemaName: 'new_Amount', displayName: 'Monto', type: 'Money', precision: 2 });
        await wait(3000);
        await addColumn('new_pettycashrequests', { logicalName: 'new_currency', schemaName: 'new_Currency', displayName: 'Moneda', type: 'String', maxLength: 10 });
        await wait(3000);
        await addColumn('new_pettycashrequests', { logicalName: 'new_category', schemaName: 'new_Category', displayName: 'Categoría', type: 'String', maxLength: 100 });
        await wait(3000);
        await addColumn('new_pettycashrequests', { logicalName: 'new_status', schemaName: 'new_Status', displayName: 'Estado', type: 'String', maxLength: 50 });
        await wait(3000);
        await addColumn('new_pettycashrequests', { logicalName: 'new_approvername', schemaName: 'new_ApproverName', displayName: 'Aprobador', type: 'String', maxLength: 200 });
        await wait(3000);
        await addColumn('new_pettycashrequests', { logicalName: 'new_notes', schemaName: 'new_Notes', displayName: 'Notas', type: 'Memo', maxLength: 2000 });

        console.log('\n✅ new_pettycashrequests complete!');
        console.log('\n🎉 ALL 8 TABLES CREATED SUCCESSFULLY!');
        console.log('\n📊 Complete amalia.db schema has been replicated to Dataverse:');
        console.log('  ✅ new_banktransaction (Bank Transactions)');
        console.log('  ✅ new_erpcashledger (ERP Cash Ledger)');
        console.log('  ✅ new_bankreconmatch (Bank Reconciliation Matches)');
        console.log('  ✅ new_dimsites (GBS Sites)');
        console.log('  ✅ new_dimemployees (GBS Employees)');
        console.log('  ✅ new_dimprocesses (GBS Processes)');
        console.log('  ✅ new_factactivity (GBS Activity Facts)');
        console.log('  ✅ new_pettycashrequests (Petty Cash Requests)');
        console.log('\n📝 Next steps:');
        console.log('  1. Seed the data using a Dataverse seeding script');
        console.log('  2. Update Amalia tools to query Dataverse via MCP instead of SQLite');
        console.log('  3. Test the integration end-to-end');
    } catch (error: any) {
        console.error('\n❌ Error:', error.response?.data || error.message);
        throw error;
    }
}

async function createTable(params: {
    logicalName: string;
    schemaName: string;
    displayName: string;
    displayCollectionName: string;
    description: string;
    primaryNameLogicalName: string;
    primaryNameSchemaName: string;
}) {
    try {
        await ppService.makeRequest('GET', `api/data/v9.2/EntityDefinitions(LogicalName='${params.logicalName}')`);
        console.log(`ℹ️  Table ${params.logicalName} already exists, skipping...`);
        return;
    } catch (e) {
        // Table doesn't exist, proceed
    }

    const entityDefinition = {
        "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
        LogicalName: params.logicalName,
        SchemaName: params.schemaName,
        DisplayName: createLocalizedLabel(params.displayName),
        DisplayCollectionName: createLocalizedLabel(params.displayCollectionName),
        Description: createLocalizedLabel(params.description),
        OwnershipType: "UserOwned",
        HasActivities: false,
        HasNotes: false,
        IsActivity: false,
        IsCustomEntity: true,
        Attributes: [
            {
                "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
                LogicalName: params.primaryNameLogicalName,
                SchemaName: params.primaryNameSchemaName,
                DisplayName: createLocalizedLabel("Nombre"),
                Description: createLocalizedLabel("Primary name attribute"),
                RequiredLevel: {
                    Value: "ApplicationRequired",
                    CanBeChanged: false,
                    ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
                },
                MaxLength: 100,
                Format: "Text",
                IsPrimaryName: true,
                IsCustomAttribute: true
            }
        ]
    };

    await ppService.makeRequest('POST', 'api/data/v9.2/EntityDefinitions', entityDefinition);
    console.log(`✅ Table ${params.logicalName} created`);
}

async function addColumn(entityLogicalName: string, params: {
    logicalName: string;
    schemaName: string;
    displayName: string;
    type: 'String' | 'Money' | 'Double' | 'Memo' | 'Integer';
    maxLength?: number;
    precision?: number;
}) {
    try {
        await ppService.makeRequest('GET', `api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${params.logicalName}')`);
        console.log(`  ℹ️  Column ${params.logicalName} already exists, skipping...`);
        return;
    } catch (e) {
        // Column doesn't exist, proceed
    }

    let attributeDefinition: any = {
        LogicalName: params.logicalName,
        SchemaName: params.schemaName,
        DisplayName: createLocalizedLabel(params.displayName),
        RequiredLevel: {
            Value: "None",
            CanBeChanged: true,
            ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
        },
        IsCustomAttribute: true
    };

    switch (params.type) {
        case 'String':
            attributeDefinition["@odata.type"] = "Microsoft.Dynamics.CRM.StringAttributeMetadata";
            attributeDefinition.MaxLength = params.maxLength || 100;
            attributeDefinition.Format = "Text";
            break;
        case 'Money':
            attributeDefinition["@odata.type"] = "Microsoft.Dynamics.CRM.MoneyAttributeMetadata";
            attributeDefinition.Precision = params.precision || 2;
            break;
        case 'Double':
            attributeDefinition["@odata.type"] = "Microsoft.Dynamics.CRM.DoubleAttributeMetadata";
            attributeDefinition.Precision = params.precision || 2;
            break;
        case 'Memo':
            attributeDefinition["@odata.type"] = "Microsoft.Dynamics.CRM.MemoAttributeMetadata";
            attributeDefinition.MaxLength = params.maxLength || 2000;
            break;
        case 'Integer':
            attributeDefinition["@odata.type"] = "Microsoft.Dynamics.CRM.IntegerAttributeMetadata";
            attributeDefinition.Format = "None";
            break;
    }

    await ppService.makeRequest('POST', `api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`, attributeDefinition);
    console.log(`  ✅ Column ${params.logicalName} added`);
}

createPettyCashTable();
