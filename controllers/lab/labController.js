// controllers/labController.js
const { sequelize } = require('../../models'); // Import sequelize instance
const LabTestField = require('../../models/lab/LabTestField');
const LabTestTemplate = require('../../models/lab/LabTestTemplate');
const LabTestResults = require('../../models/lab/LabTestResult');
const Visit = require('../../models/Visit');
const AppError = require('../../utils/appError');
const LabTestResult = require('../../models/lab/LabTestResult');
const Staff = require('../../models/staff');
const Patient = require('../../models/patient');
const LabRanges = require('../../models/lab/LabRanges');
const { Op, fn, col, literal } = require("sequelize");
const LabInvestigation = require('../../models/claims/LabInvestigations');
const Claim = require('../../models/claims/claim');
const { handleBilling } = require('../../utils/billingUtil');
const Department = require('../../models/department');
const systemDiagnosis = require('../../models/claims/systemDiagnosis');
const Diagnosis = require('../../models/diagnosis');
const ServiceBill = require('../../models/serviceBill');
const ClaimItem = require('../../models/claims/claimItem');
const { addClaimItem } = require('../../service/claimService');
const Notification = require('../../models/notification'); 
const InstitutionLabTariff = require('../../models/InstitutionLabTariff');
const StaffDepartment = require('../../models/controls/StaffDepartment');
const { sendPushEngageNotification, sendPushEngageDepartmentNotification } = require('../../service/pushEngageService');
const labResultShareService = require('../../service/labResultShareService');
const InstitutionLabReferenceRange = require('../../models/InstitutionLabReferenceRange');

// Helper function to notify lab staff
// Finds staff whose PRIMARY department is Lab via the staff_departments junction table
async function notifyLabStaff(labResult, template, visit, req) {
    try {
        // Find the Lab department for the current institution
        const labDepartment = await Department.findOne({
            where: {
                institution_id: visit.institution_id,
                departmentType: 'Lab',
            },
        });

        if (!labDepartment) {
            console.log(
                `❌ No Lab department found for institution ${visit.institution_id}`
            );
            return;
        }

        console.log(
            `✅ Lab Department Found: ${labDepartment.name} (${labDepartment.id})`
        );

        // Find staff whose primary department is Lab via staff_departments junction table
        let labStaffDepartmentRecords = await StaffDepartment.findAll({
            where: {
                department_id: labDepartment.id,
                primary_department: true,
            },
            attributes: ['staff_id'],
            raw: true,
        });

        let labStaffIds = labStaffDepartmentRecords.map(record => record.staff_id);

        console.log(
            `👨‍⚕️ Found ${labStaffIds.length} staff member(s) with Lab as primary department.`
        );

        // FALLBACK: If no staff have Lab as primary department, find ANY staff assigned to the Lab department
        if (labStaffIds.length === 0) {
            console.log(
                `⚠️  No staff with primary_department=true for Lab. Falling back to all staff in Lab department.`
            );

            const fallbackRecords = await StaffDepartment.findAll({
                where: {
                    department_id: labDepartment.id,
                },
                attributes: ['staff_id'],
                raw: true,
            });

            labStaffIds = fallbackRecords.map(record => record.staff_id);
            console.log(
                `👨‍⚕️ Fallback: Found ${labStaffIds.length} staff member(s) in Lab department.`
            );
        }

        // FALLBACK 2: If still no staff, find staff whose department_id on the staffs table matches Lab
        if (labStaffIds.length === 0) {
            console.log(
                `⚠️  No staff in staff_departments for Lab. Falling back to staff.department_id = Lab.`
            );

            const deptFallbackStaff = await Staff.findAll({
                where: {
                    institution_id: visit.institution_id,
                    department_id: labDepartment.id,
                },
                attributes: ['id'],
                raw: true,
            });

            labStaffIds = deptFallbackStaff.map(record => record.id);
            console.log(
                `👨‍⚕️ Dept fallback: Found ${labStaffIds.length} staff member(s) with department_id = Lab.`
            );
        }

        // FALLBACK 3: If STILL no staff, notify ALL staff in the institution (last resort)
        if (labStaffIds.length === 0) {
            console.log(
                `⚠️  No staff found via any fallback. Notifying ALL staff in institution ${visit.institution_id}.`
            );

            const allInstitutionStaff = await Staff.findAll({
                where: {
                    institution_id: visit.institution_id,
                },
                attributes: ['id'],
                raw: true,
            });

            labStaffIds = allInstitutionStaff.map(record => record.id);
            console.log(
                `👨‍⚕️ Final fallback: Found ${labStaffIds.length} total staff in institution.`
            );
        }

        if (labStaffIds.length === 0) {
            console.log(
                `❌ No staff found at all for institution ${visit.institution_id}. Cannot send notifications.`
            );
            return;
        }

        // Fetch full Staff records for the identified staff IDs
        const labStaff = await Staff.findAll({
            where: {
                id: { [Op.in]: labStaffIds },
            },
        });

        // Get patient details
        const patient = await Patient.findByPk(visit.patient_id);

        // Validate from_staff_id: only set if the user is actually a staff member
        let fromStaffId = null;
        if (req.body.user) {
            const fromStaff = await Staff.findByPk(req.body.user, { attributes: ['id'], transaction: null });
            if (fromStaff) {
                fromStaffId = req.body.user;
            }
        }

        // Send notification to every lab staff
        for (const staff of labStaff) {
            const notification = await Notification.create({
                title: 'New Lab Request',
                description: `New lab test requested: ${
                    template?.lab_tarrif?.test_description || 'Lab Test'
                }. Patient: ${patient?.firstName || ''} ${patient?.lastName || ''}`,
                from_staff_id: fromStaffId,
                to_staff_id: staff.id,
                institution_id: visit.institution_id,
                to_department_id: labDepartment.id,
                type: 'Alert',
                priority: 'Medium',
            });

            try {
                const notificationService =
                    req.app.get('notificationService');

                if (notificationService) {
                    notificationService.emitNotification(notification);
                }
            } catch (err) {
                console.error(
                    'Error emitting real-time notification:',
                    err
                );
            }
        }

        console.log(
            `📣 Notifications sent successfully to ${labStaff.length} lab staff member(s).`
        );
    } catch (error) {
        console.error('Error sending lab staff notifications:', error);
    }
}
// Create a new template
exports.createTemplate = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      lab_tarrif_id,
      labInvestigationId,
      name,
      description,
      fields,
      createdBy,
    } = req.body;

    const tarrifId = lab_tarrif_id || labInvestigationId;

    // Validate input
    if (!tarrifId || !fields || !Array.isArray(fields) || fields.length === 0) {
      await transaction.rollback();
      return next(new AppError('Please provide a lab investigation (kit) and at least one field', 400));
    }

    const lab_tarrif = await LabInvestigation.findByPk(tarrifId, { transaction });
    if (!lab_tarrif) {
      await transaction.rollback();
      return next(new AppError('Lab investigation (kit) not found', 404));
    }

    const template = await LabTestTemplate.create({
      name: name || lab_tarrif.test_description,
      lab_tarrif_id: tarrifId,
      description: description || '',
      createdBy
    }, { transaction });

    // Create fields
    const createdFields = await LabTestField.bulkCreate(
      fields.map(field => ({
        ...field,
        templateId: template.id
      })),
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      status: 'success',
      data: {
        template: {
          ...template.get(),
          fields: createdFields
        }
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.log(error);
    next(error);
  }
};

