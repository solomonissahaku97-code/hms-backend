const moment = require('moment');
const Institution = require('../models/institution');
const InstitutionSubscription = require('../models/InstitutionSubscription');

const checkTrialStatus = async (req, res, next) => {
    try {
        // Identify the user (Admin or Staff)
        const user = req.user || req.admin; // Assuming the logged-in user is stored in `req.user`

        if (!user || !user.institution_id) {
            console.log(req);
            return res.status(403).json({ message: 'Unauthorized access.' });
        }

        // Fetch institution details
        const institution = await Institution.findByPk(user.institution_id);

        if (!institution) {
            return res.status(403).json({ message: 'Institution not found.' });
        }

        // Fetch subscription details for the institution
        const subscription = await InstitutionSubscription.findOne({
            where: { institutionId: user.institution_id },
            order: [['createdAt', 'DESC']], // Get the most recent subscription
        });

        if (subscription) {
            // Check subscription status
            const isSubscriptionActive = moment().isBefore(subscription.expiryDate); // Replace with your subscription expiry field
            if (isSubscriptionActive) {
                return next();
            }
        }

        // Check trial period
        const createdAt = institution.createdAt; // Assuming `createdAt` is the institution's creation date
        const trialPeriodEnd = moment(createdAt).add(30, 'days');
        const isTrialActive = moment().isBefore(trialPeriodEnd);

        if (isTrialActive) {
            return next();
        }

        // Trial and subscription expired
        return res.status(403).json({
            message: 'Your free trial has expired. Please upgrade to continue using the service.',
        });
    } catch (error) {
        console.error('Error checking trial status:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

module.exports = checkTrialStatus;
