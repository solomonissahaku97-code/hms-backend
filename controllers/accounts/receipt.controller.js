const { Invoice, Patient, Institution, Receipt, Visit } = require('../../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sendSMS } = require('../../service/smsService');

// Generate receipt for an invoice payment
exports.generateReceipt = async (req, res) => {
    const transaction = await Invoice.sequelize.transaction();
    try {
        const { invoice_id } = req.params;
        const { phone_number, payment_method, notes } = req.body;
        const institutionId = req.body.institution_id || req.admin?.institution_id;

        if (!invoice_id) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'invoice_id is required' });
        }

        const invoice = await Invoice.findOne({
            where: { id: invoice_id, institution_id: institutionId },
            include: [
                { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] }
            ]
        });

        if (!invoice) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        if (invoice.balance_due <= 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Invoice is already fully paid' });
        }

        const patientPhone = phone_number || invoice.visit?.patient?.phone;
        if (!patientPhone) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Patient phone number is required' });
        }

        const receiptNumber = `RCP-${Date.now().toString().slice(-8)}`;
        const token = uuidv4();

        const receipt = await Receipt.create({
            receipt_number: receiptNumber,
            invoice_id: invoice.id,
            patient_id: invoice.visit?.patient?.id,
            institution_id: invoice.institution_id,
            amount_paid: invoice.balance_due,
            payment_method: payment_method || 'cash',
            notes: notes || '',
            token: token,
            sms_sent: false
        }, { transaction });

        // Update invoice
        invoice.amount_paid = parseFloat(invoice.amount_paid) + parseFloat(invoice.balance_due);
        invoice.balance_due = 0;
        invoice.status = 'paid';
        invoice.payment_method = payment_method || 'cash';
        await invoice.save({ transaction });

        await transaction.commit();

        res.status(201).json({
            success: true,
            message: 'Receipt generated successfully',
            data: receipt
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error generating receipt:', error);
        res.status(500).json({ success: false, message: 'Failed to generate receipt', error: error.message });
    }
};

// Send receipt SMS to patient
exports.sendReceiptSMS = async (req, res) => {
    try {
        const { receipt_id } = req.params;
        const institutionId = req.body.institution_id || req.admin?.institution_id;

        const receipt = await Receipt.findOne({
            where: { id: receipt_id, institution_id: institutionId },
            include: [
                { 
                    model: Patient, 
                    as: 'patient',
                    required: false
                }
            ]
        });

        if (!receipt) {
            return res.status(404).json({ success: false, message: 'Receipt not found' });
        }

        if (!receipt.patient?.phone) {
            return res.status(400).json({ success: false, message: 'Patient phone number not found' });
        }

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const receiptUrl = `${baseUrl}/receipts/${receipt.token}`;

        const message = `Payment Receipt: You have paid GHS ${receipt.amount_paid.toFixed(2)} for invoice. View receipt: ${receiptUrl}`;

        await sendSMS(receipt.patient.phone, message);

        receipt.sms_sent = true;
        receipt.sms_sent_at = new Date();
        await receipt.save();

        res.status(200).json({
            success: true,
            message: 'SMS sent successfully',
            data: {
                phone: receipt.patient.phone,
                receipt_url: receiptUrl
            }
        });
    } catch (error) {
        console.error('Error sending receipt SMS:', error);
        res.status(500).json({ success: false, message: 'Failed to send SMS', error: error.message });
    }
};

// View receipt by token (public endpoint for patients)
exports.viewReceipt = async (req, res) => {
    try {
        const { token } = req.params;

        const receipt = await Receipt.findOne({
            where: { token },
            include: [
                { 
                    model: Patient, 
                    as: 'patient',
                    required: false
                },
                {
                    model: Institution,
                    as: 'institution',
                    required: false
                }
            ]
        });

        if (!receipt) {
            return res.status(404).json({ success: false, message: 'Receipt not found' });
        }

        receipt.viewed_count = receipt.viewed_count + 1;
        receipt.viewed_at = new Date();
        await receipt.save();

        res.status(200).json({
            success: true,
            data: receipt
        });
    } catch (error) {
        console.error('Error viewing receipt:', error);
        res.status(500).json({ success: false, message: 'Failed to view receipt', error: error.message });
    }
};

// Get receipt details by token (for frontend page)
exports.getReceiptByToken = async (req, res) => {
    try {
        const { token } = req.params;

        const receipt = await Receipt.findOne({
            where: { token },
            include: [
                { 
                    model: Patient, 
                    as: 'patient',
                    required: false,
                    attributes: ['id', 'first_name', 'last_name', 'folder_number', 'phone']
                },
                {
                    model: Institution,
                    as: 'institution',
                    required: false,
                    attributes: ['id', 'name', 'address', 'contact', 'email']
                },
                {
                    model: Invoice,
                    as: 'invoice',
                    required: false,
                    attributes: ['id', 'invoice_number', 'invoice_date', 'due_date', 'total_amount', 'status']
                }
            ]
        });

        if (!receipt) {
            return res.status(404).json({ success: false, message: 'Receipt not found' });
        }

        receipt.viewed_count = (receipt.viewed_count || 0) + 1;
        receipt.viewed_at = new Date();
        await receipt.save();

        res.status(200).json({
            success: true,
            data: receipt
        });
    } catch (error) {
        console.error('Error getting receipt:', error);
        res.status(500).json({ success: false, message: 'Failed to get receipt', error: error.message });
    }
};

// Get all receipts for an institution
exports.getInstitutionReceipts = async (req, res) => {
    try {
        const institutionId = req.body.institution_id || req.admin?.institution_id;
        const { page = 1, limit = 20, patient_id } = req.query;

        const where = { institution_id: institutionId };
        if (patient_id) {
            where.patient_id = patient_id;
        }

        const receipts = await Receipt.findAndCountAll({
            where,
            include: [
                { 
                    model: Patient, 
                    as: 'patient',
                    required: false,
                    attributes: ['id', 'first_name', 'last_name', 'folder_number', 'phone']
                },
                {
                    model: Invoice,
                    as: 'invoice',
                    required: false,
                    attributes: ['id', 'invoice_number', 'invoice_date', 'total_amount']
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        res.status(200).json({
            success: true,
            data: receipts.rows,
            pagination: {
                total: receipts.count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(receipts.count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching receipts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch receipts', error: error.message });
    }
};
