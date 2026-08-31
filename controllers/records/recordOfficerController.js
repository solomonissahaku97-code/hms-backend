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
const Invoice = require("../../models/Invoice");
const ServiceBill = require("../../models/serviceBill");
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
const ANC = require("../../models/maternity/ANC");
const LabTestField = require("../../models/lab/LabTestField");
const { Op } = require("sequelize");




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
    // Relatives information - all optional, phone pattern validation only applies to non-empty values
    next_of_kin_name: Joi.string().allow('', null).optional(),
    next_of_kin_phone: Joi.string().allow('', null).optional(),
    next_of_kin_relationship: Joi.string().allow('', null).optional(),
    emergency_contact_name: Joi.string().allow('', null).optional(),
    emergency_contact_phone: Joi.string().allow('', null).optional(),
    emergency_contact_relationship: Joi.string().allow('', null).optional(),
    has_insurance: Joi.boolean().optional(),
    insurance_provider: Joi.string().optional().valid('NHIS', 'Private', 'Other'),
    insurance_expiry_date: Joi.date().optional(),
});

/**
 * Search for potential duplicate patients within an institution.
 * Checks name + DOB, phone, NHIS number, Ghana Card number.
 * Returns matches ranked by confidence.
 */
exports.searchDuplicatePatients = async (req, res) => {
    const { institution_id, first_name, last_name, date_of_birth, phone_number, nhis_number, ghana_card_number } = req.query;

    if (!institution_id) {
        return res.status(400).json({ success: false, message: 'institution_id is required' });
    }

    try {
        const conditions = [];

        // Strong match: same name + DOB (within same institution)
        if (first_name && last_name && date_of_birth) {
            conditions.push({
                [Op.and]: [
                    { institution_id },
                    { first_name: { [Op.iLike]: first_name.trim() } },
                    { last_name: { [Op.iLike]: last_name.trim() } },
                    { date_of_birth: date_of_birth },
                ]
            });
        }

        // Phone number match (within same institution)
        if (phone_number && phone_number.trim()) {
            conditions.push({
                [Op.and]: [
                    { institution_id },
                    { phone: { [Op.iLike]: phone_number.trim() } },
                ]
            });
        }

        // Note: nhis_number and ghana_card_number are NOT columns on the patients table.
        // They exist on the records (visits) table. For now, duplicate detection
        // uses name + DOB and phone number, which are the strongest signals.

        if (conditions.length === 0) {
            return res.status(200).json({ success: true, duplicates: [], message: 'No search criteria provided' });
        }

        const duplicates = await Patient.findAll({
            where: { [Op.or]: conditions },
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'folder_number', 'phone', 'date_of_birth', 'gender', 'institution_id', 'has_insurance', 'created_at'],
            limit: 10,
            order: [['created_at', 'DESC']],
        });

        // Score each match by confidence
        const scored = duplicates.map(p => {
            let confidence = 0;
            let reasons = [];

            if (first_name && last_name && date_of_birth) {
                const nameMatch = p.first_name?.toLowerCase() === first_name.trim().toLowerCase() &&
                                  p.last_name?.toLowerCase() === last_name.trim().toLowerCase();
                const dobMatch = p.date_of_birth === date_of_birth;
                if (nameMatch && dobMatch) { confidence += 50; reasons.push('Same name and date of birth'); }
                else if (nameMatch) { confidence += 25; reasons.push('Same name'); }
            }

            if (phone_number && p.phone) {
                const normalize = (s) => s?.replace(/[^0-9]/g, '');
                if (normalize(p.phone) === normalize(phone_number)) {
                    confidence += 30;
                    reasons.push('Same phone number');
                }
            }

            return {
                ...p.toJSON(),
                match_confidence: confidence,
                match_reasons: reasons,
            };
        });

        // Sort by confidence descending
        scored.sort((a, b) => b.match_confidence - a.match_confidence);

        return res.status(200).json({
            success: true,
            duplicates: scored,
            has_strong_match: scored.some(d => d.match_confidence >= 50),
        });
    } catch (error) {
        console.error('Error searching duplicate patients:', error);
        return res.status(500).json({ success: false, message: 'Failed to search for duplicates' });
    }
};

