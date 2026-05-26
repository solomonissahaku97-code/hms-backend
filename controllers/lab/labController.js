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
const Notification = require('../../models/notification');

// Helper function to notify lab staff
async function notifyLabStaff(labResult, template, visit, req) {
  try {
    // Find lab department
    const labDepartment = await Department.findOne({ where: { name: { [Op.iLike]: '%lab%' } } });
    
    if (!labDepartment) {
      console.log('Lab department not found for notifications');
      return;
    }

    // Find staff in the lab department
    const labStaff = await Staff.findAll({
      include: [{
        model: Department,
        as: 'department',
        where: { id: labDepartment.id }
      }]
    });

    // Get patient info
    const patient = await Patient.findByPk(visit.patient_id);

    if (!labStaff || labStaff.length === 0) {
      console.log('No lab staff found for notifications');
      return;
    }

    // Create notifications for all lab staff
    for (const staff of labStaff) {
      const notification = await Notification.create({
        title: 'New Lab Request',
        description: `New lab test requested: ${template?.lab_tarrif?.test_description || 'Lab Test'}. Patient: ${patient?.firstName} ${patient?.lastName}`,
        from_staff_id: req.body.user,
        to_staff_id: staff.id,
        institution_id: visit.institution_id,
        to_department_id: labDepartment.id,
        type: 'Alert',
        priority: 'Medium',
      });

      // Emit real-time notification
      try {
        const notificationService = req.app.get('notificationService');
        if (notificationService) {
          notificationService.emitNotification(notification);
        }
      } catch (e) {
        console.error('Error emitting real-time notification:', e);
      }
    }

    console.log(`📣 Notifications sent to ${labStaff.length} lab staff members`);
  } catch (error) {
    console.error('Error sending lab staff notifications:', error);
  }
}

// Create a new template
exports.createTemplate = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { lab_tarrif_id, description, fields, createdBy } = req.body;
    console.log(req.body)

    // Validate input
    if (!lab_tarrif_id || !fields || !Array.isArray(fields)) {
      await transaction.rollback();
      return next(new AppError('Please provide template name and fields', 400));
    }

    const lab_tarrif = await LabInvestigation.findByPk(lab_tarrif_id);
    if (!lab_tarrif) return res.status({ error: 'Tarrif not found' })

    const template = await LabTestTemplate.create({
      lab_tarrif_id,
      description,
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

// Create test result
exports.createResult = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { templateId, visit_id, note, user, department_id } = req.body;
    console.log(req.body)

    // Validate required fields
    if (!templateId || !visit_id || !user) {
      await transaction.rollback();
      return next(new AppError('templateId, visit_id, and user are required fields', 400));
    }

    // 1) Validate template exists
    const template = await LabTestTemplate.findByPk(templateId, {
      include: [{
        model: LabTestField,
        as: 'fields',
      }],
      transaction
    });

    if (!template) {
      await transaction.rollback();
      return next(new AppError('No template found with that ID', 404));
    }
    const visit = await Visit.findByPk(visit_id, { transaction });
    if (!visit) {
      await transaction.rollback();
      return next(new AppError('No visit found with that ID', 404));
    }

    // Prepare result data
    const resultData = {
      templateId,
      visit_id,
      notes: note || null, // Handle optional notes
      createdBy: user,
      department_id
      // Add any other required fields from your model
    };

    // 3) Create result
    const result = await LabTestResults.create(resultData, { transaction });

    await transaction.commit();

    // Notify lab staff about new lab request (after commit to not block the response)
    // We need to fetch visit without transaction for notification
    const visitForNotify = await Visit.findByPk(visit_id);
    const templateForNotify = await LabTestTemplate.findByPk(templateId, {
      include: [{ model: LabInvestigation, as: 'lab_tarrif' }]
    });
    
    // Send notification to lab staff (fire and forget - don't await)
    notifyLabStaff(result, templateForNotify, visitForNotify, req).catch(err => 
      console.error('Error notifying lab staff:', err)
    );

    res.status(201).json({
      status: 'success',
      data: {
        result,
        message: 'Test result created successfully'
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating test result:', error);

    // More detailed error response
    const errorResponse = {
      status: 'error',
      message: 'Failed to create test result',
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
exports.getResults = async (req, res) => {
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

// Update a template
exports.updateTemplate = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, description, fields } = req.body;

    // Validate input
    if (!name || !fields || !Array.isArray(fields)) {
      await transaction.rollback();
      return next(new AppError('Please provide template name and fields', 400));
    }

    const template = await LabTestTemplate.findByPk(id, { transaction });
    if (!template) {
      await transaction.rollback();
      return next(new AppError('No template found with that ID', 404));
    }

    // Update template
    template.name = name;
    template.description = description;
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
          as: 'createdByUser',
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
    const { values, notes, verifiedBy, claim_id, lab_investigation_id } = req.body;

    // 1. Fetch and update lab result
    const result = await LabTestResults.findByPk(id, { transaction });
    if (!result) {
      await transaction.rollback();
      return next(new AppError('No result found with that ID', 404));
    }

    result.values = values;
    result.notes = notes;
    result.verifiedBy = verifiedBy;
    result.status = 'completed';
    await result.save({ transaction });

    // 2. Get lab investigation details
    const labInvestigation = await LabInvestigation.findByPk(lab_investigation_id, { transaction });
    if (!labInvestigation) {
      await transaction.rollback();
      return next(new AppError('Lab investigation not found', 404));
    }

    // 3. Validate required fields (remove claim_id requirement)
    if (!labInvestigation.g_drg_code || !labInvestigation.test_description) {
      await transaction.rollback();
      return next(new AppError('Test code and description are required', 400));
    }

    const visit = await Visit.findByPk(result.visit_id, { transaction });
    if (!visit) {
      await transaction.rollback();
      return next(new AppError('Visit not found', 404));
    }

    if (!result.visit_id) {
      await transaction.rollback();
      return next(new AppError('Visit ID is required from lab investigation', 400));
    }

    let billingResult = null;

    // ✅ 5. Process billing ONLY if claim_id is provided
    if (claim_id) {
      billingResult = await handleBilling({
        transaction,
        patient_id: visit.patient_id,
        visit_id: result.visit_id,
        service_id: result.id, // use investigation id, not result id
        service_type: 'LabTest',
        description: labInvestigation.test_description,
        g_drg_code: labInvestigation.g_drg_code,
        unit_price: labInvestigation.market_price,
        nhia_unit_price: labInvestigation.tariff_ghc, // what NHIA will pay
        quantity: 1, // Lab tests always quantity=1
        department_id: labInvestigation.department_id || result.department_id,
        institution_id: visit.institution_id,
        claim_id,
        gdrg_code: labInvestigation.g_drg_code
      });

      // ✅ 6. Update claim totals (important so totals reflect NHIA + market amounts)
      // await updateClaimTotal(claim_id, transaction);
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



