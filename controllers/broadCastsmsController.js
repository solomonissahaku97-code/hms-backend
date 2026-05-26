const Joi = require('joi');
const SmsSubscriptions = require('../models/SmsSubscriptions');
const Patients = require('../models/patient');
const  {sendSMS}  = require('../service/smsService')

// Validation Schema using Joi
const departmentBroadcastSchema = Joi.object({
  department_id: Joi.string().required(),
  institution_id: Joi.string().required(),
});

const patientBroadcastSchema = Joi.object({
  department_id: Joi.string().optional(),
  all: Joi.boolean().required(),
  institution_id: Joi.string().required(),
});

const bulkSmsSchema = Joi.object({
  institution_id: Joi.string().required(),
  phone_numbers: Joi.array().items(Joi.string().pattern(/^[0-9]{10,15}$/)).required(),
  message: Joi.string().required(),
});


const sendDepartmentBroadcast = async (req, res) => {
  const { department_id, institution_id } = req.body;

  // Validate request
  const { error } = departmentBroadcastSchema.validate({ department_id, institution_id });
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    // Check SMS subscription
    const smsSubscription = await SmsSubscriptions.findOne({
      where: { institution_id: institution_id },
    });

    if (!smsSubscription) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    const { total_sms, sms_used, extra_sms_purchased } = smsSubscription;
    const availableSms = total_sms - sms_used + extra_sms_purchased;

    if (availableSms <= 0) {
      return res.status(400).json({ message: 'Insufficient SMS balance' });
    }

    // Fetch patients in the department
    const patients = await Patients.findAll({
      where: { department_id: department_id },
    });

    for (const patient of patients) {
      if (patient.phone_number) {
        const response = await sendSMS(patient.phone_number, req.body.message);

        if (response.data && response.data.status === 'success') {
          await SmsSubscriptions.update(
            { sms_used: sms_used + 1 },
            { where: { institution_id: institution_id } }
          );
        } else {
          console.log('Failed to send SMS to', patient.phone_number, response.data);
        }
      }
    }

    res.status(200).json({ message: 'Department broadcast sent successfully' });
  } catch (error) {
    console.error('Error in sendDepartmentBroadcast:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};




const sendPatientBroadcast = async (req, res) => {
  const { department_id, all, institution_id } = req.body;

  // Validate request
  const { error } = patientBroadcastSchema.validate({ department_id, all, institution_id });
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    // Check SMS subscription
    const smsSubscription = await SmsSubscriptions.findOne({
      where: { institution_id: institution_id },
    });

    if (!smsSubscription) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    const { total_sms, sms_used, extra_sms_purchased } = smsSubscription;
    const availableSms = total_sms - sms_used + extra_sms_purchased;

    if (availableSms <= 0) {
      return res.status(400).json({ message: 'Insufficient SMS balance' });
    }

    let patients;
    if (all) {
      // Fetch all patients
      patients = await Patients.findAll();
    } else if (department_id) {
      // Fetch patients in the specific department
      patients = await Patients.findAll({
        where: { department_id: department_id },
      });
    }

    for (const patient of patients) {
      if (patient.phone_number) {
        const response = await sendSMS(patient.phone_number, req.body.message);

        if (response.data && response.data.status === 'success') {
          await SmsSubscriptions.update(
            { sms_used: sms_used + 1 },
            { where: { institution_id: institution_id } }
          );
        } else {
          console.log('Failed to send SMS to', patient.phone_number, response.data);
        }
      }
    }

    res.status(200).json({ message: 'Patient broadcast sent successfully' });
  } catch (error) {
    console.error('Error in sendPatientBroadcast:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const sendBulkSMS = async (req, res) => {
  const { institution_id, phone_numbers, message } = req.body;

  // Validate request
  const { error } = bulkSmsSchema.validate({ institution_id, phone_numbers, message });
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    // Check SMS subscription
    const smsSubscription = await SmsSubscriptions.findOne({
      where: { institution_id: institution_id },
    });

    if (!smsSubscription) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    const { total_sms, sms_used, extra_sms_purchased } = smsSubscription;
    const availableSms = total_sms - sms_used + extra_sms_purchased;

    if (availableSms < phone_numbers.length) {
      return res.status(400).json({ message: 'Insufficient SMS balance' });
    }

    // Send SMS to each number in the list
    for (const number of phone_numbers) {
      await sendSMS(number, message);
      await SmsSubscriptions.update(
        { sms_used: sms_used + 1 },
        { where: { institution_id: institution_id } }
      );
    }

    res.status(200).json({ message: 'Bulk SMS sent successfully' });
  } catch (error) {
    console.error('Error in sendBulkSMS:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { sendDepartmentBroadcast, sendPatientBroadcast,sendBulkSMS };
