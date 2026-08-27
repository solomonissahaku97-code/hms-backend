/**
 * Lab Controller — Core lab test operations
 *
 * Handles: templates, results, ranges, statistics, PDF generation, sharing.
 * This is a direct port from the monolith with corrected import paths.
 */

const { Op, fn, col, literal } = require('sequelize');
const db = require('../models');
const AppError = require('../utils/appError');

const { LabTestResult, LabTestTemplate, LabTestField, LabRanges,
  LabInvestigation, InstitutionLabTariff, InstitutionLabReferenceRange,
  LabResultShareToken, Staff, Patient, Visit, Department, Institution } = db;

// ─── Templates ─────────────────────────────────────────────────────

exports.createTemplate = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { lab_tarrif_id, name, description, fields, createdBy } = req.body;

    if (!lab_tarrif_id || !fields || !Array.isArray(fields) || fields.length === 0) {
      await transaction.rollback();
      return next(new AppError('Please provide a lab investigation and at least one field', 400));
    }

    const lab_tarrif = await LabInvestigation.findByPk(lab_tarrif_id, { transaction });
    if (!lab_tarrif) {
      await transaction.rollback();
      return next(new AppError('Lab investigation not found', 404));
    }

    const template = await LabTestTemplate.create({
      name: name || lab_tarrif.test_description,
      lab_tarrif_id,
      description: description || '',
      createdBy,
    }, { transaction });

    const createdFields = await LabTestField.bulkCreate(
      fields.map(f => ({ ...f, templateId: template.id })),
      { transaction }
    );

    await transaction.commit();
    res.status(201).json({ status: 'success', data: { template: { ...template.get(), fields: createdFields } } });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.getTemplates = async (req, res, next) => {
  try {
    const templates = await LabTestTemplate.findAll({
      where: { isActive: true },
      include: [
        { model: LabTestField, as: 'fields', attributes: ['id', 'label', 'fieldType', 'options', 'required', 'order'] },
        { model: LabInvestigation, as: 'lab_tarrif' },
      ],
      order: [['createdAt', 'DESC'], [{ model: LabTestField, as: 'fields' }, 'order', 'ASC']],
    });
    res.status(200).json({ status: 'success', results: templates.length, data: { templates } });
  } catch (error) { next(error); }
};

