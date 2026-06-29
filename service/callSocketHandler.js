// Call Socket Handler - WebSocket events for real-time department calls
const CallHistory = require('../models/CallHistory');

class CallSocketHandler {
  constructor(io) {
    this.io = io;
    this.activeCalls = new Map(); // Track active calls
    this.onlineUsers = new Map(); // Track online users by department
    
    this.setupEventHandlers();
  } 

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Register user for call notifications
      socket.on('register', async (data) => {
        const { userId, departmentId } = data;
        
        // Join user's personal room and department room
        socket.join(`user:${userId}`);
        socket.join(`department:${departmentId}`);
        
        // Track online status
        if (!this.onlineUsers.has(departmentId)) {
          this.onlineUsers.set(departmentId, new Map());
        }
        this.onlineUsers.get(departmentId).set(userId, {
          socketId: socket.id,
          userId,
          departmentId,
          onlineAt: new Date()
        });
        
        // Notify others in department
        socket.to(`department:${departmentId}`).emit('user-online', { userId });
        
        console.log(`User ${userId} registered for calls in department ${departmentId}`);
      });

      // Initiate department call
      socket.on('initiate-department-call', async (data) => {
        await this.handleInitiateCall(socket, data);
      });

      // Accept incoming call
      socket.on('accept-call', async (data) => {
        await this.handleAcceptCall(socket, data);
      });

      // Reject incoming call
      socket.on('reject-call', async (data) => {
        await this.handleRejectCall(socket, data);
      });

      // End call
      socket.on('end-call', async (data) => {
        await this.handleEndCall(socket, data);
      });

      // WebRTC signaling
      socket.on('webrtc-signal', (data) => {
        this.handleWebRTCSignal(socket, data);
      });

      // Join call room
      socket.on('join-call-room', (data) => {
        const { roomName } = data;
        socket.join(roomName);
        socket.to(roomName).emit('user-joined', { socketId: socket.id });
      });

      // Leave call room
      socket.on('leave-call-room', (data) => {
        const { roomName } = data;
        socket.leave(roomName);
        socket.to(roomName).emit('user-left', { socketId: socket.id });
      });

