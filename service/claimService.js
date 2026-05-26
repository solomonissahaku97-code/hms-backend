const { Claim, ClaimItem, Diagnosis } = require('../models');
const { generateClaimsReference } = require('./generateFolderNumber');
const Medicine = require('../models/claims/medication');
const Prescription = require('../models/prescription');
const sequelize = require('../config/database');
const LabTestResult = require('../models/lab/LabTestResult');
const LabTestTemplate = require('../models/lab/LabTestTemplate');
const LabInvestigation = require('../models/claims/LabInvestigations');
const Procedure = require('../models/procedure/procedure');


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

  // Type-specific processing
  switch (itemData.item_type) {
    case 'Medication':
      const prescription = await Prescription.findByPk(itemData.item_id, { transaction });
      if (!prescription) throw new Error('Prescription not found');

      const medication = await Medicine.findByPk(prescription.medication_id, { transaction });
      if (!medication) throw new Error('Medication not found');

      if (!medication.is_nhia_covered) return;

      itemData.unit_price = medication.market_price || medication.price_ghc || 0;
      itemData.description = medication.generic_name;
      itemData.quantity = prescription.quantity || 1;
      itemData.gdrg_code = medication.code;
      itemData.amount = itemData.unit_price * itemData.quantity;
      itemData.nhia_amount = Math.min(itemData.amount, medication.nhia_price || 0);
      break;

    case 'LabTest':
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
      itemData.unit_price = labInvestigation.tariff_ghc || 0;
      itemData.description = labInvestigation.test_description;
      itemData.gdrg_code = labInvestigation.g_drg_code;
      itemData.quantity = 1;
      itemData.amount = itemData.unit_price * itemData.quantity;
      itemData.nhia_amount = Math.min(itemData.amount, labInvestigation.nhia_price || 0);
      break;

    case 'Diagnosis':

      const diagnosis = await Diagnosis.findByPk(itemData.item_id, { transaction });
      if (!diagnosis) throw new Error('Diagnosis not found!!!!!');

      itemData.unit_price = itemData.unit_price || 0;
      itemData.quantity = itemData.quantity || 1;
      itemData.amount = itemData.unit_price * itemData.quantity;
      itemData.nhia_amount = Math.min(itemData.amount, itemData.nhia_amount || 0);
      itemData.gdrg_code = itemData.gdrg_code || null;
      itemData.description = itemData.description || 'Diagnosis Item';

      break;

    // Add cases for other types as needed
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
    attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']],
    transaction
  });

  const totalAmount = items[0]?.get('total_amount') || 0;
  claim.total_amount = totalAmount;
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
  const claimItem = await ClaimItem.findOne({
    where: { id: itemId, claim_id: claimId },
    transaction
  });

  if (!claimItem) throw new Error('Claim item not found');

  // Type-specific processing
  switch (claimItem.item_type) {
    case 'Medication':
      let prescription = null;

      // If they sent a new prescription ID
      if (updateData.item_id) {
        prescription = await Prescription.findByPk(updateData.item_id, { transaction });
        if (!prescription) throw new Error('Prescription not found');

        const medication = await Medicine.findByPk(prescription.medication_id, { transaction });
        if (!medication) throw new Error('Medication not found');

        updateData.unit_price = medication.price_ghc;
        updateData.description = medication.generic_name;
        updateData.gdrg_code = medication.code;
      } else {
        // Fallback: use existing prescription link
        prescription = await Prescription.findByPk(claimItem.item_id, { transaction });
      }

      // Ensure quantity defaults correctly
      if (updateData.quantity === undefined) {
        updateData.quantity = claimItem.quantity;
      }

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

    case 'LabTest':
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
        updateData.unit_price = labInvestigation.tariff_ghc;
        updateData.description = labInvestigation.test_description;
        updateData.gdrg_code = labInvestigation.g_drg_code;
      }
      updateData.quantity = 1; // Lab tests always have quantity 1
      break;

    case 'Diagnosis':
      if (updateData.item_id) {
        const diagnosis = await Diagnosis.findByPk(updateData.item_id, { transaction });
        if (!diagnosis) throw new Error('Diagnosis not found');

        updateData.description = diagnosis.diagnosis_name;
        updateData.gdrg_code = diagnosis.icd_10_code;

        diagnosis.medication_id = updateData.item_id
      }
      if (updateData.quantity === undefined) {
        updateData.quantity = 1; // Diagnosis items default to quantity 1
      }
      break;

    case 'Procedure':
      const procedure = await Procedure.findByPk(itemData.item_id, { transaction });
      if (!procedure) throw new Error('Procedure not found');

      itemData.unit_price = procedure.price_ghc || 0;
      itemData.description = procedure.procedure_name || 'Procedure';
      itemData.gdrg_code = procedure.procedure_code || null;
      itemData.quantity = itemData.quantity || 1;
      itemData.amount = itemData.unit_price * itemData.quantity;
      itemData.nhia_amount = Math.min(itemData.amount, procedure.nhia_price || 0);
      break;

    default:
      // For other types, just update with provided data
      break;
  }

  // Ensure amount and nhia_amount are calculated correctly after update
  const totalItemAmount = (updateData.unit_price || claimItem.unit_price || 0) * (updateData.quantity || claimItem.quantity || 1);
  updateData.amount = totalItemAmount;
  updateData.nhia_amount = Math.min(totalItemAmount, updateData.nhia_amount || claimItem.nhia_amount || 0);
  
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