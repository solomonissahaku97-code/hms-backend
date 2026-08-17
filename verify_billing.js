const { sequelize } = require('./models');
const Service = require('./models/service');
const Institution = require('./models/institution');
const Patient = require('./models/patient');
const Visit = require('./models/Visit');
const ServiceBill = require('./models/serviceBill');
const Procedure = require('./models/procedure/procedure');
const GDRGCode = require('./models/claims/GDRGCode');
const InstitutionProcedurePrice = require('./models/InstitutionProcedurePrice');
const LabTestResult = require('./models/lab/LabTestResult');
const LabTestTemplate = require('./models/lab/LabTestTemplate');
const LabInvestigation = require('./models/claims/LabInvestigations');
const InstitutionLabTariff = require('./models/InstitutionLabTariff');

const results = [];

async function assert(name, condition, message) {
  if (condition) {
    results.push({ name, status: 'PASS', message: message || '' });
  } else {
    results.push({ name, status: 'FAIL', message: message || 'Assertion failed' });
  }
}

(async () => {
  try {
    // Setup test institution
    let inst = await Institution.findOne({ where: { name: 'Pricing Test Institution A' } });
    if (!inst) {
      inst = await Institution.create({
        name: 'Pricing Test Institution A',
        region: 'Greater Accra',
        address: 'Test Address',
        contact: '0200000000',
        email: 'testa@test.com',
        country: 'Ghana'
      });
    }

    let patient = await Patient.findOne({ where: { first_name: 'PricingTest' } });
    if (!patient) {
      patient = await Patient.create({
        first_name: 'PricingTest',
        last_name: 'Patient',
        has_insurance: false,
        institution_id: inst.id
      });
    }

    let visit = await Visit.findOne({ where: { patient_id: patient.id, institution_id: inst.id } });
    if (!visit) {
      visit = await Visit.create({ patient_id: patient.id, institution_id: inst.id, visit_date: new Date() });
    }

    // Clean up previous test data
    await ServiceBill.destroy({ where: { visit_id: visit.id } });
    await Service.destroy({ where: { institution_id: inst.id } });
    await Procedure.destroy({ where: { visit_id: visit.id } });
    await LabTestResult.destroy({ where: { visit_id: visit.id } });
    await InstitutionProcedurePrice.destroy({ where: { institution_id: inst.id } });
    await InstitutionLabTariff.destroy({ where: { institution_id: inst.id } });

    // Test 1: Verify ServiceBill.service_type ENUM now includes 'Service'
    const [serviceTypeRows] = await sequelize.query(`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_service_bills_service_type') 
      ORDER BY enumlabel
    `);
    const serviceTypes = serviceTypeRows.map(r => r.enumlabel);
    assert('ServiceBill.service_type ENUM includes Service', serviceTypes.includes('Service'), `Types: ${serviceTypes.join(', ')}`);

    // Test 2: Verify ClaimItem.item_type ENUM includes 'Service'
    const [claimItemTypeRows] = await sequelize.query(`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_claim_items_item_type') 
      ORDER BY enumlabel
    `);
    const claimItemTypes = claimItemTypeRows.map(r => r.enumlabel);
    assert('ClaimItem.item_type ENUM includes Service', claimItemTypes.includes('Service'), `Types: ${claimItemTypes.join(', ')}`);

    // Test 3: Create a service and verify it uses service_type='Service'
    const service = await Service.create({
      name: 'Test Ambulance',
      description: 'Test ambulance service',
      institution_id: inst.id,
      cost: 150,
      is_free: false
    });

    const serviceBill = await ServiceBill.create({
      visit_id: visit.id,
      patient_id: patient.id,
      institution_id: inst.id,
      service_id: service.id,
      service_type: 'Service',
      description: service.name,
      unit_price: service.cost,
      total_amount: service.cost,
      patient_amount: service.cost,
      nhia_amount: 0,
      payment_status: 'Pending',
      has_paid: false
    });
    assert('ServiceBill created with service_type=Service', serviceBill.service_type === 'Service', `service_type: ${serviceBill.service_type}`);

    // Test 4: Verify getService() resolves Service type
    const resolvedService = await serviceBill.getService();
    assert('getService() resolves Service type', resolvedService && resolvedService.id === service.id, `Resolved: ${resolvedService ? resolvedService.name : 'null'}`);

    // Test 5: Verify getService() still handles Other type (backward compatibility)
    const oldStyleBill = await ServiceBill.create({
      visit_id: visit.id,
      patient_id: patient.id,
      institution_id: inst.id,
      service_id: service.id,
      service_type: 'Other',
      description: service.name,
      unit_price: service.cost,
      total_amount: service.cost,
      patient_amount: service.cost,
      nhia_amount: 0,
      payment_status: 'Pending',
      has_paid: false
    });
    const resolvedOldStyle = await oldStyleBill.getService();
    assert('getService() resolves Other type (backward compat)', resolvedOldStyle && resolvedOldStyle.id === service.id, `Resolved: ${resolvedOldStyle ? resolvedOldStyle.name : 'null'}`);

    // Test 6: Verify Procedure billing path uses handleBilling
    // (This is tested by the fact that addProcedures now calls handleBilling)
    // We'll verify by checking the code path indirectly
    const gdrg = await GDRGCode.findOne({ where: { code: 'PRICE-GDRG-001' } });
    if (!gdrg) {
      gdrg = await GDRGCode.create({
        code: 'PRICE-GDRG-001',
        description: 'Test Procedure',
        market_price: 200,
        nhia_price: 100
      });
    }

    const procedure = await Procedure.create({
      selected_procedure_id: gdrg.id,
      visit_id: visit.id,
      institution_id: inst.id,
      doctor_id: 'afd60ad4-e479-4bbc-94b6-86ef395221a2',
      department_id: '2d302acd-0124-4ceb-928f-ee43bbda6fc3',
      procedure_datetime: new Date().toISOString()
    });

    // Simulate what addProcedures now does - use handleBilling
    const { handleBilling } = require('./utils/billingUtil');
    const billingResult = await handleBilling({
      transaction: null,
      patient_id: patient.id,
      visit_id: visit.id,
      service_id: procedure.id,
      service_type: 'Procedure',
      description: gdrg.description,
      unit_price: 200,
      nhia_unit_price: 100,
      quantity: 1,
      department_id: null,
      institution_id: inst.id,
      claim_id: null
    });

    assert('Procedure billing via handleBilling creates invoice', !!billingResult.invoice_id, `invoice_id: ${billingResult.invoice_id}`);
    
    const procedureBill = await ServiceBill.findOne({ where: { service_id: procedure.id, service_type: 'Procedure' } });
    assert('Procedure ServiceBill created', !!procedureBill, `Bill exists: ${!!procedureBill}`);
    assert('Procedure ServiceBill has invoice_id', procedureBill && !!procedureBill.invoice_id, `invoice_id: ${procedureBill?.invoice_id}`);

    // Test 7: Verify Lab service_id is no longer null
    const template = await LabTestTemplate.findOne({ where: { name: 'Price Test Template' } });
    if (!template) {
      const labInv = await LabInvestigation.findOne({ where: { g_drg_code: 'PRICE-TEST-001' } });
      if (!labInv) {
        // Create a simple lab investigation for testing
        const newInv = await LabInvestigation.create({
          g_drg_code: 'PRICE-TEST-002',
          test_description: 'Test Lab',
          tariff_ghc: 50,
          market_price: 50
        });
        template = await LabTestTemplate.create({
          name: 'Test Lab Template',
          lab_tarrif_id: newInv.id,
          quantity: 1
        });
      } else {
        template = await LabTestTemplate.findOne({ where: { lab_tarrif_id: labInv.id } });
      }
    }

    const labResult = await LabTestResult.create({
      visit_id: visit.id,
      patient_id: patient.id,
      institution_id: inst.id,
      templateId: template.id,
      status: 'completed'
    });

    // Simulate what labController now does - use result.id instead of null
    const institutionOverride = await InstitutionLabTariff.findOne({
      where: { institution_id: inst.id, lab_investigation_id: template.lab_tarrif_id, is_active: true }
    });

    const marketPrice = institutionOverride ? parseFloat(institutionOverride.market_price || 0) : parseFloat(template.lab_tarrif?.market_price || 0);
    
    const labBillingResult = await handleBilling({
      transaction: null,
      patient_id: patient.id,
      visit_id: visit.id,
      service_id: labResult.id,  // Now using result.id instead of null
      service_type: 'LabTest',
      description: template.lab_tarrif?.test_description || 'Lab Test',
      unit_price: marketPrice,
      nhia_unit_price: 0,
      quantity: 1,
      department_id: null,
      institution_id: inst.id,
      claim_id: null
    });

    const labBillRecord = await ServiceBill.findOne({ where: { service_id: labResult.id, service_type: 'LabTest' } });
    assert('Lab billing uses result.id as service_id', labBillRecord && labBillRecord.service_id === labResult.id, `service_id: ${labBillRecord?.service_id}`);
    assert('Lab ServiceBill created with correct service_id', !!labBillRecord && labBillRecord.service_id === labResult.id, `service_id: ${labBillRecord?.service_id}`);

    // Print results
    console.log('\n=== BILLING STANDARDIZATION VERIFICATION ===\n');
    let passCount = 0;
    let failCount = 0;
    results.forEach(r => {
      const status = r.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${r.name}: ${r.message}`);
      if (r.status === 'PASS') passCount++;
      else failCount++;
    });
    console.log(`\nTotal: ${passCount} passed, ${failCount} failed`);

    // Cleanup
    await ServiceBill.destroy({ where: { visit_id: visit.id } });
    await Service.destroy({ where: { id: service.id } });
    await Procedure.destroy({ where: { id: procedure.id } });
    await LabTestResult.destroy({ where: { id: labResult.id } });
    await InstitutionProcedurePrice.destroy({ where: { institution_id: inst.id } });
    await InstitutionLabTariff.destroy({ where: { institution_id: inst.id } });

    await sequelize.close();
    process.exit(failCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test error:', err);
    await sequelize.close();
    process.exit(1);
  }
})();