// Get all templates
exports.getTemplates = async (req, res, next) => {
  try {
    const templates = await LabTestTemplate.findAll({
      where: { isActive: true },
      include: [{
        model: LabTestField,
        as: 'fields',
        attributes: ['id', 'label', 'fieldType', 'options', 'required', 'order']
      },
      {
        model: LabInvestigation,
        as: 'lab_tarrif'
      }
      ],
      order: [
        ['createdAt', 'DESC'],
        [{ model: LabTestField, as: 'fields' }, 'order', 'ASC']
      ]
    });

    res.status(200).json({
      status: 'success',
      results: templates.length,
      data: { templates }
    });
  } catch (error) {
    next(error);
  }
};

// Helper: create one lab result + billing
async function createSingleLabResult({ transaction, templateId, visit_id, user, request_notes, department_id, notify = true }) {
    const template = await LabTestTemplate.findByPk(templateId, {
        include: [{
            model: LabTestField,
            as: 'fields',
        }, {
            model: LabInvestigation,
            as: 'lab_tarrif'
        }],
        transaction
    });

    if (!template) {
        throw new AppError(`No template found with that ID: ${templateId}`, 404);
    }

    const visit = await Visit.findByPk(visit_id, { transaction });
    if (!visit) {
        throw new AppError('No visit found with that ID', 404);
    }

    const labDepartment = await Department.findOne({
        where: {
            institution_id: visit.institution_id,
            departmentType: 'Lab'
        },
        transaction
    });

    // Validate createdBy: only set if user exists in staffs table (admins are not staff)
    let createdByUserId = null;
    if (user) {
        const staffUser = await Staff.findByPk(user, { attributes: ['id'], transaction });
        if (staffUser) {
            createdByUserId = user;
        }
    }

    const resultData = {
        templateId,
        visit_id,
        patient_id: visit.patient_id,
        institution_id: visit.institution_id,
        department_id: labDepartment ? labDepartment.id : (department_id || visit.department_id || null),
        notes: request_notes || null,
        request_notes: request_notes || null,
        createdBy: createdByUserId,
        status: 'pending'
    };

    const result = await LabTestResults.create(resultData, { transaction });

    const tariff = template.lab_tarrif || {};
    const institutionOverride = await InstitutionLabTariff.findOne({
        where: {
            institution_id: visit.institution_id,
            lab_investigation_id: tariff.id,
            is_active: true
        }
    });

    const marketPrice = institutionOverride ? parseFloat(institutionOverride.market_price || 0) : parseFloat(tariff.market_price || 0);
    const tariffGhc = institutionOverride ? parseFloat(institutionOverride.tariff_ghc || 0) : parseFloat(tariff.tariff_ghc || 0);

    const existingBill = await ServiceBill.findOne({
        where: { service_id: result.id, service_type: 'LabTest' },
        transaction
    });

    if (!existingBill) {
        await handleBilling({
            transaction,
            patient_id: visit.patient_id,
            visit_id,
            service_id: result.id,
            service_type: 'LabTest',
            description: tariff.test_description || 'Lab Test',
            unit_price: marketPrice,
            nhia_unit_price: tariffGhc,
            quantity: template.quantity || 1,
            department_id: result.department_id || visit.department_id,
            institution_id: visit.institution_id,
            claim_id: null,
            gdrg_code: tariff.g_drg_code
        });
    }

    return { result, visit, template, tariff };
}

