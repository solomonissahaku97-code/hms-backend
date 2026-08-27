const { Prescription, PrescriptionItem, Medication, DrugBatch, DispenseRecord, PharmacyAudit } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../utils/logger');
const { notifyDepartment } = require('../services/hmsClient');

const prescriptionController = {
  /**
   * POST /prescriptions
   * Create a new prescription with items
   */
  async create(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const {
        patient_id, visit_id, doctor_id, department_id, institution_id,
        diagnosis, notes, is_emergency, priority, valid_until, items,
      } = req.body;

      if (!patient_id || !institution_id || !items || !Array.isArray(items) || items.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ error: 'patient_id, institution_id, and at least one item are required' });
      }

      // Create prescription
      const prescription = await Prescription.create({
        patient_id,
        visit_id,
        doctor_id,
        department_id,
        institution_id,
        diagnosis,
        notes,
        is_emergency: is_emergency || false,
        priority: priority || 'routine',
        valid_until,
        status: 'pending',
        prescribed_date: new Date(),
      }, { transaction });

      // Create prescription items
      const createdItems = [];
      for (const item of items) {
        if (!item.medication_id || !item.dosage || !item.frequency) {
          await transaction.rollback();
          return res.status(400).json({
            error: 'Each item must have medication_id, dosage, and frequency',
          });
        }

        // Verify medication exists
        const medication = await Medication.findByPk(item.medication_id, { transaction });
        if (!medication) {
          await transaction.rollback();
          return res.status(404).json({ error: `Medication not found: ${item.medication_id}` });
        }

        const prescriptionItem = await PrescriptionItem.create({
          prescription_id: prescription.id,
          medication_id: item.medication_id,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration || 1,
          quantity_prescribed: item.quantity_prescribed,
          route: item.route,
          instructions: item.instructions,
          refill_count: item.refill_count || 0,
        }, { transaction });

        createdItems.push(prescriptionItem);
      }

      // Audit log
      await PharmacyAudit.create({
        institution_id,
        prescription_id: prescription.id,
        action: 'prescription.created',
        actor_id: doctor_id || req.user?.id || 'system',
        entity_type: 'prescription',
        entity_id: prescription.id,
        new_values: { prescription_number: prescription.prescription_number, items_count: createdItems.length },
      }, { transaction });

      await transaction.commit();

      // Fetch the complete prescription with items
      const result = await Prescription.findByPk(prescription.id, {
        include: [
          { model: PrescriptionItem, as: 'items', include: [{ model: Medication, as: 'medication' }] },
        ],
      });

      // Notify pharmacy department (fire-and-forget)
      if (department_id) {
        notifyDepartment(department_id, {
          title: 'New Prescription',
          description: `New prescription ${prescription.prescription_number} with ${createdItems.length} medication(s)`,
          type: 'pharmacy',
          priority: is_emergency ? 'high' : 'medium',
        }).catch((err) => logger.warn('Failed to notify pharmacy:', err.message));
      }

      res.status(201).json(result);
    } catch (error) {
      await transaction.rollback();
      logger.error('Error creating prescription:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /prescriptions
   * List prescriptions with filters
   */
  async getAll(req, res) {
    try {
      const {
        institution_id, patient_id, visit_id, doctor_id,
        status, is_emergency, start_date, end_date,
        search, page = 1, limit = 30,
      } = req.query;

      const where = {};
      if (institution_id) where.institution_id = institution_id;
      if (patient_id) where.patient_id = patient_id;
      if (visit_id) where.visit_id = visit_id;
      if (doctor_id) where.doctor_id = doctor_id;
      if (status) where.status = status;
      if (is_emergency !== undefined) where.is_emergency = is_emergency === 'true';
      if (start_date && end_date) {
        where.prescribed_date = { [Op.between]: [new Date(start_date), new Date(end_date)] };
      }
      if (search) {
        where[Op.or] = [
          { prescription_number: { [Op.iLike]: `%${search}%` } },
          { diagnosis: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const prescriptions = await Prescription.findAndCountAll({
        where,
        include: [
          {
            model: PrescriptionItem,
            as: 'items',
            include: [{ model: Medication, as: 'medication', attributes: ['id', 'generic_name', 'brand_name', 'form', 'strength'] }],
          },
        ],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['prescribed_date', 'DESC']],
      });

      res.json({
        total: prescriptions.count,
        page: parseInt(page),
        pages: Math.ceil(prescriptions.count / parseInt(limit)),
        data: prescriptions.rows,
      });
    } catch (error) {
      logger.error('Error fetching prescriptions:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /prescriptions/:id
   * Get a single prescription with full details
   */
  async getById(req, res) {
    try {
      const prescription = await Prescription.findByPk(req.params.id, {
        include: [
          {
            model: PrescriptionItem,
            as: 'items',
            include: [
              { model: Medication, as: 'medication' },
              { model: DispenseRecord, as: 'dispenseRecords' },
            ],
          },
          { model: DispenseRecord, as: 'dispenseRecords' },
          { model: PharmacyAudit, as: 'auditLogs', order: [['created_at', 'DESC']], limit: 10 },
        ],
      });

      if (!prescription) {
        return res.status(404).json({ error: 'Prescription not found' });
      }

      res.json(prescription);
    } catch (error) {
      logger.error('Error fetching prescription:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * PUT /prescriptions/:id/status
   * Update prescription status (cancel, etc.)
   */
  async updateStatus(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { status, cancel_reason } = req.body;

      if (!['canceled'].includes(status)) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Only status "canceled" can be set via this endpoint' });
      }

      const prescription = await Prescription.findByPk(req.params.id, { transaction });
      if (!prescription) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Prescription not found' });
      }

      if (prescription.status === 'dispensed') {
        await transaction.rollback();
        return res.status(400).json({ error: 'Cannot cancel an already dispensed prescription' });
      }

      await prescription.update({
        status,
        cancel_reason,
        canceled_by: req.user?.id,
        canceled_at: new Date(),
      }, { transaction });

      // Cancel all pending items
      await PrescriptionItem.update(
        { status: 'canceled' },
        { where: { prescription_id: prescription.id, status: 'pending' }, transaction }
      );

      // Audit log
      await PharmacyAudit.create({
        institution_id: prescription.institution_id,
        prescription_id: prescription.id,
        action: 'prescription.canceled',
        actor_id: req.user?.id,
        entity_type: 'prescription',
        entity_id: prescription.id,
        old_values: { status: prescription.status },
        new_values: { status, cancel_reason },
      }, { transaction });

      await transaction.commit();

      res.json({ message: 'Prescription canceled', prescription_id: prescription.id });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error canceling prescription:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /prescriptions/pending
   * Get all pending prescriptions for pharmacy review
   */
  async getPending(req, res) {
    try {
      const { institution_id, is_emergency, page = 1, limit = 30 } = req.query;

      const where = {
        status: { [Op.in]: ['pending', 'partially_dispensed'] },
      };
      if (institution_id) where.institution_id = institution_id;
      if (is_emergency !== undefined) where.is_emergency = is_emergency === 'true';

      const prescriptions = await Prescription.findAndCountAll({
        where,
        include: [
          {
            model: PrescriptionItem,
            as: 'items',
            where: { status: { [Op.in]: ['pending', 'partially_dispensed'] } },
            include: [{ model: Medication, as: 'medication' }],
          },
        ],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [
          ['is_emergency', 'DESC'],
          ['prescribed_date', 'ASC'],
        ],
      });

      res.json({
        total: prescriptions.count,
        page: parseInt(page),
        pages: Math.ceil(prescriptions.count / parseInt(limit)),
        data: prescriptions.rows,
      });
    } catch (error) {
      logger.error('Error fetching pending prescriptions:', error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = prescriptionController;
