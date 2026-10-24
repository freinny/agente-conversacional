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

async function addRelationships() {
    console.log('🚀 Adding lookup relationships...');

    try {
        // Add relationship from BankReconMatch to BankTransaction
        console.log('\n📦 Creating relationship: BankReconMatch -> BankTransaction...');
        await createRelationship({
            schemaName: 'new_bankreconmatch_banktransaction',
            referencedEntity: 'new_banktransaction',
            referencingEntity: 'new_bankreconmatch',
            lookupFieldName: 'new_banktransactionid',
            lookupFieldDisplayName: 'Transacción Bancaria'
        });

        console.log('\n⏳ Waiting 5s for metadata propagation...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Add relationship from BankReconMatch to ErpCashLedger
        console.log('\n📦 Creating relationship: BankReconMatch -> ErpCashLedger...');
        await createRelationship({
            schemaName: 'new_bankreconmatch_erpcashledger',
            referencedEntity: 'new_erpcashledger',
            referencingEntity: 'new_bankreconmatch',
            lookupFieldName: 'new_erpcashledgerid',
            lookupFieldDisplayName: 'Asiento ERP'
        });

        console.log('\n✅ All relationships created successfully!');
        console.log('📝 Schema is complete and ready for data seeding!');
    } catch (error: any) {
        console.error('\n❌ Error:', error.response?.data || error.message);
        throw error;
    }
}

async function createRelationship(params: {
    schemaName: string;
    referencedEntity: string;
    referencingEntity: string;
    lookupFieldName: string;
    lookupFieldDisplayName: string;
}) {
    const relationshipDefinition = {
        "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
        SchemaName: params.schemaName,
        ReferencedEntity: params.referencedEntity,
        ReferencedAttribute: `${params.referencedEntity}id`,
        ReferencingEntity: params.referencingEntity,
        Lookup: {
            "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
            SchemaName: params.lookupFieldName,
            DisplayName: createLocalizedLabel(params.lookupFieldDisplayName),
            RequiredLevel: {
                Value: "None",
                CanBeChanged: true,
                ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
            },
            IsCustomAttribute: true
        },
        CascadeConfiguration: {
            Assign: "NoCascade",
            Delete: "RemoveLink",
            Merge: "NoCascade",
            Reparent: "NoCascade",
            Share: "NoCascade",
            Unshare: "NoCascade"
        }
    };

    await ppService.makeRequest('POST', 'api/data/v9.2/RelationshipDefinitions', relationshipDefinition);
    console.log(`✅ Relationship ${params.schemaName} created`);
}

addRelationships();
