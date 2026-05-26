const express = require('express');
const router = express.Router();

const {
  createOrGetChecklist,
  updateChecklist,
  getTemplateList
} = require('../controllers/theatre/preOpChecklistController');

// ✅ Fetch or create checklist
router.post('/create-or-get', createOrGetChecklist);

// ✅ Get template list (static config)
router.get('/templates', getTemplateList);

// ✅ Update checklist
router.put('/:id', updateChecklist);

module.exports = router;
