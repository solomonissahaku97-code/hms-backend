const joi = require('joi');

const validateInstitution = joi.object({
    institution_id: joi.number().integer().positive()
        .required()
        .messages({
            'number.base': 'institution_id must be a number',
            'number.integer': 'institution_id must be an integer',
            'number.positive': 'institution_id must be a positive number',
            'any.required': 'institution_id is required',
        }),
    name: joi.string().min(2).max(50)
        .required()
        .messages({
            'string.base': 'Institution name must be a string',
            'string.min': 'Institution name should have a minimum length of 2 characters',
            'string.max': 'Institution name should have a maximum length of 50 characters',
            'any.required': 'Institution name is required',
        })
});

module.exports = validateInstitution;
