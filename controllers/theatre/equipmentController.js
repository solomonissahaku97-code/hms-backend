const TheatreEquipment = require('../../models/theatre/TheatreEquipment');
const OperatingRoom = require('../../models/theatre/OperatingRoom');
const { Op } = require('sequelize');

// Create new equipment
exports.createEquipment = async (req, res) => {
  try {
    const {
      name,
      serial_number,
      model,
      category,
      room_id,
      purchase_date,
      warranty_expiry,
      notes,
      is_portable,
      manufacturer
    } = req.body;

    // Check if serial number already exists
    if (serial_number) {
      const existing = await TheatreEquipment.findOne({ where: { serial_number } });
      if (existing) {
        return res.status(400).json({ error: 'Equipment with this serial number already exists' });
      }
    }

    const equipment = await TheatreEquipment.create({
      name,
      serial_number,
      model,
      category: category || 'other',
      room_id,
      purchase_date,
      warranty_expiry,
      notes,
      is_portable: is_portable || false,
      manufacturer,
      status: 'available'
    });

    res.status(201).json({
      message: 'Equipment created successfully',
      data: equipment
    });
  } catch (error) {
    console.error('Error creating equipment:', error);
    res.status(500).json({
      error: 'Failed to create equipment',
      details: error.message
    });
  }
};

// Get all equipment
exports.getAllEquipment = async (req, res) => {
  try {
    const { category, status, room_id, search } = req.query;
    
    const where = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (room_id) where.room_id = room_id;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { serial_number: { [Op.iLike]: `%${search}%` } },
        { model: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const equipment = await TheatreEquipment.findAll({
      where,
      include: [{
        model: OperatingRoom,
        as: 'room',
        attributes: ['id', 'room_number', 'room_name']
      }],
      order: [['name', 'ASC']]
    });

    res.status(200).json({
      message: 'Equipment fetched successfully',
      data: equipment
    });
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({
      error: 'Failed to fetch equipment',
      details: error.message
    });
  }
};

// Get equipment by ID
exports.getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const equipment = await TheatreEquipment.findByPk(id, {
      include: [{
        model: OperatingRoom,
        as: 'room',
        attributes: ['id', 'room_number', 'room_name']
      }]
    });

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    res.status(200).json({
      message: 'Equipment fetched successfully',
      data: equipment
    });
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({
      error: 'Failed to fetch equipment',
      details: error.message
    });
  }
};

// Update equipment
exports.updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const equipment = await TheatreEquipment.findByPk(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Check for duplicate serial number
    if (updates.serial_number && updates.serial_number !== equipment.serial_number) {
      const existing = await TheatreEquipment.findOne({ where: { serial_number: updates.serial_number } });
      if (existing) {
        return res.status(400).json({ error: 'Equipment with this serial number already exists' });
      }
    }

    await equipment.update(updates);

    res.status(200).json({
      message: 'Equipment updated successfully',
      data: equipment
    });
  } catch (error) {
    console.error('Error updating equipment:', error);
    res.status(500).json({
      error: 'Failed to update equipment',
      details: error.message
    });
  }
};

// Delete equipment
exports.deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params;

    const equipment = await TheatreEquipment.findByPk(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    if (equipment.status === 'in-use') {
      return res.status(400).json({ error: 'Cannot delete equipment that is currently in use' });
    }

    await equipment.destroy();

    res.status(200).json({
      message: 'Equipment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    res.status(500).json({
      error: 'Failed to delete equipment',
      details: error.message
    });
  }
};

// Transfer equipment to another room
exports.transferEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const { room_id, notes } = req.body;

    const equipment = await TheatreEquipment.findByPk(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    if (equipment.status === 'in-use') {
      return res.status(400).json({ error: 'Cannot transfer equipment that is currently in use' });
    }

    await equipment.update({
      room_id,
      notes: notes ? `${equipment.notes}\nTransferred: ${notes}` : equipment.notes
    });

    res.status(200).json({
      message: 'Equipment transferred successfully',
      data: equipment
    });
  } catch (error) {
    console.error('Error transferring equipment:', error);
    res.status(500).json({
      error: 'Failed to transfer equipment',
      details: error.message
    });
  }
};

// Schedule maintenance
exports.scheduleMaintenance = async (req, res) => {
  try {
    const { id } = req.params;
    const { next_maintenance_date, notes } = req.body;

    const equipment = await TheatreEquipment.findByPk(id);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const maintenanceRecord = {
      date: new Date(),
      type: 'scheduled',
      notes,
      performed_by: req.user?.id || 'system'
    };

    const maintenanceHistory = [...(equipment.maintenance_history || []), maintenanceRecord];

    await equipment.update({
      status: 'maintenance',
      last_maintenance_date: new Date(),
      next_maintenance_date,
      maintenance_history: maintenanceHistory
    });

    res.status(200).json({
      message: 'Maintenance scheduled successfully',
      data: equipment
    });
  } catch (error) {
    console.error('Error scheduling maintenance:', error);
    res.status(500).json({
      error: 'Failed to schedule maintenance',
      details: error.message
    });
  }
};

// Get equipment requiring maintenance
exports.getEquipmentNeedingMaintenance = async (req, res) => {
  try {
    const today = new Date();
    
    const equipment = await TheatreEquipment.findAll({
      where: {
        [Op.or]: [
          { next_maintenance_date: { [Op.lte]: today } },
          { status: 'maintenance' }
        ]
      },
      include: [{
        model: OperatingRoom,
        as: 'room',
        attributes: ['id', 'room_number', 'room_name']
      }],
      order: [['next_maintenance_date', 'ASC']]
    });

    res.status(200).json({
      message: 'Equipment needing maintenance fetched successfully',
      data: equipment
    });
  } catch (error) {
    console.error('Error fetching equipment needing maintenance:', error);
    res.status(500).json({
      error: 'Failed to fetch equipment',
      details: error.message
    });
  }
};

// Get equipment statistics
exports.getEquipmentStatistics = async (req, res) => {
  try {
    const total = await TheatreEquipment.count();
    
    const statusCounts = await TheatreEquipment.findAll({
      attributes: [
        'status',
        [TheatreEquipment.sequelize.fn('COUNT', TheatreEquipment.sequelize.col('status')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const categoryCounts = await TheatreEquipment.findAll({
      attributes: [
        'category',
        [TheatreEquipment.sequelize.fn('COUNT', TheatreEquipment.sequelize.col('category')), 'count']
      ],
      group: ['category'],
      raw: true
    });

    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingMaintenance = await TheatreEquipment.count({
      where: {
        next_maintenance_date: {
          [Op.between]: [today, thirtyDaysFromNow]
        }
      }
    });

    const stats = {
      total,
      available: 0,
      in_use: 0,
      maintenance: 0,
      retired: 0,
      out_of_service: 0,
      upcoming_maintenance: upcomingMaintenance
    };

    statusCounts.forEach(item => {
      stats[item.status.replace('-', '_')] = parseInt(item.count);
    });

    stats.by_category = categoryCounts.reduce((acc, item) => {
      acc[item.category] = parseInt(item.count);
      return acc;
    }, {});

    res.status(200).json({
      message: 'Equipment statistics fetched successfully',
      data: stats
    });
  } catch (error) {
    console.error('Error fetching equipment statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error.message
    });
  }
};

