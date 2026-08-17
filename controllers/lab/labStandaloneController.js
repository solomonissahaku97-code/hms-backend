const { sequelize, Patient, Visit, LabTestResult, LabTestTemplate, LabTestField, ServiceBill, Department, Staff, Institution } = require('../../models');
const LabInvestigation = require('../../models/claims/LabInvestigations');
const Admin = require('../../models/admin');
const InstitutionLabTariff = require('../../models/InstitutionLabTariff');
const { handleBilling } = require('../../utils/billingUtil');
const { Op } = require('sequelize');
const Claim = require('../../models/claims/claim');

// @desc    Search patients for standalone lab workflow
// @route   GET /lab/standalone/patients/search
// @access  Authenticated
exports.searchPatients = async (req, res) => {
    try {
        const { institution_id } = req.user;
        const { query } = req.query;

        if (!query || query.length < 2) {
            return res.json({ success: true, data: [] });
        }

        const patients = await Patient.findAll({
            where: {
                institution_id,
                [Op.or]: [
                    { first_name: { [Op.iLike]: `%${query}%` } },
                    { last_name: { [Op.iLike]: `%${query}%` } },
                    { folder_number: { [Op.iLike]: `%${query}%` } },
                    { phone: { [Op.iLike]: `%${query}%` } }
                ]
            },
            include: [{
                model: Visit,
                as: 'visits',
                where: { status: 'Active' },
                required: false
            }],
            limit: 20,
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: patients });
    } catch (error) {
        console.error('Error searching patients for standalone lab:', error);
        res.status(500).json({ success: false, message: 'Failed to search patients', error: error.message });
    }
};


exports.getPatientDetails = async (req, res) => {
    try {
        const { institution_id } = req.user;
        const { id } = req.params;

        const patient = await Patient.findOne({
            where: { id, institution_id },
            include: [
                {
                    model: Visit,
                    as: 'visits',
                    include: [
                        {
                            model: LabTestResult,
                            as: 'labResults',
                            include: [
                                { model: LabTestTemplate, as: 'template' },
                                { model: Staff, as: 'creator' }
                            ],
                            order: [['createdAt', 'DESC']]
                        }
                    ],
                    order: [['createdAt', 'DESC']]
                }
            ]
        });

        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        res.json({ success: true, data: patient });
    } catch (error) {
        console.error('Error fetching patient details for standalone lab:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch patient details', error: error.message });
    }
};

