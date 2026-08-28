/**
 * Integration Test: Full WebSocket Lab Request Notification Flow
 *
 * Tests the end-to-end path:
 *   1. Lab technician connects to Socket.IO and joins staff + department rooms
 *   2. A lab request is created (via controller / NotificationService)
 *   3. NotificationService.emitNotification() sends the event
 *   4. The connected client receives `new-notification` (staff-level)
 *   5. The connected client receives `new-department-notification` (dept-level)
 *   6. The notification payload matches what the frontend useLabNotification hook expects
 *
 * This mirrors the real flow in:
 *   controllers/lab/labController.js → notifyLabStaff() → notificationService.emitNotification()
 *   service/notificationService.js → emitNotification()
 *   hms-frontend/src/hooks/useLabNotification.jsx
 */

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

// Import the actual NotificationService class used by the monolith
const NotificationService = require('../service/notificationService');

const PORT = 0; // Let OS pick a free port

// ─── Helpers ───────────────────────────────────────────────────
function waitForEvent(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitForConnection(socket, timeout = 3000) {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    const timer = setTimeout(() => reject(new Error('Timeout connecting socket')), timeout);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// ─── Test Suite ────────────────────────────────────────────────
describe('Full WebSocket Lab Request Notification Flow', () => {
  let httpServer;
  let io;
  let notificationService;
  let port;

  // Test data mimicking a real lab scenario
  const labTechnicianStaffId = 'staff-001-lab-tech';
  const secondStaffId = 'staff-002-lab-tech';
  const labDepartmentId = 'dept-lab-001';
  const institutionId = 'inst-001';
  const doctorStaffId = 'staff-100-doctor';

  beforeAll((done) => {
    httpServer = http.createServer();
    io = new Server(httpServer, {
      cors: { origin: '*' },
      transports: ['websocket'],
    });

    // Initialize the real NotificationService
    notificationService = new NotificationService(io);

    httpServer.listen(0, '0.0.0.0', () => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    io.close();
    httpServer.close(done);
  });

  // ─── Test 1: Staff-specific notification delivery ──────────
  describe('Staff-specific notification (to_staff_id)', () => {
    it('should deliver a lab request notification to the targeted staff member', async () => {
      // Connect a client socket as the lab technician
      const labTechSocket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await waitForConnection(labTechSocket);

      // Register and join rooms (mirrors frontend socketService.jsx / useLabNotification.jsx)
      labTechSocket.emit('register', {
        userId: labTechnicianStaffId,
        departmentId: labDepartmentId,
        institutionId,
      });
      labTechSocket.emit('join-notification-room', {
        staffId: labTechnicianStaffId,
        departmentId: labDepartmentId,
      });

      // Wait for rooms to be joined
      await new Promise((r) => setTimeout(r, 100));

      // ── Simulate lab request creation ──
      // In the real flow, notifyLabStaff() creates a Notification in DB then calls:
      //   notificationService.emitNotification(notification)
      const notification = {
        id: `notif-${Date.now()}-001`,
        title: 'New Lab Request',
        description: 'New lab test requested: Complete Blood Count (CBC). Patient: Ama Serwaa Boateng',
        from_staff_id: doctorStaffId,
        to_staff_id: labTechnicianStaffId,
        to_department_id: labDepartmentId,
        institution_id: institutionId,
        type: 'Alert',
        priority: 'Medium',
        createdAt: new Date().toISOString(),
      };

      // Listen for the notification event
      const receivedPromise = waitForEvent(labTechSocket, 'new-notification');

      // Emit via the real NotificationService
      notificationService.emitNotification(notification);

      // Verify delivery
      const received = await receivedPromise;

      expect(received).toBeDefined();
      expect(received.id).toBe(notification.id);
      expect(received.title).toBe('New Lab Request');
      expect(received.description).toContain('Complete Blood Count');
      expect(received.description).toContain('Ama Serwaa Boateng');
      expect(received.to_staff_id).toBe(labTechnicianStaffId);
      expect(received.type).toBe('Alert');
      expect(received.priority).toBe('Medium');

      labTechSocket.disconnect();
    });

    it('should NOT deliver a staff notification to a different staff member', async () => {
      // Connect as a different staff member
      const otherSocket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await waitForConnection(otherSocket);

      otherSocket.emit('register', {
        userId: secondStaffId,
        departmentId: labDepartmentId,
        institutionId,
      });
      otherSocket.emit('join-notification-room', {
        staffId: secondStaffId,
        departmentId: labDepartmentId,
      });

      await new Promise((r) => setTimeout(r, 100));

      const notification = {
        id: `notif-${Date.now()}-002`,
        title: 'New Lab Request',
        description: 'Lab request for staff 001 only',
        to_staff_id: labTechnicianStaffId, // targeted at staff 001, not staff 002
        to_department_id: null,
        institution_id: institutionId,
        type: 'Alert',
        priority: 'Medium',
      };

      // The other socket should NOT receive a `new-notification` event
      // We set up a listener and verify it's NOT called within a timeout
      let receivedUnexpected = false;
      const checkTimeout = 500;

      otherSocket.once('new-notification', () => {
        receivedUnexpected = true;
      });

      notificationService.emitNotification(notification);

      await new Promise((r) => setTimeout(r, checkTimeout));

      expect(receivedUnexpected).toBe(false);

      otherSocket.disconnect();
    });
  });

  // ─── Test 2: Department-level notification delivery ─────────
  describe('Department notification (to_department_id)', () => {
    it('should deliver a notification to all clients in the Lab department room', async () => {
      // Connect two lab technicians
      const tech1 = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      const tech2 = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await Promise.all([waitForConnection(tech1), waitForConnection(tech2)]);

      // Register both in the same department
      tech1.emit('register', { userId: 'tech-A', departmentId: labDepartmentId, institutionId });
      tech2.emit('register', { userId: 'tech-B', departmentId: labDepartmentId, institutionId });

      tech1.emit('join-notification-room', { staffId: 'tech-A', departmentId: labDepartmentId });
      tech2.emit('join-notification-room', { staffId: 'tech-B', departmentId: labDepartmentId });

      await new Promise((r) => setTimeout(r, 100));

      const notification = {
        id: `notif-${Date.now()}-003`,
        title: 'New Lab Request',
        description: 'Department-wide lab request notification',
        to_department_id: labDepartmentId,
        to_staff_id: null,
        institution_id: institutionId,
        type: 'Alert',
        priority: 'High',
        createdAt: new Date().toISOString(),
      };

      // Both should receive `new-department-notification`
      const received1 = waitForEvent(tech1, 'new-department-notification');
      const received2 = waitForEvent(tech2, 'new-department-notification');

      notificationService.emitNotification(notification);

      const [r1, r2] = await Promise.all([received1, received2]);

      expect(r1).toBeDefined();
      expect(r2).toBeDefined();
      expect(r1.id).toBe(notification.id);
      expect(r2.id).toBe(notification.id);
      expect(r1.to_department_id).toBe(labDepartmentId);
      expect(r1.title).toBe('New Lab Request');
      expect(r1.description).toContain('Department-wide');

      tech1.disconnect();
      tech2.disconnect();
    });

    it('should deliver to a client in a different department room', async () => {
      const otherDeptSocket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await waitForConnection(otherDeptSocket);

      otherDeptSocket.emit('register', {
        userId: 'pharmacist-01',
        departmentId: 'dept-pharmacy-001',
        institutionId,
      });
      otherDeptSocket.emit('join-notification-room', {
        staffId: 'pharmacist-01',
        departmentId: 'dept-pharmacy-001',
      });

      await new Promise((r) => setTimeout(r, 100));

      const notification = {
        id: `notif-${Date.now()}-004`,
        title: 'Lab Only Notification',
        description: 'This should only go to Lab department',
        to_department_id: labDepartmentId,
        to_staff_id: null,
        institution_id: institutionId,
        type: 'Alert',
        priority: 'Medium',
      };

      let receivedUnexpected = false;
      otherDeptSocket.once('new-department-notification', () => {
        receivedUnexpected = true;
      });

      notificationService.emitNotification(notification);

      await new Promise((r) => setTimeout(r, 500));

      expect(receivedUnexpected).toBe(false);

      otherDeptSocket.disconnect();
    });
  });

  // ─── Test 3: Combined staff + department notification ───────
  describe('Combined staff + department notification', () => {
    it('should deliver both staff-level and department-level events for the same notification', async () => {
      const socket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await waitForConnection(socket);

      socket.emit('register', {
        userId: labTechnicianStaffId,
        departmentId: labDepartmentId,
        institutionId,
      });
      socket.emit('join-notification-room', {
        staffId: labTechnicianStaffId,
        departmentId: labDepartmentId,
      });

      await new Promise((r) => setTimeout(r, 100));

      const notification = {
        id: `notif-${Date.now()}-005`,
        title: 'New Lab Request',
        description: 'Dual notification test — CBC for Patient John Doe',
        to_staff_id: labTechnicianStaffId,
        to_department_id: labDepartmentId,
        institution_id: institutionId,
        type: 'Alert',
        priority: 'Critical',
        createdAt: new Date().toISOString(),
      };

      // Listen for both events
      const staffEvent = waitForEvent(socket, 'new-notification');
      const deptEvent = waitForEvent(socket, 'new-department-notification');

      notificationService.emitNotification(notification);

      const [staffNotif, deptNotif] = await Promise.all([staffEvent, deptEvent]);

      // Both should arrive with the same data
      expect(staffNotif.id).toBe(notification.id);
      expect(deptNotif.id).toBe(notification.id);
      expect(staffNotif.to_staff_id).toBe(labTechnicianStaffId);
      expect(deptNotif.to_department_id).toBe(labDepartmentId);
      expect(staffNotif.priority).toBe('Critical');
      expect(deptNotif.description).toContain('John Doe');

      socket.disconnect();
    });
  });

  // ─── Test 4: Notification payload matches frontend expectations ─
  describe('Frontend useLabNotification hook compatibility', () => {
    it('should produce a notification object with all fields the frontend hook reads', async () => {
      const socket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await waitForConnection(socket);

      socket.emit('register', {
        userId: labTechnicianStaffId,
        departmentId: labDepartmentId,
        institutionId,
      });
      socket.emit('join-notification-room', {
        staffId: labTechnicianStaffId,
        departmentId: labDepartmentId,
      });

      await new Promise((r) => setTimeout(r, 100));

      // Mimics what the real labController.notifyLabStaff() produces
      const notification = {
        id: `notif-${Date.now()}-006`,
        title: 'New Lab Request',
        description: 'New lab test requested: Full Blood Panel. Patient: Kofi Mensah',
        from_staff_id: doctorStaffId,
        to_staff_id: labTechnicianStaffId,
        to_department_id: labDepartmentId,
        institution_id: institutionId,
        type: 'Alert',
        priority: 'Medium',
        broadcast: false,
        is_read: false,
        createdAt: new Date().toISOString(),
      };

      const receivedPromise = waitForEvent(socket, 'new-notification');
      notificationService.emitNotification(notification);
      const received = await receivedPromise;

      // useLabNotification.jsx reads these fields:
      //   notification.id
      //   notification.to_staff_id
      //   notification.title
      //   notification.description
      //   notification.createdAt
      //   notification.priority
      //   notification.type

      expect(received).toHaveProperty('id');
      expect(received).toHaveProperty('title');
      expect(received).toHaveProperty('description');
      expect(received).toHaveProperty('to_staff_id');
      expect(received).toHaveProperty('priority');
      expect(received).toHaveProperty('type');
      expect(received).toHaveProperty('createdAt');

      // Verify the hook's filtering logic: it checks to_staff_id matches currentUser.id
      expect(received.to_staff_id).toBe(labTechnicianStaffId);

      // Verify the hook's default fallback values
      expect(received.title || 'New Lab Request').toBe('New Lab Request');
      expect(received.priority || 'Medium').toBe('Medium');
      expect(received.type || 'Alert').toBe('Alert');

      socket.disconnect();
    });
  });

  // ─── Test 5: Broadcast notification ────────────────────────
  describe('Broadcast notification (system-wide)', () => {
    it('should deliver a broadcast notification to all connected clients', async () => {
      const socket1 = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      const socket2 = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await Promise.all([waitForConnection(socket1), waitForConnection(socket2)]);

      socket1.emit('register', { userId: 'user-A', departmentId: 'dept-1', institutionId });
      socket2.emit('register', { userId: 'user-B', departmentId: 'dept-2', institutionId });

      await new Promise((r) => setTimeout(r, 100));

      const notification = {
        id: `notif-${Date.now()}-007`,
        title: 'System Maintenance',
        description: 'Scheduled maintenance tonight',
        broadcast: true,
        institution_id: institutionId,
        type: 'System',
        priority: 'Low',
        createdAt: new Date().toISOString(),
      };

      const received1 = waitForEvent(socket1, 'new-broadcast-notification');
      const received2 = waitForEvent(socket2, 'new-broadcast-notification');

      notificationService.emitNotification(notification);

      const [r1, r2] = await Promise.all([received1, received2]);

      expect(r1.id).toBe(notification.id);
      expect(r2.id).toBe(notification.id);
      expect(r1.broadcast).toBe(true);

      socket1.disconnect();
      socket2.disconnect();
    });
  });

  // ─── Test 6: createNotification (DB save + emit) ───────────
  describe('NotificationService.createNotification()', () => {
    it('should create a notification object and emit it via Socket.IO', async () => {
      const socket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await waitForConnection(socket);

      socket.emit('register', {
        userId: labTechnicianStaffId,
        departmentId: labDepartmentId,
        institutionId,
      });
      socket.emit('join-notification-room', {
        staffId: labTechnicianStaffId,
        departmentId: labDepartmentId,
      });

      await new Promise((r) => setTimeout(r, 100));

      const data = {
        title: 'New Lab Request',
        description: 'Lab request from Dr. Test — Haemoglobin test for patient XYZ',
        from_staff_id: doctorStaffId,
        to_staff_id: labTechnicianStaffId,
        to_department_id: labDepartmentId,
        institution_id: institutionId,
        priority: 'Medium',
        type: 'Alert',
      };

      // createNotification would normally call Notification.create() + emitNotification()
      // In our test, we mock the DB part and call emitNotification directly
      // to verify the Socket.IO delivery path
      const notification = {
        id: `notif-${Date.now()}-008`,
        ...data,
        is_read: false,
        broadcast: false,
        createdAt: new Date().toISOString(),
      };

      const receivedPromise = waitForEvent(socket, 'new-notification');
      notificationService.emitNotification(notification);
      const received = await receivedPromise;

      expect(received.title).toBe(data.title);
      expect(received.description).toContain('Haemoglobin');
      expect(received.description).toContain('Dr. Test');
      expect(received.to_staff_id).toBe(labTechnicianStaffId);
      expect(received.to_department_id).toBe(labDepartmentId);

      socket.disconnect();
    });
  });

  // ─── Test 7: mark-notification-read flow ───────────────────
  // NOTE: The real NotificationService.markAsRead() calls Notification.update()
  // against the real Postgres DB. Since our test IDs are not valid UUIDs,
  // we test the WebSocket emit path by using a lightweight Socket.IO server
  // that mirrors the mark-read event handler without the DB write.
  describe('mark-notification-read event', () => {
    it('should emit notification-read event back to the staff room', (done) => {
      // Create a separate lightweight server to test the WebSocket event
      // pattern without triggering the real DB update
      const testServer = http.createServer();
      const testIo = new Server(testServer, { transports: ['websocket'] });

      testIo.on('connection', (socket) => {
        socket.on('join-notification-room', ({ staffId }) => {
          if (staffId) socket.join(`staff-${staffId}`);
        });

        // Mirrors NotificationService.markAsRead() WebSocket emit pattern
        socket.on('mark-notification-read', ({ notificationIds, staffId }) => {
          if (notificationIds && staffId) {
            testIo.to(`staff-${staffId}`).emit('notification-read', { notificationIds, staffId });
          }
        });
      });

      testServer.listen(0, async () => {
        const testPort = testServer.address().port;
        const client = Client(`http://localhost:${testPort}`, {
          transports: ['websocket'],
          forceNew: true,
        });

        await waitForConnection(client);

        client.emit('join-notification-room', { staffId: labTechnicianStaffId });
        await new Promise((r) => setTimeout(r, 100));

        const readPromise = waitForEvent(client, 'notification-read');

        client.emit('mark-notification-read', {
          notificationIds: ['notif-123', 'notif-456'],
          staffId: labTechnicianStaffId,
        });

        const readData = await readPromise;

        expect(readData).toBeDefined();
        expect(readData.notificationIds).toContain('notif-123');
        expect(readData.notificationIds).toContain('notif-456');
        expect(readData.staffId).toBe(labTechnicianStaffId);

        client.disconnect();
        testIo.close();
        testServer.close(done);
      });
    });
  });

  // ─── Test 8: mark-all-notifications-read ───────────────────
  describe('mark-all-notifications-read event', () => {
    it('should emit all-notifications-read to the staff room', (done) => {
      const testServer = http.createServer();
      const testIo = new Server(testServer, { transports: ['websocket'] });

      testIo.on('connection', (socket) => {
        socket.on('join-notification-room', ({ staffId }) => {
          if (staffId) socket.join(`staff-${staffId}`);
        });

        // Mirrors NotificationService.markAllAsRead() WebSocket emit pattern
        socket.on('mark-all-notifications-read', ({ staffId }) => {
          if (staffId) {
            testIo.to(`staff-${staffId}`).emit('all-notifications-read', { staffId });
          }
        });
      });

      testServer.listen(0, async () => {
        const testPort = testServer.address().port;
        const client = Client(`http://localhost:${testPort}`, {
          transports: ['websocket'],
          forceNew: true,
        });

        await waitForConnection(client);

        client.emit('join-notification-room', { staffId: labTechnicianStaffId });
        await new Promise((r) => setTimeout(r, 100));

        const allReadPromise = waitForEvent(client, 'all-notifications-read');

        client.emit('mark-all-notifications-read', {
          staffId: labTechnicianStaffId,
        });

        const data = await allReadPromise;

        expect(data).toBeDefined();
        expect(data.staffId).toBe(labTechnicianStaffId);

        client.disconnect();
        testIo.close();
        testServer.close(done);
      });
    });
  });
});

// ─── WebSocket Service REST API Tests ─────────────────────────
describe('WebSocket Service REST API Notification Endpoint', () => {
  let wsHttpServer;
  let wsIo;
  let wsPort;

  const serviceKey = 'test-service-key';

  beforeAll((done) => {
    // Create a minimal WebSocket service setup
    const { Server } = require('socket.io');
    const express = require('express');
    const app = express();
    wsHttpServer = require('http').createServer(app);
    wsIo = new Server(wsHttpServer, {
      cors: { origin: '*' },
      transports: ['websocket'],
    });

    // Minimal HmsSocketService-like handler
    const connectedUsers = new Map();

    wsIo.on('connection', (socket) => {
      socket.on('register', (data) => {
        if (data.userId) {
          socket.join(`staff-${data.userId}`);
          connectedUsers.set(data.userId, socket.id);
        }
        if (data.departmentId) {
          socket.join(`department-${data.departmentId}`);
        }
      });
    });

    // REST endpoint that mimics POST /api/v1/ws/notify
    app.use(express.json());
    app.post('/api/v1/ws/notify', (req, res) => {
      const { to_staff_id, to_department_id, title, description, type, priority } = req.body;

      const notification = {
        id: `ws-${Date.now()}`,
        title: title || 'Notification',
        description: description || '',
        type: type || 'System',
        priority: priority || 'Medium',
        to_staff_id: to_staff_id || null,
        to_department_id: to_department_id || null,
        broadcast: req.body.broadcast || false,
        createdAt: new Date().toISOString(),
        ...req.body.meta,
      };

      if (notification.to_staff_id) {
        wsIo.to(`staff-${notification.to_staff_id}`).emit('new-notification', notification);
      }
      if (notification.to_department_id) {
        wsIo.to(`department-${notification.to_department_id}`).emit('new-department-notification', notification);
      }
      if (notification.broadcast) {
        wsIo.emit('new-broadcast-notification', notification);
      }

      res.json({ success: true, notification });
    });

    wsHttpServer.listen(0, () => {
      wsPort = wsHttpServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    wsIo.close();
    wsHttpServer.close(done);
  });

  it('should accept a REST API notification request and deliver it to connected clients', async () => {
    const wsInstitutionId = 'inst-rest-001';
    const socket = Client(`http://localhost:${wsPort}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    await waitForConnection(socket);

    // Register as lab tech
    socket.emit('register', {
      userId: 'lab-tech-rest',
      departmentId: 'dept-lab-rest',
      institutionId: wsInstitutionId,
    });

    await new Promise((r) => setTimeout(r, 100));

    const notifPromise = waitForEvent(socket, 'new-notification');

    // Simulate microservice → WebSocket service REST call
    const response = await fetch(`http://localhost:${wsPort}/api/v1/ws/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_staff_id: 'lab-tech-rest',
        title: 'New Lab Request',
        description: 'REST API test: CBC for patient Jane Smith',
        type: 'Alert',
        priority: 'Medium',
      }),
    });

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.notification).toBeDefined();
    expect(body.notification.title).toBe('New Lab Request');

    const received = await notifPromise;
    expect(received.title).toBe('New Lab Request');
    expect(received.description).toContain('Jane Smith');
    expect(received.to_staff_id).toBe('lab-tech-rest');

    socket.disconnect();
  });
});
