// routes/claimItemRoutes.js
const express = require("express");
const router = express.Router();
const ClaimItemController = require("../controllers/claims/claimItemController");
const claimController = require("../controllers/claims/claimController");
const claimDashboardController = require("../controllers/claims/claimDashboardController");
const authenticateToken = require("../middlewares/authMiddlewares");
const nhiaClaimsGeneration = require('../controllers/claims/nhiaClaimGenerationController')

router.post("/", ClaimItemController.create);
router.get("/dashboard/summary", authenticateToken, claimDashboardController.getClaimSummary);
router.get("/dashboard/recent", authenticateToken, claimDashboardController.getRecentClaims);
router.get("/dashboard/items-breakdown", authenticateToken, claimDashboardController.getClaimItemsBreakdown);

// update claims status
router.put("/update-claim-status", authenticateToken, claimController.updateClaimStatus);
router.get('/all-visits', claimController.getAllClaims); // Get all claims with filters
router.post('/xml/generate', authenticateToken, nhiaClaimsGeneration.generateXMLReport); // NHIA XML Export
router.get('/export-history', authenticateToken, nhiaClaimsGeneration.listExportBatches); // NHIA Export History

router.put("/:id", ClaimItemController.update);
router.patch("/:id", ClaimItemController.patch);
router.delete("/:id", ClaimItemController.destroy);



module.exports = router;
