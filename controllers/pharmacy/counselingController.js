const { PatientMedicationCounseling } = require('../../models');
const { Op } = require('sequelize');

const counselingController = {
  // Create a new medication counseling record
  async createCounseling(req, res) {
    try {
      const {
        visit_id,
        prescription_id,
        language,
        duration,
        topic_covered,
        staff_requester_id,
        staff_instructor_id,
        method
      } = req.body;

      const counseling = await PatientMedicationCounseling.create({
        visit_id,
        prescription_id,
        language,
        duration,
        topic_covered,
        staff_requester_id,
        staff_instructor_id,
        method,
        status: 'pending' // Default status
      });

      // Fetch the complete record with associations
      const completeRecord = await PatientMedicationCounseling.findByPk(counseling.id, {
        include: [
          { association: 'visit' },
          { association: 'prescription' },
          { association: 'requester' },
          { association: 'instructor' }
        ]
      });

      res.status(201).json({
        success: true,
        data: completeRecord,
        message: 'Medication counseling record created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create counseling record',
        error: error.message
      });
    }
  },

  // Get all counseling records with filtering options
  async getAllCounselings(req, res) {
    try {
      const { status, visit_id, prescription_id, date_from, date_to } = req.query;
      
      const where = {};
      if (status) where.status = status;
      if (visit_id) where.visit_id = visit_id;
      if (prescription_id) where.prescription_id = prescription_id;
      
      // Date range filter
      if (date_from || date_to) {
        where.createdAt = {};
        if (date_from) where.createdAt[Op.gte] = new Date(date_from);
        if (date_to) where.createdAt[Op.lte] = new Date(date_to);
      }

      const counselings = await PatientMedicationCounseling.findAll({
        where,
        include: [
          { association: 'visit' },
          { association: 'prescription' },
          { association: 'requester' },
          { association: 'instructor' }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json({
        success: true,
        data: counselings,
        count: counselings.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch counseling records',
        error: error.message
      });
    }
  },

  // Get a single counseling record by ID
  async getCounselingById(req, res) {
    try {
      const { id } = req.params;

      const counseling = await PatientMedicationCounseling.findByPk(id, {
        include: [
          { association: 'visit' },
          { association: 'prescription' },
          { association: 'requester' },
          { association: 'instructor' },
          { association: 'documents' }
        ]
      });

      if (!counseling) {
        return res.status(404).json({
          success: false,
          message: 'Counseling record not found'
        });
      }

      res.status(200).json({
        success: true,
        data: counseling
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch counseling record',
        error: error.message
      });
    }
  },

  // Update a counseling record
  async updateCounseling(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Don't allow updating these fields directly
      delete updates.id;
      delete updates.visit_id;
      delete updates.prescription_id;
      delete updates.staff_requester_id;

      const [updated] = await PatientMedicationCounseling.update(updates, {
        where: { id },
        returning: true // For PostgreSQL
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Counseling record not found or no changes made'
        });
      }

      // Fetch the updated record with associations
      const updatedRecord = await PatientMedicationCounseling.findByPk(id, {
        include: [
          { association: 'visit' },
          { association: 'prescription' },
          { association: 'requester' },
          { association: 'instructor' }
        ]
      });

      res.status(200).json({
        success: true,
        data: updatedRecord,
        message: 'Counseling record updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update counseling record',
        error: error.message
      });
    }
  },

  // Update counseling status (approve/reject/fulfill)
  async updateCounselingStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, staff_instructor_id, counseling_date } = req.body;

      if (!['approved', 'rejected', 'fulfilled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be approved, rejected, or fulfilled'
        });
      }

      const updates = { status };
      if (status === 'fulfilled') {
        if (!staff_instructor_id) {
          return res.status(400).json({
            success: false,
            message: 'staff_instructor_id is required when fulfilling counseling'
          });
        }
        updates.staff_instructor_id = staff_instructor_id;
        updates.counseling_date = counseling_date || new Date();
      }

      const [updated] = await PatientMedicationCounseling.update(updates, {
        where: { id },
        returning: true
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Counseling record not found'
        });
      }

      const updatedRecord = await PatientMedicationCounseling.findByPk(id, {
        include: [
          { association: 'visit' },
          { association: 'prescription' },
          { association: 'requester' },
          { association: 'instructor' }
        ]
      });

      res.status(200).json({
        success: true,
        data: updatedRecord,
        message: `Counseling record ${status} successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update counseling status',
        error: error.message
      });
    }
  },

  // Get counselings by visit ID
  async getCounselingsByVisit(req, res) {
    try {
      const { visit_id } = req.params;

      const counselings = await PatientMedicationCounseling.findAll({
        where: { visit_id },
        include: [
          { association: 'prescription' },
          { association: 'requester' },
          { association: 'instructor' }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json({
        success: true,
        data: counselings,
        count: counselings.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch counseling records for visit',
        error: error.message
      });
    }
  },

  // Get counselings by prescription ID
  async getCounselingsByPrescription(req, res) {
    try {
      const { prescription_id } = req.params;

      const counselings = await PatientMedicationCounseling.findAll({
        where: { prescription_id },
        include: [
          { association: 'visit' },
          { association: 'requester' },
          { association: 'instructor' }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json({
        success: true,
        data: counselings,
        count: counselings.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch counseling records for prescription',
        error: error.message
      });
    }
  },

  // Soft delete a counseling record
  async deleteCounseling(req, res) {
    try {
      const { id } = req.params;

      const deleted = await PatientMedicationCounseling.destroy({
        where: { id }
      });

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Counseling record not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Counseling record deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete counseling record',
        error: error.message
      });
    }
  }
};

module.exports = counselingController;