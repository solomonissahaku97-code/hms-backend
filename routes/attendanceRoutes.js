const express = require("express");
const { scanQrCode,getAllAttendance,getStaffAttendance,getAttendanceByDepartment,getAttendanceByDepartmentAndDate } = require("../controllers/attendance/attendance_controller");
const { generateQrCode,getLatestQrCode } = require("../controllers/attendance/qrController");


const router = express.Router();

// Scan QR Code and Log Attendance
router.post("/scan", scanQrCode);
router.post("/generate", generateQrCode);
router.get("/latest", getLatestQrCode);
router.get("/all", getAllAttendance);
router.get("/staff/:staffId", getStaffAttendance);
router.get("/department/:departmentId",getAttendanceByDepartment)
router.get("/department/:departmentId/date/:date", getAttendanceByDepartmentAndDate);



module.exports = router;
