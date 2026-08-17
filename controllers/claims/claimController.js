const Claim = require("../../models/claims/claim");
const ClaimItem = require("../../models/claims/claimItem");
const Visit = require("../../models/Visit");
const Patient = require("../../models/patient");

const LabResult = require("../../models/lab_results");
const LabTestResult = require("../../models/lab/LabTestResult");
const Staff = require("../../models/staff");
const Institution = require("../../models/institution");
const Department = require("../../models/department");
const Invoice = require("../../models/Invoice");
const Insurance = require("../../models/insuranceTable");
const Prescription = require("../../models/prescription");
const Diagnosis = require("../../models/diagnosis");
const systemDiagnosis = require("../../models/claims/systemDiagnosis");
const Procedure = require("../../models/procedure/procedure");
const VitalSignsRecord = require("../../models/vital_signs_records");

// J7: new claim items resolve labTest -> LabTestResult; historical items that
// reference the old lab_results table are served through legacyLabTest so the
// frontend keeps working.
const applyLabTestFallback = (claim) => {
  const plain = claim && typeof claim.toJSON === 'function' ? claim.toJSON() : claim;
  const items = plain && plain.items ? plain.items : [];
  for (const item of items) {
    if (!item.labTest && item.legacyLabTest) {
      item.labTest = item.legacyLabTest;
    }
    delete item.legacyLabTest;
  }
  return plain;
};

