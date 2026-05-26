const Admission = require("../../models/admission");
const Diagnosis = require("../../models/diagnosis");
const LabResult = require("../../models/lab_results");
const Patient = require("../../models/patient");
const Prescription = require("../../models/prescription");
const Staff = require("../../models/staff");

const getDischargeSummary = async (req, res) => {
    try {
        const { patient_id } = req.params;

        // Fetch admission details
        const admission = await Admission.findOne({
            where: { patient_id, admission_status: 'Discharged' },
            include: [
                { model: Patient, as: 'patient' },
                { model: Staff, as: 'staff' } // Fetch staff who handled the case
            ]
        });

        if (!admission) {
            return res.status(404).json({ message: 'No discharge record found for this patient' });
        }

        // Fetch diagnosis
        const diagnosis = await Diagnosis.findAll({ where: { patient_id } });

        // Fetch prescriptions
        const prescriptions = await Prescription.findAll({ where: { patient_id } });

        // Fetch lab results
        const labResults = await LabResult.findAll({ where: { patient_id } });

        // Build discharge summary response
        const summary = {
            patient: {
                id: admission.patient.id,
                name: `${admission.patient.first_name} ${admission.patient.last_name}`,
                gender: admission.patient.gender,
                date_of_birth: admission.patient.date_of_birth
            },
            admission: {
                department_id: admission.department_id,
                admitted_by: admission.staff ? `${admission.staff.first_name} ${admission.staff.last_name}` : "Unknown",
                admission_date: admission.admission_date,
                discharge_date: admission.discharge_date
            },
            diagnosis: diagnosis.map(d => ({ condition: d.condition, notes: d.notes })),
            prescriptions: prescriptions.map(p => ({ medication: p.medication, dosage: p.dosage, instructions: p.instructions })),
            lab_results: labResults.map(l => ({ test: l.test_name, result: l.result, date: l.date_performed }))
        };

        res.status(200).json(summary);
    } catch (error) {
        console.error("Error generating discharge summary:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { getDischargeSummary };
