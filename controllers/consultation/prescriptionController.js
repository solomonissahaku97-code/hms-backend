const {  Patient, Institution, Department, ServiceBill, sequelize } = require('../../models');
const Medication = require('../../models/medication');
const Prescription = require('../../models/prescription');
const Role = require('../../models/role');
const Staff = require('../../models/staff');
const notificationService = require('../../service/notificationService')
// Create a new prescription

exports.createPrescription = async (req, res) => {
    const t = await sequelize.transaction(); // Start transaction

    try {
        const { patient_id, drug, prescribed_by, dosage, frequency, duration, refills, notes, institution_id, department_id } = req.body;

        // Validate required fields
        if (!patient_id || !drug || !prescribed_by || !institution_id || !department_id) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        // Find necessary records within the transaction
        const patient = await Patient.findByPk(patient_id, { transaction: t });
        if (!patient) throw new Error("Patient not found.");

        const doctor = await Staff.findByPk(prescribed_by, { transaction: t });
        if (!doctor) throw new Error("Doctor not found.");

        const institution = await Institution.findByPk(institution_id, { transaction: t });
        if (!institution) throw new Error("Institution not found.");

        const department = await Department.findByPk(department_id, { transaction: t });
        if (!department) throw new Error("Department not found.");

        // Create the prescription inside the transaction
        const prescription = await Prescription.create({
            patient_id,
            prescriptions: drug, // Ensure this is the correct field
            prescribed_by,
            dosage,
            frequency,
            duration,
            refills,
            refills_left: refills || 0, // Default refills_left if not provided
            notes,
            status: "pending",
            institution_id,
            department_id
        }, { transaction: t });

        // Commit transaction if everything succeeds
        await t.commit();

        res.status(201).json({ message: "Prescription created successfully", prescription });
    } catch (error) {
        console.error("Prescription Creation Error:", error);

        // Rollback the transaction on error
        await t.rollback();

        res.status(500).json({ error: error.message || "An error occurred while creating the prescription." });
    }
};


// Approve a prescription
exports.approvePrescription = async (req, res) => {
    try {
        const { prescriptionId, patientId } = req.body;

        console.log(req.body)

        const prescription = await Prescription.findOne({
            where: {
                id: prescriptionId,
                patient_id: patientId
            }
        });

        if (!prescription) {
            return res.status(404).json({ error: 'Prescription not found for this patient.' });
        }

        if (prescription.status !== 'pending') {
            return res.status(400).json({ error: 'Prescription is not pending approval.' });
        }

        prescription.status = 'approved';
        await prescription.save();

        notificationService.sendNotification({})

        res.status(200).json({ message: 'Prescription approved successfully', prescription });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while approving the prescription.' });
    }
};


// Issue a prescription
exports.issuePrescription = async (req, res) => {
    try {
        const { prescriptionId } = req.params;

        const prescription = await Prescription.findByPk(prescriptionId);
        if (!prescription) {
            return res.status(404).json({ error: 'Prescription not found.' });
        }

        if (prescription.status !== 'approved') {
            return res.status(400).json({ error: 'Prescription is not approved.' });
        }

        prescription.status = 'issued';
        await prescription.save();

        res.status(200).json({ message: 'Prescription issued successfully', prescription });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while issuing the prescription.' });
    }
};

// Handle refill requests
exports.requestRefill = async (req, res) => {
    try {
        const { prescriptionId } = req.params;

        const prescription = await Prescription.findByPk(prescriptionId);
        if (!prescription) {
            return res.status(404).json({ error: 'Prescription not found.' });
        }

        if (prescription.refills_left <= 0) {
            return res.status(400).json({ error: 'No refills left.' });
        }

        prescription.status = 'refill_pending';
        await prescription.save();

        res.status(200).json({ message: 'Refill request submitted successfully', prescription });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while requesting the refill.' });
    }
};

