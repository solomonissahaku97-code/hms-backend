const { body, param } = require('express-validator');

const claimItemValidations = {
  add: [
    param('claimId').isUUID().withMessage('Invalid claim ID format'),
    body('item_type').isIn(['LabTest', 'Medication', 'Consultation', 'Procedure', 'Service', 'Diagnosis'])
      .withMessage('Invalid item type'),
    body('item_id').isUUID().withMessage('Invalid item ID format'),
    body('description').optional().isString().trim(),
    body('unit_price').optional().isFloat({ min: 0 }),
    body('quantity').optional().isInt({ min: 1 }),
    body('amount').optional().isFloat({ min: 0 }),
    body('performed_by').isUUID().withMessage('Invalid staff ID format')
  ],
  update: [
    param('claimId').isUUID().withMessage('Invalid claim ID format'),
    param('itemId').isUUID().withMessage('Invalid item ID format'),
    body('description').optional().isString().trim(),
    body('unit_price').optional().isFloat({ min: 0 }),
    body('quantity').optional().isInt({ min: 1 }),
    body('amount').optional().isFloat({ min: 0 }),
    body('performed_by').optional().isUUID().withMessage('Invalid staff ID format')
  ]
};

const validateClaimItem = (method) => {
  return claimItemValidations[method];
};

module.exports = { validateClaimItem };