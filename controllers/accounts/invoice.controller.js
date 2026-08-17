const { Invoice, ServiceBill, Visit, Patient, Staff, Institution, Service, Prescription, LabTestResult, Procedure } = require('../../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sendSMS } = require('../../service/smsService');
const { handleBilling } = require('../../utils/billingUtil');

/**
 * Resolve the authenticated requester's institution.
 * The institution is taken from the authenticated staff/admin context ONLY -
 * never from the request body (prevents cross-institution billing).
 */
const getRequesterInstitutionId = (req) => {
  const admin = req.admin;
  const user = req.user;
  if (admin && admin.institution_id) return admin.institution_id;
  if (user && user.institution_id) return user.institution_id;
  return null;
};

/**
 * Canonical generic Service billing endpoint (POST /api/v1/invoices).
 *
 * This is the ONE standardized path for billing a Service from the institution
 * service catalog. It always goes through handleBilling() so a ServiceBill,
 * a draft Invoice (per visit) and - when a claim is supplied - a ClaimItem are
 * created consistently.
 *
 * Security rules:
 *  - service_type is always 'Service' and service_id is the catalog Service id.
 *  - The unit price comes ONLY from Service.cost on the server.
 *  - Client-supplied prices (unit_price, total_amount, nhia_amount,
 *    patient_amount, payment_status, has_paid) are NEVER trusted.
 *  - The institution comes from the authenticated user, never the body.
 *  - visit_id is resolved to the patient's current Active visit (or created)
 *    because ServiceBill.visit_id is NOT NULL.
 *
 * Accepted payloads (single service or array):
 *   { patient_id, service_id, quantity?, visit_id?, department_id?, claim_id?, notes? }
 *   { patient_id, visit_id?, services: [{ service_id, quantity?, department_id?, claim_id? }], notes? }
 */
exports.createInvoice = async (req, res) => {
  const transaction = await Invoice.sequelize.transaction();
  try {
    const requesterInstitutionId = getRequesterInstitutionId(req);
    if (!requesterInstitutionId) {
      await transaction.rollback();
      return res.status(401).json({ success: false, message: 'Authentication required: unable to determine institution' });
    }

    const body = req.body || {};
    const patient_id = body.patient_id;
    const notes = body.notes;

    // Build the list of catalog services to bill
    let items = [];
    if (body.service_id) {
      items = [{
        service_id: body.service_id,
        quantity: body.quantity,
        department_id: body.department_id,
        claim_id: body.claim_id || null,
      }];
    } else if (Array.isArray(body.services) && body.services.length > 0) {
      items = body.services.map((s) => ({
        service_id: s.service_id || s.id,
        quantity: s.quantity,
        department_id: s.department_id || body.department_id,
        claim_id: s.claim_id || body.claim_id || null,
      }));
    }

    if (!patient_id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'patient_id is required' });
    }
    if (items.length === 0 || items.some((i) => !i.service_id)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'service_id is required (single service) or a non-empty services[] array with service_id per item. Free-form manual pricing is not supported.',
      });
    }

    // Resolve and verify the patient belongs to the requester's institution
    const patient = await Patient.findByPk(patient_id, { transaction });
    if (!patient) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    if (patient.institution_id !== requesterInstitutionId) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Patient does not belong to your institution' });
    }

    // Resolve visit_id: use the supplied visit if it matches, otherwise fall
    // back to the patient's most recent Active visit; create one if none exists.
    let visitId = body.visit_id || null;
    if (visitId) {
      const visit = await Visit.findByPk(visitId, { transaction });
      if (!visit) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Visit not found' });
      }
      if (visit.patient_id !== patient.id || visit.institution_id !== requesterInstitutionId) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Visit does not belong to this patient/institution' });
      }
    } else {
      const activeVisit = await Visit.findOne({
        where: { patient_id: patient.id, institution_id: requesterInstitutionId, status: 'Active' },
        order: [['createdAt', 'DESC']],
        transaction,
      });
      if (activeVisit) {
        visitId = activeVisit.id;
      } else {
        const newVisit = await Visit.create({
          patient_id: patient.id,
          institution_id: requesterInstitutionId,
          status: 'Active',
          visit_date: new Date(),
          attendance_type: 'New',
          visit_type: 'General OPD',
        }, { transaction });
        visitId = newVisit.id;
      }
    }

    // Bill every catalog service through the canonical pipeline
    const billingResults = [];
    for (const item of items) {
      const service = await Service.findByPk(item.service_id, { transaction });
      if (!service) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: `Service with ID ${item.service_id} not found` });
      }
      if (service.institution_id !== requesterInstitutionId) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Service does not belong to your institution' });
      }

      // Server-side price ONLY - client-supplied prices are never read here.
      const unitPrice = service.is_free ? 0 : (parseFloat(service.cost) || 0);
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);

      billingResults.push(await handleBilling({
        transaction,
        patient_id: patient.id,
        visit_id: visitId,
        service_id: service.id,
        service_type: 'Service',
        description: service.description || service.name,
        unit_price: unitPrice,
        nhia_unit_price: 0,
        quantity,
        department_id: item.department_id || null,
        admin_id: (req.admin && req.admin.id) || null,
        claim_id: item.claim_id || null,
        institution_id: requesterInstitutionId,
      }));
    }

    // J8: fetch the final invoice data BEFORE commit so a query failure rolls
    // back instead of leaving a committed invoice behind (which previously
    // caused frontend retries and duplicate invoices).
    const completeInvoice = await Invoice.findOne({
      where: { visit_id: visitId, status: 'draft' },
      include: [
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] },
        { model: Institution, as: 'institution' },
        { model: Staff, as: 'creator' },
        { model: ServiceBill, as: 'service_bills' }
      ],
      transaction
    });

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        invoice: completeInvoice,
        visit_id: visitId,
        billing: billingResults,
      },
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

    const whereClause = { id };
    if (institutionId) {
      whereClause.institution_id = institutionId;
    }

    const invoice = await Invoice.findOne({
      where: whereClause
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

    const whereClause = { id };
    if (institutionId) {
      whereClause.institution_id = institutionId;
    }

    const invoice = await Invoice.findOne({
      where: whereClause,
      include: [
        { 
          model: Visit, as: 'visit', 
          include: [
            { model: Patient, as: 'patient' },
            { model: Institution, as: 'institution', attributes: ['id', 'name'] }
          ] 
        }
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

    const institutionName = invoice.visit?.institution?.name || 'Hospital';
    const patientName = invoice.visit?.patient?.first_name || 'Patient';
    const totalAmount = parseFloat(invoice.total_amount || 0).toFixed(2);
    const amountPaid = parseFloat(invoice.amount_paid || 0).toFixed(2);
    const balanceDue = parseFloat(invoice.balance_due || 0).toFixed(2);
    const ref = invoice.reference || invoice.invoice_number;

    const message = `${institutionName}: Dear ${patientName}, your invoice ${invoice.invoice_number} | Total: GHS ${totalAmount} | Paid: GHS ${amountPaid} | Balance: GHS ${balanceDue} | Ref: ${ref} | View and pay: ${invoiceUrl}`;

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
