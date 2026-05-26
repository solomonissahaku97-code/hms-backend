const express = require('express');
const router = express.Router();
const { check, param } = require('express-validator');
const {
  createDiagnosis,
  getAllDiagnoses,     // Unfiltered full list
  getDiagnosisById,
  updateDiagnosis,
  deleteDiagnosis,
  searchDiagnoses
} = require('../controllers/claims/icdController');

// Optional: Custom middleware to handle validation errors
const validate = (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
};

// Validation rules for create/update
const diagnosisValidation = [
  check('icd_10_code')
    .notEmpty().withMessage('ICD-10 code is required')
    .matches(/^[A-Z][0-9]{2}(\.[0-9]{1,4})?$/).withMessage('Invalid ICD-10 code format (e.g. E11.9)'),
  check('diagnosis_name')
    .notEmpty().withMessage('Diagnosis name is required'),
  check('gender')
    .optional()
    .isIn(['Male', 'Female', null]).withMessage('Invalid gender value')
];

// Routes

// 🔹 Create a new diagnosis
router.post('/', diagnosisValidation, validate, createDiagnosis);

// 🔹 Get filtered diagnoses (e.g. by gender or search)
router.get('/', getAllDiagnoses); // /icd10?gender=Male&search=malaria

// 🔹 Get all diagnoses unfiltered (admin usage)
router.get('/diagnoses/all', getAllDiagnoses);
router.get('/diagnoses/search', searchDiagnoses);

// 🔹 Get a specific diagnosis by ID (must be UUID)
router.get(
  '/:id',
  param('id').isUUID().withMessage('Invalid UUID'),
  validate,
  getDiagnosisById
);

// 🔹 Update a specific diagnosis
router.put(
  '/:id',
  param('id').isUUID().withMessage('Invalid UUID'),
  diagnosisValidation,
  validate,
  updateDiagnosis
);

// 🔹 Delete a specific diagnosis
router.delete(
  '/:id',
  param('id').isUUID().withMessage('Invalid UUID'),
  validate,
  deleteDiagnosis
);

module.exports = router;
