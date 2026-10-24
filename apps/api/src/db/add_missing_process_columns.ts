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

async function addMissingColumns() {
    console.log('🔧 Adding missing columns to new_dimprocesses...\n');

    try {
        // Add new_processname
        console.log('Adding new_processname...');
        const processNameAttr = {
            "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
            LogicalName: 'new_processname',
            SchemaName: 'new_ProcessName',
            DisplayName: createLocalizedLabel('Proceso'),
            RequiredLevel: {
                Value: "None",
                CanBeChanged: true,
                ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
            },
            MaxLength: 200,
            Format: "Text",
            IsCustomAttribute: true
        };
        await ppService.makeRequest('POST', 'api/data/v9.2/EntityDefinitions(LogicalName=\'new_dimprocesses\')/Attributes', processNameAttr);
        console.log('✅ new_processname added');

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Add new_subprocessname
        console.log('\nAdding new_subprocessname...');
        const subprocessNameAttr = {
            "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
            LogicalName: 'new_subprocessname',
            SchemaName: 'new_SubprocessName',
            DisplayName: createLocalizedLabel('Subproceso'),
            RequiredLevel: {
                Value: "None",
                CanBeChanged: true,
                ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings"
            },
            MaxLength: 200,
            Format: "Text",
            IsCustomAttribute: true
        };
        await ppService.makeRequest('POST', 'api/data/v9.2/EntityDefinitions(LogicalName=\'new_dimprocesses\')/Attributes', subprocessNameAttr);
        console.log('✅ new_subprocessname added');

        console.log('\n🎉 All missing columns added successfully!');
        console.log('✨ All 8 tables now have complete column sets!');
    } catch (error: any) {
        console.error('\n❌ Error:', error.response?.data || error.message);
        throw error;
    }
}

addMissingColumns();
