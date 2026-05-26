const fs = require('fs');
const path = require('path');
const LabRanges = require('../models/lab/LabRanges');

const syncLabRanges = async () => {
  try {
    const filePath = path.join(__dirname, '../assets/lab_ranges.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(rawData);

    if (!Array.isArray(parsed)) {
      console.error('❌ Invalid JSON structure.');
      return;
    }

    for (const item of parsed) {
      const [record, created] = await LabRanges.findOrCreate({
        where: {
          test_name: item.test_name,
          reference_range: item.reference_range,
          category: item.category
        },
        defaults: {
          unit: item.unit || null,
          notes: item.notes || null
        }
      });

      if (created) {
        console.log(`✔ Inserted lab range: ${item.test_name}`);
      }
    }

    console.log('✅ Lab ranges sync complete.');
  } catch (error) {
    console.error('❌ Error syncing lab ranges:', error.message);
  }
};

module.exports = syncLabRanges;
