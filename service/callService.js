const { createRedisClient } = require('../redis/redisClient');

class CallService {
  constructor(io) {
    this.io = io;
    this.activeUsers = new Map();
    this.departmentCalls = new Map();
    this.redisClient = null;
    this.initialize();
  }

  async initialize() {
    this.redisClient = await createRedisClient();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('User connected:', socket.id);

      // Register user with complete user object
      socket.on('register', async (userData) => {
        await this.handleUserRegistration(socket, userData);
      });

      // Admin initiates a call
      socket.on('initiate-call', (data) => {
        this.handleCallInitiation(socket, data);
      });

      // Initiate department call
      socket.on('initiate-department-call', (data) => {
        this.handleDepartmentCallInitiation(socket, data);
      });

      // User responds to call
      socket.on('accept-call', (data) => {
        this.handleCallAcceptance(socket, data);
      });

      socket.on('reject-call', (data) => {
        this.handleCallRejection(socket, data);
      });

      // Department staff responds to call
      socket.on('answer-department-call', (data) => {
        this.handleDepartmentCallAnswer(socket, data);
      });

      socket.on('reject-department-call', (data) => {
        this.handleDepartmentCallRejection(socket, data);
      });

      // WebRTC signaling
      socket.on('signal', (data) => {
        this.handleSignaling(socket, data);
      });

      // Get online users
      socket.on('get-online-users', () => {
        this.handleGetOnlineUsers(socket);
      });

      // Get department staff
      socket.on('get-department-staff', (data) => {
        this.handleGetDepartmentStaff(socket, data);
      });

      // Cleanup on disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  async handleUserRegistration(socket, userData) {
    console.log('Registering user:', userData, socket.id);
    try {
      // 1. Validate userData exists and has required fields
      if (!userData || !userData.id) {
        throw new Error('Invalid user data: missing required fields');
      }

      // 2. Prepare user object with fallbacks
      const userObject = {
        socketId: socket.id,
        id: userData.id,
        name: userData.name || `${userData.first_name || ''} ${userData.middle_name || ''} ${userData.last_name || ''}`.trim(),
        email: userData.email || '',
        department: userData.department || null,
        role: userData.role_manager || 'user',
        avatar: userData.avatar || null,
        status: 'available',
        lastSeen: new Date().toISOString()
      };

      // 3. Store in memory
      this.activeUsers.set(socket.id, {
        ...userObject,
        socket
      });

      // 4. Store in Redis
      await this.redisClient.HSET(
        'activeUsers',
        userData.id,
        JSON.stringify(userObject)
      );

      console.log(`User ${userObject.name} (${userObject.role}) registered successfully`);

      // Notify client of successful registration
      socket.emit('register-success', {
        userId: userData.id,
        status: 'registered'
      });

    } catch (error) {
      console.error('Registration error:', error);
      socket.emit('register-error', {
        message: error.message || 'Registration failed',
        details: error.stack
      });

      // Optionally disconnect if registration fails
      if (error instanceof TypeError) {
        socket.disconnect(true);
      }
    }
  }

  handleCallInitiation(socket, data) {
    // Implement your call initiation logic here
    console.log('Call initiated:', data);
  }

  async handleDepartmentCallInitiation(socket, { departmentId, callerId, callerName, callerAvatar }) {
    try {
      console.log('Initiating department call to department:', departmentId);

      // 1. Get caller data from memory
      const callerData = this.activeUsers.get(socket.id);
      if (!callerData) {
        console.error('Caller not found in active users');
        return socket.emit('call-error', { message: 'Caller not registered' });
      }

      // 2. Get all active users from Redis
      const activeUsers = await this.redisClient.HGETALL('activeUsers');
      console.log('Raw Redis active users:', activeUsers);

      // 3. Filter department staff - FIXED COMPARISON
      const departmentStaff = Object.entries(activeUsers)
        .filter(([userId, userJson]) => {
          try {
            const user = JSON.parse(userJson);
            console.log('Checking user:', userId, 'Department:', user.department?.id, 'Type:', typeof user.department?.id);

            // Handle both string and object department formats
            const userDeptId = typeof user.department === 'object'
              ? user.department.id
              : user.department;

            return userDeptId === departmentId &&
              user.status === 'available' &&
              userId !== callerId;
          } catch (e) {
            console.error('Error parsing user data:', e);
            return false;
          }
        })
        .map(([userId, userJson]) => {
          const user = JSON.parse(userJson);
          return {
            ...user,
            userId,
            socketId: user.socketId,
            // Normalize department to ID only
            department: typeof user.department === 'object'
              ? user.department.id
              : user.department
          };
        });

      console.log('Filtered department staff:', departmentStaff);

      if (departmentStaff.length === 0) {
        console.error('No available staff in department', departmentId);
        return socket.emit('call-error', {
          message: 'No staff available in this department',
          departmentId
        });
      }

      // 4. Create call record
      const callId = this.generateCallId();
      this.departmentCalls.set(callId, {
        departmentId,
        callerId,
        callerSocketId: socket.id,
        status: 'ringing',
        staff: departmentStaff,
        startTime: new Date()
      });

      // 5. Notify all available staff
      departmentStaff.forEach(staff => {
        if (!staff.socketId) {
          console.error('Staff missing socketId:', staff.userId);
          return;
        }

        console.log(`Notifying ${staff.userId} at socket ${staff.socketId}`);
        this.io.to(staff.socketId).emit('incoming-department-call', {
          callId,
          departmentId,
          callerId,
          callerName,
          callerAvatar,
          timestamp: new Date().toISOString()
        });
      });

      // 6. Confirm to caller
      socket.emit('department-call-initiated', {
        callId,
        staffCount: departmentStaff.length,
        departmentId
      });

    } catch (error) {
      console.error('Department call initiation failed:', error);
      socket.emit('call-error', {
        message: 'Failed to initiate department call',
        error: error.message
      });
    }
  }

