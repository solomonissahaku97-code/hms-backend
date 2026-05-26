const PaymentMethod = require("../models/PaymentMethod");
const PaymentGateWay = require('../models/PaymentGateWays');
// Create a new payment method
exports.createPaymentMethod = async (req, res) => {
    try {
        const { institution_id, admin_id, method_name, is_active } = req.body;

        // Create a new PaymentMethod
        const paymentMethod = await PaymentMethod.create({
            institution_id,
            admin_id,
            method_name,
            is_active
        });

        return res.status(201).json({
            success: true,
            message: 'Payment method created successfully',
            data: paymentMethod
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error creating payment method',
            error: error.message
        });
    }
};

// Get all payment methods
exports.getPaymentMethods = async (req, res) => {
    const { institution_id } = req.query
    if (!institution_id) return res.status(404).json({error:'institution id not found'})

    try {
        const paymentMethods = await PaymentMethod.findAll(
            {
            where:{institution_id:institution_id},
            include:[
                {
                    model:PaymentGateWay,
                    as:'payment_gateway'
                }
            ]
            });
        
        if(!paymentMethods) return res.status(500).json({error:'An error occurred'})

        return res.status(200).json({
            success: true,
            data: paymentMethods
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching payment methods',
            error: error.message
        });
    }
};

// Get a single payment method by ID
exports.getPaymentMethodById = async (req, res) => {
    try {
        const { id } = req.params;
        const paymentMethod = await PaymentMethod.findByPk(id);

        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: 'Payment method not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: paymentMethod
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching payment method',
            error: error.message
        });
    }
};

// Delete a payment method by ID
exports.deletePaymentMethod = async (req, res) => {
    try {
        const { id } = req.query;
        const paymentMethod = await PaymentMethod.findByPk(id);

        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: 'Payment method not found'
            });
        }

        await paymentMethod.destroy();

        return res.status(200).json({
            success: true,
            message: 'Payment method deleted successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error deleting payment method',
            error: error.message
        });
    }
};



exports.createPaymentGateWay = async (req, res) => {
    try {
        const { name, payment_link, description } = req.body;
        const paymentGateWay = await PaymentGateWay.create({ name, payment_link, description });
        res.status(201).json({ message: 'Payment gateway created successfully', paymentGateWay });
    } catch (error) {
        res.status(500).json({ message: 'Error creating payment gateway', error: error.message });
    }
};


// Get all payment gateways
exports. getPaymentGateWays = async (req, res) => {
    try {
        const paymentGateWays = await PaymentGateWay.findAll();
        res.status(200).json(paymentGateWays);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching payment gateways', error: error.message });
    }
}

// Delete a payment gateway by ID
exports.deletePaymentGateWay = async (req, res) => {
    try {
        const { id } = req.params;
        const paymentGateWay = await PaymentGateWay.findByPk(id);
        
        if (!paymentGateWay) {
            return res.status(404).json({ message: 'Payment gateway not found' });
        }

        await paymentGateWay.destroy();
        res.status(200).json({ message: 'Payment gateway deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting payment gateway', error: error.message });
    }
};
