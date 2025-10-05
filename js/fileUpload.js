import { showNotification } from "./utils.js";

import { chunkedUploadService } from "./services/chunkedUploadService.js";

import { uploadScheduler } from "./services/uploadScheduler.js";

class FileUploader {
  constructor(options = {}) {
    this.options = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      maxFiles: 5,
      chunkSize: 512 * 1024, // 512KB chunks for progress tracking
      ...options,
    };
    this.activeUploads = new Map();
  }

  // Validate file
  validateFile(file) {
    // Check file size
    if (file.size > this.options.maxFileSize) {
      return `File ${
        file.name
      } is too large. Maximum size is ${this.formatFileSize(
        this.options.maxFileSize
      )}.`;
    }

    // Check file type
    if (!this.options.allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed.`;
    }

    return null;
  }

  // Format file size for display
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Create preview for image files
  createImagePreview(file) {
    return new Promise((resolve) => {
      if (!file.type.startsWith("image/")) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  // Create file icon based on type
  getFileIcon(mimeType) {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType === "application/pdf") return "📄";
    if (mimeType.includes("word")) return "📝";
    if (mimeType === "text/plain") return "📄";
    return "📎";
  }

  // Upload files to server
  async uploadFiles(files, endpoint, onProgress = null, onComplete = null) {
    const results = [];
    if (largeFiles.length > 0) {
      // Extract receiverId from endpoint or use current conversation
      const receiverId = this.getReceiverIdFromEndpoint(endpoint);

      return this.uploadFilesWithChunking(
        files,
        receiverId,
        onProgress,
        onComplete
      );
    }

    // Original upload implementation for small files
    // ... keep the existing implementation ...

    // Check if any file is large enough for chunking
    const largeFiles = files.filter((file) => file.size > 5 * 1024 * 1024);

    const uploadId = `upload_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const formData = new FormData();
    const validFiles = [];
    const errors = [];

    // Validate files
    for (const file of files) {
      const uploadId = await uploadScheduler.scheduleUpload(file, receiverId, {
        priority: this.getUploadPriority(file),
        metadata: { endpoint },
      });

      // Listen to upload events
      uploadScheduler.on("progress", (data) => {
        if (data.uploadId === uploadId) {
          onProgress?.(file, data.progress, data.uploaded, data.total);
        }
      });

      uploadScheduler.on("complete", (data) => {
        if (data.uploadId === uploadId) {
          results.push({ file, success: true, data: data.file });
          if (results.length === files.length) {
            onComplete?.(results);
          }
        }
      });

      uploadScheduler.on("error", (data) => {
        if (data.uploadId === uploadId) {
          results.push({ file, success: false, error: data.error });
          if (results.length === files.length) {
            onComplete?.(results);
          }
        }
      });
    }

    return { uploadIds: results.map((r) => r.uploadId) };
  }

  getUploadPriority(file) {
    if (file.size > 10 * 1024 * 1024) return "low";
    if (file.type.startsWith("image/")) return "high";
    return "normal";
  }

  // Cancel an active upload
  cancelUpload(uploadId) {
    const upload = this.activeUploads.get(uploadId);
    if (upload && upload.xhr) {
      upload.xhr.abort();
      upload.status = "cancelled";
      this.activeUploads.delete(uploadId);

      // Also notify server
      fetch(`/api/messages/upload/${uploadId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }).catch(() => {}); // Silently fail if server notification doesn't work

      return true;
    }
    return false;
  }

  // Get upload progress from server
  async getUploadProgress(uploadId) {
    try {
      const response = await fetch(
        `/api/messages/upload-progress/${uploadId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Get all active uploads
  getActiveUploads() {
    return Array.from(this.activeUploads.entries());
  }

  // Clean up completed uploads
  cleanupUploads() {
    const now = Date.now();
    for (const [uploadId, upload] of this.activeUploads.entries()) {
      // Remove uploads older than 1 hour
      if (now - upload.startTime > 60 * 60 * 1000) {
        this.activeUploads.delete(uploadId);
      }
    }
  }

  // (Removed misplaced try-catch block; this code is already handled above in the uploadFiles method)

  // Add this method to the FileUploader class
  async uploadFilesWithChunking(
    files,
    receiverId,
    onProgress,
    onComplete,
    onError
  ) {
    const results = [];

    for (const file of files) {
      // Use chunked upload for large files (> 5MB)
      if (file.size > 5 * 1024 * 1024) {
        try {
          const sessionId = await chunkedUploadService.startChunkedUpload(
            file,
            receiverId,
            (sessionId, progress, uploaded, total) => {
              onProgress?.(file, progress, uploaded, total);
            },
            (sessionId, completedFile) => {
              results.push({ file: completedFile, success: true });
              if (results.length === files.length) {
                onComplete?.(results);
              }
            },
            (error) => {
              results.push({ file, success: false, error });
              if (results.length === files.length) {
                onComplete?.(results);
              }
            }
          );
        } catch (error) {
          results.push({ file, success: false, error });
        }
      } else {
        // Use regular upload for small files
        try {
          const result = await this.uploadFiles([file], "/api/messages/send");
          results.push({ file, success: result.success, data: result.data });
        } catch (error) {
          results.push({ file, success: false, error });
        }
      }
    }

    return results;
  }
}

export const fileUploader = new FileUploader();

// Clean up every 30 minutes
setInterval(() => {
  fileUploader.cleanupUploads();
}, 30 * 60 * 1000);
