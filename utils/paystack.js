const axios = require('axios');
require('dotenv').config();
const QRCode = require('qrcode');
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const NODE_ENV = process.env.NODE_ENV || 'development';

const paystackInstance = axios.create({
    baseURL: 'https://api.paystack.co',
    headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
    },
});

const initiatePayment = async (amount, email, metadata, subAccountCode = null) => {
    const callbackUrl = NODE_ENV === 'development'
        ? 'http://localhost:7000/api/v1/subscriptions/paystack/callback'
        : 'https://hms-backend-v1.onrender.com/api/v1/subscriptions/paystack/callback';

    const options = {
        amount: amount * 100, // Convert amount to kobo/pesewas
        email,
        metadata, // Pass metadata
        callback_url: callbackUrl,
    };

    // Add subaccount parameter if provided
    if (subAccountCode) {
        options.subaccount = subAccountCode;
    }

    try {
        const response = await paystackInstance.post('/transaction/initialize', options);
        return response.data.data;
    } catch (error) {
        console.error("Error Response:", error.response?.data || error.message);
        throw new Error('Paystack payment initiation failed');
    }
};

// Verify Payment: Verifies the payment once the user is redirected back from Paystack
const verifyPayment = async (reference) => {
    try {
        const response = await paystackInstance.get(`/transaction/verify/${reference}`);
        return response.data;
    } catch (error) {
        console.error(error);
        throw new Error('Error verifying payment');
    }
};


const createSubAccount = async (institutionDetails) => {
    const paystackCharge = 1.95; // Default transaction fee in percentage

    const options = {
        business_name: institutionDetails.business_name,
        percentage_charge: institutionDetails.percentage_charge || paystackCharge, // Use provided or default charge
        primary_contact_name: institutionDetails.primary_contact_name,
        primary_contact_email: institutionDetails.primary_contact_email,
        primary_contact_phone: institutionDetails.primary_contact_phone,
        metadata: institutionDetails.metadata, // Store additional info
        settlement_bank: institutionDetails.settlement_bank,
        account_number: institutionDetails.account_number,
        bank_code: institutionDetails.bank_code,
    };

    try {
        const response = await paystackInstance.post('/subaccount', options);
        console.log(response.data);
        return response.data.data;
    } catch (error) {
        console.log(error.response?.data || error.message);
        throw new Error('Paystack sub-account creation failed');
    }
};







// Controller for patient payment
const makePaymentForPatient = async (req, res) => {
    const { amount, email, institution_id, patient_id } = req.body;
    try {
        // Meta data
        const metaData = {
            institution_id,
            patient_id,
        };

        // Initiate payment
        const paymentResponse = await initiatePayment(amount, email, metaData);

        if (paymentResponse.status === 'success') {
            const { authorization_url } = paymentResponse;

            // Generate QR Code
            const qrCodeData = await QRCode.toDataURL(authorization_url);

            return res.status(200).json({
                message: 'Payment initialized successfully',
                qrCodeData, // Send QR Code data to frontend
            });
        } else {
            return res.status(400).json({ error: 'Payment initiation failed', details: paymentResponse });
        }
    } catch (error) {
        console.error('Error initiating payment:', error);
        return res.status(500).json({ error: 'An error occurred while processing the payment' });
    }
};




module.exports = {
    initiatePayment,
    verifyPayment,
    createSubAccount,
    makePaymentForPatient,
};
