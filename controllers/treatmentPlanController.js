const { TreatmentPlan, Patient, Staff, Institution, Department } = require('../models');


exports.createTreatmentPlan = async (req, res) => {
    try {
        const { patient_id, staff_id, institution_id, department_id, treatment_description, medication, dosage, start_date, end_date } = req.body;

        
        if (!patient_id || !staff_id || !institution_id || !department_id || !treatment_description) {
            return res.status(400).json({ error: 'Required fields are missing' });
        }

        const treatmentPlan = await TreatmentPlan.create({
            patient_id,
            staff_id,
            institution_id,
            department_id,
            treatment_description,
            medication,
            dosage,
            start_date,
            end_date
        });

        res.status(201).json(treatmentPlan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while creating the treatment plan' });
    }
};

// Get a specific treatment plan by ID
exports.getTreatmentPlanById = async (req, res) => {
    try {
        const { id } = req.params;

        const treatmentPlan = await TreatmentPlan.findByPk(id, {
            include: [
                { model: Patient, as: 'patient' },
                { model: Staff, as: 'staff' },
                { model: Institution, as: 'institution' },
                { model: Department, as: 'department' }
            ]
        });

        if (!treatmentPlan) {
            return res.status(404).json({ error: 'Treatment plan not found' });
        }

        res.status(200).json(treatmentPlan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching the treatment plan' });
    }
};

// Update a treatment plan
exports.updateTreatmentPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { treatment_description, medication, dosage, start_date, end_date } = req.body;

        const treatmentPlan = await TreatmentPlan.findByPk(id);

        if (!treatmentPlan) {
            return res.status(404).json({ error: 'Treatment plan not found' });
        }

        // Update the treatment plan fields
        treatmentPlan.treatment_description = treatment_description || treatmentPlan.treatment_description;
        treatmentPlan.medication = medication || treatmentPlan.medication;
        treatmentPlan.dosage = dosage || treatmentPlan.dosage;
        treatmentPlan.start_date = start_date || treatmentPlan.start_date;
        treatmentPlan.end_date = end_date || treatmentPlan.end_date;

        await treatmentPlan.save();

        res.status(200).json(treatmentPlan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while updating the treatment plan' });
    }
};

// Delete a treatment plan
exports.deleteTreatmentPlan = async (req, res) => {
    try {
        const { id } = req.params;

        const treatmentPlan = await TreatmentPlan.findByPk(id);

        if (!treatmentPlan) {
            return res.status(404).json({ error: 'Treatment plan not found' });
        }

        await treatmentPlan.destroy();

        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while deleting the treatment plan' });
    }
};

// Get all treatment plans for a specific patient
exports.getTreatmentPlansByPatientId = async (req, res) => {
    try {
        const { patient_id } = req.params;

        const treatmentPlans = await TreatmentPlan.findAll({
            where: { patient_id },
            include: [
                { model: Patient, as: 'patient' },
                { model: Staff, as: 'staff' },
                { model: Institution, as: 'institution' },
                { model: Department, as: 'department' }
            ]
        });

        res.status(200).json(treatmentPlans);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching the treatment plans' });
    }
};
