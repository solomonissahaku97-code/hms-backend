const { Invoice, ServiceBill, Visit, Patient, Staff, Institution, Service, Prescription, LabTestResult, Procedure } = require('../../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sendSMS } = require('../../service/smsService');

exports.createInvoice = async (req, res) => {
  const transaction = await Invoice.sequelize.transaction();
  try {
    const { visit_id, institution_id, services, notes, discount_amount, tax_amount } = req.body;

    if (!visit_id || !institution_id || !services || !Array.isArray(services) || services.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'visit_id, institution_id, and a non-empty services array are required'
      });
    }

    // Validate visit exists
    const visit = await Visit.findByPk(visit_id, { transaction });
    if (!visit) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    // Validate institution exists
    const institution = await Institution.findByPk(institution_id, { transaction });
    if (!institution) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Institution not found'
      });
    }

    // Validate each service exists and compute totals
    let subtotal = 0;
    const validatedServices = [];

    for (const service of services) {
      const unitPrice = parseFloat(service.unit_price) || 0;
      const quantity = parseInt(service.quantity, 10) || 1;

      // Validate service existence based on service_type
      switch (service.service_type) {
        case 'Medication':
          if (service.service_id) {
            const medication = await Prescription.findByPk(service.service_id, { transaction });
            if (!medication) {
              await transaction.rollback();
              return res.status(404).json({
                success: false,
                message: `Medication with ID ${service.service_id} not found`
              });
            }
            if (!service.description) service.description = medication.generic_name;
          }
          break;
        case 'LabTest':
          if (service.service_id) {
            const labTest = await LabTestResult.findByPk(service.service_id, { transaction });
            if (!labTest) {
              await transaction.rollback();
              return res.status(404).json({
                success: false,
                message: `LabTest with ID ${service.service_id} not found`
              });
            }
            if (!service.description) service.description = labTest.test_name;
          }
          break;
        case 'Procedure':
          if (service.service_id) {
            const procedure = await Procedure.findByPk(service.service_id, { transaction });
            if (!procedure) {
              await transaction.rollback();
              return res.status(404).json({
                success: false,
                message: `Procedure with ID ${service.service_id} not found`
              });
            }
            if (!service.description) service.description = procedure.procedure_name;
          }
          break;
        default:
          break;
      }

      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      validatedServices.push({
        ...service,
        unit_price: unitPrice,
        quantity,
        total_amount: lineTotal,
        patient_amount: lineTotal,
        nhia_amount: 0,
        payment_status: 'Pending',
        has_paid: false
      });
    }

    const total_amount = Math.round((subtotal - (discount_amount || 0) + (tax_amount || 0)) * 100) / 100;

    // Generate invoice number
    const invoiceCount = await Invoice.count({ where: { institution_id }, transaction });
    const invoice_number = `INV-${new Date().getFullYear()}-${(invoiceCount + 1).toString().padStart(4, '0')}`;

    const invoice = await Invoice.create({
      visit_id,
      institution_id,
      invoice_number,
      invoice_date: new Date(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: Math.round(subtotal * 100) / 100,
      discount_amount: discount_amount || 0,
      tax_amount: tax_amount || 0,
      total_amount,
      balance_due: total_amount,
      status: 'draft',
      notes,
      created_by: req.user.id
    }, { transaction });

    // Create service bills and associate with invoice
    for (const service of validatedServices) {
      await ServiceBill.create({
        ...service,
        invoice_id: invoice.id,
        visit_id,
        patient_id: service.patient_id || visit.patient_id,
        institution_id,
      }, { transaction });
    }

    await transaction.commit();

    // Fetch the complete invoice with associations
    const completeInvoice = await Invoice.findByPk(invoice.id, {
      include: [
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] },
        { model: Institution, as: 'institution' },
        { model: Staff, as: 'creator' },
        { model: ServiceBill, as: 'serviceBills' }
      ]
    });

    res.status(201).json({
      success: true,
      data: completeInvoice
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: 'Error creating invoice',
      error: error.message
    });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, patient_id, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (status) whereClause.status = status;
    if (patient_id) whereClause['$visit.patient_id$'] = patient_id;
    
    if (start_date && end_date) {
      whereClause.invoice_date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    }
    
    const invoices = await Invoice.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: Visit, 
          as: 'visit', 
          include: [{ model: Patient, as: 'patient', }] 
        },
        { model: Institution, as: 'institution', attributes: ['id', 'name'] },
        { model: ServiceBill, as: 'service_bills' }
      ],
      limit: parseInt(limit),
      offset: offset,
      order: [['invoice_date', 'DESC']]
    });
    
    res.json({
      success: true,
      data: invoices.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: invoices.count,
        pages: Math.ceil(invoices.count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching invoices',
      error: error.message
    });
  }
};

