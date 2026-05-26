const PatientChronicCondition = require('../../models/PatientChronicCondition');
const Patient = require('../../models/patient');
const { Op } = require('sequelize');

// Create a new chronic condition
exports.createChronicCondition = async (req, res) => {
    try {
        const {
            patient_id,
            institution_id,
            condition_name,
            condition_category,
            icd10_code,
            stage,
            diagnosis_date,
            diagnosed_by,
            diagnosis_facility,
            status,
            treatment_type,
            current_medications,
            treatment_goals,
            last_followup_date,
            next_followup_date,
            followup_frequency_days,
            complications,
            notes,
            is_controlled,
            last_hba1c,
            last_bp_reading,
            recorded_by
        } = req.body;

        // Check if patient exists
        const patient = await Patient.findByPk(patient_id);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        const condition = await PatientChronicCondition.create({
            patient_id,
            institution_id,
            condition_name,
            condition_category,
            icd10_code,
            stage,
            diagnosis_date,
            diagnosed_by,
            diagnosis_facility,
            status,
            treatment_type,
            current_medications,
            treatment_goals,
            last_followup_date,
            next_followup_date,
            followup_frequency_days,
            complications,
            notes,
            is_controlled,
            last_hba1c,
            last_bp_reading,
            recorded_by
        });

        res.status(201).json({
            message: 'Chronic condition recorded successfully',
            condition
        });
    } catch (error) {
        console.error('Error creating chronic condition:', error);
        res.status(500).json({ message: 'Error recording chronic condition', error: error.message });
    }
};

// Get all chronic conditions for a patient
exports.getPatientChronicConditions = async (req, res) => {
    try {
        const { patient_id } = req.params;
        const { institution_id, status, category } = req.query;

        const where = { 
            patient_id,
            is_active: true
        };
        
        if (institution_id) {
            where.institution_id = institution_id;
        }
        if (status) {
            where.status = status;
        }
        if (category) {
            where.condition_category = category;
        }

        const conditions = await PatientChronicCondition.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        res.json({
            message: 'Chronic conditions retrieved successfully',
            conditions,
            count: conditions.length
        });
    } catch (error) {
        console.error('Error fetching chronic conditions:', error);
        res.status(500).json({ message: 'Error fetching chronic conditions', error: error.message });
    }
};

// Get single chronic condition by ID
exports.getChronicConditionById = async (req, res) => {
    try {
        const { id } = req.params;

        const condition = await PatientChronicCondition.findByPk(id, {
            include: ['patient']
        });

        if (!condition) {
            return res.status(404).json({ message: 'Chronic condition not found' });
        }

        res.json({
            message: 'Chronic condition retrieved successfully',
            condition
        });
    } catch (error) {
        console.error('Error fetching chronic condition:', error);
        res.status(500).json({ message: 'Error fetching chronic condition', error: error.message });
    }
};

// Update chronic condition
exports.updateChronicCondition = async (req, res) => {
    try {
        const { id } = req.params;

        const condition = await PatientChronicCondition.findByPk(id);
        if (!condition) {
            return res.status(404).json({ message: 'Chronic condition not found' });
        }

        const updatedCondition = await condition.update(req.body);

        res.json({
            message: 'Chronic condition updated successfully',
            condition: updatedCondition
        });
    } catch (error) {
        console.error('Error updating chronic condition:', error);
        res.status(500).json({ message: 'Error updating chronic condition', error: error.message });
    }
};

// Delete (soft delete) chronic condition
exports.deleteChronicCondition = async (req, res) => {
    try {
        const { id } = req.params;

        const condition = await PatientChronicCondition.findByPk(id);
        if (!condition) {
            return res.status(404).json({ message: 'Chronic condition not found' });
        }

        await condition.update({ is_active: false });

        res.json({ message: 'Chronic condition deleted successfully' });
    } catch (error) {
        console.error('Error deleting chronic condition:', error);
        res.status(500).json({ message: 'Error deleting chronic condition', error: error.message });
    }
};

