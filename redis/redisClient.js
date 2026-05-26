// redis/redisClient.js
const { createClient } = require('redis');

let redisClient;

async function createRedisClient() {
  if (!redisClient || !redisClient.isOpen) {
    redisClient = createClient({
      socket: {
        host: '127.0.0.1',
        port: 6379
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    console.log('Connected to Redis');
  }

  return redisClient;
}

module.exports = { createRedisClient };