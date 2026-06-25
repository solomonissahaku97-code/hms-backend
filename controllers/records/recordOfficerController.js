const Institution = require("../../models/institution");
const Patient = require("../../models/patient");
const VitalSignsRecord = require("../../models/vital_signs_records");
const folderGenerator = require('../../service/generateFolderNumber');
const Joi = require('joi');
const { sequelize } = require("../../models");
const Visit = require("../../models/Visit");
const { createClaim } = require('../../service/claimService');
const Claim = require("../../models/claims/claim");
const ClaimItem = require("../../models/claims/claimItem");
const LabResult = require("../../models/lab_results");
const Prescription = require("../../models/prescription");
const Department = require("../../models/department");
const Procedure = require("../../models/procedure/procedure");
const Medicine = require("../../models/claims/medication");
const Diagnosis = require("../../models/diagnosis");
const PatientNote = require("../../models/PatientNote");
const LabTestResult = require("../../models/lab/LabTestResult");
const LabTestTemplate = require("../../models/lab/LabTestTemplate");
const Staff = require("../../models/staff");
const ClinicalIntervention = require("../../models/ClinicalIntervention");
const StaffComment = require("../../models/StaffComment");
const LabInvestigation = require("../../models/claims/LabInvestigations");
const Insurance = require("../../models/insuranceTable");
const PatientDiagnosis = require("../../models/patientDiagnosis");
const systemDiagnosis = require("../../models/claims/systemDiagnosis");
const Appointment = require("../../models/appointment");
const GDRGCode = require("../../models/claims/GDRGCode");
const Invoice = require("../../models/Invoice");
const ANC = require("../../models/maternity/ANC");
const LabTestField = require("../../models/lab/LabTestField");




// Define the Joi schema for validation
const patientSchema = Joi.object({
    first_name: Joi.string().min(1).required(),
    middle_name: Joi.string().min(1).allow('', null).optional(),
    last_name: Joi.string().min(1).required(),
    nin_number: Joi.string().optional(),
    department_id: Joi.string().required(), // ✅ ADD THIS
    city: Joi.string().min(1).required(),
    religion: Joi.string().optional(),
    address: Joi.string().min(1).required(),
    country: Joi.string().min(1).required(),
    institution_id: Joi.string().required(),
    // department_id: Joi.string().required(),
    phone_number: Joi.string().pattern(/^\+?[0-9]{5,15}$/).min(5).max(15).required(),
    gender: Joi.string().valid('M', 'F').required(),
    email: Joi.string().email().allow('', null).optional(),
    date_of_birth: Joi.date().iso().required(),
    is_antenatal_patient: Joi.boolean().optional(),
    nhis_number: Joi.string().optional(),
    ghana_card_number: Joi.string().optional(),
    // Relatives information
    next_of_kin_name: Joi.string().optional(),
    next_of_kin_phone: Joi.string()
        .pattern(/^\+?[0-9]{5,15}$/).min(5).max(15).optional()
    ,
    next_of_kin_relationship: Joi.string().optional(),
    emergency_contact_name: Joi.string().optional(),
    emergency_contact_phone: Joi.string().pattern(/^\+?[0-9]{5,15}$/).min(5).max(15).optional(),
    emergency_contact_relationship: Joi.string().optional(),
    has_insurance: Joi.boolean().optional(),
    insurance_provider: Joi.string().optional().valid('NHIS', 'Private', 'Other'),
    insurance_expiry_date: Joi.date().optional(),
});

