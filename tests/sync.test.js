const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../models');
const SyncOperation = require('../models/syncOperation');
const Patient = require('../models/patient');
const Institution = require('../models/institution');

describe('Sync API', () => {
  let institution;
  let authToken;

  beforeAll(async () => {
    await sequelize.sync({ force: false });
    
    institution = await Institution.create({
      name: 'Test Hospital',
      address: '123 Test St',
      contact: '1234567890',
      email: 'test@hospital.com',
      country: 'Ghana',
      region: 'Greater Accra'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await SyncOperation.destroy({ where: {}, force: true });
  });

  describe('POST /api/v1/sync', () => {
    it('should reject requests without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/sync')
        .send({ operations: [] });
      
      expect(res.status).toBe(401);
    });

    it('should reject requests without operations', async () => {
      const res = await request(app)
        .post('/api/v1/sync')
        .set('Authorization', 'Bearer fake-token')
        .send({});
      
      expect(res.status).toBe(400);
    });

    it('should process CREATE operation idempotently', async () => {
      const operationId = 'test-op-001';
      const payload = {
        first_name: 'John',
        last_name: 'Doe',
        institution_id: institution.id,
        gender: 'M'
      };

      const res = await request(app)
        .post('/api/v1/sync')
        .set('Authorization', 'Bearer fake-token')
        .send({
          operations: [{
            operation_id: operationId,
            entity: 'patient',
            operation: 'CREATE',
            record_id: 'local-patient-001',
            payload
          }]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results[0].status).toBe('success');

      const syncOp = await SyncOperation.findOne({ where: { operation_id: operationId } });
      expect(syncOp).toBeDefined();
      expect(syncOp.status).toBe('completed');

      const res2 = await request(app)
        .post('/api/v1/sync')
        .set('Authorization', 'Bearer fake-token')
        .send({
          operations: [{
            operation_id: operationId,
            entity: 'patient',
            operation: 'CREATE',
            record_id: 'local-patient-001',
            payload
          }]
        });

      expect(res2.body.results[0].status).toBe('already_processed');
    });

    it('should handle UPDATE operations', async () => {
      const patient = await Patient.create({
        first_name: 'Jane',
        last_name: 'Doe',
        institution_id: institution.id,
        gender: 'F'
      });

      const operationId = 'test-op-update-001';
      const res = await request(app)
        .post('/api/v1/sync')
        .set('Authorization', 'Bearer fake-token')
        .send({
          operations: [{
            operation_id: operationId,
            entity: 'patient',
            operation: 'UPDATE',
            record_id: patient.id,
            payload: { first_name: 'Janet' }
          }]
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe('success');

      const updated = await Patient.findByPk(patient.id);
      expect(updated.first_name).toBe('Janet');
    });

    it('should handle DELETE operations', async () => {
      const patient = await Patient.create({
        first_name: 'Delete',
        last_name: 'Me',
        institution_id: institution.id,
        gender: 'M'
      });

      const operationId = 'test-op-delete-001';
      const res = await request(app)
        .post('/api/v1/sync')
        .set('Authorization', 'Bearer fake-token')
        .send({
          operations: [{
            operation_id: operationId,
            entity: 'patient',
            operation: 'DELETE',
            record_id: patient.id,
            payload: {}
          }]
        });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe('success');
    });

    it('should batch multiple operations', async () => {
      const operations = [
        {
          operation_id: 'batch-001',
          entity: 'patient',
          operation: 'CREATE',
          record_id: 'batch-patient-1',
          payload: { first_name: 'Batch', last_name: 'One', institution_id: institution.id, gender: 'M' }
        },
        {
          operation_id: 'batch-002',
          entity: 'patient',
          operation: 'CREATE',
          record_id: 'batch-patient-2',
          payload: { first_name: 'Batch', last_name: 'Two', institution_id: institution.id, gender: 'F' }
        }
      ];

      const res = await request(app)
        .post('/api/v1/sync')
        .set('Authorization', 'Bearer fake-token')
        .send({ operations });

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(2);
      expect(res.body.results.every(r => r.status === 'success')).toBe(true);
    });
  });

  describe('GET /api/v1/sync/pending', () => {
    it('should return pending operations', async () => {
      await SyncOperation.create({
        operation_id: 'pending-001',
        institution_id: institution.id,
        entity: 'patient',
        operation: 'CREATE',
        record_id: 'local-001',
        payload: {},
        status: 'pending'
      });

      const res = await request(app)
        .get('/api/v1/sync/pending')
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(200);
      expect(res.body.operations.length).toBe(1);
    });
  });
});
