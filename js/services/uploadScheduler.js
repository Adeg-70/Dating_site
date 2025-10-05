import { bandwidthMonitor } from "./bandwidthMonitor.js";

class UploadScheduler {
  constructor() {
    this.queue = [];
    this.activeUploads = new Map();
    this.maxConcurrentUploads = 3;
    this.isProcessing = false;
  }

  async scheduleUpload(file, receiverId, options = {}) {
    const uploadId = this.generateUploadId();

    const uploadJob = {
      id: uploadId,
      file,
      receiverId,
      priority: options.priority || "normal",
      scheduledTime: Date.now(),
      status: "queued",
      retries: 0,
      maxRetries: options.maxRetries || 3,
      chunkSize: bandwidthMonitor.getOptimalChunkSize(),
      metadata: options.metadata || {},
    };

    this.queue.push(uploadJob);
    this.sortQueue();

    if (!this.isProcessing) {
      this.processQueue();
    }

    return uploadId;
  }

  sortQueue() {
    this.queue.sort((a, b) => {
      // Priority first
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      // Then by scheduled time (FIFO for same priority)
      return a.scheduledTime - b.scheduledTime;
    });
  }

  async processQueue() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (
      this.queue.length > 0 &&
      this.activeUploads.size < this.maxConcurrentUploads
    ) {
      const job = this.queue.shift();

      if (bandwidthMonitor.shouldThrottle(job.file.size)) {
        // Requeue with lower priority
        job.priority = "low";
        job.scheduledTime = Date.now() + 30000; // Delay 30 seconds
        this.queue.push(job);
        continue;
      }

      this.activeUploads.set(job.id, job);
      this.startUpload(job);
    }

    this.isProcessing = false;
  }

  async startUpload(job) {
    job.status = "uploading";

    try {
      // Use chunked upload service
      const sessionId = await chunkedUploadService.startChunkedUpload(
        job.file,
        job.receiverId,
        (sessionId, progress, uploaded, total) => {
          this.updateProgress(job.id, progress, uploaded, total);
        },
        (sessionId, completedFile) => {
          this.completeUpload(job.id, completedFile);
        },
        (error) => {
          this.handleUploadError(job.id, error);
        }
      );

      job.sessionId = sessionId;
    } catch (error) {
      this.handleUploadError(job.id, error);
    }
  }

  updateProgress(uploadId, progress, uploaded, total) {
    const job = this.activeUploads.get(uploadId);
    if (job) {
      job.progress = progress;
      job.uploaded = uploaded;
      job.total = total;

      // Emit progress event
      this.emit("progress", { uploadId, progress, uploaded, total });
    }
  }

  completeUpload(uploadId, file) {
    const job = this.activeUploads.get(uploadId);
    if (job) {
      job.status = "completed";
      this.activeUploads.delete(uploadId);

      // Emit completion event
      this.emit("complete", { uploadId, file });

      // Process next in queue
      this.processQueue();
    }
  }

  async handleUploadError(uploadId, error) {
    const job = this.activeUploads.get(uploadId);
    if (job) {
      job.retries++;

      if (job.retries >= job.maxRetries) {
        job.status = "failed";
        this.activeUploads.delete(uploadId);
        this.emit("error", { uploadId, error, job });
      } else {
        // Retry with exponential backoff
        job.status = "retrying";
        const delay = Math.pow(2, job.retries) * 1000; // Exponential backoff

        setTimeout(() => {
          job.status = "queued";
          job.scheduledTime = Date.now();
          this.queue.push(job);
          this.sortQueue();
          this.processQueue();
        }, delay);
      }
    }
  }

  pauseUpload(uploadId) {
    const job =
      this.activeUploads.get(uploadId) ||
      this.queue.find((j) => j.id === uploadId);
    if (job) {
      job.status = "paused";

      if (this.activeUploads.has(uploadId)) {
        // Cancel active upload
        chunkedUploadService.cancelUpload(job.sessionId);
        this.activeUploads.delete(uploadId);
      } else {
        // Remove from queue
        this.queue = this.queue.filter((j) => j.id !== uploadId);
      }
    }
  }

  resumeUpload(uploadId) {
    const job =
      this.activeUploads.get(uploadId) ||
      this.queue.find((j) => j.id === uploadId);
    if (job && job.status === "paused") {
      job.status = "queued";
      job.scheduledTime = Date.now();
      this.queue.push(job);
      this.sortQueue();
      this.processQueue();
    }
  }

  cancelUpload(uploadId) {
    const job =
      this.activeUploads.get(uploadId) ||
      this.queue.find((j) => j.id === uploadId);
    if (job) {
      if (this.activeUploads.has(uploadId)) {
        chunkedUploadService.cancelUpload(job.sessionId);
        this.activeUploads.delete(uploadId);
      } else {
        this.queue = this.queue.filter((j) => j.id !== uploadId);
      }

      this.emit("cancel", { uploadId });
    }
  }

  getQueueStatus() {
    return {
      queued: this.queue.length,
      active: this.activeUploads.size,
      total: this.queue.length + this.activeUploads.size,
    };
  }

  generateUploadId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event emitter pattern
  on(event, callback) {
    if (!this.listeners) this.listeners = {};
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data));
    }
  }
}

export const uploadScheduler = new UploadScheduler();
