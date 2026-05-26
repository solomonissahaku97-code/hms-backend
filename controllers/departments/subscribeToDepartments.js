// const redisClient = require('../config/redis');

// async function subscribeToDepartments() {
//   const client = await redisClient.createRedisClient();
  
//   // Get all departments from Redis
//   const departments = await client.hGetAll('departments');
  
//   // Subscribe each department to its own channel
//   const subscriber = client.duplicate();
//   await subscriber.connect();

//   Object.keys(departments).forEach(departmentId => {
//     subscriber.subscribe(`department:${departmentId}`, (message) => {
//       console.log(`📢 Notification for Department ${departmentId}:`, message);
//     });
//   });

//   console.log('✅ Departments are subscribed to Redis notifications.');
// }

// subscribeToDepartments();
