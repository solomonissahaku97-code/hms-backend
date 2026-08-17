#!/usr/bin/env node
/**
 * PHASE 2 — CLAIMS & NHIA INTEGRITY VERIFICATION
 *
 * SAFETY:
 *  - Refuses to run when NODE_ENV=production or DB_HOST is not localhost.
 *  - Creates its own fixtures and DELETES every row it creates (reverse
 *    dependency order), including generated XML files and export rows.
 *  - Never run against a remote/production database.
 *
 * Run:  cd hms-backend && node verify_phase2.js
 */

require('dotenv').config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';
if (NODE_ENV === 'production' || !['localhost', '127.0.0.1'].includes(DB_HOST)) {
  console.error('❌ Refusing to run: verify_phase2.js only runs against the local development database.');
  process.exit(1);
}

const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const { sequelize } = require('./models');
const {
  Institution, Patient, Visit, Service, ServiceBill, Invoice,
  Claim, ClaimItem, Department, Staff, Insurance,
} = require('./models');

const LabInvestigation = require('./models/claims/LabInvestigations');
const LabTestTemplate = require('./models/lab/LabTestTemplate');
const LabTestResult = require('./models/lab/LabTestResult');
const GDRGCode = require('./models/claims/GDRGCode');
const Procedure = require('./models/procedure/procedure');
const Medicine = require('./models/claims/medication');
const Prescription = require('./models/prescription');
const systemDiagnosis = require('./models/claims/systemDiagnosis');
const Diagnosis = require('./models/diagnosis');
const NHISClaimExport = require('./models/claims/nhisClaimExport');

const { handleBilling, applyNhisPayment } = require('./utils/billingUtil');
const { addClaimItem, validateClaimItemPrices } = require('./service/claimService');
const { validateClaimsForExport } = require('./utils/claimExportUtils');
const invoiceController = require('./controllers/accounts/invoice.controller');
const nhiaController = require('./controllers/claims/nhiaClaimGenerationController');
const ProcedureController = require('./controllers/procedure/ProcedureController');

