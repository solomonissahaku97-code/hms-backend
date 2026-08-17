const { LabReferral, LabReferralItem, LabTestResult, LabTestTemplate, LabTestField, Patient, Visit, Staff, Department, Institution, Notification, lab_investigation: LabInvestigation, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const AppError = require('../utils/appError');
const { sendPushEngageNotification, sendPushEngageDepartmentNotification } = require('../service/pushEngageService');

// @desc    Search laboratories (institutions with lab capability)
// @route   GET /lab-referrals/search-labs
// @access  Authenticated
exports.searchLabs = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    try {
        const { institution_id } = req.user;
        const { query } = req.query;

        const where = {
            id: { [Op.ne]: institution_id }
        };

        if (query && query.length >= 2) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${query}%` } },
                { region: { [Op.iLike]: `%${query}%` } },
                { address: { [Op.iLike]: `%${query}%` } }
            ];
        }

        const labs = await Institution.findAll({
            where,
            include: [
                {
                    model: Department,
                    as: 'departments',
                    where: { departmentType: 'Lab' },
                    required: false
                }
            ],
            limit: 100,
            order: [['name', 'ASC']]
        });

        const results = labs.map(lab => ({
            id: lab.id,
            name: lab.name,
            region: lab.region,
            address: lab.address,
            contact: lab.contact,
            email: lab.email,
            departments: (lab.departments || []).map(d => ({ id: d.id, name: d.name }))
        }));

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error searching labs:', error);
        res.status(500).json({ success: false, message: 'Failed to search laboratories', error: error.message });
    }
};

// @desc    Create inter-institution lab referral
// @route   POST /lab-referrals
// @access  Authenticated
exports.createReferral = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const transaction = await sequelize.transaction();
    try {
        const { institution_id: referringInstitutionId } = req.user;
        const requestedBy = req.user.id;
        const {
            receiving_institution_id,
            patient_id,
            visit_id,
            department_id,
            clinical_reason,
            clinical_notes,
            expected_result_date,
            notes,
            tests
        } = req.body;

        if (!receiving_institution_id || !patient_id || !tests || !Array.isArray(tests) || tests.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'receiving_institution_id, patient_id, and at least one test are required' });
        }

        if (receiving_institution_id === referringInstitutionId) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Cannot refer to the same institution' });
        }

        const patient = await Patient.findByPk(patient_id, { transaction });
        if (!patient || patient.institution_id !== referringInstitutionId) {
            await transaction.rollback();
            return res.status(403).json({ success: false, message: 'Patient does not belong to your institution' });
        }

        const receivingInstitution = await Institution.findByPk(receiving_institution_id, { transaction });
        if (!receivingInstitution) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Receiving institution not found' });
        }

        const visit = visit_id ? await Visit.findByPk(visit_id, { transaction }) : null;

        const referringInstitution = await Institution.findByPk(referringInstitutionId, { transaction });

        const referralNumber = `REF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

        const referral = await LabReferral.create({
            referral_number: referralNumber,
            referring_institution_id: referringInstitutionId,
            receiving_institution_id,
            patient_id,
            visit_id: visit ? visit.id : null,
            requested_by: requestedBy,
            department_id: department_id || null,
            clinical_reason: clinical_reason || null,
            clinical_notes: clinical_notes || null,
            expected_result_date: expected_result_date || null,
            notes: notes || null,
            status: 'sent'
        }, { transaction });

        const createdItems = [];
        for (const test of tests) {
            const { templateId, request_notes } = test;

            const template = await LabTestTemplate.findByPk(templateId, { transaction });
            if (!template) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: `Template not found: ${templateId}` });
            }

            const item = await LabReferralItem.create({
                referral_id: referral.id,
                template_id: templateId,
                request_notes: request_notes || null
            }, { transaction });

            createdItems.push(item);
        }

        const receivingLabDepartments = await Department.findAll({
            where: { institution_id: receiving_institution_id, departmentType: 'Lab' },
            transaction
        });

        const labResults = [];
        for (const test of tests) {
            const { templateId, request_notes: testNotes } = test;
            const result = await LabTestResult.create({
                visit_id: visit ? visit.id : null,
                patient_id,
                institution_id: receiving_institution_id,
                department_id: receivingLabDepartments.length > 0 ? receivingLabDepartments[0].id : null,
                templateId,
                values: {},
                status: 'pending',
                request_notes: testNotes || null,
                notes: clinical_notes || null,
                createdBy: requestedBy,
                referral_id: referral.id
            }, { transaction });
            labResults.push(result);
        }

        const notificationService = req.app.get('notificationService');

        if (notificationService && receivingLabDepartments.length > 0) {
            const testTemplates = await Promise.all(
                tests.map(t => LabTestTemplate.findByPk(t.templateId))
            );
            const testNames = testTemplates.filter(Boolean).map(t => t.name || 'Lab Test').join(', ') || `${tests.length} lab test(s)`;

            const notification = await notificationService.createNotification({
                title: 'New Incoming Lab Referral',
                description: `New referral from ${referringInstitution.name}: ${testNames}. Patient: ${patient?.first_name || ''} ${patient?.lastName || ''}. Referral #: ${referralNumber}`,
                from_department_id: department_id,
                to_department_id: receivingLabDepartments[0].id,
                from_staff_id: requestedBy,
                institution_id: receiving_institution_id,
                priority: 'Medium',
                type: 'Lab_Result'
            });

            for (const dept of receivingLabDepartments) {
                notificationService.io.to(`department-${dept.id}`).emit('new-department-notification', notification);
            }
        }

        await transaction.commit();

        if (notificationService && receivingLabDepartment) {
            await sendPushEngageDepartmentNotification({
                departmentId: receivingLabDepartment.id,
                title: 'New Incoming Lab Referral',
                message: `You have received a new lab referral from ${referringInstitution.name}. Patient: ${patient?.first_name || ''} ${patient?.lastName || ''}.`,
                url: '/shared/lab/referrals/incoming'
            }).catch(err => console.error('PushEngage notification error:', err));
        }

        const populatedReferral = await LabReferral.findByPk(referral.id, {
            include: [
                { model: Institution, as: 'receivingInstitution', attributes: ['id', 'name', 'region', 'contact'] },
                { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name', 'folder_number', 'phone', 'date_of_birth', 'gender'] },
                { model: Visit, as: 'visit', attributes: ['id', 'attendance_number', 'visit_date'] },
                { model: Staff, as: 'requester', attributes: ['id', 'firstName', 'lastName'] },
                { model: Department, as: 'department', attributes: ['id', 'name'] },
                {
                    model: LabReferralItem,
                    as: 'items',
                    include: [{ model: LabTestTemplate, as: 'template', include: [{ model: LabInvestigation, as: 'lab_tarrif' }] }]
                }
            ]
        });

        res.status(201).json({
            success: true,
            data: populatedReferral,
            message: `Referral ${referralNumber} created successfully`
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error creating referral:', error);
        res.status(500).json({ success: false, message: 'Failed to create referral', error: error.message });
    }
};

// @desc    Get my sent referrals
// @route   GET /lab-referrals/sent
// @access  Authenticated
exports.getMyReferrals = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    try {
        const { institution_id } = req.user;
        const { status, page = 1, limit = 20 } = req.query;

        const where = { referring_institution_id: institution_id };
        if (status) where.status = status;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { rows, count } = await LabReferral.findAndCountAll({
            where,
            include: [
                { model: Institution, as: 'receivingInstitution', attributes: ['id', 'name', 'region'] },
                { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name', 'folder_number'] },
                { model: Visit, as: 'visit', attributes: ['id', 'attendance_number'] },
                {
                    model: LabReferralItem,
                    as: 'items',
                    include: [{ model: LabTestTemplate, as: 'template', include: [{ model: LabInvestigation, as: 'lab_tarrif' }] }]
                },
                {
                    model: LabTestResult,
                    as: 'results',
                    include: [{ model: LabTestTemplate, as: 'template', include: [{ model: LabInvestigation, as: 'lab_tarrif' }] }]
                }
            ],
            order: [['referral_date', 'DESC']],
            limit: parseInt(limit),
            offset
        });

        res.json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching referrals:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch referrals', error: error.message });
    }
};

// @desc    Get incoming referrals for my institution
// @route   GET /lab-referrals/incoming
// @access  Authenticated
exports.getIncomingReferrals = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    try {
        const { institution_id } = req.user;
        const { status, page = 1, limit = 20 } = req.query;

        const where = { receiving_institution_id: institution_id };
        if (status) where.status = status;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { rows, count } = await LabReferral.findAndCountAll({
            where,
            include: [
                { model: Institution, as: 'referringInstitution', attributes: ['id', 'name', 'region', 'contact'] },
                { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name', 'folder_number', 'phone', 'date_of_birth', 'gender'] },
                { model: Visit, as: 'visit', attributes: ['id', 'attendance_number', 'visit_date'] },
                { model: Staff, as: 'requester', attributes: ['id', 'firstName', 'lastName'] },
                { model: Department, as: 'department', attributes: ['id', 'name'] },
                {
                    model: LabReferralItem,
                    as: 'items',
                    include: [{ model: LabTestTemplate, as: 'template', include: [{ model: LabInvestigation, as: 'lab_tarrif' }, { model: LabTestField, as: 'fields' }] }]
                }
            ],
            order: [['referral_date', 'ASC']],
            limit: parseInt(limit),
            offset
        });

        res.json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching incoming referrals:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch incoming referrals', error: error.message });
    }
};

// @desc    Get referral by ID
// @route   GET /lab-referrals/:id
// @access  Authenticated
exports.getReferralById = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    try {
        const { id } = req.params;
        const { institution_id } = req.user;

        const referral = await LabReferral.findOne({
            where: {
                id,
                [Op.or]: [
                    { referring_institution_id: institution_id },
                    { receiving_institution_id: institution_id }
                ]
            },
            include: [
                { model: Institution, as: 'referringInstitution', attributes: ['id', 'name', 'region', 'contact', 'email'] },
                { model: Institution, as: 'receivingInstitution', attributes: ['id', 'name', 'region', 'contact', 'email'] },
                { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name', 'folder_number', 'phone', 'date_of_birth', 'gender'] },
                { model: Visit, as: 'visit', attributes: ['id', 'attendance_number', 'visit_date', 'status'] },
                { model: Staff, as: 'requester', attributes: ['id', 'firstName', 'lastName'] },
                { model: Department, as: 'department', attributes: ['id', 'name'] },
                {
                    model: LabReferralItem,
                    as: 'items',
                    include: [{ model: LabTestTemplate, as: 'template', include: [{ model: LabInvestigation, as: 'lab_tarrif' }] }]
                },
                {
                    model: LabTestResult,
                    as: 'results',
                    include: [
                        { model: LabTestTemplate, as: 'template', include: [{ model: LabInvestigation, as: 'lab_tarrif' }] },
                        { model: Staff, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
                    ]
                }
            ]
        });

        if (!referral) {
            return res.status(404).json({ success: false, message: 'Referral not found' });
        }

        res.json({ success: true, data: referral });
    } catch (error) {
        console.error('Error fetching referral:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch referral', error: error.message });
    }
};

// @desc    Accept referral
// @route   PATCH /lab-referrals/:id/accept
// @access  Authenticated
exports.acceptReferral = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { institution_id } = req.user;

        const referral = await LabReferral.findOne({
            where: { id, receiving_institution_id: institution_id },
            transaction
        });

        if (!referral) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Referral not found' });
        }

        if (referral.status !== 'sent' && referral.status !== 'pending') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: `Cannot accept referral in ${referral.status} status` });
        }

        await referral.update({ status: 'accepted' }, { transaction });

        await transaction.commit();

        const updatedReferral = await LabReferral.findByPk(id, {
            include: [
                { model: Institution, as: 'referringInstitution', attributes: ['id', 'name'] },
                { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name'] },
                {
                    model: LabReferralItem,
                    as: 'items',
                    include: [{ model: LabTestTemplate, as: 'template', include: [{ model: LabInvestigation, as: 'lab_tarrif' }] }]
                }
            ]
        });

        res.json({ success: true, data: updatedReferral, message: 'Referral accepted' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error accepting referral:', error);
        res.status(500).json({ success: false, message: 'Failed to accept referral', error: error.message });
    }
};

// @desc    Reject referral
// @route   PATCH /lab-referrals/:id/reject
// @access  Authenticated
exports.rejectReferral = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    try {
        const { id } = req.params;
        const { institution_id } = req.user;
        const { rejection_reason } = req.body;

        const referral = await LabReferral.findOne({
            where: { id, receiving_institution_id: institution_id }
        });

        if (!referral) {
            return res.status(404).json({ success: false, message: 'Referral not found' });
        }

        if (referral.status !== 'sent' && referral.status !== 'pending') {
            return res.status(400).json({ success: false, message: `Cannot reject referral in ${referral.status} status` });
        }

        await referral.update({
            status: 'rejected',
            notes: rejection_reason ? `${referral.notes || ''}\nRejection reason: ${rejection_reason}`.trim() : referral.notes
        });

        const updatedReferral = await LabReferral.findByPk(id, {
            include: [
                { model: Institution, as: 'referringInstitution', attributes: ['id', 'name'] },
                { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name'] }
            ]
        });

        res.json({ success: true, data: updatedReferral, message: 'Referral rejected' });
    } catch (error) {
        console.error('Error rejecting referral:', error);
        res.status(500).json({ success: false, message: 'Failed to reject referral', error: error.message });
    }
};

// @desc    Update referral status (sample collected, processing, result ready, etc.)
// @route   PATCH /lab-referrals/:id/status
// @access  Authenticated
exports.updateReferralStatus = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    try {
        const { id } = req.params;
        const { institution_id } = req.user;
        const { status, notes } = req.body;

        const allowedTransitions = {
            'accepted': ['sample_collected', 'cancelled'],
            'sample_collected': ['processing', 'cancelled'],
            'processing': ['result_ready', 'cancelled'],
            'result_ready': ['result_received', 'completed'],
            'result_received': ['completed']
        };

        const referral = await LabReferral.findOne({
            where: { id, receiving_institution_id: institution_id }
        });

        if (!referral) {
            return res.status(404).json({ success: false, message: 'Referral not found' });
        }

        const currentStatus = referral.status;
        const allowed = allowedTransitions[currentStatus] || [];

        if (!allowed.includes(status)) {
            return res.status(400).json({ success: false, message: `Cannot transition from ${currentStatus} to ${status}` });
        }

        const updateData = { status };
        if (status === 'result_received') {
            updateData.result_received_at = new Date();
        }
        if (status === 'completed') {
            updateData.completed_at = new Date();
            updateData.result_received_at = new Date();
        }
        if (notes) {
            updateData.notes = `${referral.notes || ''}\n${notes}`.trim();
        }

        await referral.update(updateData);

        const updatedReferral = await LabReferral.findByPk(id, {
            include: [
                { model: Institution, as: 'referringInstitution', attributes: ['id', 'name'] },
                { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name'] }
            ]
        });

        res.json({ success: true, data: updatedReferral, message: `Referral status updated to ${status}` });
    } catch (error) {
        console.error('Error updating referral status:', error);
        res.status(500).json({ success: false, message: 'Failed to update referral status', error: error.message });
    }
};

// @desc    Submit results for a referral
// @route   POST /lab-referrals/:id/results
// @access  Authenticated
exports.submitReferralResults = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { institution_id } = req.user;
        const { results } = req.body;

        const referral = await LabReferral.findOne({
            where: { id, receiving_institution_id: institution_id }
        });

        if (!referral) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Referral not found' });
        }

        if (!results || !Array.isArray(results) || results.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Results array is required' });
        }

        const items = await LabReferralItem.findAll({
            where: { referral_id: id },
            transaction
        });

        if (items.length !== results.length) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Results count does not match referral items' });
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const resultData = results[i];

            const existingResult = await LabTestResult.findByPk(item.result_id, { transaction });
            if (existingResult) {
                await existingResult.update({
                    values: resultData.values || existingResult.values,
                    notes: resultData.notes || existingResult.notes,
                    status: 'completed',
                    verifiedBy: req.user.id
                }, { transaction });
            } else {
                const newResult = await LabTestResult.create({
                    visit_id: referral.visit_id,
                    patient_id: referral.patient_id,
                    institution_id: referral.receiving_institution_id,
                    department_id: referral.department_id,
                    templateId: item.template_id,
                    values: resultData.values || {},
                    notes: resultData.notes || null,
                    request_notes: item.request_notes,
                    status: 'completed',
                    createdBy: req.user.id,
                    referral_id: referral.id
                }, { transaction });

                await item.update({ result_id: newResult.id }, { transaction });
            }
        }

        await referral.update({ status: 'result_ready' }, { transaction });
        await transaction.commit();

        const notificationService = req.app.get('notificationService');

        if (notificationService) {
            const updatedReferralForNotify = await LabReferral.findByPk(id, {
                include: [
                    { model: Staff, as: 'requester', attributes: ['id', 'first_name', 'last_name'] },
                    { model: Institution, as: 'referringInstitution', attributes: ['id', 'name'] }
                ]
            });

            if (updatedReferralForNotify) {
                const requesterName = updatedReferralForNotify.requester
                    ? `${updatedReferralForNotify.requester.first_name} ${updatedReferralForNotify.requester.last_name}`
                    : 'A staff member';

                const referringDepartments = await Department.findAll({
                    where: { institution_id: updatedReferralForNotify.referring_institution_id, departmentType: 'Lab' }
                });

                if (referringDepartments.length > 0) {
                    const notification = await notificationService.createNotification({
                        title: 'Lab Referral Results Ready',
                        description: `Results for referral ${updatedReferralForNotify.referral_number} from ${requesterName} have been submitted by the receiving lab.`,
                        from_department_id: referral.department_id,
                        to_department_id: referringDepartments[0].id,
                        from_staff_id: req.user.id,
                        institution_id: updatedReferralForNotify.referring_institution_id,
                        priority: 'Medium',
                        type: 'Lab_Result'
                    });

                    for (const dept of referringDepartments) {
                        notificationService.io.to(`department-${dept.id}`).emit('new-department-notification', notification);
                    }
                }
            }
        }

        const updatedReferral = await LabReferral.findByPk(id, {
            include: [
                {
                    model: LabReferralItem,
                    as: 'items',
                    include: [{ model: LabTestTemplate, as: 'template' }]
                },
                {
                    model: LabTestResult,
                    as: 'results'
                }
            ]
        });

        res.json({ success: true, data: updatedReferral, message: 'Results submitted successfully' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error submitting referral results:', error);
        res.status(500).json({ success: false, message: 'Failed to submit results', error: error.message });
    }
};

