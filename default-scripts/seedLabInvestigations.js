const fs = require('fs');
const path = require('path');
const LabInvestigation = require('../models/claims/LabInvestigations');

async function syncLabInvestigations() {
  try {
    const filePath = path.join(__dirname, '../assets/Lab_investigation.json'); // Adjust path to your JSON file
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    const investigations = jsonData.lab_investigations;

    // Prepare bulk data
    const bulkData = investigations.map(investigation => ({
      test_description: investigation['Test Description'],
      g_drg_code: investigation['G-DRG Code'],
      tariff_ghc: investigation['Tariff (GHS)']
    }));

    // Bulk upsert (MySQL, MariaDB, and PostgreSQL supported)
    await LabInvestigation.bulkCreate(bulkData, {
      updateOnDuplicate: ['test_description', 'tariff_ghc']
    });

    console.log(`[✓] Synced ${investigations.length} lab investigations (bulk).`);
  } catch (error) {
    console.error('❌ Error syncing lab investigations:', error);
  }
}

module.exports = syncLabInvestigations;