const { sequelize } = require('../models');
const SyncOperation = require('../models/syncOperation');
const Patient = require('../models/patient');
const Visit = require('../models/Visit');
const Appointment = require('../models/appointment');
const Department = require('../models/department');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const InventoryRecord = require('../models/store/inventoryRecord');
const { Op } = require('sequelize');

const SUPPORTED_ENTITIES = ['patient', 'visit', 'appointment', 'department', 'invoice', 'payment', 'inventory_record'];

const getEntityModel = (entity) => {
  switch (entity) {
    case 'patient': return Patient;
    case 'visit': return Visit;
    case 'appointment': return Appointment;
    case 'department': return Department;
    case 'invoice': return Invoice;
    case 'payment': return Payment;
    case 'inventory_record': return InventoryRecord;
    default: return null;
  }
};

const validatePayload = (entity, payload) => {
  switch (entity) {
    case 'patient':
      return !!(payload.first_name && payload.last_name && payload.institution_id);
    case 'visit':
      return !!(payload.patient_id && payload.institution_id);
    case 'appointment':
      return !!(payload.staff_id && payload.institution_id && payload.visit_id);
    case 'department':
      return !!(payload.name && payload.institution_id);
    case 'invoice':
      return !!(payload.visit_id && payload.institution_id);
    case 'payment':
      return !!(payload.invoice_id && payload.amount);
    case 'inventory_record':
      return !!(payload.item_id && payload.movement_type);
    default:
      return false;
  }
};

const processCreate = async (entity, payload, transaction) => {
  const Model = getEntityModel(entity);
  if (!Model) throw new Error(`Unsupported entity: ${entity}`);
  
  const record = await Model.create(payload, { transaction });
  return record;
};

const processUpdate = async (entity, recordId, payload, transaction) => {
  const Model = getEntityModel(entity);
  if (!Model) throw new Error(`Unsupported entity: ${entity}`);
  
  const record = await Model.findByPk(recordId, { transaction });
  if (!record) throw new Error(`${entity} not found`);
  
  await record.update(payload, { transaction });
  return record;
};

const processDelete = async (entity, recordId, transaction) => {
  const Model = getEntityModel(entity);
  if (!Model) throw new Error(`Unsupported entity: ${entity}`);
  
  const record = await Model.findByPk(recordId, { transaction });
  if (!record) throw new Error(`${entity} not found`);
  
  if (entity === 'payment' || entity === 'invoice') {
    await record.update({ status: 'cancelled' }, { transaction });
    return record;
  }
  
  await record.destroy({ transaction });
  return record;
};

exports.syncBatch = async (req, res) => {
  const { operations } = req.body;
  const institutionId = req.user?.institution?.id || req.body.institution_id;
  const userId = req.user?.id || null;

  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ message: 'No operations provided' });
  }

  if (!institutionId) {
    return res.status(400).json({ message: 'Institution ID is required' });
  }

  const results = [];
  const transaction = await sequelize.transaction();

  try {
    for (const op of operations) {
      const { operation_id, entity, operation, record_id, payload } = op;

      if (!operation_id || !entity || !operation || !record_id) {
        results.push({
          operation_id: operation_id || null,
          status: 'error',
          message: 'Missing required fields: operation_id, entity, operation, record_id'
        });
        continue;
      }

      if (!SUPPORTED_ENTITIES.includes(entity)) {
        results.push({
          operation_id,
          status: 'error',
          message: `Unsupported entity: ${entity}`
        });
        continue;
      }

      if (!['CREATE', 'UPDATE', 'DELETE'].includes(operation)) {
        results.push({
          operation_id,
          status: 'error',
          message: `Unsupported operation: ${operation}`
        });
        continue;
      }

      if (!validatePayload(entity, payload)) {
        results.push({
          operation_id,
          status: 'error',
          message: 'Invalid payload for entity'
        });
        continue;
      }

      let existingOp = await SyncOperation.findOne({
        where: { operation_id },
        transaction
      });

      if (existingOp) {
        if (existingOp.status === 'completed') {
          results.push({
            operation_id,
            status: 'already_processed',
            record_id: existingOp.server_record_id || existingOp.record_id,
            message: 'Operation already processed'
          });
          continue;
        }
        
        if (existingOp.status === 'conflict') {
          results.push({
            operation_id,
            status: 'conflict',
            record_id: existingOp.record_id,
            message: existingOp.last_error || 'Conflict detected'
          });
          continue;
        }

        if (existingOp.status === 'failed') {
          existingOp.attempts += 1;
          existingOp.status = 'processing';
          existingOp.last_error = null;
          await existingOp.save({ transaction });
        }
      } else {
        existingOp = await SyncOperation.create({
          operation_id,
          institution_id: institutionId,
          user_id: userId,
          entity,
          operation,
          record_id,
          payload,
          status: 'processing',
          attempts: 1
        }, { transaction });
      }

      try {
        let serverRecord;
        switch (operation) {
          case 'CREATE':
            serverRecord = await processCreate(entity, payload, transaction);
            break;
          case 'UPDATE':
            serverRecord = await processUpdate(entity, record_id, payload, transaction);
            break;
          case 'DELETE':
            serverRecord = await processDelete(entity, record_id, transaction);
            break;
        }

        const serverRecordId = serverRecord?.id || serverRecord?.getDataValue('id');
        
        existingOp.status = 'completed';
        existingOp.server_record_id = serverRecordId;
        existingOp.processed_at = new Date();
        await existingOp.save({ transaction });

        results.push({
          operation_id,
          status: 'success',
          record_id: serverRecordId,
          message: 'Operation completed successfully'
        });
      } catch (error) {
        existingOp.attempts += 1;
        existingOp.last_error = error.message;
        
        if (error.name === 'SequelizeUniqueConstraintError') {
          existingOp.status = 'conflict';
        } else if (existingOp.attempts >= 5) {
          existingOp.status = 'failed';
        } else {
          existingOp.status = 'pending';
        }
        
        await existingOp.save({ transaction });

        results.push({
          operation_id,
          status: existingOp.status,
          record_id: existingOp.record_id,
          message: error.message
        });
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      results
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Sync batch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Synchronization failed',
      error: error.message
    });
  }
};

exports.getPendingOperations = async (req, res) => {
  const institutionId = req.user?.institution?.id;
  
  if (!institutionId) {
    return res.status(400).json({ message: 'Institution ID is required' });
  }

  try {
    const operations = await SyncOperation.findAll({
      where: {
        institution_id: institutionId,
        status: { [Op.ne]: 'completed' }
      },
      order: [['created_at', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      count: operations.length,
      operations
    });
  } catch (error) {
    console.error('Get pending operations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending operations',
      error: error.message
    });
  }
};

exports.markOperationCompleted = async (req, res) => {
  const { operation_id } = req.params;
  
  try {
    const operation = await SyncOperation.findOne({
      where: { operation_id }
    });

    if (!operation) {
      return res.status(404).json({ message: 'Operation not found' });
    }

    operation.status = 'completed';
    operation.processed_at = new Date();
    await operation.save();

    return res.status(200).json({
      success: true,
      message: 'Operation marked as completed'
    });
  } catch (error) {
    console.error('Mark operation completed error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update operation',
      error: error.message
    });
  }
};