// Get chronic condition summary
exports.getChronicConditionSummary = async (req, res) => {
    try {
        const { patient_id } = req.params;

        const conditions = await PatientChronicCondition.findAll({
            where: {
                patient_id,
                is_active: true
            }
        });

        // Group by category
        const summary = {};
        conditions.forEach(condition => {
            if (!summary[condition.condition_category]) {
                summary[condition.condition_category] = [];
            }
            summary[condition.condition_category].push({
                id: condition.id,
                name: condition.condition_name,
                status: condition.status,
                stage: condition.stage,
                is_controlled: condition.is_controlled
            });
        });

        // Count active vs controlled
        const activeCount = conditions.filter(c => c.status === 'active').length;
        const controlledCount = conditions.filter(c => c.status === 'controlled').length;

        res.json({
            message: 'Chronic condition summary retrieved successfully',
            summary,
            total_conditions: conditions.length,
            active_conditions: activeCount,
            controlled_conditions: controlledCount
        });
    } catch (error) {
        console.error('Error fetching chronic condition summary:', error);
        res.status(500).json({ message: 'Error fetching chronic condition summary', error: error.message });
    }
};

// Get patients due for follow-up
exports.getPatientsDueForFollowUp = async (req, res) => {
    try {
        const { institution_id } = req.query;
        const today = new Date();
        
        const where = {
            is_active: true,
            status: { [Op.in]: ['active', 'controlled'] },
            next_followup_date: {
                [Op.lte]: today
            }
        };

        if (institution_id) {
            where.institution_id = institution_id;
        }

        const conditions = await PatientChronicCondition.findAll({
            where,
            include: [{
                model: Patient,
                as: 'patient',
                attributes: ['id', 'first_name', 'middle_name', 'last_name', 'folder_number']
            }],
            order: [['next_followup_date', 'ASC']]
        });

        res.json({
            message: 'Patients due for follow-up retrieved successfully',
            conditions,
            count: conditions.length
        });
    } catch (error) {
        console.error('Error fetching patients due for follow-up:', error);
        res.status(500).json({ message: 'Error fetching patients due for follow-up', error: error.message });
    }
};

// Update condition status (e.g., mark as controlled)
exports.updateConditionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, is_controlled, notes, last_followup_date, next_followup_date } = req.body;

        const condition = await PatientChronicCondition.findByPk(id);
        if (!condition) {
            return res.status(404).json({ message: 'Chronic condition not found' });
        }

        await condition.update({
            status,
            is_controlled,
            notes: notes ? `${condition.notes}\n${notes}` : condition.notes,
            last_followup_date: last_followup_date || new Date(),
            next_followup_date
        });

        res.json({
            message: 'Condition status updated successfully',
            condition
        });
    } catch (error) {
        console.error('Error updating condition status:', error);
        res.status(500).json({ message: 'Error updating condition status', error: error.message });
    }
};

// Get common conditions list
exports.getCommonConditions = async (req, res) => {
    try {
        res.json({
            message: 'Common chronic conditions',
            conditions: PatientChronicCondition.COMMON_CONDITIONS,
            staging: PatientChronicCondition.STAGING
        });
    } catch (error) {
        console.error('Error fetching common conditions:', error);
        res.status(500).json({ message: 'Error fetching common conditions', error: error.message });
    }
};

// Get conditions by category
exports.getConditionsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const { institution_id } = req.query;

        const where = {
            condition_category: category,
            is_active: true
        };

        if (institution_id) {
            where.institution_id = institution_id;
        }

        const conditions = await PatientChronicCondition.findAll({
            where,
            include: [{
                model: Patient,
                as: 'patient',
                attributes: ['id', 'first_name', 'last_name', 'folder_number']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            message: `Conditions in ${category} retrieved successfully`,
            conditions,
            count: conditions.length
        });
    } catch (error) {
        console.error('Error fetching conditions by category:', error);
        res.status(500).json({ message: 'Error fetching conditions by category', error: error.message });
    }
};

