const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * GET /me/profile
 * Get patient profile with institution and insurance info
 */
exports.getProfile = async (req, res) => {
  try {
    const patientId = req.patient.id;

    const [patient] = await sequelize.query(`
      SELECT p.*, i.name AS institution_name, i.address AS institution_address
      FROM patients p
      LEFT JOIN institutions i ON p.institution_id = i.id
      WHERE p.id = :patientId
    `, { replacements: { patientId }, type: QueryTypes.SELECT });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get insurance info
    const [insurance] = await sequelize.query(`
      SELECT insurance_provider, insurance_number, insurance_expiry_date, insured
      FROM insurances
      WHERE patient_id = :patientId
      ORDER BY created_at DESC LIMIT 1
    `, { replacements: { patientId }, type: QueryTypes.SELECT });

    res.json({
      ...patient,
      insurance: insurance || null,
    });
  } catch (err) {
    console.error('[PatientPortal] Profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * GET /me/visits
 * Get all visits for the patient (paginated)
 */
exports.getVisits = async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE v.patient_id = :patientId';
    const replacements = { patientId, limit: parseInt(limit), offset };

    if (status) {
      whereClause += ' AND v.status = :status';
      replacements.status = status;
    }

    const visits = await sequelize.query(`
      SELECT v.id, v.status, v.attendance_type, v.visit_type, v.created_at, v.updated_at,
             d.name AS department_name,
             i.name AS institution_name
      FROM visits v
      LEFT JOIN departments d ON v.department_id = d.id
      LEFT JOIN institutions i ON v.institution_id = i.id
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT :limit OFFSET :offset
    `, { replacements, type: QueryTypes.SELECT });

    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) AS total FROM visits v ${whereClause}
    `, { replacements: { patientId, status }, type: QueryTypes.SELECT });

    res.json({
      data: visits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.total),
        totalPages: Math.ceil(countResult.total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[PatientPortal] Visits error:', err);
    res.status(500).json({ error: 'Failed to fetch visits' });
  }
};

/**
 * GET /me/visits/:id
 * Get a single visit with diagnoses, prescriptions, lab results
 */
exports.getVisitById = async (req, res) => {
  try {
    const patientId = req.patient.id;
    const visitId = req.params.id;

    const [visit] = await sequelize.query(`
      SELECT v.*, d.name AS department_name, i.name AS institution_name
      FROM visits v
      LEFT JOIN departments d ON v.department_id = d.id
      LEFT JOIN institutions i ON v.institution_id = i.id
      WHERE v.id = :visitId AND v.patient_id = :patientId
    `, { replacements: { visitId, patientId }, type: QueryTypes.SELECT });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Diagnoses
    const diagnoses = await sequelize.query(`
      SELECT diag.*, sd.icd_10_code, sd.diagnosis_name,
             s.first_name AS doctor_first_name, s.last_name AS doctor_last_name
      FROM diagnosis diag
      LEFT JOIN system_diagnoses sd ON diag.system_diagnosis_id = sd.id
      LEFT JOIN staff s ON diag.staff_id = s.id
      WHERE diag.visit_id = :visitId
      ORDER BY diag.created_at DESC
    `, { replacements: { visitId }, type: QueryTypes.SELECT });

    // Prescriptions
    const prescriptions = await sequelize.query(`
      SELECT pr.*, m.name AS medication_name,
             s.first_name AS doctor_first_name, s.last_name AS doctor_last_name
      FROM prescriptions pr
      LEFT JOIN medications m ON pr.medication_id = m.id
      LEFT JOIN staff s ON pr.doctor_id = s.id
      WHERE pr.visit_id = :visitId
      ORDER BY pr.created_at DESC
    `, { replacements: { visitId }, type: QueryTypes.SELECT });

    // Lab results
    const labResults = await sequelize.query(`
      SELECT lr.*, ltt.name AS test_name
      FROM lab_test_results lr
      LEFT JOIN lab_test_templates ltt ON lr."templateId" = ltt.id
      WHERE lr.visit_id = :visitId AND lr.status IN ('completed', 'verified', 'released')
      ORDER BY lr."createdAt" DESC
    `, { replacements: { visitId }, type: QueryTypes.SELECT });

    res.json({
      ...visit,
      diagnoses,
      prescriptions,
      labResults,
    });
  } catch (err) {
    console.error('[PatientPortal] Visit detail error:', err);
    res.status(500).json({ error: 'Failed to fetch visit details' });
  }
};

/**
 * GET /me/prescriptions
 * Get all prescriptions for the patient (paginated)
 */
exports.getPrescriptions = async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const prescriptions = await sequelize.query(`
      SELECT pr.*, m.name AS medication_name, m.dosage_form,
             s.first_name AS doctor_first_name, s.last_name AS doctor_last_name
      FROM prescriptions pr
      LEFT JOIN medications m ON pr.medication_id = m.id
      LEFT JOIN staff s ON pr.doctor_id = s.id
      WHERE pr.patient_id = :patientId
      ORDER BY pr.created_at DESC
      LIMIT :limit OFFSET :offset
    `, { replacements: { patientId, limit: parseInt(limit), offset }, type: QueryTypes.SELECT });

    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) AS total FROM prescriptions WHERE patient_id = :patientId
    `, { replacements: { patientId }, type: QueryTypes.SELECT });

    res.json({
      data: prescriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.total),
        totalPages: Math.ceil(countResult.total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[PatientPortal] Prescriptions error:', err);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
};

/**
 * GET /me/lab-results
 * Get all lab results for the patient (paginated)
 */
exports.getLabResults = async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE lr.patient_id = :patientId';
    const replacements = { patientId, limit: parseInt(limit), offset };

    if (status) {
      whereClause += ' AND lr.status = :status';
      replacements.status = status;
    }

    const labResults = await sequelize.query(`
      SELECT lr.id, lr.sample_number, lr.status, lr.notes, lr.request_notes,
             lr.specimen_type, lr.specimen_condition, lr.abnormal_flags,
             lr.rejection_reason, lr.values, lr.attachments,
             lr.tat_started_at, lr.tat_completed_at, lr.tat_minutes,
             lr."createdAt" AS created_at, lr."updatedAt" AS updated_at,
             ltt.name AS test_name, ltt.description AS test_category,
             d.name AS department_name,
             i.name AS institution_name
      FROM lab_test_results lr
      LEFT JOIN lab_test_templates ltt ON lr."templateId" = ltt.id
      LEFT JOIN departments d ON lr.department_id = d.id
      LEFT JOIN institutions i ON lr.institution_id = i.id
      ${whereClause}
      ORDER BY lr."createdAt" DESC
      LIMIT :limit OFFSET :offset
    `, { replacements, type: QueryTypes.SELECT });

    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) AS total FROM lab_test_results lr
      ${whereClause}
    `, { replacements: { patientId, status }, type: QueryTypes.SELECT });

    const statusCounts = await sequelize.query(`
      SELECT status, COUNT(*) AS count FROM lab_test_results
      WHERE patient_id = :patientId
      GROUP BY status
    `, { replacements: { patientId }, type: QueryTypes.SELECT });

    const counts = {};
    for (const row of statusCounts) {
      counts[row.status] = parseInt(row.count);
    }

    res.json({
      data: labResults,
      counts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.total),
        totalPages: Math.ceil(countResult.total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[PatientPortal] Lab results error:', err);
    res.status(500).json({ error: 'Failed to fetch lab results' });
  }
};

/**
 * GET /me/diagnoses
 * Get all diagnoses for the patient (paginated)
 */
exports.getDiagnoses = async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const diagnoses = await sequelize.query(`
      SELECT diag.*, sd.icd_10_code, sd.diagnosis_name,
             s.first_name AS doctor_first_name, s.last_name AS doctor_last_name,
             d.name AS department_name
      FROM diagnosis diag
      LEFT JOIN system_diagnoses sd ON diag.system_diagnosis_id = sd.id
      LEFT JOIN staff s ON diag.staff_id = s.id
      LEFT JOIN departments d ON diag.department_id = d.id
      WHERE diag.patient_id = :patientId
      ORDER BY diag.created_at DESC
      LIMIT :limit OFFSET :offset
    `, { replacements: { patientId, limit: parseInt(limit), offset }, type: QueryTypes.SELECT });

    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) AS total FROM diagnosis WHERE patient_id = :patientId
    `, { replacements: { patientId }, type: QueryTypes.SELECT });

    res.json({
      data: diagnoses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.total),
        totalPages: Math.ceil(countResult.total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[PatientPortal] Diagnoses error:', err);
    res.status(500).json({ error: 'Failed to fetch diagnoses' });
  }
};

