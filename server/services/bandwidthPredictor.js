const tf = require("@tensorflow/tfjs");
const redis = require("redis");

class BandwidthPredictor {
  constructor() {
    this.model = null;

    // FIXED: Use REDIS_URL instead of REDIS_HOST and proper connection configuration
    this.redisClient = redis.createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379", // Critical fix: REDIS_URL not REDIS_HOST
    });

    this.trainingData = [];
    this.isTraining = false;

    // Enhanced error handling
    this.redisClient.on("error", (err) => {
      console.error("Redis Client Error", err);
    });

    this.redisClient.on("connect", () => {
      console.log("Redis connection established!");
    });

    this.redisClient.on("ready", () => {
      console.log("Redis client is ready to use");
    });

    this.redisClient.on("end", () => {
      console.log("Redis connection closed");
    });
  }

  async initialize() {
    try {
      // FIXED: Added connection check with proper error handling
      if (!this.redisClient.isOpen) {
        console.log("Attempting to connect to Redis...");
        await this.redisClient.connect();
      }

      await this.loadModel();
      await this.loadTrainingData();
      this.startTrainingInterval();
    } catch (error) {
      console.error("Failed to initialize BandwidthPredictor:", error);
      // Don't throw if Redis fails - allow app to continue without this feature
      this.trainingData = []; // Use empty dataset as fallback
    }
  }

  startTrainingInterval() {
    // Train every 6 hours
    setInterval(() => {
      if (this.trainingData.length >= 100) {
        this.trainModel();
      }
    }, 6 * 60 * 60 * 1000);
  }

  async loadModel() {
    try {
      this.model = await tf.loadLayersModel(
        "file://./models/bandwidth/model.json"
      );
      console.log("Loaded existing bandwidth prediction model");
    } catch (error) {
      console.log("Creating new bandwidth prediction model");
      this.createNewModel();
    }
  }

  createNewModel() {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [10], units: 64, activation: "relu" }),
        tf.layers.dense({ units: 32, activation: "relu" }),
        tf.layers.dense({ units: 16, activation: "relu" }),
        tf.layers.dense({ units: 1, activation: "linear" }),
      ],
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "meanSquaredError",
      metrics: ["mae"],
    });
  }

  async loadTrainingData() {
    try {
      // FIXED: Added connection check before Redis operation
      if (!this.redisClient.isReady) {
        console.log("Redis not ready, using empty training data");
        this.trainingData = [];
        return;
      }

      const data = await this.redisClient.lRange(
        "bandwidth_training_data",
        0,
        -1
      );
      this.trainingData = data.map((item) => JSON.parse(item));
      console.log(
        `Loaded ${this.trainingData.length} training samples from Redis`
      );
    } catch (error) {
      console.error("Error loading training data, using empty dataset:", error);
      this.trainingData = []; // Fallback to empty array
    }
  }

  async addTrainingSample(features, actualBandwidth) {
    this.trainingData.push({ features, actualBandwidth });

    try {
      // FIXED: Only attempt Redis operations if client is ready
      if (this.redisClient.isReady) {
        await this.redisClient.lPush(
          "bandwidth_training_data",
          JSON.stringify({ features, actualBandwidth, timestamp: Date.now() })
        );
        await this.redisClient.lTrim("bandwidth_training_data", 0, 9999);
      }

      if (this.trainingData.length >= 100 && !this.isTraining) {
        this.trainModel();
      }
    } catch (error) {
      console.error("Failed to save training sample to Redis:", error);
      // Continue without Redis persistence
    }
  }

  // ... (keep the rest of your methods: predictBandwidth, trainModel, cleanOldTrainingData, startTrainingInterval, extractFeatures the same)
}

module.exports = new BandwidthPredictor();
