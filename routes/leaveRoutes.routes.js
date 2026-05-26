const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/hr_controller/leaveController");
const eitherAuthOrAdmin = require("../middlewares/eitherAuthOrAdminMiddleware");

// Staff routes - require authentication
router.post("/request", eitherAuthOrAdmin, leaveController.requestLeave);
router.put("/update/:leaveId", eitherAuthOrAdmin, leaveController.updateLeave);
router.put("/cancel/:leaveId", eitherAuthOrAdmin, leaveController.cancelLeave);
router.get("/my-leaves", eitherAuthOrAdmin, leaveController.myLeaves);
router.get("/balance", eitherAuthOrAdmin, leaveController.getLeaveBalance);

// Admin routes - require admin authentication
router.put("/review/:leaveId", eitherAuthOrAdmin, leaveController.reviewLeave);
router.get("/all", eitherAuthOrAdmin, leaveController.getAllLeaves);

module.exports = router;
