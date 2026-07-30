// controllers/maternity/maternityController.js
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const ANC = require('../../models/maternity/ANC');
const DeliveryRegister = require('../../models/maternity/DeliveryRegister');
const PNC = require('../../models/maternity/PNC');
const Visit = require('../../models/Visit');
const Patient = require('../../models/patient');
const Partograph = require('../../models/partograph');
const Appointment = require('../../models/appointment');
const PregnancyHistory = require('../../models/PregnancyHistory');

// @desc    Get maternity dashboard stats
// @route   GET /api/v1/maternity/dashboard
// @access  Private
exports.getMaternityDashboard = async (req, res) => {
  try {
    const institutionId = req.user?.institution_id || req.body.institution_id;
    
    if (!institutionId) {
      return res.status(400).json({ success: false, message: 'Institution ID is required' });
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());

    // Get ANC patients with active visits in ANC department
    const ancDepartmentType = 'Antenatal Care (ANC)';
    const activeANCVisits = await Visit.findAll({
      where: {
        institution_id: institutionId,
        status: 'Active',
        department: {
          [Op.or]: [
            { departmentType: ancDepartmentType },
            { name: { [Op.like]: '%ANC%' } },
            { name: { [Op.like]: '%Antenatal%' } }
          ]
        }
      },
      include: [
        { model: Patient, as: 'patient', required: true },
        { model: ANC, as: 'anc_record', required: false }
      ]
    });

    // Get labour ward patients
    const labourDepartmentType = 'Labour Ward';
    const activeLabourVisits = await Visit.findAll({
      where: {
        institution_id: institutionId,
        status: 'Active',
        department: {
          [Op.or]: [
            { departmentType: labourDepartmentType },
            { name: { [Op.like]: '%Labour%' } },
            { name: { [Op.like]: '%Labor%' } }
          ]
        }
      },
      include: [
        { model: Patient, as: 'patient', required: true },
        { model: Partograph, as: 'partographs', required: false }
      ]
    });

    // Get deliveries this month
    const deliveriesThisMonth = await DeliveryRegister.count({
      where: {
        institution_id: institutionId,
        date_of_delivery: {
          [Op.gte]: startOfMonth
        }
      }
    });

    // Get ANC visits this month
    const ancVisitsThisMonth = await ANC.count({
      where: {
        institution_id: institutionId,
        createdAt: {
          [Op.gte]: startOfMonth
        }
      }
    });

    // Get upcoming appointments
    const upcomingAppointments = await Appointment.findAll({
      where: {
        institution_id: institutionId,
        appointment_date: {
          [Op.gte]: today
        },
        status: 'scheduled'
      },
      include: [
        { model: Patient, as: 'patient', required: true }
      ],
      limit: 10,
      order: [['appointment_date', 'ASC']]
    });

    // Get high-risk ANC patients
    const highRiskPatients = await ANC.count({
      where: {
        institution_id: institutionId,
        risk_level: {
          [Op.or]: ['High', 'Very High']
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          activeANCPatients: activeANCVisits.length,
          activeLabourPatients: activeLabourVisits.length,
          deliveriesThisMonth,
          ancVisitsThisMonth,
          highRiskPatients,
          upcomingAppointments: upcomingAppointments.length
        },
        activeANCPatients: activeANCVisits,
        activeLabourPatients: activeLabourVisits,
        upcomingAppointments
      }
    });
  } catch (error) {
    console.error('Maternity Dashboard Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching maternity dashboard data',
      error: error.message
    });
  }
};

