const redis = require("redis");

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 10000,
    lazyConnect: true,
  },
});

// Cache middleware
const cache = (duration) => {
  return async (req, res, next) => {
    if (req.method !== "GET") return next();

    const key = `cache:${req.originalUrl}`;
    const cached = await redisClient.get(key);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Override res.json to cache response
    const originalJson = res.json;
    res.json = function (data) {
      redisClient.setEx(key, duration, JSON.stringify(data));
      originalJson.call(this, data);
    };

    next();
  };
};

module.exports = { redisClient, cache };
