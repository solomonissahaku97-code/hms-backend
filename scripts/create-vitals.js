const sequelize = require('../config/database');
const { Op } = require('sequelize');
const Patient = require('../models/patient');
const Visit = require('../models/Visit');
const VitalSignsRecord = require('../models/vital_signs_records');
const Institution = require('../models/institution');
const Department = require('../models/department');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('Finding institution and department...');
  const institution = await Institution.findOne({
    where: { name: 'Baptist Regional Hospital' }
  });
  
  if (!institution) {
    console.error('Institution not found');
    process.exit(1);
  }
  
  const institution_id = institution.id;
  const department = await Department.findOne({
    where: { institution_id }
  });
  
  if (!department) {
    console.error('Department not found');
    process.exit(1);
  }
  
  const department_id = department.id;
  console.log(`Using department: ${department.name} (${department_id})`);

  const namePatterns = [
    { name: 'Antwi', count: 14 },
    { name: 'Appiah', count: 10 },
    { name: 'Mensah', count: 10 },
    { name: 'Badu', count: 7 },
    { name: 'Afia', count: 7 },
    { name: 'Owusu', count: 3 },
    { name: 'Kofi', count: 3 },
    { name: 'Bediako', count: null },
    { name: 'Haruna', count: null },
    { name: 'Yahaya', count: null },
  ];

  const patientIds = new Set();
  
  for (const pattern of namePatterns) {
    console.log(`Searching for patients with name containing: ${pattern.name}`);
    
    const matchingPatients = await Patient.findAll({
      where: {
        institution_id,
        [Op.or]: [
          { first_name: { [Op.iLike]: `%${pattern.name}%` } },
          { last_name: { [Op.iLike]: `%${pattern.name}%` } }
        ]
      },
      limit: pattern.count || 100
    });
    
    console.log(`  Found ${matchingPatients.length} patients`);
    for (const p of matchingPatients.slice(0, 5)) {
      console.log(`    - ${p.first_name} ${p.last_name} (${p.id})`);
    }
    
    for (const p of matchingPatients) {
      patientIds.add(p.id);
    }
  }
  
  console.log(`\nTotal unique patients to process: ${patientIds.size}`);
  
  let success = 0;
  let failed = 0;
  
  for (const patientId of patientIds) {
    try {
      const patient = await Patient.findByPk(patientId);
      
      // Find or create a visit for this patient
      let visit = await Visit.findOne({
        where: { patient_id: patientId, institution_id, status: 'Active' }
      });
      
      if (!visit) {
        visit = await Visit.create({
          patient_id: patientId,
          institution_id,
          department_id,
          status: 'Active',
          attendance_type: 'New',
          visit_type: 'General OPD'
        });
      }
      
      const vitalSigns = {
        visit_id: visit.id,
        patient_id: patientId,
        institution_id,
        department_id,
        temperature: randomInt(360, 380) / 10, // 36.0 - 38.0
        heart_rate: randomInt(60, 100),
        pulse: randomInt(60, 100),
        systole: String(randomInt(110, 130)),
        diastole: String(randomInt(70, 85)),
        SpO2: randomInt(95, 100),
        oxygen: randomInt(95, 100),
        weight: randomInt(50, 120),
        height: randomInt(150, 190),
        rbs: String(randomInt(70, 140)),
        pain: String(randomInt(0, 3)),
        status: randomItem(['Normal', 'Normal', 'Normal', 'Abnormal']),
        type: 'Routine Checkup'
      };
      
      await VitalSignsRecord.create(vitalSigns);
      success++;
      
      if (success % 20 === 0) {
        console.log(`Created ${success} vital signs records...`);
      }
    } catch (err) {
      failed++;
      console.error(`Failed for patient ${patientId}:`, err.message);
    }
  }
  
  console.log(`\nDone. Vital signs created: ${success}, Failed: ${failed}`);
  await sequelize.close();
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
