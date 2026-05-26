const PatientAllergy = require('../../models/PatientAllergy');
const Patient = require('../../models/patient');

// Create a new allergy record
exports.createAllergy = async (req, res) => {
    try {
        const {
            patient_id,
            institution_id,
            allergy_type,
            allergen,
            severity,
            reaction_type,
            reaction_description,
            onset_date,
            last_reaction_date,
            is_confirmed,
            identified_by,
            verification_status,
            notes,
            is_active,
            recorded_by
        } = req.body;

        // Check if patient exists
        const patient = await Patient.findByPk(patient_id);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        const allergy = await PatientAllergy.create({
            patient_id,
            institution_id,
            allergy_type,
            allergen,
            severity,
            reaction_type,
            reaction_description,
            onset_date,
            last_reaction_date,
            is_confirmed,
            identified_by,
            verification_status,
            notes,
            is_active,
            recorded_by
        });

        res.status(201).json({
            message: 'Allergy recorded successfully',
            allergy
        });
    } catch (error) {
        console.error('Error creating allergy:', error);
        res.status(500).json({ message: 'Error recording allergy', error: error.message });
    }
};

// Get all allergies for a patient
exports.getPatientAllergies = async (req, res) => {
    try {
        const { patient_id } = req.params;
        const { institution_id } = req.query;

        const where = { patient_id };
        if (institution_id) {
            where.institution_id = institution_id;
        }

        const allergies = await PatientAllergy.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });

        res.json({
            message: 'Allergies retrieved successfully',
            allergies,
            count: allergies.length
        });
    } catch (error) {
        console.error('Error fetching allergies:', error);
        res.status(500).json({ message: 'Error fetching allergies', error: error.message });
    }
};

// Get single allergy by ID
exports.getAllergyById = async (req, res) => {
    try {
        const { id } = req.params;

        const allergy = await PatientAllergy.findByPk(id, {
            include: ['patient']
        });

        if (!allergy) {
            return res.status(404).json({ message: 'Allergy not found' });
        }

        res.json({
            message: 'Allergy retrieved successfully',
            allergy
        });
    } catch (error) {
        console.error('Error fetching allergy:', error);
        res.status(500).json({ message: 'Error fetching allergy', error: error.message });
    }
};

// Update allergy
exports.updateAllergy = async (req, res) => {
    try {
        const { id } = req.params;

        const allergy = await PatientAllergy.findByPk(id);
        if (!allergy) {
            return res.status(404).json({ message: 'Allergy not found' });
        }

        const updatedAllergy = await allergy.update(req.body);

        res.json({
            message: 'Allergy updated successfully',
            allergy: updatedAllergy
        });
    } catch (error) {
        console.error('Error updating allergy:', error);
        res.status(500).json({ message: 'Error updating allergy', error: error.message });
    }
};

// Delete (soft delete) allergy
exports.deleteAllergy = async (req, res) => {
    try {
        const { id } = req.params;

        const allergy = await PatientAllergy.findByPk(id);
        if (!allergy) {
            return res.status(404).json({ message: 'Allergy not found' });
        }

        // Soft delete by setting is_active to false
        await allergy.update({ is_active: false });

        res.json({ message: 'Allergy deleted successfully' });
    } catch (error) {
        console.error('Error deleting allergy:', error);
        res.status(500).json({ message: 'Error deleting allergy', error: error.message });
    }
};

// Check for drug allergies (useful for prescription warnings)
exports.checkDrugAllergies = async (req, res) => {
    try {
        const { patient_id, drug_name } = req.query;

        if (!patient_id || !drug_name) {
            return res.status(400).json({ message: 'patient_id and drug_name are required' });
        }

        const allergies = await PatientAllergy.findAll({
            where: {
                patient_id,
                allergy_type: 'drug',
                is_active: true
            }
        });

        // Check if any allergy matches the drug
        const matchingAllergies = allergies.filter(allergy => 
            allergy.allergen.toLowerCase().includes(drug_name.toLowerCase()) ||
            drug_name.toLowerCase().includes(allergy.allergen.toLowerCase())
        );

        if (matchingAllergies.length > 0) {
            return res.status(200).json({
                has_allergy: true,
                allergies: matchingAllergies,
                warning: 'Patient has known allergy to this medication!'
            });
        }

        res.json({
            has_allergy: false,
            allergies: [],
            message: 'No known drug allergies found'
        });
    } catch (error) {
        console.error('Error checking drug allergies:', error);
        res.status(500).json({ message: 'Error checking drug allergies', error: error.message });
    }
};

// Get allergy summary for a patient (for display in patient profile)
exports.getAllergySummary = async (req, res) => {
    try {
        const { patient_id } = req.params;

        const allergies = await PatientAllergy.findAll({
            where: {
                patient_id,
                is_active: true
            },
            attributes: ['id', 'allergy_type', 'allergen', 'severity', 'is_confirmed']
        });

        // Group by type
        const summary = {
            drug: [],
            food: [],
            environmental: [],
            biological: [],
            other: [],
            unknown: []
        };

        allergies.forEach(allergy => {
            if (summary[allergy.allergy_type]) {
                summary[allergy.allergy_type].push({
                    id: allergy.id,
                    allergen: allergy.allergen,
                    severity: allergy.severity,
                    is_confirmed: allergy.is_confirmed
                });
            }
        });

        // Count severe allergies
        const severeCount = allergies.filter(a => a.severity === 'severe' || a.severity === 'anaphylaxis').length;

        res.json({
            message: 'Allergy summary retrieved successfully',
            summary,
            total_allergies: allergies.length,
            severe_allergies: severeCount,
            has_critical_allergy: severeCount > 0
        });
    } catch (error) {
        console.error('Error fetching allergy summary:', error);
        res.status(500).json({ message: 'Error fetching allergy summary', error: error.message });
    }
};

// Verify/Unverify allergy
exports.verifyAllergy = async (req, res) => {
    try {
        const { id } = req.params;
        const { verification_status, verified_by } = req.body;

        const allergy = await PatientAllergy.findByPk(id);
        if (!allergy) {
            return res.status(404).json({ message: 'Allergy not found' });
        }

        await allergy.update({
            verification_status,
            notes: allergy.notes + `\n[${new Date().toISOString()}] Verified by: ${verified_by}`
        });

        res.json({
            message: 'Allergy verification updated',
            allergy
        });
    } catch (error) {
        console.error('Error verifying allergy:', error);
        res.status(500).json({ message: 'Error verifying allergy', error: error.message });
    }
};

