const bull = require("bull");
const UploadSession = require("../models/UploadSession");
const chunkStorage = require("../utils/chunkStorage");

// Install: npm install bull
class UploadQueue {
  constructor() {
    this.queues = new Map();
    this.initializeQueues();
  }

  initializeQueues() {
    // High priority queue for instant messages
    this.highPriorityQueue = new bull("uploads-high", {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
      },
      limiter: {
        max: 10, // Max 10 jobs per second
        duration: 1000,
      },
    });

    // Normal priority queue
    this.normalPriorityQueue = new bull("uploads-normal", {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
      },
      limiter: {
        max: 5, // Max 5 jobs per second
        duration: 1000,
      },
    });

    // Low priority queue for background uploads
    this.lowPriorityQueue = new bull("uploads-low", {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
      },
      limiter: {
        max: 2, // Max 2 jobs per second
        duration: 1000,
      },
    });

    this.setupWorkers();
  }

  setupWorkers() {
    // High priority worker
    this.highPriorityQueue.process(5, async (job) => {
      // 5 concurrent jobs
      return await this.processUploadJob(job);
    });

    // Normal priority worker
    this.normalPriorityQueue.process(3, async (job) => {
      return await this.processUploadJob(job);
    });

    // Low priority worker
    this.lowPriorityQueue.process(1, async (job) => {
      return await this.processUploadJob(job);
    });
  }

  async processUploadJob(job) {
    const { sessionId, chunkNumber, chunkData } = job.data;

    try {
      const session = await UploadSession.findOne({ sessionId });
      if (!session) {
        throw new Error("Session not found");
      }

      await chunkStorage.saveChunk(sessionId, chunkNumber, chunkData);

      session.uploadedChunks.push(chunkNumber);
      session.uploadedChunks.sort((a, b) => a - b);

      if (session.uploadedChunks.length === session.totalChunks) {
        await this.completeUpload(session);
      } else {
        await session.save();
      }

      return { success: true, chunkNumber };
    } catch (error) {
      throw error;
    }
  }

  async addToQueue(sessionId, chunkNumber, chunkData, priority = "normal") {
    const jobData = {
      sessionId,
      chunkNumber,
      chunkData: chunkData.toString("base64"),
      timestamp: Date.now(),
    };

    let queue;
    switch (priority) {
      case "high":
        queue = this.highPriorityQueue;
        break;
      case "low":
        queue = this.lowPriorityQueue;
        break;
      default:
        queue = this.normalPriorityQueue;
    }

    const job = await queue.add(jobData, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      timeout: 30000, // 30 seconds timeout
    });

    return job.id;
  }

  async getQueueStats() {
    const [highStats, normalStats, lowStats] = await Promise.all([
      this.highPriorityQueue.getJobCounts(),
      this.normalPriorityQueue.getJobCounts(),
      this.lowPriorityQueue.getJobCounts(),
    ]);

    return {
      high: highStats,
      normal: normalStats,
      low: lowStats,
    };
  }

  async cleanup() {
    await this.highPriorityQueue.close();
    await this.normalPriorityQueue.close();
    await this.lowPriorityQueue.close();
  }
}

module.exports = new UploadQueue();