// Get all claims with pagination and filters
exports.getAllClaims = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            startDate,
            endDate,
            search,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        // Build where clause
        const whereClause = {};

        if (status) {
            whereClause.claim_status = status;
        }

        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) {
                whereClause.createdAt[Op.gte] = new Date(startDate);
            }
            if (endDate) {
                whereClause.createdAt[Op.lte] = new Date(endDate);
            }
        }

        // Build the comprehensive include structure
        
        const includeClause = [{
                model: Visit,
                as: 'visit',
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
                                    { model: LabTestResult, as: "labTest" },
                                    { model: LabResult, as: "legacyLabTest" },
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
                ]
            },
            {
                model: ClaimItem,
                as: 'items',
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
                    { model: LabTestResult, as: "labTest" },
                    { model: LabResult, as: "legacyLabTest" },
                    { model: Staff, as: "staff" },
                    { model: Procedure, as: "procedure" },
                ]
            }
        ];

        // Add search condition to visit if search term provided
        if (search) {
            includeClause[0].where = {
                [Op.or]: [
                    { '$visit.patient.first_name$': { [Op.like]: `%${search}%` } },
                    { '$visit.patient.last_name$': { [Op.like]: `%${search}%` } },
                    { '$visit.attendance_number$': { [Op.like]: `%${search}%` } },
                    { '$visit.patient.mrn$': { [Op.like]: `%${search}%` } },
                    { '$visit.patient.folder_number$': { [Op.like]: `%${search}%` } }
                ]
            };
            includeClause[0].required = true;
        }

        const offset = (page - 1) * limit;

        const { count, rows: claims } = await Claim.findAndCountAll({
            where: whereClause,
            include: includeClause,
            order: [[sortBy, sortOrder]],
            limit: parseInt(limit),
            offset: parseInt(offset),
            distinct: true, // Important for count with includes
            subQuery: false // May be needed for complex includes with search
        });

        res.json({
            success: true,
            data: claims.map(applyLabTestFallback),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalItems: count,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching claims:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get claim by ID
exports.getClaimById = async (req, res) => {
    try {
        const { id } = req.params;

        const claim = await Claim.findByPk(id, {
            include: [
                {
                    model: Visit,
                    as: 'visit',
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
                                        { model: LabTestResult, as: "labTest" },
                                        { model: LabResult, as: "legacyLabTest" },
                                        { model: Staff, as: "staff" },
                                        { model: Procedure, as: "procedure" },
                                    ]
                                }
                            ]
                        },
                        { model: VitalSignsRecord, as: 'vitalSignsRecords' },
                        { model: Institution, as: 'institution' },
                        { model: Department, as: 'department' },
                        { model: Invoice, as: 'invoice' },
                    ]
                },
                {
                    model: ClaimItem,
                    as: 'items',
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
                        { model: LabTestResult, as: "labTest" },
                        { model: LabResult, as: "legacyLabTest" },
                        { model: Staff, as: "staff" },
                        { model: Procedure, as: "procedure" },
                    ]
                }
            ]
        });

        if (!claim) {
            return res.status(404).json({
                success: false,
                error: "Claim not found"
            });
        }

        res.json({
            success: true,
            data: applyLabTestFallback(claim)
        });
    } catch (error) {
        console.error('Error fetching claim:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get claims by visit_id
exports.getClaimsByVisitId = async (req, res) => {
    try {
        const { visit_id } = req.params;
        const {
            page = 1,
            limit = 10,
            status,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        // Build where clause
        const whereClause = { visit_id };

        if (status) {
            whereClause.claim_status = status;
        }

        const offset = (page - 1) * limit;

        const { count, rows: claims } = await Claim.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Visit,
                    as: 'visit',
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
                        { model: VitalSignsRecord, as: 'vitalSignsRecords' },
                        { model: Institution, as: 'institution' },
                        { model: Department, as: 'department' },
                        { model: Invoice, as: 'invoice' },
                    ]
                },
                {
                    model: ClaimItem,
                    as: 'items',
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
                        { model: LabTestResult, as: "labTest" },
                        { model: LabResult, as: "legacyLabTest" },
                        { model: Staff, as: "staff" },
                        { model: Procedure, as: "procedure" },
                    ]
                }
            ],
            order: [[sortBy, sortOrder]],
            limit: parseInt(limit),
            offset: parseInt(offset),
            distinct: true
        });

        res.json({
            success: true,
            data: claims.map(applyLabTestFallback),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalItems: count,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching claims by visit_id:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Allowed claim status transitions per the existing HMS workflow. Explicitly
// blocks unsafe moves such as Approved -> Draft, Submitted -> Draft and
// Rejected -> Approved (a rejected claim must be resubmitted / moved to
// Pending first).
const CLAIM_STATUS_VALUES = ['Draft', 'Pending', 'Submitted', 'Approved', 'Rejected', 'Resubmitted'];
const CLAIM_STATUS_TRANSITIONS = {
  Draft: ['Pending', 'Draft'],
  Pending: ['Submitted', 'Rejected', 'Resubmitted', 'Draft'],
  Submitted: ['Approved', 'Rejected', 'Resubmitted', 'Submitted'],
  Approved: ['Approved'],
  Rejected: ['Resubmitted', 'Pending', 'Rejected'],
  Resubmitted: ['Submitted', 'Approved', 'Rejected', 'Resubmitted'],
};

// Update claims status claim_status
exports.updateClaimStatus = async (req, res) => {
    const { claim_id, claim_status } = req.body;

    try {
        const claim = await Claim.findByPk(claim_id);
        if (!claim) return res.status(404).json({ error: "Claim not found" });

        if (!CLAIM_STATUS_VALUES.includes(claim_status)) {
            return res.status(400).json({ error: `Invalid claim status: ${claim_status}` });
        }

        const current = claim.claim_status;
        if (claim_status === current) {
            return res.json({ message: "Claim status unchanged", claim });
        }

        const allowed = CLAIM_STATUS_TRANSITIONS[current] || [];
        if (!allowed.includes(claim_status)) {
            return res.status(400).json({
                error: `Invalid claim status transition: ${current} -> ${claim_status}`,
                allowed: allowed,
            });
        }

        await claim.update({ claim_status });
        res.json({ message: "Claim status updated successfully", claim });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Approve all claims status in bulk
exports.approveClaimsInBatch = async (req, res) => {
    const { batch_id } = req.body;

    try {
        const claims = await Claim.findAll({ where: { batch_id } });
        if (claims.length === 0) return res.status(404).json({ error: "No claims found in this batch" });

        for (let claim of claims) {
            await claim.update({ claim_status: "Approved" });
        }

        res.json({ message: "All claims in the batch approved successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}






