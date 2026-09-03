const jwt = require('jsonwebtoken');
const config = require('../config/conf');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Patient auth middleware.
 * Verifies JWT → resolves User → resolves Patient via staff_id_code (folder_number).
 * Sets req.patient with the patient record for downstream handlers.
 */
const authenticatePatient = async (req, res, next) => {
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey && serviceKey === config.serviceKey) {
    // Service-to-service call — accept either a users.id (via X-Patient-Id) or
    // a patients.id (via X-Service-Patient-Id). Resolve to the patients row.
    const headerPatientId = req.headers['x-patient-id'] || req.headers['x-service-patient-id'];
    if (!headerPatientId) {
      return res.status(400).json({ error: 'x-patient-id header required for service calls' });
    }

    // Try patients.id first, then fall back to users.id → patients.folder_number
    let patient = null;
    const [byId] = await sequelize.query(
      'SELECT id, first_name, middle_name, last_name, folder_number, phone, email, gender, date_of_birth, institution_id, has_insurance, department_id, created_at FROM patients WHERE id = :id LIMIT 1',
      { replacements: { id: headerPatientId }, type: QueryTypes.SELECT }
    );
    if (byId) {
      patient = byId;
    } else {
      const [user] = await sequelize.query(
        'SELECT id, staff_id_code, user_type, institution_id FROM users WHERE id = :id LIMIT 1',
        { replacements: { id: headerPatientId }, type: QueryTypes.SELECT }
      );
      if (user) {
        const [byFolder] = await sequelize.query(
          'SELECT id, first_name, middle_name, last_name, folder_number, phone, email, gender, date_of_birth, institution_id, has_insurance, department_id, created_at FROM patients WHERE folder_number = :fn LIMIT 1',
          { replacements: { fn: user.staff_id_code }, type: QueryTypes.SELECT }
        );
        patient = byFolder;
      }
    }

    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found' });
    }

    req.patient = patient;
    req.user = { id: headerPatientId, role: 'service' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], config.jwt.secret);
    req.user = decoded;

    // Resolve the user record
    const [user] = await sequelize.query(
      'SELECT id, staff_id_code, user_type, first_name, last_name, phone, email, institution_id FROM users WHERE id = :userId',
      { replacements: { userId: decoded.id }, type: QueryTypes.SELECT }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.user_type !== 'PATIENT') {
      return res.status(403).json({ error: 'Access denied — patient token required' });
    }

    // Resolve patient from folder_number (staff_id_code)
    const [patient] = await sequelize.query(
      'SELECT id, first_name, middle_name, last_name, folder_number, phone, email, gender, date_of_birth, institution_id, has_insurance, department_id, created_at FROM patients WHERE folder_number = :folderNumber',
      { replacements: { folderNumber: user.staff_id_code }, type: QueryTypes.SELECT }
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found' });
    }

    req.patient = patient;
    req.patientUser = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('[PatientAuth] Error:', err);
    res.status(500).json({ error: 'Authentication error' });
  }
};

module.exports = { authenticatePatient };
