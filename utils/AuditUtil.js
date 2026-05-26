const  Audit  = require("../models"); // Import the actual model

class AuditUtil {
  static async logActivity(req, action, target = null) {
    try {
      let actorType = null;
      let actorId = null;
 
      if (req.user) {
        actorType = "staff";
        actorId = req.user.id;
      } else if (req.admin) {
        actorType = "admin";
        actorId = req.admin.id;
      }

      if (!actorId) {
        console.warn("⚠️ Audit skipped: No actor found in request.");
        return;
      }

      await Audit.create({
        action,
        target,
        actorType,
        actorId,
        ipAddress: req.ip,           // optional
        userAgent: req.headers["user-agent"], // optional
      });

      console.log(`✅ Audit log created: ${action} by ${actorType} (${actorId})`);
    } catch (error) {
      console.error("❌ Error logging audit activity:", error.message);
    }
  }
}

module.exports = AuditUtil;
