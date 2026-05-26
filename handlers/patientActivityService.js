// handlers/patientActivityHandlers.js

const PatientRecentActivities = require("../models/PatientRecentActivities");

const patientActivityHandlers = {
  /**
   * Record a new patient activity
   * @param {string} visitId 
   * @param {string} staffId 
   * @param {string} departmentId 
   * @param {object} activity 
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  recordActivity: async (visitId, staffId, departmentId, activity) => {
    try {
      if (!visitId || !staffId || !activity) {
        return { 
          success: false,
          error: 'Missing required fields: visitId, staffId, or activity' 
        };
      }

      const recordedActivity = await PatientRecentActivities.create({
        visitId,
        staffId,
        departmentId,
        activity
      });

      return {
        success: true,
        data: recordedActivity
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Get activities for a visit
   * @param {string} visitId 
   * @param {number} [limit=20] 
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  getVisitActivities: async (visitId, limit = 20) => {
    try {
      const activities = await PatientActivityService.findAll(visitId, limit);
      return {
        success: true,
        data: activities
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Delete all activities for a visit
   * @param {string} visitId 
   * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
   */
  deleteActivitiesByVisit: async (visitId) => {
    try {
      if (!visitId) {
        return {
          success: false,
          error: 'Missing required parameter: visitId'
        };
      }

      const deletedCount = await PatientActivityService.destroy({
        where:{visit_id:visitId}
      });
      return {
        success: true,
        deletedCount,
        message: `Deleted ${deletedCount} activities`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

module.exports = patientActivityHandlers;