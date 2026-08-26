const { Op } = require('sequelize');
const InstitutionLabReferenceRange = require('../../models/InstitutionLabReferenceRange');
const LabTestTemplate = require('../../models/lab/LabTestTemplate');
const AppError = require('../../utils/appError');

/**
 * Helper: extract institution_id from the authenticated request.
 * Follows the existing pattern used across the HMS.
 */
const getInstitutionId = (req) => {
  return req.admin?.institution_id || req.user?.institution_id || null;
};

/**
 * GET /lab/institution-ranges
 * List all institution-specific reference ranges for the current institution.
 */
exports.getInstitutionRanges = async (req, res, next) => {
  try {
    const institutionId = getInstitutionId(req);
    if (!institutionId) {
      return next(new AppError('Institution not found. Please log in again.', 401));
    }

    const { search, test_name, category, gender, template_id, page = 1, limit = 50 } = req.query;

    const where = { institution_id: institutionId };

    if (search) {
      where[Op.or] = [
        { test_name: { [Op.iLike]: `%${search}%` } },
        { reference_range: { [Op.iLike]: `%${search}%` } },
        { notes: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (test_name) where.test_name = { [Op.iLike]: `%${test_name}%` };
    if (category) where.category = category;
    if (gender) where.gender = gender;
    if (template_id) where.template_id = template_id;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await InstitutionLabReferenceRange.findAndCountAll({
      where,
      include: [
        { model: LabTestTemplate, as: 'template', attributes: ['id', 'name', 'description'] },
      ],
      order: [['test_name', 'ASC'], ['gender', 'ASC']],
      limit: parseInt(limit),
      offset,
    });

    res.status(200).json({
      status: 'success',
      results: rows.length,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
      data: { ranges: rows },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /lab/institution-ranges/:id
 * Get a single institution reference range by ID (with institution check).
 */
exports.getInstitutionRange = async (req, res, next) => {
  try {
    const institutionId = getInstitutionId(req);
    if (!institutionId) {
      return next(new AppError('Institution not found. Please log in again.', 401));
    }

    const range = await InstitutionLabReferenceRange.findOne({
      where: { id: req.params.id, institution_id: institutionId },
      include: [
        { model: LabTestTemplate, as: 'template', attributes: ['id', 'name', 'description'] },
      ],
    });

    if (!range) {
      return next(new AppError('Reference range not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { range },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /lab/institution-ranges
 * Create a new institution-specific reference range.
 */
exports.createInstitutionRange = async (req, res, next) => {
  try {
    const institutionId = getInstitutionId(req);
    if (!institutionId) {
      return next(new AppError('Institution not found. Please log in again.', 401));
    }

    const {
      template_id, test_name, gender, age_min, age_max,
      min_value, max_value, reference_range, unit,
      category, description, notes,
    } = req.body;

    if (!test_name || !reference_range) {
      return next(new AppError('test_name and reference_range are required', 400));
    }

    const range = await InstitutionLabReferenceRange.create({
      institution_id: institutionId,
      template_id: template_id || null,
      test_name,
      gender: gender || 'All',
      age_min: age_min != null ? parseFloat(age_min) : null,
      age_max: age_max != null ? parseFloat(age_max) : null,
      min_value: min_value != null ? parseFloat(min_value) : null,
      max_value: max_value != null ? parseFloat(max_value) : null,
      reference_range,
      unit: unit || null,
      category: category || null,
      description: description || null,
      notes: notes || null,
      created_by: req.admin?.id || req.user?.id || null,
    });

    res.status(201).json({
      status: 'success',
      data: { range },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /lab/institution-ranges/:id
 * Update an institution-specific reference range (with institution check).
 */
exports.updateInstitutionRange = async (req, res, next) => {
  try {
    const institutionId = getInstitutionId(req);
    if (!institutionId) {
      return next(new AppError('Institution not found. Please log in again.', 401));
    }

    const range = await InstitutionLabReferenceRange.findOne({
      where: { id: req.params.id, institution_id: institutionId },
    });

    if (!range) {
      return next(new AppError('Reference range not found', 404));
    }

    const {
      template_id, test_name, gender, age_min, age_max,
      min_value, max_value, reference_range, unit,
      category, description, notes,
    } = req.body;

    if (test_name !== undefined) range.test_name = test_name;
    if (reference_range !== undefined) range.reference_range = reference_range;
    if (template_id !== undefined) range.template_id = template_id || null;
    if (gender !== undefined) range.gender = gender;
    if (age_min !== undefined) range.age_min = age_min != null ? parseFloat(age_min) : null;
    if (age_max !== undefined) range.age_max = age_max != null ? parseFloat(age_max) : null;
    if (min_value !== undefined) range.min_value = min_value != null ? parseFloat(min_value) : null;
    if (max_value !== undefined) range.max_value = max_value != null ? parseFloat(max_value) : null;
    if (unit !== undefined) range.unit = unit || null;
    if (category !== undefined) range.category = category || null;
    if (description !== undefined) range.description = description || null;
    if (notes !== undefined) range.notes = notes || null;

    await range.save();

    res.status(200).json({
      status: 'success',
      data: { range },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /lab/institution-ranges/:id
 * Delete an institution-specific reference range (with institution check).
 */
exports.deleteInstitutionRange = async (req, res, next) => {
  try {
    const institutionId = getInstitutionId(req);
    if (!institutionId) {
      return next(new AppError('Institution not found. Please log in again.', 401));
    }

    const range = await InstitutionLabReferenceRange.findOne({
      where: { id: req.params.id, institution_id: institutionId },
    });

    if (!range) {
      return next(new AppError('Reference range not found', 404));
    }

    await range.destroy();

    res.status(204).json({
      status: 'success',
      message: 'Reference range deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /lab/institution-ranges/lookup/:testName
 * Look up the best-matching institution range for a given test name and patient context.
 * Used internally by the lab result system. Falls back to null if no match.
 * Query params: gender, age
 */
exports.lookupInstitutionRange = async (req, res, next) => {
  try {
    const institutionId = getInstitutionId(req);
    if (!institutionId) {
      return next(new AppError('Institution not found', 401));
    }

    const { testName } = req.params;
    const { gender, age } = req.query;

    const ranges = await InstitutionLabReferenceRange.findAll({
      where: {
        institution_id: institutionId,
        test_name: { [Op.iLike]: testName },
      },
    });

    if (!ranges.length) {
      return res.status(200).json({ status: 'success', data: { range: null } });
    }

    // Score each range to find best match
    let bestMatch = null;
    let bestScore = -1;

    for (const r of ranges) {
      let score = 0;

      // Gender match
      if (r.gender && r.gender !== 'All') {
        if (gender && r.gender.toLowerCase() === gender.toLowerCase()) {
          score += 10;
        } else {
          continue; // Gender-specific range doesn't match patient
        }
      } else {
        score += 1; // "All" gender gets minimal score
      }

      // Age match
      const patientAge = age != null ? parseFloat(age) : null;
      if (patientAge != null && r.age_min != null && r.age_max != null) {
        if (patientAge >= r.age_min && patientAge <= r.age_max) {
          score += 5;
        } else {
          continue; // Age range doesn't match
        }
      } else if (r.age_min == null && r.age_max == null) {
        score += 1; // No age restriction
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = r;
      }
    }

    res.status(200).json({
      status: 'success',
      data: { range: bestMatch },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /lab/ranges/batch-lookup
 * Batch lookup reference ranges for a set of test field labels under a template.
 * Returns institution-specific ranges (if any) with system defaults as fallback.
 * Body: { template_id: UUID, fieldLabels: string[] }
 * Returns: { ranges: { [fieldLabel]: { institutionRange, systemRange, effective } } }
 */
exports.batchLookupRanges = async (req, res, next) => {
  try {
    const institutionId = getInstitutionId(req);
    const { template_id, fieldLabels } = req.body;

    if (!template_id || !Array.isArray(fieldLabels)) {
      return next(new AppError('template_id and fieldLabels array are required', 400));
    }

    const LabRanges = require('../../models/lab/LabRanges');

    // Fetch institution-specific ranges for this template
    const institutionRanges = await InstitutionLabReferenceRange.findAll({
      where: {
        ...(institutionId ? { institution_id: institutionId } : {}),
        template_id,
      },
    });

    // Fetch system default ranges for this template
    const systemRanges = await LabRanges.findAll({
      where: { template_id },
    });

    // Build lookup maps keyed by lowercased test_name
    const instMap = {};
    institutionRanges.forEach(r => {
      instMap[r.test_name.toLowerCase()] = r;
    });

    const sysMap = {};
    systemRanges.forEach(r => {
      sysMap[r.test_name.toLowerCase()] = r;
    });

    // Build result for each requested field label
    const result = {};
    fieldLabels.forEach(label => {
      const key = label.toLowerCase();
      const institutionRange = instMap[key] || null;
      const systemRange = sysMap[key] || null;
      const effective = institutionRange || systemRange;

      result[label] = {
        institutionRange: institutionRange ? {
          id: institutionRange.id,
          test_name: institutionRange.test_name,
          reference_range: institutionRange.reference_range,
          min_value: institutionRange.min_value,
          max_value: institutionRange.max_value,
          unit: institutionRange.unit,
          gender: institutionRange.gender,
          age_min: institutionRange.age_min,
          age_max: institutionRange.age_max,
          notes: institutionRange.notes,
        } : null,
        systemRange: systemRange ? {
          id: systemRange.id,
          test_name: systemRange.test_name,
          reference_range: systemRange.reference_range,
          min_value: systemRange.min_value,
          max_value: systemRange.max_value,
          unit: systemRange.unit,
          category: systemRange.category,
          notes: systemRange.notes,
        } : null,
        effective: effective ? {
          reference_range: effective.reference_range,
          min_value: effective.min_value,
          max_value: effective.max_value,
          unit: effective.unit,
        } : null,
      };
    });

    res.status(200).json({
      status: 'success',
      data: { ranges: result },
    });
  } catch (error) {
    next(error);
  }
};