exports.createNewPatient = async (req, res) => {
    const {
        first_name, middle_name, last_name, city, religion, address, country,
        institution_id, phone_number, gender, email, date_of_birth,
        department_id, nhis_number, ghana_card_number,
        next_of_kin_name, next_of_kin_phone, next_of_kin_relationship,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        has_insurance, insurance_provider, insurance_expiry_date
    } = req.body;
    console.log(req.body)

    // Validate the request body
    const { error } = patientSchema.validate(req.body);
    if (error) {
        console.log(error)
        return res.status(400).json({ error: error.details[0].message });
    }

    const transaction = await sequelize.transaction();

    try {
        const institution = await Institution.findByPk(institution_id, { transaction });
        if (!institution) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Institution not found' });
        }

        // Prepare metadata with relatives information
        const metadata = {
            relatives: {
                next_of_kin: {
                    name: next_of_kin_name,
                    phone: next_of_kin_phone,
                    relationship: next_of_kin_relationship
                },
                emergency_contact: {
                    name: emergency_contact_name,
                    phone: emergency_contact_phone,
                    relationship: emergency_contact_relationship
                }
            }
        };

        const folderNumber = await folderGenerator.generateFolderNumber();

        // Create the patient with metadata
        const newPatient = await Patient.create({
            first_name,
            last_name,
            middle_name,
            city,
            religion,
            address,
            country,
            phone_number,
            gender,
            email,
            date_of_birth,
            institution_id,
            department_id,
            nhis_number: has_insurance ? nhis_number : null,
            ghana_card_number,
            folder_number: folderNumber,
            status: 'discharged',
            has_insurance,
            metadata
        }, { transaction });

        // Create insurance record if patient has insurance
        if (has_insurance) {
            await Insurance.create({
                patient_id: newPatient.id,
                institution_id,
                insurance_provider: insurance_provider,
                insurance_number: nhis_number,
                insurance_expiry_date,
                insured: true
            }, { transaction });
        }

        await transaction.commit();
        return res.status(201).json({
            patient: newPatient,
            message: 'Patient created successfully'
        });
    } catch (error) {
        await transaction.rollback();
        console.log(error);
        return res.status(400).json({ error: error.message });
    }
};



// get all patients in the institution
exports.getAllPatients = async (req, res) => {
    const { institution_id } = req.params;
    // Validate the request parameters
    const schema = Joi.object({
        institution_id: Joi.string().required()
    });
    const { error } = schema.validate(req.params);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    try {
        // Fetch all patients in the institution
        const patients = await Patient.findAll({
            where: { institution_id },
            // include: [
            //     { model: Visit, as: 'visits' },
            //     { model: VitalSignsRecord, as: 'vitalSignsRecords' },
            //     {
            //         model: Insurance,
            //         as: 'insurance',

            //     }
            // ]
        });
        return res.status(200).json(patients);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while fetching patients' });
    }
};

