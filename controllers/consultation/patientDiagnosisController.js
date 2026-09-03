// patient diagnosis controller here

const { v4: uuidv4 } = require('uuid');
const systemDiagnosis = require("../../models/claims/systemDiagnosis");
const Diagnosis = require("../../models/diagnosis");
const Staff = require("../../models/staff");
const Visit = require("../../models/Visit");
const Patient = require("../../models/patient");
const { addClaimItem,updateClaimTotal  } = require('../../service/claimService')
const sequelize = require('../../config/database');
const { notifyDiagnosisAdded } = require('../../helpers/fcmNotificationHelper');

// Add a new diagnosis
exports.addDiagnosis = async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();

    let { 
      visit_id, 
      institution_id, 
      staff_id, 
      system_diagnosis_ids,
      department_id, 
      chief_complain,
      doctor_evaluation,
      claim_id 
    } = req.body;
    console.log(req.body)

    // Resolve staff_id from auth middleware if not provided or invalid.
    // The frontend may send the User model ID instead of the Staff model ID
    // for unified users — prefer the staffId resolved by eitherAuthOrAdmin.
    // For admins (who have no staff profile), use their admin ID.
    if (!staff_id && req.staffId) {
      staff_id = req.staffId;
    } else if (!staff_id && req.user?.id) {
      staff_id = req.user.id;
    } else if (!staff_id && req.staff?.id) {
      staff_id = req.staff.id;
    } else if (!staff_id && req.admin?.id) {
      staff_id = req.admin.id;
    } else if (!staff_id && req.superAdmin?.id) {
      staff_id = req.superAdmin.id;
    }

    // Resolve institution_id from auth context as fallback
    if (!institution_id) {
      institution_id = req.user?.institution_id || req.admin?.institution_id || null;
    }

    // If institution or department isn't supplied, resolve them from the visit.
    // This makes the endpoint robust regardless of whether the caller is a
    // staff user or an admin (admins have no department_id).
    if (!institution_id || !department_id) {
      const visit = await Visit.findByPk(visit_id, { transaction });
      if (visit) {
        institution_id = institution_id || visit.institution_id;
        department_id = department_id || visit.department_id;
      }
    }

    // Validate required fields
    if (!visit_id || !institution_id || !staff_id || !system_diagnosis_ids || !department_id) {
      if (transaction) await transaction.rollback().catch(() => {});
      return res.status(400).json({ message: "All fields are required.", missing: { visit_id: !!visit_id, institution_id: !!institution_id, staff_id: !!staff_id, system_diagnosis_ids: !!system_diagnosis_ids, department_id: !!department_id } });
    }

    // Generate a shared group ID so multiple diagnoses added together are linked
    const groupId = uuidv4();

    // Get all diagnoses at once for efficiency
    const diagnoses = await systemDiagnosis.findAll({
      where: { id: system_diagnosis_ids },
      transaction
    });

    // Create diagnosis records first
    const createdDiagnoses = await Promise.all(
      system_diagnosis_ids.map(system_diagnosis_id => {
        return Diagnosis.create({
          visit_id,
          institution_id,
          staff_id,
          system_diagnosis_id,
          doctor_evaluation,
          chief_complain,
          department_id,
          diagnosis_group_id: groupId,
        }, { transaction });
      })
    );

    // Then create claim items
    if (claim_id) {
      await Promise.all(
        createdDiagnoses.map(async (diagnosisRecord) => {
          const diagnosis = diagnoses.find(d => d.id === diagnosisRecord.system_diagnosis_id);
          if (diagnosis) {
            await addClaimItem(claim_id, {
              item_type: 'Diagnosis',
              item_id: diagnosisRecord.id,
              description: `${diagnosis.diagnosis_name} (${diagnosis.icd10_code || diagnosis.icd_10_code})`,
              gdrg_code: diagnosis.icd_10_code,
              unit_price: 0,
              quantity: 1,
              nhia_amount: 0,
              amount: 0
            }, transaction);
          }
        })
      );
      
      // await updateClaimTotal(claim_id, transaction);
    }

    await transaction.commit();

    // ── Send FCM push notification (fire-and-forget) ──────────────
    try {
      const visit = await Visit.findByPk(visit_id, {
        include: [{ model: Patient, as: 'patient', attributes: ['id', 'first_name', 'last_name'] }],
      });
      const patientName = visit?.patient
        ? `${visit.patient.first_name || ''} ${visit.patient.last_name || ''}`.trim()
        : 'a patient';

      notifyDiagnosisAdded({
        staff_id,
        department_id,
        institution_id,
        patient_name: patientName,
        visit_id,
      }).catch(() => {}); // don't block response
    } catch (_) {
      // notification failure should not break the diagnosis flow
    }

    return res.status(201).json(createdDiagnoses);
  } catch (error) {
    console.error('Error adding diagnosis:', error);
    if (transaction) await transaction.rollback().catch(() => {});
    return res.status(500).json({ 
      message: "Failed to add diagnosis", 
      error: error.message 
    });
  }
};

