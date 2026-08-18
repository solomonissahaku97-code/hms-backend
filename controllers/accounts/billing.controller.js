const { Invoice, ServiceBill, Visit, Patient, Payment, LabTestResult, LabTestTemplate } = require('../../models');
const LabInvestigation = require('../../models/claims/LabInvestigations');
const InstitutionLabTariff = require('../../models/InstitutionLabTariff');
const { Op, Sequelize } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// Get all patients with their billing summary
exports.getAllPatientsWithBillingSummary = async (req, res) => {
  try {
    const { institution_id, search, status, page = 1, limit = 20 } = req.query;
    
    if (!institution_id) {
      return res.status(400).json({ success: false, message: 'institution_id is required' });
    }

    const whereClause = {};
    
    // Build patient search query
    const patientWhere = { institution_id };
    if (search) {
      patientWhere[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { patient_id: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Get patients with their billing information
    const patients = await Patient.findAndCountAll({
      where: patientWhere,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
      raw: false
    });

    // For each patient, calculate billing summary
    const patientIds = patients.rows.map(p => p.id);
    
    // Get all service bills for these patients
    const serviceBills = await ServiceBill.findAll({
      where: {
        patient_id: { [Op.in]: patientIds }
      },
      attributes: [
        'patient_id',
        [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total_billed'],
        [Sequelize.literal(`SUM(CASE WHEN "has_paid" = true THEN "total_amount" ELSE 0 END)`), 'total_paid'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'bill_count']
      ],
      group: ['patient_id'],
      raw: true
    });

    // Create a map for quick lookup
    const billMap = {};
    serviceBills.forEach(bill => {
      billMap[bill.patient_id] = {
        total_billed: parseFloat(bill.total_billed) || 0,
        total_paid: parseFloat(bill.total_paid) || 0,
        bill_count: parseInt(bill.bill_count) || 0
      };
    });

    // Build response with billing summary
    const patientsWithBilling = patients.rows.map(patient => {
      const bills = billMap[patient.id] || { total_billed: 0, total_paid: 0, bill_count: 0 };
      return {
        id: patient.id,
        patient_id: patient.patient_id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        phone: patient.phone,
        insurance_status: patient.insurance_status,
        insurance_provider: patient.insurance_provider,
        total_billed: bills.total_billed,
        total_paid: bills.total_paid,
        balance: bills.total_billed - bills.total_paid,
        bill_count: bills.bill_count,
        status: bills.balance > 0 ? (bills.total_paid > 0 ? 'partial' : 'unpaid') : 'paid'
      };
    });

    // Filter by status if provided
    let filteredPatients = patientsWithBilling;
    if (status && status !== 'all') {
      filteredPatients = patientsWithBilling.filter(p => p.status === status);
    }

    res.json({
      success: true,
      data: filteredPatients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: patients.count, 
        pages: Math.ceil(patients.count / parseInt(limit))
      }
    });
  } catch (error) { 
    console.error('Error fetching patients with billing:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patients billing summary',
      error: error.message
    });
  }
};

// Get detailed billing history for a specific patient
exports.getPatientBillingHistory = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const { institution_id } = req.query;

    if (!patient_id) {
      return res.status(400).json({ success: false, message: 'patient_id is required' });
    }

    // Get patient info
    const patient = await Patient.findOne({
      where: { id: patient_id },
      attributes: ['id', 'patient_id', 'first_name', 'last_name', 'phone', 'insurance_status', 'insurance_provider', 'date_of_birth']
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Get all visits for this patient with billing info
    const visits = await Visit.findAll({
      where: { patient_id },
      attributes: ['id', 'visit_number', 'visit_type', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Invoice,
          as: 'invoices',
          attributes: ['id', 'invoice_number', 'total_amount', 'amount_paid', 'balance_due', 'status', 'due_date', 'createdAt', 'institution_id']
        }
      ]
    });

    // Get all service bills for this patient grouped by visit
    const serviceBills = await ServiceBill.findAll({
      where: { patient_id },
      attributes: [
        'id', 'visit_id', 'service_type', 'service_name', 'total_amount', 
        'paid_amount', 'payment_status', 'payment_method', 'created_at'
      ],
      order: [['created_at', 'DESC']],
      raw: true
    });

    // Group service bills by visit
    const billsByVisit = {};
    serviceBills.forEach(bill => {
      if (!billsByVisit[bill.visit_id]) {
        billsByVisit[bill.visit_id] = [];
      }
      billsByVisit[bill.visit_id].push(bill);
    });

    // Calculate totals
    const totals = {
      total_billed: 0,
      total_paid: 0,
      total_outstanding: 0,
      visit_count: visits.length,
      invoice_count: 0
    };

    // Build visit details with bills and invoices
    const visitDetails = visits.map(visit => {
      const bills = billsByVisit[visit.id] || [];
      const visitBilled = bills.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
      const visitPaid = bills.reduce((sum, b) => sum + parseFloat(b.paid_amount || 0), 0);
      
      totals.total_billed += visitBilled;
      totals.total_paid += visitPaid;
      totals.invoice_count += visit.invoices ? visit.invoices.length : 0;

      return {
        visit_id: visit.id,
        visit_number: visit.visit_number,
        visit_type: visit.visit_type,
        visit_status: visit.status,
        visit_date: visit.createdAt,
          bills: bills.map(b => ({
              id: b.id,
              service_type: b.service_type,
              service_name: b.description,
              total_amount: parseFloat(b.total_amount) || 0,
              paid_amount: parseFloat(b.paid_amount) || 0,
              balance: parseFloat(b.total_amount) - parseFloat(b.paid_amount),
              payment_status: b.payment_status,
              payment_method: b.payment_method,
              created_at: b.created_at
          })),
        invoices: visit.invoices ? visit.invoices.map(inv => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          total_amount: parseFloat(inv.total_amount) || 0,
          amount_paid: parseFloat(inv.amount_paid) || 0,
          balance_due: parseFloat(inv.balance_due) || 0,
          institution_id: inv.institution_id,
          status: inv.status,
          due_date: inv.due_date,
          created_at: inv.createdAt
        })) : [],
        visit_total_billed: visitBilled,
        visit_total_paid: visitPaid,
        visit_balance: visitBilled - visitPaid
      };
    });

    totals.total_outstanding = totals.total_billed - totals.total_paid;

    res.json({
      success: true,
      data: {
        patient: {
          id: patient.id,
          patient_id: patient.patient_id,
          first_name: patient.first_name,
          last_name: patient.last_name,
          phone: patient.phone,
          insurance_status: patient.insurance_status,
          insurance_provider: patient.insurance_provider,
          date_of_birth: patient.date_of_birth
        },
        summary: totals,
        visits: visitDetails
      }
    });
  } catch (error) {
    console.error('Error fetching patient billing history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient billing history',
      error: error.message
    });
  }
};

