// @ts-nocheck
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ppService } from './pp_service';

async function validateRelationships() {
    console.log('🔍 Validating all table relationships...\n');

    const expectedRelationships = [
        {
            name: 'new_bankreconmatch_banktransaction',
            referencingEntity: 'new_bankreconmatch',
            referencedEntity: 'new_banktransaction',
            lookupField: 'new_banktransactionid'
        },
        {
            name: 'new_bankreconmatch_erpcashledger',
            referencingEntity: 'new_bankreconmatch',
            referencedEntity: 'new_erpcashledger',
            lookupField: 'new_erpcashledgerid'
        },
        {
            name: 'new_dimemployees_dimsites',
            referencingEntity: 'new_dimemployees',
            referencedEntity: 'new_dimsites',
            lookupField: 'new_siteid'
        },
        {
            name: 'new_factactivity_dimemployees',
            referencingEntity: 'new_factactivity',
            referencedEntity: 'new_dimemployees',
            lookupField: 'new_employeeid'
        },
        {
            name: 'new_factactivity_dimprocesses',
            referencingEntity: 'new_factactivity',
            referencedEntity: 'new_dimprocesses',
            lookupField: 'new_processid'
        }
    ];

    let allValid = true;

    for (const rel of expectedRelationships) {
        try {
            // Check if the lookup field exists on the referencing entity
            const attribute = await ppService.makeRequest(
                'GET',
                `api/data/v9.2/EntityDefinitions(LogicalName='${rel.referencingEntity}')/Attributes(LogicalName='${rel.lookupField}')`
            );

            if (attribute.AttributeType === 'Lookup') {
                console.log(`✅ ${rel.name}`);
                console.log(`   ${rel.referencingEntity}.${rel.lookupField} → ${rel.referencedEntity}`);
            } else {
                console.log(`⚠️  ${rel.name} - Field exists but is not a Lookup type`);
                allValid = false;
            }
        } catch (error: any) {
            console.log(`❌ ${rel.name} - Lookup field not found`);
            console.log(`   Expected: ${rel.referencingEntity}.${rel.lookupField} → ${rel.referencedEntity}`);
            allValid = false;
        }
    }

    console.log('\n' + '='.repeat(60));
    if (allValid) {
        console.log('✅ All relationships validated successfully!');
    } else {
        console.log('⚠️  Some relationships are missing or invalid.');
        console.log('   Run the relationship creation scripts to fix.');
    }
    console.log('='.repeat(60));

    return allValid;
}

validateRelationships();
