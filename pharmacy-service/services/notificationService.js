/**
 * Pharmacy Notification Service
 *
 * Sends real-time notifications via the WebSocket service REST API.
 * All pharmacy events (prescriptions, dispensing, stock alerts) flow
 * through this service for consistent notification delivery.
 *
 * Notification flow:
 *   Pharmacy Service → WebSocket Service REST API → Socket.IO → Frontend
 */

const config = require('../config/conf');
const logger = require('../utils/logger');

const WS_SERVICE_URL = process.env.WEBSOCKET_SERVICE_URL || 'http://websocket-service:3010';
const WS_SERVICE_KEY = process.env.HMS_SERVICE_KEY || process.env.SERVICE_AUTH_KEY || 'change-me-in-production';

/**
 * Send a notification via the WebSocket service.
 * Microservices use this to push real-time events to connected clients.
 */
async function sendNotification({ title, description, type, priority, toStaffId, toDepartmentId, broadcast, metadata }) {
  try {
    const payload = {
      title,
      description: description || '',
      type: type || 'Pharmacy',
      priority: priority || 'Medium',
      meta: metadata || {},
    };

    if (toStaffId) payload.to_staff_id = toStaffId;
    if (toDepartmentId) payload.to_department_id = toDepartmentId;
    if (broadcast) payload.broadcast = true;

    const response = await fetch(`${WS_SERVICE_URL}/api/v1/ws/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': WS_SERVICE_KEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn(`WebSocket notify failed (${response.status}): ${await response.text()}`);
    }
  } catch (error) {
    // Don't crash the pharmacy service if WebSocket is down
    logger.warn(`WebSocket notification failed: ${error.message}`);
  }
}

/**
 * Send a department-level notification.
 */
async function sendDepartmentNotification({ departmentId, title, description, type, priority, metadata }) {
  try {
    const response = await fetch(`${WS_SERVICE_URL}/api/v1/ws/notify/department`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': WS_SERVICE_KEY,
      },
      body: JSON.stringify({
        department_id: departmentId,
        title,
        description: description || '',
        type: type || 'Pharmacy',
        priority: priority || 'Medium',
        meta: metadata || {},
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn(`WebSocket dept notify failed (${response.status})`);
    }
  } catch (error) {
    logger.warn(`WebSocket department notification failed: ${error.message}`);
  }
}

/**
 * Emit a custom event via the WebSocket service.
 */
async function emitEvent({ event, target, targetType, data }) {
  try {
    const response = await fetch(`${WS_SERVICE_URL}/api/v1/ws/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': WS_SERVICE_KEY,
      },
      body: JSON.stringify({
        event,
        target,
        target_type: targetType,
        data,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn(`WebSocket emit failed (${response.status})`);
    }
  } catch (error) {
    logger.warn(`WebSocket emit failed: ${error.message}`);
  }
}

// ══════════════════════════════════════════════════════════════
//  PHARMACY-SPECIFIC NOTIFICATION TEMPLATES
// ══════════════════════════════════════════════════════════════

const pharmacyNotifications = {
  /**
   * New prescription created — notify pharmacy department.
   */
  async prescriptionCreated({ prescription, patientName, doctorName, institutionId, departmentId }) {
    await sendDepartmentNotification({
      departmentId,
      title: 'New Prescription',
      description: `Dr. ${doctorName || 'Unknown'} prescribed ${prescription.items?.length || 0} medication(s) for ${patientName || 'patient'}`,
      type: 'Pharmacy',
      priority: 'High',
      metadata: {
        event: 'prescription.created',
        prescription_id: prescription.id,
        patient_name: patientName,
        institution_id: institutionId,
      },
    });
  },

  /**
   * Prescription approved by pharmacist — notify patient's department.
   */
  async prescriptionApproved({ prescription, patientName, pharmacistName, institutionId, departmentId }) {
    await sendDepartmentNotification({
      departmentId,
      title: 'Prescription Approved',
      description: `Prescription for ${patientName || 'patient'} has been approved by ${pharmacistName || 'pharmacist'}`,
      type: 'Pharmacy',
      priority: 'Medium',
      metadata: {
        event: 'prescription.approved',
        prescription_id: prescription.id,
        patient_name: patientName,
        institution_id: institutionId,
      },
    });
  },

  /**
   * Medicine dispensed — notify prescription department and patient.
   */
  async medicineDispensed({ prescriptionId, medicationName, quantity, patientName, pharmacistName, institutionId, departmentId, totalCost }) {
    await sendDepartmentNotification({
      departmentId,
      title: 'Medicine Dispensed',
      description: `${medicationName} (x${quantity}) dispensed to ${patientName || 'patient'} by ${pharmacistName || 'pharmacist'}`,
      type: 'Pharmacy',
      priority: 'Low',
      metadata: {
        event: 'pharmacy.dispensed',
        prescription_id: prescriptionId,
        medication_name: medicationName,
        quantity,
        total_cost: totalCost,
        institution_id: institutionId,
      },
    });
  },

  /**
   * Low stock warning — notify pharmacy department head.
   */
  async lowStockWarning({ medicationName, currentQuantity, reorderLevel, institutionId, departmentId, batchNumber }) {
    await sendDepartmentNotification({
      departmentId,
      title: '⚠️ Low Stock Alert',
      description: `${medicationName} (Batch: ${batchNumber || 'N/A'}) has only ${currentQuantity} units left (reorder at ${reorderLevel})`,
      type: 'Pharmacy',
      priority: 'High',
      metadata: {
        event: 'pharmacy.low_stock',
        medication_name: medicationName,
        current_quantity: currentQuantity,
        reorder_level: reorderLevel,
        batch_number: batchNumber,
        institution_id: institutionId,
      },
    });
  },

  /**
   * Critical stock warning — notify pharmacy + admin.
   */
  async criticalStockWarning({ medicationName, currentQuantity, institutionId, departmentId, batchNumber }) {
    await sendDepartmentNotification({
      departmentId,
      title: '🚨 Critical Stock Alert',
      description: `${medicationName} (Batch: ${batchNumber || 'N/A'}) is critically low — only ${currentQuantity} unit(s) remaining!`,
      type: 'Pharmacy',
      priority: 'Urgent',
      metadata: {
        event: 'pharmacy.critical_stock',
        medication_name: medicationName,
        current_quantity: currentQuantity,
        batch_number: batchNumber,
        institution_id: institutionId,
      },
    });

    // Also broadcast to institution for critical stock
    await emitEvent({
      event: 'pharmacy.critical-stock',
      target: institutionId,
      targetType: 'institution',
      data: {
        medication_name: medicationName,
        current_quantity: currentQuantity,
        batch_number: batchNumber,
        institution_id: institutionId,
      },
    });
  },

  /**
   * Stock expired — notify pharmacy department.
   */
  async stockExpired({ medicationName, batchNumber, expiryDate, institutionId, departmentId }) {
    await sendDepartmentNotification({
      departmentId,
      title: '⚠️ Expired Stock',
      description: `${medicationName} (Batch: ${batchNumber}) expired on ${expiryDate}`,
      type: 'Pharmacy',
      priority: 'High',
      metadata: {
        event: 'pharmacy.expired',
        medication_name: medicationName,
        batch_number: batchNumber,
        expiry_date: expiryDate,
        institution_id: institutionId,
      },
    });
  },
};

module.exports = {
  sendNotification,
  sendDepartmentNotification,
  emitEvent,
  pharmacyNotifications,
};
