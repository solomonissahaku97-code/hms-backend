const { Claim, ClaimItem, Diagnosis, Visit, Patient, Insurance } = require('../models');
const { generateClaimsReference } = require('./generateFolderNumber');
const Medicine = require('../models/claims/medication');
const Prescription = require('../models/prescription');
const sequelize = require('../config/database');
const LabTestResult = require('../models/lab/LabTestResult');
const LabTestTemplate = require('../models/lab/LabTestTemplate');
const LabInvestigation = require('../models/claims/LabInvestigations');
const Procedure = require('../models/procedure/procedure');

// small helper to safely parse stored floats
const parseData = (v) => parseFloat(v) || 0;


// Determine whether the patient on a given visit is actively insured.
// A patient counts as insured only when the patient flag is set AND the
// linked insurance record is marked insured (covers NHIS / PRIVATE).
const isPatientInsured = async (visitId, transaction) => {
  const visit = await Visit.findByPk(visitId, {
    include: [{ model: Patient, as: 'patient', include: [{ model: Insurance, as: 'insurance' }] }],
    transaction,
  });
  if (!visit || !visit.patient) return false;
  if (!visit.patient.has_insurance) return false;
  return !!(visit.patient.insurance && visit.patient.insurance.insured);
};

// Resolve the visit id that a claim belongs to (used to look up insurance).
const getClaimVisitId = async (claimId, transaction) => {
  const claim = await Claim.findByPk(claimId, { attributes: ['visit_id'], transaction });
  return claim ? claim.visit_id : null;
};

// Core pricing/split logic. Mutates `itemData` in place and returns it.
// Rules:
//   - amount        = unit_price * quantity            (total facility charge)
//   - nhia_amount   = insured & covered ? min(amount, nhia_rate * quantity) : 0
//   - co_payment    = amount - nhia_amount             (patient responsibility)
//   - actual_amount = co_payment                        (amount actually paid by patient)
//   - paid_by_patient = !insured || !covered
const applySplit = (itemData, { insured, covered, nhiaRate = 0 }) => {
  const unitPrice = parseFloat(itemData.unit_price) || 0;
  const quantity = parseInt(itemData.quantity, 10);
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

  const amount = unitPrice * qty;
  const isCovered = covered && parseFloat(nhiaRate) > 0;

  const nhiaAmount = (insured && isCovered)
    ? Math.min(amount, parseFloat(nhiaRate) * qty)
    : 0;

  const coPayment = Math.max(0, amount - nhiaAmount);

  itemData.unit_price = unitPrice;
  itemData.quantity = qty;
  itemData.amount = amount;
  itemData.nhia_amount = nhiaAmount;
  itemData.co_payment = coPayment;
  itemData.actual_amount = coPayment;
  itemData.paid_by_patient = !(insured && isCovered);

  return itemData;
};

const createClaim = async (visitId, transaction) => {
  const existing = await Claim.findOne({
    where: { visit_id: visitId },
    transaction
  });

  if (existing) return existing;

  const claimReference = await generateClaimsReference();

  return await Claim.create({
    visit_id: visitId,
    claim_reference_number: claimReference,
    claim_status: 'Pending',
    submission_date: new Date()
  }, { transaction });
};

