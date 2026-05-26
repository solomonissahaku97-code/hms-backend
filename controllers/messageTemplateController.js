const Joi = require("joi");
const Institution = require("../models/institution");
const MessageTemplate = require("../models/MessageTemplates");


const messageTemplateSchema = Joi.object({
  content: Joi.string().required().min(1).max(1000), // Adjust the length as needed
  institution_id: Joi.number().integer().required(),
  title: Joi.string().required().min(1).max(255), // Adjust the length as needed
});

const updateMessageTemplateSchema = Joi.object({
  id: Joi.number().integer().required(),
  content: Joi.string().required().min(1).max(1000),
  institution_id: Joi.number().integer().required(),
  title: Joi.string().required().min(1).max(255),
});

// Validation function for creating/updating
const validateMessageTemplate = (data, isUpdate = false) => {
  return isUpdate
    ? updateMessageTemplateSchema.validate(data, { abortEarly: false })
    : messageTemplateSchema.validate(data, { abortEarly: false });
};

// Create a new message template
exports.createMessageTemplate = async (req, res) => {
  try {
    const { error } = validateMessageTemplate(req.body);
    if (error) {
      return res.status(400).json({ message: 'Validation failed', details: error.details });
    }

    const { content, institution_id, title } = req.body;

    // Create the message template
    const messageTemplate = await MessageTemplate.create({
      content,
      institution_id,
      title,
    });

    res.status(201).json({
      message: 'Message template created successfully',
      data: messageTemplate,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create message template', error: error.message });
  }
};

// Get all message templates
exports.getMessageTemplates = async (req, res) => {
  const { institution_id } = req.query;

  try {
    const messageTemplates = await MessageTemplate.findAll({
      where: { institution_id },
    });
    res.status(200).json({ data: messageTemplates });
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve message templates', error: error.message });
  }
};

// Get a specific message template by ID
exports.getMessageTemplateById = async (req, res) => {
  try {
    const { id, institution_id } = req.params;

    // Validate ID and institution_id
    const schema = Joi.object({
      id: Joi.number().integer().required(),
      institution_id: Joi.number().integer().required(),
    });

    const { error } = schema.validate({ id, institution_id });
    if (error) {
      return res.status(400).json({ message: 'Validation failed', details: error.details });
    }

    const messageTemplate = await MessageTemplate.findOne({
      where: { institution_id, id },
    });

    if (!messageTemplate) {
      return res.status(404).json({ message: 'Message template not found' });
    }

    res.status(200).json({ data: messageTemplate });
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve message template', error: error.message });
  }
};

// Update a message template by ID
exports.updateMessageTemplate = async (req, res) => {
  try {
    const { content, institution_id, title,id } = req.body;

    const { error } = validateMessageTemplate(req.body,true);
    if (error) {
      return res.status(400).json({ message: 'Validation failed', details: error.details });
    }

    // Find the message template
    const messageTemplate = await MessageTemplate.findByPk(id);

    if (!messageTemplate) {
      return res.status(404).json({ message: 'Message template not found' });
    }

    // Update the message template
    await messageTemplate.update({
      content,
      institution_id,
      title,
    });

    res.status(200).json({
      message: 'Message template updated successfully',
      data: messageTemplate,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update message template', error: error.message });
  }
};

// Delete a message template by ID
exports.deleteMessageTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    const { error } = Joi.object({
      id: Joi.number().integer().required(),
    }).validate({ id });

    if (error) {
      return res.status(400).json({ message: 'Validation failed', details: error.details });
    }

    // Find the message template
    const messageTemplate = await MessageTemplate.findByPk(id);

    if (!messageTemplate) {
      return res.status(404).json({ message: 'Message template not found' });
    }

    // Delete the message template
    await messageTemplate.destroy();

    res.status(200).json({ message: 'Message template deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete message template', error: error.message });
  }
};
