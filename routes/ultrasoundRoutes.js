// routes/maternity/ultrasoundRoutes.js
const express = require("express");
const router = express.Router();
const ultrasoundController = require("../controllers/maternity/ultrasound.controller");
// import authentication middleware if needed
const eitherAuthOrAdminMiddleware = require("../middlewares/eitherAuthOrAdminMiddleware");
// import multer middleware if handling file uploads
const {upload} = require("../middlewares/profile_multer");

// Middleware to handle multiple file uploads (e.g., images)
const uploadMultiple = upload.array('images', 5); // Adjust 'images' and max count as needed
// Apply authentication middleware to all routes
router.use(eitherAuthOrAdminMiddleware);



router.post("/", uploadMultiple, ultrasoundController.createUltrasound);
router.get("/", ultrasoundController.getAllUltrasounds);
router.get("/stats", ultrasoundController.getUltrasoundStats);
router.get("/:id", ultrasoundController.getUltrasoundById);
router.put("/:id", ultrasoundController.updateUltrasound);
router.delete("/:id", ultrasoundController.deleteUltrasound);

module.exports = router;
