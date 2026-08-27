const {
  Prescription, PrescriptionItem, Medication, DrugBatch,
  DispenseRecord, InventoryLog, PharmacyAudit,
} = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../utils/logger');

const dashboardController = {
  /**
   * GET /dashboard/overview
   * High-level pharmacy overview
   */
  async getOverview(req, res) {
    try {
      const { institution_id } = req.query;

      if (!institution_id) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalMedications,
        activeBatches,
        pendingPrescriptions,
        dispensedToday,
        lowStockCount,
        expiredCount,
        prescriptionsThisWeek,
        revenueThisMonth,
      ] = await Promise.all([
        Medication.count({ where: { is_active: true } }),
        DrugBatch.count({ where: { institution_id, status: 'active' } }),
        Prescription.count({
          where: {
            institution_id,
            status: { [Op.in]: ['pending', 'partially_dispensed'] },
          },
        }),
        DispenseRecord.count({
          where: { institution_id, dispensed_at: { [Op.gte]: today } },
        }),
        // Low stock
        DrugBatch.count({
          where: {
            institution_id,
            status: 'active',
            current_quantity: { [Op.lte]: literal('reorder_level') },
          },
        }),
        // Expired
        DrugBatch.count({
          where: {
            institution_id,
            status: 'active',
            expiry_date: { [Op.lt]: new Date() },
          },
        }),
        // Prescriptions this week
        Prescription.count({
          where: {
            institution_id,
            prescribed_date: {
              [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        // Revenue this month
        DispenseRecord.sum('total_price', {
          where: {
            institution_id,
            dispensed_at: {
              [Op.gte]: new Date(today.getFullYear(), today.getMonth(), 1),
            },
          },
        }),
      ]);

      res.json({
        medications: { total: totalMedications },
        inventory: {
          active_batches: activeBatches,
          low_stock: lowStockCount,
          expired: expiredCount,
        },
        prescriptions: {
          pending: pendingPrescriptions,
          this_week: prescriptionsThisWeek,
        },
        dispensing: {
          dispensed_today: dispensedToday,
          revenue_this_month: (revenueThisMonth || 0).toFixed(2),
        },
      });
    } catch (error) {
      logger.error('Error fetching dashboard overview:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /dashboard/revenue
   * Revenue breakdown by day/week/month
   */
  async getRevenue(req, res) {
    try {
      const { institution_id, period = 'daily', days = 30 } = req.query;

      if (!institution_id) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

      const records = await DispenseRecord.findAll({
        where: {
          institution_id,
          dispensed_at: { [Op.gte]: startDate },
        },
        attributes: [
          [fn('DATE', col('dispensed_at')), 'date'],
          [fn('SUM', col('total_price')), 'revenue'],
          [fn('SUM', col('quantity_dispensed')), 'units_dispensed'],
          [fn('COUNT', col('DispenseRecord.id')), 'dispense_count'],
        ],
        group: [fn('DATE', col('dispensed_at'))],
        order: [[fn('DATE', col('dispensed_at')), 'ASC']],
        raw: true,
      });

      res.json({ period, days: parseInt(days), data: records });
    } catch (error) {
      logger.error('Error fetching revenue:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /dashboard/activity
   * Recent pharmacy activity/audit log
   */
  async getActivity(req, res) {
    try {
      const { institution_id, limit = 20 } = req.query;

      if (!institution_id) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const activities = await PharmacyAudit.findAll({
        where: { institution_id },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
      });

      res.json({ data: activities });
    } catch (error) {
      logger.error('Error fetching activity:', error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = dashboardController;