// @desc    Mark referral as completed from referring institution
// @route   PATCH /lab-referrals/:id/complete
// @access  Authenticated
exports.completeReferral = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    try {
        const { id } = req.params;
        const { institution_id } = req.user;

        const referral = await LabReferral.findOne({
            where: { id, referring_institution_id: institution_id }
        });

        if (!referral) {
            return res.status(404).json({ success: false, message: 'Referral not found' });
        }

        if (referral.status !== 'result_received') {
            return res.status(400).json({ success: false, message: 'Referral must be in result_received status to complete' });
        }

        await referral.update({ status: 'completed', completed_at: new Date() });

        const updatedReferral = await LabReferral.findByPk(id, {
            include: [
                { model: Institution, as: 'receivingInstitution', attributes: ['id', 'name'] },
                { model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name'] }
            ]
        });

        res.json({ success: true, data: updatedReferral, message: 'Referral completed' });
    } catch (error) {
        console.error('Error completing referral:', error);
        res.status(500).json({ success: false, message: 'Failed to complete referral', error: error.message });
    }
};

// @desc    Cancel referral
// @route   PATCH /lab-referrals/:id/cancel
// @access  Authenticated
exports.cancelReferral = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    try {
        const { id } = req.params;
        const { institution_id } = req.user;
        const { reason } = req.body;

        const referral = await LabReferral.findOne({
            where: { id, referring_institution_id: institution_id }
        });

        if (!referral) {
            return res.status(404).json({ success: false, message: 'Referral not found' });
        }

        if (['completed', 'rejected', 'cancelled'].includes(referral.status)) {
            return res.status(400).json({ success: false, message: `Cannot cancel referral in ${referral.status} status` });
        }

        await referral.update({
            status: 'cancelled',
            notes: reason ? `${referral.notes || ''}\nCancellation reason: ${reason}`.trim() : referral.notes
        });

        res.json({ success: true, message: 'Referral cancelled' });
    } catch (error) {
        console.error('Error cancelling referral:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel referral', error: error.message });
    }
};
