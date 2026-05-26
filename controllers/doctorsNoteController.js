// controllers/doctorsNoteController.js
const { Visit, Department, Staff } = require('../models');
const DoctorsNote = require('../models/doctorsNote');



exports.createDoctorsNote = async (req, res) => {
  try {
    const {
      note,
      visit_id,
      institution_id,
      department_id,
      priority
    } = req.body;

    const staff_id = req.user.id; // authenticated doctor

    if (!note || !visit_id || !institution_id || !department_id) {
      return res.status(400).json({
        success: false,
        message: 'Required fields are missing'
      });
    }

    const doctorsNote = await DoctorsNote.create({
      note,
      visit_id,
      institution_id,
      department_id,
      staff_id,
      priority
    });

    return res.status(201).json({
      success: true,
      data: doctorsNote
    });

  } catch (error) {
    console.log('Create Doctors Note Error:', error);
    return res.status(500).json({
      success: false,
      message: error
    });
  }
};

/**
 * GET all doctor’s notes for a visit
 * GET /api/doctors-notes/visit/:visitId
 */
exports.getNotesByVisit = async (req, res) => {
  try {
    const { visitId } = req.params;

    const notes = await DoctorsNote.findAll({
      where: { visit_id: visitId },
      include: [
        { model: Staff, attributes: ['id', 'firstName', 'middleName','lastName'] },
        { model: Department, attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: notes
    });

  } catch (error) {
    console.error('Fetch Notes Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor’s notes'
    });
  }
};

/**
 * GET single doctor’s note
 * GET /api/doctors-notes/:id
 */
exports.getSingleNote = async (req, res) => {
  try {
    const { id } = req.params;

    const note = await DoctorsNote.findByPk(id, {
      include: [
        { model: Staff, attributes: ['id', 'first_name', 'last_name'] },
        { model: Department, attributes: ['id', 'name'] }
      ]
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Doctor’s note not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: note
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve doctor’s note'
    });
  }
};

/**
 * UPDATE doctor’s note (only if NOT signed)
 * PUT /api/doctors-notes/:id
 */
exports.updateDoctorsNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const doctorsNote = await DoctorsNote.findByPk(id);

    if (!doctorsNote) {
      return res.status(404).json({
        success: false,
        message: 'Doctor’s note not found'
      });
    }

    if (doctorsNote.is_signed) {
      return res.status(403).json({
        success: false,
        message: 'Signed notes cannot be edited'
      });
    }

    doctorsNote.note = note || doctorsNote.note;
    doctorsNote.updatedAt = new Date();

    await doctorsNote.save();

    return res.status(200).json({
      success: true,
      data: doctorsNote
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update doctor’s note'
    });
  }
};

/**
 * SIGN doctor’s note (lock it)
 * POST /api/doctors-notes/:id/sign
 */
exports.signDoctorsNote = async (req, res) => {
  try {
    const { id } = req.params;

    const doctorsNote = await DoctorsNote.findByPk(id);

    if (!doctorsNote) {
      return res.status(404).json({
        success: false,
        message: 'Doctor’s note not found'
      });
    }

    if (doctorsNote.is_signed) {
      return res.status(400).json({
        success: false,
        message: 'Doctor’s note is already signed'
      });
    }

    doctorsNote.is_signed = true;
    doctorsNote.signed_at = new Date();

    await doctorsNote.save();

    return res.status(200).json({
      success: true,
      message: 'Doctor’s note signed successfully'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to sign doctor’s note'
    });
  }
};

/**
 * DELETE doctor’s note (ADMIN only – optional)
 * DELETE /api/doctors-notes/:id
 */
exports.deleteDoctorsNote = async (req, res) => {
  try {
    const { id } = req.params;

    const doctorsNote = await DoctorsNote.findByPk(id);

    if (!doctorsNote) {
      return res.status(404).json({
        success: false,
        message: 'Doctor’s note not found'
      });
    }

    // Optional: restrict deletion to admins only
    // if (req.user.role !== 'admin') return res.status(403)...

    await doctorsNote.destroy();

    return res.status(200).json({
      success: true,
      message: 'Doctor’s note deleted'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete doctor’s note'
    });
  }
};