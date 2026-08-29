/**
 * API client for communicating with the main HMS backend.
 * Used for fetching related data (patients, staff, departments, etc.)
 */
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const hmsClient = axios.create({
  baseURL: config.hmsBackendUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Key': config.hmsBackendApiKey,
  },
});

// Add request interceptor for logging
hmsClient.interceptors.request.use(
  (request) => {
    logger.debug(`HMS Backend → ${request.method?.toUpperCase()} ${request.url}`);
    return request;
  },
  (error) => {
    logger.error('HMS Backend request error:', error.message);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
hmsClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.error || error.message;
    logger.error(`HMS Backend error [${status}]: ${message}`);
    return Promise.reject(error);
  }
);

/**
 * Fetch patient by ID from the main HMS backend
 */
async function getPatient(patientId, institutionId) {
  try {
    return await hmsClient.get(`/api/v1/records/patients/${patientId}`, {
      params: { institution_id: institutionId },
    });
  } catch (error) {
    logger.error(`Failed to fetch patient ${patientId}:`, error.message);
    return null;
  }
}

/**
 * Fetch staff by ID from the main HMS backend
 */
async function getStaff(staffId) {
  try {
    return await hmsClient.get(`/api/v1/records/staff/${staffId}`);
  } catch (error) {
    logger.error(`Failed to fetch staff ${staffId}:`, error.message);
    return null;
  }
}

/**
 * Fetch department by ID from the main HMS backend
 */
async function getDepartment(departmentId) {
  try {
    return await hmsClient.get(`/api/v1/departments/${departmentId}`);
  } catch (error) {
    logger.error(`Failed to fetch department ${departmentId}:`, error.message);
    return null;
  }
}

/**
 * Fetch visit by ID from the main HMS backend
 */
async function getVisit(visitId) {
  try {
    return await hmsClient.get(`/api/v1/records/visits/${visitId}`);
  } catch (error) {
    logger.error(`Failed to fetch visit ${visitId}:`, error.message);
    return null;
  }
}

/**
 * Notify a department (e.g., notify pharmacy of new prescription)
 */
async function notifyDepartment(departmentId, notification) {
  try {
    return await hmsClient.post('/api/v1/notifications/notification/create', {
      to_department_id: departmentId,
      broadcast: false,
      ...notification,
    });
  } catch (error) {
    logger.error('Failed to send department notification:', error.message);
    return null;
  }
}

module.exports = { hmsClient, getPatient, getStaff, getDepartment, getVisit, notifyDepartment };
