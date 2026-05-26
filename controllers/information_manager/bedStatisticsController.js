const { fn, col, literal, Op } = require("sequelize");
const Bed = require("../../models/beds");
const Department = require("../../models/department");
const Institution = require("../../models/institution");
const Patient = require("../../models/patient");
const Visit = require("../../models/Visit");
// const Bed = require("../models/bed");
// const Department = require("../models/department");
// const Institution = require("../models/institution");
// const Visit = require("../models/visit");
// const Patient = require("../models/patient");

const bedStatisticsController = {
  getBedStatistics: async (req, res) => {
    try {
      const { department_id } = req.query;

      // Filter condition
      const whereCondition = {};
      if (department_id) {
        whereCondition.department_id = department_id;
      }

      // 1. Total Beds
      const totalBeds = await Bed.count({ where: whereCondition });

      // 2. Status counts
      const statusCounts = await Bed.findAll({
        where: whereCondition,
        attributes: ["status", [fn("COUNT", col("status")), "count"]],
        group: ["status"],
        raw: true,
      });

      // 3. Occupancy Rate
      const occupiedCount =
        statusCounts.find((s) => s.status === "occupied")?.count || 0;
      const occupancyRate =
        totalBeds > 0 ? (occupiedCount / totalBeds) * 100 : 0;

      // 4. Department-wise stats (only if department_id not passed)
      let departmentStats = [];
      if (!department_id) {
        departmentStats = await Bed.findAll({
          attributes: [
            [col("department.name"), "department"],
            "status",
            [fn("COUNT", col("Bed.id")), "count"],
          ],
          include: [{ model: Department, as: "department", attributes: [] }],
          group: ["department.name", "status"],
          raw: true,
        });
      }

      // 5. Institution-wise stats
      const institutionStats = await Bed.findAll({
        where: whereCondition,
        attributes: [
          [col("institution.name"), "institution"],
          "status",
          [fn("COUNT", col("Bed.id")), "count"],
        ],
        include: [{ model: Institution, as: "institution", attributes: [] }],
        group: ["institution.name", "status"],
        raw: true,
      });

      // 6. Patients currently occupying beds
      const occupiedBeds = await Bed.findAll({
        where: { ...whereCondition, status: "occupied", is_occupied: true },
        include: [
          {
            model: Visit,
            as: "visit",
            attributes: ["id", "visit_date"],
            include: [{ model: Patient, as: "patient", attributes: ["id", "first_name", "last_name"] }],
          },
          { model: Department, as: "department", attributes: ["id", "name"] },
          { model: Institution, as: "institution", attributes: ["id", "name"] },
        ],
      });

      const patientDetails = occupiedBeds.map((bed) => ({
        bed_number: bed.bed_number,
        department: bed.department?.name,
        institution: bed.institution?.name,
        visit: bed.bed
          ? {
              id: bed.bed.id,
              visit_date: bed.bed.visit_date,
              patient: bed.bed.patient
                ? {
                    id: bed.bed.patient.id,
                    name: `${bed.bed.patient.first_name} ${bed.bed.patient.last_name}`,
                  }
                : null,
            }
          : null,
      }));

      // 7. (Optional) Daily occupancy trend
      const dailyTrend = await Bed.findAll({
        where: whereCondition,
        attributes: [
          [fn("DATE_TRUNC", "day", col("updatedAt")), "day"],
          "status",
          [fn("COUNT", col("Bed.id")), "count"],
        ],
        group: [literal("day"), "status"],
        order: [[literal("day"), "ASC"]],
        raw: true,
      });

      return res.json({
        totalBeds,
        statusCounts,
        occupancyRate: occupancyRate.toFixed(2) + "%",
        departmentStats: department_id ? null : departmentStats,
        institutionStats,
        patientDetails,
        dailyTrend,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  },
};

module.exports = bedStatisticsController;
