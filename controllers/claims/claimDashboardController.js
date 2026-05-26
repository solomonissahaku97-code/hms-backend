// controllers/claimDashboardController.js
const { Op, fn, col, literal } = require("sequelize");
const Claim = require("../../models/claims/claim");
const ClaimItem = require("../../models/claims/claimItem");
const Visit = require("../../models/Visit");
const Patient = require("../../models/patient");
const Staff = require("../../models/staff");

const claimDashboardController = {
  // ✅ 1. Claim Summary Stats
  getClaimSummary: async (req, res) => {
    try {
      const totalClaims = await Claim.count();
      const totalAmount = await Claim.sum("total_amount") || 0;

      const [approved, rejected, pending, submitted] = await Promise.all([
        Claim.count({ where: { claim_status: "Approved" } }),
        Claim.count({ where: { claim_status: "Rejected" } }),
        Claim.count({ where: { claim_status: "Pending" } }),
        Claim.count({ where: { claim_status: "Submitted" } }),
      ]);

      res.json({
        totalClaims,
        totalAmount,
        statusBreakdown: { approved, rejected, pending, submitted },
      });
    } catch (error) {
      console.error("Error in getClaimSummary:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // ✅ 2. Recent Claims (with patient + visit info)
  getRecentClaims: async (req, res) => {
    try {
      const claims = await Claim.findAll({
        include: [
          {
            model: Visit,
            as: "visit",
            include: [{ model: Patient, as: "patient", attributes: ["id", "first_name", "last_name", "gender", "date_of_birth"] }],
          },
          {
            model: ClaimItem,
            as: "items",
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: 10,
      });

      res.json(claims);
    } catch (error) {
      console.error("Error in getRecentClaims:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // ✅ 3. Claim Items Breakdown (by type)
  getClaimItemsBreakdown: async (req, res) => {
    try {
      const breakdown = await ClaimItem.findAll({
        attributes: [
          "item_type",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("amount")), "totalAmount"],
        ],
        group: ["item_type"],
        raw: true,
      });

      res.json(breakdown);
    } catch (error) {
      console.error("Error in getClaimItemsBreakdown:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // ✅ 4. Claims Trend (monthly submissions)
  getMonthlyClaimsTrend: async (req, res) => {
    try {
      const trend = await Claim.findAll({
        attributes: [
          [fn("TO_CHAR", col("createdAt"), "YYYY-MM"), "month"],
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("total_amount")), "amount"],
        ],
        group: [fn("TO_CHAR", col("createdAt"), "YYYY-MM")],
        order: [[literal("month"), "ASC"]],
        raw: true,
      });

      res.json(trend);
    } catch (error) {
      console.error("Error in getMonthlyClaimsTrend:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // ✅ 5. Claim Detail (drill down for a single claim)
  getClaimDetail: async (req, res) => {
    try {
      const { claim_id } = req.params;

      const claim = await Claim.findByPk(claim_id, {
        include: [
          {
            model: Visit,
            as: "visit",
            include: [{ model: Patient, as: "patient" }],
          },
          {
            model: ClaimItem,
            as: "items",
            include: [{ model: Staff, as: "staff", attributes: ["id", "firstName", "lastName"] }],
          },
        ],
      });

      if (!claim) {
        return res.status(404).json({ message: "Claim not found" });
      }

      res.json(claim);
    } catch (error) {
      console.error("Error in getClaimDetail:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = claimDashboardController;
