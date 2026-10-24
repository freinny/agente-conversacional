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

async function addMissingRelationship() {
    console.log('🔧 Adding missing relationship: new_factactivity → new_dimprocesses...\n');

    try {
        const relationshipDefinition = {
            "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
            SchemaName: 'new_factactivity_dimprocesses',
            ReferencedEntity: 'new_dimprocesses',
            ReferencedAttribute: 'new_dimprocessesid',
            ReferencingEntity: 'new_factactivity',
            Lookup: {
                "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
                SchemaName: 'new_processid',
                DisplayName: createLocalizedLabel('Proceso'),
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
        console.log('✅ Relationship new_factactivity_dimprocesses created successfully!');
        console.log('   new_factactivity.new_processid → new_dimprocesses');
        console.log('\n🎉 All relationships are now in place!');
    } catch (error: any) {
        if (error.response?.data?.error?.message?.includes('already exists')) {
            console.log('ℹ️  Relationship already exists, skipping...');
        } else {
            console.error('❌ Error:', error.response?.data || error.message);
            throw error;
        }
    }
}

addMissingRelationship();
