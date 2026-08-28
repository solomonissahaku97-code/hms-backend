/**
 * WebSocket Service — REST API
 *
 * Microservices call these endpoints to emit real-time events.
 * Auth: X-Service-Key header or Bearer token.
 *
 * POST /api/v1/ws/notify          — Send notification
 * POST /api/v1/ws/notify/department — Send to department
 * POST /api/v1/ws/notify/broadcast  — System-wide broadcast
 * POST /api/v1/ws/chat           — Send chat message
 * POST /api/v1/ws/emit           — Generic event emit
 * GET  /api/v1/ws/stats          — Connection stats
 * GET  /api/v1/ws/online/:departmentId — Online users in dept
 */

const express = require('express');
const router = express.Router();
const { authenticateRest } = require('../middleware/auth');

// All routes require auth
router.use(authenticateRest);

/**
 * POST /api/v1/ws/notify
 * Send notification to a specific user or department
 */
router.post('/notify', (req, res) => {
  const { hmsSocketService } = req.app.locals;
  if (!hmsSocketService) {
    return res.status(503).json({ error: 'WebSocket service not ready' });
  }

  const { to_staff_id, to_department_id, title, description, type, priority, broadcast, meta } = req.body;

  if (!to_staff_id && !to_department_id && !broadcast) {
    return res.status(400).json({ error: 'Must specify to_staff_id, to_department_id, or broadcast=true' });
  }

  const notification = {
    id: meta?.id || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title || 'Notification',
    description: description || '',
    type: type || 'System',
    priority: priority || 'Medium',
    to_staff_id: to_staff_id || null,
    to_department_id: to_department_id || null,
    broadcast: broadcast || false,
    from_staff_id: meta?.from_staff_id || null,
    institution_id: meta?.institution_id || null,
    createdAt: new Date().toISOString(),
    ...meta,
  };

  hmsSocketService.emitNotification(notification);

  console.log(`📤 API: Notification sent → ${to_staff_id ? `staff:${to_staff_id}` : ''} ${to_department_id ? `dept:${to_department_id}` : ''}`);
  res.json({ success: true, notification });
});

/**
 * POST /api/v1/ws/notify/department
 * Convenience: send notification to department
 */
router.post('/notify/department', (req, res) => {
  const { hmsSocketService } = req.app.locals;
  if (!hmsSocketService) {
    return res.status(503).json({ error: 'WebSocket service not ready' });
  }

  const { department_id, title, description, type, priority, meta } = req.body;

  if (!department_id) {
    return res.status(400).json({ error: 'department_id required' });
  }

  const notification = {
    id: meta?.id || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title || 'Department Notification',
    description: description || '',
    type: type || 'Department',
    priority: priority || 'Medium',
    to_department_id: department_id,
    from_staff_id: meta?.from_staff_id || null,
    institution_id: meta?.institution_id || null,
    createdAt: new Date().toISOString(),
    ...meta,
  };

  hmsSocketService.emitNotification(notification);
  console.log(`📤 API: Department notification → dept:${department_id}`);
  res.json({ success: true, notification });
});

/**
 * POST /api/v1/ws/notify/broadcast
 * System-wide broadcast
 */
router.post('/notify/broadcast', (req, res) => {
  const { hmsSocketService } = req.app.locals;
  if (!hmsSocketService) {
    return res.status(503).json({ error: 'WebSocket service not ready' });
  }

  const { title, description, type, priority, meta } = req.body;

  const notification = {
    id: meta?.id || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title || 'System Announcement',
    description: description || '',
    type: type || 'System',
    priority: priority || 'Medium',
    broadcast: true,
    createdAt: new Date().toISOString(),
    ...meta,
  };

  hmsSocketService.emitNotification(notification);
  console.log(`📤 API: Broadcast notification sent`);
  res.json({ success: true, notification });
});

/**
 * POST /api/v1/ws/chat
 * Send chat message to room or department
 */
router.post('/chat', (req, res) => {
  const { hmsSocketService } = req.app.locals;
  if (!hmsSocketService) {
    return res.status(503).json({ error: 'WebSocket service not ready' });
  }

  const { room_id, department_id, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }

  hmsSocketService.emitChatMessage(room_id, message, department_id);
  console.log(`📤 API: Chat message → room:${room_id || 'none'} dept:${department_id || 'none'}`);
  res.json({ success: true });
});

/**
 * POST /api/v1/ws/emit
 * Generic event emission — emit any event to any target
 */
router.post('/emit', (req, res) => {
  const { hmsSocketService } = req.app.locals;
  if (!hmsSocketService) {
    return res.status(503).json({ error: 'WebSocket service not ready' });
  }

  const { event, target, target_type, data } = req.body;

  if (!event || !target || !data) {
    return res.status(400).json({ error: 'event, target, and data required' });
  }

  switch (target_type) {
    case 'user':
      hmsSocketService.emitToUser(target, event, data);
      break;
    case 'department':
      hmsSocketService.emitToDepartment(target, event, data);
      break;
    case 'institution':
      hmsSocketService.emitToInstitution(target, event, data);
      break;
    case 'broadcast':
      hmsSocketService.broadcast(event, data);
      break;
    default:
      return res.status(400).json({ error: 'target_type must be user|department|institution|broadcast' });
  }

  console.log(`📤 API: Event "${event}" → ${target_type}:${target}`);
  res.json({ success: true });
});

/**
 * GET /api/v1/ws/stats
 * Connection statistics
 */
router.get('/stats', (req, res) => {
  const { hmsSocketService } = req.app.locals;
  if (!hmsSocketService) {
    return res.status(503).json({ error: 'WebSocket service not ready' });
  }
  res.json(hmsSocketService.getStats());
});

/**
 * GET /api/v1/ws/online/:departmentId
 * Get online users in a department
 */
router.get('/online/:departmentId', (req, res) => {
  const { hmsSocketService } = req.app.locals;
  if (!hmsSocketService) {
    return res.status(503).json({ error: 'WebSocket service not ready' });
  }
  const users = hmsSocketService.getOnlineUsers(req.params.departmentId);
  res.json({ online: users, count: users.length });
});

module.exports = router;