// Make payment for a patient's bill
exports.makePatientPayment = async (req, res) => {
  const transaction = await Invoice.sequelize.transaction();
  try {
    const { patient_id } = req.params;
    const { visit_id, bill_id, amount, payment_method, notes } = req.body;
    const { institution_id, staff_id } = req.query;

    if (!patient_id || !amount || !payment_method) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'patient_id, amount, and payment_method are required' 
      });
    }

    // Find the bill
    let bill;
    if (bill_id) {
      bill = await ServiceBill.findByPk(bill_id, { transaction });
    } else if (visit_id) {
      // Get the oldest unpaid bill for this visit
      bill = await ServiceBill.findOne({
        where: { 
          visit_id, 
          patient_id,
          payment_status: { [Op.in]: ['Pending', 'Overdue'] }
        },
        order: [['created_at', 'ASC']],
        transaction
      });

      if (!bill) {
        const visit = await Visit.findByPk(visit_id, { transaction });
        if (visit) {
          const labResult = await LabTestResult.findOne({
            where: { visit_id },
            include: [{
              model: LabTestTemplate,
              as: 'template',
              include: [{
                model: LabInvestigation,
                as: 'lab_tarrif'
              }]
            }],
            order: [['createdAt', 'DESC']],
            transaction
          });

          if (labResult) {
            const tariff = labResult.template?.lab_tarrif || {};

            // Check for institution-specific price override
            const institutionOverride = await InstitutionLabTariff.findOne({
                where: {
                    institution_id: visit.institution_id,
                    lab_investigation_id: tariff.id,
                    is_active: true
                }
            });

            const marketPrice = institutionOverride ? parseFloat(institutionOverride.market_price || 0) : parseFloat(tariff.market_price || 0);
            const tariffGhc = institutionOverride ? parseFloat(institutionOverride.tariff_ghc || 0) : parseFloat(tariff.tariff_ghc || 0);
            const totalAmount = marketPrice > 0 ? marketPrice : tariffGhc;

            const patient = await Patient.findByPk(patient_id, { transaction });
            const hasInsurance = patient?.has_insurance || false;
            const nhiaAmount = hasInsurance ? Math.min(tariffGhc, totalAmount) : 0;
            const patientAmount = hasInsurance ? (totalAmount - nhiaAmount) : totalAmount;

            bill = await ServiceBill.create({
              visit_id,
              patient_id,
              institution_id: visit.institution_id,
              department_id: labResult.department_id || visit.department_id,
              service_id: labResult.id,
              service_type: 'LabTest',
              description: tariff.test_description || 'Lab Test',
              unit_price: marketPrice || tariffGhc,
              quantity: 1,
              total_amount: totalAmount,
              nhia_amount: nhiaAmount,
              patient_amount: patientAmount,
              payment_status: 'Pending',
              has_paid: false
            }, { transaction });
          }
        }
      }
    }

    if (!bill) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'No pending bill found' });
    }

    const paymentAmount = parseFloat(amount);
    const currentPaid = parseFloat(bill.paid_amount) || 0;
    const billTotal = parseFloat(bill.total_amount);
    const newPaid = currentPaid + paymentAmount;

    // Update bill
    bill.paid_amount = newPaid;
    if (newPaid >= billTotal) {
      bill.payment_status = 'Paid';
      bill.payment_method = payment_method;
      bill.paid_at = new Date();
    } else if (newPaid > 0) {
      bill.payment_status = 'Pending';
    }
    await bill.save({ transaction });

    // If bill has an invoice, update the invoice too
    if (bill.invoice_id) {
      const invoice = await Invoice.findByPk(bill.invoice_id, { transaction });
      if (invoice) {
        invoice.amount_paid = parseFloat(invoice.amount_paid) + paymentAmount;
        invoice.balance_due = parseFloat(invoice.total_amount) - invoice.amount_paid;
        
        if (invoice.balance_due <= 0) {
          invoice.balance_due = 0;
          invoice.status = 'paid';
        } else {
          invoice.status = 'partially_paid';
        }
        await invoice.save({ transaction });
      }
    }

    await Payment.create({
      id: uuidv4(),
      transactionId: uuidv4(),
      status: 'completed',
      amount: paymentAmount,
      currency: 'GHS',
      paidAt: new Date(),
      service_bill_id: bill.id,
      invoice_id: bill.invoice_id,
      patient_id: bill.patient_id,
      payment_method,
      payment_type: newPaid >= billTotal ? 'full' : 'partial',
      notes: notes || `Payment for service bill ${bill.id}`,
      created_by: staff_id || req.admin?.id
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        bill_id: bill.id,
        amount_paid: paymentAmount,
        total_paid: newPaid,
        remaining_balance: billTotal - newPaid,
        status: bill.payment_status
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing payment',
      error: error.message
    });
  }
};

