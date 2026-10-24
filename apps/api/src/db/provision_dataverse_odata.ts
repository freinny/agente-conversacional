import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

const LANG_CODE = 3082; // Spanish (Spain) - confirmed from organization query

// Helper function to create localized labels (from dataverse-mcp reference)
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

async function provisionDataverse() {
    console.log(`🚀 Starting Dataverse Provisioning (Language: ${LANG_CODE})...`);

    try {
        // 1. Create Bank Transaction Table
        console.log('📦 Creating new_BankTransaction...');
        await createTable({
            logicalName: 'new_banktransaction',
            schemaName: 'new_BankTransaction',
            displayName: 'Transacción Bancaria',
            displayCollectionName: 'Transacciones Bancarias',
            description: 'Bank transactions for reconciliation',
            primaryNameLogicalName: 'new_name',
            primaryNameSchemaName: 'new_Name'
        });

        // Add columns to Bank Transaction
        await addColumn('new_banktransaction', {
            logicalName: 'new_txid',
            schemaName: 'new_TxId',
            displayName: 'ID de Transacción',
            type: 'String',
            maxLength: 100
        });

        await addColumn('new_banktransaction', {
            logicalName: 'new_accountno',
            schemaName: 'new_AccountNo',
            displayName: 'No. de Cuenta',
            type: 'String',
            maxLength: 50
        });

        await addColumn('new_banktransaction', {
            logicalName: 'new_txdate',
            schemaName: 'new_TxDate',
            displayName: 'Fecha de Transacción',
            type: 'String',
            maxLength: 50
        });

        await addColumn('new_banktransaction', {
            logicalName: 'new_description',
            schemaName: 'new_Description',
            displayName: 'Descripción',
            type: 'String',
            maxLength: 500
        });

        await addColumn('new_banktransaction', {
            logicalName: 'new_amount',
            schemaName: 'new_Amount',
            displayName: 'Monto',
            type: 'Money',
            precision: 2
        });

        await addColumn('new_banktransaction', {
            logicalName: 'new_currency',
            schemaName: 'new_Currency',
            displayName: 'Moneda',
            type: 'String',
            maxLength: 10
        });

        await addColumn('new_banktransaction', {
            logicalName: 'new_direction',
            schemaName: 'new_Direction',
            displayName: 'Dirección',
            type: 'String',
            maxLength: 20
        });

        // 2. Create ERP Cash Ledger Table
        console.log('📦 Creating new_ErpCashLedger...');
        await createTable({
            logicalName: 'new_erpcashledger',
            schemaName: 'new_ErpCashLedger',
            displayName: 'Libro de Caja ERP',
            displayCollectionName: 'Libros de Caja ERP',
            description: 'ERP cash ledger entries for reconciliation',
            primaryNameLogicalName: 'new_name',
            primaryNameSchemaName: 'new_Name'
        });

        // Add columns to ERP Cash Ledger
        await addColumn('new_erpcashledger', {
            logicalName: 'new_ledgerid',
            schemaName: 'new_LedgerId',
            displayName: 'ID de Asiento',
            type: 'String',
            maxLength: 100
        });

        await addColumn('new_erpcashledger', {
            logicalName: 'new_sourcesystem',
            schemaName: 'new_SourceSystem',
            displayName: 'Sistema Origen',
            type: 'String',
            maxLength: 50
        });

        await addColumn('new_erpcashledger', {
            logicalName: 'new_docref',
            schemaName: 'new_DocRef',
            displayName: 'Ref. de Documento',
            type: 'String',
            maxLength: 100
        });

        await addColumn('new_erpcashledger', {
            logicalName: 'new_postingdate',
            schemaName: 'new_PostingDate',
            displayName: 'Fecha de Contabilización',
            type: 'String',
            maxLength: 50
        });

        await addColumn('new_erpcashledger', {
            logicalName: 'new_description',
            schemaName: 'new_Description',
            displayName: 'Descripción',
            type: 'String',
            maxLength: 500
        });

        await addColumn('new_erpcashledger', {
            logicalName: 'new_amount',
            schemaName: 'new_Amount',
            displayName: 'Monto',
            type: 'Money',
            precision: 2
        });

        await addColumn('new_erpcashledger', {
            logicalName: 'new_currency',
            schemaName: 'new_Currency',
            displayName: 'Moneda',
            type: 'String',
            maxLength: 10
        });

        await addColumn('new_erpcashledger', {
            logicalName: 'new_direction',
            schemaName: 'new_Direction',
            displayName: 'Dirección',
            type: 'String',
            maxLength: 20
        });

        // 3. Create Bank Recon Match Table
        console.log('📦 Creating new_BankReconMatch...');
        await createTable({
            logicalName: 'new_bankreconmatch',
            schemaName: 'new_BankReconMatch',
            displayName: 'Conciliación Bancaria',
            displayCollectionName: 'Conciliaciones Bancarias',
            description: 'Bank reconciliation matches',
            primaryNameLogicalName: 'new_name',
            primaryNameSchemaName: 'new_Name'
        });

        // Add columns to Bank Recon Match
        await addColumn('new_bankreconmatch', {
            logicalName: 'new_matchid',
            schemaName: 'new_MatchId',
            displayName: 'ID de Conciliación',
            type: 'String',
            maxLength: 100
        });

        await addColumn('new_bankreconmatch', {
            logicalName: 'new_matchstatus',
            schemaName: 'new_MatchStatus',
            displayName: 'Estado',
            type: 'String',
            maxLength: 50
        });

        await addColumn('new_bankreconmatch', {
            logicalName: 'new_confidence',
            schemaName: 'new_Confidence',
            displayName: 'Confianza',
            type: 'Double',
            precision: 2
        });

        await addColumn('new_bankreconmatch', {
            logicalName: 'new_reason',
            schemaName: 'new_Reason',
            displayName: 'Razón',
            type: 'Memo',
            maxLength: 2000
        });

        // Add lookup columns
        await addLookupColumn('new_bankreconmatch', {
            logicalName: 'new_banktransactionid',
            schemaName: 'new_BankTransactionId',
            displayName: 'Transacción Bancaria',
            targetEntity: 'new_banktransaction'
        });

        await addLookupColumn('new_bankreconmatch', {
            logicalName: 'new_erpcashledgerid',
            schemaName: 'new_ErpCashLedgerId',
            displayName: 'Asiento ERP',
            targetEntity: 'new_erpcashledger'
        });

        console.log('✅ All tables and columns created successfully!');
        console.log('📝 You can now seed data using the seed_dataverse.ts script.');
    } catch (error: any) {
        console.error('❌ Provisioning failed:', error.response?.data || error.message);
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
    // Check if table already exists
    try {
        await ppService.makeRequest('GET', `api/data/v9.2/EntityDefinitions(LogicalName='${params.logicalName}')`);
        console.log(`ℹ️  Table ${params.logicalName} already exists, skipping...`);
        return;
    } catch (e) {
        // Table doesn't exist, proceed with creation
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

    // Wait for propagation
    await new Promise(resolve => setTimeout(resolve, 2000));
}

async function addColumn(entityLogicalName: string, params: {
    logicalName: string;
    schemaName: string;
    displayName: string;
    type: 'String' | 'Money' | 'Double' | 'Memo';
    maxLength?: number;
    precision?: number;
}) {
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
    }

    await ppService.makeRequest('POST', `api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`, attributeDefinition);
    console.log(`  ✅ Column ${params.logicalName} added`);
}

async function addLookupColumn(entityLogicalName: string, params: {
    logicalName: string;
    schemaName: string;
    displayName: string;
    targetEntity: string;
}) {
    const attributeDefinition = {
        "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
        LogicalName: params.logicalName,
        SchemaName: params.schemaName,
        DisplayName: createLocalizedLabel(params.displayName),
        RequiredLevel: {
            Value: "None",
            CanBeChanged: true,
            ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
        },
        IsCustomAttribute: true,
        Targets: [params.targetEntity]
    };

    await ppService.makeRequest('POST', `api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`, attributeDefinition);
    console.log(`  ✅ Lookup column ${params.logicalName} added`);
}

provisionDataverse();
