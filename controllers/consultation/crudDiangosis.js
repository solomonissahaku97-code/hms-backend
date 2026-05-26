const { validationResult } = require('express-validator');
const Visit = require('../../models/Visit');
const Staff = require('../../models/staff');
const PatientDiagnosis = require('../../models/patientDiagnosis');
const sequelize = require('../../config/database');
const { addClaimItem } = require('../../service/claimService');


// @desc    Create a new patient diagnosis
// @route   POST /api/diagnosis
// @access  Private (Doctor)
exports.createDiagnosis = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { visit_id, staff_id, diagnosis_ids, doctors_note,claim_id,patient_complain } = req.body;

        // Validate required fields
        if (!visit_id || !staff_id || !diagnosis_ids || !Array.isArray(diagnosis_ids)) {
            return res.status(400).json({ error: 'Missing required fields or invalid diagnosis_ids format' });
        }

        // Verify visit and staff exist
        const visit = await Visit.findByPk(visit_id);
        const staff = await Staff.findByPk(staff_id);

        if (!visit) {
            return res.status(404).json({ error: 'Visit not found' });
        }
        if (!staff) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        // Create diagnosis record
        const diagnosis = await PatientDiagnosis.create({
            visit_id,
            staff_id,
            diagnosis_ids,
            doctors_note,
            patient_complain
        })

        // map icd10ToGdrgcode of diagnosis
        await addClaimItem(
            {
                claim_id,
                item_data: {
                    item_type: 'diagnosis',
                    item_id: diagnosis.id,
                    item_cost: 0, // Assuming cost is handled elsewhere
                    icd10ToGdrgcode: diagnosis.diagnosis_ids.map(id => ({ id, code: `ICD-${id}` })) // Example mapping
                }
            },
            sequelize.transaction()
        )



        return res.status(201).json({
            success: true,
            data: diagnosis
        });

    } catch (error) {
        console.error('Error creating diagnosis:', error);
        return res.status(500).json({ 
            error: 'Server error',
            details: error.message 
        });
    }
};

// @desc    Get diagnosis by ID
// @route   GET /api/diagnosis/:id
// @access  Private
exports.getDiagnosis = async (req, res) => {
    try {
        const diagnosis = await PatientDiagnosis.find(req.params.id, {
            include: [
                { model: Visit, as: 'visit' },
                { model: Staff, as: 'doctor' }
            ]
        });

        if (!diagnosis) {
            return res.status(404).json({ error: 'Diagnosis record not found' });
        }

        return res.status(200).json({
            success: true,
            data: diagnosis
        });

    } catch (error) {
        console.error('Error fetching diagnosis:', error);
        return res.status(500).json({ 
            error: 'Server error',
            details: error.message 
        });
    }
};

// @desc    Update diagnosis
// @route   PUT /api/diagnosis/:id
// @access  Private (Doctor)
exports.updateDiagnosis = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { diagnosis_ids, doctors_note } = req.body;

        // Validate at least one field is provided
        if (!diagnosis_ids && !doctors_note) {
            return res.status(400).json({ error: 'At least one field must be provided for update' });
        }

        // Find the diagnosis record
        const diagnosis = await PatientDiagnosis.findByPk(req.params.id);
        if (!diagnosis) {
            return res.status(404).json({ error: 'Diagnosis record not found' });
        }

        // Update fields
        if (diagnosis_ids) {
            if (!Array.isArray(diagnosis_ids)) {
                return res.status(400).json({ error: 'diagnosis_ids must be an array' });
            }
            diagnosis.diagnosis_ids = diagnosis_ids;
        }
        if (doctors_note !== undefined) {
            diagnosis.doctors_note = doctors_note;
        }

        await diagnosis.save();

        return res.status(200).json({
            success: true,
            data: diagnosis
        });

    } catch (error) {
        console.error('Error updating diagnosis:', error);
        return res.status(500).json({ 
            error: 'Server error',
            details: error.message 
        });
    }
};

// @desc    Delete diagnosis
// @route   DELETE /api/diagnosis/:id
// @access  Private (Admin/Doctor)
exports.deleteDiagnosis = async (req, res) => {
    try {
        const diagnosis = await PatientDiagnosis.findByPk(req.params.id);
        if (!diagnosis) {
            return res.status(404).json({ error: 'Diagnosis record not found' });
        }

        await diagnosis.destroy();

        return res.status(200).json({
            success: true,
            data: {}
        });

    } catch (error) {
        console.error('Error deleting diagnosis:', error);
        return res.status(500).json({ 
            error: 'Server error',
            details: error.message 
        });
    }
};

// @desc    Get all diagnoses for a visit
// @route   GET /api/visits/:visitId/diagnoses
// @access  Private
exports.getDiagnosesByVisit = async (req, res) => {
    try {
        const diagnoses = await PatientDiagnosis.findAll({
            where: { visit_id: req.params.visitId },
            include: [
                { model: Staff, as: 'doctor', attributes: ['id', 'first_name', 'last_name'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        return res.status(200).json({
            success: true,
            count: diagnoses.length,
            data: diagnoses
        });

    } catch (error) {
        console.error('Error fetching visit diagnoses:', error);
        return res.status(500).json({ 
            error: 'Server error',
            details: error.message 
        });
    }
};