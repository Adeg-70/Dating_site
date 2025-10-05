const multer = require("multer");
const path = require("path");
const fs = require("fs");

class UploadProgress {
  constructor() {
    this.uploadProgress = new Map();
    this.activeUploads = new Map();
  }

  // Generate unique upload ID
  generateUploadId(userId) {
    return `upload_${userId}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  // Track upload progress
  createProgressTracker(uploadId) {
    return (req, res, next) => {
      const progress = {
        uploadId: uploadId,
        total: 0,
        loaded: 0,
        percentage: 0,
        files: [],
        status: "uploading",
        startTime: Date.now(),
        endTime: null,
      };

      this.uploadProgress.set(uploadId, progress);
      this.activeUploads.set(uploadId, progress);

      req.on("data", (chunk) => {
        progress.loaded += chunk.length;
        if (progress.total > 0) {
          progress.percentage = Math.round(
            (progress.loaded / progress.total) * 100
          );
        }
      });

      res.on("finish", () => {
        progress.status = "completed";
        progress.endTime = Date.now();
        this.activeUploads.delete(uploadId);

        // Clean up after 5 minutes
        setTimeout(() => {
          this.uploadProgress.delete(uploadId);
        }, 5 * 60 * 1000);
      });

      next();
    };
  }

  // Get upload progress
  getProgress(uploadId) {
    return this.uploadProgress.get(uploadId);
  }

  // Cancel upload
  cancelUpload(uploadId) {
    const progress = this.uploadProgress.get(uploadId);
    if (progress && progress.status === "uploading") {
      progress.status = "cancelled";
      progress.endTime = Date.now();
      this.activeUploads.delete(uploadId);
      return true;
    }
    return false;
  }

  // Clean up old uploads
  cleanupOldUploads(maxAge = 30 * 60 * 1000) {
    // 30 minutes
    const now = Date.now();
    for (const [uploadId, progress] of this.uploadProgress.entries()) {
      if (progress.endTime && now - progress.endTime > maxAge) {
        this.uploadProgress.delete(uploadId);
      }
    }
  }
}

// Create singleton instance
const uploadProgress = new UploadProgress();

// Clean up every hour
setInterval(() => {
  uploadProgress.cleanupOldUploads();
}, 60 * 60 * 1000);

module.exports = uploadProgress;
