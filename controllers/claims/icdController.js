const { Op } = require('sequelize');
const { validationResult } = require('express-validator');
const systemDiagnosis = require('../../models/claims/systemDiagnosis');
const { isUUID } = require('validator');

// Enhanced error handler
const handleError = (res, error, status = 500) => {
  console.error('Error:', error);
  return res.status(status).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

// Create a new diagnosis
exports.createDiagnosis = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    // Check for duplicate ICD-10 code
    const existing = await systemDiagnosis.findOne({ 
      where: { icd_10_code: req.body.icd_10_code } 
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Diagnosis with this ICD-10 code already exists'
      });
    }

    const diagnosis = await systemDiagnosis.create(req.body);
    return res.status(201).json({
      success: true,
      data: diagnosis
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get all diagnoses with optional filters
exports.getAllDiagnoses = async (req, res) => {
  try {
    const { gender, search } = req.query;
    const where = {};
    
    if (gender) where.gender = gender;
    if (search) {
      where[Op.or] = [
        { icd_10_code: { [Op.iLike]: `%${search}%` } },
        { diagnosis_name: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const diagnoses = await systemDiagnosis.findAll({
      where,
      order: [['diagnosis_name', 'ASC']],
      attributes: { exclude: ['createdAt', 'updatedAt'] } // Explicitly exclude timestamps if needed
    });
    
    return res.status(200).json({
      success: true,
      count: diagnoses.length,
      data: diagnoses
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get single diagnosis by ID with UUID validation
exports.getDiagnosisById = async (req, res) => {
  try {
    if (!isUUID(req.params.id, 4)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid diagnosis ID format'
      });
    }

    const diagnosis = await systemDiagnosis.findByPk(req.params.id, {
      attributes: { exclude: ['createdAt', 'updatedAt'] }
    });

    if (!diagnosis) {
      return res.status(404).json({
        success: false,
        message: 'Diagnosis not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: diagnosis
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update diagnosis with UUID validation
exports.updateDiagnosis = async (req, res) => {
  try {
    if (!isUUID(req.params.id, 4)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid diagnosis ID format'
      });
    }

    const [updated] = await systemDiagnosis.update(req.body, {
      where: { id: req.params.id }
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Diagnosis not found or no changes made'
      });
    }

    const updatedDiagnosis = await systemDiagnosis.findByPk(req.params.id, {
      attributes: { exclude: ['createdAt', 'updatedAt'] }
    });

    return res.status(200).json({
      success: true,
      data: updatedDiagnosis
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Delete diagnosis with UUID validation
exports.deleteDiagnosis = async (req, res) => {
  try {
    if (!isUUID(req.params.id, 4)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid diagnosis ID format'
      });
    }

    const deleted = await systemDiagnosis.destroy({
      where: { id: req.params.id }
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Diagnosis not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Diagnosis deleted successfully'
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Advanced search diagnosis
exports.searchDiagnoses = async (req, res) => {
  try {
    const { 
      q, // general search term
      icd_code, 
      name, 
      gender,
      category,
      is_chronic,
      is_surgical,
      min_rank,
      max_rank,
      limit = 10,
      offset = 0
    } = req.query;

    const where = {};
    
    // Build search conditions
    if (q) {
      where[Op.or] = [
        { icd_10_code: { [Op.iLike]: `%${q}%` } },
        { diagnosis_name: { [Op.iLike]: `%${q}%` } },
        // { description: { [Op.iLike]: `%${q}%` } }
      ];
    }

    // Specific field searches
    if (icd_code) where.icd_10_code = { [Op.iLike]: `%${icd_code}%` };
    if (name) where.diagnosis_name = { [Op.iLike]: `%${name}%` };
    if (gender) where.gender = gender;
    if (category) where.category = category;
    if (is_chronic) where.is_chronic = is_chronic === 'true';
    if (is_surgical) where.is_surgical = is_surgical === 'true';
    
    // Numeric range search
    if (min_rank || max_rank) {
      where.rank = {};
      if (min_rank) where.rank[Op.gte] = min_rank;
      if (max_rank) where.rank[Op.lte] = max_rank;
    }

    // Perform search with pagination
    const { count, rows } = await systemDiagnosis.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['diagnosis_name', 'ASC']],
      attributes: { exclude: ['createdAt', 'updatedAt'] }
    });

    return res.status(200).json({
      success: true,
      count,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      data: rows
    });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error searching diagnoses',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};




