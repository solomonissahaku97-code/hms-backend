const { DrugBatch, Medication, InventoryLog, PharmacyAudit } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../utils/logger');
const { pharmacyNotifications } = require('../services/notificationService');

const inventoryController = {
  /**
   * GET /inventory/batches
   * List all drug batches for an institution
   */
  async getBatches(req, res) {
    try {
      const { institution_id, medication_id, status, search, low_stock, page = 1, limit = 50 } = req.query;

      if (!institution_id) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const where = { institution_id };
      if (medication_id) where.medication_id = medication_id;
      if (status) where.status = status;
      else where.status = { [Op.in]: ['active'] }; // Default to active only

      const batches = await DrugBatch.findAndCountAll({
        where,
        include: [
          {
            model: Medication,
            as: 'medication',
            ...(search ? {
              where: {
                [Op.or]: [
                  { generic_name: { [Op.iLike]: `%${search}%` } },
                  { brand_name: { [Op.iLike]: `%${search}%` } },
                ],
              },
            } : {}),
          },
        ],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['expiry_date', 'ASC']],
      });

      // Enrich with low-stock flags
      const enriched = batches.rows.map((batch) => {
        const json = batch.toJSON();
        const reorderLvl = json.reorder_level || 10;
        const criticalLvl = json.critical_level || 3;
        json.is_low_stock = json.current_quantity <= reorderLvl;
        json.is_critical = json.current_quantity <= criticalLvl;
        json.is_expired = new Date(batch.expiry_date) < new Date();
        json.days_until_expiry = Math.ceil((new Date(batch.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
        return json;
      });

      // Optional low-stock filter
      const filtered = low_stock === 'true'
        ? enriched.filter((b) => b.is_low_stock)
        : enriched;

      res.json({
        total: filtered.length,
        page: parseInt(page),
        pages: Math.ceil(batches.count / parseInt(limit)),
        data: filtered,
      });
    } catch (error) {
      logger.error('Error fetching batches:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * POST /inventory/batches
   * Receive new stock (create a batch)
   */
  async receiveStock(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const {
        medication_id, institution_id, batch_number, quantity, unit_cost,
        selling_price, nhia_price, supplier_name, expiry_date, manufacture_date,
        location, reorder_level, critical_level,
      } = req.body;

      // Validation
      if (!medication_id || !institution_id || !batch_number || !quantity || !expiry_date) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'medication_id, institution_id, batch_number, quantity, and expiry_date are required',
        });
      }

      if (quantity <= 0) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Quantity must be greater than 0' });
      }

      // Check medication exists
      const medication = await Medication.findByPk(medication_id, { transaction });
      if (!medication) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Medication not found' });
      }

      // Check for duplicate batch number within institution
      const existingBatch = await DrugBatch.findOne({
        where: { institution_id, batch_number },
        transaction,
      });
      if (existingBatch) {
        await transaction.rollback();
        return res.status(409).json({ error: 'Batch number already exists for this institution' });
      }

      // Create batch
      const batch = await DrugBatch.create({
        medication_id,
        institution_id,
        batch_number,
        quantity,
        current_quantity: quantity,
        unit_cost: unit_cost || 0,
        selling_price: selling_price || 0,
        nhia_price: nhia_price || 0,
        supplier_name,
        expiry_date,
        manufacture_date,
        location,
        reorder_level: reorder_level || 10,
        critical_level: critical_level || 3,
        status: 'active',
      }, { transaction });

      // Log inventory movement
      await InventoryLog.create({
        drug_batch_id: batch.id,
        medication_id,
        institution_id,
        movement_type: 'received',
        quantity_change: quantity,
        previous_quantity: 0,
        new_quantity: quantity,
        reference_type: 'stock_receive',
        reference_id: batch.id,
        performed_by: req.user?.id,
        notes: `Received ${quantity} units of ${medication.generic_name || 'medication'}`,
      }, { transaction });

      // Audit log
      await PharmacyAudit.create({
        institution_id,
        action: 'inventory.stock_received',
        actor_id: req.user?.id,
        entity_type: 'drug_batch',
        entity_id: batch.id,
        new_values: {
          medication: medication.generic_name,
          batch_number,
          quantity,
          selling_price,
        },
      }, { transaction });

      await transaction.commit();

      res.status(201).json({
        message: 'Stock received successfully',
        batch,
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error receiving stock:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * PUT /inventory/batches/:id/adjust
   * Adjust stock quantity for a batch
   */
  async adjustStock(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { adjustment_type, quantity, reason } = req.body;

      if (!adjustment_type || !quantity) {
        await transaction.rollback();
        return res.status(400).json({ error: 'adjustment_type and quantity are required' });
      }

      if (!['increase', 'decrease'].includes(adjustment_type)) {
        await transaction.rollback();
        return res.status(400).json({ error: 'adjustment_type must be "increase" or "decrease"' });
      }

      const batch = await DrugBatch.findByPk(req.params.id, { transaction });
      if (!batch) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Batch not found' });
      }

      const previousQuantity = batch.current_quantity;
      let newQuantity;

      if (adjustment_type === 'increase') {
        newQuantity = previousQuantity + parseInt(quantity);
      } else {
        newQuantity = previousQuantity - parseInt(quantity);
        if (newQuantity < 0) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Cannot decrease below zero' });
        }
      }

      await batch.update({ current_quantity: newQuantity }, { transaction });

      // Update status if depleted
      if (newQuantity === 0) {
        await batch.update({ status: 'depleted' }, { transaction });
      } else if (batch.status === 'depleted') {
        await batch.update({ status: 'active' }, { transaction });
      }

      // Log the movement
      await InventoryLog.create({
        drug_batch_id: batch.id,
        medication_id: batch.medication_id,
        institution_id: batch.institution_id,
        movement_type: 'adjustment',
        quantity_change: adjustment_type === 'increase' ? parseInt(quantity) : -parseInt(quantity),
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        reference_type: 'adjustment',
        reference_id: batch.id,
        performed_by: req.user?.id,
        notes: reason || `Stock ${adjustment_type}: ${quantity} units`,
      }, { transaction });

      await transaction.commit();

      // ── Notifications: Low/Critical Stock (fire-and-forget) ──
      if (newQuantity > 0) {
        const reorderLvl = batch.reorder_level || 10;
        const criticalLvl = batch.critical_level || 3;

        if (newQuantity <= criticalLvl) {
          pharmacyNotifications.criticalStockWarning({
            medicationName: medication?.generic_name || 'Medication',
            currentQuantity: newQuantity,
            institutionId: batch.institution_id,
            departmentId: null,
            batchNumber: batch.batch_number,
          }).catch(err => logger.warn('Critical stock notification failed:', err.message));
        } else if (newQuantity <= reorderLvl) {
          pharmacyNotifications.lowStockWarning({
            medicationName: medication?.generic_name || 'Medication',
            currentQuantity: newQuantity,
            reorderLevel: reorderLvl,
            institutionId: batch.institution_id,
            departmentId: null,
            batchNumber: batch.batch_number,
          }).catch(err => logger.warn('Low stock notification failed:', err.message));
        }
      }

      res.json({
        message: 'Stock adjusted successfully',
        batch: {
          id: batch.id,
          batch_number: batch.batch_number,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          adjustment_type,
          adjustment_amount: parseInt(quantity),
        },
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error adjusting stock:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /inventory/alerts
   * Get stock alerts (low stock, expired, expiring soon)
   */
  async getAlerts(req, res) {
    try {
      const { institution_id } = req.query;
      if (!institution_id) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const today = new Date();
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const batches = await DrugBatch.findAll({
        where: { institution_id, status: 'active' },
        include: [{ model: Medication, as: 'medication' }],
        order: [['expiry_date', 'ASC']],
      });

      const alerts = {
        low_stock: [],
        critical_stock: [],
        expired: [],
        expiring_soon: [],
      };

      for (const batch of batches) {
        const reorderLvl = batch.reorder_level || 10;
        const criticalLvl = batch.critical_level || 3;
        const med = batch.medication;

        if (batch.current_quantity <= criticalLvl) {
          alerts.critical_stock.push({
            batch_id: batch.id,
            batch_number: batch.batch_number,
            medication: med?.generic_name || 'Unknown',
            current_quantity: batch.current_quantity,
            critical_level: criticalLvl,
          });
        } else if (batch.current_quantity <= reorderLvl) {
          alerts.low_stock.push({
            batch_id: batch.id,
            batch_number: batch.batch_number,
            medication: med?.generic_name || 'Unknown',
            current_quantity: batch.current_quantity,
            reorder_level: reorderLvl,
          });
        }

        if (new Date(batch.expiry_date) < today) {
          alerts.expired.push({
            batch_id: batch.id,
            batch_number: batch.batch_number,
            medication: med?.generic_name || 'Unknown',
            expiry_date: batch.expiry_date,
            current_quantity: batch.current_quantity,
          });
        } else if (new Date(batch.expiry_date) < thirtyDaysFromNow) {
          alerts.expiring_soon.push({
            batch_id: batch.id,
            batch_number: batch.batch_number,
            medication: med?.generic_name || 'Unknown',
            expiry_date: batch.expiry_date,
            current_quantity: batch.current_quantity,
          });
        }
      }

      res.json({
        total_alerts: alerts.low_stock.length + alerts.critical_stock.length + alerts.expired.length + alerts.expiring_soon.length,
        alerts,
      });
    } catch (error) {
      logger.error('Error fetching alerts:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /inventory/logs
   * Get inventory movement logs
   */
  async getLogs(req, res) {
    try {
      const { institution_id, medication_id, drug_batch_id, movement_type, page = 1, limit = 50 } = req.query;

      const where = {};
      if (institution_id) where.institution_id = institution_id;
      if (medication_id) where.medication_id = medication_id;
      if (drug_batch_id) where.drug_batch_id = drug_batch_id;
      if (movement_type) where.movement_type = movement_type;

      const logs = await InventoryLog.findAndCountAll({
        where,
        include: [{ model: Medication, as: 'medication', attributes: ['generic_name'] }],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['createdAt', 'DESC']],
      });

      res.json({
        total: logs.count,
        page: parseInt(page),
        pages: Math.ceil(logs.count / parseInt(limit)),
        data: logs.rows,
      });
    } catch (error) {
      logger.error('Error fetching logs:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /inventory/valuation
   * Get inventory valuation for an institution
   */
  async getValuation(req, res) {
    try {
      const { institution_id } = req.query;
      if (!institution_id) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const batches = await DrugBatch.findAll({
        where: { institution_id, status: 'active' },
        include: [{ model: Medication, as: 'medication' }],
      });

      let totalCost = 0;
      let totalRetail = 0;
      let totalNhia = 0;

      const items = batches.map((batch) => {
        const cost = parseFloat(batch.unit_cost) * batch.current_quantity;
        const retail = parseFloat(batch.selling_price) * batch.current_quantity;
        const nhia = parseFloat(batch.nhia_price) * batch.current_quantity;
        totalCost += cost;
        totalRetail += retail;
        totalNhia += nhia;

        return {
          medication: batch.medication?.generic_name || 'Unknown',
          batch_number: batch.batch_number,
          quantity: batch.current_quantity,
          unit_cost: batch.unit_cost,
          selling_price: batch.selling_price,
          total_cost: cost,
          total_retail: retail,
        };
      });

      res.json({
        summary: {
          total_batches: batches.length,
          total_units: batches.reduce((sum, b) => sum + b.current_quantity, 0),
          total_cost_value: totalCost.toFixed(2),
          total_retail_value: totalRetail.toFixed(2),
          total_nhia_value: totalNhia.toFixed(2),
          potential_profit: (totalRetail - totalCost).toFixed(2),
        },
        items,
      });
    } catch (error) {
      logger.error('Error fetching valuation:', error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = inventoryController;
