const tf = require("@tensorflow/tfjs-node");
const redis = require("redis");

// Install: npm install @tensorflow/tfjs-node redis
class BandwidthPredictor {
  constructor() {
    this.model = null;
    this.redisClient = redis.createClient({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
    });
    this.trainingData = [];
    this.isTraining = false;
  }

  async initialize() {
    await this.loadModel();
    await this.loadTrainingData();
    this.startTrainingInterval();
  }

  async loadModel() {
    try {
      // Try to load existing model
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

  async predictBandwidth(features) {
    if (!this.model || this.trainingData.length < 100) {
      // Not enough data, return conservative estimate
      return 1 * 1024 * 1024; // 1 MB/s default
    }

    try {
      const input = tf.tensor2d([features]);
      const prediction = this.model.predict(input);
      const bandwidth = (await prediction.data())[0];

      // Ensure reasonable values
      return Math.max(100 * 1024, Math.min(bandwidth, 100 * 1024 * 1024)); // 100KB/s to 100MB/s
    } catch (error) {
      console.error("Prediction error:", error);
      return 1 * 1024 * 1024;
    }
  }

  async addTrainingSample(features, actualBandwidth) {
    this.trainingData.push({ features, actualBandwidth });

    // Store in Redis for persistence
    await this.redisClient.lPush(
      "bandwidth_training_data",
      JSON.stringify({ features, actualBandwidth, timestamp: Date.now() })
    );

    // Keep only recent data (last 10,000 samples)
    await this.redisClient.lTrim("bandwidth_training_data", 0, 9999);

    // Train if we have enough data
    if (this.trainingData.length >= 100 && !this.isTraining) {
      this.trainModel();
    }
  }

  async loadTrainingData() {
    try {
      const data = await this.redisClient.lRange(
        "bandwidth_training_data",
        0,
        -1
      );
      this.trainingData = data.map((item) => JSON.parse(item));
    } catch (error) {
      console.error("Error loading training data:", error);
      this.trainingData = [];
    }
  }

  async trainModel() {
    if (this.isTraining || this.trainingData.length < 100) return;

    this.isTraining = true;
    console.log("Training bandwidth prediction model...");

    try {
      // Prepare training data
      const features = this.trainingData.map((item) => item.features);
      const labels = this.trainingData.map((item) => item.actualBandwidth);

      const featuresTensor = tf.tensor2d(features);
      const labelsTensor = tf.tensor2d(labels, [labels.length, 1]);

      // Train the model
      await this.model.fit(featuresTensor, labelsTensor, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(`Epoch ${epoch}: loss = ${logs.loss}`);
            }
          },
        },
      });

      // Save the model
      await this.model.save("file://./models/bandwidth/");
      console.log("Bandwidth prediction model trained and saved");
    } catch (error) {
      console.error("Training error:", error);
    } finally {
      this.isTraining = false;
      // Clean up old data (older than 30 days)
      await this.cleanOldTrainingData();
    }
  }

  async cleanOldTrainingData() {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.trainingData = this.trainingData.filter(
      (item) => item.timestamp > thirtyDaysAgo
    );

    await this.redisClient.del("bandwidth_training_data");
    for (const item of this.trainingData) {
      await this.redisClient.lPush(
        "bandwidth_training_data",
        JSON.stringify(item)
      );
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

  extractFeatures(networkInfo, historicalData) {
    return [
      networkInfo.downlink || 0,
      networkInfo.rtt || 0,
      networkInfo.effectiveType === "4g" ? 1 : 0,
      networkInfo.effectiveType === "3g" ? 1 : 0,
      networkInfo.effectiveType === "2g" ? 1 : 0,
      historicalData.avgBandwidth || 0,
      historicalData.peakBandwidth || 0,
      historicalData.successRate || 0,
      historicalData.uploadCount || 0,
      (Date.now() % (24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000), // Time of day
    ];
  }
}

module.exports = new BandwidthPredictor();
