const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database'); // Adjust if path is different
const systemDiagnosis = require('../models/claims/systemDiagnosis');

const seedSystemDiagnosis = async () => {
  try {
    const dataPath = path.join(__dirname, '../assets/icd10_gender_classified.json');
    const rawData = fs.readFileSync(dataPath);
    const diagnoses = JSON.parse(rawData);

    const count = await systemDiagnosis.count();
    if (count > 0) {
      console.log('SystemDiagnosis already seeded. Skipping...');
      return;
    }

    await systemDiagnosis.bulkCreate(
      diagnoses.map(item => ({
        icd_10_code: item.code,
        diagnosis_name: item.diagnosis,
        gender: ['M', 'F','B'].includes(item.gender) ? item.gender : null,
      })),
      { validate: true }
    );

    console.log(`Inserted ${diagnoses.length} records into system_diagnosis.`);
  } catch (error) {
    console.error('Seeding failed:', error);
  }
};

module.exports = seedSystemDiagnosis;





seedSystemDiagnosis()
  .then(() => console.log('Seeding completed successfully.'))
  .catch(error => console.error('Seeding encountered an error:', error));

// Export the function for use in other scripts if needed
module.exports = seedSystemDiagnosis;


