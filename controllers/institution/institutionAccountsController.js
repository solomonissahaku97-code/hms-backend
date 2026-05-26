const InstitutionSubAccounts = require('../../models/InsitutionSubAccounts'); 
const Transaction = require('../../models/Transactions');
const { createSubAccount, initiatePayment } = require('../../utils/paystack'); 
const QRCode = require('qrcode');
const sequelize = require('../../config/database'); // Adjust the path to your Sequelize instance

const setupInstitutionAccount = async (req, res) => {
    const {
        business_name,
        settlement_bank,
        account_number,
        primary_contact_name,
        primary_contact_email,
        primary_contact_phone,
        percentage_charge,
        initial_payment_amount,
        admin_email,
        institution_id
    } = req.body;

    console.log(req.body);

    // Validate required fields
    if (!business_name || !settlement_bank || !account_number || !primary_contact_name || !primary_contact_email || !primary_contact_phone || !institution_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const transaction = await sequelize.transaction(); // Start a Sequelize transaction

    try {
        // Prepare metadata
        const metadata = {
            institution_id,
            created_at: new Date(),
        };

        // 1. Create sub-account in Paystack (Bank accounts only)
        const subAccountData = {
            business_name,
            settlement_bank,
            account_number,
            percentage_charge,
            primary_contact_name,
            primary_contact_email,
            primary_contact_phone,
            metadata
        };

        const subAccount = await createSubAccount(subAccountData);

        if (!subAccount) {
            throw new Error('Failed to create sub-account');
        }

        // 2. Save sub-account details in the database
        const savedSubAccount = await InstitutionSubAccounts.create({
            subaccount_code: subAccount.subaccount_code,
            business_name: subAccount.business_name,
            settlement_bank: subAccount.settlement_bank,
            account_number: subAccount.account_number,
            primary_contact_name: subAccount.primary_contact_name,
            primary_contact_email: subAccount.primary_contact_email,
            primary_contact_phone: subAccount.primary_contact_phone,
            percentage_charge: subAccount.percentage_charge,
            metadata: subAccount.metadata,
            paystack_id: subAccount.id,
            domain: subAccount.domain,
            description: subAccount.description,
            institution_id
        }, { transaction });

        let transactionData = null;

        // 3. If an initial payment is required, initiate the transaction
        if (initial_payment_amount && admin_email) {
            const paymentMetadata = {
                institution_id: savedSubAccount.id,
                setup_fee: true
            };

            const paymentResponse = await initiatePayment(
                initial_payment_amount,
                admin_email,
                paymentMetadata,
                savedSubAccount.subaccount_code
            );

            if (paymentResponse.status !== 'success') {
                throw new Error('Failed to initiate payment');
            }

            const { authorization_url, reference } = paymentResponse;

            // Save transaction record in the database
            const paymentRecord = await Transaction.create({
                institution_id: savedSubAccount.id,
                amount: initial_payment_amount,
                status: 'pending',
                paystack_reference: reference,
                metadata: paymentMetadata
            }, { transaction });

            // Generate QR Code for the payment link
            const qrCodeData = await QRCode.toDataURL(authorization_url);

            transactionData = {
                message: 'Initial payment initiated successfully',
                qrCodeData,
                authorization_url,
                paymentRecord
            };
        }

        await transaction.commit(); // Commit the transaction if everything is successful

        return res.status(201).json({
            message: 'Institution account setup successfully',
            subAccount: savedSubAccount,
            transaction: transactionData
        });

    } catch (error) {
        await transaction.rollback(); // Rollback if any error occurs
        console.error('Error setting up institution account:', error);
        return res.status(500).json({ error: error.message || 'An error occurred while setting up the institution account' });
    }
};






const initiatePaymentToInstitution = async (req, res) => {
    const { amount, email, institution_id, patient_id } = req.body;

    // Basic validation
    if (!amount || !email || !institution_id || !patient_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Find the institution's sub-account using the institution_id
        const institutionSubAccount = await InstitutionSubAccounts.findOne({
            where: { id: institution_id }, // Assuming paystack_id is used to link to the institution
        });

        if (!institutionSubAccount) {
            return res.status(404).json({ error: 'Institution sub-account not found' });
        }

        // Metadata to include in the payment
        const metadata = {
            institution_id,
            patient_id,
        };


        // Initiate payment to the institution's sub-account
        const paymentResponse = await initiatePayment(
            amount,
            email,
            metadata,
            institutionSubAccount.subaccount_code // Pass the subaccount_code
        );

        if (paymentResponse.status === 'success') {
            const { authorization_url } = paymentResponse;
            // Save payment details into the database
            const paymentRecord = await Transaction.create({
                patient_id,
                institution_id,
                amount,
                status: 'pending', // Default status
                paystack_reference: reference,
                metadata,
            });

            // Generate QR Code
            const qrCodeData = await QRCode.toDataURL(authorization_url);

            return res.status(200).json({
                message: 'Payment initialized successfully',
                qrCodeData, // Send QR Code data to frontend
                authorization_url, // Send authorization URL to frontend
                paymentRecord
            });
        } else {
            return res.status(400).json({ error: 'Payment initiation failed', details: paymentResponse });
        }
    } catch (error) {
        console.error('Error initiating payment:', error);
        return res.status(500).json({ error: 'An error occurred while processing the payment' });
    }
};


const verifyPayment = async (req, res) => {
    try {
        const { reference } = req.body;
        const paymentResponse = await verifyPayment(reference);
        if (paymentResponse.status === 'success') {
            const { status, amount, currency, reference, paid_at } = paymentResponse;
            const transaction = await Transaction.findOne({ where: { paystack_reference: reference } });
            if (transaction) {
                transaction.status = status;
                transaction.amount = amount;
                transaction.currency = currency;
                transaction.paid_at = paid_at;
                await transaction.save();
                return res.status(200).json({ message: 'Payment verified successfully' });
            } else {
                return res.status(404).json({ error: 'Transaction not found' });
            }
        } else {
            return res.status(400).json({
                error: 'Payment verification failed', details: paymentResponse
            });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({
            error: 'An error occurred while verifying the payment'
        });
    }
}



module.exports = {
    setupInstitutionAccount,
    initiatePaymentToInstitution,
    verifyPayment
};