const maxmind = require("maxmind");
const fetch = require("node-fetch");

// Install: npm install maxmind node-fetch
class CDNSelector {
  constructor() {
    this.geoIpDb = null;
    this.cdnProviders = {
      cloudflare: { baseUrl: "https://cdn.cloudflare.com" },
      aws: { baseUrl: "https://s3.amazonaws.com" },
      google: { baseUrl: "https://storage.googleapis.com" },
      azure: { baseUrl: "https://azure.microsoft.com" },
    };
    this.performanceMetrics = new Map();
  }

  async initialize() {
    await this.loadGeoIpDatabase();
    this.startPerformanceMonitoring();
  }

  async loadGeoIpDatabase() {
    try {
      this.geoIpDb = await maxmind.open("./geoip/GeoLite2-City.mmv");
    } catch (error) {
      console.warn("GeoIP database not found, using default CDN");
    }
  }

  async selectBestCDN(clientIp, fileSize, fileType) {
    if (!this.geoIpDb) {
      return this.cdnProviders.cloudflare; // Default
    }

    try {
      const geoData = this.geoIpDb.get(clientIp);
      if (!geoData) return this.cdnProviders.cloudflare;

      // Get region-based CDN recommendation
      const region = geoData.country?.iso_code || "US";
      const cdnScores = await this.calculateCDNScores(
        region,
        fileSize,
        fileType
      );

      // Select CDN with highest score
      let bestCdn = null;
      let highestScore = -1;

      for (const [cdnName, score] of Object.entries(cdnScores)) {
        if (score > highestScore) {
          highestScore = score;
          bestCdn = this.cdnProviders[cdnName];
        }
      }

      return bestCdn || this.cdnProviders.cloudflare;
    } catch (error) {
      console.error("CDN selection error:", error);
      return this.cdnProviders.cloudflare;
    }
  }

  async calculateCDNScores(region, fileSize, fileType) {
    const scores = {};
    const currentTime = Date.now();

    for (const [cdnName] of Object.entries(this.cdnProviders)) {
      let score = 0;

      // Region proximity (higher score for closer regions)
      const regionPerformance = this.getRegionPerformance(cdnName, region);
      score += regionPerformance * 0.4;

      // File type optimization
      score += this.getFileTypeScore(cdnName, fileType) * 0.2;

      // File size suitability
      score += this.getFileSizeScore(cdnName, fileSize) * 0.2;

      // Recent performance
      score += this.getRecentPerformance(cdnName) * 0.2;

      scores[cdnName] = score;
    }

    return scores;
  }

  getRegionPerformance(cdnName, region) {
    // Implement region-based performance scoring
    // This would typically come from performance monitoring data
    return 0.8; // Default score
  }

  getFileTypeScore(cdnName, fileType) {
    // Different CDNs may be better for different file types
    if (fileType.startsWith("video/") && cdnName === "aws") return 0.9;
    if (fileType.startsWith("image/") && cdnName === "cloudflare") return 0.8;
    return 0.7;
  }

  getFileSizeScore(cdnName, fileSize) {
    // Larger files might work better on certain CDNs
    if (fileSize > 100 * 1024 * 1024 && cdnName === "aws") return 0.9;
    if (fileSize < 10 * 1024 * 1024 && cdnName === "cloudflare") return 0.8;
    return 0.7;
  }

  getRecentPerformance(cdnName) {
    const metrics = this.performanceMetrics.get(cdnName) || {
      successRate: 0.9,
      avgSpeed: 0,
    };
    return metrics.successRate;
  }

  async startPerformanceMonitoring() {
    // Monitor CDN performance periodically
    setInterval(() => this.monitorCDNPerformance(), 30 * 60 * 1000); // Every 30 minutes
  }

  async monitorCDNPerformance() {
    for (const [cdnName, cdnInfo] of Object.entries(this.cdnProviders)) {
      try {
        const startTime = Date.now();
        const response = await fetch(`${cdnInfo.baseUrl}/ping`, {
          timeout: 5000,
        });
        const responseTime = Date.now() - startTime;

        this.updatePerformanceMetrics(cdnName, response.ok, responseTime);
      } catch (error) {
        this.updatePerformanceMetrics(cdnName, false, 0);
      }
    }
  }

  updatePerformanceMetrics(cdnName, success, responseTime) {
    let metrics = this.performanceMetrics.get(cdnName) || {
      totalRequests: 0,
      successfulRequests: 0,
      totalResponseTime: 0,
      lastUpdated: Date.now(),
    };

    metrics.totalRequests++;
    if (success) metrics.successfulRequests++;
    if (responseTime > 0) metrics.totalResponseTime += responseTime;

    metrics.successRate = metrics.successfulRequests / metrics.totalRequests;
    metrics.avgResponseTime =
      metrics.totalResponseTime / metrics.successfulRequests || 0;

    this.performanceMetrics.set(cdnName, metrics);
  }
}

module.exports = new CDNSelector();