  handleCallAcceptance(socket, data) {
    // Implement your call acceptance logic here
    console.log('Call accepted:', data);
  }

  // In your CallService class

  handleDepartmentCallRejection(socket, { callId, reason }) {
    try {
      const callData = this.departmentCalls.get(callId);
      if (!callData) {
        console.error('Call not found:', callId);
        return;
      }

      // Notify the caller that the call was rejected
      this.io.to(callData.callerSocketId).emit('department-call-rejected', {
        callId,
        reason,
        timestamp: new Date().toISOString()
      });

      // Update call status
      callData.status = 'rejected';
      this.departmentCalls.set(callId, callData);

      console.log(`Department call ${callId} rejected by ${socket.id}`);

    } catch (error) {
      console.error('Error handling department call rejection:', error);
    }
  }

  handleDepartmentCallAnswer(socket, { callId, answererId }) {
    const callData = this.departmentCalls.get(callId);
    if (!callData) {
      socket.emit('call-error', { message: 'Call not found' });
      return;
    }

    // Update call data
    callData.answeredSocketId = socket.id;
    callData.answererId = answererId;
    callData.status = 'in-call';
    this.departmentCalls.set(callId, callData);

    // Notify the caller that call was answered
    this.io.to(callData.callerSocketId).emit('department-call-accepted', {
      callId,
      answererId,
      timestamp: new Date().toISOString()
    });

    // Notify the answerer that their answer was successful
    socket.emit('department-call-answered', {
      callId,
      callerId: callData.callerId,
      timestamp: new Date().toISOString()
    });

    // Start WebRTC negotiation
    this.createWebRTCRoom(callId, callData.callerSocketId, socket.id);

    console.log(`Call ${callId} answered by ${answererId}`);
  }


  handleDepartmentCallRejection(socket, data) {
    // Implement your department call rejection logic here
    console.log('Department call rejected:', data);
  }

  handleSignaling(socket, { callId, signal }) {
    // Forward signaling data to the other participant
    const callData = this.activeCalls.get(callId) || this.departmentCalls.get(callId);
    if (!callData) return;

    let targetSocketId;
    if (callData.callerSocketId === socket.id) {
      targetSocketId = callData.recipientSocketId || callData.answeredSocketId;
    } else {
      targetSocketId = callData.callerSocketId;
    }

    if (targetSocketId) {
      this.io.to(targetSocketId).emit('signal', { callId, signal });
    }
  }

  // Helper method for WebRTC room creation
  createWebRTCRoom(callId, socketId1, socketId2) {
    // Implement your specific WebRTC room creation logic here
    console.log(`Created WebRTC room for call ${callId} between ${socketId1} and ${socketId2}`);

    // Example: Notify both parties to start WebRTC negotiation
    this.io.to(socketId1).emit('start-webrtc', { callId });
    this.io.to(socketId2).emit('start-webrtc', { callId });
  }

  async handleGetOnlineUsers(socket) {
    try {
      const users = await this.redisClient.HGETALL('activeUsers');
      const onlineUsers = Object.entries(users).map(([id, data]) => ({
        id,
        ...JSON.parse(data)
      }));
      socket.emit('online-users-list', onlineUsers);
    } catch (error) {
      console.error('Error fetching online users:', error);
      socket.emit('online-users-error', { message: 'Failed to fetch online users' });
    }
  }

  async handleGetDepartmentStaff(socket, departmentId) {
    try {
      const allUsers = await this.redisClient.HGETALL('activeUsers');
      const staff = Object.entries(allUsers)
        .filter(([_, userData]) => {
          const parsed = JSON.parse(userData);
          return parsed.department === departmentId;
        })
        .map(([userId, userData]) => {
          const parsed = JSON.parse(userData);
          return {
            id: userId,
            name: parsed.name,
            status: parsed.status,
            avatar: parsed.avatar,
            lastSeen: parsed.lastSeen
          };
        });

      socket.emit('department-staff-list', {
        departmentId,
        staff
      });
    } catch (error) {
      console.error('Error fetching department staff:', error);
      socket.emit('department-staff-error', {
        message: 'Failed to fetch department staff'
      });
    }
  }

  async handleDisconnect(socket) {
    const userData = this.activeUsers.get(socket.id);
    if (userData) {
      try {
        // Update status in Redis
        await this.redisClient.HSET(
          'activeUsers',
          userData.id,
          JSON.stringify({
            ...JSON.parse(await this.redisClient.HGET('activeUsers', userData.id)),
            status: 'offline',
            lastSeen: new Date().toISOString()
          })
        );

        console.log(`User ${userData.name} disconnected`);
      } catch (error) {
        console.error('Disconnection error:', error);
      }
      this.activeUsers.delete(socket.id);
    }
  }

  generateCallId() {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }
}

module.exports = CallService;