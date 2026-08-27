const {
  Prescription, PrescriptionItem, Medication, DrugBatch,
  DispenseRecord, InventoryLog, PharmacyAudit,
} = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../utils/logger');
const { hmsClient } = require('../services/hmsClient');

const dispensingController = {
  /**
   * POST /dispensing/dispense
   * Dispense one or more items from a prescription.
   * Body: {
   *   prescription_item_id,
   *   drug_batch_id,
   *   quantity_dispensed,
   *   pharmacist_notes?,
   * }
   */
  async dispense(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { prescription_item_id, drug_batch_id, quantity_dispensed, pharmacist_notes } = req.body;

      if (!prescription_item_id || !drug_batch_id || !quantity_dispensed) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'prescription_item_id, drug_batch_id, and quantity_dispensed are required',
        });
      }

      if (quantity_dispensed <= 0) {
        await transaction.rollback();
        return res.status(400).json({ error: 'quantity_dispensed must be greater than 0' });
      }

      // Fetch prescription item
      const prescItem = await PrescriptionItem.findByPk(prescription_item_id, {
        include: [
          { model: Prescription, as: 'prescription' },
          { model: Medication, as: 'medication' },
        ],
        transaction,
      });

      if (!prescItem) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Prescription item not found' });
      }

      if (prescItem.status === 'dispensed' || prescItem.status === 'canceled') {
        await transaction.rollback();
        return res.status(400).json({ error: `Cannot dispense item with status: ${prescItem.status}` });
      }

      // Fetch batch
      const batch = await DrugBatch.findByPk(drug_batch_id, { transaction });
      if (!batch) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Drug batch not found' });
      }

      if (batch.status !== 'active') {
        await transaction.rollback();
        return res.status(400).json({ error: `Batch is not active (status: ${batch.status})` });
      }

      if (new Date(batch.expiry_date) < new Date()) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Batch has expired' });
      }

      if (batch.current_quantity < quantity_dispensed) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Insufficient stock. Available: ${batch.current_quantity}, Requested: ${quantity_dispensed}`,
        });
      }

      // Compute pricing
      const unitPrice = parseFloat(batch.selling_price);
      const totalPrice = unitPrice * quantity_dispensed;
      const nhiaPrice = parseFloat(batch.nhia_price) * quantity_dispensed;

      const previousBatchQty = batch.current_quantity;
      const newBatchQty = previousBatchQty - quantity_dispensed;

      // Update batch quantity
      await batch.update({
        current_quantity: newBatchQty,
        status: newBatchQty === 0 ? 'depleted' : 'active',
      }, { transaction });

      // Create dispense record
      const dispenseRecord = await DispenseRecord.create({
        prescription_id: prescItem.prescription_id,
        prescription_item_id: prescItem.id,
        drug_batch_id: batch.id,
        medication_id: prescItem.medication_id,
        institution_id: prescItem.prescription.institution_id,
        patient_id: prescItem.prescription.patient_id,
        quantity_dispensed,
        unit_price: unitPrice,
        total_price: totalPrice,
        nhia_price: nhiaPrice,
        dispensed_by: req.user?.id,
        pharmacist_notes,
        batch_number_snapshot: batch.batch_number,
      }, { transaction });

      // Update prescription item
      const newQuantityDispensed = (prescItem.quantity_dispensed || 0) + quantity_dispensed;
      const quantityPrescribed = prescItem.quantity_prescribed || 0;
      const itemStatus = quantityPrescribed > 0 && newQuantityDispensed >= quantityPrescribed
        ? 'dispensed'
        : 'partially_dispensed';

      await prescItem.update({
        quantity_dispensed: newQuantityDispensed,
        status: itemStatus,
        dispensed_at: new Date(),
      }, { transaction });

      // Update parent prescription status
      const prescription = prescItem.prescription;
      const allItems = await PrescriptionItem.findAll({
        where: { prescription_id: prescription.id },
        transaction,
      });

      const allDispensed = allItems.every((i) => i.status === 'dispensed');
      const anyDispensed = allItems.some((i) => i.status === 'dispensed' || i.status === 'partially_dispensed');
      const anyCanceled = allItems.some((i) => i.status === 'canceled');

      let prescriptionStatus = 'pending';
      if (allDispensed) prescriptionStatus = 'dispensed';
      else if (anyDispensed) prescriptionStatus = 'partially_dispensed';
      else if (anyCanceled && allItems.every((i) => i.status === 'canceled')) prescriptionStatus = 'canceled';

      await prescription.update({
        status: prescriptionStatus,
        ...(prescriptionStatus === 'dispensed' ? { dispensed_by: req.user?.id, dispensed_at: new Date() } : {}),
      }, { transaction });

      // Log inventory movement
      await InventoryLog.create({
        drug_batch_id: batch.id,
        medication_id: prescItem.medication_id,
        institution_id: prescription.institution_id,
        movement_type: 'dispensed',
        quantity_change: -quantity_dispensed,
        previous_quantity: previousBatchQty,
        new_quantity: newBatchQty,
        reference_type: 'dispensing',
        reference_id: dispenseRecord.id,
        performed_by: req.user?.id,
        notes: `Dispensed ${quantity_dispensed} units of ${prescItem.medication?.generic_name || 'medication'}`,
      }, { transaction });

      // Audit log
      await PharmacyAudit.create({
        institution_id: prescription.institution_id,
        prescription_id: prescription.id,
        action: 'dispensing.completed',
        actor_id: req.user?.id,
        entity_type: 'dispense_record',
        entity_id: dispenseRecord.id,
        new_values: {
          medication: prescItem.medication?.generic_name,
          quantity: quantity_dispensed,
          batch: batch.batch_number,
          total_price: totalPrice,
        },
      }, { transaction });

      await transaction.commit();

      // Attempt billing via HMS backend (fire-and-forget)
      try {
        await hmsClient.post('/api/v1/prescriptions/dispense-bill', {
          prescription_id: prescription.id,
          prescription_item_id: prescItem.id,
          dispense_record_id: dispenseRecord.id,
          patient_id: prescription.patient_id,
          visit_id: prescription.visit_id,
          institution_id: prescription.institution_id,
          department_id: prescription.department_id,
          medication_id: prescItem.medication_id,
          quantity: quantity_dispensed,
          unit_price: unitPrice,
          total_price: totalPrice,
          nhia_price: nhiaPrice,
          medication_name: prescItem.medication?.generic_name,
        });
      } catch (billingError) {
        logger.warn('Billing integration failed (non-blocking):', billingError.message);
      }

      res.status(201).json({
        message: 'Dispensed successfully',
        dispense_record: dispenseRecord,
        batch_remaining: newBatchQty,
        prescription_status: prescriptionStatus,
        item_status: itemStatus,
        pricing: {
          unit_price: unitPrice,
          total_price: totalPrice,
          nhia_price: nhiaPrice,
        },
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error dispensing:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * POST /dispensing/batch-dispense
   * Dispense multiple items from a prescription at once
   */
  async batchDispense(req, res) {
    const { prescription_id, items } = req.body;

    if (!prescription_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'prescription_id and items array are required' });
    }

    const results = [];
    const errors = [];

    for (const item of items) {
      try {
        // Simulate the single dispense for each item
        const mockReq = {
          body: { ...item, prescription_item_id: item.prescription_item_id },
          user: req.user,
        };
        const mockRes = {
          status: () => ({
            json: (data) => {
              if (data.error) throw new Error(data.error);
              results.push(data);
            },
          }),
        };

        // We'll process sequentially within the same transaction instead
        const batch = await DrugBatch.findByPk(item.drug_batch_id);
        if (!batch) {
          errors.push({ item: item.prescription_item_id, error: 'Batch not found' });
          continue;
        }

        if (batch.current_quantity < item.quantity_dispensed) {
          errors.push({
            item: item.prescription_item_id,
            error: `Insufficient stock (available: ${batch.current_quantity})`,
          });
          continue;
        }

        results.push({ prescription_item_id: item.prescription_item_id, status: 'queued' });
      } catch (err) {
        errors.push({ item: item.prescription_item_id, error: err.message });
      }
    }

    // Process each item through the single dispense endpoint
    const dispensedResults = [];
    for (const item of items) {
      if (errors.find((e) => e.item === item.prescription_item_id)) continue;

      try {
        const innerTransaction = await sequelize.transaction();
        try {
          const prescItem = await PrescriptionItem.findByPk(item.prescription_item_id, {
            include: [
              { model: Prescription, as: 'prescription' },
              { model: Medication, as: 'medication' },
            ],
            transaction: innerTransaction,
          });

          const batch = await DrugBatch.findByPk(item.drug_batch_id, { transaction: innerTransaction });

          if (!prescItem || !batch || batch.current_quantity < item.quantity_dispensed) {
            await innerTransaction.rollback();
            errors.push({ item: item.prescription_item_id, error: 'Failed to process' });
            continue;
          }

          const unitPrice = parseFloat(batch.selling_price);
          const totalPrice = unitPrice * item.quantity_dispensed;
          const prevQty = batch.current_quantity;
          const newQty = prevQty - item.quantity_dispensed;

          await batch.update({ current_quantity: newQty, status: newQty === 0 ? 'depleted' : 'active' }, { transaction: innerTransaction });

          const dispenseRecord = await DispenseRecord.create({
            prescription_id: prescItem.prescription_id,
            prescription_item_id: prescItem.id,
            drug_batch_id: batch.id,
            medication_id: prescItem.medication_id,
            institution_id: prescItem.prescription.institution_id,
            patient_id: prescItem.prescription.patient_id,
            quantity_dispensed: item.quantity_dispensed,
            unit_price: unitPrice,
            total_price: totalPrice,
            dispensed_by: req.user?.id,
            pharmacist_notes: item.pharmacist_notes,
            batch_number_snapshot: batch.batch_number,
          }, { transaction: innerTransaction });

          const newDispensed = (prescItem.quantity_dispensed || 0) + item.quantity_dispensed;
          await prescItem.update({ quantity_dispensed: newDispensed, status: 'dispensed', dispensed_at: new Date() }, { transaction: innerTransaction });

          await InventoryLog.create({
            drug_batch_id: batch.id,
            medication_id: prescItem.medication_id,
            institution_id: prescItem.prescription.institution_id,
            movement_type: 'dispensed',
            quantity_change: -item.quantity_dispensed,
            previous_quantity: prevQty,
            new_quantity: newQty,
            reference_type: 'dispensing',
            reference_id: dispenseRecord.id,
            performed_by: req.user?.id,
          }, { transaction: innerTransaction });

          await innerTransaction.commit();
          dispensedResults.push({ prescription_item_id: item.prescription_item_id, dispense_record: dispenseRecord });
        } catch (err) {
          await innerTransaction.rollback();
          errors.push({ item: item.prescription_item_id, error: err.message });
        }
      } catch (err) {
        errors.push({ item: item.prescription_item_id, error: err.message });
      }
    }

    // Update parent prescription status
    if (dispensedResults.length > 0) {
      const prescription = await Prescription.findByPk(prescription_id, {
        include: [{ model: PrescriptionItem, as: 'items' }],
      });
      if (prescription) {
        const allItems = prescription.items;
        const allDispensed = allItems.every((i) => i.status === 'dispensed');
        const anyDispensed = allItems.some((i) => i.status === 'dispensed' || i.status === 'partially_dispensed');

        let status = 'pending';
        if (allDispensed) status = 'dispensed';
        else if (anyDispensed) status = 'partially_dispensed';

        await prescription.update({
          status,
          ...(status === 'dispensed' ? { dispensed_by: req.user?.id, dispensed_at: new Date() } : {}),
        });
      }
    }

    res.json({
      dispensed: dispensedResults,
      errors,
      summary: { success: dispensedResults.length, failed: errors.length },
    });
  },

  /**
   * GET /dispensing/history
   * Get dispensing history for an institution
   */
  async getHistory(req, res) {
    try {
      const {
        institution_id, patient_id, medication_id, dispensed_by,
        start_date, end_date, page = 1, limit = 30,
      } = req.query;

      const where = {};
      if (institution_id) where.institution_id = institution_id;
      if (patient_id) where.patient_id = patient_id;
      if (medication_id) where.medication_id = medication_id;
      if (dispensed_by) where.dispensed_by = dispensed_by;
      if (start_date && end_date) {
        where.dispensed_at = { [Op.between]: [new Date(start_date), new Date(end_date)] };
      }

      const records = await DispenseRecord.findAndCountAll({
        where,
        include: [
          { model: Medication, as: 'medication', attributes: ['generic_name', 'brand_name', 'form', 'strength'] },
          {
            model: DrugBatch,
            as: 'drugBatch',
            attributes: ['batch_number', 'expiry_date'],
          },
          {
            model: Prescription,
            as: 'prescription',
            attributes: ['prescription_number', 'status'],
          },
        ],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['dispensed_at', 'DESC']],
      });

      res.json({
        total: records.count,
        page: parseInt(page),
        pages: Math.ceil(records.count / parseInt(limit)),
        data: records.rows,
      });
    } catch (error) {
      logger.error('Error fetching dispensing history:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /dispensing/stats
   * Get dispensing statistics for the dashboard
   */
  async getStats(req, res) {
    try {
      const { institution_id, start_date, end_date } = req.query;

      const where = {};
      if (institution_id) where.institution_id = institution_id;
      if (start_date && end_date) {
        where.dispensed_at = { [Op.between]: [new Date(start_date), new Date(end_date)] };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalDispensed,
        dispensedToday,
        totalRevenue,
        revenueToday,
        topMedications,
        recentRecords,
      ] = await Promise.all([
        DispenseRecord.count({ where }),
        DispenseRecord.count({ where: { ...where, dispensed_at: { [Op.gte]: today } } }),
        DispenseRecord.sum('total_price', { where }),
        DispenseRecord.sum('total_price', { where: { ...where, dispensed_at: { [Op.gte]: today } } }),
        DispenseRecord.findAll({
          where,
          attributes: [
            'medication_id',
            [sequelize.fn('SUM', sequelize.col('quantity_dispensed')), 'total_quantity'],
            [sequelize.fn('SUM', sequelize.col('total_price')), 'total_revenue'],
            [sequelize.fn('COUNT', sequelize.col('DispenseRecord.id')), 'dispense_count'],
          ],
          include: [{ model: Medication, as: 'medication', attributes: ['generic_name', 'form'] }],
          group: ['medication_id', 'medication.id'],
          order: [[sequelize.fn('total_quantity', sequelize.col('quantity_dispensed')), 'DESC']],
          limit: 10,
          subQuery: false,
        }),
        DispenseRecord.findAll({
          where,
          include: [{ model: Medication, as: 'medication', attributes: ['generic_name'] }],
          order: [['dispensed_at', 'DESC']],
          limit: 5,
        }),
      ]);

      res.json({
        summary: {
          total_dispensed: totalDispensed,
          dispensed_today: dispensedToday,
          total_revenue: (totalRevenue || 0).toFixed(2),
          revenue_today: (revenueToday || 0).toFixed(2),
        },
        top_medications: topMedications,
        recent: recentRecords,
      });
    } catch (error) {
      logger.error('Error fetching dispensing stats:', error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = dispensingController;