exports.createNewPatient = async (req, res) => {
    const {
        first_name, middle_name, last_name, city, religion, address, country,
        institution_id, phone_number, gender, email, date_of_birth,
        department_id, nhis_number, ghana_card_number,
        next_of_kin_name, next_of_kin_phone, next_of_kin_relationship,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        has_insurance, insurance_provider, insurance_expiry_date,
        force_register // Frontend can set this to true after showing duplicate warning
    } = req.body;

    // Validate the request body
    const { error } = patientSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details[0].message,
            message: error.details[0].message
        });
    }

    const transaction = await sequelize.transaction();

    try {
        const institution = await Institution.findByPk(institution_id, { transaction });
        if (!institution) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                error: 'Institution not found',
                message: 'Institution not found'
            });
        }

        // ── Duplicate Detection ──
        // Check for strong matches unless force_register is set
        if (!force_register) {
            const duplicateConditions = [];

            // Name + DOB match (strongest signal — within same institution)
            if (first_name && last_name && date_of_birth) {
                duplicateConditions.push({
                    [Op.and]: [
                        { institution_id },
                        { first_name: { [Op.iLike]: first_name.trim() } },
                        { last_name: { [Op.iLike]: last_name.trim() } },
                        { date_of_birth: date_of_birth },
                    ]
                });
            }

            // Phone number match (within same institution)
            if (phone_number && phone_number.trim()) {
                duplicateConditions.push({
                    [Op.and]: [
                        { institution_id },
                        { phone: { [Op.iLike]: phone_number.trim() } },
                    ]
                });
            }

            if (duplicateConditions.length > 0) {
                const existingPatients = await Patient.findAll({
                    where: { [Op.or]: duplicateConditions },
                    attributes: ['id', 'first_name', 'middle_name', 'last_name', 'folder_number', 'phone', 'date_of_birth', 'gender', 'has_insurance', 'created_at'],
                    limit: 5,
                    transaction,
                });

                if (existingPatients.length > 0) {
                    await transaction.rollback();
                    return res.status(409).json({
                        success: false,
                        message: 'Potential duplicate patient detected',
                        error: 'A patient with similar identifying information already exists',
                        duplicates: existingPatients.map(p => ({
                            id: p.id,
                            name: `${p.first_name} ${p.last_name}`,
                            folder_number: p.folder_number,
                            phone: p.phone,
                            date_of_birth: p.date_of_birth,
                        })),
                        hint: 'Set force_register=true to override and create a new patient anyway',
                    });
                }
            }
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

        // ── Sync to Centralized Patient Network (non-blocking) ──
        syncToCentralNetwork({
            first_name, middle_name, last_name, date_of_birth, gender,
            phone: phone_number, email, address, city, country,
            has_insurance, insurance_provider: insurance_provider || null,
            nhis_number: nhis_number || null, institution_id,
            institution_patient_id: newPatient.id
        }).catch(err => console.error('[Network] Sync failed (non-blocking):', err.message));

        return res.status(201).json({
            patient: newPatient,
            message: 'Patient created successfully'
        });
    } catch (error) {
        await transaction.rollback();
        console.log(error);
        return res.status(400).json({
            success: false,
            error: error.message,
            message: error.message
        });
    }
};

// ── Helper: Sync patient to Centralized Patient Network ──
const http = require('http');
const NETWORK_SERVICE_URL = process.env.NETWORK_SERVICE_URL || 'http://localhost:3011';
const SERVICE_KEY = process.env.SERVICE_AUTH_SECRET || process.env.HMS_SERVICE_KEY || '';

async function syncToCentralNetwork(patientData) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            first_name: patientData.first_name,
            middle_name: patientData.middle_name,
            last_name: patientData.last_name,
            date_of_birth: patientData.date_of_birth,
            gender: patientData.gender === 'M' ? 'M' : patientData.gender === 'F' ? 'F' : patientData.gender,
            phone: patientData.phone,
            email: patientData.email,
            address: patientData.address,
            city: patientData.city,
            country: patientData.country,
            has_insurance: patientData.has_insurance || false,
            insurance_provider: patientData.insurance_provider,
            nhis_number: patientData.nhis_number
        });

        const url = new URL('/api/v1/network/central-patients', NETWORK_SERVICE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'X-Service-Key': SERVICE_KEY,
                'X-Service-Institution-Id': patientData.institution_id || '',
            },
            timeout: 5000,
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    if (result.success) {
                        const centralId = result.patient?.id;
                        if (centralId) {
                            // Link the local patient to the central identity
                            linkToCentralNetwork(centralId, patientData.institution_id, patientData.institution_patient_id);
                        }
                        console.log('[Network] Synced patient to central network:', result.patient?.central_patient_number);
                    } else if (result.existing_patient) {
                        // Duplicate found — link to existing central patient
                        linkToCentralNetwork(result.existing_patient.id, patientData.institution_id, patientData.institution_patient_id);
                        console.log('[Network] Linked to existing central patient:', result.existing_patient.central_patient_number);
                    }
                    resolve(result);
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write(payload);
        req.end();
    });
}

