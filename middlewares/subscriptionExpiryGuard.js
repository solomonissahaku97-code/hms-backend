const moment = require('moment');
const InstitutionSubscription = require('../models/InstitutionSubscription');
const Subscription = require('../models/subscription');

const subscriptionExpiryGuard = async (req, res, next) => {
    try {
        const actor = req.user || req.admin;
        const institutionId = actor?.institution_id || actor?.institutionId;

        if (!institutionId) {
            return res.status(403).json({ message: 'Unauthorized access.', code: 'UNAUTHORIZED' });
        }

        const activeInstitutionSub = await InstitutionSubscription.findOne({
            where: { institutionId },
            order: [['createdAt', 'DESC']],
        });

        if (!activeInstitutionSub) {
            return res.status(403).json({
                message: 'No subscription found. Please subscribe to continue.',
                code: 'SUBSCRIPTION_EXPIRED',
            });
        }

        if (activeInstitutionSub.expiryDate && moment().isAfter(activeInstitutionSub.expiryDate)) {
            return res.status(403).json({
                message: 'Your subscription has expired. Please renew to continue using the service.',
                code: 'SUBSCRIPTION_EXPIRED',
                expiryDate: activeInstitutionSub.expiryDate,
            });
        }

        return next();
    } catch (err) {
        console.error('subscriptionExpiryGuard error:', err);
        return res.status(500).json({ message: 'Internal server error', code: 'SUBSCRIPTION_GUARD_ERROR' });
    }
};

module.exports = subscriptionExpiryGuard;
