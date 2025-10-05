export class BandwidthSettings {
  constructor() {
    this.settings = {
      maxConcurrentUploads: 3,
      autoThrottle: true,
      backgroundUploads: true,
      qualitySetting: "auto", // 'high', 'medium', 'low', 'auto'
    };

    this.loadSettings();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem("upload_settings");
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn("Failed to load upload settings:", error);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem("upload_settings", JSON.stringify(this.settings));
      this.applySettings();
    } catch (error) {
      console.warn("Failed to save upload settings:", error);
    }
  }

  applySettings() {
    // Apply to upload scheduler
    uploadScheduler.maxConcurrentUploads = this.settings.maxConcurrentUploads;

    // Apply to bandwidth monitor
    bandwidthMonitor.autoThrottle = this.settings.autoThrottle;
  }

  createSettingsPanel() {
    const panel = document.createElement("div");
    panel.className = "bandwidth-settings-panel";

    panel.innerHTML = `
          <h3>Upload Settings</h3>
          
          <div class="setting-group">
              <label>Maximum Concurrent Uploads</label>
              <input type="range" min="1" max="10" value="${
                this.settings.maxConcurrentUploads
              }" 
                     id="maxConcurrentUploads">
              <span class="setting-value">${
                this.settings.maxConcurrentUploads
              }</span>
          </div>
          
          <div class="setting-group">
              <label>
                  <input type="checkbox" id="autoThrottle" ${
                    this.settings.autoThrottle ? "checked" : ""
                  }>
                  Auto-throttle on slow connections
              </label>
          </div>
          
          <div class="setting-group">
              <label>
                  <input type="checkbox" id="backgroundUploads" ${
                    this.settings.backgroundUploads ? "checked" : ""
                  }>
                  Background uploads
              </label>
          </div>
          
          <div class="setting-group">
              <label>Upload Quality</label>
              <select id="qualitySetting">
                  <option value="auto" ${
                    this.settings.qualitySetting === "auto" ? "selected" : ""
                  }>Auto</option>
                  <option value="high" ${
                    this.settings.qualitySetting === "high" ? "selected" : ""
                  }>High Quality</option>
                  <option value="medium" ${
                    this.settings.qualitySetting === "medium" ? "selected" : ""
                  }>Medium Quality</option>
                  <option value="low" ${
                    this.settings.qualitySetting === "low" ? "selected" : ""
                  }>Low Quality</option>
              </select>
          </div>
          
          <button class="btn-primary" id="saveSettings">Save Settings</button>
      `;

    // Add event listeners
    panel
      .querySelector("#maxConcurrentUploads")
      .addEventListener("input", (e) => {
        panel.querySelector(".setting-value").textContent = e.target.value;
      });

    panel.querySelector("#saveSettings").addEventListener("click", () => {
      this.saveCurrentSettings(panel);
    });

    return panel;
  }

  saveCurrentSettings(panel) {
    this.settings = {
      maxConcurrentUploads: parseInt(
        panel.querySelector("#maxConcurrentUploads").value
      ),
      autoThrottle: panel.querySelector("#autoThrottle").checked,
      backgroundUploads: panel.querySelector("#backgroundUploads").checked,
      qualitySetting: panel.querySelector("#qualitySetting").value,
    };

    this.saveSettings();
    showNotification("Settings saved successfully", "success");
  }
}

export const bandwidthSettings = new BandwidthSettings();
