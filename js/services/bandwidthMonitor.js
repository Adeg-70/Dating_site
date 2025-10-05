class BandwidthMonitor {
  constructor() {
    this.usage = {
      current: 0,
      today: 0,
      month: 0,
    };
    this.limit = {
      daily: 100 * 1024 * 1024, // 100 MB daily
      monthly: 2 * 1024 * 1024 * 1024, // 2 GB monthly
    };
    this.throttled = false;
    this.initialize();
  }

  initialize() {
    this.loadFromStorage();
    this.startMonitoring();
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem("bandwidth_usage");
      if (saved) {
        const data = JSON.parse(saved);
        // Reset daily usage if it's a new day
        if (this.isNewDay(data.lastUpdated)) {
          this.usage.today = 0;
        } else {
          this.usage = data.usage;
        }
      }
    } catch (error) {
      console.warn("Failed to load bandwidth usage:", error);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(
        "bandwidth_usage",
        JSON.stringify({
          usage: this.usage,
          lastUpdated: Date.now(),
        })
      );
    } catch (error) {
      console.warn("Failed to save bandwidth usage:", error);
    }
  }

  isNewDay(lastTimestamp) {
    if (!lastTimestamp) return true;

    const lastDate = new Date(lastTimestamp);
    const currentDate = new Date();

    return (
      lastDate.getDate() !== currentDate.getDate() ||
      lastDate.getMonth() !== currentDate.getMonth() ||
      lastDate.getFullYear() !== currentDate.getFullYear()
    );
  }

  startMonitoring() {
    // Monitor network speed
    setInterval(() => this.updateSpeed(), 1000);

    // Auto-save every minute
    setInterval(() => this.saveToStorage(), 60000);
  }

  async updateSpeed() {
    try {
      const response = await fetch("/api/upload/bandwidth-usage", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.throttled = data.remaining < data.total * 0.1; // Throttled if less than 10% remaining
      }
    } catch (error) {
      console.debug("Bandwidth check failed:", error);
    }
  }

  recordUsage(bytes) {
    this.usage.current += bytes;
    this.usage.today += bytes;
    this.usage.month += bytes;

    // Check limits
    if (this.usage.today >= this.limit.daily) {
      this.throttled = true;
    }

    if (this.usage.month >= this.limit.monthly) {
      this.throttled = true;
    }

    this.saveToStorage();
  }

  getRemainingDaily() {
    return Math.max(0, this.limit.daily - this.usage.today);
  }

  getRemainingMonthly() {
    return Math.max(0, this.limit.monthly - this.usage.month);
  }

  getCurrentSpeed() {
    // Simple moving average of last 5 seconds
    return this.usage.current / 5;
  }

  resetCurrent() {
    this.usage.current = 0;
  }

  async getNetworkConditions() {
    try {
      if ("connection" in navigator) {
        const connection = navigator.connection;
        return {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        };
      }
    } catch (error) {
      console.debug("Network conditions unavailable:", error);
    }
    return null;
  }

  shouldThrottle(fileSize) {
    if (this.throttled) return true;

    const networkConditions = this.getNetworkConditions();
    if (networkConditions) {
      // Throttle on slow connections or save-data mode
      if (networkConditions.saveData) return true;
      if (networkConditions.effectiveType === "slow-2g") return true;
      if (
        networkConditions.effectiveType === "2g" &&
        fileSize > 1 * 1024 * 1024
      )
        return true;
    }

    return false;
  }

  getOptimalChunkSize() {
    const networkConditions = this.getNetworkConditions();

    if (!networkConditions) return 2 * 1024 * 1024; // Default 2MB

    switch (networkConditions.effectiveType) {
      case "slow-2g":
        return 256 * 1024; // 256KB
      case "2g":
        return 512 * 1024; // 512KB
      case "3g":
        return 1 * 1024 * 1024; // 1MB
      case "4g":
        return 2 * 1024 * 1024; // 2MB
      default:
        return 4 * 1024 * 1024; // 4MB
    }
  }
}

export const bandwidthMonitor = new BandwidthMonitor();

// Update bandwidth usage periodically
setInterval(() => {
  bandwidthMonitor.resetCurrent();
}, 5000);
