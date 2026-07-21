// patient diagnosis controller here

const { v4: uuidv4 } = require('uuid');
const systemDiagnosis = require("../../models/claims/systemDiagnosis");
const Diagnosis = require("../../models/diagnosis");
const Staff = require("../../models/staff");
const { addClaimItem,updateClaimTotal  } = require('../../service/claimService')
const sequelize = require('../../config/database');

// Add a new diagnosis
exports.addDiagnosis = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { 
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

    // Validate required fields
    if (!visit_id || !institution_id || !staff_id || !system_diagnosis_ids || !department_id) {
      await transaction.rollback();
      return res.status(400).json({ message: "All fields are required." });
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
          console.log( diagnosis.id)
          await addClaimItem(claim_id, {
            item_type: 'Diagnosis',
            item_id: diagnosisRecord.id,
            description: `${diagnosis.diagnosis_name} (${diagnosis.icd10_code})`,
            gdrg_code: diagnosis.icd_10_code,
            unit_price: 0,
            quantity: 1,
            nhia_amount: 0,
            amount: 0
          }, transaction);
        })
      );
      
      // await updateClaimTotal(claim_id, transaction);
    }

    await transaction.commit();
    return res.status(201).json(createdDiagnoses);
  } catch (error) {
    await transaction.rollback();
    console.error('Error adding diagnosis:', error);
    return res.status(500).json({ 
      message: "Failed to add diagnosis", 
      error: error.message 
    });
  }
};

exports.getPatientDiagnosis = async (req, res) => {
  try {
    const { visit_id, institution_id } = req.query;

    if (!visit_id) {
      return res.status(400).json({ error: 'Visit ID is required' });
    }

    // Find the diagnosis records for this visit
    const patientDiagnoses = await Diagnosis.findAll({
      where: { visit_id },
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
