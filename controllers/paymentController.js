const { Payment, Invoice, ServiceBill, Patient, Visit, Claim, Insurance } = require('../models');
const { processPayment, applyNhisPayment } = require('../utils/billingUtil');
const { v4: uuidv4 } = require('uuid');

// Create a new payment
exports.createPayment = async (req, res) => {
    const transaction = await Invoice.sequelize.transaction();
    
    try {
        const {
            patient_id,
            invoice_id,
            service_bill_id,
            amount,
            payment_method,
            payment_type,
            transaction_reference,
            notes,
            created_by
        } = req.body;

        // Validate required fields
        if (!patient_id || !invoice_id || !amount || !payment_method) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'patient_id, invoice_id, amount, and payment_method are required'
            });
        }

        // Process the payment using the billing utility
        const paymentResult = await processPayment({
            transaction,
            patient_id,
            invoice_id,
            service_bill_id,
            amount: parseFloat(amount),
            payment_method,
            payment_type: payment_type || 'full',
            transaction_reference,
            notes,
            created_by
        });

        await transaction.commit();
        
        return res.status(201).json({
            success: true,
            message: 'Payment processed successfully',
            data: paymentResult
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error processing payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to process payment',
            error: error.message
        });
    }
};

// Get payments for an invoice
exports.getInvoicePayments = async (req, res) => {
    try {
        const { invoice_id } = req.params;

        const payments = await Payment.findAll({
            where: { invoice_id },
            include: [
                { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name'] }
            ],
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json({
            success: true,
            data: payments
        });

    } catch (error) {
        console.error('Error fetching payments:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch payments',
            error: error.message
        });
    }
};

// Get payments for a patient
exports.getPatientPayments = async (req, res) => {
    try {
        const { patient_id } = req.params;

        const payments = await Payment.findAll({
            where: { patient_id },
            include: [
                { model: Invoice, as: 'invoice', attributes: ['id', 'invoice_number', 'total_amount', 'balance_due'] }
            ],
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json({
            success: true,
            data: payments
        });

    } catch (error) {
        console.error('Error fetching patient payments:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch patient payments',
            error: error.message
        });
    }
};

// Get a single payment
exports.getPayment = async (req, res) => {
    try {
        const { payment_id } = req.params;

        const payment = await Payment.findByPk(payment_id, {
            include: [
                { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name'] },
                { model: Invoice, as: 'invoice', attributes: ['id', 'invoice_number', 'total_amount', 'balance_due'] },
                { model: ServiceBill, as: 'serviceBill', attributes: ['id', 'description', 'total_amount'] }
            ]
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: payment
        });

    } catch (error) {
        console.error('Error fetching payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch payment',
            error: error.message
        });
    }
};

// Apply NHIS payment to a claim
exports.applyNhisClaimPayment = async (req, res) => {
    const transaction = await Invoice.sequelize.transaction();
    
    try {
        const { claim_id } = req.params;
        const { amount_paid, payment_reference } = req.body;

        if (!amount_paid) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'amount_paid is required'
            });
        }

        const result = await applyNhisPayment({
            transaction,
            claim_id,
            amount_paid: parseFloat(amount_paid),
            payment_reference
        });

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: 'NHIS payment applied successfully',
            data: result
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error applying NHIS payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to apply NHIS payment',
            error: error.message
        });
    }
};

// Refund a payment
exports.refundPayment = async (req, res) => {
    const transaction = await Payment.sequelize.transaction();
    
    try {
        const { payment_id } = req.params;
        const { reason, processed_by } = req.body;

        const payment = await Payment.findByPk(payment_id, { transaction });
        
        if (!payment) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        if (payment.status === 'refunded') {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Payment already refunded'
            });
        }

        // Update payment status
        payment.status = 'refunded';
        payment.notes = (payment.notes || '') + `\nRefund reason: ${reason}`;
        await payment.save({ transaction });

        // Reverse the payment on the invoice
        const invoice = await Invoice.findByPk(payment.invoice_id, { transaction });
        if (invoice) {
        const currentAmountPaid = parseFloat(invoice.amount_paid) || 0;
        const refundAmount = parseFloat(payment.amount);
        await invoice.update({
            amount_paid: Math.max(0, currentAmountPaid - refundAmount),
            balance_due: parseFloat(invoice.total_amount) - Math.max(0, currentAmountPaid - refundAmount)
        }, { transaction });
        }

        // Reverse on service bill if applicable
        if (payment.service_bill_id) {
            const serviceBill = await ServiceBill.findByPk(payment.service_bill_id, { transaction });
            if (serviceBill) {
                const currentPaid = parseFloat(serviceBill.amount_paid) || 0;
                await serviceBill.update({
                    amount_paid: Math.max(0, currentPaid - parseFloat(payment.amount))
                }, { transaction });
            }
        }

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: 'Payment refunded successfully',
            data: payment
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error refunding payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to refund payment',
            error: error.message
        });
    }
};

// Get payment statistics
exports.getPaymentStats = async (req, res) => {
    try {
        const { institution_id, start_date, end_date } = req.query;

        const where = {};
        
        if (start_date && end_date) {
            where.created_at = {
                $between: [new Date(start_date), new Date(end_date)]
            };
        }

        const totalPayments = await Payment.sum('amount', {
            where: { status: 'completed', ...where }
        });

        const paymentCount = await Payment.count({
            where: { status: 'completed', ...where }
        });

        const paymentsByMethod = await Payment.findAll({
            where: { status: 'completed', ...where },
            attributes: [
                'status',
                [Payment.sequelize.fn('SUM', Payment.sequelize.col('amount')), 'total'],
                [Payment.sequelize.fn('COUNT', Payment.sequelize.col('id')), 'count']
            ],
            group: ['status']
        });

        return res.status(200).json({
            success: true,
            data: {
                total_amount: totalPayments || 0,
                payment_count: paymentCount,
                payments_by_method: paymentsByMethod
            }
        });

    } catch (error) {
        console.error('Error fetching payment stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch payment statistics',
            error: error.message
        });
    }
};

// Verify payment with external gateway
exports.verifyPayment = async (req, res) => {
    try {
        const { reference } = req.body;

        // This would typically call Paystack or other payment gateway
        // For now, return a placeholder response
        
        const payment = await Payment.findOne({
            where: { transaction_reference: reference }
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                payment_id: payment.id,
                status: payment.status,
                amount: payment.amount
            }
        });

    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify payment',
            error: error.message
        });
    }
};