async function linkToCentralNetwork(centralPatientId, institutionId, institutionPatientId) {
    return new Promise((resolve) => {
        const payload = JSON.stringify({
            central_patient_id: centralPatientId,
            institution_id: institutionId,
            institution_patient_id: institutionPatientId,
            relationship_type: 'registered'
        });

        const url = new URL('/api/v1/network/relationships', NETWORK_SERVICE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'X-Service-Key': SERVICE_KEY,
                'X-Service-Institution-Id': institutionId || '',
            },
            timeout: 5000,
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    console.log('[Network] Relationship:', result.message || result.relationship?.relationship_type || 'created');
                } catch (e) { /* ignore */ }
                resolve();
            });
        });

        req.on('error', () => resolve());
        req.on('timeout', () => { req.destroy(); resolve(); });
        req.write(payload);
        req.end();
    });
}



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
                                        { model: LabResult, as: 'legacyLabTest' },
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

        // Check for outstanding payments
        const outstandingInvoices = await Invoice.findAll({
            where: {
                balance_due: { [require('sequelize').Op.gt]: 0 }
            },
            include: [{
                model: Visit,
                as: 'visit',
                where: { patient_id },
                attributes: []
            }],
            transaction
        });

        const outstandingBills = await ServiceBill.findAll({
            where: {
                patient_id,
                payment_status: { [require('sequelize').Op.in]: ['Pending', 'Overdue'] }
            },
            transaction
        });

        const hasOutstanding = outstandingInvoices.length > 0 || outstandingBills.length > 0;
        const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + parseFloat(inv.balance_due || 0), 0) +
                                 outstandingBills.reduce((sum, bill) => sum + parseFloat(bill.total_amount || 0) - parseFloat(bill.paid_amount || 0), 0);

        const warning = hasOutstanding ? `Patient has outstanding payment of GHS ${totalOutstanding.toFixed(2)}. Please ensure payment is made before proceeding.` : null;


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
            warning: warning || null
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

// Get all active visits for an institution (optionally filtered by department)
exports.getActiveVisits = async (req, res) => {
    const { institution_id, department_id } = req.query;

    console.log("Received request for active visits:", req.query);

    // Validate request
    const schema = Joi.object({
        institution_id: Joi.string().trim().required(),
        department_id: Joi.string().trim().optional().allow('')
    });

    const { error } = schema.validate(req.query);

    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details[0].message
        });
    }

    try {
        // Build query filters
        const whereClause = {
            institution_id,
            status: "Active"
        };

        // Apply department filter only if provided
        if (department_id && department_id.trim() !== "") {
            whereClause.department_id = department_id.trim();
        }

        const visits = await Visit.findAll({
            where: whereClause,
            include: [
                {
                    model: Patient,
                    as: "patient",
                    include: [
                        {
                            model: Insurance,
                            as: "insurance"
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
                                {
                                    model: Prescription,
                                    as: "prescription"
                                },
                                {
                                    model: Diagnosis,
                                    as: "diagnosis",
                                    include: [
                                        {
                                            model: systemDiagnosis,
                                            as: "systemDiagnosis"
                                        }
                                    ]
                                },
                                {
                                    model: LabResult,
                                    as: "legacyLabTest"
                                },
                                {
                                    model: Staff,
                                    as: "staff"
                                },
                                {
                                    model: Procedure,
                                    as: "procedure"
                                }
                            ]
                        }
                    ]
                },
                {
                    model: VitalSignsRecord,
                    as: "vitalSignsRecords"
                },
                {
                    model: Institution,
                    as: "institution"
                },
                {
                    model: Department,
                    as: "department"
                },
                {
                    model: Invoice,
                    as: "invoice"
                },
                {
                    model: Diagnosis,
                    as: "diagnosis"
                }
            ],
            order: [["createdAt", "DESC"]]
        });

        console.log(visits.length, "active visits retrieved for institution:", institution_id, "and department:", department_id || "all departments",visits);

        return res.status(200).json({
            success: true,
            message: department_id && department_id.trim() !== ""
                ? `Active visits retrieved for department ${department_id}`
                : "All active visits retrieved successfully.",
            count: visits.length,
            filters: {
                institution_id,
                department_id:
                    department_id && department_id.trim() !== ""
                        ? department_id
                        : "all departments"
            },
            data: visits
        });

    } catch (err) {
        console.error("Error fetching active visits:", err);

        return res.status(500).json({
            success: false,
            error: "Failed to retrieve active visits.",
            message: process.env.NODE_ENV === "development"
                ? err.message
                : undefined
        });
    }
};

