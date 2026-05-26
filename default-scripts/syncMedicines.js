const fs = require('fs');
const path = require('path');
const Medicine = require('../models/claims/medication');

async function syncMedicines() {
  try {
    const filePath = path.join(__dirname, '../assets/medications.json');
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    const medicines = jsonData.NHIS_Medicines_List_2025;

    // Prepare bulk data 
    const bulkData = medicines.map(med => ({
      code: med.CODE,
      generic_name: med.GENERIC_NAME,
      unit_of_pricing: med.UNIT_OF_PRICING, 
      nhia_price: med.PRICE_GHC,
      level_of_prescribing: med.LEVEL_OF_PRESCRIBING
    }));

    // Bulk upsert (MySQL, MariaDB, and PostgreSQL supported)
    await Medicine.bulkCreate(bulkData, {
      updateOnDuplicate: ['generic_name', 'unit_of_pricing', 'price_ghc', 'level_of_prescribing']
    });

    console.log(`[✓] Synced ${medicines.length} NHIS medicines (bulk).`);
  } catch (error) {
    console.error('❌ Error syncing medicines:', error);
  }
}

module.exports = syncMedicines;