exports.getPatientDiagnosis = async (req, res) => {
  try {
    const { visit_id, patient_id, institution_id } = req.query;

    // Accept either visit_id or patient_id — find all diagnoses matching
    const whereClause = {};
    if (visit_id) {
      whereClause.visit_id = visit_id;
    } else if (patient_id) {
      whereClause.patient_id = patient_id;
    } else {
      return res.status(400).json({ error: 'Visit ID or Patient ID is required' });
    }

    // Find the diagnosis records
    const patientDiagnoses = await Diagnosis.findAll({
      where: whereClause,
      include: [
        {
          model: Staff,
          as: 'staff',
          attributes: ['id', 'firstName', 'middleName', 'lastName', 'profile_pic'],
        },
        {
          model: require("../../models/claims/systemDiagnosis"),
          as: 'systemDiagnosis',
          attributes: ['id', 'diagnosis_name', 'icd_10_code'],
        }
      ]
    });

    if (!patientDiagnoses || patientDiagnoses.length === 0) {
      return res.status(404).json({ error: 'No diagnosis records found for this visit.' });
    }

    // Format the response
    const response = patientDiagnoses.map((diagnosis) => ({
      diagnosisId: diagnosis.id,
      diagnosis_name: diagnosis.diagnosis_name || diagnosis.systemDiagnosis?.diagnosis_name || 'Unknown',
      patient_complaints: diagnosis.chief_complain,
      doctors_note: diagnosis.doctor_evaluation,
      department_id: diagnosis.department_id,
      visitId: diagnosis.visit_id,
      diagnosis_group_id: diagnosis.diagnosis_group_id,
      diagnosisDetails: diagnosis.doctor_evaluation,
      createdAt: diagnosis.createdAt,
      updatedAt: diagnosis.updatedAt,
      staff: diagnosis.staff
        ? {
          id: diagnosis.staff.id,
          firstName: diagnosis.staff.firstName,
          middleName: diagnosis.staff.middleName,
          lastName: diagnosis.staff.lastName,
          profilePicture: diagnosis.staff.profile_pic,
        }
        : null,
    }));

    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to get diagnosis.', error: error.message });
  }
};



// Delete a patient diagnosis
exports.deleteDiagnosis = async (req, res) => {
  try {
    const { id } = req.params;

    const diagnosis = await Diagnosis.findByPk(id);
    if (!diagnosis) {
      return res.status(404).json({ message: "Diagnosis not found." });
    }

    await diagnosis.destroy();
    return res.status(200).json({ message: "Diagnosis deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete diagnosis.", error: error.message });
  }
};

// Update a diagnosis
exports.updateDiagnosis = async (req, res) => {
  try {
    const { id } = req.params;
    const { patient_id, institution_id, staff_id, diagnosis_name } = req.body;

    const diagnosis = await Diagnosis.findByPk(id);
    if (!diagnosis) {
      return res.status(404).json({ message: "Diagnosis not found." });
    }

    diagnosis.patient_id = patient_id || diagnosis.patient_id;
    diagnosis.institution_id = institution_id || diagnosis.institution_id;
    diagnosis.staff_id = staff_id || diagnosis.staff_id;
    diagnosis.diagnosis_name = diagnosis_name || diagnosis.diagnosis_name;

    await diagnosis.save();

    return res.status(200).json(diagnosis);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update diagnosis.", error: error.message });
  }
};
