const {
  ClaimItem,
  Claim,
  Prescription,
  LabTestResult,
  Diagnosis,
  Procedure,
} = require("../../models");

const sequelize = require("../../config/database");
const { resolveServiceBillSnapshot } = require("../../service/claimService");

const ClaimItemController = {
  // CREATE
  async create(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const body = { ...req.body };

      // J7: every ClaimItem keeps its visit_id (from the claim when the caller
      // did not supply one).
      if (!body.visit_id && body.claim_id) {
        const claim = await Claim.findByPk(body.claim_id, { transaction });
        if (!claim) {
          await transaction.rollback();
          return res.status(400).json({ error: "Claim not found" });
        }
        body.visit_id = claim.visit_id;
      }

      // J7 + snapshot pricing: when the item has already been billed, link it
      // to the ServiceBill and use the bill's price snapshot (never the current
      // catalog price). Only items with no ServiceBill keep client/catalog
      // pricing.
      if (body.item_id && body.item_type) {
        await resolveServiceBillSnapshot(body, transaction);
      }

      const item = await ClaimItem.create(body, { transaction });

      await ClaimItemController._syncLinkedModel(item, transaction, "create");

      await transaction.commit();
      res.status(201).json(item);
    } catch (error) {
      await transaction.rollback();
      res.status(400).json({ error: error.message });
    }
  },

  // UPDATE (PUT)
  async update(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const item = await ClaimItem.findByPk(id);
      if (!item) return res.status(404).json({ error: "ClaimItem not found" });

      console.log('Claim Itemss', req.body)
      await item.update(req.body, { transaction });


      await ClaimItemController._syncLinkedModel(item, transaction, "update");

      await transaction.commit();
      res.json(item);
    } catch (error) {
      await transaction.rollback();
      res.status(400).json({ error: error.message });
    }
  },

  // PATCH
  async patch(req, res) {
    return ClaimItemController.update(req, res); // same as update
  },

  // DELETE
  async destroy(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const item = await ClaimItem.findByPk(id);
      if (!item) return res.status(404).json({ error: "ClaimItem not found" });

      await item.destroy({ transaction });

      await ClaimItemController._syncLinkedModel(item, transaction, "delete");

      await transaction.commit();
      res.json({ message: "ClaimItem deleted successfully" });
    } catch (error) {
      await transaction.rollback();
      res.status(400).json({ error: error.message });
    }
  },

  // ---- HELPER ----
  async _syncLinkedModel(item, transaction, action) {
    switch (item.item_type) {
      case "Medication": // Prescription
        if (action === "delete") {
          // unlink instead of destroying actual prescription
          await Prescription.update(
            { claim_item_id: null },
            { where: { id: item.item_id }, transaction }
          );
        } else {
          await Prescription.update(
            { claim_item_id: item.id },
            { where: { id: item.item_id }, transaction }
          );
        }
        break;

      case "LabTest":
        if (action === "delete") {
          await LabTestResult.update(
            { claim_item_id: null },
            { where: { id: item.item_id }, transaction }
          );
        } else {
          await LabTestResult.update(
            { claim_item_id: item.id },
            { where: { id: item.item_id }, transaction }
          );
        }
        break;

      case "Diagnosis":
        if (action === "delete") {
          await Diagnosis.update(
            { claim_item_id: null },
            { where: { id: item.item_id }, transaction }
          );
        } else {
          await Diagnosis.update(
            { claim_item_id: item.id },
            { where: { id: item.item_id }, transaction }
          );
        }
        break;

      case "Procedure":
        if (action === "delete") {
          await Procedure.update(
            { claim_item_id: null },
            { where: { id: item.item_id }, transaction }
          );
        } else {
          await Procedure.update(
            { claim_item_id: item.id },
            { where: { id: item.item_id }, transaction }
          );
        }
        break;
    }
  },
};

module.exports = ClaimItemController;