const addClaimItem = async (claimId, itemData, transaction) => {
  const claim = await Claim.findByPk(claimId, { transaction });
  if (!claim) throw new Error('Claim not found');

  const visitId = claim.visit_id;
  const insured = await isPatientInsured(visitId, transaction);

  // Type-specific processing
  switch (itemData.item_type) {
    case 'Medication': {
      const prescription = await Prescription.findByPk(itemData.item_id, { transaction });
      if (!prescription) throw new Error('Prescription not found');

      const medication = await Medicine.findByPk(prescription.medication_id, { transaction });
      if (!medication) throw new Error('Medication not found');

      if (!medication.is_nhia_covered) {
        // Not covered by NHIA -> patient pays full market price
        itemData.unit_price = medication.market_price || 0;
        itemData.description = medication.generic_name;
        itemData.quantity = prescription.quantity || 1;
        itemData.gdrg_code = medication.code;
        applySplit(itemData, { insured, covered: false, nhiaRate: 0 });
        break;
      }

      itemData.unit_price = medication.market_price || medication.nhia_price || 0;
      itemData.description = medication.generic_name;
      itemData.quantity = prescription.quantity || 1;
      itemData.gdrg_code = medication.code;
      applySplit(itemData, {
        insured,
        covered: true,
        nhiaRate: medication.nhia_price || 0,
      });
      break;
    }

    case 'LabTest': {
      // First find the lab request/test record
      const labTestResult = await LabTestResult.findOne({
        where: { id: itemData.item_id },
        include: [{
          model: LabTestTemplate,
          as: 'template',
          include: [{
            model: LabInvestigation,
            as: 'lab_tarrif'
          }]
        }],
        transaction
      });

      if (!labTestResult) throw new Error('Lab test request not found');
      if (!labTestResult.template) throw new Error('Lab test template not found');
      if (!labTestResult.template.lab_tarrif) throw new Error('Lab investigation not found');

      const labInvestigation = labTestResult.template.lab_tarrif;

      // Set claim item data from the lab investigation
      itemData.unit_price = labInvestigation.market_price || labInvestigation.tariff_ghc || 0;
      itemData.description = labInvestigation.test_description;
      itemData.gdrg_code = labInvestigation.g_drg_code;
      itemData.quantity = 1;
      applySplit(itemData, {
        insured,
        covered: true,
        nhiaRate: labInvestigation.tariff_ghc || 0,
      });
      break;
    }

    case 'Diagnosis': {
      const diagnosis = await Diagnosis.findByPk(itemData.item_id, { transaction });
      if (!diagnosis) throw new Error('Diagnosis not found!!!!!');

      itemData.unit_price = itemData.unit_price || 0;
      itemData.quantity = itemData.quantity || 1;
      itemData.description = itemData.description || 'Diagnosis Item';
      itemData.gdrg_code = itemData.gdrg_code || null;
      // Diagnosis codes themselves are not priced by NHIA tariff; treat as
      // patient-responsible unless an explicit nhia_amount was provided.
      const providedNhia = parseFloat(itemData.nhia_amount) || 0;
      applySplit(itemData, {
        insured,
        covered: providedNhia > 0,
        nhiaRate: providedNhia,
      });
      break;
    }

    case 'Procedure': {
      let procedure = null;
      if (itemData.item_id) {
        procedure = await Procedure.findByPk(itemData.item_id, { transaction });
        if (!procedure) throw new Error('Procedure not found');
      }

      // Procedure pricing comes from its linked GDRG code (market + nhia rates)
      const gdrg = procedure && procedure.selected_procedure_id
        ? await sequelize.models.GDRGCode?.findByPk(procedure.selected_procedure_id, { transaction })
        : null;

      const marketPrice = gdrg ? (parseFloat(gdrg.market_price) || 0) : (parseFloat(itemData.unit_price) || 0);
      const nhiaPrice = gdrg ? (parseFloat(gdrg.nhia_price) || 0) : 0;

      itemData.unit_price = marketPrice;
      itemData.description = itemData.description || gdrg?.description || procedure?.Procedure?.procedure_name || 'Procedure';
      itemData.gdrg_code = itemData.gdrg_code || gdrg?.code || null;
      itemData.quantity = itemData.quantity || 1;
      applySplit(itemData, { insured, covered: nhiaPrice > 0, nhiaRate: nhiaPrice });
      break;
    }

    // Add cases for other types as needed
    default: {
      // Fallback: use whatever unit_price/quantity the caller supplied
      itemData.quantity = itemData.quantity || 1;
      applySplit(itemData, { insured, covered: false, nhiaRate: 0 });
      break;
    }
  }

  const claimItem = await ClaimItem.create({ ...itemData, claim_id: claimId }, { transaction });
  await updateClaimTotal(claimId, transaction);
  return claimItem;
};

const updateClaimTotal = async (claimId, transaction) => {
  const claim = await Claim.findByPk(claimId, { transaction });
  if (!claim) throw new Error('Claim not found');

  const items = await ClaimItem.findAll({
    where: { claim_id: claimId },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
      [sequelize.fn('SUM', sequelize.col('nhia_amount')), 'total_nhia'],
      [sequelize.fn('SUM', sequelize.col('co_payment')), 'total_copay'],
    ],
    transaction
  });

  const row = items[0] || {};
  const totalAmount = parseFloat(row.get('total_amount')) || 0;
  const totalNhia = parseFloat(row.get('total_nhia')) || 0;
  const totalCopay = parseFloat(row.get('total_copay')) || 0;

  claim.total_amount = totalAmount;
  claim.total_nhia_amount = totalNhia;
  claim.total_patient_amount = totalCopay;
  await claim.save({ transaction });

  return claim;
};

const removeClaimItem = async (claimId, itemId, transaction) => {
  const claimItem = await ClaimItem.findOne({
    where: { id: itemId, claim_id: claimId },
    transaction
  });

  if (!claimItem) throw new Error('Claim item not found');

  await claimItem.destroy({ transaction });
  return await updateClaimTotal(claimId, transaction);
};

