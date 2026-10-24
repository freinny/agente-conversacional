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

async function createRemainingTables() {
    console.log('🚀 Creating remaining tables from amalia.db schema...\n');

    try {
        // 1. Create dim_sites (GBS)
        console.log('📦 Creating new_DimSites...');
        await createTable({
            logicalName: 'new_dimsites',
            schemaName: 'new_DimSites',
            displayName: 'Sitios',
            displayCollectionName: 'Sitios',
            description: 'GBS Sites dimension',
            primaryNameLogicalName: 'new_name',
            primaryNameSchemaName: 'new_Name'
        });
        await wait(5000);

        await addColumn('new_dimsites', { logicalName: 'new_sitename', schemaName: 'new_SiteName', displayName: 'Nombre del Sitio', type: 'String', maxLength: 100 });
        await wait(3000);
        await addColumn('new_dimsites', { logicalName: 'new_country', schemaName: 'new_Country', displayName: 'País', type: 'String', maxLength: 10 });
        await wait(3000);

        // 2. Create dim_employees (GBS)
        console.log('\n📦 Creating new_DimEmployees...');
        await createTable({
            logicalName: 'new_dimemployees',
            schemaName: 'new_DimEmployees',
            displayName: 'Empleados',
            displayCollectionName: 'Empleados',
            description: 'GBS Employees dimension',
            primaryNameLogicalName: 'new_name',
            primaryNameSchemaName: 'new_Name'
        });
        await wait(5000);

        await addColumn('new_dimemployees', { logicalName: 'new_employeeid', schemaName: 'new_EmployeeId', displayName: 'ID de Empleado', type: 'String', maxLength: 50 });
        await wait(3000);
        await addColumn('new_dimemployees', { logicalName: 'new_employeename', schemaName: 'new_EmployeeName', displayName: 'Nombre', type: 'String', maxLength: 200 });
        await wait(3000);
        await addColumn('new_dimemployees', { logicalName: 'new_role', schemaName: 'new_Role', displayName: 'Rol', type: 'String', maxLength: 100 });
        await wait(3000);
        await addColumn('new_dimemployees', { logicalName: 'new_team', schemaName: 'new_Team', displayName: 'Equipo', type: 'String', maxLength: 100 });
        await wait(3000);
        await addColumn('new_dimemployees', { logicalName: 'new_fte', schemaName: 'new_FTE', displayName: 'FTE', type: 'Double', precision: 2 });
        await wait(3000);

        // Add lookup to sites
        await addRelationship({
            schemaName: 'new_dimemployees_dimsites',
            referencedEntity: 'new_dimsites',
            referencingEntity: 'new_dimemployees',
            lookupFieldName: 'new_siteid',
            lookupFieldDisplayName: 'Sitio'
        });
        await wait(5000);

        // 3. Create dim_processes (GBS)
        console.log('\n📦 Creating new_DimProcesses...');
        await createTable({
            logicalName: 'new_dimprocesses',
            schemaName: 'new_DimProcesses',
            displayName: 'Procesos',
            displayCollectionName: 'Procesos',
            description: 'GBS Processes dimension',
            primaryNameLogicalName: 'new_name',
            primaryNameSchemaName: 'new_Name'
        });
        await wait(5000);

        await addColumn('new_dimprocesses', { logicalName: 'new_processname', schemaName: 'new_ProcessName', displayName: 'Proceso', type: 'String', maxLength: 200 });
        await wait(3000);
        await addColumn('new_dimprocesses', { logicalName: 'new_subprocessname', schemaName: 'new_SubprocessName', displayName: 'Subproceso', type: 'String', maxLength: 200 });
        await wait(3000);

        // 4. Create fact_activity (GBS)
        console.log('\n📦 Creating new_FactActivity...');
        await createTable({
            logicalName: 'new_factactivity',
            schemaName: 'new_FactActivity',
            displayName: 'Actividades',
            displayCollectionName: 'Actividades',
            description: 'GBS Activity facts',
            primaryNameLogicalName: 'new_name',
            primaryNameSchemaName: 'new_Name'
        });
        await wait(5000);

        await addColumn('new_factactivity', { logicalName: 'new_activityid', schemaName: 'new_ActivityId', displayName: 'ID de Actividad', type: 'String', maxLength: 50 });
        await wait(3000);
        await addColumn('new_factactivity', { logicalName: 'new_activitydate', schemaName: 'new_ActivityDate', displayName: 'Fecha', type: 'String', maxLength: 50 });
        await wait(3000);
        await addColumn('new_factactivity', { logicalName: 'new_handletimemin', schemaName: 'new_HandleTimeMin', displayName: 'Tiempo de Manejo (min)', type: 'Double', precision: 2 });
        await wait(3000);
        await addColumn('new_factactivity', { logicalName: 'new_queuetimemin', schemaName: 'new_QueueTimeMin', displayName: 'Tiempo en Cola (min)', type: 'Double', precision: 2 });
        await wait(3000);
        await addColumn('new_factactivity', { logicalName: 'new_cycletimemin', schemaName: 'new_CycleTimeMin', displayName: 'Tiempo de Ciclo (min)', type: 'Double', precision: 2 });
        await wait(3000);
        await addColumn('new_factactivity', { logicalName: 'new_slatargetmin', schemaName: 'new_SLATargetMin', displayName: 'SLA Objetivo (min)', type: 'Double', precision: 2 });
        await wait(3000);
        await addColumn('new_factactivity', { logicalName: 'new_slamet', schemaName: 'new_SLAMet', displayName: 'SLA Cumplido', type: 'Integer' });
        await wait(3000);
        await addColumn('new_factactivity', { logicalName: 'new_reworkflag', schemaName: 'new_ReworkFlag', displayName: 'Retrabajo', type: 'Integer' });
        await wait(3000);
        await addColumn('new_factactivity', { logicalName: 'new_errorflag', schemaName: 'new_ErrorFlag', displayName: 'Error', type: 'Integer' });
        await wait(3000);
        await addColumn('new_factactivity', { logicalName: 'new_qualityscore', schemaName: 'new_QualityScore', displayName: 'Calidad', type: 'Double', precision: 2 });
        await wait(3000);
        await addColumn('new_factactivity', { logicalName: 'new_volumeunits', schemaName: 'new_VolumeUnits', displayName: 'Volumen', type: 'Integer' });
        await wait(3000);
        await addColumn('new_factactivity', { logicalName: 'new_automationassisted', schemaName: 'new_AutomationAssisted', displayName: 'Automatización', type: 'Integer' });
        await wait(3000);

        // Add lookups for fact_activity
        await addRelationship({
            schemaName: 'new_factactivity_dimemployees',
            referencedEntity: 'new_dimemployees',
            referencingEntity: 'new_factactivity',
            lookupFieldName: 'new_employeeid',
            lookupFieldDisplayName: 'Empleado'
        });
        await wait(5000);

        await addRelationship({
            schemaName: 'new_factactivity_dimprocesses',
            referencedEntity: 'new_dimprocesses',
            referencingEntity: 'new_factactivity',
            lookupFieldName: 'new_processid',
            lookupFieldDisplayName: 'Proceso'
        });
        await wait(5000);

        // 5. Create pettycash_requests
        console.log('\n📦 Creating new_PettyCashRequests...');
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

        console.log('\n✅ All remaining tables created successfully!');
        console.log('📝 Complete amalia.db schema has been replicated to Dataverse!');
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

async function addRelationship(params: {
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
    console.log(`  ✅ Relationship ${params.schemaName} created`);
}

createRemainingTables();
