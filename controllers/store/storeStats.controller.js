const db = require('../../models');

const {
  Item,
  ItemBatch,
  StockAlert,
  StockRequest,
  ExpiredItem,
  Supplier,
} = db;

const getStoreStats = async (req, res) => {
  try {
    const { institution_id } = req.query;

    const totalItems = await Item.count();

    const batches = await ItemBatch.findAll({
      where: { institution_id, status: 'active' },
      include: [{ model: Item, as: 'item' }],
    });

    const totalValue = batches.reduce((sum, batch) => {
      return (
        sum +
        (parseFloat(batch.current_quantity || 0) *
          parseFloat(batch.unit_cost || 0))
      );
    }, 0);

    const lowStockAlerts = await StockAlert.findAll({
      where: {
        institution_id,
        alert_type: 'low_stock',
        is_resolved: false,
      },
      include: [{ model: Item, as: 'item' }],
    });

    const pendingRequests = await StockRequest.count({
      where: {
        institution_id,
        status: 'pending',
      },
    });

    const expiredItems = await ExpiredItem.count({
      where: { institution_id },
    });

    const totalSuppliers = await Supplier.count({
      where: { institution_id, is_active: true },
    });

    res.json({
      totalItems,
      totalValue: totalValue.toFixed(2),
      lowStockAlerts: lowStockAlerts.length,
      pendingRequests,
      expiredItems,
      totalSuppliers,
    });
  } catch (error) {
    console.error('Error fetching store stats:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getStoreStats,
};

