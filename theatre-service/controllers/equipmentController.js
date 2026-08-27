const { TheatreEquipment, OperatingRoom } = require('../models');
const { Op } = require('sequelize');

exports.createEquipment = async (req, res) => {
  try {
    const { name, serial_number, model, category, room_id, purchase_date, warranty_expiry, notes, is_portable, manufacturer } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    if (serial_number) {
      const existing = await TheatreEquipment.findOne({ where: { serial_number } });
      if (existing) return res.status(400).json({ error: 'Serial number already exists' });
    }

    const equipment = await TheatreEquipment.create({ name, serial_number, model, category: category || 'other', room_id, purchase_date, warranty_expiry, notes, is_portable: is_portable || false, manufacturer, status: 'available' });
    res.status(201).json({ message: 'Equipment created', data: equipment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create equipment', details: err.message });
  }
};

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

    const equipment = await TheatreEquipment.findAll({ where, include: [{ model: OperatingRoom, as: 'room', attributes: ['id', 'room_number', 'room_name'] }], order: [['name', 'ASC']] });
    res.json({ data: equipment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch equipment', details: err.message });
  }
};

exports.getEquipmentById = async (req, res) => {
  try {
    const equipment = await TheatreEquipment.findByPk(req.params.id, { include: [{ model: OperatingRoom, as: 'room', attributes: ['id', 'room_number', 'room_name'] }] });
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });
    res.json({ data: equipment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch equipment', details: err.message });
  }
};

exports.updateEquipment = async (req, res) => {
  try {
    const equipment = await TheatreEquipment.findByPk(req.params.id);
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });

    if (req.body.serial_number && req.body.serial_number !== equipment.serial_number) {
      const dup = await TheatreEquipment.findOne({ where: { serial_number: req.body.serial_number } });
      if (dup) return res.status(400).json({ error: 'Serial number already exists' });
    }

    await equipment.update(req.body);
    res.json({ message: 'Equipment updated', data: equipment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update equipment', details: err.message });
  }
};

exports.deleteEquipment = async (req, res) => {
  try {
    const equipment = await TheatreEquipment.findByPk(req.params.id);
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });
    if (equipment.status === 'in-use') return res.status(400).json({ error: 'Cannot delete equipment in use' });

    await equipment.destroy();
    res.json({ message: 'Equipment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete equipment', details: err.message });
  }
};

exports.transferEquipment = async (req, res) => {
  try {
    const equipment = await TheatreEquipment.findByPk(req.params.id);
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });
    if (equipment.status === 'in-use') return res.status(400).json({ error: 'Cannot transfer equipment in use' });

    await equipment.update({ room_id: req.body.room_id, notes: req.body.notes ? `${equipment.notes}\nTransferred: ${req.body.notes}` : equipment.notes });
    res.json({ message: 'Equipment transferred', data: equipment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to transfer equipment', details: err.message });
  }
};

exports.scheduleMaintenance = async (req, res) => {
  try {
    const equipment = await TheatreEquipment.findByPk(req.params.id);
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });

    const record = { date: new Date(), type: 'scheduled', notes: req.body.notes, performed_by: req.user?.id || 'system' };
    const history = [...(equipment.maintenance_history || []), record];

    await equipment.update({ status: 'maintenance', last_maintenance_date: new Date(), next_maintenance_date: req.body.next_maintenance_date, maintenance_history: history });
    res.json({ message: 'Maintenance scheduled', data: equipment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule maintenance', details: err.message });
  }
};

exports.getNeedingMaintenance = async (req, res) => {
  try {
    const today = new Date();
    const equipment = await TheatreEquipment.findAll({
      where: { [Op.or]: [{ next_maintenance_date: { [Op.lte]: today } }, { status: 'maintenance' }] },
      include: [{ model: OperatingRoom, as: 'room', attributes: ['id', 'room_number', 'room_name'] }],
      order: [['next_maintenance_date', 'ASC']]
    });
    res.json({ data: equipment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch equipment', details: err.message });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const total = await TheatreEquipment.count();
    const statusCounts = await TheatreEquipment.findAll({
      attributes: ['status', [TheatreEquipment.sequelize.fn('COUNT', TheatreEquipment.sequelize.col('status')), 'count']],
      group: ['status'], raw: true
    });
    const categoryCounts = await TheatreEquipment.findAll({
      attributes: ['category', [TheatreEquipment.sequelize.fn('COUNT', TheatreEquipment.sequelize.col('category')), 'count']],
      group: ['category'], raw: true
    });

    const today = new Date();
    const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30);
    const upcomingMaintenance = await TheatreEquipment.count({ where: { next_maintenance_date: { [Op.between]: [today, thirtyDays] } } });

    const stats = { total, available: 0, 'in-use': 0, maintenance: 0, retired: 0, 'out-of-service': 0, upcoming_maintenance: upcomingMaintenance, by_category: {} };
    statusCounts.forEach(item => { stats[item.status] = parseInt(item.count); });
    stats.by_category = categoryCounts.reduce((acc, item) => { acc[item.category] = parseInt(item.count); return acc; }, {});

    res.json({ data: stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
};
