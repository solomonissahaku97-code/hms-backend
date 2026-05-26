const FamilyHealthHistory = require('../../models/FamilyHealthHistory');
const Patient = require('../../models/patient');

// Create family health history entry
exports.createFamilyHistory = async (req, res) => {
    try {
        const {
            patient_id,
            institution_id,
            relationship,
            first_name,
            age,
            is_deceased,
            age_at_death,
            cause_of_death,
            conditions,
            condition_onset_age,
            notes,
            recorded_by
        } = req.body;

        // Check if patient exists
        const patient = await Patient.findByPk(patient_id);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        const familyHistory = await FamilyHealthHistory.create({
            patient_id,
            institution_id,
            relationship,
            first_name,
            age,
            is_deceased,
            age_at_death,
            cause_of_death,
            conditions,
            condition_onset_age,
            notes,
            recorded_by
        });

        res.status(201).json({
            message: 'Family health history recorded successfully',
            familyHistory
        });
    } catch (error) {
        console.error('Error creating family health history:', error);
        res.status(500).json({ message: 'Error recording family health history', error: error.message });
    }
};

// Get all family health history for a patient
exports.getPatientFamilyHistory = async (req, res) => {
    try {
        const { patient_id } = req.params;
        const { institution_id } = req.query;

        const where = { 
            patient_id,
            is_active: true
        };
        
        if (institution_id) {
            where.institution_id = institution_id;
        }

        const familyHistories = await FamilyHealthHistory.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        res.json({
            message: 'Family health history retrieved successfully',
            familyHistories,
            count: familyHistories.length
        });
    } catch (error) {
        console.error('Error fetching family health history:', error);
        res.status(500).json({ message: 'Error fetching family health history', error: error.message });
    }
};

// Get single family history by ID
exports.getFamilyHistoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const familyHistory = await FamilyHealthHistory.findByPk(id, {
            include: ['patient']
        });

        if (!familyHistory) {
            return res.status(404).json({ message: 'Family health history not found' });
        }

        res.json({
            message: 'Family health history retrieved successfully',
            familyHistory
        });
    } catch (error) {
        console.error('Error fetching family health history:', error);
        res.status(500).json({ message: 'Error fetching family health history', error: error.message });
    }
};

// Update family health history
exports.updateFamilyHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const familyHistory = await FamilyHealthHistory.findByPk(id);
        if (!familyHistory) {
            return res.status(404).json({ message: 'Family health history not found' });
        }

        const updatedHistory = await familyHistory.update(req.body);

        res.json({
            message: 'Family health history updated successfully',
            familyHistory: updatedHistory
        });
    } catch (error) {
        console.error('Error updating family health history:', error);
        res.status(500).json({ message: 'Error updating family health history', error: error.message });
    }
};

// Delete (soft delete) family health history
exports.deleteFamilyHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const familyHistory = await FamilyHealthHistory.findByPk(id);
        if (!familyHistory) {
            return res.status(404).json({ message: 'Family health history not found' });
        }

        await familyHistory.update({ is_active: false });

        res.json({ message: 'Family health history deleted successfully' });
    } catch (error) {
        console.error('Error deleting family health history:', error);
        res.status(500).json({ message: 'Error deleting family health history', error: error.message });
    }
};

// Get family health history summary (conditions grouped by relationship)
exports.getFamilyHistorySummary = async (req, res) => {
    try {
        const { patient_id } = req.params;

        const familyHistories = await FamilyHealthHistory.findAll({
            where: {
                patient_id,
                is_active: true
            }
        });

        // Group conditions by relationship
        const summary = {
            father: { conditions: [], has_conditions: false },
            mother: { conditions: [], has_conditions: false },
            siblings: { conditions: [], has_conditions: false },
            grandparents: { conditions: [], has_conditions: false },
            other: { conditions: [], has_conditions: false }
        };

        familyHistories.forEach(fh => {
            if (fh.conditions && fh.conditions.length > 0) {
                const rel = fh.relationship;
                if (rel === 'father' || rel === 'mother') {
                    summary[rel].conditions = fh.conditions;
                    summary[rel].has_conditions = true;
                } else if (rel === 'brother' || rel === 'sister') {
                    summary.siblings.conditions.push(...fh.conditions);
                    summary.siblings.has_conditions = true;
                } else if (rel === 'grandfather' || rel === 'grandmother') {
                    summary.grandparents.conditions.push(...fh.conditions);
                    summary.grandparents.has_conditions = true;
                } else {
                    summary.other.conditions.push(...fh.conditions);
                    summary.other.has_conditions = true;
                }
            }
        });

        // Remove duplicates
        const uniqueConditions = new Set();
        familyHistories.forEach(fh => {
            if (fh.conditions) {
                fh.conditions.forEach(c => uniqueConditions.add(c.name || c));
            }
        });

        res.json({
            message: 'Family health history summary retrieved successfully',
            summary,
            total_family_members: familyHistories.length,
            unique_conditions: Array.from(uniqueConditions)
        });
    } catch (error) {
        console.error('Error fetching family health history summary:', error);
        res.status(500).json({ message: 'Error fetching family health history summary', error: error.message });
    }
};

// Get common conditions list
exports.getCommonConditions = async (req, res) => {
    try {
        res.json({
            message: 'Common family health conditions',
            conditions: FamilyHealthHistory.COMMON_CONDITIONS
        });
    } catch (error) {
        console.error('Error fetching common conditions:', error);
        res.status(500).json({ message: 'Error fetching common conditions', error: error.message });
    }
};

module.exports = exports;