exports.searchActiveVisits = async (req, res) => {
    const { institution_id, query } = req.query;

    if (!institution_id) {
        return res.status(400).json({
            success: false,
            message: 'institution_id is required'
        });
    }

    const searchQuery = query?.trim();

    if (!searchQuery || searchQuery.length < 2) {
        return res.status(200).json({
            success: true,
            count: 0,
            data: []
        });
    }

    try {
        const visits = await Visit.findAll({
            where: {
                institution_id,
                status: 'Active'
            },

            include: [
                {
                    model: Patient,
                    as: 'patient',
                    required: true,
                    attributes: [
                        'id',
                        'first_name',
                        'middle_name',
                        'last_name',
                        'folder_number',
                        'phone'
                    ],
                    where: {
                        [Op.or]: [
                            {
                                first_name: {
                                    [Op.iLike]: `%${searchQuery}%`
                                }
                            },
                            {
                                middle_name: {
                                    [Op.iLike]: `%${searchQuery}%`
                                }
                            },
                            {
                                last_name: {
                                    [Op.iLike]: `%${searchQuery}%`
                                }
                            },
                            {
                                folder_number: {
                                    [Op.iLike]: `%${searchQuery}%`
                                }
                            },
                            {
                                phone: {
                                    [Op.iLike]: `%${searchQuery}%`
                                }
                            }
                        ]
                    }
                },
                {
                    model: Institution,
                    as: 'institution',
                    attributes: ['id', 'name']
                },
                {
                    model: Department,
                    as: 'department',
                    attributes: ['id', 'name']
                }
            ],

            limit: 20,

            order: [
                ['createdAt', 'DESC']
            ]
        });

        return res.status(200).json({
            success: true,
            count: visits.length,
            data: visits
        });

    } catch (err) {
        console.error('Error searching active visits:', err);

        return res.status(500).json({
            success: false,
            message: 'Failed to search active visits.'
        });
    }
};
// get active visit by department_id



