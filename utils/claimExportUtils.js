const builder = require('xmlbuilder2');
const crypto = require('crypto');

/**
 * NHIA XML generation — NHIA Submission Format.
 *
 * Generates clean, professional XML matching the NHIA claims submission
 * format exactly. No amount/price fields are included per policy.
 *
 * Format:
 *   <claims>
 *     <claim>
 *       <claimID>...</claimID>
 *       <claimCheckCode>...</claimCheckCode>
 *       ...
 *       <medicine>
 *         <medicineCode>...</medicineCode>
 *         <dispensedQty>...</dispensedQty>
 *         <serviceDate>...</serviceDate>
 *         <prescription>
 *           <dose></dose>
 *           <frequency></frequency>
 *           <duration></duration>
 *           <unparsed>...</unparsed>
 *         </prescription>
 *       </medicine>
 *       <principalGDRG>...</principalGDRG>
 *     </claim>
 *   </claims>
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sanitize = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

const formatDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

/** Generate a 5-digit numeric check code for each claim. */
const generateCheckCode = () =>
  String(crypto.randomInt(10000, 99999));

/**
 * Resolve the specialty code from a department.
 * Maps common department names to NHIA specialty codes.
 */
const resolveSpecialtyCode = (department) => {
  if (!department) return '';
  const name = (department.name || '').toUpperCase();
  // Only use the code field if it looks like a real NHIA specialty code (4 chars, not a department_number which starts with #)
  const rawCode = (department.department_number || department.code || '').trim();
  if (rawCode && !rawCode.startsWith('#') && rawCode.length <= 5) return rawCode.toUpperCase();
  if (name.includes('PAEDIAT') || name.includes('PEDIAT')) return 'PAED';
  if (name.includes('MEDIC') || name.includes('INTERNAL')) return 'MEDI';
  if (name.includes('SURGER') || name.includes('SURG')) return 'SURG';
  if (name.includes('GYNAE') || name.includes('GYNEC')) return 'GYNA';
  if (name.includes('OPHT') || name.includes('EYE')) return 'OPHT';
  if (name.includes('ENT') || name.includes('EAR')) return 'ENT0';
  if (name.includes('DENT') || name.includes('DENTAL')) return 'DENT';
  if (name.includes('CONSULT')) return 'OPDC';
  if (name.includes('EMERGEN')) return 'EMER';
  if (name.includes('ORTHOP')) return 'ORTH';
  if (name.includes('UROL')) return 'UROL';
  if (name.includes('NEURO')) return 'NEUR';
  if (name.includes('CARD')) return 'CARI';
  if (name.includes('ONCOL')) return 'ONCO';
  if (name.includes('DERM')) return 'DERM';
  if (name.includes('RADIO')) return 'RADI';
  if (name.includes('PATH') || name.includes('LAB')) return 'PATH';
  if (name.includes('ANAE') || name.includes('ANEST')) return 'ANAE';
  if (name.includes('OBS') || name.includes('OBST')) return 'OBST';
  if (name.includes('PSYCH')) return 'PSYC';
  if (name.includes('REHAB')) return 'REHA';
  if (name.includes('NEPH')) return 'NEPH';
  return '';
};

/**
 * Resolve the physician ID code from staff data.
 */
const resolvePhysicianID = (staff) => {
  if (!staff) return '';
  return staff.staffID || staff.id || '';
};

/**
 * Get the member number from patient data.
 */
const getMemberNo = (patient) => {
  if (!patient) return '';
  // Check insurance table for NHIS number
  if (patient.insurance && patient.insurance.nhis_number) {
    return patient.insurance.nhis_number;
  }
  // Check patient metadata
  if (patient.metadata) {
    try {
      const meta = typeof patient.metadata === 'string'
        ? JSON.parse(patient.metadata)
        : patient.metadata;
      if (meta.nhis_number || meta.nhisNumber) return meta.nhis_number || meta.nhisNumber;
    } catch {}
  }
  // Check patient.nhis_number if it exists
  if (patient.nhis_number) return patient.nhis_number;
  return '';
};

/**
 * Get card serial number from patient data.
 */
const getCardSerialNo = (patient) => {
  if (!patient) return '';
  if (patient.insurance && patient.insurance.card_serial_no) {
    return patient.insurance.card_serial_no;
  }
  return '';
};

/**
 * Get hospital record number from visit data.
 */
