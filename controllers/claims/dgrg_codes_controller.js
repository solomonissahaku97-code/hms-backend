const GDRGCode = require("../../models/claims/GDRGCode");

// Create a new GDRG code
exports.createGDRGCode = async (req, res) => {
  try {
    const { code, description, condition, category, price } = req.body;
    
    // Check if code already exists
    const existingCode = await GDRGCode.findByPk(code);
    if (existingCode) {
      return res.status(400).json({ error: 'Code already exists' });
    }

    const newCode = await GDRGCode.create({
      code,
      description,
      condition,
      category,
      price
    });

    res.status(201).json(newCode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all GDRG codes
exports.getAllGDRGCodes = async (req, res) => {
  try {
    const codes = await GDRGCode.findAll();
    res.json(codes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single GDRG code by code
exports.getGDRGCodeByCode = async (req, res) => {
  try {
    const code = req.params.code;
    const gdrgCode = await GDRGCode.findByPk(code);
    
    if (!gdrgCode) {
      return res.status(404).json({ error: 'GDRG code not found' });
    }
    
    res.json(gdrgCode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a GDRG code
exports.updateGDRGCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, condition, category, market_price,nhia_price,is_nhia_covered } = req.body;
    
    const gdrgCode = await GDRGCode.findByPk(id);
    if (!gdrgCode) {
      return res.status(404).json({ error: 'GDRG code not found' });
    }

    // Update only the fields that are provided
    if (description !== undefined) gdrgCode.description = description;
    if (condition !== undefined) gdrgCode.condition = condition;
    if (category !== undefined) gdrgCode.category = category;
    if (market_price !== undefined) gdrgCode.market_price = market_price;
    if (nhia_price !== undefined) gdrgCode.nhia_price = nhia_price;
    if (is_nhia_covered !== undefined) gdrgCode.is_nhia_covered = is_nhia_covered;

    await gdrgCode.save();
    
    res.json(gdrgCode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a GDRG code
exports.deleteGDRGCode = async (req, res) => {
  try {
    const code = req.params.code;
    const gdrgCode = await GDRGCode.findByPk(code);
    
    if (!gdrgCode) {
      return res.status(404).json({ error: 'GDRG code not found' });
    }

    await gdrgCode.destroy();
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Search GDRG codes (optional)
exports.searchGDRGCodes = async (req, res) => {
  try {
    const { query } = req.query;
    
    const codes = await GDRGCode.findAll({
      where: {
        [Op.or]: [
          { code: { [Op.like]: `%${query}%` } },
          { description: { [Op.like]: `%${query}%` } },
          { condition: { [Op.like]: `%${query}%` } },
          { category: { [Op.like]: `%${query}%` } }
        ]
      }
    });
    
    res.json(codes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};