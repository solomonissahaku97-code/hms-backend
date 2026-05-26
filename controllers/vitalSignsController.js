const VitalSignsRecord = require("../models/vital_signs_records");


// Create a new vital signs record
exports.createVitalSignsRecord = async (req, res) => {
    try {
        const {
            visit_id,
            oxygen,
            SpO2,
            temperature,
            systole,
            diastole,
            heart_rate,
            pulse,
            department_id,
            weight,
            height,
            rbs,
            pain,
            staff_id,
            institution_id,
            status,
            abnormal_reason,
        } = req.body;

        // Validate required foreign key
        if (!visit_id) {
            return res.status(400).json({ error: 'visit_id is required' });
        }

        // Check if at least one vital sign is provided (excluding foreign keys)
        const vitalSignsFields = {
            oxygen,
            SpO2,
            temperature,
            systole,
            diastole,
            heart_rate,
            pulse,
            weight,
            height,
            rbs,
            pain
        };

        const hasVitalSign = Object.values(vitalSignsFields).some(
            value => value !== null && value !== undefined && value !== ''
        );

        if (!hasVitalSign) {
            return res.status(400).json({ 
                error: 'At least one vital sign must be provided',
                requiredFields: Object.keys(vitalSignsFields)
            });
        }

        // Validate numeric fields are numbers if provided
        const numericFields = {
            oxygen, SpO2, temperature, systole, diastole, 
            heart_rate, pulse, weight, height, rbs, pain
        };

        for (const [field, value] of Object.entries(numericFields)) {
            if (value !== null && value !== undefined && value !== '' && isNaN(Number(value))) {
                return res.status(400).json({ 
                    error: `${field} must be a number`,
                    invalidValue: value
                });
            }
        }

        // Create the record
        const newRecord = await VitalSignsRecord.create({
            visit_id,
            oxygen: oxygen !== undefined ? Number(oxygen) : null,
            SpO2: SpO2 !== undefined ? Number(SpO2) : null,
            temperature: temperature !== undefined ? Number(temperature) : null,
            systole: systole !== undefined ? Number(systole) : null,
            diastole: diastole !== undefined ? Number(diastole) : null,
            heart_rate: heart_rate !== undefined ? Number(heart_rate) : null,
            pulse: pulse !== undefined ? Number(pulse) : null,
            department_id: department_id || null,
            weight: weight !== undefined ? Number(weight) : null,
            height: height !== undefined ? Number(height) : null,
            rbs: rbs !== undefined ? Number(rbs) : null,
            pain: pain !== undefined ? Number(pain) : null,
            staff_id: staff_id || null,
            institution_id: institution_id || null,
            status: status || null,
            abnormal_reason: abnormal_reason || null,
        });

        return res.status(201).json(newRecord);
    } catch (error) {
        console.error('Error creating vital signs record:', error);
        
        // Handle Sequelize validation errors
        if (error.name === 'SequelizeValidationError') {
            const errors = error.errors.map(err => ({
                field: err.path,
                message: err.message
            }));
            return res.status(400).json({ error: 'Validation error', details: errors });
        }

        // Handle foreign key constraint violation
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({ 
                error: 'Invalid reference',
                message: 'The provided visit_id does not exist'
            });
        }

        return res.status(500).json({ 
            error: 'Failed to create vital signs record',
            details: error.message 
        });
    }
};

// Fetch all vital signs records
exports.getAllVitalSignsRecords = async (req, res) => {
    const { patient_id,institution_id } = req.query
    try {
        const records = await VitalSignsRecord.findAll({
            where:{patient_id,institution_id}
        });

        return res.status(200).json(records);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to fetch vital signs records.' });
    }
};

// Fetch a single vital signs record by ID
exports.getVitalSignsRecordById = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await VitalSignsRecord.findByPk(id, {
            // include: [
            //     { model: Patient, as: 'patient' },
            //     { model: Department, as: 'department' },
            //     { model: Institution, as: 'institution' },
            //     { model: Staff, as: 'staff' },
            // ],
        });

        // if (!record) {
        //     return res.status(404).json({ error: 'Vital signs record not found.' });
        // }

        return res.status(200).json(record);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to fetch vital signs record.' });
    }
};

// Update a vital signs record 
exports.updateVitalSignsRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Find the record
        const record = await VitalSignsRecord.findByPk(id);

        if (!record) {
            return res.status(404).json({ error: 'Vital signs record not found.' });
        }

        // Update the record
        await record.update(updateData);

        return res.status(200).json(record);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to update vital signs record.' });
    }
};

// Delete a vital signs record
exports.deleteVitalSignsRecord = async (req, res) => {
    try {
        const { id } = req.params;

        // Find the record
        const record = await VitalSignsRecord.findByPk(id);

        if (!record) {
            return res.status(404).json({ error: 'Vital signs record not found.' });
        }

        // Delete the record
        await record.destroy();

        return res.status(200).json({ message: 'Vital signs record deleted successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to delete vital signs record.' });
    }
};