const { CaseCart, CaseCartItem, TheatrePatients, Patient, Staff, OperatingRoom } = require('../../models');
const { Op } = require('sequelize');

// Helper function to generate cart number
const generateCartNumber = async () => {
    const year = new Date().getFullYear();
    const count = await CaseCart.count({
        where: {
            cart_number: {
                [Op.like]: `CC-${year}-%`
            }
        }
    });
    const nextNumber = String(count + 1).padStart(4, '0');
    return `CC-${year}-${nextNumber}`;
};

// Helper function to calculate completion percentage
const calculateCompletion = async (caseCartId) => {
    const items = await CaseCartItem.findAll({ where: { case_cart_id: caseCartId } });
    if (items.length === 0) return 0;
    
    const readyItems = items.filter(item => item.status === 'ready' || item.status === 'used');
    return Math.round((readyItems.length / items.length) * 100);
};

// ==================== Case Cart CRUD ====================

// Create a new Case Cart
exports.createCaseCart = async (req, res) => {
    try {
        const {
            patient_id,
            theatre_booking_id,
            procedure,
            surgeon_id,
            surgeon_name,
            scheduled_date,
            scheduled_time,
            assigned_to,
            assigned_to_name,
            operating_room_id,
            priority,
            notes,
            items
        } = req.body;

        const cart_number = await generateCartNumber();

        const caseCart = await CaseCart.create({
            cart_number,
            patient_id,
            theatre_booking_id,
            procedure,
            surgeon_id,
            surgeon_name,
            scheduled_date,
            scheduled_time,
            assigned_to,
            assigned_to_name,
            operating_room_id,
            priority: priority || 'normal',
            notes,
            status: 'not-started',
            completion_percentage: 0
        });

        // If items are provided, create them
        if (items && items.length > 0) {
            for (const item of items) {
                await CaseCartItem.create({
                    case_cart_id: caseCart.id,
                    name: item.name,
                    category: item.category || 'other',
                    status: 'pending',
                    quantity: item.quantity || 1,
                    notes: item.notes,
                    location: item.location,
                    item_type: item.item_type || 'custom'
                });
            }
        }

        // Fetch the complete case cart with items
        const result = await CaseCart.findByPk(caseCart.id, {
            include: [
                { model: CaseCartItem, as: 'items' },
                { model: Patient, as: 'patient' },
                { model: Staff, as: 'surgeon', attributes: ['id', 'first_name', 'last_name'] },
                { model: OperatingRoom, as: 'operatingRoom' }
            ]
        });

        res.status(201).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error creating case cart:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get all Case Carts with optional filters
exports.getAllCaseCarts = async (req, res) => {
    try {
        const { status, priority, date, surgeon_id, assigned_to } = req.query;
        
        const where = {};
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (surgeon_id) where.surgeon_id = surgeon_id;
        if (assigned_to) where.assigned_to = assigned_to;
        if (date) where.scheduled_date = date;

        const caseCarts = await CaseCart.findAll({
            where,
            include: [
                { model: CaseCartItem, as: 'items' },
                { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name', 'patient_id'] },
                { model: Staff, as: 'surgeon', attributes: ['id', 'first_name', 'last_name'] },
                { model: Staff, as: 'assignedStaff', attributes: ['id', 'first_name', 'last_name'] },
                { model: OperatingRoom, as: 'operatingRoom', attributes: ['id', 'room_name', 'room_number'] }
            ],
            order: [
                ['priority', 'DESC'],
                ['scheduled_date', 'ASC'],
                ['scheduled_time', 'ASC']
            ]
        });

        res.json({
            success: true,
            data: caseCarts
        });
    } catch (error) {
        console.error('Error fetching case carts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get Case Cart by ID
exports.getCaseCartById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const caseCart = await CaseCart.findByPk(id, {
            include: [
                { model: CaseCartItem, as: 'items' },
                { model: Patient, as: 'patient' },
                { model: TheatrePatients, as: 'theatreBooking' },
                { model: Staff, as: 'surgeon', attributes: ['id', 'first_name', 'last_name'] },
                { model: Staff, as: 'assignedStaff', attributes: ['id', 'first_name', 'last_name'] },
                { model: Staff, as: 'confirmer', attributes: ['id', 'first_name', 'last_name'] },
                { model: OperatingRoom, as: 'operatingRoom' }
            ]
        });

        if (!caseCart) {
            return res.status(404).json({
                success: false,
                error: 'Case Cart not found'
            });
        }

        res.json({
            success: true,
            data: caseCart
        });
    } catch (error) {
        console.error('Error fetching case cart:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Update Case Cart
exports.updateCaseCart = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const caseCart = await CaseCart.findByPk(id);
        
        if (!caseCart) {
            return res.status(404).json({
                success: false,
                error: 'Case Cart not found'
            });
        }

        await caseCart.update(updates);

        // Recalculate completion if status changed
        if (updates.status) {
            const completion = await calculateCompletion(id);
            await caseCart.update({ completion_percentage: completion });
        }

        const result = await CaseCart.findByPk(id, {
            include: [
                { model: CaseCartItem, as: 'items' },
                { model: Patient, as: 'patient' },
                { model: Staff, as: 'surgeon' },
                { model: OperatingRoom, as: 'operatingRoom' }
            ]
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error updating case cart:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Delete Case Cart
exports.deleteCaseCart = async (req, res) => {
    try {
        const { id } = req.params;

        const caseCart = await CaseCart.findByPk(id);
        
        if (!caseCart) {
            return res.status(404).json({
                success: false,
                error: 'Case Cart not found'
            });
        }

        // Delete all items first
        await CaseCartItem.destroy({ where: { case_cart_id: id } });
        
        // Then delete the cart
        await caseCart.destroy();

        res.json({
            success: true,
            message: 'Case Cart deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting case cart:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ==================== Case Cart Items ====================

// Add item to Case Cart
exports.addItem = async (req, res) => {
    try {
        const { case_cart_id } = req.params;
        const { name, category, quantity, notes, location, item_type, inventory_item_id, batch_number, expiry_date } = req.body;

        const caseCart = await CaseCart.findByPk(case_cart_id);
        
        if (!caseCart) {
            return res.status(404).json({
                success: false,
                error: 'Case Cart not found'
            });
        }

        const item = await CaseCartItem.create({
            case_cart_id,
            name,
            category: category || 'other',
            status: 'pending',
            quantity: quantity || 1,
            notes,
            location,
            item_type: item_type || 'custom',
            inventory_item_id,
            batch_number,
            expiry_date
        });

        // Recalculate completion
        const completion = await calculateCompletion(case_cart_id);
        await caseCart.update({ 
            completion_percentage: completion,
            status: completion > 0 ? 'in-progress' : 'not-started'
        });

        res.status(201).json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Error adding item:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Update item status
exports.updateItemStatus = async (req, res) => {
    try {
        const { item_id } = req.params;
        const { status, prepared_by, notes } = req.body;

        const item = await CaseCartItem.findByPk(item_id);
        
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found'
            });
        }

        const updateData = { status };
        if (prepared_by) updateData.prepared_by = prepared_by;
        if (status === 'ready') updateData.prepared_at = new Date();
        if (notes) updateData.notes = notes;

        await item.update(updateData);

        // Recalculate completion for the case cart
        const completion = await calculateCompletion(item.case_cart_id);
        const caseCart = await CaseCart.findByPk(item.case_cart_id);
        
        let cartStatus = caseCart.status;
        if (completion === 100 && cartStatus !== 'confirmed') {
            cartStatus = 'ready';
        } else if (completion > 0 && cartStatus === 'not-started') {
            cartStatus = 'in-progress';
        }

        await caseCart.update({ 
            completion_percentage: completion,
            status: cartStatus
        });

        const result = await CaseCartItem.findByPk(item_id, {
            include: [{ model: Staff, as: 'preparer', attributes: ['id', 'first_name', 'last_name'] }]
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Delete item from Case Cart
exports.deleteItem = async (req, res) => {
    try {
        const { item_id } = req.params;

        const item = await CaseCartItem.findByPk(item_id);
        
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found'
            });
        }

        const caseCartId = item.case_cart_id;
        await item.destroy();

        // Recalculate completion
        const caseCart = await CaseCart.findByPk(caseCartId);
        if (caseCart) {
            const completion = await calculateCompletion(caseCartId);
            await caseCart.update({ completion_percentage: completion });
        }

        res.json({
            success: true,
            message: 'Item deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ==================== Case Cart Actions ====================

// Confirm Case Cart
exports.confirmCaseCart = async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmed_by } = req.body;

        const caseCart = await CaseCart.findByPk(id);
        
        if (!caseCart) {
            return res.status(404).json({
                success: false,
                error: 'Case Cart not found'
            });
        }

        // Check if all items are ready
        const items = await CaseCartItem.findAll({ where: { case_cart_id: id } });
        const allReady = items.every(item => item.status === 'ready' || item.status === 'used');
        
        if (!allReady) {
            return res.status(400).json({
                success: false,
                error: 'Cannot confirm case cart. Not all items are ready.'
            });
        }

        await caseCart.update({
            status: 'confirmed',
            confirmed_at: new Date(),
            confirmed_by
        });

        const result = await CaseCart.findByPk(id, {
            include: [
                { model: CaseCartItem, as: 'items' },
                { model: Patient, as: 'patient' },
                { model: Staff, as: 'confirmer', attributes: ['id', 'first_name', 'last_name'] }
            ]
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error confirming case cart:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Mark Case Cart as Used
exports.markAsUsed = async (req, res) => {
    try {
        const { id } = req.params;

        const caseCart = await CaseCart.findByPk(id);
        
        if (!caseCart) {
            return res.status(404).json({
                success: false,
                error: 'Case Cart not found'
            });
        }

        await caseCart.update({ status: 'used' });

        // Mark all items as used
        await CaseCartItem.update(
            { status: 'used' },
            { where: { case_cart_id: id } }
        );

        const result = await CaseCart.findByPk(id, {
            include: [{ model: CaseCartItem, as: 'items' }]
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error marking case cart as used:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get Case Cart Statistics
exports.getCaseCartStatistics = async (req, res) => {
    try {
        const total = await CaseCart.count();
        const notStarted = await CaseCart.count({ where: { status: 'not-started' } });
        const inProgress = await CaseCart.count({ where: { status: 'in-progress' } });
        const ready = await CaseCart.count({ where: { status: 'ready' } });
        const confirmed = await CaseCart.count({ where: { status: 'confirmed' } });
        const used = await CaseCart.count({ where: { status: 'used' } });
        const cancelled = await CaseCart.count({ where: { status: 'cancelled' } });

        // Today's cases
        const today = new Date().toISOString().split('T')[0];
        const todayCases = await CaseCart.count({ 
            where: { 
                scheduled_date: today,
                status: { [Op.notIn]: ['cancelled'] }
            } 
        });

        // Priority counts
        const urgent = await CaseCart.count({ where: { priority: 'urgent', status: { [Op.notIn]: ['used', 'cancelled'] } } });
        const high = await CaseCart.count({ where: { priority: 'high', status: { [Op.notIn]: ['used', 'cancelled'] } } });

        res.json({
            success: true,
            data: {
                total,
                notStarted,
                inProgress,
                ready,
                confirmed,
                used,
                cancelled,
                todayCases,
                urgent,
                high,
                completionRate: total > 0 ? Math.round(((ready + confirmed + used) / total) * 100) : 0
            }
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

