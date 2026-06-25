const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

// Import db to get all models with associations properly set up
const db = require('../models');
const { Item, ItemBatch, Supplier, StockRequest, StockRequestItem, StockTransfer, StockTransferItem, StockAdjustment, StockAlert, PurchaseOrder, PurchaseOrderItem, InventoryRecord, IssuedItem, ExpiredItem } = db;

// ============================================
// STORE STATISTICS & DASHBOARD
// ============================================

// Get store statistics
router.get('/store-stats', async (req, res) => {
    try {
        const { institution_id } = req.query;
        
        // Get total items count
        const totalItems = await Item.count();

        // Get total stock value
        const batches = await ItemBatch.findAll({
            where: { institution_id, status: 'active' },
            include: [{ model: Item, as: 'item' }]
        });
        
        const totalValue = batches.reduce((sum, batch) => {
            return sum + (parseFloat(batch.current_quantity || 0) * parseFloat(batch.unit_cost || 0));
        }, 0);

        // Get low stock alerts
        const lowStockAlerts = await StockAlert.findAll({
            where: { 
                institution_id,
                alert_type: 'low_stock',
                is_resolved: false
            },
            include: [{ model: Item, as: 'item' }]
        });

        // Get pending requests
        const pendingRequests = await StockRequest.count({
            where: { 
                institution_id,
                status: 'pending'
            }
        });

        // Get expired items count
        const expiredItems = await ExpiredItem.count({
            where: { institution_id }
        });

        // Get total suppliers
        const totalSuppliers = await Supplier.count({
            where: { institution_id, is_active: true }
        });

        res.json({
            totalItems,
            totalValue: totalValue.toFixed(2),
            lowStockAlerts: lowStockAlerts.length,
            pendingRequests,
            expiredItems,
            totalSuppliers
        });
    } catch (error) {
        console.error('Error fetching store stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ITEM MANAGEMENT
// ============================================

// Get all items or create new item
router.get('/items', async (req, res) => {
    try {
        const { institution_id, category, search, page = 1, limit = 50 } = req.query;
        
        const where = { institution_id };
        if (category) where.category = category;
        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { description: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const items = await Item.findAndCountAll({
            where,
            include: [
                { model: Supplier, as: 'supplier' }
            ],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            items: items.rows,
            total: items.count,
            page: parseInt(page),
            totalPages: Math.ceil(items.count / parseInt(limit))
        });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/items', async (req, res) => {
    try {
        const { institution_id } = req.query;
        const itemData = { ...req.body, institution_id };
        
        const item = await Item.create(itemData);
        res.status(201).json(item);
    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({ error: error.message });
    }
});

router.put('/items/:id', async (req, res) => {
    try {
        const item = await Item.findByPk(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        await item.update(req.body);
        res.json(item);
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/items/:id', async (req, res) => {
    try {
        const item = await Item.findByPk(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        await item.update({ is_active: false });
        res.json({ message: 'Item deactivated successfully' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// STOCK ITEMS (BATCHES)
// ============================================

router.get('/stock-items', async (req, res) => {
    try {
        const { institution_id, store_id, search, category, low_stock } = req.query;
        
        const where = { institution_id };
        
        const batches = await ItemBatch.findAll({
            where,
            include: [
                { model: Item, as: 'item' },
                { model: Supplier, as: 'supplier' }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Filter for low stock if requested
        let filteredBatches = batches;
        if (low_stock === 'true') {
            filteredBatches = batches.filter(batch => {
                const item = batch.item;
                return item && batch.current_quantity <= item.reorder_level;
            });
        }

        // Search filter
        if (search) {
            filteredBatches = filteredBatches.filter(batch => 
                batch.batch_number?.toLowerCase().includes(search.toLowerCase()) ||
                batch.item?.name?.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Enhance with computed fields
        const enhancedBatches = filteredBatches.map(batch => {
            const item = batch.item;
            return {
                ...batch.toJSON(),
                item: item ? {
                    ...item.toJSON(),
                    isLowStock: item.reorder_level && batch.current_quantity <= item.reorder_level,
                    isCritical: item.critical_level && batch.current_quantity <= item.critical_level
                } : null
            };
        });

        res.json({ stockItems: enhancedBatches });
    } catch (error) {
        console.error('Error fetching stock items:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/stock-items', async (req, res) => {
    try {
        const { institution_id } = req.query;
        const { item_id, batch_number, quantity, unit_cost, supplier_id, expiry_date, manufacture_date, location } = req.body;
        
        // Create batch
        const batch = await ItemBatch.create({
            id: uuidv4(),
            institution_id,
            item_id,
            batch_number: batch_number || `BATCH-${Date.now()}`,
            quantity,
            current_quantity: quantity,
            unit_cost,
            supplier_id,
            expiry_date,
            manufacture_date,
            location,
            received_date: new Date(),
            status: 'active'
        });

        // Create inventory record
        await InventoryRecord.create({
            id: uuidv4(),
            institution_id,
            item_id,
            batch_id: batch.id,
            movement_type: 'restocked',
            quantity: quantity,
            reference_type: 'purchase',
            reference_id: batch.id,
            notes: `Initial stock: ${quantity} units`
        });

        // Check for low stock
        const item = await Item.findByPk(item_id);
        if (item && quantity <= item.reorder_level) {
            await StockAlert.create({
                id: uuidv4(),
                institution_id,
                item_id,
                batch_id: batch.id,
                alert_type: 'low_stock',
                message: `Item ${item.name} is at or below reorder level`,
                is_resolved: false
            });
        }

        res.status(201).json(batch);
    } catch (error) {
        console.error('Error creating stock item:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ISSUE ITEMS DIRECTLY
// ============================================

router.post('/issue-items-directly', async (req, res) => {
    try {
        const { institution_id, item_id, batch_id, quantity, department_id, issued_by, notes } = req.body;
        
        const batch = await ItemBatch.findByPk(batch_id);
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        if (batch.current_quantity < quantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        // Update batch quantity
        await batch.update({
            current_quantity: batch.current_quantity - quantity
        });

        // Check if depleted
        if (batch.current_quantity === 0) {
            await batch.update({ status: 'depleted' });
        }

        // Create issued item record
        const issued = await IssuedItem.create({
            id: uuidv4(),
            institution_id,
            item_id,
            batch_id,
            department_id,
            quantity,
            issued_by,
            notes
        });

        // Create inventory record
        await InventoryRecord.create({
            id: uuidv4(),
            institution_id,
            item_id,
            batch_id,
            movement_type: 'issued',
            quantity: -quantity,
            reference_type: 'direct_issue',
            reference_id: issued.id,
            notes
        });

        // Check for low stock
        if (batch.current_quantity <= 10) {
            const item = await Item.findByPk(item_id);
            await StockAlert.create({
                id: uuidv4(),
                institution_id,
                item_id,
                batch_id: batch.id,
                alert_type: 'low_stock',
                message: `Item ${item?.name} is running low (${batch.current_quantity} remaining)`,
                is_resolved: false
            });
        }

        res.status(201).json(issued);
    } catch (error) {
        console.error('Error issuing items:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// NEW: DEPARTMENT-ISSUE ITEMS (COMPONENT BACKEND)
// ============================================

// This endpoint issues multiple items to departments in one request.
// Body:
// {
//   institution_id,
//   department_id,
//   issued_by,
//   notes,
//   items: [{ item_id, batch_id, quantity }]
// }
router.post('/issue-items-to-department', async (req, res) => {
    try {
        const { institution_id, department_id, issued_by, notes, items } = req.body;

        if (!department_id) return res.status(400).json({ error: 'department_id is required' });
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'items must be a non-empty array' });
        }

        const issuedResults = [];

        for (const line of items) {
            const { item_id, batch_id, quantity } = line;

            if (!batch_id || !item_id) {
                return res.status(400).json({ error: 'Each item must include item_id and batch_id' });
            }
            if (!quantity || quantity <= 0) {
                return res.status(400).json({ error: 'Each item must include a valid quantity' });
            }

            const batch = await ItemBatch.findByPk(batch_id);
            if (!batch) return res.status(404).json({ error: `Batch not found: ${batch_id}` });

            if (parseFloat(batch.current_quantity) < parseFloat(quantity)) {
                return res.status(400).json({ error: `Insufficient stock for batch ${batch_id}` });
            }

            await batch.update({ current_quantity: batch.current_quantity - quantity });
            if (batch.current_quantity - quantity === 0) {
                await batch.update({ status: 'depleted' });
            }

            const issued = await IssuedItem.create({
                id: uuidv4(),
                institution_id,
                item_id,
                batch_id,
                department_id,
                quantity,
                issued_by,
                notes: notes || `Issued to department ${department_id}`,
            });

            await InventoryRecord.create({
                id: uuidv4(),
                institution_id,
                item_id,
                batch_id,
                movement_type: 'issued',
                quantity: -quantity,
                reference_type: 'department_issue',
                reference_id: issued.id,
                notes: notes || `Issued to department ${department_id}`,
            });

            issuedResults.push(issued);
        }

        res.status(201).json({ issuedItems: issuedResults });
    } catch (error) {
        console.error('Error issuing items to department:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// STOCK REQUESTS (FROM DEPARTMENTS)
// ============================================

router.get('/requested-items', async (req, res) => {
    try {
        const { institution_id, department_id, status } = req.query;
        
        const where = { institution_id };
        if (department_id) where.department_id = department_id;
        if (status) where.status = status;

        const requests = await StockRequest.findAll({
            where,
            include: [
                { model: StockRequestItem, as: 'items' },
                { model: Item, as: 'item' }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(requests);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/request-items', async (req, res) => {
    try {
        const { institution_id, department_id, requested_by, items, notes } = req.body;
        
        // Create request
        const request = await StockRequest.create({
            id: uuidv4(),
            institution_id,
            department_id,
            requested_by,
            status: 'pending',
            notes
        });

        // Create request items
        if (items && items.length > 0) {
            for (const item of items) {
                await StockRequestItem.create({
                    id: uuidv4(),
                    stock_request_id: request.id,
                    item_id: item.item_id,
                    quantity_requested: item.quantity,
                    quantity_issued: 0,
                    status: 'pending'
                });
            }
        }

        res.status(201).json(request);
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/requested-items/approve', async (req, res) => {
    try {
        const { request_id, quantity_issued, department_id } = req.body;
        
        const request = await StockRequest.findByPk(request_id, {
            include: [{ model: StockRequestItem, as: 'items' }]
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Update request status
        await request.update({ status: 'approved' });

        // Update request items
        for (const reqItem of request.items) {
            await reqItem.update({
                quantity_issued: quantity_issued || reqItem.quantity_requested,
                status: 'approved'
            });

            // Find available batch
            const batch = await ItemBatch.findOne({
                where: {
                    item_id: reqItem.item_id,
                    status: 'active',
                    current_quantity: { [Op.gt]: 0 }
                },
                order: [['expiry_date', 'ASC']]
            });

            if (batch && quantity_issued <= batch.current_quantity) {
                // Deduct from batch
                await batch.update({
                    current_quantity: batch.current_quantity - quantity_issued
                });

                // Create issued item
                await IssuedItem.create({
                    id: uuidv4(),
                    institution_id: request.institution_id,
                    item_id: reqItem.item_id,
                    batch_id: batch.id,
                    department_id: request.department_id,
                    quantity: quantity_issued,
                    issued_by: request.requested_by,
                    notes: `Issued against request ${request.id}`
                });

                // Create inventory record
                await InventoryRecord.create({
                    id: uuidv4(),
                    institution_id: request.institution_id,
                    item_id: reqItem.item_id,
                    batch_id: batch.id,
                    movement_type: 'issued',
                    quantity: -quantity_issued,
                    reference_type: 'stock_request',
                    reference_id: request.id
                });
            }
        }

        res.json({ message: 'Request approved and items issued', request });
    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ error: error.message });
    }
});

router.put('/requested-items/reject', async (req, res) => {
    try {
        const { request_id, reason } = req.body;
        
        const request = await StockRequest.findByPk(request_id);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        await request.update({
            status: 'rejected',
            notes: reason
        });

        // Update all items
        await StockRequestItem.update(
            { status: 'rejected' },
            { where: { stock_request_id: request_id } }
        );

        res.json({ message: 'Request rejected', request });
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ISSUED ITEMS
// ============================================

router.get('/issued-items', async (req, res) => {
    try {
        const { institution_id, department_id, start_date, end_date } = req.query;
        
        const where = { institution_id };
        if (department_id) where.department_id = department_id;

        const issuedItems = await IssuedItem.findAll({
            where,
            include: [
                { model: Item, as: 'item' }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({ issuedItems });
    } catch (error) {
        console.error('Error fetching issued items:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// EXPIRED ITEMS
// ============================================

router.get('/get-expired-items', async (req, res) => {
    try {
        const { institution_id } = req.query;
        
        const expiredBatches = await ItemBatch.findAll({
            where: {
                institution_id,
                status: 'expired'
            },
            include: [
                { model: Item, as: 'item' }
            ],
            order: [['expiry_date', 'ASC']]
        });

        res.json({ expiredItems: expiredBatches });
    } catch (error) {
        console.error('Error fetching expired items:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SUPPLIERS
// ============================================

router.get('/suppliers', async (req, res) => {
    try {
        const { institution_id, search, is_active } = req.query;
        
        const where = { institution_id };
        if (is_active !== undefined) where.is_active = is_active === 'true';
        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { contact_person: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const suppliers = await Supplier.findAll({
            where,
            order: [['name', 'ASC']]
        });

        res.json(suppliers);
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/suppliers', async (req, res) => {
    try {
        const { institution_id } = req.query;
        const supplierData = { ...req.body, institution_id };
        
        const supplier = await Supplier.create(supplierData);
        res.status(201).json(supplier);
    } catch (error) {
        console.error('Error creating supplier:', error);
        res.status(500).json({ error: error.message });
    }
});

router.put('/suppliers/:id', async (req, res) => {
    try {
        const supplier = await Supplier.findByPk(req.params.id);
        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }
        
        await supplier.update(req.body);
        res.json(supplier);
    } catch (error) {
        console.error('Error updating supplier:', error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/suppliers/:id', async (req, res) => {
    try {
        const supplier = await Supplier.findByPk(req.params.id);
        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }
        
        await supplier.update({ is_active: false });
        res.json({ message: 'Supplier deactivated' });
    } catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PURCHASE ORDERS
// ============================================

router.get('/purchase-orders', async (req, res) => {
    try {
        const { institution_id, supplier_id, status } = req.query;
        
        const where = { institution_id };
        if (supplier_id) where.supplier_id = supplier_id;
        if (status) where.status = status;

        const orders = await PurchaseOrder.findAll({
            where,
            include: [
                { model: Supplier, as: 'supplier' },
                { model: PurchaseOrderItem, as: 'items' }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(orders);
    } catch (error) {
        console.error('Error fetching purchase orders:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/purchase-orders', async (req, res) => {
    try {
        const { institution_id, supplier_id, ordered_by, items, expected_delivery_date, notes } = req.body;
        
        const order = await PurchaseOrder.create({
            id: uuidv4(),
            institution_id,
            supplier_id,
            ordered_by,
            status: 'pending',
            expected_delivery_date,
            notes
        });

        // Create order items
        if (items && items.length > 0) {
            for (const item of items) {
                await PurchaseOrderItem.create({
                    id: uuidv4(),
                    purchase_order_id: order.id,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.quantity * item.unit_price,
                    status: 'pending'
                });
            }
        }

        res.status(201).json(order);
    } catch (error) {
        console.error('Error creating purchase order:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// STOCK TRANSFERS
// ============================================

router.get('/stock-transfers', async (req, res) => {
    try {
        const { institution_id, from_department_id, to_department_id, status } = req.query;
        
        const where = { institution_id };
        if (from_department_id) where.from_department_id = from_department_id;
        if (to_department_id) where.to_department_id = to_department_id;
        if (status) where.status = status;

        const transfers = await StockTransfer.findAll({
            where,
            include: [
                { model: StockTransferItem, as: 'items' }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(transfers);
    } catch (error) {
        console.error('Error fetching transfers:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/stock-transfers', async (req, res) => {
    try {
        const { institution_id, from_department_id, to_department_id, transferred_by, items, notes } = req.body;
        
        const transfer = await StockTransfer.create({
            id: uuidv4(),
            institution_id,
            from_department_id,
            to_department_id,
            transferred_by,
            status: 'pending',
            notes
        });

        // Create transfer items
        if (items && items.length > 0) {
            for (const item of items) {
                await StockTransferItem.create({
                    id: uuidv4(),
                    stock_transfer_id: transfer.id,
                    item_id: item.item_id,
                    batch_id: item.batch_id,
                    quantity: item.quantity,
                    status: 'pending'
                });
            }
        }

        res.status(201).json(transfer);
    } catch (error) {
        console.error('Error creating transfer:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// INVENTORY RECORDS / MOVEMENT
// ============================================

router.get('/inventory-records', async (req, res) => {
    try {
        const { institution_id, item_id, batch_id, movement_type, start_date, end_date } = req.query;
        
        const where = { institution_id };
        if (item_id) where.item_id = item_id;
        if (batch_id) where.batch_id = batch_id;
        if (movement_type) where.movement_type = movement_type;

        const records = await InventoryRecord.findAll({
            where,
            include: [
                { model: Item, as: 'item' }
            ],
            order: [['createdAt', 'DESC']],
            limit: 100
        });

        res.json(records);
    } catch (error) {
        console.error('Error fetching inventory records:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// STOCK ALERTS
// ============================================

router.get('/stock-alerts', async (req, res) => {
    try {
        const { institution_id, alert_type, is_resolved } = req.query;
        
        const where = { institution_id };
        if (alert_type) where.alert_type = alert_type;
        if (is_resolved !== undefined) where.is_resolved = is_resolved === 'true';

        const alerts = await StockAlert.findAll({
            where,
            include: [
                { model: Item, as: 'item' }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(alerts);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: error.message });
    }
});

router.put('/stock-alerts/:id/resolve', async (req, res) => {
    try {
        const alert = await StockAlert.findByPk(req.params.id);
        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }
        
        await alert.update({ is_resolved: true });
        res.json(alert);
    } catch (error) {
        console.error('Error resolving alert:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// STOCK VALUATION REPORT
// ============================================

router.get('/stock-valuation', async (req, res) => {
    try {
        const { institution_id } = req.query;
        
        const batches = await ItemBatch.findAll({
            where: { 
                institution_id,
                status: 'active',
                current_quantity: { [Op.gt]: 0 }
            },
            include: [
                { model: Item, as: 'item' },
                { model: Supplier, as: 'supplier' }
            ]
        });

        const valuation = batches.map(batch => {
            const totalValue = batch.current_quantity * parseFloat(batch.unit_cost);
            return {
                item_id: batch.item_id,
                item_name: batch.item?.name,
                batch_number: batch.batch_number,
                quantity: batch.current_quantity,
                unit_cost: batch.unit_cost,
                total_value: totalValue.toFixed(2),
                supplier: batch.supplier?.name,
                expiry_date: batch.expiry_date
            };
        });

        const totalValue = valuation.reduce((sum, v) => sum + parseFloat(v.total_value), 0);

        res.json({
            items: valuation,
            total_value: totalValue.toFixed(2)
        });
    } catch (error) {
        console.error('Error fetching valuation:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// REPORTS & ANALYTICS
// ============================================

router.get('/reports/consumption', async (req, res) => {
    try {
        const { institution_id, start_date, end_date, department_id } = req.query;
        
        const where = { institution_id };
        if (department_id) where.department_id = department_id;
        
        const issuedItems = await IssuedItem.findAll({
            where,
            include: [
                { model: Item, as: 'item' }
            ]
        });

        // Group by item
        const consumption = {};
        issuedItems.forEach(issue => {
            const itemName = issue.item?.name || 'Unknown';
            if (!consumption[itemName]) {
                consumption[itemName] = { quantity: 0, items: [] };
            }
            consumption[itemName].quantity += issue.quantity;
        });

        res.json(consumption);
    } catch (error) {
        console.error('Error fetching consumption report:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/reports/stock-status', async (req, res) => {
    try {
        const { institution_id } = req.query;
        
        const batches = await ItemBatch.findAll({
            where: { institution_id },
            include: [{ model: Item, as: 'item' }]
        });

        const status = {
            total: batches.length,
            active: batches.filter(b => b.status === 'active').length,
            expired: batches.filter(b => b.status === 'expired').length,
            depleted: batches.filter(b => b.status === 'depleted').length,
            lowStock: []
        };

        batches.forEach(batch => {
            if (batch.item && batch.current_quantity <= batch.item.reorder_level) {
                status.lowStock.push({
                    item_name: batch.item.name,
                    current: batch.current_quantity,
                    reorder_level: batch.item.reorder_level
                });
            }
        });

        res.json(status);
    } catch (error) {
        console.error('Error fetching stock status:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// DEPARTMENT ITEMS (for department view)
// ============================================

router.get('/department-items', async (req, res) => {
    try {
        const { institution_id, department_id } = req.query;
        
        const issuedItems = await IssuedItem.findAll({
            where: {
                institution_id,
                department_id
            },
            include: [
                { model: Item, as: 'item' }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Group by item
        const items = {};
        issuedItems.forEach(issue => {
            const itemId = issue.item_id;
            if (!items[itemId]) {
                items[itemId] = {
                    item: issue.item,
                    total_quantity: 0,
                    last_issued: issue.createdAt
                };
            }
            items[itemId].total_quantity += issue.quantity;
            if (new Date(issue.createdAt) > new Date(items[itemId].last_issued)) {
                items[itemId].last_issued = issue.createdAt;
            }
        });

        res.json(Object.values(items));
    } catch (error) {
        console.error('Error fetching department items:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// STOCK ADJUSTMENTS
// ============================================

router.post('/stock-adjustments', async (req, res) => {
    try {
        const { institution_id, item_id, batch_id, adjustment_type, quantity, reason, adjusted_by } = req.body;
        
        const adjustment = await StockAdjustment.create({
            id: uuidv4(),
            institution_id,
            item_id,
            batch_id,
            adjustment_type,
            quantity,
            reason,
            adjusted_by,
            adjusted_at: new Date()
        });

        // Update batch quantity
        const batch = await ItemBatch.findByPk(batch_id);
        if (batch) {
            const newQuantity = adjustment_type === 'increase' 
                ? batch.current_quantity + quantity 
                : batch.current_quantity - quantity;
            
            await batch.update({ 
                current_quantity: Math.max(0, newQuantity),
                status: newQuantity === 0 ? 'depleted' : 'active'
            });
        }

        // Create inventory record
        await InventoryRecord.create({
            id: uuidv4(),
            institution_id,
            item_id,
            batch_id,
            movement_type: adjustment_type === 'increase' ? 'restocked' : 'adjusted',
            quantity: adjustment_type === 'increase' ? quantity : -quantity,
            reference_type: 'adjustment',
            reference_id: adjustment.id,
            notes: reason
        });

        res.status(201).json(adjustment);
    } catch (error) {
        console.error('Error creating adjustment:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// LOW STOCK ITEMS
// ============================================

router.get('/low-stock-items', async (req, res) => {
    try {
        const { institution_id } = req.query;
        
        const batches = await ItemBatch.findAll({
            where: { 
                institution_id,
                status: 'active'
            },
            include: [
                { model: Item, as: 'item' }
            ]
        });

        const lowStock = batches.filter(batch => {
            return batch.item && batch.current_quantity <= batch.item.reorder_level;
        }).map(batch => ({
            id: batch.id,
            item_id: batch.item_id,
            item_name: batch.item?.name,
            category: batch.item?.category,
            current_quantity: batch.current_quantity,
            reorder_level: batch.item?.reorder_level,
            critical_level: batch.item?.critical_level,
            batch_number: batch.batch_number,
            is_critical: batch.current_quantity <= batch.item?.critical_level
        }));

        res.json(lowStock);
    } catch (error) {
        console.error('Error fetching low stock items:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