exports.updateTemplate = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, description, fields, lab_tarrif_id } = req.body;

    if (!fields || !Array.isArray(fields)) {
      await transaction.rollback();
      return next(new AppError('Please provide fields array', 400));
    }

    const template = await LabTestTemplate.findByPk(id, { transaction });
    if (!template) {
      await transaction.rollback();
      return next(new AppError('No template found with that ID', 404));
    }

    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (lab_tarrif_id) template.lab_tarrif_id = lab_tarrif_id;
    await template.save({ transaction });

    await LabTestField.destroy({ where: { templateId: id }, transaction });
    const createdFields = await LabTestField.bulkCreate(
      fields.map(f => ({ ...f, templateId: id })), { transaction }
    );

    await transaction.commit();
    res.status(200).json({ status: 'success', data: { template: { ...template.get(), fields: createdFields } } });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.deleteTemplate = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const template = await LabTestTemplate.findByPk(req.params.id, { transaction });
    if (!template) {
      await transaction.rollback();
      return next(new AppError('No template found with that ID', 404));
    }
    template.isActive = false;
    await template.save({ transaction });
    await transaction.commit();
    res.status(204).json({ status: 'success', message: 'Template deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// ─── Results ───────────────────────────────────────────────────────

exports.getResults = async (req, res, next) => {
  try {
    const data = await LabTestResult.findAll({
      include: [
        { model: LabTestTemplate, as: 'template', include: [{ model: LabTestField, as: 'fields' }, { model: LabInvestigation, as: 'lab_tarrif' }] },
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] },
        { model: Staff, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json(data);
  } catch (error) { next(error); }
};

exports.getResultsByVisitId = async (req, res, next) => {
  try {
    const results = await LabTestResult.findAll({
      where: { visit_id: req.params.visit_id },
      include: [
        { model: LabTestTemplate, as: 'template' },
        { model: Staff, as: 'creator' },
      ],
      order: [['createdAt', 'DESC']],
    });
    if (!results || results.length === 0) {
      return next(new AppError('No lab results found for this visit', 404));
    }
    res.status(200).json({ status: 'success', results: results.length, data: { results } });
  } catch (error) { next(error); }
};

exports.getPendingLabTests = async (req, res, next) => {
  try {
    const { institution_id } = req.query;
    if (!institution_id) {
      return res.status(400).json({ status: 'error', message: 'institution_id is required' });
    }

    const labDepartment = await Department.findOne({ where: { institution_id, departmentType: 'Lab' } });
    if (!labDepartment) {
      return res.status(200).json({ status: 'success', results: 0, data: { pendingTests: [] } });
    }

    const pendingTests = await LabTestResult.findAll({
      where: { department_id: labDepartment.id, status: 'pending' },
      include: [
        { model: LabTestTemplate, as: 'template', include: [{ model: LabTestField, as: 'fields' }, { model: LabInvestigation, as: 'lab_tarrif' }] },
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] },
        { model: Staff, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'ASC']],
    });
    res.status(200).json({ status: 'success', results: pendingTests.length, data: { pendingTests } });
  } catch (error) { next(error); }
};

exports.getRecentLabTests = async (req, res, next) => {
  try {
    const recentTests = await LabTestResult.findAll({
      where: { status: 'completed' },
      include: [
        { model: LabTestTemplate, as: 'template', include: [{ model: LabInvestigation, as: 'lab_tarrif' }] },
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] },
        { model: Staff, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
        { model: Staff, as: 'verifier', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 10,
    });
    res.status(200).json({ status: 'success', results: recentTests.length, data: { recentTests } });
  } catch (error) { next(error); }
};

exports.getRecentLabTestsByVisitId = async (req, res, next) => {
  try {
    const recentTests = await LabTestResult.findAll({
      where: { visit_id: req.params.visit_id },
      include: [
        { model: LabTestTemplate, as: 'template', include: [{ model: LabInvestigation, as: 'lab_tarrif' }] },
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] },
        { model: Staff, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
        { model: Staff, as: 'verifier', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 10,
    });
    if (!recentTests || recentTests.length === 0) {
      return next(new AppError('No recent lab tests found for this visit', 404));
    }
    res.status(200).json({ status: 'success', results: recentTests.length, data: { recentTests } });
  } catch (error) { next(error); }
};

// ─── Ranges ────────────────────────────────────────────────────────

exports.createLabRange = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { test_name, reference_range, unit, category, notes } = req.body;
    if (!test_name || !reference_range || !category) {
      await transaction.rollback();
      return next(new AppError('Please provide test name, reference range, and category', 400));
    }
    const labRange = await LabRanges.create({ test_name, reference_range, unit, category, notes }, { transaction });
    await transaction.commit();
    res.status(201).json({ status: 'success', data: { labRange } });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.getLabRanges = async (req, res, next) => {
  try {
    const labRanges = await LabRanges.findAll({ order: [['createdAt', 'DESC']] });
    res.status(200).json({ status: 'success', results: labRanges.length, data: { labRanges } });
  } catch (error) { next(error); }
};

exports.updateLabRange = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const labRange = await LabRanges.findByPk(req.params.id, { transaction });
    if (!labRange) {
      await transaction.rollback();
      return next(new AppError('No lab range found with that ID', 404));
    }
    const { test_name, reference_range, unit, category, notes } = req.body;
    Object.assign(labRange, { test_name, reference_range, unit, category, notes });
    await labRange.save({ transaction });
    await transaction.commit();
    res.status(200).json({ status: 'success', data: { labRange } });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.deleteLabRange = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const labRange = await LabRanges.findByPk(req.params.id, { transaction });
    if (!labRange) {
      await transaction.rollback();
      return next(new AppError('No lab range found with that ID', 404));
    }
    await labRange.destroy({ transaction });
    await transaction.commit();
    res.status(204).json({ status: 'success', message: 'Lab range deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// ─── Statistics ────────────────────────────────────────────────────

exports.getLabStatistics = async (req, res, next) => {
  try {
    const totalTests = await LabTestResult.count();
    const completedTests = await LabTestResult.count({ where: { status: 'completed' } });
    const pendingTests = await LabTestResult.count({ where: { status: 'pending' } });
    const totalTemplates = await LabTestTemplate.count();

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayCompleted = await LabTestResult.count({
      where: { status: 'completed', createdAt: { [Op.between]: [startOfDay, endOfDay] } },
    });
    const todayPending = await LabTestResult.count({
      where: { status: 'pending', createdAt: { [Op.between]: [startOfDay, endOfDay] } },
    });

    res.status(200).json({
      status: 'success',
      data: { totalTests, completedTests, pendingTests, totalTemplates, todayCompleted, todayPending },
    });
  } catch (error) { next(error); }
};

exports.getLabTestStats = async (req, res, next) => {
  try {
    const { department_id, start_date, end_date } = req.query;
    let where = {};
    if (department_id) where.department_id = department_id;
    if (start_date && end_date) {
      where.createdAt = { [Op.between]: [start_date, end_date] };
    }

    const total = await LabTestResult.count({ where });
    const byStatus = await LabTestResult.findAll({
      where, attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'],
    });
    const byDepartment = await LabTestResult.findAll({
      where, attributes: ['department_id', [fn('COUNT', col('id')), 'count']],
      include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
      group: ['department_id', 'department.id', 'department.name'],
    });

    res.json({ success: true, data: { total, byStatus, byDepartment } });
  } catch (error) { next(error); }
};

// ─── Lab Investigations (Tariffs) ──────────────────────────────────

exports.createInvestigation = async (req, res, next) => {
  try {
    const { test_description, g_drg_code, tariff_ghc, market_price } = req.body;
    if (!test_description || !g_drg_code || tariff_ghc === undefined) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const existing = await LabInvestigation.findOne({ where: { g_drg_code } });
    if (existing) {
      return res.status(409).json({ error: `G-DRG code "${g_drg_code}" already exists` });
    }
    const investigation = await LabInvestigation.create({ test_description, g_drg_code, tariff_ghc, market_price });
    res.status(201).json(investigation);
  } catch (error) { next(error); }
};

exports.getInvestigations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    const where = {};
    if (search) {
      where[Op.or] = [
        { test_description: { [Op.iLike]: `%${search}%` } },
        { g_drg_code: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const { count, rows } = await LabInvestigation.findAndCountAll({
      where, limit: parseInt(limit), offset: parseInt(offset), order: [['test_description', 'ASC']],
    });
    res.json({ totalItems: count, totalPages: Math.ceil(count / limit), currentPage: parseInt(page), investigations: rows });
  } catch (error) { next(error); }
};

exports.getInvestigation = async (req, res, next) => {
  try {
    const investigation = await LabInvestigation.findByPk(req.params.id);
    if (!investigation) return res.status(404).json({ error: 'Not found' });
    res.json(investigation);
  } catch (error) { next(error); }
};

exports.updateInvestigation = async (req, res, next) => {
  try {
    const investigation = await LabInvestigation.findByPk(req.params.id);
    if (!investigation) return res.status(404).json({ error: 'Not found' });
    const { test_description, g_drg_code, tariff_ghc, market_price } = req.body;
    if (test_description) investigation.test_description = test_description;
    if (g_drg_code) investigation.g_drg_code = g_drg_code;
    if (tariff_ghc !== undefined) investigation.tariff_ghc = tariff_ghc;
    if (market_price !== undefined) investigation.market_price = market_price;
    await investigation.save();
    res.json(investigation);
  } catch (error) { next(error); }
};

exports.deleteInvestigation = async (req, res, next) => {
  try {
    const investigation = await LabInvestigation.findByPk(req.params.id);
    if (!investigation) return res.status(404).json({ error: 'Not found' });
    await investigation.destroy();
    res.status(204).send();
  } catch (error) { next(error); }
};

exports.searchInvestigations = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Search query is required' });
    const investigations = await LabInvestigation.findAll({
      where: { [Op.or]: [
        { test_description: { [Op.iLike]: `%${query}%` } },
        { g_drg_code: { [Op.iLike]: `%${query}%` } },
      ] },
      limit: 50,
    });
    res.json(investigations);
  } catch (error) { next(error); }
};

// ─── Institution Reference Ranges ──────────────────────────────────

exports.getInstitutionRanges = async (req, res, next) => {
  try {
    const institutionId = req.admin?.institution_id || req.user?.institution_id;
    if (!institutionId) return next(new AppError('Institution not found', 401));

    const { search, test_name, category, page = 1, limit = 50 } = req.query;
    const where = { institution_id: institutionId };
    if (search) {
      where[Op.or] = [
        { test_name: { [Op.iLike]: `%${search}%` } },
        { reference_range: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (test_name) where.test_name = { [Op.iLike]: `%${test_name}%` };
    if (category) where.category = category;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await InstitutionLabReferenceRange.findAndCountAll({
      where,
      include: [{ model: LabTestTemplate, as: 'template', attributes: ['id', 'name'] }],
      order: [['test_name', 'ASC']],
      limit: parseInt(limit), offset,
    });
    res.status(200).json({
      status: 'success', results: rows.length,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / parseInt(limit)) },
      data: { ranges: rows },
    });
  } catch (error) { next(error); }
};

exports.createInstitutionRange = async (req, res, next) => {
  try {
    const institutionId = req.admin?.institution_id || req.user?.institution_id;
    if (!institutionId) return next(new AppError('Institution not found', 401));

    const { template_id, test_name, gender, age_min, age_max, min_value, max_value, reference_range, unit, category, description, notes } = req.body;
    if (!test_name || !reference_range) {
      return next(new AppError('test_name and reference_range are required', 400));
    }

    const range = await InstitutionLabReferenceRange.create({
      institution_id: institutionId, template_id, test_name, gender: gender || 'All',
      age_min, age_max, min_value, max_value, reference_range, unit, category, description, notes,
      created_by: req.admin?.id || req.user?.id,
    });
    res.status(201).json({ status: 'success', data: { range } });
  } catch (error) { next(error); }
};

exports.updateInstitutionRange = async (req, res, next) => {
  try {
    const institutionId = req.admin?.institution_id || req.user?.institution_id;
    const range = await InstitutionLabReferenceRange.findOne({
      where: { id: req.params.id, institution_id: institutionId },
    });
    if (!range) return next(new AppError('Not found', 404));

    const fields = ['template_id', 'test_name', 'gender', 'age_min', 'age_max', 'min_value', 'max_value', 'reference_range', 'unit', 'category', 'description', 'notes'];
    fields.forEach(f => { if (req.body[f] !== undefined) range[f] = req.body[f]; });
    await range.save();
    res.status(200).json({ status: 'success', data: { range } });
  } catch (error) { next(error); }
};

exports.deleteInstitutionRange = async (req, res, next) => {
  try {
    const institutionId = req.admin?.institution_id || req.user?.institution_id;
    const range = await InstitutionLabReferenceRange.findOne({
      where: { id: req.params.id, institution_id: institutionId },
    });
    if (!range) return next(new AppError('Not found', 404));
    await range.destroy();
    res.status(204).json({ status: 'success', message: 'Deleted successfully' });
  } catch (error) { next(error); }
};

exports.lookupInstitutionRange = async (req, res, next) => {
  try {
    const institutionId = req.admin?.institution_id || req.user?.institution_id;
    const { testName } = req.params;
    const { gender, age } = req.query;

    const ranges = await InstitutionLabReferenceRange.findAll({
      where: { institution_id: institutionId, test_name: { [Op.iLike]: testName } },
    });
    if (!ranges.length) return res.status(200).json({ status: 'success', data: { range: null } });

    let bestMatch = null, bestScore = -1;
    for (const r of ranges) {
      let score = 0;
      if (r.gender && r.gender !== 'All') {
        if (gender && r.gender.toLowerCase() === gender.toLowerCase()) score += 10;
        else continue;
      } else { score += 1; }

      const patientAge = age != null ? parseFloat(age) : null;
      if (patientAge != null && r.age_min != null && r.age_max != null) {
        if (patientAge >= r.age_min && patientAge <= r.age_max) score += 5;
        else continue;
      } else { score += 1; }

      if (score > bestScore) { bestScore = score; bestMatch = r; }
    }
    res.status(200).json({ status: 'success', data: { range: bestMatch } });
  } catch (error) { next(error); }
};

exports.batchLookupRanges = async (req, res, next) => {
  try {
    const institutionId = req.admin?.institution_id || req.user?.institution_id;
    const { template_id, fieldLabels } = req.body;
    if (!template_id || !Array.isArray(fieldLabels)) {
      return next(new AppError('template_id and fieldLabels array are required', 400));
    }

    const institutionRanges = await InstitutionLabReferenceRange.findAll({
      where: { ...(institutionId ? { institution_id: institutionId } : {}), template_id },
    });
    const systemRanges = await LabRanges.findAll({ where: { template_id } });

    const instMap = {}, sysMap = {};
    institutionRanges.forEach(r => { instMap[r.test_name.toLowerCase()] = r; });
    systemRanges.forEach(r => { sysMap[r.test_name.toLowerCase()] = r; });

    const result = {};
    fieldLabels.forEach(label => {
      const key = label.toLowerCase();
      const institutionRange = instMap[key] || null;
      const systemRange = sysMap[key] || null;
      const effective = institutionRange || systemRange;
      result[label] = {
        institutionRange: institutionRange ? { id: institutionRange.id, test_name: institutionRange.test_name, reference_range: institutionRange.reference_range, min_value: institutionRange.min_value, max_value: institutionRange.max_value, unit: institutionRange.unit } : null,
        systemRange: systemRange ? { id: systemRange.id, test_name: systemRange.test_name, reference_range: systemRange.reference_range, min_value: systemRange.min_value, max_value: systemRange.max_value, unit: systemRange.unit } : null,
        effective: effective ? { reference_range: effective.reference_range, min_value: effective.min_value, max_value: effective.max_value, unit: effective.unit } : null,
      };
    });
    res.status(200).json({ status: 'success', data: { ranges: result } });
  } catch (error) { next(error); }
};

// ─── Patient Labs ──────────────────────────────────────────────────

exports.getPatientLabs = async (req, res, next) => {
  try {
    const { patient_id, status } = req.query;
    if (!patient_id) return next(new AppError('patient_id is required', 400));

    const visits = await Visit.findAll({
      where: { patient_id },
      attributes: ['id', 'patient_id', 'institution_id', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });
    if (!visits || visits.length === 0) {
      return res.status(200).json({ status: 'success', results: 0, data: { visits: [] } });
    }

    const visitIds = visits.map(v => v.id);
    const where = { visit_id: { [Op.in]: visitIds } };
    if (status) where.status = status;

    const labResults = await LabTestResult.findAll({
      where,
      include: [
        { model: LabTestTemplate, as: 'template', include: [{ model: LabTestField, as: 'fields' }, { model: LabInvestigation, as: 'lab_tarrif' }] },
        { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] },
        { model: Staff, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
        { model: Staff, as: 'verifier', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const grouped = new Map();
    visitIds.forEach(vId => grouped.set(vId, []));
    labResults.forEach(r => {
      const arr = grouped.get(r.visit_id) || [];
      arr.push(r);
      grouped.set(r.visit_id, arr);
    });

    const dataVisits = visits.map(v => ({ visit: v, labResults: grouped.get(v.id) || [] }));
    return res.status(200).json({ status: 'success', results: labResults.length, data: { visits: dataVisits } });
  } catch (error) { next(error); }
};

// ─── Lab Result Sharing ────────────────────────────────────────────

const crypto = require('crypto');
const { sendSMS } = require('../utils/smsHelper');

function generateSecureToken() { return crypto.randomBytes(32).toString('hex'); }
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

exports.generateShareLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const institutionId = req.admin?.institution_id || req.user?.institution_id;
    const staffUserId = req.user?.id || req.admin?.id;

    const labResult = await LabTestResult.findByPk(id, {
      include: [{ model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }] }],
    });
    if (!labResult) return res.status(404).json({ success: false, message: 'Lab result not found' });
    if (labResult.institution_id !== institutionId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await LabResultShareToken.create({
      lab_result_id: id, institution_id: institutionId,
      token_hash: tokenHash, token_prefix: rawToken.substring(0, 8),
      expires_at: expiresAt, created_by: staffUserId,
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const shareUrl = `${frontendUrl}/lab-results/view/${rawToken}`;

    res.status(200).json({ success: true, data: { shareUrl, expiresAt } });
  } catch (error) { next(error); }
};

exports.viewLabResultByToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);

    const shareToken = await LabResultShareToken.findOne({
      where: { token_hash: tokenHash },
      include: [
        { model: LabTestResult, as: 'labResult', include: [
          { model: LabTestTemplate, as: 'template', include: [{ model: LabTestField, as: 'fields' }, { model: LabInvestigation, as: 'lab_tarrif' }] },
          { model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }, { model: Institution, as: 'institution' }] },
          { model: Staff, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
          { model: Staff, as: 'verifier', attributes: ['id', 'firstName', 'lastName'] },
        ]},
        { model: Institution, as: 'institution' },
      ],
    });

    if (!shareToken) return res.status(404).json({ success: false, message: 'Invalid link' });
    if (shareToken.revoked_at) return res.status(404).json({ success: false, message: 'Link revoked' });
    if (new Date(shareToken.expires_at) < new Date()) return res.status(404).json({ success: false, message: 'Link expired' });

    shareToken.last_accessed_at = new Date();
    shareToken.access_count = (shareToken.access_count || 0) + 1;
    await shareToken.save();

    res.status(200).json({
      success: true,
      data: {
        labResult: shareToken.labResult,
        institution: shareToken.institution,
        tokenExpiresAt: shareToken.expires_at,
      },
    });
  } catch (error) { next(error); }
};

exports.sendLabResultSMS = async (req, res, next) => {
  try {
    const { id } = req.params;
    const institutionId = req.admin?.institution_id || req.user?.institution_id;
    const { phone_number } = req.body;

    const labResult = await LabTestResult.findByPk(id, {
      include: [{ model: Visit, as: 'visit', include: [{ model: Patient, as: 'patient' }, { model: Institution, as: 'institution' }] }],
    });
    if (!labResult) return res.status(404).json({ success: false, message: 'Not found' });
    if (labResult.institution_id !== institutionId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const patient = labResult.visit?.patient;
    const phone = phone_number || patient?.phone;
    if (!phone) return res.status(400).json({ success: false, message: 'No phone number' });

    // Generate share token
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await LabResultShareToken.create({
      lab_result_id: id, institution_id: institutionId,
      token_hash: tokenHash, token_prefix: rawToken.substring(0, 8),
      expires_at: expiresAt, created_by: req.user?.id || req.admin?.id,
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const shareUrl = `${frontendUrl}/lab-results/view/${rawToken}`;
    const institutionName = labResult.visit?.institution?.name || 'Your Hospital';
    const patientName = patient?.first_name || 'Patient';
    const message = `Dear ${patientName}, your laboratory results from ${institutionName} are ready. View here: ${shareUrl}`;

    await sendSMS(phone, message);

    res.status(200).json({ success: true, data: { phone, shareUrl, expiresAt } });
  } catch (error) { next(error); }
};
