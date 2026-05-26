

// @desc    Create a new nurse handover
// @route   POST /api/nurse-handovers

const NurseHandover = require("../../models/nurse_station/nurseHandover");
const Patient = require("../../models/patient");
const Staff = require("../../models/staff");
const Visit = require("../../models/Visit");

// @access  Private
exports.createNurseHandover = async (req, res) => {
    try {
        const {
            visit_id,
            from_nurse_id,
            to_nurse_id,
            department_id,
            shift,
            ongoing_treatments,
            notes,
            status = 'submitted'
        } = req.body;

        // Validate required fields
        if (!visit_id || !department_id || !shift) {
            return res.status(400).json({
                success: false,
                message: 'Visit ID, department ID, and shift are required'
            });
        }

        // Validate shift enum
        const validShifts = ['morning', 'afternoon', 'night'];
        if (!validShifts.includes(shift)) {
            return res.status(400).json({
                success: false,
                message: 'Shift must be one of: morning, afternoon, night'
            });
        }

        // Create handover
        const handover = await NurseHandover.create({
            visit_id,
            from_nurse_id: from_nurse_id || req.user?.id, // Use current user if not provided
            to_nurse_id,
            department_Id:department_id,
            shift,
            ongoing_treatments,
            notes,
            status
        });

        // Fetch created handover with associations
        const createdHandover = await NurseHandover.findByPk(handover.id, {
            include: [
                {
                    model: Visit,
                    as: 'visit',
                    attributes: ['id', 'patient_id', 'admission_date']
                },
                {
                    model: Staff,
                    as: 'from_nurse',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                },
                {
                    model: Staff,
                    as: 'to_nurse',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Nurse handover created successfully',
            data: createdHandover
        });

    } catch (error) {
        console.error('Error creating nurse handover:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating nurse handover',
            error: error.message
        });
    }
};

// @desc    Get all nurse handovers with filtering and pagination
// @route   GET /api/nurse-handovers
// @access  Private
exports.getAllNurseHandovers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            department_id,
            shift,
            status,
            from_nurse_id,
            to_nurse_id,
            visit_id,
            start_date,
            end_date
        } = req.query;

        const offset = (page - 1) * limit;

        // Build where clause
        const where = {};
        if (department_id) where.department_Id = department_id;
        if (shift) where.shift = shift;
        if (status) where.status = status;
        if (from_nurse_id) where.from_nurse_id = from_nurse_id;
        if (to_nurse_id) where.to_nurse_id = to_nurse_id;
        if (visit_id) where.visit_id = visit_id;

        // Date range filter
        if (start_date && end_date) {
            where.created_at = {
                [Op.between]: [new Date(start_date), new Date(end_date)]
            };
        }

        const { count, rows: handovers } = await NurseHandover.findAndCountAll({
            where,
            include: [
                { 
                    model: Visit,
                    as: 'visit',
                    attributes: ['id', 'patient_id', 'admission_date'],
                    include: [{
                        model: Patient,
                        as: 'patient',
                        // attributes: ['id', 'first_name', 'last_name', 'medicalRecordNumber']
                    }]
                },
                { 
                    model: Staff,
                    as: 'from_nurse',
                    // attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
                },
                {
                    model: Staff,
                    as: 'to_nurse',
                    // attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.status(200).json({
            success: true,
            message: 'Nurse handovers retrieved successfully',
            data: {
                handovers,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(count / limit),
                    total: count
                }
            }
        });

    } catch (error) {
        console.error('Error fetching nurse handovers:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching nurse handovers',
            error: error.message
        });
    }
};

// @desc    Get single nurse handover by ID
// @route   GET /api/nurse-handovers/:id
// @access  Private
exports.getNurseHandoverById = async (req, res) => {
    try {
        const { id } = req.params;

        const handover = await NurseHandover.findByPk(id, {
            include: [
                {
                    model: Visit,
                    as: 'visit',
                    attributes: ['id', 'patient_id', 'admission_date'],
                    include: [{
                        model: Patient,
                        as: 'patient',
                        // attributes: ['id', 'firstName', 'lastName', 'medicalRecordNumber', 'dateOfBirth', 'gender']
                    }]
                },
                {
                    model: Staff,
                    as: 'from_nurse',
                    // attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'position']
                },
                {
                    model: Staff,
                    as: 'to_nurse',
                    // attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'position']
                }
            ]
        });

        if (!handover) {
            return res.status(404).json({
                success: false,
                message: 'Nurse handover not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Nurse handover retrieved successfully',
            data: handover
        });

    } catch (error) {
        console.error('Error fetching nurse handover:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching nurse handover',
            error: error.message
        });
    }
};