// update claim item
const updateClaimItem = async (claimId, itemId, updateData, transaction) => {
  const claim = await Claim.findByPk(claimId, { transaction });
  if (!claim) throw new Error('Claim not found');

  const claimItem = await ClaimItem.findOne({
    where: { id: itemId, claim_id: claimId },
    transaction
  });

  if (!claimItem) throw new Error('Claim item not found');

  const insured = await isPatientInsured(claim.visit_id, transaction);
  let covered = false;
  let nhiaRate = 0;

  // Type-specific processing
  switch (claimItem.item_type) {
    case 'Medication': {
      let prescription = null;
      let medication = null;

      // If they sent a new prescription ID
      if (updateData.item_id) {
        prescription = await Prescription.findByPk(updateData.item_id, { transaction });
        if (!prescription) throw new Error('Prescription not found');

        medication = await Medicine.findByPk(prescription.medication_id, { transaction });
        if (!medication) throw new Error('Medication not found');

        updateData.unit_price = medication.market_price || medication.nhia_price || 0;
        updateData.description = medication.generic_name;
        updateData.gdrg_code = medication.code;
      } else {
        // Fallback: use existing prescription link
        prescription = await Prescription.findByPk(claimItem.item_id, { transaction });
        if (prescription) {
          medication = await Medicine.findByPk(prescription.medication_id, { transaction });
        }
      }

      // Ensure quantity defaults correctly
      if (updateData.quantity === undefined) {
        updateData.quantity = claimItem.quantity;
      }

      const isCovered = medication ? !!medication.is_nhia_covered : false;
      nhiaRate = medication ? (medication.nhia_price || 0) : 0;
      covered = isCovered;

      // ✅ Sync changes back to Prescription model
      if (prescription) {
        await prescription.update(
          {
            quantity: updateData.quantity,
            notes: updateData.notes || prescription.notes,
            dosage: updateData.dosage || prescription.dosage,
            frequency: updateData.frequency || prescription.frequency,
            duration: updateData.duration || prescription.duration,
            status: updateData.status || prescription.status
          },
          { transaction }
        );
      }

      break;
    }

    case 'LabTest': {
      if (updateData.item_id) {
        const labTestResult = await LabTestResult.findOne({
          where: { id: updateData.item_id },
          include: [{
            model: LabTestTemplate,
            as: 'template',
            include: [{
              model: LabInvestigation,
              as: 'lab_tarrif'
            }]
          }],
          transaction
        });

        if (!labTestResult) throw new Error('Lab test request not found');
        if (!labTestResult.template) throw new Error('Lab test template not found');
        if (!labTestResult.template.lab_tarrif) throw new Error('Lab investigation not found');

        const labInvestigation = labTestResult.template.lab_tarrif;
        updateData.unit_price = labInvestigation.market_price || labInvestigation.tariff_ghc || 0;
        updateData.description = labInvestigation.test_description;
        updateData.gdrg_code = labInvestigation.g_drg_code;
        nhiaRate = labInvestigation.tariff_ghc || 0;
        covered = true;
      }
      updateData.quantity = 1; // Lab tests always have quantity 1
      break;
    }

    case 'Diagnosis': {
      if (updateData.item_id) {
        const diagnosis = await Diagnosis.findByPk(updateData.item_id, { transaction });
        if (!diagnosis) throw new Error('Diagnosis not found');

        updateData.description = diagnosis.diagnosis_name;
        updateData.gdrg_code = diagnosis.icd_10_code;
      }

      if (updateData.quantity === undefined) {
        updateData.quantity = claimItem.quantity || 1;
      }

      // If caller didn't provide nhia_amount, keep it from existing record
      if (updateData.nhia_amount === undefined) {
        updateData.nhia_amount = claimItem.nhia_amount || 0;
      }

      // Ensure unit_price is present for correct amount calculation
      if (updateData.unit_price === undefined) {
        updateData.unit_price = claimItem.unit_price || 0;
      }

      nhiaRate = parseFloat(updateData.nhia_amount) || 0;
      covered = nhiaRate > 0;
      break;
    }

    case 'Procedure': {
      if (!updateData.item_id) {
        // keep existing linkage/values if no new procedure id is provided
        break;
      }

      const procedure = await Procedure.findByPk(updateData.item_id, { transaction });
      if (!procedure) throw new Error('Procedure not found');

      const gdrg = procedure.selected_procedure_id
        ? await sequelize.models.GDRGCode?.findByPk(procedure.selected_procedure_id, { transaction })
        : null;

      const marketPrice = gdrg ? (parseFloat(gdrg.market_price) || 0) : parseData(claimItem.unit_price);
      const nhiaPrice = gdrg ? (parseFloat(gdrg.nhia_price) || 0) : 0;

      updateData.unit_price = updateData.unit_price ?? marketPrice;
      updateData.description = updateData.description || gdrg?.description || 'Procedure';
      updateData.gdrg_code = updateData.gdrg_code || gdrg?.code || null;
      updateData.quantity = updateData.quantity || claimItem.quantity || 1;

      nhiaRate = nhiaPrice;
      covered = nhiaPrice > 0;
      break;
    }

    default:
      // For other types, just update with provided data
      if (updateData.quantity === undefined) updateData.quantity = claimItem.quantity || 1;
      if (updateData.unit_price === undefined) updateData.unit_price = claimItem.unit_price || 0;
      nhiaRate = 0;
      covered = false;
      break;
  }

  // Ensure amount / nhia_amount / co_payment / actual_amount are calculated correctly
  applySplit(updateData, { insured, covered, nhiaRate });

  // Update the claim item with the processed data
  await claimItem.update(updateData, { transaction });
  await updateClaimTotal(claimId, transaction);
  return claimItem;
};

module.exports = {
  createClaim,
  addClaimItem,
  updateClaimTotal,
  removeClaimItem,
  updateClaimItem // Fixed typo from updateCliamItem
};
