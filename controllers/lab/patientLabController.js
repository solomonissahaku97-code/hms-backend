const AppError = require('../../utils/appError');
const { Op } = require('sequelize');

const LabTestResult = require('../../models/lab/LabTestResult');
const LabTestTemplate = require('../../models/lab/LabTestTemplate');
const LabTestField = require('../../models/lab/LabTestField');
const LabInvestigation = require('../../models/claims/LabInvestigations');

const Visit = require('../../models/Visit');
const Patient = require('../../models/patient');
const Staff = require('../../models/staff');
const Claim = require('../../models/claims/claim');
const Diagnosis = require('../../models/diagnosis');
const systemDiagnosis = require('../../models/claims/systemDiagnosis');

// GET all lab requests + latest results for a patient's visits
// Query: patient_id OR derived from authenticated user (if your auth stores it)
// Optional query: status=pending|completed|verified|rejected
exports.getPatientLabs = async (req, res, next) => {
  try {
    const { patient_id } = req.query;

    if (!patient_id) {
      return next(new AppError('patient_id query parameter is required', 400));
    }

    const { status } = req.query;

    const visits = await Visit.findAll({
      where: { patient_id },
      attributes: ['id', 'patient_id', 'institution_id', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']]
    });

    if (!visits || visits.length === 0) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: { visits: [] }
      });
    }

    const visitIds = visits.map(v => v.id);

    const where = {
      visit_id: { [Op.in]: visitIds }
    };

    if (status) {
      where.status = status;
    }

    const labResults = await LabTestResult.findAll({
      where,
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
            { model: Claim, as: 'claims' },
            {
              model: Diagnosis,
              as: 'diagnosis',
              include: [{ model: systemDiagnosis, as: 'systemDiagnosis' }]
            }
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
      order: [['createdAt', 'DESC']]
    });

    // Group by visit
    const visitsById = new Map(visits.map(v => [v.id, v]));
    const grouped = new Map();

    for (const vId of visitIds) grouped.set(vId, []);
    for (const r of labResults) {
      const vId = r.visit_id;
      if (!grouped.has(vId)) grouped.set(vId, []);
      grouped.get(vId).push(r);
    }

    const dataVisits = visits.map(v => ({
      visit: v,
      labResults: grouped.get(v.id) || []
    }));

    return res.status(200).json({
      status: 'success',
      results: labResults.length,
      data: { visits: dataVisits }
    });
  } catch (error) {
    next(error);
  }
};