// Approve a refill request
exports.approveRefill = async (req, res) => {
    try {
        const { prescriptionId } = req.params;

        const prescription = await Prescription.findByPk(prescriptionId);
        if (!prescription) {
            return res.status(404).json({ error: 'Prescription not found.' });
        }

        if (prescription.status !== 'refill_pending') {
            return res.status(400).json({ error: 'Refill is not pending approval.' });
        }

        prescription.status = 'refill_approved';
        await prescription.save();

        res.status(200).json({ message: 'Refill approved successfully', prescription });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while approving the refill.' });
    }
};



// Issue a refill
exports.issueRefill = async (req, res) => {
    try {
        const { prescriptionId } = req.params;

        const prescription = await Prescription.findByPk(prescriptionId);
        if (!prescription) {
            return res.status(404).json({ error: 'Prescription not found.' });
        }

        if (prescription.status !== 'refill_approved') {
            return res.status(400).json({ error: 'Refill is not approved.' });
        }

        prescription.refills_left -= 1;
        prescription.status = 'refill_issued';
        await prescription.save();

        res.status(200).json({ message: 'Refill issued successfully', prescription });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while issuing the refill.' });
    }
};



exports.drugsList = async (req, res) => {
    try {
        const medications = await Medication.findAll();
        return res.status(200).json(medications);
    } catch (error) {
        console.error(error);
        console.log(error)
        return res.status(500).json({ message: 'An error occurred while fetching the medications' });
       
    } 
};


exports.getPrescriptionsByInstitution = async (req, res) => {
    try {
        const { institutionId } = req.query;

        const institution = await Institution.findByPk(institutionId);
        if (!institution) {
            return res.status(404).json({ error: 'Institution not found.' });
        }

        const prescriptions = await Prescription.findAll({
            where: { institution_id: institutionId },
            include: [
                { model: Patient, as: 'patient' },
                { model: Staff, as: 'doctor', },
                { model: Department, as: 'department' }
            ]
        });

        res.status(200).json(prescriptions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching prescriptions.' });
    }
};


exports.getPrescriptionsByInstitutionAndPatient = async (req, res) => {
    try {
        const { patientId,institutionId } = req.query;

        const institution = await Institution.findByPk(institutionId);
        if (!institution) {
            return res.status(404).json({ error: 'Institution not found.' });
        }

        const patient = await Patient.findByPk(patientId);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found.' });
        }

        const prescriptions = await Prescription.findAll({
            where: {
                institution_id: institutionId,
                patient_id: patientId
            },
            include: [
                { model: Patient, as: 'patient' },
               
                { model: Department, as: 'department' },
                // {model: ServiceBill, as:'serviceBills'}
            ]
        });

        res.status(200).json(prescriptions);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'An error occurred while fetching prescriptions.' });
    }
};

// Delete a prescription
exports.deletePrescription = async (req, res) => {
    try {
        const { prescriptionId } = req.params;

        const prescription = await Prescription.findByPk(prescriptionId);
        if (!prescription) {
            return res.status(404).json({ error: 'Prescription not found.' });
        }
        

        await prescription.destroy();

        res.status(200).json({ message: 'Prescription deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while deleting the prescription.' });
    }
};

// Edit/Update a prescription
exports.editPrescription = async (req, res) => {
    try {
        const { prescriptionId } = req.params;
        const { drug, dosage, frequency, duration, refills, notes, prescribed_by } = req.body;

        const prescription = await Prescription.findByPk(prescriptionId);
        if (!prescription) {
            return res.status(404).json({ error: 'Prescription not found.' });
        }

        if (prescription.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending prescriptions can be edited.' });
        }

        // Update prescription details
        prescription.prescriptions = drug || prescription.prescriptions;
        prescription.dosage = dosage || prescription.dosage;
        prescription.frequency = frequency || prescription.frequency;
        prescription.duration = duration || prescription.duration;
        prescription.refills = refills !== undefined ? refills : prescription.refills;
        prescription.refills_left = refills !== undefined ? refills : prescription.refills_left;
        prescription.notes = notes || prescription.notes;
        prescription.prescribed_by = prescribed_by || prescription.prescribed_by;

        await prescription.save();

        res.status(200).json({ message: 'Prescription updated successfully', prescription });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while updating the prescription.' });
    }
};


