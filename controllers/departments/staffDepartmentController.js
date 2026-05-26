const StaffDepartment = require("../../models/controls/StaffDepartment");
const Department = require("../../models/department");
const Staff = require("../../models/staff");

// ✅ Add departments to a staff
exports.assignDepartmentsToStaff = async (req, res) => {
  try {
    const { staff_id, department_ids } = req.body; // array of department IDs

    if (!staff_id || !Array.isArray(department_ids)) {
      return res.status(400).json({ success: false, message: "staff_id and department_ids[] are required" });
    }

    // Remove existing assignments (optional, if you want replace instead of add)
    await StaffDepartment.destroy({ where: { staff_id } });

    // Add new ones
    const assignments = department_ids.map(deptId => ({
      staff_id,
      department_id: deptId,
    }));

    await StaffDepartment.bulkCreate(assignments);

    res.json({ success: true, message: "Departments assigned successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get all departments for a staff
exports.getDepartmentsForStaff = async (req, res) => {
  try {
    const { staff_id } = req.params;

    const staff = await StaffDepartment.findAll({
      where: { staff_id },
      include: [
        {
          model: Department,
          as: 'department',
        },
      ],
    });

    // if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });

    res.json({ success: true, data: staff });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Update staff departments (replace old with new)
exports.updateDepartmentsForStaff = async (req, res) => {
  try {
    const { staff_id } = req.params;
    const { department_ids } = req.body;

    if (!Array.isArray(department_ids)) {
      return res.status(400).json({ success: false, message: "department_ids[] required" });
    }

    // Clear old assignments
    await StaffDepartment.destroy({ where: { staff_id } });

    // Insert new ones
    const assignments = department_ids.map(deptId => ({
      staff_id,
      department_id: deptId,
    }));
    await StaffDepartment.bulkCreate(assignments);

    res.json({ success: true, message: "Departments updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Remove a department from a staff
exports.removeDepartmentFromStaff = async (req, res) => {
  try {
    const { staff_id, department_id } = req.params;

    const deleted = await StaffDepartment.destroy({
      where: { staff_id, department_id },
    });

    if (!deleted) return res.status(404).json({ success: false, message: "Assignment not found" });

    res.json({ success: true, message: "Department removed from staff" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
