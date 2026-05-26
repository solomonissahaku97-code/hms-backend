// controllers/theatre/educationMaterialsController.js
const { Op } = require('sequelize');
// const EducationMaterials = require('../../models/theatre/EducationMaterials');
const educationTemplate = require('../../../config/educationTemplate');
const EducationMaterials = require('../../../models/theatre/EducationalMaterials');
// const educationTemplate = require('../../config/'); // default structure

// ✅ 1️⃣ Create or Get Existing Education Record
exports.createOrGetEducationMaterials = async (req, res) => {
  const { visit_id, surgery_schedule_id } = req.body;

  try {
    // 🔹 Find existing education record
    let record = await EducationMaterials.findOne({
      where: {
        [Op.or]: [
          // { patient_id },
          { visit_id },
          { surgery_schedule_id }
        ]
      }
    });

    // 🔹 If none exists, create with default template
    if (!record) {
      record = await EducationMaterials.create({
        visit_id,
        surgery_schedule_id,
        materials_data: educationTemplate,
        total_count: educationTemplate.length,
        viewed_count: 0,
        status: 'not-started'
      });

      return res.json({
        message: 'New education materials created for patient',
        data: record
      });
    }

    return res.json({
      message: 'Existing education materials found',
      data: record
    });
  } catch (error) {
    console.error('❌ Error fetching/creating education materials:', error);
    return res.status(500).json({
      message: 'Failed to get or create education materials',
      error: error.message
    });
  }
};



// ✅ 2️⃣ Update Education Materials (mark viewed / completed)
exports.updateEducationMaterials = async (req, res) => {
  const { id } = req.params;
  const { materials_data, completed_by_staff, completed_by_admin } = req.body;

  try {
    const record = await EducationMaterials.findByPk(id);
    if (!record) {
      return res.status(404).json({ message: 'Education materials not found' });
    }

    // 🔹 Calculate viewed & completion status
    const totalCount = materials_data.length;
    const viewedCount = materials_data.filter(m => m.viewed).length;
    const allViewed = viewedCount === totalCount;

    record.materials_data = materials_data;
    record.total_count = totalCount;
    record.viewed_count = viewedCount;
    record.status = allViewed ? 'completed' : 'in-progress';
    record.completed_at = allViewed ? new Date() : null;
    record.completed_by_staff = allViewed ? completed_by_staff : null;
    record.completed_by_admin = allViewed ? completed_by_admin : null;

    await record.save();

    return res.json({
      message: 'Education materials updated successfully',
      data: record
    });
  } catch (error) {
    console.error('❌ Error updating education materials:', error);
    return res.status(500).json({
      message: 'Failed to update education materials',
      error: error.message
    });
  }
};
