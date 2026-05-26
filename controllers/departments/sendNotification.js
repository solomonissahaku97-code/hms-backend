const redisClient = require('../config/redis');

async function sendNotification(departmentId, message) {
  const client = await redisClient.createRedisClient();
  await client.publish(`department:${departmentId}`, message);
  console.log(`📨 Sent message to Department ${departmentId}: ${message}`);
}

export {
    sendNotification
}