exports.getInvoiceByVisitId = async (req, res) => {
  try {
    const { visit_id } = req.query;

    const invoice = await Invoice.findOne({
      where: { visit_id },
      include: [
        { 
          model: Visit, 
          as: 'visit', 
          include: [{ model: Patient, as: 'patient' }] 
        },
        { model: Institution, as: 'institution' },
        { model: Staff, as: 'creator' },
        { model: ServiceBill, as: 'service_bills' }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found for this visit'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice',
      error: error.message
    });
  }
};


exports.updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Prevent updating certain fields
    delete updates.invoice_number;
    delete updates.created_by;
    
    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    // Recalculate balance if amount paid changes
    if (updates.amount_paid !== undefined) {
      updates.balance_due = invoice.total_amount - updates.amount_paid;
      
      // Update status based on payment
      if (updates.balance_due <= 0) {
        updates.status = 'paid';
      } else if (updates.amount_paid > 0) {
        updates.status = 'partially_paid';
      } else if (new Date() > invoice.due_date) {
        updates.status = 'overdue';
      } else {
        updates.status = 'unpaid';
      }
    }
    
    await invoice.update(updates);
    
    const updatedInvoice = await Invoice.findByPk(id, {
      include: [
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] },
        { model: Institution, as: 'institution' },
        { model: Staff, as: 'creator' },
        { model: ServiceBill, as: 'service_bills' }
      ]
    });
    
    res.json({
      success: true,
      data: updatedInvoice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating invoice',
      error: error.message
    });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    // Check if invoice can be deleted (only drafts)
    if (invoice.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft invoices can be deleted'
      });
    }
    
    await invoice.destroy();
    
    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting invoice',
      error: error.message
    });
  }
};

exports.generateInvoiceToken = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.body.institution_id || req.admin?.institution_id;

    const invoice = await Invoice.findOne({
      where: { id, institution_id: institutionId }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (!invoice.token) {
      invoice.token = uuidv4();
      invoice.sms_sent = false;
      await invoice.save();
    }

    res.json({
      success: true,
      data: {
        token: invoice.token,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number
      }
    });
  } catch (error) {
    console.error('Error generating invoice token:', error);
    res.status(500).json({ success: false, message: 'Failed to generate token', error: error.message });
  }
};

exports.sendInvoiceSMS = async (req, res) => {
  try {
    const { id } = req.params;
    const { phone_number } = req.body;
    const institutionId = req.body.institution_id || req.admin?.institution_id;

    const invoice = await Invoice.findOne({
      where: { id, institution_id: institutionId },
      include: [
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const patientPhone = phone_number || invoice.visit?.patient?.phone;
    if (!patientPhone) {
      return res.status(400).json({ success: false, message: 'Patient phone number is required' });
    }

    if (!invoice.token) {
      invoice.token = uuidv4();
      await invoice.save();
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const invoiceUrl = `${baseUrl}/invoices/${invoice.token}`;

    const message = `Dear ${invoice.visit?.patient?.first_name || 'Patient'}, your hospital invoice ${invoice.invoice_number} for GHS ${parseFloat(invoice.balance_due || invoice.total_amount).toFixed(2)} is ready. View and pay online: ${invoiceUrl}`;

    const smsResult = await sendSMS(patientPhone, message);

    if (!smsResult.success) {
      console.error('Failed to send invoice SMS:', smsResult.error);
      return res.status(500).json({ success: false, message: 'Failed to send SMS', error: smsResult.error });
    }

    invoice.sms_sent = true;
    invoice.sms_sent_at = new Date();
    await invoice.save();

    res.status(200).json({
      success: true,
      message: 'Invoice SMS sent successfully',
      data: {
        phone: patientPhone,
        invoice_url: invoiceUrl,
        invoice_number: invoice.invoice_number,
        token: invoice.token
      }
    });
  } catch (error) {
    console.error('Error sending invoice SMS:', error);
    res.status(500).json({ success: false, message: 'Failed to send SMS', error: error.message });
  }
};

exports.viewInvoiceByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const invoice = await Invoice.findOne({
      where: { token },
      include: [
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] },
        { model: Institution, as: 'institution' },
        { model: ServiceBill, as: 'service_bills' }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error viewing invoice:', error);
    res.status(500).json({ success: false, message: 'Failed to view invoice', error: error.message });
  }
};

exports.getInvoiceByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const invoice = await Invoice.findOne({
      where: { token },
      include: [
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name', 'folder_number', 'phone'] }] },
        { model: Institution, as: 'institution', attributes: ['id', 'name', 'address', 'contact', 'email'] },
        { model: ServiceBill, as: 'service_bills' }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    invoice.viewed_count = (invoice.viewed_count || 0) + 1;
    invoice.viewed_at = new Date();
    await invoice.save();

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error fetching invoice by token:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch invoice', error: error.message });
  }
};
