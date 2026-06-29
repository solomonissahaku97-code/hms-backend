const Attendance = require("../../models/Attendance");
const Department = require("../../models/department");
const QrCode = require("../../models/QrCode");
const Staff = require("../../models/staff");


exports.scanQrCode = async (req, res) => {
  try {
    const { qr_code, staffId } = req.body;

    if (!qr_code || !staffId) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    // Validate QR code
    const qrCode = await QrCode.findOne({ where: { qr_code } });
    if (!qrCode || new Date() > qrCode.expiresAt) {
      return res.status(400).json({ success: false, message: "Invalid/expired QR code" });
    }

    // Get today's date (for querying)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find or create today's attendance record
    let attendance = await Attendance.findOne({
      where: {
        staffId,
        date: today,
      },
    });

    if (!attendance) {
      // First scan (sign-in)
      attendance = await Attendance.create({
        staffId,
        signInTime: new Date(),
        date: today,
      });
      return res.json({ success: true, message: "Sign-in recorded" });
    } else if (!attendance.signOutTime) {
      // Second scan (sign-out)
      attendance.signOutTime = new Date();
      await attendance.save();
      return res.json({ success: true, message: "Sign-out recorded" });
    } else {
      // Already signed in and out
      return res.status(400).json({ 
        success: false, 
        message: "Already signed in and out today" 
      });
    }

  } catch (error) {
    console.error("QR Scan Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAllAttendance = async (req, res) => {
    try {
      const attendanceRecords = await Attendance.findAll({
        order: [["date", "DESC"]], // Order by most recent attendance
        include:[
          {
            model:Staff,
            as:'staff',
            include:[
              {
                model:Department,
                as:'department'
              }
            ]
          }
        ]
      });
  
      return res.json({ success: true, data: attendanceRecords });
    } catch (error) {
      console.error("Fetch Attendance Error:", error);
      res.status(500).json({ success: false, message: "Failed to fetch attendance records" });
    }
  };
  
  // 
  exports.getStaffAttendance = async (req, res) => {
    try {
      const { staffId } = req.params;
  
      if (!staffId) {
        return res.status(400).json({ success: false, message: "Staff ID is required" });
      }
  
      const attendanceRecords = await Attendance.findAll({
        where: { staffId },
        order: [["scannedAt", "DESC"]], // Sort by most recent first
      });
  
      return res.json({ success: true, data: attendanceRecords });
    } catch (error) {
      console.error("Fetch Staff Attendance Error:", error);
      res.status(500).json({ success: false, message: "Failed to fetch attendance records" });
    }
  };
  

  // get all attendance by staff department filter,
exports.getAttendanceByDepartment = async (req, res) => {
    try {
      const { departmentId } = req.params;
  
      if (!departmentId) {
        return res.status(400).json({ success: false, message: "Department ID is required" });
      }
  
      const attendanceRecords = await Attendance.findAll({
        include: [
          {
            model: Staff,
            as: 'staff',
            where: {department_id: departmentId },
            include: [{ model: Department, as: 'department' }]
          }
        ],
      order: [["date"]], // Sort by most recent first
      });
  
      return res.json({ success: true, data: attendanceRecords });
    } catch (error) {
      console.error("Fetch Department Attendance Error:", error);
      res.status(500).json({ success: false, message: "Failed to fetch attendance records" });
    }
  }; 


  // get attendance by department and date range 
exports.getAttendanceByDepartmentAndDate = async (req, res) => {
    try {
      const { departmentId, startDate, endDate } = req.query;
  
      if (!departmentId || !startDate || !endDate) {
        return res.status(400).json({ success: false, message: "Missing required parameters" });
      }
  
      const attendanceRecords = await Attendance.findAll({
        include: [
          {
            model: Staff,
            as: 'staff',
            where: { departmentId },
            include: [{ model: Department, as: 'department' }]
          }
        ],
        where: {
          scannedAt: {
            [Op.between]: [new Date(startDate), new Date(endDate)]
          }
        },
        order: [["date", "DESC"]], // Sort by most recent first
      });
  
      return res.json({ success: true, data: attendanceRecords });
    } catch (error) {
      console.error("Fetch Department Attendance by Date Error:", error);
      res.status(500).json({ success: false, message: "Failed to fetch attendance records" });
    }
  };





