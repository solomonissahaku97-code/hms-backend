const Institution = require('../models/institution');
const InstitutionSubscription = require('../models/InstitutionSubscription');
const Subscription = require('../models/subscription');
const { initiatePayment, verifyPayment } = require('../utils/paystack');
const { sequelize } = require('../models'); // Assuming Sequelize is configured here
const Payment = require('../models/Payment');

// Controller to create a subscription
const createSubscription = async (req, res) => {
    try {
        const { name, price, duration, features } = req.body;

        const subscription = await Subscription.create({
            name,
            price,
            duration,
            features,
        });

        res.status(201).json({
            message: 'Subscription created successfully!',
            subscription,
        });
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
};

// Controller to update a subscription
const updateSubscription = async (req, res) => {
    try {
        const {id, name, price, duration, features } = req.body;

        const subscription = await Subscription.findByPk(id);
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        await subscription.update({
            name,
            price,
            duration,
            features,
        });

        res.status(200).json({
            message: 'Subscription updated successfully!',
            subscription,
        });
    } catch (error) {
        console.error('Error updating subscription:', error);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
};


const initiateSubscription = async (req, res) => {
    try {
        const { institutionEmail, subscriptionId, admin_id, institutionId } = req.body;

        // Retrieve subscription details
        const subscription = await Subscription.findByPk(subscriptionId);
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        const metadata = {
            subscriptionId,
            email: institutionEmail,
            admin_id: admin_id,
            subscriptionName: subscription.name,
            institutionId: institutionId
        };

        // Initiate payment
        const paymentData = await initiatePayment(subscription.price, institutionEmail, metadata);

        const { authorization_url } = paymentData;

        res.status(200).json({
            message: 'Payment initialized successfully',
            authorization_url,
        });
    } catch (error) {
        console.error('Error initiating subscription:', error);
        res.status(500).json({ error: 'Failed to initiate subscription' });
    }
};



const paystackCallback = async (req, res) => {
    const { reference } = req.query;

    try {
        console.log('Reference received:', reference);
        const newExpiryDate = new Date();
        newExpiryDate.setDate(newExpiryDate.getDate() + 30);

        // Verify payment status from Paystack
        const paymentData = await verifyPayment(reference);
        console.log('Payment Data:', paymentData);

        if (paymentData.data.status !== 'success') {
            return res.status(400).json({ error: 'Payment failed or was unsuccessful' });
        }

        console.log('meta data printing ==', paymentData.data.metadata)

        const { subscriptionId, email, institutionId, admin_id } = paymentData.data.metadata;
        if (!subscriptionId || !email || !institutionId) {
            return res.status(400).json({ error: 'Invalid metadata in payment data' });
        }

        // Start transaction
        const transaction = await sequelize.transaction();

        try {
            // Check subscription
            const subscription = await Subscription.findByPk(subscriptionId);
            if (!subscription) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Subscription not found' });
            }

            // Check institution and its subscription
            const subscribe_institution = await Institution.findByPk(institutionId);
            const institution_subscription = await InstitutionSubscription.findOne({ where: { institutionId } });

            if (!subscribe_institution || !institution_subscription) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Error processing payment: Institution or subscription not found' });
            }

            // Update institution and its subscription
            await subscribe_institution.update({ subscriptionId }, { transaction });
            await institution_subscription.update({ subscriptionId, expiryDate: newExpiryDate, }, { transaction });

            // Save payment data
            const {
                id,
                status,
                amount,
                receipt_number: receiptNumber,
                gateway_response: gatewayResponse,
                paid_at: paidAt,
                channel,
                currency,
                ip_address: ipAddress,
                metadata,
                fees,
                authorization,
            } = paymentData.data;

            console.log(paymentData)

            await Payment.create({
                transactionId: id,
                status,
                amount,
                currency,
                receiptNumber,
                gatewayResponse,
                paidAt,
                channel,
                ipAddress,
                metadata,
                fees,
                authorization,
            }, { transaction });

            // Commit transaction
            await transaction.commit();

            res.status(200).render('success', {
                message: 'Payment successful, subscription updated.',
            });
        } catch (error) {
            console.log('Error in Paystack callback:', error); // Log the actual error
            res.status(500).render('error', {
                message: 'Failed to process Paystack callback. Please try again.',
            });
        }
    } catch (error) {
        console.error('Error in Paystack callback:', error);
        res.status(500).json({ error: 'Failed to process Paystack callback' });
    }
};



const getAllSubscriptions = async (req, res) => {
    try {
        const subscriptions = await Subscription.findAll();

        res.status(200).json({
            message: 'Subscriptions retrieved successfully!',
            subscriptions,
        });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
};


const getInstitutionSubscription = async (req, res) => {
    const { institutionId } = req.query;

    if (!institutionId) {
        return res.status(404).json({ error: 'Institution not found' });
    }

    try {
        // Fetch the active institution subscription
        const active_subscription = await InstitutionSubscription.findOne({
            where: { institutionId },
        });

        if (!active_subscription) {
            return res.status(404).json({ error: 'No active subscription found for the institution' });
        }

        // Fetch the associated subscription
        const subscription_ = await Subscription.findByPk(active_subscription.subscriptionId);

        if (!subscription_) {
            return res.status(404).json({ error: 'Subscription details not found' });
        }

        // Structure the response
        const institutionSubscriptionData = {
            institutionId: active_subscription.institutionId,
            subscriptionId: active_subscription.subscriptionId,
            startDate: active_subscription.startDate,
            expiryDate: active_subscription.expiryDate,
            createdAt: active_subscription.createdAt,
            updatedAt: active_subscription.updatedAt,
            subscription: {
                id: subscription_.id,
                name: subscription_.name,
                price: subscription_.price,
                duration: subscription_.duration,
                features: subscription_.features,
                status: subscription_.status,
                createdAt: subscription_.createdAt,
                updatedAt: subscription_.updatedAt,
            },
        };

        // Send the response
        res.status(200).json({
            message: 'Subscription retrieved successfully!',
            data: institutionSubscriptionData,
        });
    } catch (error) {
        console.error('Error fetching institution subscription:', error);
        res.status(500).json({ error: 'Failed to fetch institution subscription' });
    }
};





module.exports = {
    createSubscription,
    initiateSubscription,
    paystackCallback,
    getAllSubscriptions,
    getInstitutionSubscription,
    updateSubscription,
};
