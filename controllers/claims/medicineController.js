const { Op } = require("sequelize");
const Medicine = require("../../models/claims/medication");

// Utility function for error handling
const handleError = (res, error, action = 'process') => {
  console.error(`${action} Error:`, error);
  return res.status(500).json({ 
    success: false,
    message: `Failed to ${action} NHIA Medication`,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// Create a new NHIAMedication with validation
const createNHIAMedication = async (req, res) => {
  try {
    const { code, name, price } = req.body;
    
    // Basic validation
    if (!code || !name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, name, and price are mandatory'
      });
    }

    // Check for duplicate code
    const existingMed = await Medicine.findByPk(code);
    if (existingMed) {
      return res.status(409).json({
        success: false,
        message: 'Medication with this code already exists'
      });
    }

    const medication = await Medicine.create(req.body);
    return res.status(201).json({
      success: true,
      data: medication,
      message: 'NHIA Medication created successfully'
    });

  } catch (error) {
    return handleError(res, error, 'create');
  }
};

// Get all NHIAMedications with pagination
const getAllNHIAMedications = async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    const { count, rows } = await Medicine.findAndCountAll({
      limit: Number(pageSize),
      offset: Number(offset),
      order: [['code', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(count / pageSize)
      }
    });

  } catch (error) {
    return handleError(res, error, 'fetch');
  }
};

// Get single NHIAMedication by code
const getNHIAMedicationByName = async (req, res) => {
  try {
    const medication = await Medicine.findAll({
      where: { 
        generic_name: {
          [Op.iLike]: `%${req.params.name}%` // Case-insensitive partial match
        }
      }
    });
    
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: medication
    });

  } catch (error) {
    return handleError(res, error, 'fetch');
  }
};

// Update NHIAMedication with validation
const updateNHIAMedication = async (req, res) => {
  try {
    const { code } = req.params;
    const updates = req.body;

    // Don't allow changing the primary key
    if (updates.code && updates.code !== code) {
      return res.status(400).json({
        success: false,
        message: 'Changing medication code is not allowed'
      });
    }

    const [affectedRows] = await Medicine.update(updates, {
      where: { code }
    });

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'NHIA Medication not found or no changes made'
      });
    }

    const updatedMedication = await Medicine.findByPk(code);
    return res.status(200).json({
      success: true,
      data: updatedMedication,
      message: 'NHIA Medication updated successfully'
    });

  } catch (error) {
    return handleError(res, error, 'update');
  }
};

// Delete NHIAMedication
const deleteNHIAMedication = async (req, res) => {
  try {
    const { code } = req.params;
    const deleted = await Medicine.destroy({ where: { code } });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'NHIA Medication not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'NHIA Medication deleted successfully'
    });

  } catch (error) {
    return handleError(res, error, 'delete');
  }
};

module.exports = {
  createNHIAMedication,
  getAllNHIAMedications,
  getNHIAMedicationByName,
  updateNHIAMedication,
  deleteNHIAMedication
};