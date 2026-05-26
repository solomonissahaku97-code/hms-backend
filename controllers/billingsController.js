// controllers/invoiceController.js
const { Invoice, Visit, Institution, Staff } = require('../models');

exports.createInvoice = async (req, res) => {
    try {
        const {
            visit_id,
            institution_id,
            invoice_number,
            invoice_date,
            due_date,
            subtotal,
            tax_amount,
            discount_amount,
            total_amount,
            amount_paid,
            payment_method,
            notes,
            metadata,
            created_by
        } = req.body;

        // Optional: Validation checks
        if (!visit_id || !institution_id || !invoice_number || !created_by) {
            return res.status(400).json({ message: 'visit_id, institution_id, invoice_number, and created_by are required' });
        }

        // Optional: Check if visit exists
        const visitExists = await Visit.findByPk(visit_id);
        if (!visitExists) {
            return res.status(404).json({ message: 'Visit not found' });
        }

        // Optional: Check if institution exists
        const institutionExists = await Institution.findByPk(institution_id);
        if (!institutionExists) {
            return res.status(404).json({ message: 'Institution not found' });
        }

        // Optional: Check if staff exists
        const staffExists = await Staff.findByPk(created_by);
        if (!staffExists) {
            return res.status(404).json({ message: 'Creator staff not found' });
        }

        // Create Invoice
        const invoice = await Invoice.create({
            visit_id,
            institution_id,
            invoice_number,
            invoice_date: invoice_date || new Date(),
            due_date: due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
            subtotal: subtotal || 0,
            tax_amount: tax_amount || 0,
            discount_amount: discount_amount || 0,
            total_amount: total_amount || 0,
            amount_paid: amount_paid || 0,
            payment_method,
            notes,
            terms_and_conditions,
            metadata: metadata || {},
            created_by
        });

        return res.status(201).json({
            message: 'Invoice created successfully',
            data: invoice
        });

    } catch (error) {
        console.error('Error creating invoice:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
