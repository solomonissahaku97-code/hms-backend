// routes/staffFaceRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../utils/multer"); // your multer util
const staffFaceController = require("../controllers/faceController/faceController.controller");



// Staff registers their face (multiple images required)
router.post(
  "/:staffId/register",
  upload.array("faceImages", 10), // up to 10, must send at least 5
  staffFaceController.registerFace
);

// Verify a face against a given staffId
router.post(
  "/:staffId/verify",
  upload.single("faceImage"),
  staffFaceController.verifyStaffFace
);

// Identify a staff member among all staff faces
router.post(
  "/identify",
  upload.single("faceImage"),
  staffFaceController.identifyStaffByFace
);

router.get('/attendance',staffFaceController.getAttendanceByDepartment)

module.exports = router;