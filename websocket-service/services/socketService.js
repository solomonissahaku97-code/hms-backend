/**
 * HMS WebSocket Service — Core Event Handler
 *
 * Centralized Socket.IO server that handles:
 * - Notifications (lab, maternity, admission, etc.)
 * - Chat/messaging
 * - Calls (video, voice, department)
 * - Real-time updates (status changes, alerts)
 *
 * All microservices emit events to this service via REST API.
 * Clients connect directly to this service.
 */

class HMSSocketService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> Set<socketId>
    this.connectedDepartments = new Map(); // departmentId -> Set<socketId>
    this.connectedInstitutions = new Map(); // institutionId -> Set<socketId>

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const user = socket.data.user;
      console.log(`🔔 WebSocket connected: ${socket.id} (user: ${user?.id || 'unknown'})`);

      // ── Register user ──────────────────────────────────────
      socket.on('register', (data) => this.handleRegister(socket, data));

      // ── Join rooms ─────────────────────────────────────────
      socket.on('join-notification-room', (data) => this.handleJoinNotificationRoom(socket, data));
      socket.on('leave-notification-room', (data) => this.handleLeaveNotificationRoom(socket, data));
      socket.on('join-institution-room', (data) => this.handleJoinInstitutionRoom(socket, data));
      socket.on('join-chat-room', (data) => this.handleJoinChatRoom(socket, data));
      socket.on('leave-chat-room', (data) => this.handleLeaveChatRoom(socket, data));
      socket.on('join-department-chat', (data) => this.handleJoinDepartmentChat(socket, data));

      // ── Notifications ──────────────────────────────────────
      socket.on('mark-notification-read', (data) => this.handleMarkNotificationRead(socket, data));
      socket.on('mark-all-notifications-read', (data) => this.handleMarkAllNotificationsRead(socket, data));

      // ── Chat ───────────────────────────────────────────────
      socket.on('send-message', (data) => this.handleSendMessage(socket, data));
      socket.on('typing', (data) => this.handleTyping(socket, data));

      // ── Calls ──────────────────────────────────────────────
      socket.on('call-user', (data) => this.handleCallUser(socket, data));
      socket.on('call-department', (data) => this.handleCallDepartment(socket, data));
      socket.on('accept-call', (data) => this.handleAcceptCall(socket, data));
      socket.on('reject-call', (data) => this.handleRejectCall(socket, data));
      socket.on('end-call', (data) => this.handleEndCall(socket, data));
      socket.on('signal', (data) => this.handleSignal(socket, data));

      // ── Disconnect ─────────────────────────────────────────
      socket.on('disconnect', (reason) => this.handleDisconnect(socket, reason));
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  ROOM MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  handleRegister(socket, data) {
    const { userId, departmentId, institutionId, role, name } = data;
    if (!userId) return;

    socket.data.userId = userId;
    socket.data.departmentId = departmentId;
    socket.data.institutionId = institutionId;
    socket.data.role = role;
    socket.data.name = name;

    // Track connected user
    socket.join(`staff-${userId}`);
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId).add(socket.id);

    // Auto-join department room
    if (departmentId) {
      socket.join(`department-${departmentId}`);
      if (!this.connectedDepartments.has(departmentId)) {
        this.connectedDepartments.set(departmentId, new Set());
      }
      this.connectedDepartments.get(departmentId).add(socket.id);
    }

    // Auto-join institution room
    if (institutionId) {
      socket.join(`institution-${institutionId}`);
      if (!this.connectedInstitutions.has(institutionId)) {
        this.connectedInstitutions.set(institutionId, new Set());
      }
      this.connectedInstitutions.get(institutionId).add(socket.id);
    }

    // Update online users list
    this.broadcastOnlineUsers(departmentId);
    console.log(`👤 Registered: ${userId} in dept ${departmentId || 'none'}, inst ${institutionId || 'none'}`);
  }

  handleJoinNotificationRoom(socket, { staffId, departmentId }) {
    if (staffId) socket.join(`staff-${staffId}`);
    if (departmentId) socket.join(`department-${departmentId}`);
  }

  handleLeaveNotificationRoom(socket, { staffId, departmentId }) {
    if (staffId) socket.leave(`staff-${staffId}`);
    if (departmentId) socket.leave(`department-${departmentId}`);
  }

  handleJoinInstitutionRoom(socket, { institutionId }) {
    if (institutionId) socket.join(`institution-${institutionId}`);
  }

  handleJoinChatRoom(socket, { roomId }) {
    if (roomId) socket.join(`chat-${roomId}`);
  }

  handleLeaveChatRoom(socket, { roomId }) {
    if (roomId) socket.leave(`chat-${roomId}`);
  }

  handleJoinDepartmentChat(socket, { departmentId }) {
    if (departmentId) socket.join(`dept-chat-${departmentId}`);
  }

  handleLeaveDepartmentChat(socket, { departmentId }) {
    if (departmentId) socket.leave(`dept-chat-${departmentId}`);
  }

  // ══════════════════════════════════════════════════════════════
  //  NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════

  handleMarkNotificationRead(socket, { notificationIds, staffId }) {
    if (notificationIds && staffId) {
      this.io.to(`staff-${staffId}`).emit('notification-read', { notificationIds, staffId });
    }
  }

  handleMarkAllNotificationsRead(socket, { staffId }) {
    if (staffId) {
      this.io.to(`staff-${staffId}`).emit('all-notifications-read', { staffId });
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  CHAT
  // ══════════════════════════════════════════════════════════════

  handleSendMessage(socket, data) {
    const { roomId, message, departmentId } = data;
    if (roomId) {
      this.io.to(`chat-${roomId}`).emit('new-message', message);
    }
    if (departmentId) {
      this.io.to(`dept-chat-${departmentId}`).emit('new-department-message', message);
    }
  }

  handleTyping(socket, { roomId, userId, isTyping }) {
    if (roomId) {
      socket.to(`chat-${roomId}`).emit('typing', { userId, isTyping });
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  CALLS
  // ══════════════════════════════════════════════════════════════

  handleCallUser(socket, data) {
    const { targetUserId, callType, callerInfo } = data;
    this.io.to(`staff-${targetUserId}`).emit('incoming-call', {
      callerId: socket.data.userId,
      callerInfo,
      callType,
      callId: data.callId,
    });
  }

  handleCallDepartment(socket, data) {
    const { departmentId, callType, callerInfo } = data;
    this.io.to(`department-${departmentId}`).emit('incoming-department-call', {
      callerId: socket.data.userId,
      callerInfo,
      callType,
      callId: data.callId,
    });
  }

  handleAcceptCall(socket, data) {
    const { callerId, callId } = data;
    this.io.to(`staff-${callerId}`).emit('call-accepted', {
      acceptedBy: socket.data.userId,
      callId,
    });
  }

  handleRejectCall(socket, data) {
    const { callerId, callId } = data;
    this.io.to(`staff-${callerId}`).emit('call-rejected', {
      rejectedBy: socket.data.userId,
      callId,
    });
  }

  handleEndCall(socket, data) {
    const { callId, targetUserId } = data;
    if (targetUserId) {
      this.io.to(`staff-${targetUserId}`).emit('call-ended', {
        endedBy: socket.data.userId,
        callId,
      });
    }
  }

  handleSignal(socket, data) {
    const { targetUserId, signal } = data;
    if (targetUserId) {
      this.io.to(`staff-${targetUserId}`).emit('signal', {
        signal,
        fromUserId: socket.data.userId,
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  DISCONNECT
  // ══════════════════════════════════════════════════════════════

  handleDisconnect(socket, reason) {
    const userId = socket.data.userId;
    const departmentId = socket.data.departmentId;

    if (userId && this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId).delete(socket.id);
      if (this.connectedUsers.get(userId).size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    if (departmentId && this.connectedDepartments.has(departmentId)) {
      this.connectedDepartments.get(departmentId).delete(socket.id);
      if (this.connectedDepartments.get(departmentId).size === 0) {
        this.connectedDepartments.delete(departmentId);
      }
      this.broadcastOnlineUsers(departmentId);
    }

    console.log(`🔔 WebSocket disconnected: ${socket.id} (reason: ${reason})`);
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════

  broadcastOnlineUsers(departmentId) {
    if (!departmentId) return;
    const sockets = this.io.sockets.adapter.rooms.get(`department-${departmentId}`);
    const onlineUsers = [];
    if (sockets) {
      for (const socketId of sockets) {
        const s = this.io.sockets.sockets.get(socketId);
        if (s?.data?.userId) {
          onlineUsers.push({
            userId: s.data.userId,
            name: s.data.name,
            role: s.data.role,
          });
        }
      }
    }
    this.io.to(`department-${departmentId}`).emit('online-users-list', onlineUsers);
  }

  // ══════════════════════════════════════════════════════════════
  //  PUBLIC API — Called by REST endpoints from microservices
  // ══════════════════════════════════════════════════════════════

  /**
   * Emit notification to specific staff or department
   */
  emitNotification(notification) {
    const { to_staff_id, to_department_id, broadcast } = notification;

    if (to_staff_id) {
      this.io.to(`staff-${to_staff_id}`).emit('new-notification', notification);
    }
    if (to_department_id) {
      this.io.to(`department-${to_department_id}`).emit('new-department-notification', notification);
    }
    if (broadcast) {
      this.io.emit('new-broadcast-notification', notification);
    }
  }

  /**
   * Emit chat message to room or department
   */
  emitChatMessage(roomId, message, departmentId) {
    if (roomId) {
      this.io.to(`chat-${roomId}`).emit('new-message', message);
    }
    if (departmentId) {
      this.io.to(`dept-chat-${departmentId}`).emit('new-department-message', message);
    }
  }

  /**
   * Emit to institution (all users in that institution)
   */
  emitToInstitution(institutionId, event, data) {
    this.io.to(`institution-${institutionId}`).emit(event, data);
  }

  /**
   * Emit to specific department
   */
  emitToDepartment(departmentId, event, data) {
    this.io.to(`department-${departmentId}`).emit(event, data);
  }

  /**
   * Emit to specific user
   */
  emitToUser(userId, event, data) {
    this.io.to(`staff-${userId}`).emit(event, data);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  /**
   * Get online users in a department
   */
  getOnlineUsers(departmentId) {
    const sockets = this.io.sockets.adapter.rooms.get(`department-${departmentId}`);
    const users = [];
    if (sockets) {
      for (const socketId of sockets) {
        const s = this.io.sockets.sockets.get(socketId);
        if (s?.data?.userId) {
          users.push({ userId: s.data.userId, name: s.data.name, role: s.data.role });
        }
      }
    }
    return users;
  }

  /**
   * Get stats about connected clients
   */
  getStats() {
    return {
      totalConnections: this.io.engine.clientsCount,
      uniqueUsers: this.connectedUsers.size,
      activeDepartments: this.connectedDepartments.size,
      activeInstitutions: this.connectedInstitutions.size,
    };
  }
}

module.exports = HMSSocketService;
