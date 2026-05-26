const { Op, Sequelize } = require("sequelize");
const Record = require("../../models/record");
const Department = require("../../models/department");

exports.getRecordStatistics = async (req, res) => {
  try {
    const { institution_id } = req.query;

    if (!institution_id) {
      return res.status(400).json({ success: false, message: "Institution ID is required." });
    }

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Filter condition
    const filter = { institution_id };

    // 1. General Patient Statistics
    const totalPatients = await Record.count({ where: filter });
    const activeRecords = await Record.count({ where: { ...filter, status: "active" } });
    const inactiveRecords = await Record.count({ where: { ...filter, status: { [Op.ne]: "active" } } });
    const inpatientCount = await Record.count({ where: { ...filter, visit_type: "inpatient" } });
    const outpatientCount = await Record.count({ where: { ...filter, visit_type: "outpatient" } });
    const newPatientsToday = await Record.count({ where: { ...filter, createdAt: { [Op.gte]: startOfDay } } });
    const newPatientsMonth = await Record.count({ where: { ...filter, createdAt: { [Op.gte]: startOfMonth } } });

    // 2. Admissions & Status Insights
    const admittedPatients = await Record.count({ where: { ...filter, status: "admitted" } });
    const dischargedPatients = await Record.count({ where: { ...filter, status: "discharged" } });
    const deceasedPatients = await Record.count({ where: { ...filter, status: "deceased" } });
    const stablePatients = await Record.count({ where: { ...filter, condition_status: "stable" } });

    // 3. Departmental Statistics
    const patientsPerDepartment = await Record.findAll({
        attributes: [
          "department_id",
          [Sequelize.fn("COUNT", Sequelize.col("Record.id")), "patient_count"] // ✅ Explicitly reference "Record.id"
        ],
        where: filter,
        group: ["department_id", "department.id"],
        include: [
          {
            model: Department,
            as: "department",
            attributes: ["id", "name"], // ✅ Explicitly include "id" from Department
          },
        ],
      });
      
      

    // 5. Folder & Identification Insights
    const patientsWithNIN = await Record.count({ where: { ...filter, nin_number: { [Op.ne]: null } } });
    const patientsWithoutNIN = await Record.count({ where: { ...filter, nin_number: null } });

    // 6. Trends & Forecasting
    const dailyVisits = await Record.count({ where: { ...filter, createdAt: { [Op.gte]: startOfDay } } });
    const monthlyVisits = await Record.count({ where: { ...filter, createdAt: { [Op.gte]: startOfMonth } } });

    // Send Response
    res.status(200).json({
      success: true,
      statistics: {
        general: {
          totalPatients,
          activeRecords,
          inactiveRecords,
          inpatientCount,
          outpatientCount,
          newPatients: { today: newPatientsToday, thisMonth: newPatientsMonth },
        },
        admissions: {
          admittedPatients,
          dischargedPatients,
          deceasedPatients,
          stablePatients,
        },
        department: { patientsPerDepartment },
        folderInsights: { patientsWithNIN, patientsWithoutNIN },
        trends: { dailyVisits, monthlyVisits },
      },
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
