const { CaseCart, CaseCartItem, OperatingRoom } = require('../models');
const { Op } = require('sequelize');

const generateCartNumber = async () => {
  const year = new Date().getFullYear();
  const count = await CaseCart.count({ where: { cart_number: { [Op.like]: `CC-${year}-%` } } });
  return `CC-${year}-${String(count + 1).padStart(4, '0')}`;
};

const calculateCompletion = async (caseCartId) => {
  const items = await CaseCartItem.findAll({ where: { case_cart_id: caseCartId } });
  if (items.length === 0) return 0;
  const ready = items.filter(i => i.status === 'ready' || i.status === 'used');
  return Math.round((ready.length / items.length) * 100);
};

// ── Case Cart CRUD ──────────────────────────────────────────────

exports.createCaseCart = async (req, res) => {
  try {
    const { visit_id, theatre_booking_id, procedure, surgeon_id, surgeon_name, scheduled_date, scheduled_time, assigned_to, assigned_to_name, operating_room_id, priority, notes, items } = req.body;
    if (!visit_id || !procedure) return res.status(400).json({ error: 'visit_id and procedure are required' });

    const cart_number = await generateCartNumber();
    const caseCart = await CaseCart.create({ cart_number, visit_id, theatre_booking_id, procedure, surgeon_id, surgeon_name, scheduled_date, scheduled_time, assigned_to, assigned_to_name, operating_room_id, priority: priority || 'normal', notes, status: 'not-started', completion_percentage: 0 });

    if (items && items.length > 0) {
      for (const item of items) {
        await CaseCartItem.create({ case_cart_id: caseCart.id, name: item.name, category: item.category || 'other', status: 'pending', quantity: item.quantity || 1, notes: item.notes, location: item.location, item_type: item.item_type || 'custom' });
      }
    }

    const result = await CaseCart.findByPk(caseCart.id, { include: [{ model: CaseCartItem, as: 'items' }, { model: OperatingRoom, as: 'operatingRoom' }] });
    res.status(201).json({ message: 'Case cart created', data: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create case cart', details: err.message });
  }
};

exports.getAllCaseCarts = async (req, res) => {
  try {
    const { status, priority, date, surgeon_id } = req.query;
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (surgeon_id) where.surgeon_id = surgeon_id;
    if (date) where.scheduled_date = date;

    const carts = await CaseCart.findAll({
      where, include: [
        { model: CaseCartItem, as: 'items' },
        { model: OperatingRoom, as: 'operatingRoom', attributes: ['id', 'room_number', 'room_name'] }
      ],
      order: [['priority', 'DESC'], ['scheduled_date', 'ASC'], ['scheduled_time', 'ASC']]
    });
    res.json({ data: carts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case carts', details: err.message });
  }
};

exports.getCaseCartById = async (req, res) => {
  try {
    const cart = await CaseCart.findByPk(req.params.id, {
      include: [
        { model: CaseCartItem, as: 'items' },
        { model: OperatingRoom, as: 'operatingRoom' }
      ]
    });
    if (!cart) return res.status(404).json({ error: 'Case cart not found' });
    res.json({ data: cart });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case cart', details: err.message });
  }
};

exports.updateCaseCart = async (req, res) => {
  try {
    const cart = await CaseCart.findByPk(req.params.id);
    if (!cart) return res.status(404).json({ error: 'Case cart not found' });

    await cart.update(req.body);
    if (req.body.status) {
      const completion = await calculateCompletion(req.params.id);
      await cart.update({ completion_percentage: completion });
    }

    const result = await CaseCart.findByPk(req.params.id, { include: [{ model: CaseCartItem, as: 'items' }, { model: OperatingRoom, as: 'operatingRoom' }] });
    res.json({ message: 'Case cart updated', data: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update case cart', details: err.message });
  }
};

exports.deleteCaseCart = async (req, res) => {
  try {
    const cart = await CaseCart.findByPk(req.params.id);
    if (!cart) return res.status(404).json({ error: 'Case cart not found' });

    await CaseCartItem.destroy({ where: { case_cart_id: req.params.id } });
    await cart.destroy();
    res.json({ message: 'Case cart deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete case cart', details: err.message });
  }
};

// ── Case Cart Items ─────────────────────────────────────────────

exports.addItem = async (req, res) => {
  try {
    const cart = await CaseCart.findByPk(req.params.case_cart_id);
    if (!cart) return res.status(404).json({ error: 'Case cart not found' });

    const item = await CaseCartItem.create({ case_cart_id: req.params.case_cart_id, name: req.body.name, category: req.body.category || 'other', status: 'pending', quantity: req.body.quantity || 1, notes: req.body.notes, location: req.body.location, item_type: req.body.item_type || 'custom', inventory_item_id: req.body.inventory_item_id, batch_number: req.body.batch_number, expiry_date: req.body.expiry_date });

    const completion = await calculateCompletion(req.params.case_cart_id);
    await cart.update({ completion_percentage: completion, status: completion > 0 ? 'in-progress' : 'not-started' });

    res.status(201).json({ data: item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add item', details: err.message });
  }
};

exports.updateItemStatus = async (req, res) => {
  try {
    const item = await CaseCartItem.findByPk(req.params.item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const updateData = { status: req.body.status };
    if (req.body.prepared_by) updateData.prepared_by = req.body.prepared_by;
    if (req.body.status === 'ready') updateData.prepared_at = new Date();
    if (req.body.notes) updateData.notes = req.body.notes;

    await item.update(updateData);

    const completion = await calculateCompletion(item.case_cart_id);
    const cart = await CaseCart.findByPk(item.case_cart_id);
    let cartStatus = cart.status;
    if (completion === 100 && cartStatus !== 'confirmed') cartStatus = 'ready';
    else if (completion > 0 && cartStatus === 'not-started') cartStatus = 'in-progress';
    await cart.update({ completion_percentage: completion, status: cartStatus });

    res.json({ data: item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item', details: err.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const item = await CaseCartItem.findByPk(req.params.item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const caseCartId = item.case_cart_id;
    await item.destroy();

    const completion = await calculateCompletion(caseCartId);
    await CaseCart.update({ completion_percentage: completion }, { where: { id: caseCartId } });

    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item', details: err.message });
  }
};

// ── Case Cart Actions ───────────────────────────────────────────

exports.confirmCaseCart = async (req, res) => {
  try {
    const cart = await CaseCart.findByPk(req.params.id);
    if (!cart) return res.status(404).json({ error: 'Case cart not found' });

    const items = await CaseCartItem.findAll({ where: { case_cart_id: req.params.id } });
    if (!items.every(i => i.status === 'ready' || i.status === 'used')) {
      return res.status(400).json({ error: 'Not all items are ready' });
    }

    await cart.update({ status: 'confirmed', confirmed_at: new Date(), confirmed_by: req.body.confirmed_by });
    res.json({ message: 'Case cart confirmed', data: cart });
  } catch (err) {
    res.status(500).json({ error: 'Failed to confirm', details: err.message });
  }
};

exports.markAsUsed = async (req, res) => {
  try {
    const cart = await CaseCart.findByPk(req.params.id);
    if (!cart) return res.status(404).json({ error: 'Case cart not found' });

    await cart.update({ status: 'used' });
    await CaseCartItem.update({ status: 'used' }, { where: { case_cart_id: req.params.id } });

    res.json({ message: 'Case cart marked as used', data: cart });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as used', details: err.message });
  }
};