const getHospitalRecNo = (visit) => {
  if (!visit) return '';
  // Check visit metadata for hospital record number
  if (visit.metadata) {
    try {
      const meta = typeof visit.metadata === 'string'
        ? JSON.parse(visit.metadata)
        : visit.metadata;
      if (meta.hospital_rec_no) return meta.hospital_rec_no;
    } catch {}
  }
  // Fall back to visit ID short form
  return visit.hospitalRecNo || visit.hospital_rec_no || '';
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate claims before export. Returns array of errors.
 */
const validateClaimsForExport = (claims, institutionId) => {
  const errors = [];

  for (const claim of claims || []) {
    const ref = claim.claim_reference_number || claim.id;
    const visit = claim.visit;

    if (!visit) {
      errors.push({ claim: ref, field: 'visit', message: 'Claim has no visit' });
      continue;
    }
    if (visit.institution_id !== institutionId) {
      errors.push({
        claim: ref,
        field: 'institution',
        message: `Claim belongs to institution ${visit.institution_id}, not ${institutionId}`,
      });
    }
    if (!visit.patient) {
      errors.push({ claim: ref, field: 'patient', message: 'Claim visit has no patient' });
    }
    if (!claim.items || claim.items.length === 0) {
      errors.push({ claim: ref, field: 'claim_items', message: 'Claim has no billable items' });
    }
  }

  return errors;
};

// ---------------------------------------------------------------------------
// Real-data resolvers
// ---------------------------------------------------------------------------

const resolvePrimaryDiagnosis = (visit) => {
  if (!visit || !Array.isArray(visit.diagnosis) || visit.diagnosis.length === 0) return null;
  const confirmed = visit.diagnosis.find((d) => d.diagnosis_type === 'confirmed_diagnosis');
  if (confirmed) return confirmed;
  const provisional = visit.diagnosis.find((d) => d.diagnosis_type === 'provisional_diagnosis');
  return provisional || visit.diagnosis[0];
};

const resolveDiagnosisCode = (diagnosis) =>
  (diagnosis && diagnosis.systemDiagnosis && diagnosis.systemDiagnosis.icd_10_code) || '';

const resolveDiagnosisName = (diagnosis) => {
  if (!diagnosis) return '';
  if (diagnosis.systemDiagnosis && diagnosis.systemDiagnosis.diagnosis_name) {
    return diagnosis.systemDiagnosis.diagnosis_name;
  }
  return diagnosis.doctor_evaluation || diagnosis.chief_complain || '';
};

const resolveGDRGCode = (diagnosis) => {
  if (!diagnosis) return '';
  // Check if there's a linked GDRG code
  if (diagnosis.gdrg_code) return diagnosis.gdrg_code;
  if (diagnosis.systemDiagnosis && diagnosis.systemDiagnosis.gdrg_code) {
    return diagnosis.systemDiagnosis.gdrg_code;
  }
  return '';
};

// ---------------------------------------------------------------------------
// NHIA Medicine Code Resolution
// ---------------------------------------------------------------------------

/**
 * Try to resolve the NHIA medicine code from a claim item's description.
 * This maps the medication name to the NHIA standardized code.
 */
const resolveMedicineCode = (item, nhiaMedications) => {
  if (!item || !nhiaMedications) return '';

  // If the item already has a medicine_code stored
  if (item.medicine_code) return item.medicine_code;

  const description = (item.description || '').toLowerCase();

  // Try exact match by name from NHIA medications table
  for (const med of nhiaMedications) {
    if (med.name && description.includes(med.name.toLowerCase())) {
      return med.code;
    }
  }

  // Try partial match
  for (const med of nhiaMedications) {
    const medName = (med.name || '').toLowerCase().split(' ')[0];
    if (medName && description.includes(medName)) {
      return med.code;
    }
  }

  // Fall back to GDRG code if available
  return item.gdrg_code || '';
};

// ---------------------------------------------------------------------------
// XML generation — NHIA Submission Format
// ---------------------------------------------------------------------------

/**
 * Create NHIA XML in the official submission format.
 *
 * @param {Array} claims - Array of claim objects with includes
 * @param {Object} institution - Institution object
 * @param {Array} nhiaMedications - Optional array of NHIA medication codes for medicine code resolution
 * @returns {string} XML string
 */
exports.createNHISXML = (claims, institution, nhiaMedications = []) => {
  if (!Array.isArray(claims) || claims.length === 0) {
    throw new Error('No claims provided for XML generation');
  }

  // Validate
  const hardErrors = validateClaimsForExport(claims, institution && institution.id);
  if (hardErrors.length > 0) {
    const detail = hardErrors
      .map((e) => `${e.claim} — ${e.message}`)
      .join('; ');
    throw new Error(`Claims missing required data for NHIS export: ${detail}`);
  }

  console.log(`[XML] Generating NHIA XML for ${claims.length} claims`);

  const root = builder.create({ version: '1.0', encoding: 'UTF-8' })
    .ele('claims');

  for (const claim of claims) {
    const visit = claim.visit || {};
    const patient = visit.patient || {};
    const items = claim.items || [];
    const diagnoses = Array.isArray(visit.diagnosis) ? visit.diagnosis : [];
    const department = visit.department || null;

    const claimNode = root.ele('claim');

    // ── Claim Identification ──────────────────────────────────────────
    claimNode.ele('claimID').txt(sanitize(claim.claim_reference_number || claim.id));
    claimNode.ele('claimCheckCode').txt(sanitize(claim.claim_check_code || generateCheckCode()));
    claimNode.ele('preAuthorizationCodes').txt(sanitize(claim.pre_authorization_codes || '123456'));

    // ── Physician ─────────────────────────────────────────────────────
    const primaryDiagnosis = resolvePrimaryDiagnosis(visit);
    const providerStaff = (primaryDiagnosis && primaryDiagnosis.staff) || null;
    claimNode.ele('physicianID').txt(sanitize(resolvePhysicianID(providerStaff)));

    // ── Patient Information ───────────────────────────────────────────
    claimNode.ele('memberNo').txt(sanitize(getMemberNo(patient)));
    claimNode.ele('cardSerialNo').txt(sanitize(getCardSerialNo(patient)));
    claimNode.ele('surname').txt(sanitize(patient.last_name || patient.surname || ''));
    claimNode.ele('otherNames').txt(sanitize(
      `${patient.first_name || ''} ${patient.middle_name || ''}`.trim()
    ));
    claimNode.ele('dateOfBirth').txt(formatDate(patient.date_of_birth));
    claimNode.ele('gender').txt(sanitize(
      patient.gender ? patient.gender.charAt(0).toUpperCase() : ''
    ));
    claimNode.ele('hospitalRecNo').txt(sanitize(getHospitalRecNo(visit)));
    claimNode.ele('isDependant').txt(sanitize(claim.is_dependant || '0'));

    // ── Service Details ───────────────────────────────────────────────
    const isIPD = visit.on_admission === true;
    claimNode.ele('typeOfService').txt(isIPD ? 'IPD' : 'OPD');
    claimNode.ele('isUnbundled').txt('0');
    claimNode.ele('includesPharmacy').txt(
      items.some((i) => i.item_type === 'Medication') ? '1' : '0'
    );
    claimNode.ele('typeOfAttendance').txt(sanitize(claim.type_of_attendance || 'EAE'));
    claimNode.ele('serviceOutcome').txt(sanitize(claim.service_outcome || 'DISC'));

    // ── Dates of Service (multiple entries possible) ──────────────────
    const admissionDate = formatDate(visit.visit_date || visit.admission_date || visit.createdAt);
    const dischargeDate = formatDate(visit.discharge_date || visit.visit_date || visit.createdAt);
    if (admissionDate) claimNode.ele('dateOfService').txt(admissionDate);
    if (dischargeDate && dischargeDate !== admissionDate) {
      claimNode.ele('dateOfService').txt(dischargeDate);
    }

    // ── Specialties Attended (multiple entries possible) ──────────────
    const specialty = resolveSpecialtyCode(department);
    if (specialty) claimNode.ele('specialtyAttended').txt(specialty);
    // Add OPDC for outpatient consultations if specialty is different
    if (!isIPD && specialty !== 'OPDC') {
      claimNode.ele('specialtyAttended').txt('OPDC');
    }

    // ── Diagnoses ─────────────────────────────────────────────────────
    if (diagnoses.length > 0) {
      for (const diag of diagnoses) {
        const diagNode = claimNode.ele('diagnosis');
        diagNode.ele('gdrgCode').txt(sanitize(resolveGDRGCode(diag)));
        diagNode.ele('icd10').txt(sanitize(resolveDiagnosisCode(diag)));
        diagNode.ele('diagnosis').txt(sanitize(resolveDiagnosisName(diag)));
      }
    } else if (primaryDiagnosis) {
      const diagNode = claimNode.ele('diagnosis');
      diagNode.ele('gdrgCode').txt(sanitize(resolveGDRGCode(primaryDiagnosis)));
      diagNode.ele('icd10').txt(sanitize(resolveDiagnosisCode(primaryDiagnosis)));
      diagNode.ele('diagnosis').txt(sanitize(resolveDiagnosisName(primaryDiagnosis)));
    }

    // ── Medicines (no amount fields) ──────────────────────────────────
    const medicationItems = items.filter((i) => i.item_type === 'Medication');
    for (const item of medicationItems) {
      const medNode = claimNode.ele('medicine');
      medNode.ele('medicineCode').txt(sanitize(
        resolveMedicineCode(item, nhiaMedications)
      ));
      medNode.ele('dispensedQty').txt(sanitize(item.quantity || 1));
      medNode.ele('serviceDate').txt(formatDate(item.date_performed || visit.visit_date));

      const prescriptionNode = medNode.ele('prescription');
      prescriptionNode.ele('dose').txt('');
      prescriptionNode.ele('frequency').txt('');
      prescriptionNode.ele('duration').txt('');
      prescriptionNode.ele('unparsed').txt(sanitize(item.description || ''));
    }

    // ── Principal GDRG ────────────────────────────────────────────────
    claimNode.ele('principalGDRG').txt(sanitize(
      resolveGDRGCode(primaryDiagnosis)
    ));
  }

  const xmlResult = root.end({ prettyPrint: true });
  console.log(`[XML] Generation complete, size: ${xmlResult.length} bytes`);
  return xmlResult;
};

exports.validateClaimsForExport = validateClaimsForExport;
exports.resolvePrimaryDiagnosis = resolvePrimaryDiagnosis;
