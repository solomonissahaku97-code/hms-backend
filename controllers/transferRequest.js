const Diagnosis = require('../models/diagnosis');
const Institution = require('../models/institution');
const LabResult = require('../models/lab_results');
const Patient = require('../models/patient');
const Prescription = require('../models/prescription');
const Record = require('../models/record');
const TransferRequest = require('../models/transferRequest');
const VitalSignsRecord = require('../models/vital_signs_records');

// Initiate Transfer 
exports.initiateTransfer = async (req, res) => {
    const { patient_id, target_institution_id, source_institution_id, note } = req.body;

    try {
        const patient = await Record.findByPk(patient_id);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const targetInstitution = await Institution.findByPk(target_institution_id);
        if (!targetInstitution) {
            return res.status(404).json({ error: 'Target institution not found' });
        }

        const transferRequest = await TransferRequest.create({
            patient_id,
            source_institution_id,
            target_institution_id,
        });

        res.status(201).json({ message: 'Transfer request initiated successfully', transferRequest });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while initiating the transfer request' });
    }
};


// Approve Transfer
exports.approveTransfer = async (req, res) => {
    const { transferId, target_institution_id } = req.body;
    // const target_institution_id = req.user.institution_id; // Assuming admin's institution

    try {
        const transferRequest = await TransferRequest.findByPk(transferId, {
            include: [{ model: Patient, as: 'patient' }]
        });

        if (!transferRequest || transferRequest.target_institution_id !== target_institution_id) {
            return res.status(404).json({ error: 'Transfer request not found or unauthorized' });
        }

        if (transferRequest.status !== 'pending') {
            return res.status(400).json({ error: 'Transfer request is not pending' });
        }

        // Update patient's institution
        await Patient.update(
            { institution_id: target_institution_id },
            { where: { id: transferRequest.patient_id } }
        );

        // Update related records
        await Promise.all([
            Diagnosis.update(
                { institution_id: target_institution_id },
                { where: { patient_id: transferRequest.patient_id } }
            ),
            LabResult.update(
                { institution_id: target_institution_id },
                { where: { patient_id: transferRequest.patient_id } }
            ),
            VitalSignsRecord.update(
                { institution_id: target_institution_id },
                { where: { patient_id: transferRequest.patient_id } }
            ),
            Prescription.update(
                { institution_id: target_institution_id },
                { where: { patient_id: transferRequest.patient_id } }
            ),
        ]);

        // Register patient in the target institution
        await Record.create({
            patient_id: transferRequest.patient_id,
            institution_id: target_institution_id
        });

        // Approve transfer
        transferRequest.status = 'approved';
        transferRequest.approved_at = new Date();
        await transferRequest.save();

        res.status(200).json({ message: 'Transfer approved successfully', transferRequest });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while approving the transfer request' });
    }
};

// Reject Transfer
exports.rejectTransfer = async (req, res) => {
    const { transferId } = req.params;
    const target_institution_id = req.user.institution_id; // Assuming admin's institution

    try {
        const transferRequest = await TransferRequest.findByPk(transferId);

        if (!transferRequest || transferRequest.target_institution_id !== target_institution_id) {
            return res.status(404).json({ error: 'Transfer request not found or unauthorized' });
        }

        if (transferRequest.status !== 'pending') {
            return res.status(400).json({ error: 'Transfer request is not pending' });
        }

        // Reject transfer
        transferRequest.status = 'rejected';
        await transferRequest.save();

        res.status(200).json({ message: 'Transfer rejected successfully', transferRequest });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while rejecting the transfer request' });
    }
};


exports.transferPatientDepartment = async (req, res) => {
    const { patient_id, new_department_id } = req.body;

    try {
        const patient = await Patient.findByPk(patient_id);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const newDepartment = await Department.findByPk(new_department_id);
        if (!newDepartment) {
            return res.status(404).json({ error: 'New department not found' });
        }

        // Update patient's department
        await Patient.update(
            { department_id: new_department_id },
            { where: { id: patient_id } }
        );

        res.status(200).json({ message: 'Patient department transfer successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while transferring the patient to the new department' });
    }
};


// - GET ALL INSTITUTIONS FOR THE TRANSFER
exports.getAllInstitutions = async (req, res) => {
    try {
        const institutions = await Institution.findAll()
        return res.status(200).json(institutions)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: 'An error occurred while fetching all institutions' })
    }

}

