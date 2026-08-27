const { Bed, Department } = require('../models');

exports.getAllBeds = async (req, res) => {
  try {
    const { institution_id, department_id, status } = req.query;
    const where = {};
    if (institution_id) where.institution_id = institution_id;
    if (department_id) where.department_id = department_id;
    if (status) where.status = status;

    const beds = await Bed.findAll({
      where,
      include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
      order: [['bed_number', 'ASC']],
    });

    res.json({ success: true, data: beds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addBeds = async (req, res) => {
  try {
    const { department_id, institution_id, count } = req.body;
    if (!department_id || !institution_id || !count || count <= 0) {
      return res.status(400).json({ error: 'department_id, institution_id, and positive count required' });
    }

    const lastBed = await Bed.findOne({
      where: { department_id, institution_id },
      order: [['bed_number', 'DESC']],
    });

    let startingNumber = 1;
    if (lastBed) {
      const num = parseInt(lastBed.bed_number);
      if (!isNaN(num)) startingNumber = num + 1;
    }

    const newBeds = [];
    for (let i = 0; i < count; i++) {
      newBeds.push({
        bed_number: String(startingNumber + i),
        department_id, institution_id,
        status: 'available', is_occupied: false,
      });
    }

    const created = await Bed.bulkCreate(newBeds);
    res.status(201).json({ success: true, message: `Added ${count} beds`, data: created });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateBedStatus = async (req, res) => {
  try {
    const { bed_id, status } = req.body;
    const bed = await Bed.findByPk(bed_id);
    if (!bed) return res.status(404).json({ error: 'Bed not found' });

    await bed.update({ status });
    res.json({ success: true, data: bed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteBed = async (req, res) => {
  try {
    const bed = await Bed.findByPk(req.params.id);
    if (!bed) return res.status(404).json({ error: 'Bed not found' });
    if (bed.is_occupied) return res.status(400).json({ error: 'Cannot delete occupied bed' });

    await bed.destroy();
    res.json({ success: true, message: 'Bed deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getBedsSummary = async (req, res) => {
  try {
    const { institution_id } = req.query;
    if (!institution_id) return res.status(400).json({ error: 'institution_id required' });

    const allBeds = await Bed.findAll({
      where: { institution_id },
      include: [{ model: Department, as: 'department' }],
    });

    const total = allBeds.length;
    const occupied = allBeds.filter(b => b.is_occupied).length;
    const available = allBeds.filter(b => b.status === 'available').length;
    const faulty = allBeds.filter(b => b.status === 'faulty').length;

    const byDepartment = {};
    allBeds.forEach(bed => {
      const dept = bed.department?.name || 'Unknown';
      if (!byDepartment[dept]) byDepartment[dept] = { total: 0, occupied: 0, available: 0 };
      byDepartment[dept].total++;
      if (bed.is_occupied) byDepartment[dept].occupied++;
      else if (bed.status === 'available') byDepartment[dept].available++;
    });

    res.json({
      success: true,
      data: {
        total, occupied, available, faulty,
        occupancyRate: total ? ((occupied / total) * 100).toFixed(1) : 0,
        byDepartment,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