// @desc    Create direct lab request (standalone - no visit required)
// @route   POST /lab/standalone/request
// @access  Authenticated
exports.createStandaloneLabRequest = async (req, res) => {
    try {
        const institution_id = req.user?.institution_id;
        const createdBy = req.staffId || null;
        const { patient_id, visit_id, tests, request_notes, department_id } = req.body;

        if (!patient_id || !tests || !Array.isArray(tests) || tests.length === 0) {
            return res.status(400).json({ success: false, message: 'Patient ID and at least one test are required' });
        }

        // Verify patient belongs to institution
        const patient = await Patient.findByPk(patient_id);
        if (!patient || patient.institution_id !== institution_id) {
            return res.status(403).json({ success: false, message: 'Access denied. Patient does not belong to your institution.' });
        }

        // Get lab department for this institution
        const labDepartment = await Department.findOne({
            where: { institution_id, departmentType: 'Lab' }
        });

        if (!labDepartment) {
            return res.status(400).json({ success: false, message: 'Lab department not configured for this institution' });
        }

        const transaction = await sequelize.transaction();
        try {
            const createdResults = [];

            for (const test of tests) {
                const { templateId, request_notes: testNotes } = test;

                const template = await LabTestTemplate.findByPk(templateId, {
                    include: [{ model: LabInvestigation, as: 'lab_tarrif' }],
                    transaction
                });

                if (!template) {
                    await transaction.rollback();
                    return res.status(404).json({ success: false, message: `Template not found: ${templateId}` });
                }

                const result = await LabTestResult.create({
                    visit_id: visit_id || null,
                    patient_id,
                    institution_id,
                    department_id: labDepartment.id,
                    templateId,
                    values: {},
                    status: 'pending',
                    request_notes: testNotes || request_notes || '',
                    createdBy
                }, { transaction });

                // Create billing
                const tariff = template.lab_tarrif || {};

                // Check for institution-specific price override
                const institutionOverride = await InstitutionLabTariff.findOne({
                    where: {
                        institution_id,
                        lab_investigation_id: tariff.id,
                        is_active: true
                    }
                });

                const marketPrice = institutionOverride ? parseFloat(institutionOverride.market_price || 0) : parseFloat(tariff.market_price || 0);
                const tariffGhc = institutionOverride ? parseFloat(institutionOverride.tariff_ghc || 0) : parseFloat(tariff.tariff_ghc || 0);

                // J4 — duplicate-billing guard: never bill the same LabTestResult twice.
                const existingBill = await ServiceBill.findOne({
                    where: { service_id: result.id, service_type: 'LabTest' },
                    transaction
                });

                if (!existingBill) {
                    await handleBilling({
                        transaction,
                        patient_id,
                        visit_id: visit_id || null,
                        service_id: result.id,
                        service_type: 'LabTest',
                        description: tariff.test_description || template.name || 'Lab Test',
                        unit_price: marketPrice,
                        nhia_unit_price: tariffGhc,
                        quantity: 1,
                        department_id: labDepartment.id,
                        institution_id,
                        claim_id: null,
                        gdrg_code: tariff.g_drg_code
                    });
                }

                createdResults.push(result);
            }

            await transaction.commit();

            res.status(201).json({
                success: true,
                data: createdResults,
                message: `${createdResults.length} lab test(s) requested successfully`
            });
        } catch (billingError) {
            await transaction.rollback();
            console.error('Billing error in standalone lab request:', billingError);
            res.status(500).json({ success: false, message: 'Failed to create billing for lab tests', error: billingError.message });
        }
    } catch (error) {
        console.error('Error creating standalone lab request:', error);
        res.status(500).json({ success: false, message: 'Failed to create lab request', error: error.message });
    }
};

