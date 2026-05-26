const Joi = require('joi');
const sendEmail = require('../service/sendEmail');
const Institution = require('../models/institution');
const Admin = require('../models/admin');
const PatientBookings = require('../models/PatientBookings');

// Validation Schema
const bookingSchema = Joi.object({
  full_name: Joi.string().required().messages({ 'string.empty': 'Full name is required.' }),
  consultation_type: Joi.string().valid(
    'General Check-Up',
    'Pediatrics',
    'Cardiology',
    'Dermatology',
    'Gynecology'
  ).required().messages({ 'any.only': 'Invalid consultation type.' }),
  institution_id: Joi.number().integer().required().messages({ 'number.base': 'Institution is required.' }),
  phone_number: Joi.string().pattern(/^[0-9]+$/).required().messages({
    'string.pattern.base': 'Phone number must contain only numbers.',
  }),
  appointment_date: Joi.date().iso().required().messages({ 'date.format': 'Invalid date format.' }),
  start_time: Joi.string()
    .pattern(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i)
    .required()
    .messages({
      "string.pattern.base": "Start time must be in the format h:mm AM/PM.",
    }),
  end_time: Joi.string()
    .pattern(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i)
    .required()
    .messages({
      "string.pattern.base": "End time must be in the format h:mm AM/PM.",
    }),
  additional_message: Joi.string().allow(''),
});

// Controller to add a patient booking
const addPatientBooking = async (req, res) => {
  try {
    // Validate request data
    const { error, value } = bookingSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const {
      full_name,
      consultation_type,
      institution_id,
      phone_number,
      appointment_date,
      start_time,
      end_time,
      additional_message
    } = value;

    // Check if institution exists
    const institution = await Institution.findByPk(institution_id);
    if (!institution) return res.status(404).json({ error: 'Institution not found.' });

    // Find Admin of the Institution
    const admin = await Admin.findOne({ where: { institution_id } });
    if (!admin) return res.status(404).json({ error: 'Admin not found for the selected institution.' });

    // Create booking
    const booking = await PatientBookings.create({
      full_name,
      consultation_type,
      institution_id,
      phone_number,
      appointment_date,
      start_time,
      end_time,
      additional_message,
    });

    // Send email to admin
    await sendEmail(
      admin.email,
      'New Patient Booking Alert',
      'new-booking-email',
      {
        admin,
        patient: {
          name: full_name,
          consultation_type,
          phone_number,
          appointment_date,
          start_time,
          end_time,
          additional_message,
        },
        institution: institution.name,
      }
    );

    res.status(201).json({ message: 'Patient booking created successfully.', booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while creating the booking.' });
  }
};

const getAllInstitutions = async (req, res) => {
  try {
    const institutions = await Institution.findAll({
      // attributes: ['id', 'name',], // Specify fields you want to return
    });

    if (!institutions.length) {
      return res.status(404).json({ message: 'No institutions found.' });
    }

    res.status(200).json({ message: 'Institutions retrieved successfully.', institutions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while retrieving institutions.' });
  }
};

module.exports = { addPatientBooking, getAllInstitutions };