/**
 * GET /me/appointments
 * Get all appointments for the patient (paginated)
 */
exports.getAppointments = async (req, res) => {
  try {
    const patientId = req.patient.id;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE pa.patient_id = :patientId';
    const replacements = { patientId, limit: parseInt(limit), offset };

    if (status) {
      whereClause += ' AND pa.status = :status';
      replacements.status = status;
    }

    // Try the new patient_appointments table first, fall back to legacy appointments
    let appointments;
    try {
      appointments = await sequelize.query(`
        SELECT pa.*,
               s.first_name AS doctor_first_name, s.last_name AS doctor_last_name,
               d.name AS department_name,
               i.name AS institution_name
        FROM patient_appointments pa
        LEFT JOIN staffs s ON s.id = pa.doctor_id
        LEFT JOIN departments d ON d.id = pa.department_id
        LEFT JOIN institutions i ON i.id = pa.institution_id
        ${whereClause}
        ORDER BY pa.appointment_date DESC, pa.appointment_time DESC
        LIMIT :limit OFFSET :offset
      `, { replacements, type: QueryTypes.SELECT });

      const [countResult] = await sequelize.query(`
        SELECT COUNT(*) AS total FROM patient_appointments pa ${whereClause}
      `, { replacements: { patientId, status }, type: QueryTypes.SELECT });

      res.json({
        data: appointments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.total),
          totalPages: Math.ceil(countResult.total / parseInt(limit)),
        },
      });
    } catch (_) {
      // Table may not exist yet — fall back to legacy appointments table
      appointments = await sequelize.query(`
        SELECT a.*,
               s.first_name AS doctor_first_name, s.last_name AS doctor_last_name,
               i.name AS institution_name
        FROM appointments a
        INNER JOIN visits v ON v.id = a.visit_id
        INNER JOIN patients p ON p.id = v.patient_id
        LEFT JOIN staffs s ON s.id = a.staff_id
        LEFT JOIN institutions i ON i.id = a.institution_id
        WHERE p.id = :patientId
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
        LIMIT :limit OFFSET :offset
      `, { replacements: { patientId, limit: parseInt(limit), offset }, type: QueryTypes.SELECT });

      const [countResult] = await sequelize.query(`
        SELECT COUNT(*) AS total
        FROM appointments a
        INNER JOIN visits v ON v.id = a.visit_id
        INNER JOIN patients p ON p.id = v.patient_id
        WHERE p.id = :patientId
      `, { replacements: { patientId }, type: QueryTypes.SELECT });

      res.json({
        data: appointments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.total),
          totalPages: Math.ceil(countResult.total / parseInt(limit)),
        },
      });
    }
  } catch (err) {
    console.error('[PatientPortal] Appointments error:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

/**
 * GET /me/billing
 * Get billing summary for the patient
 */
exports.getBilling = async (req, res) => {
  try {
    const patientId = req.patient.id;

    // Service bills
    const bills = await sequelize.query(`
      SELECT sb.*, v.id AS visit_id, v.created_at AS visit_date
      FROM service_bills sb
      LEFT JOIN visits v ON sb.visit_id = v.id
      WHERE sb.patient_id = :patientId
      ORDER BY sb.created_at DESC
    `, { replacements: { patientId }, type: QueryTypes.SELECT });

    // Summary
    const [summary] = await sequelize.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS total_billed,
        COALESCE(SUM(patient_amount), 0) AS patient_responsible,
        COALESCE(SUM(paid_amount), 0) AS total_paid,
        COALESCE(SUM(total_amount) - SUM(paid_amount), 0) AS total_due
      FROM service_bills
      WHERE patient_id = :patientId
    `, { replacements: { patientId }, type: QueryTypes.SELECT });

    res.json({
      bills,
      summary: {
        total_billed: parseFloat(summary.total_billed) || 0,
        patient_responsible: parseFloat(summary.patient_responsible) || 0,
        total_paid: parseFloat(summary.total_paid) || 0,
        total_due: parseFloat(summary.total_due) || 0,
      },
    });
  } catch (err) {
    console.error('[PatientPortal] Billing error:', err);
    res.status(500).json({ error: 'Failed to fetch billing' });
  }
};
