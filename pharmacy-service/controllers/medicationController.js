const { Medication, DrugBatch } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const medicationController = {
  /**
   * GET /medications
   * List all medications with optional search and pagination
   */
  async getAll(req, res) {
    try {
      const { search, category, form, is_active, page = 1, limit = 50 } = req.query;
      const where = {};

      if (search) {
        where[Op.or] = [
          { generic_name: { [Op.iLike]: `%${search}%` } },
          { brand_name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ];
      }
      if (category) where.category = category;
      if (form) where.form = form;
      if (is_active !== undefined) where.is_active = is_active === 'true';

      const medications = await Medication.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['generic_name', 'ASC']],
      });

      res.json({
        total: medications.count,
        page: parseInt(page),
        pages: Math.ceil(medications.count / parseInt(limit)),
        data: medications.rows,
      });
    } catch (error) {
      logger.error('Error fetching medications:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /medications/:id
   * Get a single medication by ID with batch info
   */
  async getById(req, res) {
    try {
      const { institution_id } = req.query;
      const medication = await Medication.findByPk(req.params.id, {
        include: [
          {
            model: DrugBatch,
            as: 'batches',
            where: institution_id ? { institution_id, status: 'active' } : { status: 'active' },
            required: false,
          },
        ],
      });

      if (!medication) {
        return res.status(404).json({ error: 'Medication not found' });
      }

      // Compute total available stock across batches
      const totalStock = medication.batches.reduce((sum, b) => sum + b.current_quantity, 0);

      res.json({
        ...medication.toJSON(),
        total_available_stock: totalStock,
      });
    } catch (error) {
      logger.error('Error fetching medication:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * POST /medications
   * Create a new medication in the catalog
   */
  async create(req, res) {
    try {
      const { generic_name, brand_name, description, category, form, strength, unit, manufacturer, requires_prescription, is_controlled } = req.body;

      if (!generic_name) {
        return res.status(400).json({ error: 'generic_name is required' });
      }

      // Check for duplicate
      const existing = await Medication.findOne({ where: { generic_name } });
      if (existing) {
        return res.status(409).json({ error: 'Medication with this generic name already exists' });
      }

      const medication = await Medication.create({
        generic_name,
        brand_name,
        description,
        category,
        form,
        strength,
        unit,
        manufacturer,
        requires_prescription,
        is_controlled,
      });

      res.status(201).json(medication);
    } catch (error) {
      logger.error('Error creating medication:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * PUT /medications/:id
   * Update a medication
   */
  async update(req, res) {
    try {
      const medication = await Medication.findByPk(req.params.id);
      if (!medication) {
        return res.status(404).json({ error: 'Medication not found' });
      }

      const updatableFields = [
        'brand_name', 'description', 'category', 'form', 'strength',
        'unit', 'manufacturer', 'requires_prescription', 'is_controlled', 'is_active',
      ];

      const updates = {};
      updatableFields.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      await medication.update(updates);
      res.json(medication);
    } catch (error) {
      logger.error('Error updating medication:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * DELETE /medications/:id
   * Soft-delete (deactivate) a medication
   */
  async deactivate(req, res) {
    try {
      const medication = await Medication.findByPk(req.params.id);
      if (!medication) {
        return res.status(404).json({ error: 'Medication not found' });
      }

      await medication.update({ is_active: false });
      res.json({ message: 'Medication deactivated', id: medication.id });
    } catch (error) {
      logger.error('Error deactivating medication:', error);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * GET /medications/categories
   * Get all unique categories
   */
  async getCategories(req, res) {
    try {
      const categories = await Medication.findAll({
        attributes: ['category'],
        where: { category: { [Op.ne]: null }, is_active: true },
        group: ['category'],
        order: [['category', 'ASC']],
      });
      res.json(categories.map((c) => c.category));
    } catch (error) {
      logger.error('Error fetching categories:', error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = medicationController;
