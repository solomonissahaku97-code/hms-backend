
const { Op } = require('sequelize');
const LabInvestigation = require('../../models/claims/LabInvestigations');

// Create a new lab investigation
exports.create = async (req, res) => {
  try {
    const { test_description, g_drg_code, tariff_ghc,market_price } = req.body;
    
    // Validate required fields
    if (!test_description || !g_drg_code || !tariff_ghc) {
      return res.status(400).json({ error: 'All fields (test_description, g_drg_code, tariff_ghc) are required' });
    }

    const investigation = await LabInvestigation.create({
      test_description,
      g_drg_code,
      tariff_ghc,
      market_price
    });

    res.status(201).json(investigation);
  } catch (error) {
    console.error('Error creating lab investigation:', error);
    res.status(500).json({ error: 'Failed to create lab investigation' });
  }
};

// Get all lab investigations with pagination and search
exports.findAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where[Op.or] = [
        { test_description: { [Op.iLike]: `%${search}%` } },
        { g_drg_code: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await LabInvestigation.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['test_description', 'ASC']]
    });

    res.json({
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      investigations: rows
    });
  } catch (error) {
    console.error('Error fetching lab investigations:', error);
    res.status(500).json({ error: 'Failed to fetch lab investigations' });
  }
};

// Get a single lab investigation by ID
exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const investigation = await LabInvestigation.findByPk(id);

    if (!investigation) {
      return res.status(404).json({ error: 'Lab investigation not found' });
    }

    res.json(investigation);
  } catch (error) {
    console.error('Error fetching lab investigation:', error);
    res.status(500).json({ error: 'Failed to fetch lab investigation' });
  }
};

// Update a lab investigation
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { test_description, g_drg_code, tariff_ghc ,market_price} = req.body;

    const investigation = await LabInvestigation.findByPk(id);
    if (!investigation) {
      return res.status(404).json({ error: 'Lab investigation not found' });
    }

    // Only update fields that are provided
    if (test_description) investigation.test_description = test_description;
    if (g_drg_code) investigation.g_drg_code = g_drg_code;
    if (tariff_ghc) investigation.tariff_ghc = tariff_ghc;
    if (market_price) investigation.market_price = market_price;

    await investigation.save();

    res.json(investigation);
  } catch (error) {
    console.error('Error updating lab investigation:', error);
    res.status(500).json({ error: 'Failed to update lab investigation' });
  }
};

// Delete a lab investigation
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const investigation = await LabInvestigation.findByPk(id);

    if (!investigation) {
      return res.status(404).json({ error: 'Lab investigation not found' });
    }

    await investigation.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting lab investigation:', error);
    res.status(500).json({ error: 'Failed to delete lab investigation' });
  }
};

// Search lab investigations by test description or G-DRG code
exports.search = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const investigations = await LabInvestigation.findAll({
      where: {
        [Op.or]: [
          { test_description: { [Op.iLike]: `%${query}%` } },
          { g_drg_code: { [Op.iLike]: `%${query}%` } }
        ]
      },
      limit: 50
    });

    res.json(investigations);
  } catch (error) {
    console.error('Error searching lab investigations:', error);
    res.status(500).json({ error: 'Failed to search lab investigations' });
  }
};