// get patient details
exports.getPatientDetails = async (req, res) => {
    const { id } = req.params;

    try {
        const patient = await Patient.findOne({
            where: { id },
            include: [
                {
                    model: Visit,
                    as: 'visits',
                    include: [
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
                            model: Claim,
                            as: 'claims',
                            include: [
                                {
                                    model: ClaimItem,
                                    as: 'items',                 // ← **alias must match the hasMany**
                                    include: [
                                        { model: LabResult, as: 'labTest' },
                                        // { model: Medicine, as: 'medicine' },
                                        { model: Procedure, as: 'procedure' },
                                        {
                                            model: Diagnosis, as: 'diagnosis',
                                            include: [
                                                {
                                                    model: systemDiagnosis,
                                                    as: 'systemDiagnosis'
                                                }
                                            ]

                                        },



                                    ]
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
                                    model: LabTestTemplate, as: 'template',
                                    include: [
                                        {
                                            model: LabInvestigation,
                                            as: 'lab_tarrif'
                                        },
                                        {
                                            model: LabTestField,
                                            as: 'fields'
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            model: Diagnosis,
                            as: 'diagnosis'
                        },
                        {
                            model: Procedure,
                            as: 'procedure'
                        }
                    ]

                },
                {
                    model: Institution,
                    as: 'institution',
                    attributes: ['id', 'name', 'address']
                }
            ],
            attributes: {
                exclude: ['password'] // Exclude sensitive fields
            }
        });

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        res.status(200).json({
            success: true,
            data: patient
        });

    } catch (error) {
        console.error('Error fetching patient details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch patient details',
            error: error.message
        });
    }
};





// initialize a new patient visit
exports.initializeNewPatientVisit = async (req, res) => {
    const { patient_id, institution_id, department_id, attendance_type, visit_type } = req.body;

    if (!patient_id || !institution_id) {
        return res.status(400).json({ error: 'patient_id and institution_id are required' });
    }

    const transaction = await sequelize.transaction();

    try {
        // Check if the patient exists
        const patient = await Patient.findByPk(patient_id, { transaction });
        if (!patient) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Check for existing active visit
        const existingVisit = await Visit.findOne({
            where: {
                patient_id,
                status: 'Active'
            },
            transaction
        });

        if (existingVisit) {
            await transaction.rollback();
            return res.status(400).json({
                error: 'Patient already has an active visit',
                existing_visit_id: existingVisit.id
            });
        }


        const visitData = {
            patient_id,
            institution_id,
            status: 'Active',
            attendance_type,
            visit_type,
            department_id
        };

        console.log('Creating visit with data:', visitData);  // Debug log

        const newVisit = await Visit.create(visitData, { transaction });

        // Initialize claim
        // check_insurance 

        // Create new visit
        if (patient.has_insurance) {
            await createClaim(newVisit.id, transaction);
        }


        // Update patient status
        await Patient.update(
            { status: 'active' },
            { where: { id: patient_id }, transaction }
        );

        await transaction.commit();

        return res.status(201).json({
            message: 'Visit initialized successfully',
            visit: newVisit,

        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error initializing patient visit:', error);

        // More detailed error response
        const errorResponse = {
            error: 'Failed to initialize visit',
            details: {
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                modelError: error.original ? error.original.message : undefined
            }
        };

        return res.status(500).json(errorResponse);
    }
};






// Get all visits for a patient
exports.getPatientVisits = async (req, res) => {
    const { visit_id } = req.params;
    // Validate the request parameters
    const schema = Joi.object({
        visit_id: Joi.string().required()
    });

    const { error } = schema.validate(req.params);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        // Fetch the visit details
        const visit = await Visit.findOne({
            where: { id: visit_id },
            include: [
                { model: Patient, as: 'patient' },
                { model: VitalSignsRecord, as: 'vitalSignsRecords' },
                { model: LabTestResult, as: 'lab_test_results' }
            ]
        });

        if (!visit) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        return res.status(200).json(visit);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while fetching the visit details' });
    }



}

// get all visit in an institution where status is active
exports.getActiveVisits = async (req, res) => {
    const { institution_id, department_id } = req.query;

    // Validate the request parameters
    const schema = Joi.object({
        institution_id: Joi.string().required(),
        department_id: Joi.string().optional().allow('') // Make department_id optional
    });

    const { error } = schema.validate(req.query);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        // Build where clause
        const whereClause = {
            institution_id,
            status: 'Active'
        };

        // Add department_id to where clause only if provided
        if (department_id) {
            whereClause.department_id = department_id;
        }

        // Fetch all active visits for the institution (and department if provided)
        const visits = await Visit.findAll({
            where: whereClause,
            include: [
                {
                    model: Patient,
                    as: 'patient',
                    include: [
                        {
                            model: Insurance,
                            as: 'insurance',
                        }
                    ]
                },
                {
                    model: Claim,
                    as: "claims",
                    include: [
                        {
                            model: ClaimItem,
                            as: "items",
                            include: [
                                { model: Prescription, as: "prescription" },
                                {
                                    model: Diagnosis,
                                    as: 'diagnosis',
                                    include: [
                                        {
                                            model: systemDiagnosis,
                                            as: 'systemDiagnosis'
                                        }
                                    ]
                                },
                                { model: LabResult, as: "labTest" },
                                { model: Staff, as: "staff" }, // performed_by
                                { model: Procedure, as: "procedure" },
                            ]
                        }
                    ]
                },
                { model: VitalSignsRecord, as: 'vitalSignsRecords' },
                { model: Institution, as: 'institution' },
                { model: Department, as: 'department' },
                { model: Invoice, as: 'invoice' },
                {model: Diagnosis, as:'diagnosis'}
            ],
            order: [['createdAt', 'DESC']] // Optional: order by creation date
        });

        return res.status(200).json({
            success: true,
            message: department_id
                ? `Active visits retrieved for department ${department_id}`
                : 'All active visits retrieved',
            data: visits,
            count: visits.length,
            filters: {
                institution_id,
                department_id: department_id || 'all departments'
            }
        });
    } catch (error) {
        console.error('Error fetching active visits:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while fetching active visits'
        });
    }
}

// get active visit by department_id



// get visit details
exports.getVisitDetails = async (req, res) => {
    const { visit_id } = req.params;

    // Validate the request parameters
    const schema = Joi.object({
        visit_id: Joi.string().required()
    });

    const { error } = schema.validate(req.params);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        // Fetch the visit details
        const visit = await Visit.findOne({
            where: { id: visit_id },
            include: [
                { model: Patient, as: 'patient' },
                { model: VitalSignsRecord, as: 'vitalSignsRecords' },
                { model: Institution, as: 'institution' },
                { model: Department, as: 'department' },
                { model: Invoice, as: 'invoice' },
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
                    model: Claim,
                    as: 'claims',
                    include: [
                        {
                            model: ClaimItem,
                            as: 'items',                 // ← **alias must match the hasMany**
                            include: [
                                { model: LabResult, as: 'labTest' },
                                { model: Prescription, as: "prescription" },
                                { model: Procedure, as: 'procedure' },
                                {
                                    model: Diagnosis, as: 'diagnosis',
                                    include: [
                                        {
                                            model: systemDiagnosis,
                                            as: 'systemDiagnosis'
                                        }
                                    ]

                                },



                            ]
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
                            model: LabTestTemplate, as: 'template',
                            include: [
                                {
                                    model: LabInvestigation,
                                    as: 'lab_tarrif'
                                }
                            ]
                        }
                    ]
                },
                {
                    model: Diagnosis, as: 'diagnosis',
                    include: [
                        {
                            model: systemDiagnosis,
                            as: 'systemDiagnosis'
                        },
                        {
                            model: Staff,
                            as: 'staff'
                        }
                    ]

                },
                {
                    model: Appointment,
                    as: 'appointments',
                    include: [
                        {
                            model: Staff,
                            as: 'doctor',

                        },
                    ]
                },
                {
                    model: Procedure,
                    as: 'procedure',
                    include: [
                        { model: Staff, as: 'primary_doctor' },
                        { model: Staff, as: 'assisting_staff' },
                        {
                            model: GDRGCode,
                            as: 'procedure_code'
                        },
                        {
                            model: Department,
                            as: 'department'
                        },
                    ]
                }
            ]
        });


        if (!visit) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        return res.status(200).json(visit);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while fetching the visit details' });
    }
};