// @desc    Get all ANC patients
// @route   GET /api/v1/maternity/anc/patients
// @access  Private
exports.getANCPatients = async (req, res) => {
  try {
    const institutionId = req.user?.institution_id || req.query.institution_id;
    const { status, risk_level, search } = req.query;

    if (!institutionId) {
      return res.status(400).json({ success: false, message: 'Institution ID is required' });
    }

    const whereClause = {
      institution_id: institutionId
    };

    if (status) {
      whereClause.status = status;
    }

    if (risk_level) {
      whereClause.risk_level = risk_level;
    }

    const ancRecords = await ANC.findAll({
      where: whereClause,
      include: [
        {
          model: Visit,
          as: 'visit',
          where: status ? { status } : undefined,
          required: true,
          include: [
            { model: Patient, as: 'patient', required: true }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: ancRecords.length,
      data: ancRecords
    });
  } catch (error) {
    console.error('Get ANC Patients Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ANC patients',
      error: error.message
    });
  }
};

// @desc    Get ANC patient details
// @route   GET /api/v1/maternity/anc/:id
// @access  Private
exports.getANCPatient = async (req, res) => {
  try {
    const { id } = req.params;

    const ancRecord = await ANC.findByPk(id, {
      include: [
        {
          model: Visit,
          as: 'visit',
          include: [
            { model: Patient, as: 'patient' }
          ]
        }
      ]
    });

    if (!ancRecord) {
      return res.status(404).json({ success: false, message: 'ANC record not found' });
    }

    // Get ANC visit history
    const ancVisits = await ANC.findAll({
      where: { patient_id: ancRecord.patient_id },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // Get pregnancy history
    const pregnancyHistory = await PregnancyHistory.findOne({
      where: { patient_id: ancRecord.patient_id }
    });

    res.status(200).json({
      success: true,
      data: {
        ...ancRecord.toJSON(),
        visitHistory: ancVisits,
        pregnancyHistory
      }
    });
  } catch (error) {
    console.error('Get ANC Patient Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ANC patient details',
      error: error.message
    });
  }
};

// @desc    Admit patient to Labour Ward
// @route   POST /api/v1/maternity/labour/admit
// @access  Private
exports.admitToLabour = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { visit_id, patient_id, institution_id, admission_notes, estimated_delivery_date } = req.body;

    if (!visit_id || !patient_id || !institution_id) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'visit_id, patient_id and institution_id are required' });
    }

    // Verify visit exists
    const visit = await Visit.findByPk(visit_id, { transaction: t });
    if (!visit) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }

    // Update visit department to Labour Ward
    const labourDepartment = await sequelize.models.Department.findOne({
      where: {
        institution_id,
        [Op.or]: [
          { departmentType: 'Labour Ward' },
          { name: { [Op.like]: '%Labour%' } },
          { name: { [Op.like]: '%Labor%' } }
        ]
      }
    });

    if (!labourDepartment) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Labour Ward department not found. Please create it first.' });
    }

    await visit.update(
      { department_id: labourDepartment.id },
      { transaction: t }
    );

    // Update patient department
    await Patient.update(
      { department_id: labourDepartment.id },
      { where: { id: patient_id } },
      { transaction: t }
    );

    // Create initial partograph record
    const partograph = await Partograph.create({
      visit_id,
      labour_start_time: new Date(),
      remarks: admission_notes || 'Admitted to Labour Ward'
    }, { transaction: t });

    // If there's an ANC record, update it
    const ancRecord = await ANC.findOne({
      where: { visit_id },
      transaction: t
    });

    if (ancRecord) {
      await ancRecord.update(
        { status: 'In Labour' },
        { transaction: t }
      );
    }

    await t.commit();

    res.status(201).json({
      success: true,
      message: 'Patient admitted to Labour Ward successfully',
      data: {
        visit_id,
        department_id: labourDepartment.id,
        department_name: labourDepartment.name,
        partograph_id: partograph.id
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Admit to Labour Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error admitting patient to Labour Ward',
      error: error.message
    });
  }
};

// @desc    Record delivery
// @route   POST /api/v1/maternity/delivery
// @access  Private
exports.recordDelivery = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      visit_id,
      institution_id,
      date_of_delivery,
      mode_of_delivery,
      presentation,
      baby_sex,
      birth_weight,
      apgar_score,
      outcome,
      complications,
      remarks
    } = req.body;

    if (!visit_id || !institution_id || !date_of_delivery || !mode_of_delivery || !baby_sex || !outcome) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Missing required delivery fields' });
    }

    // Create delivery record
    const delivery = await DeliveryRegister.create({
      visit_id,
      institution_id,
      date_of_delivery,
      mode_of_delivery,
      presentation,
      baby_sex,
      birth_weight,
      apgar_score,
      outcome,
      complications,
      remarks
    }, { transaction: t });

    // Update visit status to completed
    await Visit.update(
      { status: 'Completed' },
      { where: { id: visit_id }, transaction: t }
    );

    // Create PNC record
    const pncNumber = `PNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await PNC.create({
      visit_id,
      institution_id,
      pnc_number: pncNumber,
      year: new Date().getFullYear(),
      mother_condition: 'Good',
      baby_condition: outcome === 'Alive' ? 'Healthy' : 'Other',
      auditor_id: req.user?.id || req.body.auditor_id
    }, { transaction: t });

    await t.commit();

    res.status(201).json({
      success: true,
      message: 'Delivery recorded successfully',
      data: delivery
    });
  } catch (error) {
    await t.rollback();
    console.error('Record Delivery Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording delivery',
      error: error.message
    });
  }
};

// @desc    Get active labour patients
// @route   GET /api/v1/maternity/labour/active
// @access  Private
exports.getActiveLabours = async (req, res) => {
  try {
    const institutionId = req.user?.institution_id || req.query.institution_id;

    if (!institutionId) {
      return res.status(400).json({ success: false, message: 'Institution ID is required' });
    }

    const labourDepartment = await sequelize.models.Department.findOne({
      where: {
        institution_id: institutionId,
        [Op.or]: [
          { departmentType: 'Labour Ward' },
          { name: { [Op.like]: '%Labour%' } },
          { name: { [Op.like]: '%Labor%' } }
        ]
      }
    });

    if (!labourDepartment) {
      return res.status(200).json({ success: true, data: [] });
    }

    const activeVisits = await Visit.findAll({
      where: {
        institution_id: institutionId,
        department_id: labourDepartment.id,
        status: 'Active'
      },
      include: [
        { model: Patient, as: 'patient', required: true },
        {
          model: Partograph,
          as: 'partographs',
          required: false,
          order: [['record_time', 'DESC']],
          limit: 1
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: activeVisits.length,
      data: activeVisits
    });
  } catch (error) {
    console.error('Get Active Labours Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active labour patients',
      error: error.message
    });
  }
};