// @desc    Update nurse handover
// @route   PUT /api/nurse-handovers/:id
// @access  Private
exports.updateNurseHandover = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            to_nurse_id,
            shift,
            ongoing_treatments,
            notes,
            status
        } = req.body;

        const handover = await NurseHandover.findByPk(id);

        if (!handover) {
            return res.status(404).json({
                success: false,
                message: 'Nurse handover not found'
            });
        }

        // Validate shift if provided
        if (shift) {
            const validShifts = ['morning', 'afternoon', 'night'];
            if (!validShifts.includes(shift)) {
                return res.status(400).json({
                    success: false,
                    message: 'Shift must be one of: morning, afternoon, night'
                });
            }
        }

        // Validate status if provided
        if (status) {
            const validStatuses = ['draft', 'submitted', 'acknowledged'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Status must be one of: draft, submitted, acknowledged'
                });
            }
        }

        // Update fields
        const updateData = {};
        if (to_nurse_id !== undefined) updateData.to_nurse_id = to_nurse_id;
        if (shift !== undefined) updateData.shift = shift;
        if (ongoing_treatments !== undefined) updateData.ongoing_treatments = ongoing_treatments;
        if (notes !== undefined) updateData.notes = notes;
        if (status !== undefined) updateData.status = status;

        await handover.update(updateData);

        // Fetch updated handover with associations
        const updatedHandover = await NurseHandover.findByPk(id, {
            include: [
                {
                    model: Visit,
                    as: 'visit',
                    attributes: ['id', 'patient_id', 'admission_date'],
                    include: [{
                        model: Patient,
                        as: 'patient',
                        attributes: ['id', 'firstName', 'lastName', 'medicalRecordNumber']
                    }]
                },
                {
                    model: Staff,
                    as: 'from_nurse',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                },
                {
                    model: Staff,
                    as: 'to_nurse',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Nurse handover updated successfully',
            data: updatedHandover
        });

    } catch (error) {
        console.error('Error updating nurse handover:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating nurse handover',
            error: error.message
        });
    }
};

// @desc    Delete nurse handover
// @route   DELETE /api/nurse-handovers/:id
// @access  Private
exports.deleteNurseHandover = async (req, res) => {
    try {
        const { id } = req.params;

        const handover = await NurseHandover.findByPk(id);

        if (!handover) {
            return res.status(404).json({
                success: false,
                message: 'Nurse handover not found'
            });
        }

        await handover.destroy();

        res.status(200).json({
            success: true,
            message: 'Nurse handover deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting nurse handover:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting nurse handover',
            error: error.message
        });
    }
};

// @desc    Get handovers by visit ID
// @route   GET /api/nurse-handovers/visit/:visitId
// @access  Private
exports.getHandoversByVisit = async (req, res) => {
    try {
        const { visitId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows: handovers } = await NurseHandover.findAndCountAll({
            where: { visit_id: visitId },
            include: [
                {
                    model: Staff,
                    as: 'from_nurse',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                },
                {
                    model: Staff,
                    as: 'to_nurse',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.status(200).json({
            success: true,
            message: 'Visit handovers retrieved successfully',
            data: {
                handovers,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(count / limit),
                    total: count
                }
            }
        });

    } catch (error) {
        console.error('Error fetching visit handovers:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching visit handovers',
            error: error.message
        });
    }
};

// @desc    Get handovers by nurse ID
// @route   GET /api/nurse-handovers/nurse/:nurseId
// @access  Private
exports.getHandoversByNurse = async (req, res) => {
    try {
        const { nurseId } = req.params;
        const { type = 'from', page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const where = {};
        if (type === 'from') {
            where.from_nurse_id = nurseId;
        } else if (type === 'to') {
            where.to_nurse_id = nurseId;
        } else {
            where[Op.or] = [
                { from_nurse_id: nurseId },
                { to_nurse_id: nurseId }
            ];
        }

        const { count, rows: handovers } = await NurseHandover.findAndCountAll({
            where,
            include: [
                {
                    model: Visit,
                    as: 'visit',
                    attributes: ['id', 'patient_id', 'admission_date'],
                    include: [{
                        model: Patient,
                        as: 'patient',
                        attributes: ['id', 'firstName', 'lastName', 'medicalRecordNumber']
                    }]
                },
                {
                    model: Staff,
                    as: 'from_nurse',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                },
                {
                    model: Staff,
                    as: 'to_nurse',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.status(200).json({
            success: true,
            message: 'Nurse handovers retrieved successfully',
            data: {
                handovers,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(count / limit),
                    total: count
                }
            }
        });

    } catch (error) {
        console.error('Error fetching nurse handovers:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching nurse handovers',
            error: error.message
        });
    }
};

// @desc    Acknowledge handover (update status to acknowledged)
// @route   PATCH /api/nurse-handovers/:id/acknowledge
// @access  Private
exports.acknowledgeHandover = async (req, res) => {
    try {
        const { id } = req.params;
        const { to_nurse_id } = req.body;

        const handover = await NurseHandover.findByPk(id);

        if (!handover) {
            return res.status(404).json({
                success: false,
                message: 'Nurse handover not found'
            });
        }

        // Update handover
        await handover.update({
            status: 'acknowledged',
            to_nurse_id: to_nurse_id || req.user?.id
        });

        const updatedHandover = await NurseHandover.findByPk(id, {
            include: [
                {
                    model: Visit,
                    as: 'visit',
                    attributes: ['id', 'patient_id', 'admission_date'],
                    include: [{
                        model: Patient,
                        as: 'patient',
                        attributes: ['id', 'firstName', 'lastName', 'medicalRecordNumber']
                    }]
                },
                {
                    model: Staff,
                    as: 'from_nurse',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                },
                {
                    model: Staff,
                    as: 'to_nurse',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Handover acknowledged successfully',
            data: updatedHandover
        });

    } catch (error) {
        console.error('Error acknowledging handover:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while acknowledging handover',
            error: error.message
        });
    }
};