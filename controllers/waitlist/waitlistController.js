const Joi = require('joi');
const WaitList = require('../../models/Waitlist');
const { sendSMS } = require('../../service/smsService'); // Import your SMS service

// Joi validation schema for phone number only
const waitlistSchema = Joi.object({
  phone_number: Joi.string()
    .pattern(/^\+\d{1,3}\d{9,15}$/) // + followed by country code and 9-15 digits
    .required()
    .messages({
      'string.pattern.base': 'Phone number must start with +[country code] followed by 9-15 digits',
      'string.empty': 'Phone number is required',
    })
});

exports.addWaitList = async (req, res) => {
  const { phone_number } = req.body;

  try {
    // Validate the input using Joi
    const { error } = waitlistSchema.validate({ phone_number });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    // Check if the phone number already exists in the waitlist
    const existingWaitlist = await WaitList.findOne({ 
      where: { phone_number } 
    });
    
    if (existingWaitlist) { 
      return res.status(400).json({
        success: false,
        message: 'This phone number is already on the waitlist.',
      });
    }

    // Save the new waitlist entry
    await WaitList.create({ phone_number });

    // Send welcome SMS
    const message = `Thank you for joining our waitlist! We'll notify you when we launch.`;
    await sendSMS(phone_number, message);

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'You have been added to the waitlist successfully!',
    });
  } catch (error) {
    console.error('Error adding to waitlist:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while adding to the waitlist.',
    });
  }
};