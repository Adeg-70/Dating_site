const redis = require("redis");
const { RateLimiterRedis } = require("rate-limiter-flexible");

// Create Redis client (install: npm install redis rate-limiter-flexible)
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  enable_offline_queue: false,
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

class BandwidthThrottler {
  constructor() {
    this.userLimiters = new Map();
    this.globalLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: "global_bandwidth",
      points: 100 * 1024 * 1024, // 100 MB per second globally
      duration: 1,
    });

    this.initializeUserLimiters();
  }

  initializeUserLimiters() {
    // Default: 10 MB/s per user, configurable per user tier
    this.defaultUserLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: "user_bandwidth",
      points: 10 * 1024 * 1024, // 10 MB per second
      duration: 1,
    });
  }

  async throttleUser(userId, bytes) {
    try {
      // Check global bandwidth
      await this.globalLimiter.consume("global", bytes);

      // Check user-specific bandwidth
      await this.defaultUserLimiter.consume(userId, bytes);

      return true;
    } catch (rejRes) {
      if (rejRes instanceof Error) {
        throw rejRes;
      }

      // Calculate wait time
      const waitSeconds = Math.ceil(rejRes.msBeforeNext / 1000);
      throw new Error(
        `Bandwidth limit exceeded. Try again in ${waitSeconds} seconds.`
      );
    }
  }

  async getUserBandwidthUsage(userId) {
    try {
      const globalRes = await this.globalLimiter.get("global");
      const userRes = await this.defaultUserLimiter.get(userId);

      return {
        global: {
          remaining: globalRes?.remainingPoints || 0,
          total: this.globalLimiter.points,
        },
        user: {
          remaining: userRes?.remainingPoints || 0,
          total: this.defaultUserLimiter.points,
        },
      };
    } catch (error) {
      console.error("Error getting bandwidth usage:", error);
      return null;
    }
  }

  async setUserBandwidthLimit(userId, bytesPerSecond) {
    // For premium users or custom bandwidth limits
    const userLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: "user_bandwidth",
      points: bytesPerSecond,
      duration: 1,
    });

    this.userLimiters.set(userId, userLimiter);
  }

  async cleanup() {
    await redisClient.quit();
  }
}

module.exports = new BandwidthThrottler();