      // Get online staff in department
      socket.on('get-online-staff', (data) => {
        const { departmentId } = data;
        const deptUsers = this.onlineUsers.get(departmentId);
        
        if (deptUsers) {
          socket.emit('online-staff', {
            departmentId,
            staff: Array.from(deptUsers.values())
          });
        }
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  // Handle initiating a department call
  async handleInitiateCall(socket, data) {
    const { targetDepartmentId, caller_id, caller_name, caller_department_id, receiver_id, call_type, institution_id } = data;
    
    try {
      // Create call record in database
      const call = await CallHistory.create({
        caller_id,
        caller_name,
        caller_department_id,
        receiver_id,
        call_type: call_type || 'video',
        status: 'initiated',
        room_name: `call-${Date.now()}`,
        institution_id,
        start_time: new Date()
      });

      // Track active call
      this.activeCalls.set(call.id, {
        callId: call.id,
        caller_id,
        caller_name,
        caller_department_id,
        targetDepartmentId,
        status: 'initiated',
        room_name: call.room_name,
        createdAt: new Date()
      });

      // Notify target department
      // NOTE: keep payload compatible with frontend's `incoming-call` handler
      this.io.to(`department:${targetDepartmentId}`).emit('incoming-call', {
        id: call.id,
        callId: call.id,
        caller_id,
        caller_name,
        caller_department_id,
        receiver_department_id: targetDepartmentId,
        call_type: call_type || 'video',
        room_name: call.room_name,
        status: 'ringing',
      });



      // Send confirmation to caller
      socket.emit('call-initiated', {
        callId: call.id,
        room_name: call.room_name,
        status: 'ringing'
      });

      // Set timeout for missed call
      setTimeout(async () => {
        const activeCall = this.activeCalls.get(call.id);
        if (activeCall && activeCall.status === 'initiated') {
          await CallHistory.update(
            { status: 'missed' },
            { where: { id: call.id } }
          );
          this.activeCalls.delete(call.id);
          
          // Notify caller
          socket.emit('call-missed', { callId: call.id });
        }
      }, 30000); // 30 seconds timeout

    } catch (error) {
      console.error('Error initiating call:', error);
      socket.emit('call-error', { message: 'Failed to initiate call' });
    }
  }

  // Handle accepting a call
  async handleAcceptCall(socket, data) {
    const { callId } = data;
    
    try {
      const call = await CallHistory.findByPk(callId);
      if (!call) {
        return socket.emit('call-error', { message: 'Call not found' });
      }

      // Update call status
      call.status = 'accepted';
      call.receiver_id = data.receiver_id || call.receiver_id;
      call.receiver_name = data.receiver_name || call.receiver_name;
      await call.save();

      // Update active call
      const activeCall = this.activeCalls.get(callId);
      if (activeCall) {
        activeCall.status = 'accepted';
      }

      // Notify caller
      this.io.to(`user:${call.caller_id}`).emit('call-accepted', {
        callId: call.id,
        call: call
      });

      // Notify both parties
      socket.emit('call-accepted', { callId: call.id, call });

    } catch (error) {
      console.error('Error accepting call:', error);
      socket.emit('call-error', { message: 'Failed to accept call' });
    }
  }

  // Handle rejecting a call
  async handleRejectCall(socket, data) {
    const { callId, reason } = data;
    
    try {
      const call = await CallHistory.findByPk(callId);
      if (!call) {
        return socket.emit('call-error', { message: 'Call not found' });
      }

      // Update call status
      call.status = 'rejected';
      await call.save();

      // Remove from active calls
      this.activeCalls.delete(callId);

      // Notify caller
      this.io.to(`user:${call.caller_id}`).emit('call-rejected', {
        callId: call.id,
        reason: reason || 'Call rejected'
      });

    } catch (error) {
      console.error('Error rejecting call:', error);
      socket.emit('call-error', { message: 'Failed to reject call' });
    }
  }

  // Handle ending a call
  async handleEndCall(socket, data) {
    const { callId } = data;
    
    try {
      const call = await CallHistory.findByPk(callId);
      if (!call) {
        return socket.emit('call-error', { message: 'Call not found' });
      }

      // Update call status
      call.status = 'completed';
      call.end_time = new Date();
      
      // Calculate duration
      const start = new Date(call.start_time);
      const end = new Date(call.end_time);
      call.duration_seconds = Math.floor((end - start) / 1000);
      
      await call.save();

      // Remove from active calls
      this.activeCalls.delete(callId);

      // Notify both parties
      this.io.to(`user:${call.caller_id}`).emit('call-ended', { callId: call.id });
      if (call.receiver_id) {
        this.io.to(`user:${call.receiver_id}`).emit('call-ended', { callId: call.id });
      }

      // Leave call room
      socket.to(call.room_name).emit('user-left', { socketId: socket.id });

    } catch (error) {
      console.error('Error ending call:', error);
      socket.emit('call-error', { message: 'Failed to end call' });
    }
  }

  // Handle WebRTC signaling
  handleWebRTCSignal(socket, data) {
    const { callId, signal } = data;
    
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall) return;

    // Forward signal to the other participant
    const roomName = activeCall.room_name;
    socket.to(roomName).emit('webrtc-signal', {
      callId,
      signal,
      from: socket.id
    });
  }

  // Handle disconnect
  handleDisconnect(socket) {
    // Remove from online users
    for (const [deptId, users] of this.onlineUsers.entries()) {
      for (const [userId, userData] of users.entries()) {
        if (userData.socketId === socket.id) {
          users.delete(userId);
          
          // Notify department
          this.io.to(`department:${deptId}`).emit('user-offline', { userId });
          
          // Check if user was in a call
          for (const [callId, callData] of this.activeCalls.entries()) {
            if (callData.caller_id === userId || callData.receiver_id === userId) {
              this.handleEndCall(socket, { callId });
            }
          }
          
          console.log(`User ${userId} disconnected from department ${deptId}`);
          break;
        }
      }
      
      // Clean up empty departments
      if (users.size === 0) {
        this.onlineUsers.delete(deptId);
      }
    }
  }

  // Get active calls count
  getActiveCallsCount() {
    return this.activeCalls.size;
  }

  // Get online users count
  getOnlineUsersCount() {
    let count = 0;
    for (const users of this.onlineUsers.values()) {
      count += users.size;
    }
    return count;
  }
}

module.exports = CallSocketHandler;
