const express = require('express');
const router = express.Router();
const { createSubscription, initiateSubscription, paystackCallback, getAllSubscriptions,
    getInstitutionSubscription,updateSubscription } = require('../controllers/subscrptionController');

// Route to create a new subscription
router.post('/subscriptions', createSubscription);

router.put('/subscription/update',updateSubscription)


router.get('/subscriptions', getAllSubscriptions);
router.get('/subscriptions/institution', getInstitutionSubscription);

// Route to initiate subscription (Paystack payment)
router.post('/subscriptions/subscribe', initiateSubscription);

// Route to handle Paystack callback and verify payment
router.get('/subscriptions/paystack/callback', paystackCallback);



module.exports = router;