// @desc    Search visits/records for standalone lab workflow
// @route   GET /lab/standalone/records/search
// @access  Authenticated
exports.searchVisits = async (req, res) => {
    try {
        const { institution_id } = req.user;
        const { query } = req.query;

        if (!query || query.length < 2) {
            return res.json({ success: true, data: [] });
        }

        const visitsMap = new Map();

        // 1) Search visits by attendance_number directly
        const visitsByAttendance = await Visit.findAll({
            where: {
                institution_id,
                status: 'Active',
                attendance_number: { [Op.iLike]: `%${query}%` }
            },
            include: [
                {
                    model: Patient,
                    as: 'patient',
                    required: false
                }
            ],
            limit: 20,
            order: [['createdAt', 'DESC']]
        });

        for (const visit of visitsByAttendance) {
            visitsMap.set(visit.id, visit);
        }

        // 2) Search patients by name/folder_number, then collect their active visits
        const matchingPatients = await Patient.findAll({
            where: {
                institution_id,
                [Op.or]: [
                    { first_name: { [Op.iLike]: `%${query}%` } },
                    { last_name: { [Op.iLike]: `%${query}%` } },
                    { folder_number: { [Op.iLike]: `%${query}%` } }
                ]
            },
            include: [
                {
                    model: Visit,
                    as: 'visits',
                    where: {
                        institution_id,
                        status: 'Active'
                    },
                    required: false
                }
            ],
            limit: 20
        });

        for (const patient of matchingPatients) {
            if (patient.visits && Array.isArray(patient.visits)) {
                for (const visit of patient.visits) {
                    if (!visitsMap.has(visit.id)) {
                        visit.patient = patient;
                        visitsMap.set(visit.id, visit);
                    }
                }
            }
        }

        const results = Array.from(visitsMap.values()).slice(0, 20);

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error searching visits for standalone lab:', error);
        res.status(500).json({ success: false, message: 'Failed to search records', error: error.message });
    }
};
// @route   GET /lab/standalone/patient/:id/history
// @access  Authenticated
exports.getPatientLabHistory = async (req, res) => {
    try {
        const { institution_id } = req.user;
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const patient = await Patient.findOne({
            where: { id, institution_id }
        });

        if (!patient) {
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const results = await LabTestResult.findAndCountAll({
            where: { patient_id: id, institution_id },
            include: [
                { model: LabTestTemplate, as: 'template', include: [{ model: LabInvestigation, as: 'lab_tarrif' }] },
                { model: Staff, as: 'creator' },
                { model: Staff, as: 'verifier' },
                { model: Staff, as: 'releaser' },
                { model: Department, as: 'department' }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset
        });

        res.json({
            success: true,
            data: results.rows,
            pagination: {
                total: results.count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(results.count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching patient lab history:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch lab history', error: error.message });
    }
};

// @desc    Get standalone lab dashboard stats
// @route   GET /lab/standalone/stats
// @access  Authenticated
exports.getStandaloneLabStats = async (req, res) => {
    try {
        const { institution_id } = req.user;
        const labDepartment = await Department.findOne({
            where: { institution_id, departmentType: 'Lab' }
        });

        if (!labDepartment) {
            return res.json({
                success: true,
                data: {
                    pending: 0,
                    completed: 0,
                    total: 0,
                    today: 0,
                    thisWeek: 0
                }
            });
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);

        const [pending, completed, total, today, thisWeek, completedToday, completedThisWeek] = await Promise.all([
            LabTestResult.count({ where: { institution_id, department_id: labDepartment.id, status: 'pending' } }),
            LabTestResult.count({ where: { institution_id, department_id: labDepartment.id, status: 'completed' } }),
            LabTestResult.count({ where: { institution_id, department_id: labDepartment.id } }),
            LabTestResult.count({ where: { institution_id, department_id: labDepartment.id, createdAt: { [Op.gte]: todayStart } } }),
            LabTestResult.count({ where: { institution_id, department_id: labDepartment.id, createdAt: { [Op.gte]: weekStart } } }),
            LabTestResult.count({ where: { institution_id, department_id: labDepartment.id, status: 'completed', createdAt: { [Op.gte]: todayStart } } }),
            LabTestResult.count({ where: { institution_id, department_id: labDepartment.id, status: 'completed', createdAt: { [Op.gte]: weekStart } } })
        ]);

        res.json({
            success: true,
            data: { pending, completed, total, today, thisWeek, completedToday, completedThisWeek }
        });
    } catch (error) {
        console.error('Error fetching standalone lab stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
    }
};

// @desc    Get pending lab tests for standalone lab
// @route   GET /lab/standalone/pending-tests
// @access  Authenticated
exports.getStandalonePendingTests = async (req, res) => {
    try {
        const { institution_id } = req.user;
        const labDepartment = await Department.findOne({
            where: { institution_id, departmentType: 'Lab' }
        });

        if (!labDepartment) {
            return res.json({ success: true, data: [] });
        }

        const pendingTests = await LabTestResult.findAll({
            where: {
                institution_id,
                department_id: labDepartment.id,
                status: 'pending'
            },
            include: [
                {
                    model: LabTestTemplate,
                    as: 'template',
                    include: [
                        { model: LabInvestigation, as: 'lab_tarrif' },
                        { model: LabTestField, as: 'fields' }
                    ]
                },
                {
                    model: Visit,
                    as: 'visit',
                    include: [
                        { model: Patient, as: 'patient' },
                        { model:Claim, as: 'claims' }
                    ]
                },
                {
                    model: Staff,
                    as: 'creator',
                    attributes: ['id', 'firstName', 'lastName']
                }
            ],
            order: [['createdAt', 'ASC']]
        });

        const creatorIds = [...new Set(pendingTests.map(r => r.createdBy).filter(Boolean))];
        const staffs = await Staff.findAll({ where: { id: creatorIds }, attributes: ['id', 'firstName', 'lastName'] });
        const admins = await Admin.findAll({ where: { id: creatorIds }, attributes: ['id', 'username'] });

        const staffMap = new Map(staffs.map(s => [s.id, `${s.firstName} ${s.lastName}`]));
        const adminMap = new Map(admins.map(a => [a.id, a.username]));

        const enriched = pendingTests.map(result => {
            const plain = result.get({ plain: true });
            plain.creatorName = staffMap.get(result.createdBy) || adminMap.get(result.createdBy) || 'Unknown';
            return plain;
        });

        res.json({ success: true, data: enriched });
    } catch (error) {
        console.error('Error fetching standalone pending tests:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pending tests', error: error.message });
    }
};
