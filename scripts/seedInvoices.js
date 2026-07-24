require('dotenv').config();
const { Sequelize, Op } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
  }
);

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v;
  });

async function seed() {
  await sequelize.authenticate();
  console.log('[✓] Connected to database.');

  const { Patient, Visit, Invoice, ServiceBill, Institution } = require('../models');

  const patients = await Patient.findAll({ limit: 20 });
  if (patients.length === 0) {
    console.log('[✗] No patients found. Run create-patients-direct.js first.');
    await sequelize.close();
    process.exit(1);
  }

  const institutions = await Institution.findAll();
  const institution = institutions.length > 0 ? institutions[0] : null;

  const now = new Date();
  const serviceTypes = ['Medication', 'LabTest', 'Procedure', 'Consultation'];
  const departments = [' pharmacy', 'Radiology', 'Surgery', 'Outpatient', 'Emergency'];
  const paymentMethods = ['cash', 'card', 'insurance', 'bank_transfer', 'mobile_money'];
  const statuses = ['paid', 'partially_paid', 'unpaid', 'draft'];

  let invoiceCount = 0;
  let serviceBillCount = 0;
  const dailyFlow = [];

  for (let i = 0; i < 20; i++) {
    const patient = patients[i % patients.length];
    const visit = await Visit.findOne({ where: { patient_id: patient.id } });
    if (!visit) continue;

    const daysAgo = Math.floor(Math.random() * 30);
    const invoiceDate = new Date(now);
    invoiceDate.setDate(invoiceDate.getDate() - daysAgo);

    const serviceBillList = [];
    const numServices = Math.floor(Math.random() * 3) + 1;

    for (let j = 0; j < numServices; j++) {
      const serviceType = serviceTypes[Math.floor(Math.random() * serviceTypes.length)];
      const patientAmount = Math.floor(Math.random() * 500) + 50;
      const nhiaAmount = serviceType === 'Medication' || serviceType === 'LabTest'
        ? Math.floor(patientAmount * 0.3)
        : 0;

      serviceBillList.push({
        id: uuid(),
        visit_id: visit.id,
        patient_id: patient.id,
        institution_id: institution?.id || null,
        department_id: null,
        service_type: serviceType,
        description: `${serviceType} service - ${i + 1}.${j + 1}`,
        unit_price: patientAmount + nhiaAmount,
        quantity: 1,
        total_amount: patientAmount + nhiaAmount,
        patient_amount: patientAmount,
        nhia_amount: nhiaAmount,
        has_paid: false,
        payment_status: 'Pending',
        invoice_id: null,
      });
    }

    const totalPatient = serviceBillList.reduce((s, sb) => s + sb.patient_amount, 0);
    const totalNhia = serviceBillList.reduce((s, sb) => s + sb.nhia_amount, 0);
    const totalAmount = totalPatient + totalNhia;
    const amountPaid = Math.random() > 0.5 ? totalAmount : Math.floor(Math.random() * totalAmount);
    const balanceDue = totalAmount - amountPaid;
    const status = balanceDue <= 0 ? 'paid' : balanceDue < totalAmount ? 'partially_paid' : 'unpaid';

    const invoice = await Invoice.create({
      id: uuid(),
      invoice_number: `INV-${Date.now()}-${i.toString().padStart(4, '0')}`,
      invoice_date: invoiceDate,
      due_date: new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000),
      visit_id: visit.id,
      patient_id: patient.id,
      institution_id: institution?.id || null,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      status: status,
      payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
    });

    for (const sb of serviceBillList) {
      sb.invoice_id = invoice.id;
      sb.has_paid = status === 'paid' || (status === 'partially_paid' && Math.random() > 0.5);
      sb.payment_status = sb.has_paid ? 'Paid' : 'Pending';
      await ServiceBill.create(sb);
    }

    invoiceCount++;
  }

  console.log(`[✓] Seeded ${invoiceCount} invoices with ${serviceBillCount} service bills.`);
  console.log(`[✓] Daily flow transactions: ${dailyFlow.length} entries for cashflow UI.`);
  await sequelize.close();
}

seed().catch((err) => {
  console.error('[✗] Error:', err.message);
  process.exit(1);
});