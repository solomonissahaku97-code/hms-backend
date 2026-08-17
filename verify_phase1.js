#!/usr/bin/env node
/**
 * PHASE 1 — PRODUCTION BILLING AUDIT FIX VERIFICATION (J2 / J4 / J8 / J9)
 *
 * SAFETY:
 *  - Refuses to run when NODE_ENV=production or when DB_HOST is not localhost.
 *  - Creates its own fixtures (institution/patient/visit/service/lab/claim…)
 *    and DELETES every row it creates afterwards (reverse dependency order),
 *    including generated XML export files.
 *  - Does NOT touch production data. Never run against a remote database.
 *
 * Run:  cd hms-backend && node verify_phase1.js
 */

require('dotenv').config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';
if (NODE_ENV === 'production' || !['localhost', '127.0.0.1'].includes(DB_HOST)) {
  console.error('❌ Refusing to run: verify_phase1.js only runs against the local development database.');
  console.error(`   (NODE_ENV=${NODE_ENV}, DB_HOST=${DB_HOST})`);
  process.exit(1);
}

const path = require('path');
const fs = require('fs');

const { sequelize } = require('./models');
const {
  Institution, Patient, Visit, Service, ServiceBill, Invoice,
  Claim, ClaimItem, Department, Staff,
} = require('./models');

const LabInvestigation = require('./models/claims/LabInvestigations');
const LabTestTemplate = require('./models/lab/LabTestTemplate');
const LabTestResult = require('./models/lab/LabTestResult');
const GDRGCode = require('./models/claims/GDRGCode');
const Procedure = require('./models/procedure/procedure');
const Medicine = require('./models/claims/medication');
const Prescription = require('./models/prescription');
const Insurance = require('./models/insuranceTable');
const NHISClaimExport = require('./models/claims/nhisClaimExport');
const systemDiagnosis = require('./models/claims/systemDiagnosis');
const Diagnosis = require('./models/diagnosis');

const { handleBilling } = require('./utils/billingUtil');
const invoiceController = require('./controllers/accounts/invoice.controller');
const labController = require('./controllers/lab/labController');
const nhiaController = require('./controllers/claims/nhiaClaimGenerationController');
const ProcedureController = require('./controllers/procedure/ProcedureController');

const EXPORT_DIR = path.resolve(__dirname, '..', 'exports'); // hms/exports (same dir the controller writes to)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

const { randomUUID } = require('crypto');

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

async function makeDiagnosis(visit, inst, created) {
  // Real diagnosis chain: system_diagnosis (with ICD-10) -> visit diagnosis.
  const dept = await Department.create({
    name: 'OPD', institution_id: inst.id, description: 'OPD',
    departmentType: 'Consultation', department_number: uniq('DPT'),
  });
  created.departments.push(dept.id);
  const staff = await Staff.create({
    firstName: 'Phase', lastName: uniq('Doc'),
    password: 'x', institution_id: inst.id, department_id: dept.id,
  });
  created.staffs.push(staff.id);
  const sys = await systemDiagnosis.create({ icd_10_code: 'Z00.0', diagnosis_name: 'Routine health assessment' });
  created.systemDiagnoses.push(sys.id);
  const diag = await Diagnosis.create({
    visit_id: visit.id,
    staff_id: staff.id,
    system_diagnosis_id: sys.id,
    patient_id: visit.patient_id,
    diagnosis_type: 'confirmed_diagnosis',
  });
  created.diagnoses.push(diag.id);
  return diag;
}

/**
 * Delete every fixture created during a test group. Paranoid models are
 * force-destroyed. Deletion is dependency-safe: catalog entities first, then
 * an institution-centric sweep that removes every dependent row by visit_id
 * before the visit/patient/institution itself.
 */
