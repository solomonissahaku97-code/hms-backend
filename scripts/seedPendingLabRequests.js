const sequelize = require('../config/database');
const { Op } = require('sequelize');
const Patient = require('../models/patient');
const Institution = require('../models/institution');
const Department = require('../models/department');
const Visit = require('../models/Visit');
const LabTestTemplate = require('../models/lab/LabTestTemplate');
const LabTestResult = require('../models/lab/LabTestResult');
const LabInvestigation = require('../models/claims/LabInvestigations');

async function main() {
  console.log('Seeding 3 pending lab requests for Ama Serwaa Boateng...');

  const institution = await Institution.findOne({
    where: { name: 'Accra Psychiatric Hospital' }
  });
  if (!institution) {
    console.error('Accra Psychiatric Hospital not found');
    process.exit(1);
  }
  console.log(`Found institution: ${institution.name} (${institution.id})`);

  const patient = await Patient.findOne({
    where: {
      first_name: 'Ama',
      middle_name: 'Serwaa',
      last_name: 'Boateng',
      institution_id: institution.id
    }
  });
  if (!patient) {
    console.error('Patient Ama Serwaa Boateng not found');
    process.exit(1);
  }
  console.log(`Found patient: ${patient.first_name} ${patient.middle_name || ''} ${patient.last_name} (${patient.id})`);

  const visit = await Visit.findOne({
    where: { patient_id: patient.id, institution_id: institution.id }
  });
  if (!visit) {
    console.error('No visit found for this patient at this institution');
    process.exit(1);
  }
  console.log(`Found visit: ${visit.id}`);

  const labDepartment = await Department.findOne({
    where: { institution_id: institution.id, departmentType: 'Lab' }
  });
  if (!labDepartment) {
    console.error('Lab department not found');
    process.exit(1);
  }
  console.log(`Found Lab department: ${labDepartment.name} (${labDepartment.id})`);

  const investigations = await LabInvestigation.findAll({
    where: {
      [Op.in]: ['INVE51D', 'INVE74D', 'INVE69D']
    }
  });

  if (investigations.length < 3) {
    console.error(`Expected 3 lab investigations, found ${investigations.length}`);
    process.exit(1);
  }

  const investigationMap = {};
  investigations.forEach(inv => {
    investigationMap[inv.g_drg_code] = inv;
  });

  const templatesData = [
    {
      name: 'Full Blood Count (FBC) with Film',
      lab_tarrif_id: investigationMap['INVE51D'].id,
      description: 'Complete blood count with peripheral blood film',
      specimen_types: ['blood'],
      turnaround_time_hours: 24,
      department_id: labDepartment.id,
    },
    {
      name: 'Liver Function Test (LFT)',
      lab_tarrif_id: investigationMap['INVE74D'].id,
      description: 'Liver function panel including ALT, AST, ALP, bilirubin',
      specimen_types: ['blood'],
      turnaround_time_hours: 24,
      department_id: labDepartment.id,
    },
    {
      name: 'HIV Screening',
      lab_tarrif_id: investigationMap['INVE69D'].id,
      description: 'HIV screening test (rapid antibody)',
      specimen_types: ['blood'],
      turnaround_time_hours: 48,
      department_id: labDepartment.id,
    },
  ];

  const templates = [];
  for (const tData of templatesData) {
    const template = await LabTestTemplate.create(tData);
    templates.push(template);
    console.log(`Created template: ${template.name} (${template.id})`);
  }

  const labResultsData = [
    {
      visit_id: visit.id,
      patient_id: patient.id,
      institution_id: institution.id,
      department_id: labDepartment.id,
      templateId: templates[0].id,
      status: 'pending',
      request_notes: 'Routine CBC as part of psychiatric evaluation',
      specimen_type: 'blood',
    },
    {
      visit_id: visit.id,
      patient_id: patient.id,
      institution_id: institution.id,
      department_id: labDepartment.id,
      templateId: templates[1].id,
      status: 'pending',
      request_notes: 'LFT panel before initiating psychotropic medication',
      specimen_type: 'blood',
    },
    {
      visit_id: visit.id,
      patient_id: patient.id,
      institution_id: institution.id,
      department_id: labDepartment.id,
      templateId: templates[2].id,
      status: 'pending',
      request_notes: 'HIV screening as part of standard admission workup',
      specimen_type: 'blood',
    },
  ];

  let success = 0;
  for (const resultData of labResultsData) {
    const result = await LabTestResult.create(resultData);
    success++;
    console.log(`Created pending lab result: ${result.id} for template ${result.templateId}`);
  }

  console.log(`\nDone. Created ${success} pending lab requests for Ama Serwaa Boateng.`);
  await sequelize.close();
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});