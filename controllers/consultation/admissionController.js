const { sequelize } = require('../../models');
const Bed = require('../../models/beds');
const Claim = require('../../models/claims/claim');
const Medicine = require('../../models/claims/medication');
const ClinicalIntervention = require('../../models/ClinicalIntervention');
const Department = require('../../models/department');
const Diagnosis = require('../../models/diagnosis');
const Institution = require('../../models/institution');
const LabTestResult = require('../../models/lab/LabTestResult');
const LabTestTemplate = require('../../models/lab/LabTestTemplate');
const Patient = require('../../models/patient');
const PatientNote = require('../../models/PatientNote');
const Prescription = require('../../models/prescription');
const Staff = require('../../models/staff');
const StaffComment = require('../../models/StaffComment');
const Visit = require('../../models/Visit');
const VitalSignsRecord = require('../../models/vital_signs_records');

// Admit a patient (convert visit to admission)
exports.createAdmission = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { visit_id, department_id, bed_id, note } = req.body;
        if (!visit_id || !department_id) {
            return res.status(400).json({ error: "Visit ID and Department ID are required." });
        }
        const visit = await Visit.findByPk(visit_id, { transaction: t });
        if (!visit) {
            return res.status(404).json({ error: "Visit not found." });
        }
        if (visit.on_admission) {
            return res.status(400).json({ error: "Patient is already admitted." });
        }
        // Check if the bed is available
        const bed = await Bed.findOne({ where: { id: bed_id, status: 'available' }, transaction: t });
        if (!bed) {
            return res.status(404).json({ error: "Bed not found or not available." });
        }
        // Update visit to admission status
        await visit.update({
            on_admission: true,
            admission_date: new Date(),
            department_id,
            bed_number: bed.bed_number,
            status: 'Active',
            admission_status: 'pending',
            admission_note: note
        }, { transaction: t });
        // Update bed status to occupied
        await bed.update({
            status: 'occupied',
            is_occupied: true,
            visit_id: visit.id
        }, { transaction: t });

        await t.commit();
        res.status(201).json({
            message: "Patient admitted successfully",
            admission: visit
        });

    } catch (error) {
        await t.rollback();
        res.status(500).json({
            error: error.message || "Error admitting patient."
        });
    }
};

// Discharge a patient
exports.dischargePatient = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { visit_id, discharge_type, patient_id } = req.body;

        if (!visit_id || !discharge_type) {
            return res.status(400).json({ error: "Visit ID and discharge type are required." });
        }
        const visit = await Visit.findByPk(visit_id, { transaction: t });
        if (!visit || !visit.on_admission) {
            return res.status(404).json({ error: "Visit not found or patient is not admitted." });
        }
        // Update visit to discharge status
        await visit.update({
            on_admission: false,
            discharge_date: new Date(),
            discharge_type,
            status: 'Completed',
            visit_type: 'Outpatient',
            department_id: null,
            bed_number: null,
            admission_status: null,
        }, { transaction: t });

        const patient = await Patient.findByPk(patient_id, { transaction: t });

        if (patient) {
            patient.update({
                status: 'discharged'
            })

        }
        // Update bed status to available
        if (visit) {
            const bed = await Bed.findOne({ where: { visit_id: visit.id }, transaction: t });
            if (bed) {
                await bed.update({
                    status: 'available',
                    is_occupied: false,
                    visit_id: null
                }, { transaction: t });
            }
        }
        await t.commit();
        res.status(200).json({
            message: "Patient discharged successfully",
            visit
        });

    } catch (error) {
        await t.rollback();
        res.status(500).json({
            error: error.message || "Error discharging patient."
        });
    }
};

// Get all admissions
exports.getAllAdmissions = async (req, res) => {
    try {
        const { institution_id, department_id } = req.query;
        console.log(req.query)

        if (!institution_id) {
            return res.status(400).json({ error: "Institution ID is required." });
        }

        const whereClause = {
            institution_id,
            on_admission: true,
            status: 'Active'
        };

        if (department_id) {
            whereClause.department_id = department_id;
        }

        const admissions = await Visit.findAll({
            where: whereClause,

            include: [
                { model: Patient, as: 'patient' },
                { model: VitalSignsRecord, as: 'vitalSignsRecords' },
                { model: Institution, as: 'institution' },
                { model: Department, as: 'department' },
                {
                    model: PatientNote, as: 'patientNote', include: [
                        {
                            model: Staff,
                            as: 'staff'
                        },
                        {
                            model: StaffComment,
                            as: 'comments'
                        }
                    ]
                },

                {
                    model: Prescription, as: 'prescriptions', include: [
                        {
                            model: Medicine, as: 'medicine',
                        },
                        { model: Staff, as: 'doctor' },
                        {
                            model: ClinicalIntervention, as: 'clinicalInterventions'
                        }

                    ]
                },
                {
                    model: LabTestResult, as: 'labTests', include: [
                        {
                            model: LabTestTemplate, as: 'template'
                        }
                    ]
                },
                {
                    model:Diagnosis, as:'diagnosis'
                }
            ]
        });

        res.status(200).json(admissions);
    } catch (error) {
        res.status(500).json({
            error: error.message || "Error fetching admissions."
        });
    }
};

// Get admission details by visit ID
exports.getAdmissionDetails = async (req, res) => {
    try {
        const { visit_id } = req.params;

        const admission = await Visit.findOne({
            where: {
                id: visit_id,
                on_admission: true
            },
            include: [
                {
                    association: 'patient',
                    attributes: ['id', 'first_name', 'last_name', 'folder_number', 'date_of_birth']
                },
                {
                    association: 'department',
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!admission) {
            return res.status(404).json({ error: "Admission not found." });
        }

        res.status(200).json(admission);
    } catch (error) {
        res.status(500).json({
            error: error.message || "Error fetching admission details."
        });
    }
};

// Update admission details
exports.updateAdmissionDetails = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { visit_id, bed_number, department_id, note } = req.body;

        if (!visit_id) {
            return res.status(400).json({ error: "Visit ID is required." });
        }

        const visit = await Visit.findByPk(visit_id, { transaction: t });
        if (!visit) throw new Error("Visit not found.");
        if (!visit.on_admission) throw new Error("Patient is not currently admitted.");

        // Update admission details
        await visit.update({
            bed_number,
            department_id,
            note
        }, { transaction: t });

        await t.commit();
        res.status(200).json({
            message: "Admission details updated successfully",
            admission: visit
        });

    } catch (error) {
        await t.rollback();
        res.status(500).json({
            error: error.message || "Error updating admission details."
        });
    }
}


// update admission_status controller
exports.updateAdmissionStatus = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { visit_id, admission_status } = req.body;

        if (!visit_id || !admission_status) {
            return res.status(400).json({ error: "Visit ID and admission status are required." });
        }

        const visit = await Visit.findByPk(visit_id, { transaction: t });
        if (!visit || !visit.on_admission) {
            return res.status(404).json({ error: "Visit not found or patient is not admitted." });
        }

        // Update admission status
        await visit.update({
            admission_status
        }, { transaction: t });

        await t.commit();
        res.status(200).json({
            message: "Admission status updated successfully",
            visit
        });

    } catch (error) {
        await t.rollback();
        res.status(500).json({
            error: error.message || "Error updating admission status."
        });
    }
};




