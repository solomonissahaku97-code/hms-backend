const express = require('express');
const router = express.Router();
const messageTemplateController = require('../controllers/messageTemplateController');

router.post('/message-templates', messageTemplateController.createMessageTemplate);
router.get('/message-templates', messageTemplateController.getMessageTemplates);
router.get('/message-templates/:id', messageTemplateController.getMessageTemplateById);
router.put('/message-templates', messageTemplateController.updateMessageTemplate);
router.delete('/message-templates/:id', messageTemplateController.deleteMessageTemplate);

module.exports = router;
