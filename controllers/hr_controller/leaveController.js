const sequelize = require('../../config/database');
const LeaveBalance = require('../../models/hr/LeaveBalance');
const LeaveRequest = require('../../models/hr/LeaveManagement');
const Audit = require('../../utils/AuditUtil');
const Notification = require('../../models/notification');
const Staff = require('../../models/staff');

// Helper function to notify admin about new leave request
const notifyAdminOfLeaveRequest = async (leave, staff) => {
  try {
    // Find all admins to notify
    const admins = await Staff.findAll({
      where: { role: 'admin' }
    });

    // Create notifications for all admins
    const notifications = admins.map(admin => ({
      title: 'New Leave Request',
      description: `${staff.firstName} ${staff.lastName} has requested ${leave.leaveType} for ${leave.durationDays} day(s)`,
      from_staff_id: staff.id,
      to_staff_id: admin.id,
      is_read: false,
      type: 'leave_request'
    }));

    await Notification.bulkCreate(notifications);
    console.log('Admin notified of new leave request');
  } catch (error) {
    console.error('Error notifying admin:', error);
  }
};

class LeaveController {
  // Staff request leave
  static async requestLeave(req, res) {
    const t = await sequelize.transaction();
    try {
      const { leaveType, startDate, endDate, reason, emergencyContact, documentUrl } = req.body;
      const staff_id = req.user?.id;

      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      const leave = await LeaveRequest.create({
        staff_id,
        leaveType,
        startDate,
        endDate,
        durationDays,
        reason,
        emergencyContact,
        documentUrl,
        status: "Pending"
      }, { transaction: t });

      await Audit.logActivity(req,"Leave Requested", staff_id, { leaveId: leave.id }, t);

      // Commit the transaction first
      await t.commit();
      
      // Notify admin about the leave request (outside transaction)
      const staff = await Staff.findByPk(staff_id);
      if (staff) {
        await notifyAdminOfLeaveRequest(leave, staff);
      }

      res.status(201).json({ message: "Leave request submitted", leave });
    } catch (err) {
      await t.rollback();
      res.status(500).json({ message: err.message });
    }
  }

  // Admin approve/reject
  static async reviewLeave(req, res) {
    const t = await sequelize.transaction();
    try {
      const { leaveId } = req.params;
      const { status, rejectionReason } = req.body;
      const approvedById = req.admin?.id;

      const leave = await LeaveRequest.findByPk(leaveId, { transaction: t });
      if (!leave) {
        await t.rollback();
        return res.status(404).json({ message: "Leave not found" });
      }

      if (leave.status !== "Pending") {
        await t.rollback();
        return res.status(400).json({ message: "Leave already reviewed" });
      }

      if (status === "Approved") {
        const currentYear = new Date().getFullYear();
        const balance = await LeaveBalance.findOne({ 
          where: { staff_id: leave.staff_id, leaveType: leave.leaveType, year: currentYear },
          transaction: t
        });

        if (!balance) {
          await t.rollback();
          return res.status(400).json({ message: "No leave balance record found" });
        }

        if (balance.remaining < leave.durationDays) {
          await t.rollback();
          return res.status(400).json({ message: "Insufficient leave balance" });
        }

        // Deduct balance
        balance.taken = parseFloat(balance.taken) + parseFloat(leave.durationDays);
        await balance.save({ transaction: t });

        leave.approvedById = approvedById;
        leave.approvedAt = new Date();
      } else if (status === "Rejected") {
        leave.rejectionReason = rejectionReason;
      }

      leave.status = status;
      await leave.save({ transaction: t });

      await Audit.log(`Leave ${status}`, approvedById, { leaveId: leave.id }, t);

      await t.commit();
      res.json({ message: `Leave ${status}`, leave });
    } catch (err) {
      await t.rollback();
      res.status(500).json({ message: err.message });
    }
  }

  // Staff update leave (only if pending)
  static async updateLeave(req, res) {
    const t = await sequelize.transaction();
    try {
      const { leaveId } = req.params;
      const { startDate, endDate, reason, emergencyContact } = req.body;
      const staff_id = req.user?.id;

      const leave = await LeaveRequest.findByPk(leaveId, { transaction: t });
      if (!leave) {
        await t.rollback();
        return res.status(404).json({ message: "Leave not found" });
      }

      if (leave.staff_id !== staff_id) {
        await t.rollback();
        return res.status(403).json({ message: "Not your leave request" });
      }

      if (leave.status !== "Pending") {
        await t.rollback();
        return res.status(400).json({ message: "Cannot update approved/rejected leave" });
      }

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        leave.durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      }

      leave.startDate = startDate || leave.startDate;
      leave.endDate = endDate || leave.endDate;
      leave.reason = reason || leave.reason;
      leave.emergencyContact = emergencyContact || leave.emergencyContact;

      await leave.save({ transaction: t });

      await Audit.log("Leave Updated", staff_id, { leaveId: leave.id }, t);

      await t.commit();
      res.json({ message: "Leave updated", leave });
    } catch (err) {
      await t.rollback();
      res.status(500).json({ message: err.message });
    }
  }

  // Staff cancel leave
  static async cancelLeave(req, res) {
    const t = await sequelize.transaction();
    try {
      const { leaveId } = req.params;
      const staff_id = req.user?.id;

      const leave = await LeaveRequest.findByPk(leaveId, { transaction: t });
      if (!leave) {
        await t.rollback();
        return res.status(404).json({ message: "Leave not found" });
      }

      if (leave.staff_id !== staff_id) {
        await t.rollback();
        return res.status(403).json({ message: "Not your leave request" });
      }

      if (leave.status !== "Pending") {
        await t.rollback();
        return res.status(400).json({ message: "Cannot cancel approved/rejected leave" });
      }

      leave.status = "Cancelled";
      await leave.save({ transaction: t });

      await Audit.log("Leave Cancelled", staff_id, { leaveId: leave.id }, t);

      await t.commit();
      res.json({ message: "Leave cancelled", leave });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  // Staff view their leave requests
  static async myLeaves(req, res) {
    try {
      const staff_id = req.user?.id;
      const leaves = await LeaveRequest.findAll({ 
        where: { staff_id },
        order: [['createdAt', 'DESC']]
      });
      res.json(leaves);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  // Get leave balance for staff
  static async getLeaveBalance(req, res) {
    try {
      const staff_id = req.user?.id;
      const currentYear = new Date().getFullYear();
      
      const balance = await LeaveBalance.findAll({ 
        where: { 
          staff_id,
          year: currentYear
        }
      });

      res.json(balance);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }

  // Admin get all leave requests (with optional filters)
  static async getAllLeaves(req, res) {
    try {
      const { status, leaveType, page = 1, limit = 10 } = req.query;
      const where = {};
      
      if (status) where.status = status;
      if (leaveType) where.leaveType = leaveType;

      const offset = (page - 1) * limit;

      const leaves = await LeaveRequest.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: offset,
        order: [['createdAt', 'DESC']],
        include: [
          {
            association: 'leaveRequest',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      });

      res.json({
        leaves: leaves.rows,
        total: leaves.count,
        totalPages: Math.ceil(leaves.count / limit),
        currentPage: parseInt(page)
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
}

module.exports = LeaveController;
