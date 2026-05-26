const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');
const LabInvestigation = require('../models/claims/LabInvestigations');
const LabTestTemplate = require('../models/lab/LabTestTemplate');
const LabTestField = require('../models/lab/LabTestField');

const seedLabTests = async () => {
  console.log('Starting comprehensive lab tests seeding process...');
  
  const transaction = await sequelize.transaction();
  let stats = {
    investigations: { created: 0, skipped: 0, errors: 0 },
    templates: { created: 0, skipped: 0, errors: 0 },
    fields: { created: 0, errors: 0 }
  };

  try {
    // Load data files
    const investigationsData = await loadJsonFile('../assets/Lab_investigation.json');
    const templatesData = await loadJsonFile('../assets/labTestTemplates.json');

    if (!investigationsData?.lab_investigations || !templatesData?.templates) {
      throw new Error('Invalid data files structure');
    }

    // Step 1: Create Lab Investigations
    console.log(`Processing ${investigationsData.lab_investigations.length} investigations...`);
    for (const [index, inv] of investigationsData.lab_investigations.entries()) {
      try {
        // Progress logging
        if (index > 0 && index % 10 === 0) {
          console.log(`Investigations processed: ${index}`);
        }

        // Validate required fields
        if (!inv["Test Description"] || !inv["G-DRG Code"]) {
          console.warn(`Skipping investigation with missing fields at index ${index}`);
          stats.investigations.skipped++;
          continue;
        }

        // Check if exists
        const exists = await LabInvestigation.findOne({
          where: { 
            test_description: inv["Test Description"],
            g_drg_code: inv["G-DRG Code"]
          },
          transaction
        });
        
        if (exists) {
          stats.investigations.skipped++;
          continue;
        }

        // Create investigation
        await LabInvestigation.create({
          test_description: inv["Test Description"],
          g_drg_code: inv["G-DRG Code"],
          tariff_ghc: parseFloat(inv["Tariff (GHS)"]) || 0,
          category: 'laboratory',
          isActive: true,
         
        }, { transaction });

        stats.investigations.created++;
      } catch (error) {
        stats.investigations.errors++;
        console.error(`Error processing investigation "${inv["Test Description"]}":`, error.message);
      }
    }

    // Step 2: Create Templates for matching investigations
    console.log(`Processing ${templatesData.templates.length} templates...`);
    const allInvestigations = await LabInvestigation.findAll({ transaction });
    
    for (const [index, template] of templatesData.templates.entries()) {
      try {
        // Progress logging
        if (index > 0 && index % 10 === 0) {
          console.log(`Templates processed: ${index}`);
        }

        // Find matching investigation (case insensitive)
        const matchingInvestigation = allInvestigations.find(inv => 
          inv.test_description.toLowerCase() === template.testDescription.toLowerCase()
        );

        if (!matchingInvestigation) {
          console.warn(`No matching investigation for template: ${template.testDescription}`);
          stats.templates.skipped++;
          continue;
        }

        // Check if template exists
        const templateExists = await LabTestTemplate.findOne({
          where: { lab_tarrif_id: matchingInvestigation.id },
          transaction
        });

        if (templateExists) {
          stats.templates.skipped++;
          continue;
        }

        // Create template
        const createdTemplate = await LabTestTemplate.create({
          lab_tarrif_id: matchingInvestigation.id,
          description: template.testDescription,
          isActive: true
        }, { transaction });

        stats.templates.created++;

        // Step 3: Create Fields if they exist
        if (Array.isArray(template.fields) && template.fields.length > 0) {
          try {
            const fieldsToCreate = template.fields
              .filter(f => f.name && f.field_type)
              .map(field => ({
                label: field.unit,
                unit: field.unit || '',
                normal_range: field.normal_range || '',
                fieldType: field.field_type,
                templateId: createdTemplate.id,
                isActive: true,
              }));

            if (fieldsToCreate.length > 0) {
              await LabTestField.bulkCreate(fieldsToCreate, { transaction });
              stats.fields.created += fieldsToCreate.length;
            }
          } catch (fieldError) {
            stats.fields.errors++;
            console.error(`Error creating fields for template ${template.testDescription}:`, fieldError.message);
          }
        }
      } catch (error) {
        stats.templates.errors++;
        console.error(`Error processing template "${template.testDescription}":`, error.message);
      }
    }

    await transaction.commit();
    console.log('Seeding completed with results:', JSON.stringify(stats, null, 2));
    return stats;
  } catch (error) {
    await transaction.rollback();
    console.error('Seeding process failed:', error);
    throw error;
  }
};

// Helper function to load JSON files
async function loadJsonFile(relativePath) {
  try {
    const filePath = path.join(__dirname, relativePath);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error loading JSON file ${relativePath}:`, error);
    throw error;
  }
}

module.exports = seedLabTests;