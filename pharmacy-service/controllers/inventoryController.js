const { DrugBatch, Medication, InventoryLog, PharmacyAudit } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../utils/logger');

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
        const med = json.medication;
        json.is_low_stock = med && json.current_quantity <= (med.reorder_level || 10);
        json.is_critical = med && json.current_quantity <= (med.critical_level || 3);
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
        reorder_level: reorder_level || medication.reorder_level || 10,
        critical_level: critical_level || medication.critical_level || 3,
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
        reference_type: 'stock_receipt',
        reference_id: batch.id,
        performed_by: req.user?.id,
        notes: `Received ${quantity} units of ${medication.generic_name} (Batch: ${batch_number})`,
      }, { transaction });

      await transaction.commit();

      const result = await DrugBatch.findByPk(batch.id, {
        include: [{ model: Medication, as: 'medication' }],
      });

      res.status(201).json(result);
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

      res.json({
        message: `Stock ${adjustment_type}d successfully`,
        batch_id: batch.id,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        adjustment: adjustment_type === 'increase' ? `+${quantity}` : `-${quantity}`,
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error adjusting stock:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /inventory/alerts
   * Get low-stock and expiring-soon alerts
   */
  async getAlerts(req, res) {
    try {
      const { institution_id, days_to_expiry = 30 } = req.query;

      if (!institution_id) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const batches = await DrugBatch.findAll({
        where: { institution_id, status: 'active' },
        include: [{ model: Medication, as: 'medication' }],
      });

      const lowStock = [];
      const expiringSoon = [];
      const expired = [];

      const now = new Date();
      const expiryThreshold = new Date(now.getTime() + parseInt(days_to_expiry) * 24 * 60 * 60 * 1000);

      batches.forEach((batch) => {
        const med = batch.medication;
        const reorderLevel = med?.reorder_level || batch.reorder_level || 10;
        const criticalLevel = med?.critical_level || batch.critical_level || 3;
        const expiryDate = new Date(batch.expiry_date);

        if (batch.current_quantity <= criticalLevel) {
          lowStock.push({
            ...batch.toJSON(),
            alert_type: 'critical',
            message: `${med?.generic_name || 'Unknown'}: only ${batch.current_quantity} units remaining (critical level: ${criticalLevel})`,
          });
        } else if (batch.current_quantity <= reorderLevel) {
          lowStock.push({
            ...batch.toJSON(),
            alert_type: 'low_stock',
            message: `${med?.generic_name || 'Unknown'}: ${batch.current_quantity} units remaining (reorder level: ${reorderLevel})`,
          });
        }

        if (expiryDate < now) {
          expired.push({
            ...batch.toJSON(),
            message: `${med?.generic_name || 'Unknown'} (Batch: ${batch.batch_number}) expired on ${batch.expiry_date}`,
          });
        } else if (expiryDate <= expiryThreshold) {
          const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
          expiringSoon.push({
            ...batch.toJSON(),
            days_until_expiry: daysLeft,
            message: `${med?.generic_name || 'Unknown'} (Batch: ${batch.batch_number}) expires in ${daysLeft} days`,
          });
        }
      });

      res.json({
        low_stock: lowStock,
        expiring_soon: expiringSoon,
        expired: expired,
        summary: {
          low_stock_count: lowStock.length,
          expiring_soon_count: expiringSoon.length,
          expired_count: expired.length,
        },
      });
    } catch (error) {
      logger.error('Error fetching alerts:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /inventory/logs
   * Get inventory movement history
   */
  async getLogs(req, res) {
    try {
      const { institution_id, medication_id, batch_id, movement_type, page = 1, limit = 50 } = req.query;

      const where = {};
      if (institution_id) where.institution_id = institution_id;
      if (medication_id) where.medication_id = medication_id;
      if (batch_id) where.drug_batch_id = batch_id;
      if (movement_type) where.movement_type = movement_type;

      const logs = await InventoryLog.findAndCountAll({
        where,
        include: [
          { model: DrugBatch, as: 'drugBatch', attributes: ['batch_number'] },
          { model: Medication, as: 'medication', attributes: ['generic_name', 'form', 'strength'] },
        ],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['created_at', 'DESC']],
      });

      res.json({
        total: logs.count,
        page: parseInt(page),
        pages: Math.ceil(logs.count / parseInt(limit)),
        data: logs.rows,
      });
    } catch (error) {
      logger.error('Error fetching inventory logs:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /inventory/valuation
   * Get stock valuation report for an institution
   */
  async getValuation(req, res) {
    try {
      const { institution_id } = req.query;

      if (!institution_id) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const batches = await DrugBatch.findAll({
        where: { institution_id, status: 'active', current_quantity: { [Op.gt]: 0 } },
        include: [{ model: Medication, as: 'medication' }],
      });

      const valuation = batches.map((batch) => ({
        medication: batch.medication?.generic_name || 'Unknown',
        form: batch.medication?.form,
        batch_number: batch.batch_number,
        quantity: batch.current_quantity,
        unit_cost: parseFloat(batch.unit_cost),
        selling_price: parseFloat(batch.selling_price),
        cost_value: batch.current_quantity * parseFloat(batch.unit_cost),
        retail_value: batch.current_quantity * parseFloat(batch.selling_price),
        expiry_date: batch.expiry_date,
      }));

      const totalCostValue = valuation.reduce((sum, v) => sum + v.cost_value, 0);
      const totalRetailValue = valuation.reduce((sum, v) => sum + v.retail_value, 0);

      res.json({
        items: valuation,
        summary: {
          total_items: valuation.length,
          total_cost_value: totalCostValue.toFixed(2),
          total_retail_value: totalRetailValue.toFixed(2),
          potential_profit: (totalRetailValue - totalCostValue).toFixed(2),
        },
      });
    } catch (error) {
      logger.error('Error fetching valuation:', error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = inventoryController;