async function cleanup(created) {
  const { claims = [], claimItems = [], bills = [], invoices = [], prescriptions = [],
          results = [], templates = [], investigations = [], procedures = [],
          gdrgCodes = [], medicines = [], insurances = [], visits = [],
          patients = [], services = [], staffs = [], departments = [],
          diagnoses = [], systemDiagnoses = [],
          institutions = [], exportsRows = [] } = created;

  const silent = (p) => p.catch(() => {});

  // 1) Export rows + generated XML files
  for (const row of exportsRows) {
    try { fs.unlinkSync(path.join(EXPORT_DIR, row.file_name)); } catch (e) { /* already gone */ }
    await silent(NHISClaimExport.destroy({ where: { id: row.id }, force: true }));
  }

  // 2) Standalone catalog / claim entities by id
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
  for (const id of visits) await silent(Visit.destroy({ where: { id } }));
  for (const id of patients) await silent(Patient.destroy({ where: { id }, force: true }));
  for (const id of services) await silent(Service.destroy({ where: { id } }));
  for (const id of staffs) await silent(Staff.destroy({ where: { id } }));
  for (const id of departments) await silent(Department.destroy({ where: { id } }));

  // 3) Institution-centric sweep (belt & braces) — deletes every dependent by
  //    visit_id so FK chains cannot block institution removal.
  for (const id of institutions) {
    const inst = await Institution.findByPk(id, { paranoid: false });
    if (!inst) continue;
    const pats = await Patient.findAll({ where: { institution_id: id }, paranoid: false });
    for (const p of pats) {
      const vts = await Visit.findAll({ where: { patient_id: p.id } });
      for (const v of vts) {
        for (const m of [ClaimItem, ServiceBill, Invoice, Claim, Procedure, LabTestResult, Prescription, Diagnosis]) {
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

  // 4) Diagnosis chain last (after every visit/patient referencing it is gone).
  for (const id of diagnoses) await silent(Diagnosis.destroy({ where: { id }, force: true }));
  for (const id of systemDiagnoses) await silent(systemDiagnosis.destroy({ where: { id }, force: true }));
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
// TEST 1-3 (J2) — Generic Service billing through the canonical endpoint
// ---------------------------------------------------------------------------
async function testGenericServiceBilling(created) {
  const inst = await makeInstitution('PH1-A');
  created.institutions.push(inst.id);
  const patient = await Patient.create({ first_name: 'Phase', last_name: 'OneA', institution_id: inst.id });
  created.patients.push(patient.id);
  const service = await Service.create({ name: 'General Consultation', description: 'Standard consult', cost: 50, institution_id: inst.id });
  created.services.push(service.id);

  const res = mockRes();
  await invoiceController.createInvoice({
    body: {
      patient_id: patient.id,
      service_id: service.id,
      quantity: 2,
      // Client-supplied prices MUST be ignored:
      unit_price: 1, total_amount: 1, nhia_amount: 1, patient_amount: 1,
      payment_status: 'Paid', has_paid: true,
    },
    user: { id: randomUUID(), institution_id: inst.id }, // staff context (no req.admin)
  }, res);

  check('TEST 1: Generic Service billing returns 201', res.statusCode === 201, `got ${res.statusCode}`);
  check('TEST 1: Generic Service billing creates exactly one ServiceBill',
    (await ServiceBill.count({ where: { patient_id: patient.id } })) === 1);
  check('TEST 2: Generic Service billing creates exactly one Invoice',
    (await Invoice.count({ where: { patient_id: patient.id } })) === 1);

  const bill = await ServiceBill.findOne({ where: { patient_id: patient.id } });
  created.bills.push(bill.id);
  created.invoices.push(bill.invoice_id);

  check('TEST 3: service_type is "Service" and service_id is the catalog id',
    bill.service_type === 'Service' && bill.service_id === service.id);
  check('TEST 3: unit price comes from Service.cost (50), not client price (1)',
    parseFloat(bill.unit_price) === 50, `unit_price=${bill.unit_price}`);
  check('TEST 3: total = cost * quantity (50 * 2 = 100)',
    parseFloat(bill.total_amount) === 100, `total=${bill.total_amount}`);
  check('TEST 3: patient_amount is server-derived (100), not client-supplied (1)',
    parseFloat(bill.patient_amount) === 100, `patient_amount=${bill.patient_amount}`);
  check('TEST 3: payment_status/has_paid not trusted from client',
    bill.payment_status === 'Pending' && bill.has_paid === false,
    `status=${bill.payment_status} has_paid=${bill.has_paid}`);
}

// ---------------------------------------------------------------------------
// TEST 7 (J8) — validation failure must not commit anything
// ---------------------------------------------------------------------------
async function testInvoiceValidationRollback(created) {
  const inst = await makeInstitution('PH1-B');
  created.institutions.push(inst.id);
  const patient = await Patient.create({ first_name: 'Phase', last_name: 'OneB', institution_id: inst.id });
  created.patients.push(patient.id);
  const other = await Patient.create({ first_name: 'Other', last_name: 'Patient', institution_id: inst.id });
  created.patients.push(other.id);
  const visitOther = await makeVisit(other, inst.id);
  created.visits.push(visitOther.id);
  const service = await Service.create({ name: 'Consult', cost: 20, institution_id: inst.id });
  created.services.push(service.id);

  const res = mockRes();
  await invoiceController.createInvoice({
    body: { patient_id: patient.id, visit_id: visitOther.id, service_id: service.id },
    user: { id: randomUUID(), institution_id: inst.id }, // staff context
  }, res);

  check('TEST 7: visit mismatch returns 403', res.statusCode === 403, `got ${res.statusCode}`);
  check('TEST 7: no ServiceBill committed for the supplied visit',
    (await ServiceBill.count({ where: { visit_id: visitOther.id } })) === 0);
  check('TEST 7: no Invoice committed for the supplied visit',
    (await Invoice.count({ where: { visit_id: visitOther.id } })) === 0);
}

// ---------------------------------------------------------------------------
// TEST 8 (J8) — error mid-array rolls back the whole transaction
// ---------------------------------------------------------------------------
async function testMultiItemRollback(created) {
  const instA = await makeInstitution('PH1-C');
  created.institutions.push(instA.id);
  const instB = await makeInstitution('PH1-D');
  created.institutions.push(instB.id);
  const patient = await Patient.create({ first_name: 'Phase', last_name: 'OneC', institution_id: instA.id });
  created.patients.push(patient.id);
  const serviceA = await Service.create({ name: 'Service A', cost: 10, institution_id: instA.id });
  created.services.push(serviceA.id);
  const serviceB = await Service.create({ name: 'Service B (other institution)', cost: 99, institution_id: instB.id });
  created.services.push(serviceB.id);

  const res = mockRes();
  await invoiceController.createInvoice({
    body: {
      patient_id: patient.id,
      services: [{ service_id: serviceA.id }, { service_id: serviceB.id }],
    },
    user: { id: randomUUID(), institution_id: instA.id }, // staff context
  }, res);

  check('TEST 8: cross-institution item returns 403', res.statusCode === 403, `got ${res.statusCode}`);
  check('TEST 8: no ServiceBill persisted for patient (rollback worked)',
    (await ServiceBill.count({ where: { patient_id: patient.id } })) === 0);
  check('TEST 8: no Invoice persisted for patient (rollback worked)',
    (await Invoice.count({ where: { patient_id: patient.id } })) === 0);
  check('TEST 8: auto-created visit rolled back too',
    (await Visit.count({ where: { patient_id: patient.id } })) === 0);
}

// ---------------------------------------------------------------------------
// TEST 4-6 (J4) — Lab duplicate billing / idempotent claim linking
// ---------------------------------------------------------------------------
async function testLabIdempotentBilling(created) {
  const inst = await makeInstitution('PH1-E');
  created.institutions.push(inst.id);
  const patient = await Patient.create({ first_name: 'Phase', last_name: 'OneE', institution_id: inst.id });
  created.patients.push(patient.id);
  const visit = await makeVisit(patient, inst.id);
  created.visits.push(visit.id);

  const inv = await LabInvestigation.create({
    test_description: 'Malaria RDT',
    g_drg_code: uniq('GDRG'),
    tariff_ghc: 10,
    market_price: 40,
  });
  created.investigations.push(inv.id);
  const tpl = await LabTestTemplate.create({ name: 'Malaria RDT', lab_tarrif_id: inv.id, quantity: 1 });
  created.templates.push(tpl.id);
  const result = await LabTestResult.create({
    visit_id: visit.id, patient_id: patient.id, institution_id: inst.id,
    templateId: tpl.id, status: 'pending',
  });
  created.results.push(result.id);

  // Simulate result creation billing (same params createSingleLabResult uses)
  await handleBilling({
    transaction: undefined,
    patient_id: patient.id,
    visit_id: visit.id,
    service_id: result.id,
    service_type: 'LabTest',
    description: 'Malaria RDT',
    unit_price: 40,
    nhia_unit_price: 10,
    quantity: 1,
    institution_id: inst.id,
    claim_id: null,
    gdrg_code: inv.g_drg_code,
  });

  const billCountAfterCreate = await ServiceBill.count({ where: { service_id: result.id, service_type: 'LabTest' } });
  check('TEST 4: Lab result creation creates exactly one Lab ServiceBill', billCountAfterCreate === 1, `count=${billCountAfterCreate}`);

  const claim = await Claim.create({ visit_id: visit.id, claim_reference_number: uniq('PH1CLAIM') });
  created.claims.push(claim.id);

  // First completion with claim_id → should REUSE the bill and link a ClaimItem
  const res1 = mockRes();
  await labController.updateResult({
    params: { id: result.id },
    body: { values: { WBC: 5 }, claim_id: claim.id, lab_investigation_id: inv.id },
    app: { get: () => undefined },
  }, res1, (err) => { res1.err = err; });

  check('TEST 5: updateResult with claim_id succeeds (200)', res1.statusCode === 200, `status=${res1.statusCode} err=${res1.err?.message || ''}`);
  check('TEST 5: updating the same Lab result does NOT create a second ServiceBill',
    (await ServiceBill.count({ where: { service_id: result.id, service_type: 'LabTest' } })) === 1);

  const bill = await ServiceBill.findOne({ where: { service_id: result.id, service_type: 'LabTest' } });
  const claimItem = await ClaimItem.findOne({ where: { claim_id: claim.id, item_type: 'LabTest', item_id: result.id } });
  created.claimItems.push(claimItem.id);
  check('TEST 6: ClaimItem created and linked to the existing ServiceBill',
    !!claimItem && claimItem.service_bill_id === bill.id,
    `service_bill_id=${claimItem?.service_bill_id} expected=${bill.id}`);

  // Second completion with same claim_id → fully idempotent
  const res2 = mockRes();
  await labController.updateResult({
    params: { id: result.id },
    body: { values: { WBC: 6 }, claim_id: claim.id, lab_investigation_id: inv.id },
    app: { get: () => undefined },
  }, res2, (err) => { res2.err = err; });

  check('TEST 5: repeated completion still returns 200', res2.statusCode === 200, `status=${res2.statusCode}`);
  check('TEST 5: repeated completion still has exactly one ServiceBill',
    (await ServiceBill.count({ where: { service_id: result.id, service_type: 'LabTest' } })) === 1);
  check('TEST 6: repeated completion does not duplicate the ClaimItem',
    (await ClaimItem.count({ where: { claim_id: claim.id, item_type: 'LabTest', item_id: result.id } })) === 1);
}

// ---------------------------------------------------------------------------
// TEST 9 (J9) — NHIA XML export institution isolation
// ---------------------------------------------------------------------------
async function testNhisInstitutionIsolation(created) {
  const instA = await makeInstitution('PH1-F');
  created.institutions.push(instA.id);
  const instB = await makeInstitution('PH1-G');
  created.institutions.push(instB.id);

  const patientA = await Patient.create({ first_name: 'Alice', last_name: 'InstA', institution_id: instA.id });
  created.patients.push(patientA.id);
  const patientB = await Patient.create({ first_name: 'Bob', last_name: 'InstB', institution_id: instB.id });
  created.patients.push(patientB.id);

  const visitA = await makeVisit(patientA, instA.id);
  created.visits.push(visitA.id);
  const visitB = await makeVisit(patientB, instB.id);
  created.visits.push(visitB.id);

  // Phase 2 (J1) requires real diagnoses before a claim can be exported.
  await makeDiagnosis(visitA, instA, created);
  await makeDiagnosis(visitB, instB, created);

  const refA = uniq('REF-A');
  const refB = uniq('REF-B');
  const claimA = await Claim.create({ visit_id: visitA.id, claim_reference_number: refA });
  created.claims.push(claimA.id);
  const claimB = await Claim.create({ visit_id: visitB.id, claim_reference_number: refB });
  created.claims.push(claimB.id);

  // Each claim needs a billable item (Phase 2 validation rejects itemless claims).
  for (const [inst, claim, patient, visit] of [[instA, claimA, patientA, visitA], [instB, claimB, patientB, visitB]]) {
    const svc = await Service.create({ name: `Svc ${inst.name}`, cost: 25, institution_id: inst.id });
    created.services.push(svc.id);
    await handleBilling({
      transaction: undefined,
      patient_id: patient.id,
      visit_id: visit.id,
      service_id: svc.id,
      service_type: 'Service',
      description: 'Consult',
      unit_price: 25,
      nhia_unit_price: 0,
      quantity: 1,
      institution_id: inst.id,
      claim_id: claim.id,
    });
    const item = await ClaimItem.findOne({ where: { claim_id: claim.id, item_type: 'Service', item_id: svc.id } });
    created.claimItems.push(item.id);
    created.bills.push((await ServiceBill.findOne({ where: { service_id: svc.id, service_type: 'Service' } })).id);
  }

  // Authenticated user belongs to institution A; body asks for institution B.
  const res = mockRes();
  await nhiaController.generateXMLReport({
    body: {
      institution_id: instB.id,           // must be IGNORED
      dateRange: null, patientCategory: [], claimTypes: [], statuses: [],
      financialOptions: [], patientTypes: [], gender: null, ageGroup: null,
      minAmount: null, maxAmount: null, splitBy: null, exportFormat: 'xml',
    },
    user: { id: 'u-staff', institution_id: instA.id },
    admin: { id: 'u-admin', institution_id: instA.id },
  }, res);

  const xml = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
  check('TEST 9: export returns 200 XML', res.statusCode === 200, `status=${res.statusCode} body=${xml.slice(0, 120)}`);
  check('TEST 9: institution A export contains A claim reference', xml.includes(refA));
  check('TEST 9: institution A export does NOT contain institution B claim reference', !xml.includes(refB));
  check('TEST 9: institution A export does NOT contain institution B patient', !xml.includes('Bob'));

  // Capture + clean the export rows/files
  const rows = await NHISClaimExport.findAll({ where: { institution_id: instA.id } });
  created.exportsRows.push(...rows.map(r => ({ id: r.id, file_name: r.file_name })));
}

// ---------------------------------------------------------------------------
// TEST 10 — Medication + Procedure billing still work (handleBilling intact)
// ---------------------------------------------------------------------------
async function testMedicationAndProcedureBilling(created) {
  const inst = await makeInstitution('PH1-H');
  created.institutions.push(inst.id);
  const patient = await Patient.create({ first_name: 'Phase', last_name: 'OneH', institution_id: inst.id });
  created.patients.push(patient.id);
  const visit = await makeVisit(patient, inst.id);
  created.visits.push(visit.id);

  // --- Medication (with insurance + claim to exercise service_bill_id link) ---
  const med = await Medicine.create({ code: uniq('MED'), generic_name: 'Paracetamol', market_price: 20, nhia_price: 5 });
  created.medicines.push(med.id);
  const presc = await Prescription.create({
    medication_id: med.id, visit_id: visit.id, institution_id: inst.id,
    dosage: '500mg', frequency: 'TDS', duration: 3, quantity: 3,
  });
  created.prescriptions.push(presc.id);

  patient.has_insurance = true;
  await patient.save();
  const ins = await Insurance.create({ patient_id: patient.id, institution_id: inst.id, insured: true });
  created.insurances.push(ins.id);

  const claimM = await Claim.create({ visit_id: visit.id, claim_reference_number: uniq('PH1MED') });
  created.claims.push(claimM.id);

  const medBill = await handleBilling({
    transaction: undefined,
    patient_id: patient.id,
    visit_id: visit.id,
    service_id: presc.id,
    service_type: 'Medication',
    description: 'Paracetamol 500mg - TDS',
    unit_price: 20,
    nhia_unit_price: 5,
    quantity: 3,
    institution_id: inst.id,
    claim_id: claimM.id,
  });
  created.bills.push(medBill.service_bill_id || (await ServiceBill.findOne({ where: { service_id: presc.id, service_type: 'Medication' } })).id);

  check('TEST 10: Medication billing still creates a ServiceBill',
    (await ServiceBill.count({ where: { service_id: presc.id, service_type: 'Medication' } })) === 1);
  const medBillRow = await ServiceBill.findOne({ where: { service_id: presc.id, service_type: 'Medication' } });
  check('TEST 10: Medication bill uses medicine market price (20)',
    parseFloat(medBillRow.unit_price) === 20, `unit_price=${medBillRow.unit_price}`);
  check('TEST 10: Medication bill NHIA split is on the bill row (nhia 15 / patient 45)',
    parseFloat(medBillRow.nhia_amount) === 15 && parseFloat(medBillRow.patient_amount) === 45,
    `nhia=${medBillRow.nhia_amount} patient=${medBillRow.patient_amount}`);
  const medClaimItem = await ClaimItem.findOne({ where: { claim_id: claimM.id, item_type: 'Medication', item_id: presc.id } });
  created.claimItems.push(medClaimItem.id);
  check('TEST 10: Medication claim item is linked to its ServiceBill (service_bill_id)',
    !!medClaimItem && medClaimItem.service_bill_id === medBillRow.id,
    `service_bill_id=${medClaimItem?.service_bill_id}`);

  // --- Procedure through the real controller path ---
  const dept = await Department.create({
    name: 'Theatre', institution_id: inst.id, description: 'Theatre dept', departmentType: 'Surgery',
    department_number: uniq('DPT'),
  });
  created.departments.push(dept.id);
  const staff = await Staff.create({
    firstName: 'Doc', lastName: 'Phase', password: 'x', institution_id: inst.id, department_id: dept.id,
  });
  created.staffs.push(staff.id);
  const gdrg = await GDRGCode.create({ code: uniq('GDRG-P'), description: 'Appendectomy', market_price: 300, nhia_price: 50 });
  created.gdrgCodes.push(gdrg.id);

  const procRes = mockRes();
  await ProcedureController.addProcedures({
    body: {
      visit_id: visit.id,
      institution_id: inst.id,
      procedures: [{ procedure_id: gdrg.id }],
      doctor_id: staff.id,
      department_id: dept.id,
      procedure_datetime: new Date().toISOString(),
      claim_id: null,
    },
  }, procRes);
  check('TEST 10: Procedure creation returns 201', procRes.statusCode === 201, `status=${procRes.statusCode} body=${JSON.stringify(procRes.body || {}).slice(0, 160)}`);

  const createdProc = await Procedure.findOne({ where: { visit_id: visit.id } });
  if (createdProc) created.procedures.push(createdProc.id);

  const procBill = await ServiceBill.findOne({ where: { service_type: 'Procedure', visit_id: visit.id } });
  check('TEST 10: Procedure billing still creates exactly one ServiceBill',
    (await ServiceBill.count({ where: { service_type: 'Procedure', visit_id: visit.id } })) === 1);
  check('TEST 10: Procedure bill uses GDRG market price (300)',
    procBill && parseFloat(procBill.unit_price) === 300, `unit_price=${procBill?.unit_price}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('============================================');
  console.log('PHASE 1 VERIFICATION — J2 / J4 / J8 / J9');
  console.log(`DB: ${DB_HOST}/${process.env.DB_NAME || 'hms'} (NODE_ENV=${NODE_ENV})`);
  console.log('============================================');

  await runTest('J2 — Generic Service billing (Tests 1-3)', testGenericServiceBilling);
  await runTest('J8 — Invoice validation failure does not commit (Test 7)', testInvoiceValidationRollback);
  await runTest('J8 — Mid-array error rolls back the transaction (Test 8)', testMultiItemRollback);
  await runTest('J4 — Lab billing idempotency (Tests 4-6)', testLabIdempotentBilling);
  await runTest('J9 — NHIA XML institution isolation (Test 9)', testNhisInstitutionIsolation);
  await runTest('Regression — Medication & Procedure billing (Test 10)', testMedicationAndProcedureBilling);

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