// get visit details
exports.getVisitDetails = async (req, res) => {
    console.log('Received request for visit details with params:', req.params); // Debug log
    const { visit_id } = req.params;

    const schema = Joi.object({
        visit_id: Joi.string().required()
    });

    const { error } = schema.validate(req.params);

    if (error) {
        return res.status(400).json({
            error: error.details[0].message
        });
    }

    try {

        // ==========================
        // Visit (Lightweight Query)
        // ==========================

        let visit = await Visit.findByPk(visit_id, {
            include: [
                {
                    model: Patient,
                    as: "patient"
                },
                {
                    model: VitalSignsRecord,
                    as: "vitalSignsRecords",
                    separate: true
                },
                {
                    model: Institution,
                    as: "institution"
                },
                {
                    model: Department,
                    as: "department"
                },
                {
                    model: Invoice,
                    as: "invoice"
                }
            ]
        });

        // Fallback: if not found by visit ID, try as patient ID
        // and return the patient's most recent active visit
        if (!visit) {
            const patient = await Patient.findByPk(visit_id);
            if (patient) {
                visit = await Visit.findOne({
                    where: { patient_id: patient.id },
                    include: [
                        { model: Patient, as: "patient" },
                        { model: VitalSignsRecord, as: "vitalSignsRecords", separate: true },
                        { model: Institution, as: "institution" },
                        { model: Department, as: "department" },
                        { model: Invoice, as: "invoice" }
                    ],
                    order: [["createdAt", "DESC"]]
                });
            }
        }

        if (!visit) {
            return res.status(404).json({
                error: "Visit not found"
            });
        }

        // ==========================
        // Patient Notes
        // ==========================

        const patientNote = await PatientNote.findAll({
            where: {
                visit_id
            },
            include: [
                {
                    model: Staff,
                    as: "staff"
                },
                {
                    model: StaffComment,
                    as: "comments",
                    separate: true
                }
            ]
        });

        // ==========================
        // Claims
        // ==========================

        const claims = await Claim.findAll({
            where: {
                visit_id
            },
            include: [
                {
                    model: ClaimItem,
                    as: "items",
                    separate: true,
                    include: [
                        {
                            model: LabResult,
                            as: "legacyLabTest"
                        },
                        {
                            model: Prescription,
                            as: "prescription"
                        },
                        {
                            model: Procedure,
                            as: "procedure"
                        },
                        {
                            model: Diagnosis,
                            as: "diagnosis",
                            include: [
                                {
                                    model: systemDiagnosis,
                                    as: "systemDiagnosis"
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        // ==========================
        // Prescriptions
        // ==========================

        const prescriptions = await Prescription.findAll({
            where: {
                visit_id
            },
            include: [
                {
                    model: Medicine,
                    as: "medicine"
                },
                {
                    model: Staff,
                    as: "doctor"
                },
                {
                    model: ClinicalIntervention,
                    as: "clinicalInterventions",
                    separate: true
                }
            ]
        });

        // ==========================
        // Lab Tests
        // ==========================

        const labTests = await LabTestResult.findAll({
            where: {
                visit_id
            },
            include: [
                {
                    model: LabTestTemplate,
                    as: "template",
                    include: [
                        {
                            model: LabInvestigation,
                            as: "lab_tarrif"
                        }
                    ]
                }
            ]
        });

        // ==========================
        // Diagnosis
        // ==========================

        const diagnosis = await Diagnosis.findAll({
            where: {
                visit_id
            },
            include: [
                {
                    model: systemDiagnosis,
                    as: "systemDiagnosis"
                },
                {
                    model: Staff,
                    as: "staff"
                }
            ]
        });

        // ==========================
        // Appointments
        // ==========================

        const appointments = await Appointment.findAll({
            where: {
                visit_id
            },
            include: [
                {
                    model: Staff,
                    as: "doctor"
                }
            ]
        });

        // ==========================
        // Procedures
        // ==========================

        const procedures = await Procedure.findAll({
            where: {
                visit_id
            },
            include: [
                {
                    model: Staff,
                    as: "primary_doctor"
                },
                {
                    model: Staff,
                    as: "assisting_staff"
                },
                {
                    model: GDRGCode,
                    as: "procedure_code"
                },
                {
                    model: Department,
                    as: "department"
                }
            ]
        });

        const response = visit.toJSON();

        response.patientNote = patientNote;
        response.claims = claims;
        response.prescriptions = prescriptions;
        response.labTests = labTests;
        response.diagnosis = diagnosis;
        response.appointments = appointments;
        response.procedure = procedures;

        return res.status(200).json(response);

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: "An error occurred while fetching the visit details."
        });

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

// Transfer visit to another department
exports.transferVisitDepartment = async (req, res) => {
    const { visit_id, new_department_id } = req.body;

    if (!visit_id || !new_department_id) {
        return res.status(400).json({ error: 'visit_id and new_department_id are required' });
    }

    try {
        const visit = await Visit.findByPk(visit_id);
        if (!visit) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        const newDepartment = await Department.findByPk(new_department_id);
        if (!newDepartment) {
            return res.status(404).json({ error: 'New department not found' });
        }

        await visit.update({ department_id: new_department_id });

        // Also update the patient's department if they have one
        if (visit.patient_id) {
            await Patient.update(
                { department_id: new_department_id },
                { where: { id: visit.patient_id } }
            );
        }

        return res.status(200).json({
            message: 'Visit transferred to new department successfully',
            visit_id: visit.id,
            new_department_id: newDepartment.id,
            department_name: newDepartment.name
        });
    } catch (error) {
        console.error('Error transferring visit:', error);
        return res.status(500).json({ error: 'An error occurred while transferring the visit' });
    }
};