// patch patient information
exports.updatePatientInformation = async (req, res) => {
    const { patient_id } = req.params;

    // accept both shapes: flat or wrapped inside "data"
    let data = req.body.data || req.body;

    // log to debug
    console.log("Updating patient with:", data);

    try {
        // find patient
        const patient = await Patient.findByPk(patient_id);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // filter only allowed fields (so no malicious overwrite)
        const allowedFields = [
            'first_name',
            'middle_name',
            'last_name',
            'institution_id',
            'department_id',
            'metadata',
            'status',
            'folder_number',
            'date_of_birth',
            'gender',
            'has_insurance',
            'visit_type',
            'phone_number',
            'email',
            'attendance_type'
        ];

        const safeData = {};
        for (let field of allowedFields) {
            if (data[field] !== undefined) {
                safeData[field] = data[field];
            }
        }

        // update
        await patient.update(safeData);

        return res.status(200).json({
            message: 'Patient information updated successfully',
            patient
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while updating patient information' });
    }
};



// get all insurance providers
exports.getAllInsuranceProviders = async (req, res) => {
    try {
        const insuranceProviders = await Insurance.findAll({
            attributes: ['id', 'insurance_provider', 'insurance_number', 'insurance_expiry_date'],
            include: [
                {
                    model: Patient,
                    as: 'patient',
                    // attributes: ['id', 'first_name', 'last_name', 'folder_number']
                }
            ]
        });

        return res.status(200).json(insuranceProviders);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while fetching insurance providers' });
    }
}

// patch insurance information
exports.updateInsuranceInformation = async (req, res) => {
    const { patient_id } = req.params;
    const { insurance_provider, insurance_number, insurance_expiry_date, insured } = req.body.data;

    // Validate the request parameters
    const schema = Joi.object({
        patient_id: Joi.string().required(),
        insurance_provider: Joi.string().required(),
        insurance_number: Joi.string().required(),
        insurance_expiry_date: Joi.date().iso().required(),
        insured: Joi.boolean().optional(),
    });

    const { error } = schema.validate({ patient_id, insurance_provider, insurance_number, insurance_expiry_date, insured });
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        // Find the patient
        const patient = await Patient.findByPk(patient_id);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Update the patient's insurance information
        await Insurance.update({
            insurance_provider,
            insurance_number,
            insurance_expiry_date,
            insured: insured !== undefined ? insured : true
        }, {
            where: { patient_id }
        });

        // update patient's has_insurance field
        await patient.update({ has_insurance: insured !== undefined ? insured : true });

        return res.status(200).json({ message: 'Insurance information updated successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while updating insurance information' });
    }
}

// details statistic overview of visit
exports.getVisitStatistics = async (req, res) => {
    const { visit_id } = req.params;

    try {
        const visit = await Visit.findByPk(visit_id, {
            include: [
                {
                    model: Claim,
                    as: 'claims',
                    include: [{ model: ClaimItem, as: 'items' }]
                },
                { model: Prescription, as: 'prescriptions' },
                { model: LabTestResult, as: 'labTests' },
                { model: Diagnosis, as: 'diagnosis' },
                { model: Procedure, as: 'procedure' }
            ]
        });

        if (!visit) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        // --- Basic totals ---
        const totalClaims = visit.claims.length;
        const totalClaimItems = visit.claims.reduce((sum, claim) => sum + claim.items.length, 0);
        const totalPrescriptions = visit.prescriptions.length;
        const totalLabTests = visit.labTests.length;
        const totalDiagnoses = visit.diagnosis.length;
        const totalProcedures = visit.procedure.length;

        // --- Status breakdowns ---
        const claimStatusCounts = visit.claims.reduce((acc, claim) => {
            acc[claim.status] = (acc[claim.status] || 0) + 1;
            return acc;
        }, {});

        const labTestStatusCounts = visit.labTests.reduce((acc, test) => {
            acc[test.status] = (acc[test.status] || 0) + 1;
            return acc;
        }, {});

        const prescriptionStatusCounts = visit.prescriptions.reduce((acc, prescription) => {
            acc[prescription.status] = (acc[prescription.status] || 0) + 1;
            return acc;
        }, {});

        const procedureStatusCounts = visit.procedure.reduce((acc, proc) => {
            acc[proc.status] = (acc[proc.status] || 0) + 1;
            return acc;
        }, {});

        // --- Admission related ---
        let lengthOfStay = null;
        if (visit.admission_date && visit.discharge_date) {
            const diff = new Date(visit.discharge_date) - new Date(visit.admission_date);
            lengthOfStay = Math.ceil(diff / (1000 * 60 * 60 * 24)); // days
        }

        return res.status(200).json({
            visitStatus: visit.status,
            admissionStatus: visit.admission_status,
            dischargeType: visit.discharge_type,
            admissionDate: visit.admission_date,
            dischargeDate: visit.discharge_date,
            lengthOfStay,

            totalClaims,
            claimStatusCounts,
            totalClaimItems,

            totalPrescriptions,
            prescriptionStatusCounts,

            totalLabTests,
            labTestStatusCounts,

            totalDiagnoses,

            totalProcedures,
            procedureStatusCounts
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while fetching visit statistics' });
    }
};



// get visit base on visit_type and attendance type
exports.getVisitsByType = async (req, res) => {
    const { institution_id, visit_type, attendance_type } = req.query;

    // Validate the request parameters
    const schema = Joi.object({
        institution_id: Joi.string().required(),
        visit_type: Joi.string().valid('General OPD', 'Maternity').optional(),
        attendance_type: Joi.string().valid('New', 'Follow-up', 'Emergency', 'Referral', 'Transfer').optional()
    });

    const { error } = schema.validate({ institution_id, visit_type, attendance_type });
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
        // Build the query object
        const query = { institution_id };
        if (visit_type) query.visit_type = visit_type;
        if (attendance_type) query.attendance_type = attendance_type;
        query.status = 'Active'; // Only active visits

        // Fetch visits based on the criteria
        const visits = await Visit.findAll({
            where: query,
            include: [
                { model: Patient, as: 'patient' },
                { model: VitalSignsRecord, as: 'vitalSignsRecords' },
                { model: Institution, as: 'institution' },
                { model: Department, as: 'department' },
                { model: ANC, as: 'anc_record' }
            ]
        });

        return res.status(200).json(visits);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while fetching visits' });
    }
}

