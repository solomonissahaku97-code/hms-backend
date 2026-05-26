const Patient = require("../models/patient");
const Admission = require("../models/admission");
const Prescription = require("../models/prescription");
const VitalSignsRecord = require("../models/vital_signs_records");
const Diagnosis = require("../models/diagnosis");
const Department = require("../models/department");
const Institution = require("../models/institution");
const Staff = require("../models/staff");
const PatientDiagnosis = require("../models/patientDiagnosis");
const LabResult = require("../models/lab_results")
const PatientAssignment = require("../models/nurse_station/patientAssignment");
// Get all patients in a specific institution and department
exports.getAllPatientsInDepartment = async (req, res) => {
    const { institutionId, departmentId } = req.params;

    try {
        const patients = await Admission.findAll({
            where: {
                institution_id: institutionId,
                department_id: departmentId,
            },
            include: [
                {
                    model: Patient,
                    as: 'patient',
                    include: [
                        {
                            model: Prescription,
                            as: 'prescriptions',
                        },
                        {
                            model: VitalSignsRecord,
                            as: 'vitalSignsRecords',
                        },
                        {
                            model: Diagnosis,
                            as: 'diagnosis',
                        },
                        {
                            model: LabResult,
                            as: 'labResults',
                        },
                      
                    ]
                },
                {
                    model: Department,
                    as: 'department',
                    attributes: ['id', 'name']
                },
                {
                    model: Institution,
                    as: 'institution',
                    attributes: ['id', 'name']
                },
                {
                    model: Staff,
                    as: 'staff',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ]
        });

        return res.status(200).json({ message: 'Patients retrieved successfully', patients });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while retrieving patients' });
    }
};

// Get a specific patient by institution ID, department ID, and patient ID
exports.getPatientDetails = async (req, res) => {
    const { institutionId, departmentId, patientId } = req.params;

    try {
        const patient = await Admission.findOne({
            where: {
                institution_id: institutionId,
                department_id: departmentId,
                patient_id: patientId,
            },
            include: [
                {
                    model: Patient,
                    as: 'patient',

                    include: [
                        {
                            model: Prescription,
                            as: 'prescriptions',
                        },
                        {
                            model: Vital,
                            as: 'vitals',
                        },
                        {
                            model: Diagnosis,
                            as: 'diagnosis',
                        },
                        {
                            model: LabRequest,
                            as: 'lab_requests',
                        }
                    ]
                },
                {
                    model: Department,
                    as: 'department',
                    attributes: ['id', 'name']
                },
                {
                    model: Institution,
                    as: 'institution',
                    attributes: ['id', 'name']
                },
                {
                    model: Staff,
                    as: 'staff',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ]
        });

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' }); 
        }

        return res.status(200).json({ message: 'Patient retrieved successfully', patient });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while retrieving patient' });
    }
};

// assigned nurse to patient
exports.assignNurseToPatient = async (req, res) => {
    const { nurse_id, visit_id, department_id, shift } = req.body;

    try {
        // Check if the nurse is already assigned to the patient for the same shift
        const existingAssignment = await PatientAssignment.findOne({
            where: {
                nurse_id,
                visit_id,
                department_id,
                shift,
                released_at: null // Ensure the assignment is still active
            }
        });
        
        if (existingAssignment) {
            return res.status(400).json({ message: 'Nurse is already assigned to this patient for the specified shift' });
        }
        const assignment = await PatientAssignment.create({
            nurse_id,
            visit_id,
            department_id,
            shift
        });
        
        return res.status(201).json({ message: 'Nurse assigned to patient successfully', assignment });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while assigning nurse to patient' });
    }
};

// Release nurse from patient
exports.releaseNurseFromPatient = async (req, res) => {
    const { assignmentId } = req.params;
    
    try {
        const assignment = await PatientAssignment.findByPk(assignmentId);
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }
        
        assignment.released_at = new Date();
        await assignment.save();
        
        return res.status(200).json({ message: 'Nurse released from patient successfully', assignment });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while releasing nurse from patient' });
    }
};

// get all nurse assignments by department
exports.getNurseAssignmentsByDepartment = async (req, res) => {
    const { departmentId } = req.params;

    try {
        const assignments = await PatientAssignment.findAll({
            where: {
                department_id: departmentId,
                released_at: null // Only active assignments
            },
            include: [
                {
                    model: Staff,
                    as: 'nurse',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                },
                {
                    model: Visit,
                    as: 'visit',
                    include: [
                        {
                            model: Patient,
                            as: 'patient',
                            attributes: ['id', 'firstName', 'lastName', 'medicalRecordNumber']
                        }
                    ]
                }
            ]
        });

        return res.status(200).json({ message: 'Nurse assignments retrieved successfully', assignments });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'An error occurred while retrieving nurse assignments'
        });
    }
};