// Create test result (supports single object OR array for batch requests)
exports.createResult = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const body = req.body;
    const isBatch = Array.isArray(body);

    if (!isBatch) {
        const { templateId, visit_id, note, request_notes, user, department_id } = body;
        if (!templateId || !visit_id || !user) {
            await transaction.rollback();
            return next(new AppError('templateId, visit_id, and user are required fields', 400));
        }

        const { result, visit, template } = await createSingleLabResult({
            transaction,
            templateId,
            visit_id,
            user,
            request_notes: note || request_notes,
            department_id
        });

        await transaction.commit();

        // Notify lab staff (fire and forget)
        const visitForNotify = await Visit.findByPk(visit_id);
        const templateForNotify = await LabTestTemplate.findByPk(templateId, {
            include: [{ model: LabInvestigation, as: 'lab_tarrif' }]
        });
        notifyLabStaff(result, templateForNotify, visitForNotify, req).catch(err =>
            console.error('Error notifying lab staff:', err)
        );

        Patient.findByPk(visitForNotify.patient_id).then(async patient => {
            try {
                const labDepartment = await Department.findOne({
                    where: { institution_id: visitForNotify.institution_id, departmentType: 'Lab' }
                });
                const payload = {
                    title: 'New Lab Request',
                    message: `New lab test requested: ${templateForNotify?.lab_tarrif?.test_description || 'Lab Test'}. Patient: ${patient ? `${patient.first_name || ''} ${patient.last_name || ''}` : 'Unknown'}`,
                    url: `${process.env.FRONTEND_URL || ''}/lab`
                };
                if (labDepartment) {
                    await sendPushEngageDepartmentNotification({ departmentId: labDepartment.id, ...payload });
                } else {
                    await sendPushEngageNotification({ ...payload, tag: 'lab-request' });
                }
            } catch (err) {
                console.error('Error sending PushEngage notification:', err);
            }
        }).catch(err => console.error('Error fetching patient for PushEngage notification:', err));

        return res.status(201).json({
            status: 'success',
            data: {
                result,
                message: 'Test result created successfully'
            }
        });
    }

    // BATCH MODE
    if (!body.length) {
        await transaction.rollback();
        return next(new AppError('tests array is empty', 400));
    }

    const visit_id = body[0]?.visit_id;
    const user = body[0]?.user;

    if (!visit_id || !user) {
        await transaction.rollback();
        return next(new AppError('visit_id and user are required for batch requests', 400));
    }

    const createdResults = [];
    const notifications = [];

    for (const item of body) {
        const { templateId, request_notes, department_id } = item;
        if (!templateId) {
            await transaction.rollback();
            return next(new AppError('templateId is required for each test in batch', 400));
        }

        try {
            const { result, visit, template } = await createSingleLabResult({
                transaction,
                templateId,
                visit_id,
                user,
                request_notes: request_notes || '',
                department_id,
                notify: false
            });
            createdResults.push(result);
            notifications.push({ result, visit, template });
        } catch (err) {
            await transaction.rollback();
            return next(err);
        }
    }

    await transaction.commit();

    // Fire notifications after commit (non-blocking)
    for (const note of notifications) {
        const visitForNotify = await Visit.findByPk(note.visit.id);
        const templateForNotify = await LabTestTemplate.findByPk(note.template.id, {
            include: [{ model: LabInvestigation, as: 'lab_tarrif' }]
        });
        notifyLabStaff(note.result, templateForNotify, visitForNotify, req).catch(err =>
            console.error('Error notifying lab staff:', err)
        );

        Patient.findByPk(visitForNotify.patient_id).then(async patient => {
            try {
                const labDepartment = await Department.findOne({
                    where: { institution_id: visitForNotify.institution_id, departmentType: 'Lab' }
                });
                const payload = {
                    title: 'New Lab Request',
                    message: `New lab test requested: ${templateForNotify?.lab_tarrif?.test_description || 'Lab Test'}. Patient: ${patient ? `${patient.first_name || ''} ${patient.last_name || ''}` : 'Unknown'}`,
                    url: `${process.env.FRONTEND_URL || ''}/lab`
                };
                if (labDepartment) {
                    await sendPushEngageDepartmentNotification({ departmentId: labDepartment.id, ...payload });
                } else {
                    await sendPushEngageNotification({ ...payload, tag: 'lab-request' });
                }
            } catch (err) {
                console.error('Error sending PushEngage notification:', err);
            }
        }).catch(err => console.error('Error fetching patient for PushEngage notification:', err));
    }

    return res.status(201).json({
        status: 'success',
        data: {
            results: createdResults,
            message: `${createdResults.length} lab test(s) requested successfully`
        }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating test result(s):', error);
    const errorResponse = {
      status: 'error',
      message: 'Failed to create test result(s)',
      details: {
        error: error.message,
        modelError: error.errors ? error.errors.map(e => e.message) : null,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    };
    res.status(500).json(errorResponse);
  }
};

// Get results with filtering
exports.getResults = async (req, res,next) => {
  try {
    const data = await LabTestResult.findAll({
      include: [
        {
          model: LabTestTemplate,
          as: 'template',
          include: [
            {
              model: LabTestField,
              as: 'fields',
            },
            {
              model: LabInvestigation,
              as: 'lab_tarrif'
            }
          ]
        },
        {
          model: Visit,
          as: 'visit',
          include: [
            {
              model: Patient,
              as: 'patient',
            },
            {
              model: Claim,
              as: 'claims',
            },
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
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(data);
  } catch (error) {
    console.log(error)
    next(error);
  }
};

exports.getPendingLabTests = async (req, res, next) => {
  try {
    const { institution_id } = req.query;

    if (!institution_id) {
      return res.status(400).json({
        status: 'error',
        message: 'institution_id is required'
      });
    }

    const labDepartment = await Department.findOne({
      where: {
        institution_id,
        departmentType: 'Lab'
      }
    });

    if (!labDepartment) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: { pendingTests: [] }
      });
    }

    const pendingTests = await LabTestResult.findAll({
      where: {
        department_id: labDepartment.id,
        status: 'pending'
      },
      include: [
        {
          model: LabTestTemplate,
          as: 'template',
          include: [
            { model: LabTestField, as: 'fields' },
            { model: LabInvestigation, as: 'lab_tarrif' }
          ]
        },
        {
          model: Visit,
          as: 'visit',
          include: [
            { model: Patient, as: 'patient' },
            { model: Claim, as: 'claims' }
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

    res.status(200).json({
      status: 'success',
      results: pendingTests.length,
      data: { pendingTests }
    });
  } catch (error) {
    console.error('Error fetching pending lab tests:', error);
    next(error);
  }
};

// Update a template
exports.updateTemplate = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, description, fields, lab_tarrif_id } = req.body;

    // Validate input
    if (!fields || !Array.isArray(fields)) {
      await transaction.rollback();
      return next(new AppError('Please provide fields array', 400));
    }

    const template = await LabTestTemplate.findByPk(id, { transaction });
    if (!template) {
      await transaction.rollback();
      return next(new AppError('No template found with that ID', 404));
    }

    // Update template
    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (lab_tarrif_id) template.lab_tarrif_id = lab_tarrif_id;
    await template.save({ transaction });

    // Update fieldshandleBilling
    await LabTestField.destroy({
      where: { templateId: id },
      transaction
    });

    const createdFields = await LabTestField.bulkCreate(
      fields.map(field => ({
        ...field,
        templateId: id
      })),
      { transaction }
    );

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      data: {
        template: {
          ...template.get(),
          fields: createdFields
        }
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

// Delete a template
exports.deleteTemplate = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const template = await LabTestTemplate.findByPk(id, { transaction });

    if (!template) {
      await transaction.rollback();
      return next(new AppError('No template found with that ID', 404));
    }

    // Soft delete the template
    template.isActive = false;
    await template.save({ transaction });

    await transaction.commit();

    res.status(204).json({
      status: 'success',
      message: 'Template deleted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

// Get result by ID
exports.getResultsByVisitId = async (req, res, next) => {
  try {
    const { visit_id } = req.params;

    // Find all lab results for the given visit_id
    const results = await LabTestResults.findAll({
      where: { visit_id },
      include: [
        {
          model: LabTestTemplate,
          as: 'template',
        },
        {
          model: Staff,
          as: 'creator',
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (!results || results.length === 0) {
      return next(new AppError('No lab results found for this visit', 404));
    }

    res.status(200).json({
      status: 'success',
      results: results.length,
      data: { results }
    });
  } catch (error) {
    next(error);
  }
};


// update results of patient value
exports.updateResult = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      values,
      fieldValues,
      notes,
      verifiedBy,
      claim_id,
      lab_investigation_id,
      attachments,
    } = req.body;

    // Accept values from either `values` or `fieldValues` (frontend sends fieldValues)
    let resultValues = values || fieldValues || null;

    // Sanitize values to JSON-safe primitives (antd DatePicker returns dayjs/Moment objects)
    const sanitizeValue = (v) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if (typeof v.toISOString === 'function') return v.toISOString();
        if (typeof v.format === 'function') return v.format('YYYY-MM-DD');
        if (Array.isArray(v)) return v.map(sanitizeValue);
        try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); }
      }
      if (v instanceof Date) return v.toISOString();
      return v;
    };
    if (resultValues && typeof resultValues === 'object') {
      resultValues = Object.fromEntries(
        Object.entries(resultValues).map(([k, v]) => [k, sanitizeValue(v)])
      );
    }

    // 1. Fetch and update lab result
    const result = await LabTestResults.findByPk(id, { transaction });
    if (!result) {
      await transaction.rollback();
      return next(new AppError('No result found with that ID', 404));
    }

    result.values = resultValues;
    // Keep legacy `notes` in sync; store technician comment separately so it
    // does not overwrite the doctor's request comment.
    result.technician_notes = notes ?? result.technician_notes;
    result.notes = notes ?? result.notes;

    // Validate verifiedBy: only accept if the ID exists in the staffs table.
    // Admin users have IDs that are NOT in staffs, which would violate the FK constraint.
    if (verifiedBy) {
      const staffRecord = await Staff.findByPk(verifiedBy, { attributes: ['id'], transaction });
      if (staffRecord) {
        result.verifiedBy = verifiedBy;
      } else {
        console.warn(`⚠️  verifiedBy id "${verifiedBy}" not found in staffs table — setting to null`);
        result.verifiedBy = null;
      }
    }
    if (Array.isArray(attachments)) {
      result.attachments = attachments;
    }

    // 4. Compute abnormal flags — Institution ranges take priority over system defaults
    if (resultValues && typeof resultValues === 'object') {
      const abnormalFlags = [];
      const systemRangeRows = await LabRanges.findAll({ transaction });

      // Fetch institution-specific ranges for this result's institution
      let institutionRangeRows = [];
      const institutionId = result.institution_id || null;
      if (institutionId) {
        institutionRangeRows = await InstitutionLabReferenceRange.findAll({
          where: { institution_id: institutionId },
          transaction,
        });
      }

      for (const [param, rawValue] of Object.entries(resultValues)) {
        const numeric = parseFloat(rawValue);
        if (isNaN(numeric)) continue;

        // 1) Try institution range first
        const instRange = institutionRangeRows.find(
          (r) => r.test_name && r.test_name.toLowerCase() === String(param).toLowerCase()
        );
        // 2) Fall back to system default range
        const sysRange = systemRangeRows.find(
          (r) => r.test_name && r.test_name.toLowerCase() === String(param).toLowerCase()
        );

        const range = instRange || sysRange;
        if (range && range.min_value != null && range.max_value != null) {
          if (numeric < range.min_value || numeric > range.max_value) {
            abnormalFlags.push({
              parameter: param,
              value: numeric,
              flag: numeric < range.min_value ? 'low' : 'high',
              reference_range: range.reference_range,
              source: instRange ? 'institution' : 'system',
            });
          }
        }
      }
      result.abnormal_flags = abnormalFlags;
    }

    result.status = 'completed';
    await result.save({ transaction });

    const visit = await Visit.findByPk(result.visit_id, { transaction });
    if (!visit) {
      await transaction.rollback();
      return next(new AppError('Visit not found', 404));
    }

    let billingResult = null;

    if (claim_id) {
      if (!lab_investigation_id) {
        await transaction.rollback();
        return next(new AppError('Lab investigation ID is required when processing billing', 400));
      }

      const labInvestigation = await LabInvestigation.findByPk(lab_investigation_id, { transaction });
      if (!labInvestigation) {
        await transaction.rollback();
        return next(new AppError('Lab investigation not found', 404));
      }

      if (!labInvestigation.g_drg_code || !labInvestigation.test_description) {
        await transaction.rollback();
        return next(new AppError('Test code and description are required', 400));
      }

      // Check for institution-specific price override
      const institutionOverride = await InstitutionLabTariff.findOne({
        where: {
          institution_id: visit.institution_id,
          lab_investigation_id: labInvestigation.id,
          is_active: true
        }
      });

      const marketPrice = institutionOverride ? parseFloat(institutionOverride.market_price || 0) : parseFloat(labInvestigation.market_price || 0);
      const tariffGhc = institutionOverride ? parseFloat(institutionOverride.tariff_ghc || 0) : parseFloat(labInvestigation.tariff_ghc || 0);

      // J4 — idempotent billing: a LabTestResult must never produce a second
      // ServiceBill. If one already exists (e.g. it was billed at creation),
      // reuse it and only link/create the ClaimItem when it is missing.
      const existingBill = await ServiceBill.findOne({
        where: { service_id: result.id, service_type: 'LabTest' },
        transaction
      });

      if (existingBill) {
        const existingClaimItem = await ClaimItem.findOne({
          where: { claim_id, item_type: 'LabTest', item_id: result.id },
          transaction
        });

        if (!existingClaimItem) {
          await addClaimItem(
            claim_id,
            {
              item_type: 'LabTest',
              item_id: result.id,
              service_bill_id: existingBill.id,
              gdrg_code: labInvestigation.g_drg_code,
              description: labInvestigation.test_description,
            },
            transaction
          );
        }

        billingResult = {
          reused_existing_bill: true,
          service_bill_id: existingBill.id,
          invoice_id: existingBill.invoice_id,
          message: 'Existing ServiceBill reused; no duplicate bill created'
        };
      } else {
        billingResult = await handleBilling({
          transaction,
          patient_id: visit.patient_id,
          visit_id: result.visit_id,
          service_id: result.id,
          service_type: 'LabTest',
          description: labInvestigation.test_description,
          g_drg_code: labInvestigation.g_drg_code,
          unit_price: marketPrice,
          nhia_unit_price: tariffGhc,
          quantity: 1,
          department_id: labInvestigation.department_id || result.department_id,
          institution_id: visit.institution_id,
          claim_id,
          gdrg_code: labInvestigation.g_drg_code
        });
      }
    }

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      data: {
        result,
        billing: billingResult,
        message: claim_id ? 'Result updated and billing processed' : 'Result updated successfully (no billing processed)'
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ updateResult error:', error.message);
    console.error(error.stack);
    next(error);
  }
};


// Upload result attachments (images/scans/PDFs) for an existing lab result
exports.updateResultAttachments = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const result = await LabTestResults.findByPk(id, { transaction });
    if (!result) {
      await transaction.rollback();
      return next(new AppError('No result found with that ID', 404));
    }

    if (!req.files || req.files.length === 0) {
      await transaction.rollback();
      return next(new AppError('No attachment files were uploaded', 400));
    }

    // Storage paths are set by the sftpUpload middleware (now using Supabase)
    let uploaded;
    if (Array.isArray(req.body.attachments) && req.body.attachments.length === req.files.length) {
      uploaded = req.files.map((file, index) => ({
        name: file.originalname,
        url: req.body.attachments[index], // Supabase storage path
        type: file.mimetype,
      }));
    } else {
      uploaded = req.files.map((file) => ({
        name: file.originalname,
        url: req.body.attachments || file.filename, // storage path from middleware
        type: file.mimetype,
      }));
    }

    const existing = Array.isArray(result.attachments) ? result.attachments : [];
    result.attachments = [...existing, ...uploaded];
    await result.save({ transaction });

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      data: { result, message: 'Attachments uploaded successfully' }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};


exports.getLabStatistics = async (req, res, next) => {
  try {
    const totalTests = await LabTestResults.count();
    const completedTests = await LabTestResults.count({ where: { status: 'completed' } });
    const pendingTests = await LabTestResults.count({ where: { status: 'pending' } });

    // Get total templates
    const totalTemplates = await LabTestTemplate.count();

    // Get tests per day
    const testsPerDay = await LabTestResults.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'DESC']]
    });

    const testsByTemplate = await LabTestResults.findAll({
      attributes: [
        'templateId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['templateId']
    });

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayCompleted = await LabTestResults.count({
      where: {
        status: 'completed',
        createdAt: {
          [Op.between]: [startOfDay, endOfDay]
        }
      }
    });

    const todayPending = await LabTestResults.count({
      where: {
        status: 'pending',
        createdAt: {
          [Op.between]: [startOfDay, endOfDay]
        }
      }
    });

    // Corrected PostgreSQL version for turnaround time calculation
    const turnaroundData = await LabTestResults.findAll({
      attributes: [
        [sequelize.literal(`AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")))`), 'avgSeconds']
      ],
      where: { status: 'completed' }
    });

    const topTests = await LabTestResults.findAll({
      attributes: ['templateId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['templateId'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 5
    });

    res.status(200).json({
      status: 'success',
      data: {
        totalTests,
        completedTests,
        pendingTests,
        totalTemplates,
        testsPerDay,
        testsByTemplate,
        todayCompleted,
        todayPending,
        turnaroundTime: {
          avgSeconds: turnaroundData[0] ? turnaroundData[0].get('avgSeconds') : 0,
          avgHours: turnaroundData[0] ? (turnaroundData[0].get('avgSeconds') / 3600).toFixed(2) : 0
        },
        topTests: topTests.map(test => ({
          templateId: test.templateId,
          count: test.dataValues.count
        }))
      }
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};


// Create a new lab range
exports.createLabRange = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { test_name, reference_range, unit, category, notes } = req.body;

    // Validate input
    if (!test_name || !reference_range || !category) {
      await transaction.rollback();
      return next(new AppError('Please provide test name, reference range, and category', 400));
    }

    const labRange = await LabRanges.create({
      test_name,
      reference_range,
      unit: unit || null,
      category,
      notes: notes || null
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      status: 'success',
      data: { labRange }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Get all lab ranges
exports.getLabRanges = async (req, res, next) => {
  try {
    const labRanges = await LabRanges.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      results: labRanges.length,
      data: { labRanges }
    });
  } catch (error) {
    next(error);
  }
}

// Update a lab range
exports.updateLabRange = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { test_name, reference_range, unit, category, notes } = req.body;

    // Validate input
    if (!test_name || !reference_range || !category) {
      await transaction.rollback();
      return next(new AppError('Please provide test name, reference range, and category', 400));
    }

    const labRange = await LabRanges.findByPk(id, { transaction });
    if (!labRange) {
      await transaction.rollback();
      return next(new AppError('No lab range found with that ID', 404));
    }

    // Update lab range
    labRange.test_name = test_name;
    labRange.reference_range = reference_range;
    labRange.unit = unit || null;
    labRange.category = category;
    labRange.notes = notes || null;
    await labRange.save({ transaction });



    await transaction.commit();

    res.status(200).json({
      status: 'success',
      data: { labRange }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}
// Delete a lab range
exports.deleteLabRange = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const labRange = await LabRanges.findByPk(id, { transaction });

    if (!labRange) {
      await transaction.rollback();
      return next(new AppError('No lab range found with that ID', 404));
    }

    // Soft delete the lab range
    await labRange.destroy({ transaction });

    await transaction.commit();

    res.status(204).json({
      status: 'success',
      message: 'Lab range deleted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}


// stats by department
exports.getLabTestStats = async (req, res) => {
  try {
    const { department_id, start_date, end_date } = req.query;

    let where = {};
    if (department_id) where.department_id = department_id;
    if (start_date && end_date) {
      where.createdAt = { [Op.between]: [start_date, end_date] };
    }

    // ✅ Total
    const total = await LabTestResult.count({ where });

    // ✅ By Status
    const byStatus = await LabTestResult.findAll({
      where,
      attributes: [
        "status",
        [fn("COUNT", col("LabTestResult.id")), "count"], // 👈 disambiguated
      ],
      group: ["status"],
    });

    // ✅ By Department
    const byDepartment = await LabTestResult.findAll({
      where,
      attributes: [
        "department_id",
        [fn("COUNT", col("LabTestResult.id")), "count"], // 👈 fixed
      ],
      include: [
        {
          model: Department,
          as: "department",
          attributes: ["id", "name"],
        },
      ],
      group: ["LabTestResult.department_id", "department.id", "department.name"],
    });

    // ✅ By Staff
    const byStaff = await LabTestResult.findAll({
      where,
      attributes: [
        "createdBy",
        [fn("COUNT", col("LabTestResult.id")), "count"], // 👈 fixed
      ],
      include: [
        {
          model: Staff,
          as: "creator",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
      group: ["LabTestResult.createdBy", "creator.id", "creator.firstName", "creator.lastName"],
    });

    res.json({
      success: true,
      data: {
        total,
        byStatus,
        byDepartment,
        byStaff,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};



// get recent lab tests
exports.getRecentLabTests = async (req, res) => {
  try {
    const recentTests = await LabTestResult.findAll({
      where: { status: 'completed' },  // ✅ Only completed tests
      include: [
        {
          model: LabTestTemplate,
          as: 'template',
          include: [
            { model: LabInvestigation, as: 'lab_tarrif' }
          ]
        },
        {
          model: Visit,
          as: 'visit',
          include: [
            { model: Patient, as: 'patient' },
            { model: Claim, as: 'claims' }
          ]
        },
        {
          model: Staff,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Staff,
          as: 'verifier',
          attributes: ['id', 'firstName', 'lastName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    res.status(200).json({
      status: 'success',
      results: recentTests.length,
      data: { recentTests }
    });
  } catch (error) {
    console.error(error)
    res.status(500).json({ status: 'error', message: error.message });
  }
};


// get recents lab test by visit_id
exports.getRecentLabTestsByVisitId = async (req, res, next) => {
  try {
    const { visit_id } = req.params;

    const recentTests = await LabTestResult.findAll({
      where: { visit_id },
      include: [
        {
          model: LabTestTemplate,
          as: 'template',
          include: [
            {
              model: LabInvestigation,
              as: 'lab_tarrif'
            }
          ]
        },
        {
          model: Visit,
          as: 'visit',
          include: [
            {
              model: Patient,
              as: 'patient',
            },
            {
              model: Claim,
              as: 'claims',
            }
          ]
        },
        {
          model: Staff,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName',]
        },
        {
          model: Staff,
          as: 'verifier',
          attributes: ['id', 'firstName', 'lastName',]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    if (!recentTests || recentTests.length === 0) {
      return next(new AppError('No recent lab tests found for this visit', 404));
    }
    res.status(200).json({
      status: 'success',
      results: recentTests.length,
      data: { recentTests }
    });
  }
  catch (error) {
    console.log(error)
    next(error);
  }
}

// ─── Lab Result Sharing: SMS, Link, PDF ───────────────────────

/**
 * POST /lab/results/:id/send-sms
 * Generate a secure share token and send the lab result link via SMS.
 */
exports.sendLabResultSMS = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.admin?.institution_id || req.user?.institution_id;
    const staffUserId = req.user?.id || req.admin?.id;
    const phoneNumber = req.body.phone_number;

    const result = await labResultShareService.sendLabResultSMS(id, institutionId, staffUserId, phoneNumber);

    res.status(200).json({
      success: true,
      message: 'Lab result SMS sent successfully',
      data: {
        phone: result.phone,
        shareUrl: result.shareUrl,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error sending lab result SMS:', error.message);
    const statusCode = error.message.includes('not found') ? 404
      : error.message.includes('Unauthorized') ? 403
      : error.message.includes('phone number') ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to send SMS',
    });
  }
};

/**
 * POST /lab/results/:id/share-link
 * Generate a secure share link for the lab result.
 */
exports.generateShareLink = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.admin?.institution_id || req.user?.institution_id;
    const staffUserId = req.user?.id || req.admin?.id;

    const result = await labResultShareService.generateShareToken(id, institutionId, staffUserId);

    res.status(200).json({
      success: true,
      message: 'Share link generated successfully',
      data: {
        shareUrl: result.shareUrl,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error generating share link:', error.message);
    const statusCode = error.message.includes('not found') ? 404
      : error.message.includes('Unauthorized') ? 403
      : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate share link',
    });
  }
};

/**
 * GET /lab/results/:id/pdf
 * Generate and stream a PDF of the lab result.
 */
exports.generateLabResultPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.admin?.institution_id || req.user?.institution_id;

    const pdfStream = await labResultShareService.generateLabResultPDF(id, institutionId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    pdfStream.pipe(res);
  } catch (error) {
    console.error('Error generating lab result PDF:', error.message);
    const statusCode = error.message.includes('not found') ? 404
      : error.message.includes('Unauthorized') ? 403
      : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate PDF',
    });
  }
};

/**
 * GET /public/lab-results/:token
 * Public endpoint: view lab result by secure token. No auth required.
 */
exports.viewLabResultByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await labResultShareService.accessShareToken(token);

    const labResult = result.labResult;
    const patient = labResult.visit?.patient;
    const institution = result.institution;

    res.status(200).json({
      success: true,
      data: {
        patient: patient ? {
          name: `${patient.first_name || ''} ${patient.middle_name || ''} ${patient.last_name || ''}`.trim(),
          gender: patient.gender,
          date_of_birth: patient.date_of_birth,
        } : null,
        institution: institution ? {
          name: institution.name,
          address: institution.address,
          contact: institution.contact,
          email: institution.email,
          logo_url: institution.logo_url,
        } : null,
        labResult: {
          id: labResult.id,
          status: labResult.status,
          values: labResult.values,
          abnormal_flags: labResult.abnormal_flags,
          notes: labResult.notes,
          technician_notes: labResult.technician_notes,
          request_notes: labResult.request_notes,
          specimen_type: labResult.specimen_type,
          createdAt: labResult.createdAt,
          template: labResult.template ? {
            name: labResult.template.name,
            fields: labResult.template.fields,
            lab_tarrif: labResult.template.lab_tarrif ? {
              test_description: labResult.template.lab_tarrif.test_description,
            } : null,
          } : null,
          creator: labResult.creator ? {
            name: `${labResult.creator.firstName || ''} ${labResult.creator.lastName || ''}`.trim(),
          } : null,
          verifier: labResult.verifier ? {
            name: `${labResult.verifier.firstName || ''} ${labResult.verifier.lastName || ''}`.trim(),
          } : null,
        },
        tokenExpiresAt: result.tokenExpiresAt,
      },
    });
  } catch (error) {
    console.error('Error viewing lab result by token:', error.message);
    const statusCode = error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('revoked') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Unable to access lab result',
    });
  }
};


