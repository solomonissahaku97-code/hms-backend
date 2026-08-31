/**
 * Pricing Controller — Institution-level medicine pricing management.
 *
 * Each institution can set custom market_price and nhia_price for any medicine.
 * The UNIQUE constraint on (institution_id, medicine_id) prevents duplicates.
 */

const { InstitutionPharmacyPrice, Medication } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const pricingController = {
  /**
   * GET /pricing
   * List all institution-specific prices for an institution.
   * Query: institution_id (required), search?, page?, limit?
   */
  async getAll(req, res) {
    try {
      const { institution_id, search, page = 1, limit = 50 } = req.query;

      if (!institution_id) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const where = { institution_id };
      const include = [{
        model: Medication,
        as: 'medicine',
        ...(search ? {
          where: {
            [Op.or]: [
              { generic_name: { [Op.iLike]: `%${search}%` } },
              { brand_name: { [Op.iLike]: `%${search}%` } },
            ],
          },
        } : {}),
      }];

      const prices = await InstitutionPharmacyPrice.findAndCountAll({
        where,
        include,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['createdAt', 'DESC']],
      });

      res.json({
        total: prices.count,
        page: parseInt(page),
        pages: Math.ceil(prices.count / parseInt(limit)),
        data: prices.rows,
      });
    } catch (error) {
      logger.error('Error fetching institution prices:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /pricing/medication/:medicine_id
   * Get institution price for a specific medication.
   */
  async getByMedication(req, res) {
    try {
      const { institution_id } = req.query;
      const { medicine_id } = req.params;

      if (!institution_id) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const price = await InstitutionPharmacyPrice.findOne({
        where: { institution_id, medicine_id },
        include: [{ model: Medication, as: 'medicine' }],
      });

      if (!price) {
        return res.status(404).json({ error: 'No custom price set for this medication' });
      }

      res.json(price);
    } catch (error) {
      logger.error('Error fetching medication price:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * POST /pricing
   * Set (create or update) institution price for a medication.
   * Uses upsert: if a price already exists for this institution+medicine, update it.
   */
  async setPrice(req, res) {
    try {
      const { institution_id, medicine_id, market_price, nhia_price } = req.body;

      if (!institution_id || !medicine_id) {
        return res.status(400).json({ error: 'institution_id and medicine_id are required' });
      }

      // Verify medicine exists in either medications or medicines table
      const { sequelize } = require('../models');
      const [medCheck] = await sequelize.query(
        `SELECT id FROM medicines WHERE id = :id
         UNION ALL
         SELECT id FROM medications WHERE id = :id`,
        { replacements: { id: medicine_id }, type: sequelize.QueryTypes.SELECT }
      );
      if (!medCheck) {
        return res.status(404).json({ error: 'Medication not found' });
      }

      // Upsert: create or update
      const [price, created] = await InstitutionPharmacyPrice.findOrCreate({
        where: { institution_id, medicine_id },
        defaults: {
          market_price: market_price || 0,
          nhia_price: nhia_price || 0,
          is_active: true,
        },
      });

      if (!created) {
        // Update existing
        const updates = {};
        if (market_price !== undefined) updates.market_price = market_price;
        if (nhia_price !== undefined) updates.nhia_price = nhia_price;
        updates.is_active = true;

        await price.update(updates);
      }

      // Reload with medication info
      const result = await InstitutionPharmacyPrice.findByPk(price.id, {
        include: [{ model: Medication, as: 'medicine' }],
      });

      res.status(created ? 201 : 200).json({
        message: created ? 'Price created' : 'Price updated',
        data: result,
      });
    } catch (error) {
      logger.error('Error setting institution price:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * POST /pricing/batch
   * Set prices for multiple medications at once.
   * Body: { institution_id, prices: [{ medicine_id, market_price, nhia_price }] }
   */
  async batchSetPrices(req, res) {
    try {
      const { institution_id, prices } = req.body;

      if (!institution_id || !prices || !Array.isArray(prices)) {
        return res.status(400).json({ error: 'institution_id and prices array are required' });
      }

      const results = [];
      const errors = [];

      for (const item of prices) {
        try {
          if (!item.medicine_id) {
            errors.push({ medicine_id: null, error: 'medicine_id is required' });
            continue;
          }

          const [price, created] = await InstitutionPharmacyPrice.findOrCreate({
            where: { institution_id, medicine_id: item.medicine_id },
            defaults: {
              market_price: item.market_price || 0,
              nhia_price: item.nhia_price || 0,
              is_active: true,
            },
          });

          if (!created) {
            const updates = {};
            if (item.market_price !== undefined) updates.market_price = item.market_price;
            if (item.nhia_price !== undefined) updates.nhia_price = item.nhia_price;
            await price.update(updates);
          }

          results.push({ medicine_id: item.medicine_id, created });
        } catch (err) {
          errors.push({ medicine_id: item.medicine_id, error: err.message });
        }
      }

      res.json({
        message: `${results.length} prices set, ${errors.length} errors`,
        updated: results.length,
        errors,
      });
    } catch (error) {
      logger.error('Error batch-setting prices:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * DELETE /pricing/:id
   * Remove an institution price override.
   */
  async deletePrice(req, res) {
    try {
      const { institution_id } = req.query;
      const { id } = req.params;

      const price = await InstitutionPharmacyPrice.findByPk(id);
      if (!price) {
        return res.status(404).json({ error: 'Price not found' });
      }

      // Ensure the price belongs to this institution
      if (institution_id && price.institution_id !== institution_id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await price.destroy();
      res.json({ message: 'Price deleted' });
    } catch (error) {
      logger.error('Error deleting price:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /pricing/resolve
   * Resolve the effective price for a medication at an institution.
   * Priority: institution override → drug batch price → 0
   */
  async resolvePrice(req, res) {
    try {
      const { institution_id, medication_id } = req.query;

      if (!institution_id || !medication_id) {
        return res.status(400).json({ error: 'institution_id and medication_id are required' });
      }

      // 1. Check institution override
      const override = await InstitutionPharmacyPrice.findOne({
        where: { institution_id, medicine_id: medication_id, is_active: true },
      });

      if (override) {
        return res.json({
          source: 'institution_override',
          market_price: override.market_price || 0,
          nhia_price: override.nhia_price || 0,
        });
      }

      // 2. Fall back to latest active drug batch price
      const { DrugBatch } = require('../models');
      const batch = await DrugBatch.findOne({
        where: { institution_id, medication_id, status: 'active' },
        order: [['createdAt', 'DESC']],
      });

      if (batch) {
        return res.json({
          source: 'drug_batch',
          market_price: batch.selling_price || 0,
          nhia_price: batch.nhia_price || 0,
        });
      }

      // 3. No price found
      res.json({
        source: 'none',
        market_price: 0,
        nhia_price: 0,
      });
    } catch (error) {
      logger.error('Error resolving price:', error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = pricingController;
