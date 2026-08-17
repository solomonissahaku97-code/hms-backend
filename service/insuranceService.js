const { Patient, Insurance, Visit } = require('../models');

/**
 * CANONICAL insurance detection for the whole HMS.
 *
 * A patient is "insured" only when BOTH of the following are true:
 *   1. patient.has_insurance === true
 *   2. the linked insurance record exists AND insurance.insured === true
 *
 * This matches how the data model is written (recordOfficerController sets both
 * flags together) and the semantics already used by the claims pipeline
 * (claimService.isPatientInsured). Every billing/claims/payment path must use
 * this single helper so the same patient produces the same insurance result
 * everywhere.
 */

const isPatientInsuredRecord = (patient) =>
  !!(patient && patient.has_insurance === true
    && patient.insurance && patient.insurance.insured === true);

const isPatientInsured = async (patientId, options = {}) => {
  if (!patientId) return false;
  const patient = await Patient.findByPk(patientId, {
    include: [{ model: Insurance, as: 'insurance' }],
    transaction: options.transaction || undefined,
  });
  return isPatientInsuredRecord(patient);
};

const isPatientInsuredByVisit = async (visitId, options = {}) => {
  if (!visitId) return false;
  const visit = await Visit.findByPk(visitId, {
    attributes: ['id', 'patient_id'],
    transaction: options.transaction || undefined,
  });
  if (!visit) return false;
  return isPatientInsured(visit.patient_id, { transaction: options.transaction || undefined });
};

module.exports = { isPatientInsured, isPatientInsuredByVisit, isPatientInsuredRecord };
