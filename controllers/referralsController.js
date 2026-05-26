const { Referrals } = require('../models');
const { Institution } = require('../models');
const Joi = require('joi');

// Define Joi schema for validation
const referrerIdSchema = Joi.object({
    referrerId: Joi.number().integer().required().messages({
        'number.base': 'Referrer ID must be a number',
        'number.integer': 'Referrer ID must be an integer',
        'any.required': 'Referrer ID is required'
    })
});

const referralController = {
    // Get referrals by referrerId with validation
    getReferralsByReferrerId: async (req, res) => {
        const { referrerId } = req.query;

        // Validate referrerId using Joi
        const { error } = referrerIdSchema.validate({ referrerId: parseInt(referrerId, 10) });
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        try {
            const referrals = await Referrals.findAll({
                where: { referrerId },
                include: [
                    {
                        model: Institution,
                        as: 'referrer',
                        attributes: ['id', 'name'] // Adjust fields as needed
                    },
                    {
                        model: Institution,
                        as: 'referred',
                        
                    }
                ]
            });
            // if (!referrals.length) {
            //     return res.status(200).json({ message: 'No referrals found for this referrer' });
            // }
            res.status(200).json(referrals);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching referrals', error });
        }
    }
};

module.exports = referralController;
