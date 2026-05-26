const InstitutionSubscription = require("../models/InstitutionSubscription");
const Subscription = require("../models/subscription");

// Helper function to handle referral discount
exports.handleReferralDiscount = async (referrer, transaction) => {
    // Check the referrer's current subscription type
    const referrerSubscription = await InstitutionSubscription.findOne({ where: { institutionId: referrer.id } }, { transaction });

    if (referrerSubscription) {
        // If on a paid plan, reduce subscription fee by 10%
        const subscription = await Subscription.findByPk(referrerSubscription.subscriptionId, { transaction });
        if (subscription.name !== 'Free Trial') {
            const discountAmount = subscription.price * 0.1;
            subscription.price -= discountAmount;
            await subscription.save({ transaction });
        } else {
            // Log the referral and track it for future use when switching to a paid plan
            console.log(`Referral by institution on free plan, id: ${referrer.id}`);
        }
    }
};