exports.getBillingStats = async (req, res) => {
  try {
    const { institution_id, start_date, end_date } = req.query;
    
    if (!institution_id) {
      return res.status(400).json({ success: false, message: 'institution_id is required' });
    }
    
    const whereClause = { institution_id };
    if (start_date && end_date) {
      whereClause.invoice_date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    }
    
    // Total revenue from Invoices
    const totalRevenue = await Invoice.sum('total_amount', { where: whereClause }) ?? 0;
    
    // Paid amount (actual amount paid, including partial payments)
    const paidAmount = await Invoice.sum('amount_paid', { 
      where: whereClause 
    }) ?? 0;
    
    // Pending invoices count and amount
    const pendingInvoices = await Invoice.count({ 
      where: { ...whereClause, status: { [Op.in]: ['unpaid', 'partially_paid'] } } 
    });
    
    const pendingAmount = await Invoice.sum('balance_due', { 
      where: { ...whereClause, status: { [Op.in]: ['unpaid', 'partially_paid'] } } 
    }) ?? 0;
    
    // Overdue invoices
    const overdueInvoices = await Invoice.count({
      where: {
        ...whereClause,
        status: { [Op.in]: ['unpaid', 'partially_paid'] },
        due_date: { [Op.lt]: new Date() }
      }
    });
    
    const overdueAmount = await Invoice.sum('balance_due', {
      where: {
        ...whereClause,
        status: { [Op.in]: ['unpaid', 'partially_paid'] },
        due_date: { [Op.lt]: new Date() }
      }
    }) ?? 0;
    
    // Get ServiceBill revenue for standalone bills (not linked to invoices, to avoid double-counting)
    const serviceBillRevenue = await ServiceBill.sum('total_amount', { 
      where: { institution_id, invoice_id: null } 
    }) ?? 0;
    
    const serviceBillPaid = await ServiceBill.sum('total_amount', { 
      where: { institution_id, invoice_id: null, has_paid: true } 
    }) ?? 0;
    
    // Payment method distribution from Invoices
    const paymentMethods = await Invoice.findAll({
      attributes: [
        'payment_method',
        [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total_amount'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'invoice_count']
      ],
      where: { ...whereClause, payment_method: { [Op.not]: null } },
      group: ['payment_method'],
      raw: true
    });

    // NEW: Get revenue by patient type (Insured vs Self-Pay)
    // Join: ServiceBill -> Patient (ServiceBill has patient_id)
    const { QueryTypes } = require('sequelize');
    const sequelize = require('../../config/database');
    
    // Get insured revenue from standalone ServiceBills (not linked to invoices, to avoid double-counting)
    const insuredServiceBillResult = await sequelize.query(`
      SELECT COALESCE(SUM(sb.total_amount), 0) as total
      FROM service_bills sb
      JOIN patients p ON sb.patient_id = p.id
      WHERE sb.institution_id = :institutionId
      AND p.has_insurance = true
      AND sb.invoice_id IS NULL
    `, {
      replacements: { institutionId: institution_id },
      type: QueryTypes.SELECT
    });
    
    const insuredServiceBillRevenue = parseFloat(insuredServiceBillResult[0]?.total || 0);
    
    // Get self-pay revenue from standalone ServiceBills (not linked to invoices)
    const selfPayServiceBillResult = await sequelize.query(`
      SELECT COALESCE(SUM(sb.total_amount), 0) as total
      FROM service_bills sb
      JOIN patients p ON sb.patient_id = p.id
      WHERE sb.institution_id = :institutionId
      AND p.has_insurance = false
      AND sb.invoice_id IS NULL
    `, {
      replacements: { institutionId: institution_id },
      type: QueryTypes.SELECT
    });
    
    const selfPayServiceBillRevenue = parseFloat(selfPayServiceBillResult[0]?.total || 0);

    // Get Invoice revenue by patient type
    // Invoice -> Visit -> Patient (because Invoice has visit_id, not patient_id directly)
    const insuredInvoiceResult = await sequelize.query(`
      SELECT COALESCE(SUM(i.total_amount), 0) as total
      FROM invoices i
      JOIN visits v ON i.visit_id = v.id
      JOIN patients p ON v.patient_id = p.id
      WHERE i.institution_id = :institutionId
      AND p.has_insurance = true
    `, {
      replacements: { institutionId: institution_id },
      type: QueryTypes.SELECT
    });
    
    const insuredInvoiceRevenue = parseFloat(insuredInvoiceResult[0]?.total || 0);
    
    const selfPayInvoiceResult = await sequelize.query(`
      SELECT COALESCE(SUM(i.total_amount), 0) as total
      FROM invoices i
      JOIN visits v ON i.visit_id = v.id
      JOIN patients p ON v.patient_id = p.id
      WHERE i.institution_id = :institutionId
      AND p.has_insurance = false
    `, {
      replacements: { institutionId: institution_id },
      type: QueryTypes.SELECT
    });
    
    const selfPayInvoiceRevenue = parseFloat(selfPayInvoiceResult[0]?.total || 0);
    
    // Combine insured and self-pay revenues from both ServiceBill and Invoice
    const totalInsuredRevenue = insuredServiceBillRevenue + insuredInvoiceRevenue;
    const totalSelfPayRevenue = selfPayServiceBillRevenue + selfPayInvoiceRevenue;
    
    // Total revenue = Invoice revenue (includes invoice-linked service bills) + standalone ServiceBill revenue
    const totalServiceRevenue = serviceBillRevenue;
    
    res.json({
      success: true,
      data: {
        total_revenue: totalRevenue + totalServiceRevenue,
        paid_amount: paidAmount + serviceBillPaid,
        pending_invoices: pendingInvoices,
        pending_amount: pendingAmount > 0 ? pendingAmount : (serviceBillRevenue - serviceBillPaid),
        overdue_invoices: overdueInvoices,
        overdue_amount: overdueAmount,
        invoice_revenue: totalRevenue,
        service_bill_revenue: serviceBillRevenue,
        payment_methods: paymentMethods,
        // New: Revenue by patient type (based on Patient.has_insurance)
        revenue_by_patient_type: {
          insured: totalInsuredRevenue,
          self_pay: totalSelfPayRevenue,
          total: totalInsuredRevenue + totalSelfPayRevenue
        }
      }
    });
  } catch (error) {
    console.error('Error fetching billing statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching billing statistics',
      error: error.message
    });
  }
};

exports.getRecentTransactions = async (req, res) => {
  try {
    const { institution_id, limit = 20 } = req.query;

    if (!institution_id) {
      return res.status(400).json({ success: false, message: 'institution_id is required' });
    }

    const invoices = await Invoice.findAll({
      where: { institution_id },
      include: [
        { 
          model: Visit, 
          as: 'visit', 
          include: [{ model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name', 'has_insurance'] }] 
        }
      ],
      limit: parseInt(limit),
      order: [['invoice_date', 'DESC']]
    }); 

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching recent transactions',
      error: error.message
    });
  }
};
