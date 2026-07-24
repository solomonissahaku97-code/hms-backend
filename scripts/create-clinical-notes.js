const sequelize = require('../config/database');
const { Op } = require('sequelize');
const Patient = require('../models/patient');
const Visit = require('../models/Visit');
const PatientNote = require('../models/PatientNote');
const Staff = require('../models/staff');
const Institution = require('../models/institution');

async function main() {
  console.log('Finding institution...');
  const institution = await Institution.findOne({
    where: { name: 'Baptist Regional Hospital' }
  });
  
  if (!institution) {
    console.error('Institution not found');
    process.exit(1);
  }
  
  const institution_id = institution.id;
  console.log(`Institution: ${institution.name} (${institution_id})`);

  console.log('Finding patient: Antwi 14 Appiah');
  const patient = await Patient.findOne({
    where: {
      institution_id,
      first_name: 'Antwi 14',
      last_name: 'Appiah'
    }
  });
  
  if (!patient) {
    console.error('Patient not found');
    process.exit(1);
  }
  
  console.log(`Patient: ${patient.first_name} ${patient.last_name} (${patient.id})`);

  let visit = await Visit.findOne({
    where: { patient_id: patient.id, institution_id }
  });
  
  if (!visit) {
    console.log('Creating visit...');
    visit = await Visit.create({
      patient_id: patient.id,
      institution_id,
      status: 'Active',
      attendance_type: 'New',
      visit_type: 'General OPD'
    });
  }
  
  console.log(`Visit: ${visit.id}`);

  const staff = await Staff.findOne({
    where: { institution_id }
  });
  
  if (!staff) {
    console.error('No staff found in institution');
    process.exit(1);
  }
  
  console.log(`Using staff: ${staff.firstName} ${staff.lastName} (${staff.id})`);

  const clinicalNotes = [
    {
      note: "Patient presented with mild fever and headache. Vital signs stable. Recommended rest and hydration. Follow-up in 3 days if symptoms persist."
    },
    {
      note: "Follow-up visit. Patient reports improvement in symptoms. Fever has subsided. Continue current medication regimen for 5 more days."
    },
    {
      note: "Patient complains of persistent cough for 2 weeks. Chest X-ray ordered. Auscultation reveals mild wheezing in upper lobe. Prescribed bronchodilator."
    },
    {
      note: "Routine health check. Blood pressure elevated at 140/90. Advised dietary changes and regular exercise. Scheduled follow-up in 2 weeks."
    },
    {
      note: "Patient presented with abdominal pain. Physical examination reveals tenderness in right lower quadrant. Blood tests ordered to rule out appendicitis."
    }
  ];

  console.log('Creating clinical notes...');
  let success = 0;
  let failed = 0;

  for (const noteData of clinicalNotes) {
    try {
      await PatientNote.create({
        visit_id: visit.id,
        staff_id: staff.id,
        institution_id,
        note: noteData.note,
        tagged_staff_ids: []
      });
      success++;
      console.log(`  Created note ${success}: ${noteData.note.slice(0, 50)}...`);
    } catch (err) {
      failed++;
      console.error(`  Failed: ${err.message}`);
    }
  }

  console.log(`\nDone. Notes created: ${success}, Failed: ${failed}`);
  await sequelize.close();
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
