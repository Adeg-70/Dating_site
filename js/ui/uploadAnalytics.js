export class UploadAnalytics {
  constructor() {
    this.analyticsData = {
      totalUploads: 0,
      successfulUploads: 0,
      failedUploads: 0,
      totalBytes: 0,
      averageSpeed: 0,
      peakSpeed: 0,
    };

    this.initialize();
  }

  initialize() {
    this.loadAnalytics();
    this.setupRealTimeUpdates();
  }

  loadAnalytics() {
    try {
      const saved = localStorage.getItem("upload_analytics");
      if (saved) {
        this.analyticsData = JSON.parse(saved);
      }
    } catch (error) {
      console.warn("Failed to load upload analytics:", error);
    }
  }

  saveAnalytics() {
    try {
      localStorage.setItem(
        "upload_analytics",
        JSON.stringify(this.analyticsData)
      );
    } catch (error) {
      console.warn("Failed to save upload analytics:", error);
    }
  }

  setupRealTimeUpdates() {
    // Listen to upload events
    uploadScheduler.on("complete", (data) => {
      this.recordSuccessfulUpload(data.file.size);
    });

    uploadScheduler.on("error", (data) => {
      this.recordFailedUpload();
    });

    // Periodic saving
    setInterval(() => this.saveAnalytics(), 30000);
  }

  recordSuccessfulUpload(bytes) {
    this.analyticsData.totalUploads++;
    this.analyticsData.successfulUploads++;
    this.analyticsData.totalBytes += bytes;

    const currentSpeed = bandwidthMonitor.getCurrentSpeed();
    this.analyticsData.averageSpeed =
      this.analyticsData.averageSpeed * 0.8 + currentSpeed * 0.2;

    this.analyticsData.peakSpeed = Math.max(
      this.analyticsData.peakSpeed,
      currentSpeed
    );
  }

  recordFailedUpload() {
    this.analyticsData.totalUploads++;
    this.analyticsData.failedUploads++;
  }

  getSuccessRate() {
    if (this.analyticsData.totalUploads === 0) return 0;
    return (
      (this.analyticsData.successfulUploads / this.analyticsData.totalUploads) *
      100
    );
  }

  getAverageUploadSize() {
    if (this.analyticsData.successfulUploads === 0) return 0;
    return this.analyticsData.totalBytes / this.analyticsData.successfulUploads;
  }

  createAnalyticsDashboard() {
    const dashboard = document.createElement("div");
    dashboard.className = "upload-analytics-dashboard";

    dashboard.innerHTML = `
          <div class="analytics-header">
              <h3>Upload Analytics</h3>
              <button class="refresh-analytics">🔄</button>
          </div>
          <div class="analytics-grid">
              <div class="analytics-card">
                  <div class="card-title">Total Uploads</div>
                  <div class="card-value">${
                    this.analyticsData.totalUploads
                  }</div>
              </div>
              <div class="analytics-card">
                  <div class="card-title">Success Rate</div>
                  <div class="card-value">${this.getSuccessRate().toFixed(
                    1
                  )}%</div>
              </div>
              <div class="analytics-card">
                  <div class="card-title">Total Data</div>
                  <div class="card-value">${this.formatBytes(
                    this.analyticsData.totalBytes
                  )}</div>
              </div>
              <div class="analytics-card">
                  <div class="card-title">Avg Speed</div>
                  <div class="card-value">${this.formatSpeed(
                    this.analyticsData.averageSpeed
                  )}</div>
              </div>
          </div>
          <div class="analytics-charts">
              <div class="chart-container">
                  <h4>Upload History</h4>
                  <canvas id="uploadHistoryChart" width="400" height="200"></canvas>
              </div>
          </div>
      `;

    return dashboard;
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  formatSpeed(bytesPerSecond) {
    if (bytesPerSecond < 1024) {
      return bytesPerSecond + " B/s";
    } else if (bytesPerSecond < 1024 * 1024) {
      return (bytesPerSecond / 1024).toFixed(1) + " KB/s";
    } else {
      return (bytesPerSecond / (1024 * 1024)).toFixed(1) + " MB/s";
    }
  }

  updateDashboard() {
    const dashboard = document.querySelector(".upload-analytics-dashboard");
    if (dashboard) {
      dashboard.replaceWith(this.createAnalyticsDashboard());
    }
  }
}

export const uploadAnalytics = new UploadAnalytics();
