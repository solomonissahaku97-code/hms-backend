const { DrugHistory } = require('../models');

exports.create = async (req, res) => {
  try {
    const record = await DrugHistory.create(req.body);
    res.status(201).json({ data: record });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAll = async (req, res) => {
  try {
    const where = req.query.visit_id ? { visit_id: req.query.visit_id } : {};
    const records = await DrugHistory.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ data: records });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getById = async (req, res) => {
  try {
    const record = await DrugHistory.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json({ data: record });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const record = await DrugHistory.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    await record.update(req.body);
    res.json({ data: record });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    const record = await DrugHistory.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    await record.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
