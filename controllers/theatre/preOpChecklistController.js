const PreOpChecklist = require('../../models/theatre/PreOpChecklist');
const preOpTemplate = require('../../config/preOpChecklistTemplate');

const { Op } = require('sequelize');
const TheatrePatients = require('../../models/theatre/TheatrePatients');

/**
 * ✅ Fetch existing or create a new checklist
 */
exports.createOrGetChecklist = async (req, res) => {
  const { visit_id, surgery_schedule_id } = req.body;

  try {
    if (!visit_id) {
      return res.status(400).json({ message: 'visit_id is required' });
    }

    // ✅ 1. Try to find existing checklist by visit or schedule
    let checklist = await PreOpChecklist.findOne({
      where: {
        [Op.or]: [
          { visit_id },
          { surgery_schedule_id }
        ],
      },
    });

    // ✅ 2. If found, return it immediately
    if (checklist) {
      return res.status(200).json({
        message: 'Existing checklist found',
        checklist,
      });
    }

    // ✅ 3. Validate surgery_schedule_id if provided
    if (surgery_schedule_id) {
      const theatreRecord = await TheatrePatients.findByPk(surgery_schedule_id);
      if (!theatreRecord) {
        return res.status(400).json({
          message: `Invalid surgery_schedule_id: ${surgery_schedule_id} not found in theatre_patients`,
        });
      }
    }

    // ✅ 4. Create new checklist
     checklist = await PreOpChecklist.create({
      visit_id,
      surgery_schedule_id: surgery_schedule_id || null,
      checklist_data: preOpTemplate,
      status: 'in-progress',
    });
    return res.json(checklist);

  } catch (error) {
    console.error('❌ Error fetching or creating checklist:', error);
    return res.status(500).json({
      message: 'Failed to fetch or create pre-operative checklist',
      error: error.message,
    });
  }
};


/**
 * 
 * @param {get templatelst} req 
 * @returns 
 */

exports.getTemplateList = async (req, res) => {
  try {
    const templates = await preOpTemplate.findAll();

    return res.json({
      message: 'Template list fetched successfully',
      data: templates
    });
  } catch (error) {
    console.error('❌ Error fetching template list:', error);
    res.status(500).json({ message: 'Failed to fetch template list', error: error.message });
  }
}

/**
 * 🧾 Update checklist (progress or completion)
 */
exports.updateChecklist = async (req, res) => {
  const { id } = req.params;
  const { checklist_data, status, completed_by } = req.body;

  try {
    const checklist = await PreOpChecklist.findByPk(id);

    if (!checklist) {
      return res.status(404).json({ message: 'Checklist not found' });
    }

    // Calculate completion status
    let allRequiredDone = true;

    for (const section of checklist_data) {
      for (const item of section.items) {
        if (item.required && item.status !== 'completed') {
          allRequiredDone = false;
          break;
        }
      }
      if (!allRequiredDone) break;
    }

    // Update fields
    checklist.checklist_data = checklist_data;
    checklist.status = allRequiredDone ? 'completed' : (status || 'in-progress');
    checklist.completed_by = allRequiredDone ? completed_by : null;
    checklist.completed_at = allRequiredDone ? new Date() : null;

    await checklist.save();

    return res.json({
      message: 'Checklist updated successfully',
      data: checklist
    });
  } catch (error) {
    console.error('❌ Error updating checklist:', error);
    res.status(500).json({ message: 'Failed to update checklist', error: error.message });
  }
};
