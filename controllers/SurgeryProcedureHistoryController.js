const { SurgeryProcedureHistory, Patient, Staff } = require('../models');

// Create a surgery/procedure history record
exports.createSurgeryHistory = async (req, res) => {
    const { patient_id, surgeon_id, procedure_type, procedure_date, outcome, notes } = req.body;

    try {
        const patient = await Patient.findByPk(patient_id);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const surgeon = await Staff.findByPk(surgeon_id);
        if (!surgeon) return res.status(404).json({ error: 'Surgeon not found' });

        const newSurgeryHistory = await SurgeryProcedureHistory.create({
            patient_id,
            surgeon_id,
            procedure_type,
            procedure_date,
            outcome,
            notes,
        });

        res.status(201).json({ message: 'Surgery/Procedure history created successfully', data: newSurgeryHistory });
    } catch (error) {
        console.error('Error creating surgery/procedure history:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get surgery/procedure history for a patient
exports.getSurgeryHistoriesForPatient = async (req, res) => {
    const { patient_id } = req.params;

    try {
        const surgeryHistories = await SurgeryProcedureHistory.findAll({
            where: { patient_id },
            include: [
                { model: Patient, as: 'patient', attributes: ['first_name', 'last_name', 'age'] },
                { model: Staff, as: 'surgeon', attributes: ['firstName', 'lastName', 'email'] }
            ]
        });

        if (!surgeryHistories.length) {
            return res.status(404).json({ message: 'No surgery/procedure history found for this patient' });
        }

        res.status(200).json(surgeryHistories);
    } catch (error) {
        console.error('Error fetching surgery/procedure history:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update a surgery/procedure history record
exports.updateSurgeryHistory = async (req, res) => {
    const { procedure_type, procedure_date, outcome, notes } = req.body;
    const { surgeryHistoryId } = req.params;

    try {
        const surgeryHistory = await SurgeryProcedureHistory.findByPk(surgeryHistoryId);

        if (!surgeryHistory) {
            return res.status(404).json({ error: 'Surgery/Procedure history not found' });
        }

        surgeryHistory.procedure_type = procedure_type || surgeryHistory.procedure_type;
        surgeryHistory.procedure_date = procedure_date || surgeryHistory.procedure_date;
        surgeryHistory.outcome = outcome || surgeryHistory.outcome;
        surgeryHistory.notes = notes || surgeryHistory.notes;

        await surgeryHistory.save();

        res.status(200).json({ message: 'Surgery/Procedure history updated successfully', data: surgeryHistory });
    } catch (error) {
        console.error('Error updating surgery/procedure history:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
