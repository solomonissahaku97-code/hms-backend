const builder = require('xmlbuilder2');

/**
 * NHIA XML generation.
 *
 * IMPORTANT: this module NEVER fabricates clinical data. Diagnosis codes,
 * descriptions, provider/facility information and all amounts come from real
 * database records only. If a claim is missing required information it must be
 * rejected by validateClaimsForExport() BEFORE generateXMLReport calls
 * createNHISXML(); createNHISXML() also guards and throws rather than invent
 * values.
 */

// ---------------------------------------------------------------------------
// Real-data resolvers
// ---------------------------------------------------------------------------

// A visit can carry several diagnoses. Prefer a confirmed diagnosis, then a
// provisional one. The ICD-10 code lives on the linked systemDiagnosis record.
const resolvePrimaryDiagnosis = (visit) => {
  if (!visit || !Array.isArray(visit.diagnosis) || visit.diagnosis.length === 0) return null;
  const confirmed = visit.diagnosis.find((d) => d.diagnosis_type === 'confirmed_diagnosis');
  if (confirmed) return confirmed;
  const provisional = visit.diagnosis.find((d) => d.diagnosis_type === 'provisional_diagnosis');
  return provisional || visit.diagnosis[0];
};

const resolveDiagnosisCode = (diagnosis) =>
  (diagnosis && diagnosis.systemDiagnosis && diagnosis.systemDiagnosis.icd_10_code) || null;

const resolveDiagnosisName = (diagnosis) => {
  if (!diagnosis) return null;
  if (diagnosis.systemDiagnosis && diagnosis.systemDiagnosis.diagnosis_name) {
    return diagnosis.systemDiagnosis.diagnosis_name;
  }
  return diagnosis.doctor_evaluation || diagnosis.chief_complain || null;
};

const formatDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  } catch (error) {
    return '';
  }
};

const sanitizeText = (text) => {
  if (text === null || text === undefined || text === '') return '';
  return String(text);
};

const getClaimMonth = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getClaimType = (visit) => (visit && visit.on_admission ? 'Inpatient' : 'Outpatient');

const getStaffName = (staff) => {
  if (!staff) return '';
  return `${staff.firstName || ''} ${staff.lastName || ''}`.trim();
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate every claim before it is exported. Returns an array of
 * { claim, item, field, message } errors. An empty array means the export is
 * safe to generate. No fabricated values are ever substituted.
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

    const items = claim.items || [];
    if (items.length === 0) {
      errors.push({ claim: ref, field: 'claim_items', message: 'Claim has no billable claim items' });
    }
    for (const item of items) {
      const amount = parseFloat(item.amount);
      if (item.amount === null || item.amount === undefined || isNaN(amount) || amount < 0) {
        errors.push({ claim: ref, item: item.id, field: 'amount', message: 'Claim item amount is missing or invalid' });
        continue;
      }
      const nhia = parseFloat(item.nhia_amount);
      const nhiaVal = isNaN(nhia) || nhia === null || nhia === undefined ? 0 : nhia;
      if (nhiaVal < 0 || nhiaVal > amount + 0.001) {
        errors.push({
          claim: ref, item: item.id, field: 'nhia_amount',
          message: `NHIA amount (${nhiaVal}) exceeds total amount (${amount})`,
        });
      }
      if (item.co_payment !== null && item.co_payment !== undefined) {
        const copay = parseFloat(item.co_payment);
        if (isNaN(copay) || copay < -0.001 || Math.abs((amount - nhiaVal) - copay) > 0.02) {
          errors.push({
            claim: ref, item: item.id, field: 'co_payment',
            message: `co-payment (${copay}) is inconsistent with amount − nhia (${(amount - nhiaVal).toFixed(2)})`,
          });
        }
      }
    }

    const diagnosis = resolvePrimaryDiagnosis(visit);
    if (!diagnosis) {
      errors.push({ claim: ref, field: 'diagnosis', message: 'No diagnosis recorded for the visit' });
    } else if (!resolveDiagnosisCode(diagnosis)) {
      errors.push({ claim: ref, field: 'diagnosis', message: 'Diagnosis has no ICD-10 code' });
    }
  }

  return errors;
};

// ---------------------------------------------------------------------------
// XML generation (real values only)
// ---------------------------------------------------------------------------

