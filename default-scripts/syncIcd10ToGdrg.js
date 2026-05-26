const fs = require('fs');
const path = require('path');
const ICD10ToGDRG = require('../models/claims/ICD10ToGDRG');

const syncICD10ToGDRG = async () => {
  try {
    const filePath = path.join(__dirname, '../assets/grouped_icd10_to_gdrg_mappings.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const mappings = JSON.parse(rawData);

    // Optional: Clear the table before sync (if you want to replace all data)
    await ICD10ToGDRG   .destroy({ where: {} });

    // Bulk insert
    await ICD10ToGDRG.bulkCreate(mappings, {
      validate: true
    });

    console.log(`[✓] Synced ${mappings.length} ICD10-to-GDRG mappings into the database.`);
  } catch (error) {
    console.error('❌ Failed to sync ICD10-to-GDRG mappings:', error);
  }
};

module.exports = syncICD10ToGDRG;
