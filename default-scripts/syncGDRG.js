const fs = require('fs');
const path = require('path');
const GDRGCode = require('../models/claims/GDRGCode');



const syncGDRGData = async () => {
  try {
    const filePath = path.join(__dirname, '../assets/gdrg_codes.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(rawData);

    if (!parsed.GDRG_Codes || !Array.isArray(parsed.GDRG_Codes)) {
      console.error('❌ Invalid JSON structure.');
      return;
    }

    for (const group of parsed.GDRG_Codes) {
      const { category, codes } = group;
      for (const item of codes) {
        const [record, created] = await GDRGCode.findOrCreate({
          where: { code: item.code },
          defaults: {
            description: item.description,
            condition: item.condition,
            category,
            market_price: 0
           }
        });

        if (created) {
          console.log(`✔ Inserted GDRG code: ${item.code} (${category})`);
        }
      }
    }

    console.log('✅ GDRG sync complete.');
  } catch (error) {
    console.log(error)
    console.error('❌ Error syncing GDRG data:', error.message);
  }
};

module.exports = syncGDRGData;
