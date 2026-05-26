// controllers/patientAnalysisController.js
const { Op, fn, col, literal } = require("sequelize");
const Visit = require("../../models/Visit");
const Department = require("../../models/department");

// Patient Analytics Controller
const patientAnalysisController = {
    
  // 1. Total Visits
  getTotalVisits: async (req, res) => {
    try {
      const totalVisits = await Visit.count();
      return res.json({ totalVisits });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  // 2. Visits by Type (OPD, Maternity, etc.)
  getVisitsByType: async (req, res) => {
    try {
      const visits = await Visit.findAll({
        attributes: ["visit_type", [fn("COUNT", col("id")), "count"]],
        group: ["visit_type"],
      });
      return res.json(visits);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  // 3. Admissions vs Outpatient
  getAdmissionStats: async (req, res) => {
    try {
      const admissions = await Visit.count({ where: { on_admission: true } });
      const outpatients = await Visit.count({ where: { on_admission: false } });
      return res.json({ admissions, outpatients });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  // 4. Average Length of Stay (ALOS)
getAverageLengthOfStay: async (req, res) => {
  try {
    const stays = await Visit.findAll({
      where: { 
        admission_date: { [Op.ne]: null }, 
        discharge_date: { [Op.ne]: null } 
      },
      attributes: [
        // Extract days from discharge_date - admission_date
        [literal("AVG(EXTRACT(DAY FROM (discharge_date - admission_date)))"), "averageStay"],
      ],
      raw: true
    });

    return res.json(stays[0] || { averageStay: 0 });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
},


  // 5. Discharge Stats
  getDischargeStats: async (req, res) => {
    try {
      const discharges = await Visit.findAll({
        attributes: ["discharge_type", [fn("COUNT", col("Visit.id")), "count"]],
        where: { discharge_type: { [Op.ne]: null } },
        group: ["discharge_type"],
        raw: true
      });
      return res.json(discharges);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  // 6. Patient Flow Trends (by month)
 // controllers/patientAnalysisController.js
getMonthlyVisits: async (req, res) => {
  try {
    const monthlyVisits = await Visit.findAll({
      attributes: [
        [literal(`TO_CHAR("visit_date", 'YYYY-MM')`), "month"],
        [fn("COUNT", col("Visit.id")), "count"],
      ],
      group: [literal(`TO_CHAR("visit_date", 'YYYY-MM')`)],
      order: [[literal("month"), "ASC"]],
      raw: true
    });

    return res.json(monthlyVisits);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
},


  // 7. Department Load - FIXED VERSION
  getVisitsByDepartment: async (req, res) => {
    try {
      const deptVisits = await Visit.findAll({
        attributes: [
          "department_id", 
          [fn("COUNT", col("Visit.id")), "count"] // Specify Visit.id to avoid ambiguity
        ],
        include: [
          { 
            model: Department, 
            as: "department", 
            attributes: ["id", "name"],
            required: false // Use left join to include visits without departments
          }
        ],
        group: ["department_id", "department.id"], // Include department.id in group by
        raw: false, // Keep as false to get proper instances
        nest: true // Nest the included data
      });

      // Format the response
      const formattedResults = deptVisits.map(visit => ({
        department_id: visit.department_id,
        count: visit.get('count'),
        department: visit.department ? {
          id: visit.department.id,
          name: visit.department.name
        } : null
      }));

      return res.json(formattedResults);
    } catch (error) {
      console.error("Error in getVisitsByDepartment:", error);
      return res.status(500).json({ error: error.message });
    }
  },

  // Alternative simpler version for Department Load
  getVisitsByDepartmentSimple: async (req, res) => {
    try {
      const deptVisits = await Visit.findAll({
        attributes: [
          "department_id", 
          [fn("COUNT", col("id")), "count"]
        ],
        group: ["department_id"],
        raw: true
      });

      // Get department names
      const departmentIds = deptVisits.map(dept => dept.department_id).filter(id => id);
      const departments = await Department.findAll({
        where: { id: departmentIds },
        attributes: ["id", "name"],
        raw: true
      });

      // Combine the data
      const results = deptVisits.map(visit => ({
        department_id: visit.department_id,
        count: visit.count,
        department: departments.find(dept => dept.id === visit.department_id) || null
      }));

      return res.json(results);
    } catch (error) {
      console.error("Error in getVisitsByDepartmentSimple:", error);
      return res.status(500).json({ error: error.message });
    }
  },

    // 9. Get patient visit statistics - FIXED
  getPatientVisitStats: async (req, res) => {
    try {
      const patientStats = await Visit.findAll({
        attributes: [
          [fn('COUNT', col('Visit.id')), 'total_visits'],
          [fn('COUNT', col('patient.id')), 'unique_patients'],
          [literal('AVG(visits_per_patient)'), 'avg_visits_per_patient']
        ],
        include: [{
          model: Patient,
          as: 'patient',
          attributes: [],
          required: true
        }],
        raw: true
      });

      // Get visits per patient distribution
      const visitsPerPatient = await Visit.findAll({
        attributes: [
          'patient_id',
          [fn('COUNT', col('Visit.id')), 'visit_count'] // Specify table name
        ],
        include: [{
          model: Patient,
          as: 'patient',
          attributes: ['first_name', 'last_name'],
          required: true
        }],
        group: ['Visit.patient_id', 'patient.id'], // Specify table name for patient_id
        order: [[literal('visit_count'), 'DESC']],
        limit: 10,
        raw: false,
        nest: true
      });

      return res.json({
        summary: patientStats[0],
        top_patients: visitsPerPatient.map(item => ({
          patient_id: item.patient_id,
          visit_count: item.get('visit_count'),
          patient_name: item.patient ? `${item.patient.first_name} ${item.patient.last_name}` : 'Unknown'
        }))
      });
    } catch (error) {
      console.error("Error in getPatientVisitStats:", error);
      return res.status(500).json({ error: error.message });
    }
  },

};

module.exports = patientAnalysisController;