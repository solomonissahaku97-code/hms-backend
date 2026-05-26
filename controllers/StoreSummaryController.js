const { Store, Item, InventoryRecord, Institution, Staff } = require('../models');
const sequelize = require('../config/database');
const Department = require('../models/department');
const { Op } = require('sequelize');

const StoreSummaryController = {
    async getSummary(req, res) {
        try {
            const { institutionId } = req.query;

            // Validate Institution
            const institution = await Institution.findByPk(institutionId);
            if (!institution) {
                return res.status(404).json({ message: 'Institution not found' });
            }

            // Aggregate store details
            const stores = await Store.findAll({
                where: { institution_id: institutionId },
                attributes: ['id', 'name', 'description'],
                include: [
                    {
                        model: Staff,
                        as: 'manager',
                        attributes: ['id', 'firstName'],
                    },
                    {
                        model: Item,
                        as: 'items',
                        attributes: ['id', 'name', 'quantity', 'unitCost', 'expiry_date'],
                    },
                ],
            });

            // Aggregate item-level statistics
            const totalItems = await Item.count({
                where: { institution_id: institutionId },
            });

            const totalItemQuantity = await Item.sum('quantity', {
                where: { institution_id: institutionId },
            });

            // Calculate total inventory value
            const items = await Item.findAll({
                where: { institution_id: institutionId },
                attributes: ['quantity', 'unitCost'],
            });

            const totalInventoryValue = items.reduce(
                (sum, item) => sum + item.quantity * item.unitCost,
                0
            );

            // Aggregate inventory records
            const inventoryRecords = await InventoryRecord.findAll({
                where: { institution_id: institutionId },
                attributes: [
                    'item_id',
                    'department_id',
                    'date',
                    [sequelize.fn('SUM', sequelize.col('InventoryRecord.quantity')), 'totalQuantity'],
                ],
                group: ['item_id', 'department_id', 'item.id', 'InventoryRecord.date', 'department.id'],
                include: [
                    {
                        model: Item,
                        as: 'item',
                        attributes: ['id', 'name'],
                    },
                    {
                        model: Department,
                        as: 'department',
                        attributes: ['id', 'name'],
                    },
                ],
            });

            // Expiry Alert
            const currentDate = new Date();
            const thresholdDate = new Date();
            thresholdDate.setDate(currentDate.getDate() + 30);

            const expiryAlert = await Item.findAll({
                where: {
                    institution_id: institutionId,
                    expiry_date: {
                        [Op.lte]: thresholdDate, // Items expiring within the next 30 days
                    },
                },
                attributes: ['id', 'name', 'quantity', 'expiry_date','unitCost'],
            });

            // Least Distributed Items
            const leastDistributedItems = inventoryRecords
                .filter((record) => record.getDataValue('totalQuantity') > 0)
                .sort((a, b) => a.getDataValue('totalQuantity') - b.getDataValue('totalQuantity'))
                .slice(0, 5)
                .map((record) => ({
                    itemName: record.item.name,
                    department: record.department.name,
                    totalDistributedQuantity: record.getDataValue('totalQuantity'),
                }));

            // Out of Stock Items
            const outOfStockItems = await Item.findAll({
                where: {
                    institution_id: institutionId,
                    quantity: {
                        [Op.lt]: 10, // Items with quantity less than 10
                    },
                },
                attributes: ['id', 'name', 'quantity'],
            });

            // Format data for charts
            const storeChartData = stores.map((store) => ({
                storeName: store.name,
                totalItems: store.items.length,
                totalQuantity: store.items.reduce((sum, item) => sum + item.quantity, 0),
                total_expected_amount: store.items.reduce(
                    (sum, item) => sum + item.quantity * item.unitCost,
                    0
                ),
                cost: store.items.map((item) => item.unitCost),
            }));

            const distributed_items = inventoryRecords.map((record) => ({
                itemName: record.item.name,
                department: record.department.name,
                totalDistributedQuantity: record.getDataValue('totalQuantity'),
                total_expected_amount:
                    record.item.unitCost * record.getDataValue('totalQuantity'),
                remaining_stock_of_the_item: record.item.quantity - record.getDataValue('totalQuantity'),
            }));

            // Response
            return res.status(200).json({
                institution: institution.name,
                totalStores: stores.length,
                totalItems,
                totalItemQuantity,
                totalInventoryValue,
                storeChartData,
                distributed_items,
                expiryAlert,
                leastDistributedItems,
                outOfStockItems,
            });
        } catch (error) {
            console.error('Error fetching store summary:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    },
};

module.exports = StoreSummaryController;
