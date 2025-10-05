export class AdvancedDashboard {
  constructor() {
    this.insights = null;
    this.initialize();
  }

  async initialize() {
    await this.loadInsights();
    this.setupRealTimeUpdates();
  }

  async loadInsights() {
    try {
      const response = await fetch("/api/analytics/insights", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        this.insights = await response.json();
        this.updateDashboard();
      }
    } catch (error) {
      console.error("Failed to load insights:", error);
    }
  }

  createDashboard() {
    const dashboard = document.createElement("div");
    dashboard.className = "advanced-analytics-dashboard";

    dashboard.innerHTML = `
          <div class="dashboard-header">
              <h2>Advanced Upload Analytics</h2>
              <button class="refresh-btn">🔄</button>
          </div>
          
          <div class="insights-grid">
              <div class="insight-card">
                  <h3>Optimal Upload Times</h3>
                  <div class="insight-value">${
                    this.insights?.optimalUploadTimes?.bestTime ||
                    "Calculating..."
                  }</div>
                  <div class="insight-subtext">${
                    this.insights?.optimalUploadTimes?.confidence
                      ? `Confidence: ${(
                          this.insights.optimalUploadTimes.confidence * 100
                        ).toFixed(1)}%`
                      : ""
                  }</div>
              </div>
              
              <div class="insight-card">
                  <h3>Predicted Success Rate</h3>
                  <div class="insight-value">${
                    this.insights?.predictedSuccessRate
                      ? `${(this.insights.predictedSuccessRate * 100).toFixed(
                          1
                        )}%`
                      : "Calculating..."
                  }</div>
                  <div class="insight-subtext">Based on your connection history</div>
              </div>
              
              <div class="insight-card">
                  <h3>Recommended Settings</h3>
                  <div class="settings-list">
                      ${this.renderRecommendedSettings()}
                  </div>
              </div>
          </div>
          
          <div class="charts-section">
              <div class="chart-container">
                  <h3>Upload Performance Trends</h3>
                  <canvas id="performanceChart" width="400" height="200"></canvas>
              </div>
              
              <div class="chart-container">
                  <h3>Network Quality Analysis</h3>
                  <canvas id="networkChart" width="400" height="200"></canvas>
              </div>
          </div>
      `;

    return dashboard;
  }

  renderRecommendedSettings() {
    if (!this.insights?.recommendedSettings) return "<div>Loading...</div>";

    const settings = this.insights.recommendedSettings;
    return `
          <div class="setting-item">
              <span>Chunk Size:</span>
              <span>${settings.chunkSize}</span>
          </div>
          <div class="setting-item">
              <span>Concurrent Uploads:</span>
              <span>${settings.concurrentUploads}</span>
          </div>
          <div class="setting-item">
              <span>Auto Retry:</span>
              <span>${settings.autoRetry ? "Enabled" : "Disabled"}</span>
          </div>
          <div class="setting-item">
              <span>Quality:</span>
              <span>${settings.quality}</span>
          </div>
      `;
  }

  setupRealTimeUpdates() {
    // Update every 5 minutes
    setInterval(() => this.loadInsights(), 5 * 60 * 1000);

    // Listen for upload events
    uploadScheduler.on("complete", () => this.loadInsights());
    uploadScheduler.on("error", () => this.loadInsights());
  }

  updateDashboard() {
    const existingDashboard = document.querySelector(
      ".advanced-analytics-dashboard"
    );
    if (existingDashboard) {
      existingDashboard.replaceWith(this.createDashboard());
    }
  }
}

export const advancedDashboard = new AdvancedDashboard();
