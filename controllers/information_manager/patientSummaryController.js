// controllers/patientSummaryController.js
const { Op, fn, col, literal } = require("sequelize");
const Visit = require("../../models/Visit");
const Patient = require("../../models/patient");
const Department = require("../../models/department");


const patientSummaryController = {
  // ✅ Get overall inpatient vs outpatient summary + gender breakdown
getInpatientOutpatientSummary: async (req, res) => {
  try {
    // Total counts
    const totalInpatients = await Visit.count({
      where: { admission_date: { [Op.ne]: null } },
    });

    const totalOutpatients = await Visit.count({
      where: { admission_date: null },
    });

    const total = totalInpatients + totalOutpatients;

    // Gender-based summary
    const genderSummary = await Visit.findAll({
      attributes: [
        [col("patient.gender"), "gender"],
        [
          fn("SUM", literal(`CASE WHEN admission_date IS NOT NULL THEN 1 ELSE 0 END`)),
          "inpatients",
        ],
        [
          fn("SUM", literal(`CASE WHEN admission_date IS NULL THEN 1 ELSE 0 END`)),
          "outpatients",
        ],
      ],
      include: [{ model: Patient, as: "patient", attributes: [] }],
      group: ["patient.gender"],
      raw: true,
    });

    // Patients list with calculated age
    const patients = await Patient.findAll({
      attributes: ["id", "first_name", "last_name", "date_of_birth", "gender"],
      raw: true,
    });

    // Function to calculate age from DOB
    const calculateAge = (dob) => {
      const today = new Date();
      const birthDate = new Date(dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    // Age group buckets
    const ageGroups = {
      infants: [],
      children: [],
      youth: [],
      adults: [],
      elderly: [],
    };

    patients.forEach((p) => {
      const age = calculateAge(p.date_of_birth);
      if (age <= 1) ageGroups.infants.push({ ...p, age });
      else if (age >= 2 && age <= 12) ageGroups.children.push({ ...p, age });
      else if (age >= 13 && age <= 24) ageGroups.youth.push({ ...p, age });
      else if (age >= 25 && age <= 59) ageGroups.adults.push({ ...p, age });
      else if (age >= 60) ageGroups.elderly.push({ ...p, age });
    });

    // Merge gender summary with patients
    const genderSummaryWithPatients = genderSummary.map(summary => ({
      ...summary,
      patients: patients.filter(p => p.gender === summary.gender),
    }));

    return res.json({
      totalInpatients,
      totalOutpatients,
      percentageInpatients: total
        ? ((totalInpatients / total) * 100).toFixed(1) + "%"
        : "0%",
      percentageOutpatients: total
        ? ((totalOutpatients / total) * 100).toFixed(1) + "%"
        : "0%",
      genderSummary: genderSummaryWithPatients,
      ageGroups, // <-- NEW: Patients grouped by age categories
    });
  } catch (error) {
    console.error("Error fetching inpatient/outpatient summary:", error);
    return res.status(500).json({ error: error.message });
  }
},


  // ✅ Trend: Inpatients vs Outpatients by month
  getMonthlyInpatientOutpatient: async (req, res) => {
    try {
      const monthlyData = await Visit.findAll({
        attributes: [
          [fn("TO_CHAR", col("visit_date"), "YYYY-MM"), "month"],
          [
            fn(
              "SUM",
              literal(`CASE WHEN admission_date IS NOT NULL THEN 1 ELSE 0 END`)
            ),
            "inpatients",
          ],
          [
            fn(
              "SUM",
              literal(`CASE WHEN admission_date IS NULL THEN 1 ELSE 0 END`)
            ),
            "outpatients",
          ],
        ],
        group: [fn("TO_CHAR", col("visit_date"), "YYYY-MM")],
        order: [[literal("month"), "ASC"]],
        raw: true,
      });

      return res.json(monthlyData);
    } catch (error) {
      console.error("Error fetching monthly inpatient/outpatient data:", error);
      return res.status(500).json({ error: error.message });
    }
  },

  // ✅ Department-level inpatient vs outpatient stats + gender breakdown
  getDepartmentInpatientOutpatient: async (req, res) => {
    try {
      const { department_id } = req.query;

      const whereClause = {};
      if (department_id) {
        whereClause.department_id = department_id;
      }

      const deptStats = await Visit.findAll({
        where: whereClause,
        attributes: [
          "department_id",
          [
            fn(
              "SUM",
              literal(`CASE WHEN admission_date IS NOT NULL THEN 1 ELSE 0 END`)
            ),
            "inpatients",
          ],
          [
            fn(
              "SUM",
              literal(`CASE WHEN admission_date IS NULL THEN 1 ELSE 0 END`)
            ),
            "outpatients",
          ],
        ],
        include: [
          { model: Department, as: "department", attributes: ["id", "name"] },
        ],
        group: ["department_id", "department.id"],
        raw: true,
      });

      return res.json(deptStats);
    } catch (error) {
      console.error("Error fetching department inpatient/outpatient data:", error);
      return res.status(500).json({ error: error.message });
    }
  },
};

module.exports = patientSummaryController;