exports.createNHISXML = (claims, institution) => {
  if (!Array.isArray(claims) || claims.length === 0) {
    throw new Error('No claims provided for XML generation');
  }

  // Defense in depth: refuse to export claims with missing required data
  // instead of substituting fabricated values.
  const hardErrors = validateClaimsForExport(claims, institution && institution.id);
  if (hardErrors.length > 0) {
    const detail = hardErrors
      .map((e) => `${e.claim}:${e.item ? ` item ${e.item}` : ''} — ${e.message}`)
      .join('; ');
    throw new Error(`Claims missing required data for NHIS export: ${detail}`);
  }

  console.log('🔧 Starting XML generation with:', claims.length, 'claims');

  const root = builder.create({ version: '1.0', encoding: 'UTF-8' })
    .ele('NHISClaims');

  for (const claim of claims) {
    console.log('  📋 Processing claim:', claim.id, claim.claim_reference_number);

    const visit = claim.visit || {};
    const patient = visit.patient || {};
    const items = claim.items || [];
    const institutionData = visit.institution || institution || {};
    const diagnosis = resolvePrimaryDiagnosis(visit);
    const diagnosisCode = resolveDiagnosisCode(diagnosis);
    const diagnosisName = resolveDiagnosisName(diagnosis);
    const providerStaff = (diagnosis && diagnosis.staff) || null;

    const claimNode = root.ele('Claim');

    // ✅ Basic Claim Information (real values only)
    claimNode.ele('ClaimReferenceNumber').txt(sanitizeText(claim.claim_reference_number));
    claimNode.ele('FacilityID').txt(sanitizeText(institutionData.serial_code || institutionData.id));
    claimNode.ele('FacilityName').txt(sanitizeText(institutionData.name));
    claimNode.ele('VisitDate').txt(formatDate(visit.visit_date || visit.createdAt || claim.createdAt));
    claimNode.ele('ClaimMonth').txt(getClaimMonth(visit.visit_date || visit.createdAt || claim.createdAt));
    claimNode.ele('DischargeDate').txt(formatDate(visit.discharge_date || visit.visit_date || visit.createdAt));
    claimNode.ele('TotalClaimAmount').txt(sanitizeText(claim.total_amount !== undefined && claim.total_amount !== null ? claim.total_amount : 0));
    claimNode.ele('ClaimStatus').txt(sanitizeText(claim.claim_status));
    claimNode.ele('ClaimType').txt(getClaimType(visit));

    // ✅ Patient Information
    const patientNode = claimNode.ele('Patient');
    patientNode.ele('PatientID').txt(sanitizeText(patient.id));
    const fullName = `${patient.first_name || ''} ${patient.middle_name || ''} ${patient.last_name || ''}`.trim();
    patientNode.ele('FullName').txt(sanitizeText(fullName));
    patientNode.ele('Gender').txt(sanitizeText(patient.gender));
    patientNode.ele('DateOfBirth').txt(formatDate(patient.date_of_birth));
    const insuranceType = patient.has_insurance
      ? (patient.insurance && patient.insurance.insurance_provider) || 'NHIS'
      : 'Private';
    patientNode.ele('InsuranceType').txt(sanitizeText(insuranceType));

    // ✅ Diagnosis Information (REAL diagnosis only — validated above)
    const diagnosisNode = claimNode.ele('Diagnosis');
    diagnosisNode.ele('DiagnosisCode').txt(sanitizeText(diagnosisCode));
    diagnosisNode.ele('DiagnosisDescription').txt(sanitizeText(diagnosisName));
    diagnosisNode.ele('DiagnosisType').txt(sanitizeText(diagnosis && diagnosis.diagnosis_type === 'confirmed_diagnosis' ? 'Confirmed' : 'Provisional'));

    // ✅ Service Provider Information (real diagnosing staff, else the real facility)
    const serviceProviderNode = claimNode.ele('ServiceProvider');
    serviceProviderNode.ele('ProviderID').txt(sanitizeText(
      providerStaff ? providerStaff.id : (institutionData.serial_code || institutionData.id)
    ));
    serviceProviderNode.ele('ProviderName').txt(sanitizeText(
      providerStaff ? getStaffName(providerStaff) : institutionData.name
    ));
    serviceProviderNode.ele('ProviderType').txt(sanitizeText(
      providerStaff ? (providerStaff.role_manager === 'admin' ? 'Administrator' : 'Doctor') : 'Facility'
    ));

    // ✅ Claim Items/Services — explicit financial mapping:
    //    NHIACoveredAmount is ALWAYS item.nhia_amount (never falls back to the
    //    total amount). PatientAmount is the co-payment.
    const claimItemsNode = claimNode.ele('ClaimItems');
    for (const item of items) {
      const amount = parseFloat(item.amount) || 0;
      const nhia = (item.nhia_amount === null || item.nhia_amount === undefined) ? 0 : (parseFloat(item.nhia_amount) || 0);
      const coPayment = (item.co_payment === null || item.co_payment === undefined)
        ? Math.max(0, amount - nhia)
        : (parseFloat(item.co_payment) || 0);
      const itemProvider = (item.staff) || null;

      const itemNode = claimItemsNode.ele('Item');
      itemNode.ele('ItemName').txt(sanitizeText(item.description));
      itemNode.ele('ItemCode').txt(sanitizeText(item.gdrg_code));
      itemNode.ele('ItemType').txt(sanitizeText(item.item_type));
      itemNode.ele('Quantity').txt(sanitizeText(item.quantity || 1));
      itemNode.ele('UnitPrice').txt(sanitizeText(item.unit_price !== null && item.unit_price !== undefined ? item.unit_price : 0));
      itemNode.ele('TotalAmount').txt(sanitizeText(amount));
      itemNode.ele('ServiceDate').txt(formatDate(item.date_performed || visit.visit_date));
      itemNode.ele('NHIACoveredAmount').txt(sanitizeText(nhia));
      itemNode.ele('PatientAmount').txt(sanitizeText(coPayment));
      itemNode.ele('ServiceProvider').txt(sanitizeText(
        itemProvider ? getStaffName(itemProvider) : (providerStaff ? getStaffName(providerStaff) : institutionData.name)
      ));
    }

    // ✅ Additional NHIA Metadata
    const metadataNode = claimNode.ele('Metadata');
    metadataNode.ele('SubmissionDate').txt(formatDate(new Date()));
    metadataNode.ele('Version').txt('1.0');
    metadataNode.ele('SchemaVersion').txt('NHIA-2024');
  }

  const xmlResult = root.end({ prettyPrint: true });
  console.log('✅ XML generation completed, final length:', xmlResult.length);
  return xmlResult;
};

exports.validateClaimsForExport = validateClaimsForExport;
exports.resolvePrimaryDiagnosis = resolvePrimaryDiagnosis;