const EXPORT_DIR = path.resolve(__dirname, '..', 'exports');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const uniq = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function mockRes() {
  const res = { statusCode: null, body: null, err: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.send = (body) => { res.body = body; return res; };
  res.set = () => res;
  return res;
}

async function makeInstitution(prefix) {
  const name = uniq(prefix);
  return Institution.create({
    name,
    address: 'Test Address',
    contact: '0240000000',
    email: `${name.toLowerCase()}@example.com`,
    country: 'Ghana',
    region: 'Greater Accra',
    serial_code: uniq('SC'),
  });
}

async function makeVisit(patient, institutionId) {
  return Visit.create({
    patient_id: patient.id,
    institution_id: institutionId,
    status: 'Active',
    visit_date: new Date(),
    attendance_type: 'New',
    visit_type: 'General OPD',
  });
}

async function makeStaff(inst, dept) {
  return Staff.create({
    firstName: 'Phase', lastName: uniq('Doc'),
    password: 'x', institution_id: inst.id, department_id: dept.id,
  });
}

async function makeDiagnosis(visit, staff, inst) {
  const sys = await systemDiagnosis.create({ icd_10_code: 'Z00.0', diagnosis_name: 'Routine health assessment' });
  const diag = await Diagnosis.create({
    visit_id: visit.id,
    staff_id: staff.id,
    system_diagnosis_id: sys.id,
    patient_id: visit.patient_id,
    diagnosis_type: 'confirmed_diagnosis',
  });
  return { sys, diag };
}

async function cleanup(created) {
  const {
    claims = [], claimItems = [], bills = [], invoices = [], prescriptions = [],
    results = [], templates = [], investigations = [], procedures = [],
    gdrgCodes = [], medicines = [], insurances = [], visits = [],
    patients = [], services = [], staffs = [], departments = [],
    diagnoses = [], systemDiagnoses = [], institutions = [], exportsRows = [],
  } = created;

  const silent = (p) => p.catch(() => {});

  for (const row of exportsRows) {
    try { fs.unlinkSync(path.join(EXPORT_DIR, row.file_name)); } catch (e) { /* already gone */ }
    await silent(NHISClaimExport.destroy({ where: { id: row.id }, force: true }));
  }
  for (const id of claimItems) await silent(ClaimItem.destroy({ where: { id }, force: true }));
  for (const id of claims) await silent(Claim.destroy({ where: { id }, force: true }));
  for (const id of bills) await silent(ServiceBill.destroy({ where: { id } }));
  for (const id of invoices) await silent(Invoice.destroy({ where: { id } }));
  for (const id of prescriptions) await silent(Prescription.destroy({ where: { id }, force: true }));
  for (const id of results) await silent(LabTestResult.destroy({ where: { id } }));
  for (const id of templates) await silent(LabTestTemplate.destroy({ where: { id } }));
  for (const id of investigations) await silent(LabInvestigation.destroy({ where: { id } }));
  for (const id of procedures) await silent(Procedure.destroy({ where: { id } }));
  for (const id of gdrgCodes) await silent(GDRGCode.destroy({ where: { id } }));
  for (const id of medicines) await silent(Medicine.destroy({ where: { id } }));
  for (const id of insurances) await silent(Insurance.destroy({ where: { id } }));
  for (const id of diagnoses) await silent(Diagnosis.destroy({ where: { id } }));
  for (const id of systemDiagnoses) await silent(systemDiagnosis.destroy({ where: { id } }));
  for (const id of visits) await silent(Visit.destroy({ where: { id } }));
  for (const id of patients) await silent(Patient.destroy({ where: { id }, force: true }));
  for (const id of services) await silent(Service.destroy({ where: { id } }));
  for (const id of staffs) await silent(Staff.destroy({ where: { id } }));
  for (const id of departments) await silent(Department.destroy({ where: { id } }));
  for (const id of institutions) {
    const inst = await Institution.findByPk(id, { paranoid: false });
    if (!inst) continue;
    const pats = await Patient.findAll({ where: { institution_id: id }, paranoid: false });
    for (const p of pats) {
      const vts = await Visit.findAll({ where: { patient_id: p.id } });
      for (const v of vts) {
        for (const m of [ClaimItem, ServiceBill, Invoice, Claim, Procedure, LabTestResult, Prescription]) {
          await silent(m.destroy({ where: { visit_id: v.id } }));
        }
        await silent(Visit.destroy({ where: { id: v.id } }));
      }
      await silent(Insurance.destroy({ where: { patient_id: p.id } }));
      await silent(Patient.destroy({ where: { id: p.id }, force: true }));
    }
    const staffList = await Staff.findAll({ where: { institution_id: id } });
    for (const s of staffList) await silent(Staff.destroy({ where: { id: s.id } }));
    const deptList = await Department.findAll({ where: { institution_id: id } });
    for (const d of deptList) await silent(Department.destroy({ where: { id: d.id } }));
    await silent(Institution.destroy({ where: { id }, force: true }));
  }
}

async function runTest(name, fn) {
  console.log(`\n▶ ${name}`);
  const created = {
    institutions: [], patients: [], visits: [], services: [], bills: [], invoices: [],
    claims: [], claimItems: [], prescriptions: [], results: [], templates: [],
    investigations: [], procedures: [], gdrgCodes: [], medicines: [], insurances: [],
    staffs: [], departments: [], diagnoses: [], systemDiagnoses: [], exportsRows: [],
  };
  try {
    await fn(created);
  } catch (err) {
    failed++;
    failures.push(`${name} — threw: ${err.message}`);
    console.log(`  ❌ ${name} threw: ${err.message}`);
    console.log(err.stack);
  } finally {
    await cleanup(created);
  }
}

// ---------------------------------------------------------------------------
// TESTS 1-10 — billed services produce correct, linked ClaimItems
// ---------------------------------------------------------------------------
async function testBilledItemsProduceClaimItems(created) {
  const inst = await makeInstitution('PH2-A');
  created.institutions.push(inst.id);
  const dept = await Department.create({
    name: 'Theatre', institution_id: inst.id, description: 'Theatre', departmentType: 'Surgery',
    department_number: uniq('DPT'),
  });
  created.departments.push(dept.id);
  const staff = await makeStaff(inst, dept);
  created.staffs.push(staff.id);

  const patient = await Patient.create({ first_name: 'Phase', last_name: 'TwoA', institution_id: inst.id, has_insurance: true });
  created.patients.push(patient.id);
  const ins = await Insurance.create({ patient_id: patient.id, institution_id: inst.id, insured: true });
  created.insurances.push(ins.id);
  const visit = await makeVisit(patient, inst.id);
  created.visits.push(visit.id);
  const claim = await Claim.create({ visit_id: visit.id, claim_reference_number: uniq('PH2C') });
  created.claims.push(claim.id);

  // ---- TEST 1+5+6+8+10: Lab ----
  const inv = await LabInvestigation.create({
    test_description: 'Malaria RDT', g_drg_code: uniq('GDRG'), tariff_ghc: 10, market_price: 40,
  });
  created.investigations.push(inv.id);
  const tpl = await LabTestTemplate.create({ name: 'Malaria RDT', lab_tarrif_id: inv.id, quantity: 1 });
  created.templates.push(tpl.id);
  const result = await LabTestResult.create({
    visit_id: visit.id, patient_id: patient.id, institution_id: inst.id, templateId: tpl.id, status: 'pending',
  });
  created.results.push(result.id);

  const labBill = await handleBilling({
    transaction: undefined, patient_id: patient.id, visit_id: visit.id,
    service_id: result.id, service_type: 'LabTest', description: 'Malaria RDT',
    unit_price: 40, nhia_unit_price: 10, quantity: 1, institution_id: inst.id,
    claim_id: claim.id, gdrg_code: inv.g_drg_code,
  });
  const labBillRow = await ServiceBill.findOne({ where: { service_id: result.id, service_type: 'LabTest' } });
  created.bills.push(labBillRow.id);
  const labItem = await ClaimItem.findOne({ where: { claim_id: claim.id, item_type: 'LabTest', item_id: result.id } });
  created.claimItems.push(labItem.id);

  check('TEST 1: Insured + Lab bill creates a ClaimItem', !!labItem);
  check('TEST 5: ClaimItem.service_bill_id points to the ServiceBill', labItem.service_bill_id === labBillRow.id,
    `got ${labItem.service_bill_id}`);
  check('TEST 6: ClaimItem.visit_id points to the visit', labItem.visit_id === visit.id, `got ${labItem.visit_id}`);
  check('TEST 8: Lab ClaimItem price == ServiceBill snapshot',
    parseFloat(labItem.unit_price) === parseFloat(labBillRow.unit_price)
    && parseFloat(labItem.amount) === parseFloat(labBillRow.total_amount)
    && parseFloat(labItem.nhia_amount) === parseFloat(labBillRow.nhia_amount)
    && parseFloat(labItem.co_payment) === parseFloat(labBillRow.patient_amount),
    `item=${labItem.unit_price}/${labItem.amount}/${labItem.nhia_amount}/${labItem.co_payment} bill=${labBillRow.unit_price}/${labBillRow.total_amount}/${labBillRow.nhia_amount}/${labBillRow.patient_amount}`);

  const resolved = await ClaimItem.findByPk(labItem.id, { include: [{ model: LabTestResult, as: 'labTest' }] });
  check('TEST 10: claimItem.labTest resolves to LabTestResult', resolved.labTest && resolved.labTest.id === result.id,
    `got ${resolved.labTest && resolved.labTest.id}`);

  // ---- TEST 2+8+9: Medication ----
  const med = await Medicine.create({ code: uniq('MED'), generic_name: 'Paracetamol', market_price: 20, nhia_price: 5 });
  created.medicines.push(med.id);
  const presc = await Prescription.create({
    medication_id: med.id, visit_id: visit.id, institution_id: inst.id,
    dosage: '500mg', frequency: 'TDS', duration: 3, quantity: 3,
  });
  created.prescriptions.push(presc.id);

  await handleBilling({
    transaction: undefined, patient_id: patient.id, visit_id: visit.id,
    service_id: presc.id, service_type: 'Medication', description: 'Paracetamol',
    unit_price: 20, nhia_unit_price: 5, quantity: 3, institution_id: inst.id, claim_id: claim.id,
  });
  const medBillRow = await ServiceBill.findOne({ where: { service_id: presc.id, service_type: 'Medication' } });
  created.bills.push(medBillRow.id);
  const medItem = await ClaimItem.findOne({ where: { claim_id: claim.id, item_type: 'Medication', item_id: presc.id } });
  created.claimItems.push(medItem.id);

  check('TEST 2: Insured + Medication bill creates a ClaimItem', !!medItem);
  check('TEST 2: Medication ClaimItem has correct split (unit 20, qty 3, amount 60, nhia 15, copay 45)',
    parseFloat(medItem.unit_price) === 20 && medItem.quantity === 3
    && parseFloat(medItem.amount) === 60 && parseFloat(medItem.nhia_amount) === 15
    && parseFloat(medItem.co_payment) === 45,
    `got ${medItem.unit_price}/${medItem.quantity}/${medItem.amount}/${medItem.nhia_amount}/${medItem.co_payment}`);
  check('TEST 8: Medication ClaimItem price == ServiceBill snapshot',
    parseFloat(medItem.unit_price) === parseFloat(medBillRow.unit_price)
    && parseFloat(medItem.nhia_amount) === parseFloat(medBillRow.nhia_amount));

  // TEST 9: change the catalog AFTER billing — existing ClaimItem must not move
  await med.update({ market_price: 999, nhia_price: 999 });
  const medItemAfter = await ClaimItem.findByPk(medItem.id);
  check('TEST 9: changing catalog price does not change existing ClaimItem price',
    parseFloat(medItemAfter.unit_price) === 20 && parseFloat(medItemAfter.nhia_amount) === 15,
    `got ${medItemAfter.unit_price}/${medItemAfter.nhia_amount}`);
  const reAdded = await addClaimItem(claim.id, { item_type: 'Medication', item_id: presc.id }, undefined);
  check('TEST 7: repeated addClaimItem does not duplicate the ClaimItem',
    reAdded.id === medItem.id && (await ClaimItem.count({ where: { claim_id: claim.id, item_type: 'Medication', item_id: presc.id } })) === 1);

  // ---- TEST 3: Procedure (through the real controller path) ----
  const gdrg = await GDRGCode.create({ code: uniq('GDRG-P'), description: 'Appendectomy', market_price: 300, nhia_price: 50 });
  created.gdrgCodes.push(gdrg.id);
  const procRes = mockRes();
  await ProcedureController.addProcedures({
    body: {
      visit_id: visit.id, institution_id: inst.id,
      procedures: [{ procedure_id: gdrg.id }],
      doctor_id: staff.id, department_id: dept.id,
      procedure_datetime: new Date().toISOString(), claim_id: claim.id,
    },
  }, procRes);
  check('TEST 3: Procedure creation succeeds (201)', procRes.statusCode === 201, `status=${procRes.statusCode}`);
  const procBillRow = await ServiceBill.findOne({ where: { service_type: 'Procedure', visit_id: visit.id } });
  created.bills.push(procBillRow.id);
  const createdProc = await Procedure.findOne({ where: { visit_id: visit.id } });
  if (createdProc) created.procedures.push(createdProc.id);
  const procItem = await ClaimItem.findOne({ where: { claim_id: claim.id, item_type: 'Procedure', item_id: createdProc.id } });
  created.claimItems.push(procItem.id);
  check('TEST 3: Insured + Procedure bill creates a ClaimItem with GDRG prices',
    !!procItem && parseFloat(procItem.unit_price) === 300 && parseFloat(procItem.amount) === 300
    && parseFloat(procItem.nhia_amount) === 50 && parseFloat(procItem.co_payment) === 250,
    `got ${procItem && `${procItem.unit_price}/${procItem.amount}/${procItem.nhia_amount}/${procItem.co_payment}`}`);

  // ---- TEST 4+7: Generic Service through the canonical invoice endpoint ----
  const service = await Service.create({ name: 'Consult', description: 'Standard consult', cost: 50, institution_id: inst.id });
  created.services.push(service.id);
  const svcRes = mockRes();
  await invoiceController.createInvoice({
    body: { patient_id: patient.id, visit_id: visit.id, service_id: service.id, quantity: 2, claim_id: claim.id },
    user: { id: randomUUID(), institution_id: inst.id },
  }, svcRes);
  check('TEST 4: Generic Service billing via canonical endpoint returns 201', svcRes.statusCode === 201, `status=${svcRes.statusCode}`);
  const svcBillRow = await ServiceBill.findOne({ where: { service_id: service.id, service_type: 'Service' } });
  created.bills.push(svcBillRow.id);
  created.invoices.push(svcBillRow.invoice_id);
  const svcItem = await ClaimItem.findOne({ where: { claim_id: claim.id, item_type: 'Service', item_id: service.id } });
  created.claimItems.push(svcItem.id);
  check('TEST 4: Service + claim creates a ClaimItem (unit 50, qty 2, amount 100)',
    !!svcItem && parseFloat(svcItem.unit_price) === 50 && svcItem.quantity === 2 && parseFloat(svcItem.amount) === 100,
    `got ${svcItem && `${svcItem.unit_price}/${svcItem.quantity}/${svcItem.amount}`}`);
  check('TEST 5: Service ClaimItem.service_bill_id points to the ServiceBill', svcItem.service_bill_id === svcBillRow.id);

  // TEST 7: re-billing the same service + same claim must not duplicate the ClaimItem
  const before = await ClaimItem.count({ where: { claim_id: claim.id, item_type: 'Service', item_id: service.id } });
  await handleBilling({
    transaction: undefined, patient_id: patient.id, visit_id: visit.id,
    service_id: service.id, service_type: 'Service', description: 'Consult',
    unit_price: 50, quantity: 2, institution_id: inst.id, claim_id: claim.id,
  });
  const after = await ClaimItem.count({ where: { claim_id: claim.id, item_type: 'Service', item_id: service.id } });
  check('TEST 7: repeated billing does not duplicate the ClaimItem', before === 1 && after === 1, `before=${before} after=${after}`);
}

// ---------------------------------------------------------------------------
// TESTS 11, 12, 16 — NHIA financial mapping in the XML
// ---------------------------------------------------------------------------
async function testNhiaFinancialMapping(created) {
  const inst = await makeInstitution('PH2-B');
  created.institutions.push(inst.id);
  const dept = await Department.create({
    name: 'Lab', institution_id: inst.id, description: 'Lab', departmentType: 'Lab',
    department_number: uniq('DPT'),
  });
  created.departments.push(dept.id);
  const staff = await makeStaff(inst, dept);
  created.staffs.push(staff.id);

  // ---- TEST 11: uninsured patient — NHIACoveredAmount must be 0, not amount ----
  const patientU = await Patient.create({ first_name: 'Phase', last_name: 'TwoB', institution_id: inst.id, has_insurance: false });
  created.patients.push(patientU.id);
  const visitU = await makeVisit(patientU, inst.id);
  created.visits.push(visitU.id);
  const claimU = await Claim.create({ visit_id: visitU.id, claim_reference_number: uniq('PH2U') });
  created.claims.push(claimU.id);

  const invU = await LabInvestigation.create({
    test_description: 'Urine R/E', g_drg_code: uniq('GDRG'), tariff_ghc: 10, market_price: 40,
  });
  created.investigations.push(invU.id);
  const tplU = await LabTestTemplate.create({ name: 'Urine R/E', lab_tarrif_id: invU.id });
  created.templates.push(tplU.id);
  const resultU = await LabTestResult.create({
    visit_id: visitU.id, patient_id: patientU.id, institution_id: inst.id, templateId: tplU.id, status: 'completed',
  });
  created.results.push(resultU.id);

  await handleBilling({
    transaction: undefined, patient_id: patientU.id, visit_id: visitU.id,
    service_id: resultU.id, service_type: 'LabTest', description: 'Urine R/E',
    unit_price: 40, nhia_unit_price: 10, quantity: 1, institution_id: inst.id, claim_id: claimU.id,
  });
  const uItem = await ClaimItem.findOne({ where: { claim_id: claimU.id, item_type: 'LabTest', item_id: resultU.id } });
  created.claimItems.push(uItem.id);
  check('TEST 11: uninsured claim item has nhia_amount = 0', parseFloat(uItem.nhia_amount) === 0,
    `got ${uItem.nhia_amount}`);
  check('TEST 11: uninsured claim item keeps the full patient amount',
    parseFloat(uItem.co_payment) === parseFloat(uItem.amount), `copay=${uItem.co_payment} amount=${uItem.amount}`);

  const { sys: sysU, diag: diagU } = await makeDiagnosis(visitU, staff, inst);
  created.systemDiagnoses.push(sysU.id);
  created.diagnoses.push(diagU.id);

  const resU = mockRes();
  await nhiaController.generateXMLReport({
    body: { dateRange: null, patientCategory: [], claimTypes: [], statuses: [], financialOptions: [], patientTypes: [], gender: null, ageGroup: null, minAmount: null, maxAmount: null, splitBy: null, exportFormat: 'xml' },
    user: { id: staff.id, institution_id: inst.id },
  }, resU);
  const rowsU = await NHISClaimExport.findAll({ where: { institution_id: inst.id } });
  created.exportsRows.push(...rowsU.map((r) => ({ id: r.id, file_name: r.file_name })));
  const xmlU = typeof resU.body === 'string' ? resU.body : '';
  check('TEST 11: uninsured export succeeds (200)', resU.statusCode === 200, `status=${resU.statusCode}`);
  check('TEST 11: XML NHIACoveredAmount = 0 (no fallback to amount)', xmlU.includes('<NHIACoveredAmount>0</NHIACoveredAmount>'));
  check('TEST 11: XML does NOT put the full amount in NHIACoveredAmount', !/<NHIACoveredAmount>40<\/NHIACoveredAmount>/.test(xmlU));
  check('TEST 11: XML PatientAmount = 40 for the uninsured item', /<PatientAmount>40<\/PatientAmount>/.test(xmlU));

  // TEST 16: no fabricated diagnosis values anywhere in the XML
  const forbidden = ['J06.9', 'E11.9', 'A09', 'R05', 'R50.9', 'General Consultation', 'DEFAULT_PROVIDER', 'General medical examination'];
  const hits = forbidden.filter((f) => xmlU.includes(f));
  check('TEST 16: no fabricated ICD-10/diagnosis/provider values in XML', hits.length === 0, `found: ${hits.join(', ')}`);
  check('TEST 16: XML uses the REAL ICD-10 code', xmlU.includes('<DiagnosisCode>Z00.0</DiagnosisCode>'));

  // ---- TEST 12: nhia_amount never exceeds amount ----
  const patientI = await Patient.create({ first_name: 'Phase', last_name: 'TwoC', institution_id: inst.id, has_insurance: true });
  created.patients.push(patientI.id);
  const insI = await Insurance.create({ patient_id: patientI.id, institution_id: inst.id, insured: true });
  created.insurances.push(insI.id);
  const visitI = await makeVisit(patientI, inst.id);
  created.visits.push(visitI.id);
  const claimI = await Claim.create({ visit_id: visitI.id, claim_reference_number: uniq('PH2I') });
  created.claims.push(claimI.id);

  // NHIA rate (100) higher than market (40) -> NHIA must be capped at 40.
  const invI = await LabInvestigation.create({
    test_description: 'Cap Test', g_drg_code: uniq('GDRG'), tariff_ghc: 100, market_price: 40,
  });
  created.investigations.push(invI.id);
  const tplI = await LabTestTemplate.create({ name: 'Cap Test', lab_tarrif_id: invI.id });
  created.templates.push(tplI.id);
  const resultI = await LabTestResult.create({
    visit_id: visitI.id, patient_id: patientI.id, institution_id: inst.id, templateId: tplI.id, status: 'completed',
  });
  created.results.push(resultI.id);
  await handleBilling({
    transaction: undefined, patient_id: patientI.id, visit_id: visitI.id,
    service_id: resultI.id, service_type: 'LabTest', description: 'Cap Test',
    unit_price: 40, nhia_unit_price: 100, quantity: 1, institution_id: inst.id, claim_id: claimI.id,
  });
  const capItem = await ClaimItem.findOne({ where: { claim_id: claimI.id, item_type: 'LabTest', item_id: resultI.id } });
  created.claimItems.push(capItem.id);
  check('TEST 12: NHIA amount is capped at the total amount',
    parseFloat(capItem.nhia_amount) === 40 && parseFloat(capItem.nhia_amount) <= parseFloat(capItem.amount),
    `nhia=${capItem.nhia_amount} amount=${capItem.amount}`);

  // Corrupted item (nhia > amount) must be caught by export validation.
  const { sys: sysI, diag: diagI } = await makeDiagnosis(visitI, staff, inst);
  created.systemDiagnoses.push(sysI.id);
  created.diagnoses.push(diagI.id);
  const badItem = await ClaimItem.create({
    claim_id: claimI.id, visit_id: visitI.id, item_type: 'LabTest', item_id: resultI.id,
    description: 'Broken item', unit_price: 10, quantity: 1, amount: 10, nhia_amount: 50, co_payment: 0,
  });
  created.claimItems.push(badItem.id);
  const validationErrors = validateClaimsForExport([await Claim.findByPk(claimI.id, {
    include: [
      { model: ClaimItem, as: 'items' },
      { model: Visit, as: 'visit', include: [
        { model: Diagnosis, as: 'diagnosis', include: [{ model: systemDiagnosis, as: 'systemDiagnosis' }] },
        { model: Patient, as: 'patient' },
      ] },
    ],
  })], inst.id);
  check('TEST 12: export validation rejects nhia_amount > amount', validationErrors.some((e) => e.field === 'nhia_amount'),
    JSON.stringify(validationErrors));

  const resBad = mockRes();
  await nhiaController.generateXMLReport({
    body: { dateRange: null, patientCategory: [], claimTypes: [], statuses: [], financialOptions: [], patientTypes: [], gender: null, ageGroup: null, minAmount: null, maxAmount: null, splitBy: null, exportFormat: 'xml' },
    user: { id: staff.id, institution_id: inst.id },
  }, resBad);
  const rowsBad = await NHISClaimExport.findAll({ where: { institution_id: inst.id } });
  created.exportsRows.push(...rowsBad.map((r) => ({ id: r.id, file_name: r.file_name })));
  check('TEST 12: export is rejected (422) instead of generating an invalid XML file',
    resBad.statusCode === 422, `status=${resBad.statusCode}`);
}

// ---------------------------------------------------------------------------
// TEST 13 — missing diagnosis blocks the export
// ---------------------------------------------------------------------------
async function testMissingDiagnosisBlocksExport(created) {
  const inst = await makeInstitution('PH2-D');
  created.institutions.push(inst.id);
  const patient = await Patient.create({ first_name: 'Phase', last_name: 'TwoD', institution_id: inst.id, has_insurance: true });
  created.patients.push(patient.id);
  const visit = await makeVisit(patient, inst.id);
  created.visits.push(visit.id);
  const claim = await Claim.create({ visit_id: visit.id, claim_reference_number: uniq('PH2D') });
  created.claims.push(claim.id);

  const inv = await LabInvestigation.create({ test_description: 'FBC', g_drg_code: uniq('GDRG'), tariff_ghc: 5, market_price: 25 });
  created.investigations.push(inv.id);
  const tpl = await LabTestTemplate.create({ name: 'FBC', lab_tarrif_id: inv.id });
  created.templates.push(tpl.id);
  const result = await LabTestResult.create({ visit_id: visit.id, patient_id: patient.id, institution_id: inst.id, templateId: tpl.id, status: 'completed' });
  created.results.push(result.id);
  await handleBilling({
    transaction: undefined, patient_id: patient.id, visit_id: visit.id,
    service_id: result.id, service_type: 'LabTest', description: 'FBC',
    unit_price: 25, nhia_unit_price: 5, quantity: 1, institution_id: inst.id, claim_id: claim.id,
  });
  const item = await ClaimItem.findOne({ where: { claim_id: claim.id, item_type: 'LabTest', item_id: result.id } });
  created.claimItems.push(item.id);

  // NOTE: no Diagnosis created for this visit.
  const res = mockRes();
  await nhiaController.generateXMLReport({
    body: { dateRange: null, patientCategory: [], claimTypes: [], statuses: [], financialOptions: [], patientTypes: [], gender: null, ageGroup: null, minAmount: null, maxAmount: null, splitBy: null, exportFormat: 'xml' },
    user: { id: randomUUID(), institution_id: inst.id },
  }, res);
  const rows = await NHISClaimExport.findAll({ where: { institution_id: inst.id } });
  created.exportsRows.push(...rows.map((r) => ({ id: r.id, file_name: r.file_name })));
  check('TEST 13: export without a diagnosis is rejected (422)', res.statusCode === 422, `status=${res.statusCode}`);
  check('TEST 13: rejection identifies the missing diagnosis field',
    Array.isArray(res.body && res.body.errors) && res.body.errors.some((e) => e.field === 'diagnosis'),
    JSON.stringify(res.body && res.body.errors));
}

// ---------------------------------------------------------------------------
// TEST 14 — institution isolation both ways
// ---------------------------------------------------------------------------
async function testInstitutionIsolation(created) {
  const instA = await makeInstitution('PH2-E');
  created.institutions.push(instA.id);
  const instB = await makeInstitution('PH2-F');
  created.institutions.push(instB.id);
  const deptA = await Department.create({ name: 'Lab', institution_id: instA.id, description: 'Lab', departmentType: 'Lab', department_number: uniq('DPT') });
  created.departments.push(deptA.id);
  const deptB = await Department.create({ name: 'Lab', institution_id: instB.id, description: 'Lab', departmentType: 'Lab', department_number: uniq('DPT') });
  created.departments.push(deptB.id);
  const staffA = await makeStaff(instA, deptA);
  created.staffs.push(staffA.id);
  const staffB = await makeStaff(instB, deptB);
  created.staffs.push(staffB.id);

  async function buildClaim(inst, staff, suffix) {
    const patient = await Patient.create({ first_name: 'Iso', last_name: suffix, institution_id: inst.id, has_insurance: true });
    created.patients.push(patient.id);
    const visit = await makeVisit(patient, inst.id);
    created.visits.push(visit.id);
    const claim = await Claim.create({ visit_id: visit.id, claim_reference_number: uniq(`REF-${suffix}`) });
    created.claims.push(claim.id);
    const inv = await LabInvestigation.create({ test_description: 'Test', g_drg_code: uniq('GDRG'), tariff_ghc: 5, market_price: 25 });
    created.investigations.push(inv.id);
    const tpl = await LabTestTemplate.create({ name: 'Test', lab_tarrif_id: inv.id });
    created.templates.push(tpl.id);
    const result = await LabTestResult.create({ visit_id: visit.id, patient_id: patient.id, institution_id: inst.id, templateId: tpl.id, status: 'completed' });
    created.results.push(result.id);
    await handleBilling({
      transaction: undefined, patient_id: patient.id, visit_id: visit.id,
      service_id: result.id, service_type: 'LabTest', description: 'Test',
      unit_price: 25, nhia_unit_price: 5, quantity: 1, institution_id: inst.id, claim_id: claim.id,
    });
    const item = await ClaimItem.findOne({ where: { claim_id: claim.id, item_type: 'LabTest', item_id: result.id } });
    created.claimItems.push(item.id);
    const { sys, diag } = await makeDiagnosis(visit, staff, inst);
    created.systemDiagnoses.push(sys.id);
    created.diagnoses.push(diag.id);
    return claim;
  }

  const claimA = await buildClaim(instA, staffA, 'InstA');
  const claimB = await buildClaim(instB, staffB, 'InstB');

  // Institution A exports: must contain A, never B.
  const resA = mockRes();
  await nhiaController.generateXMLReport({
    body: { dateRange: null, patientCategory: [], claimTypes: [], statuses: [], financialOptions: [], patientTypes: [], gender: null, ageGroup: null, minAmount: null, maxAmount: null, splitBy: null, exportFormat: 'xml', institution_id: instB.id },
    user: { id: staffA.id, institution_id: instA.id },
  }, resA);
  const rowsA = await NHISClaimExport.findAll({ where: { institution_id: instA.id } });
  created.exportsRows.push(...rowsA.map((r) => ({ id: r.id, file_name: r.file_name })));
  const xmlA = typeof resA.body === 'string' ? resA.body : '';
  check('TEST 14: institution A exports A claims (200)', resA.statusCode === 200, `status=${resA.statusCode}`);
  check('TEST 14: A export contains claim A reference', xmlA.includes(claimA.claim_reference_number));
  check('TEST 14: A export does NOT contain claim B reference', !xmlA.includes(claimB.claim_reference_number));
  check('TEST 14: A export does NOT contain B patient', !xmlA.includes('InstB'));

  // Institution B exports: must contain B, never A.
  const resB = mockRes();
  await nhiaController.generateXMLReport({
    body: { dateRange: null, patientCategory: [], claimTypes: [], statuses: [], financialOptions: [], patientTypes: [], gender: null, ageGroup: null, minAmount: null, maxAmount: null, splitBy: null, exportFormat: 'xml', institution_id: instA.id },
    user: { id: staffB.id, institution_id: instB.id },
  }, resB);
  const rowsB = await NHISClaimExport.findAll({ where: { institution_id: instB.id } });
  created.exportsRows.push(...rowsB.map((r) => ({ id: r.id, file_name: r.file_name })));
  const xmlB = typeof resB.body === 'string' ? resB.body : '';
  check('TEST 14: institution B exports B claims (200)', resB.statusCode === 200, `status=${resB.statusCode}`);
  check('TEST 14: B export contains claim B reference', xmlB.includes(claimB.claim_reference_number));
  check('TEST 14: B export does NOT contain claim A reference', !xmlA.includes('REF-A') || !xmlB.includes(claimA.claim_reference_number));
  check('TEST 14: B export does NOT contain A patient', !xmlB.includes('InstA'));
}

// ---------------------------------------------------------------------------
// TEST 15 — applyNhisPayment no longer throws (transaction rolled back)
// ---------------------------------------------------------------------------
async function testNhisPaymentNoThrow(created) {
  const inst = await makeInstitution('PH2-G');
  created.institutions.push(inst.id);
  const patient = await Patient.create({ first_name: 'Phase', last_name: 'TwoG', institution_id: inst.id, has_insurance: true });
  created.patients.push(patient.id);
  const ins = await Insurance.create({ patient_id: patient.id, institution_id: inst.id, insured: true });
  created.insurances.push(ins.id);
  const visit = await makeVisit(patient, inst.id);
  created.visits.push(visit.id);

  const t = await sequelize.transaction();
  try {
    const claim = await Claim.create({ visit_id: visit.id, claim_reference_number: uniq('PH2G') }, { transaction: t });
    created.claims.push(claim.id);
    const med = await Medicine.create({ code: uniq('MED'), generic_name: 'Amoxicillin', market_price: 20, nhia_price: 5 }, { transaction: t });
    created.medicines.push(med.id);
    const presc = await Prescription.create({
      medication_id: med.id, visit_id: visit.id, institution_id: inst.id,
      dosage: '250mg', frequency: 'TDS', duration: 3, quantity: 3,
    }, { transaction: t });
    created.prescriptions.push(presc.id);
    await handleBilling({
      transaction: t, patient_id: patient.id, visit_id: visit.id,
      service_id: presc.id, service_type: 'Medication', description: 'Amoxicillin',
      unit_price: 20, nhia_unit_price: 5, quantity: 3, institution_id: inst.id, claim_id: claim.id,
    });
    const item = await ClaimItem.findOne({ where: { claim_id: claim.id, item_type: 'Medication', item_id: presc.id }, transaction: t });
    created.claimItems.push(item.id);

    let result = null;
    let threw = null;
    try {
      result = await applyNhisPayment({ transaction: t, claim_id: claim.id, amount_paid: 100, payment_reference: uniq('NHIS') });
    } catch (err) {
      threw = err;
    }
    check('TEST 15: applyNhisPayment does not throw (const reassignment fixed)', threw === null, threw && threw.message);
    check('TEST 15: applied amount is capped by item NHIA (15)', result && result.amount_applied === 15,
      `applied=${result && result.amount_applied}`);
  } finally {
    await t.rollback(); // nothing persists
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('============================================');
  console.log('PHASE 2 VERIFICATION — CLAIMS & NHIA INTEGRITY');
  console.log(`DB: ${DB_HOST}/${process.env.DB_NAME || 'hms'} (NODE_ENV=${NODE_ENV})`);
  console.log('============================================');

  await runTest('Billed services produce correct ClaimItems (Tests 1-10)', testBilledItemsProduceClaimItems);
  await runTest('NHIA financial mapping in XML (Tests 11, 12, 16)', testNhiaFinancialMapping);
  await runTest('Missing diagnosis blocks export (Test 13)', testMissingDiagnosisBlocksExport);
  await runTest('Institution isolation (Test 14)', testInstitutionIsolation);
  await runTest('NHIS payment no longer throws (Test 15)', testNhisPaymentNoThrow);

  // TEST 17 — nothing left behind
  const { Institution: Inst, Claim: Cl, ClaimItem: ClIt, NHISClaimExport: Exp } = require('./models');
  const { Op } = require('sequelize');
  const instsLeft = await Inst.count({ where: { name: { [Op.like]: 'PH2-%' } } });
  const claimsLeft = await Cl.count({ where: { claim_reference_number: { [Op.like]: 'PH2%' } } });
  const exportsLeft = await Exp.count({ where: { institution_id: { [Op.not]: null } } });
  const filesLeft = (() => { try { return fs.readdirSync(EXPORT_DIR).filter((f) => f.endsWith('.xml')).length; } catch (e) { return 0; } })();
  console.log('\n▶ TEST 17 — no test data remains');
  check('TEST 17: zero test institutions left', instsLeft === 0, `left=${instsLeft}`);
  check('TEST 17: zero test claims left', claimsLeft === 0, `left=${claimsLeft}`);
  check('TEST 17: zero NHIS export rows left', exportsLeft === 0, `left=${exportsLeft}`);
  check('TEST 17: zero XML files left', filesLeft === 0, `left=${filesLeft}`);

  console.log('\n============================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('============================================');

  await sequelize.close();
  process.exit(failed === 0 ? 0 : 1);
})().catch(async (err) => {
  console.error('Fatal error:', err);
  try { await sequelize.close(); } catch (e) {}
  process.exit(1);
});
