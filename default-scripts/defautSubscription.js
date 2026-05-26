const Subscription = require("../models/subscription");

const defaultSubscription = {
    name: 'Free Trial',
    price: 0.0,
    duration: 30, // 1 month
    features: ['Access to basic features'],
    status: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const createDefaultSubscription = async () => {
    try {
        // Check if a subscription already exists in the database
        const existingSubscription = await Subscription.findOne({ where: { name: 'Free Trial' } });
        if (!existingSubscription) { 
            // Create the default subscription
            await Subscription.create(defaultSubscription);
            console.log('Default Subscription created');
        } else {
            console.log('Default Subscription already exists');
        }
    } catch (error) {
        console.error('Error creating Default Subscription:', error);
    }
};

module.exports = createDefaultSubscription;
