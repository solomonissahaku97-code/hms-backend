const { Invoice, ServiceBill, Visit, Patient, Staff, Institution } = require('../../models');
const { Op } = require('sequelize');

exports.createInvoice = async (req, res) => {
  try {
    const { visit_id, institution_id, services, notes, discount_amount, tax_amount } = req.body;
    
    // Calculate totals
    const subtotal = services.reduce((sum, service) => sum + (service.unit_price * service.quantity), 0);
    const total_amount = subtotal - discount_amount + tax_amount;
    
    // Generate invoice number
    const invoiceCount = await Invoice.count({ where: { institution_id } });
    const invoice_number = `INV-${new Date().getFullYear()}-${(invoiceCount + 1).toString().padStart(4, '0')}`;
    
    const invoice = await Invoice.create({
      visit_id,
      institution_id,
      invoice_number,
      invoice_date: new Date(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      subtotal,
      discount_amount: discount_amount || 0,
      tax_amount: tax_amount || 0,
      total_amount,
      balance_due: total_amount,
      status: 'draft',
      notes,
      created_by: req.user.id // Assuming you have user authentication
    });
    
    // Create service bills and associate with invoice
    for (const service of services) {
      await ServiceBill.create({
        ...service,
        invoice_id: invoice.id,
        visit_id,
        patient_id: service.patient_id,
        institution_id,
        total_amount: service.unit_price * service.quantity
      });
    }
    
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
    
    res.json({
      success: true,
      data: invoice
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