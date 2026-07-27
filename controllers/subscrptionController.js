const Institution = require('../models/institution');
const InstitutionSubscription = require('../models/InstitutionSubscription');
const Subscription = require('../models/subscription');
const { initiatePayment, verifyPayment } = require('../utils/paystack');
const { sequelize } = require('../models'); // Assuming Sequelize is configured here
const Payment = require('../models/Payment');
const SUBSCRIPTION_FEATURES = require('../config/subscriptionFeatures'); 
const VALID_FEATURE_KEYS = Object.keys(SUBSCRIPTION_FEATURES); 

// Normalize/validate the incoming features array against the known catalog.
// Unknown keys are dropped; always returns a plain array of valid string keys.
const normalizeFeatures = (features) => {
    if (!Array.isArray(features)) return [];
    return features.filter((f) => typeof f === 'string' && VALID_FEATURE_KEYS.includes(f.trim()));
};

// Controller to create a subscription
const createSubscription = async (req, res) => {
    try {
        const { name, price, duration, features, isActive } = req.body;

        const subscription = await Subscription.create({
            name,
            price,
            duration,
            features: normalizeFeatures(features),
            status: typeof isActive === 'boolean' ? isActive : true,
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
        const {id, name, price, duration, features, isActive } = req.body;

        const subscription = await Subscription.findByPk(id);
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        const updates = { name, price, duration, features: normalizeFeatures(features) };
        if (typeof isActive === 'boolean') {
            updates.status = isActive;
        }

        await subscription.update(updates);

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
        console.error('Error initiating subscription:', error.message);
        // Return the actual error message from Paystack for better debugging
        res.status(500).json({ error: error.message || 'Failed to initiate subscription' });
    }
};



const paystackCallback = async (req, res) => {
    const { reference } = req.query;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    try {
        console.log('Reference received:', reference);
        const paymentData = await verifyPayment(reference);
        console.log('Payment Data:', paymentData);

        if (paymentData.data.status !== 'success') {
            return res.redirect(`${FRONTEND_URL}/admin/subscription?status=failed&reference=${reference}`);
        }

        console.log('meta data printing ==', paymentData.data.metadata);

        const { subscriptionId, email, institutionId, admin_id } = paymentData.data.metadata;
        if (!subscriptionId || !email || !institutionId) {
            return res.redirect(`${FRONTEND_URL}/admin/subscription?status=failed&reference=${reference}`);
        }

        const transaction = await sequelize.transaction();

        try {
            const subscription = await Subscription.findByPk(subscriptionId);
            if (!subscription) {
                await transaction.rollback();
                return res.redirect(`${FRONTEND_URL}/admin/subscription?status=failed&reference=${reference}`);
            }

            const subscribe_institution = await Institution.findByPk(institutionId);
            const institution_subscription = await InstitutionSubscription.findOne({ where: { institutionId } });

            if (!subscribe_institution || !institution_subscription) {
                await transaction.rollback();
                return res.redirect(`${FRONTEND_URL}/admin/subscription?status=failed&reference=${reference}`);
            }

            const newExpiryDate = subscription.duration
              ? new Date(Date.now() + subscription.duration * 24 * 60 * 60 * 1000)
              : null;

            await subscribe_institution.update({ subscriptionId }, { transaction });
            await institution_subscription.update({ subscriptionId, expiryDate: newExpiryDate }, { transaction });

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

            console.log(paymentData);

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

            await transaction.commit();

            return res.redirect(`${FRONTEND_URL}/admin/subscription?status=success&reference=${reference}`);
        } catch (error) {
            console.log('Error in Paystack callback:', error);
            if (transaction && !transaction.finished) {
                await transaction.rollback();
            }
            return res.redirect(`${FRONTEND_URL}/admin/subscription?status=failed&reference=${reference}`);
        }
    } catch (error) {
        console.error('Error in Paystack callback:', error);
        return res.redirect(`${FRONTEND_URL}/admin/subscription?status=failed&reference=${reference}`);
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


const deleteSubscription = async (req, res) => {
    const { id } = req.params;

    try {
        const subscription = await Subscription.findByPk(id);
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        // Prevent deleting a plan that institutions are still actively subscribed to
        const linkedSubs = await InstitutionSubscription.findOne({ where: { subscriptionId: id } });
        if (linkedSubs) {
            return res.status(409).json({
                error: 'Cannot delete this plan because institutions are still subscribed to it.',
            });
        }

        await subscription.destroy();

        res.status(200).json({
            message: 'Subscription deleted successfully!',
        });
    } catch (error) {
        console.error('Error deleting subscription:', error);
        res.status(500).json({ error: 'Failed to delete subscription' });
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
    deleteSubscription,
};
