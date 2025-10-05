import { showNotification } from "../utils.js";

class ChunkedUploadService {
  constructor() {
    this.activeSessions = new Map();
    this.chunkSize = 2 * 1024 * 1024; // 2MB chunks
    this.maxRetries = 3;
    this.parallelUploads = 3; // Number of parallel chunk uploads
  }

  // Start a new chunked upload
  async startChunkedUpload(file, receiverId, onProgress, onComplete, onError) {
    const sessionId = this.generateSessionId();
    const totalChunks = Math.ceil(file.size / this.chunkSize);

    try {
      // Start upload session on server
      const response = await fetch("/api/upload/chunked/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          totalChunks: totalChunks,
          chunkSize: this.chunkSize,
          receiverId: receiverId,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start upload session");
      }

      const sessionData = await response.json();

      // Create upload session
      const uploadSession = {
        id: sessionData.sessionId,
        file: file,
        receiverId: receiverId,
        totalChunks: totalChunks,
        uploadedChunks: new Set(),
        failedChunks: new Map(),
        status: "uploading",
        startTime: Date.now(),
        onProgress,
        onComplete,
        onError,
      };

      this.activeSessions.set(sessionData.sessionId, uploadSession);

      // Start uploading chunks
      this.uploadChunks(sessionData.sessionId);

      return sessionData.sessionId;
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }

  // Upload chunks with parallel processing
  async uploadChunks(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const chunksToUpload = [];
    for (let i = 0; i < session.totalChunks; i++) {
      if (!session.uploadedChunks.has(i) && !session.failedChunks.has(i)) {
        chunksToUpload.push(i);
      }
    }

    // Upload chunks in parallel
    const parallelUploads = Math.min(
      this.parallelUploads,
      chunksToUpload.length
    );
    const uploadPromises = [];

    for (let i = 0; i < parallelUploads; i++) {
      if (chunksToUpload.length > 0) {
        const chunkIndex = chunksToUpload.shift();
        uploadPromises.push(this.uploadChunk(sessionId, chunkIndex));
      }
    }

    await Promise.all(uploadPromises);

    // Check if all chunks are uploaded
    if (session.uploadedChunks.size === session.totalChunks) {
      this.finalizeUpload(sessionId);
    }
  }

  // Upload a single chunk
  async uploadChunk(sessionId, chunkNumber, retryCount = 0) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      const chunk = this.getChunk(session.file, chunkNumber);
      const formData = new FormData();
      formData.append("chunk", chunk, `chunk-${chunkNumber}`);

      const response = await fetch(
        `/api/upload/chunked/chunk/${sessionId}/${chunkNumber}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed for chunk ${chunkNumber}`);
      }

      const result = await response.json();
      session.uploadedChunks.add(chunkNumber);
      session.failedChunks.delete(chunkNumber);

      // Update progress
      const progress = Math.round(
        (session.uploadedChunks.size / session.totalChunks) * 100
      );
      session.onProgress?.(
        sessionId,
        progress,
        session.uploadedChunks.size,
        session.totalChunks
      );

      // Continue with next chunks
      this.uploadChunks(sessionId);
    } catch (error) {
      if (retryCount < this.maxRetries) {
        // Retry after delay
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (retryCount + 1))
        );
        return this.uploadChunk(sessionId, chunkNumber, retryCount + 1);
      } else {
        // Mark as failed
        session.failedChunks.set(chunkNumber, error.message);
        session.onError?.(
          new Error(
            `Failed to upload chunk ${chunkNumber} after ${this.maxRetries} attempts`
          )
        );
      }
    }
  }

  // Get a chunk from the file
  getChunk(file, chunkNumber) {
    const start = chunkNumber * this.chunkSize;
    const end = Math.min(start + this.chunkSize, file.size);
    return file.slice(start, end);
  }

  // Finalize the upload
  async finalizeUpload(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      // The server automatically finalizes when all chunks are uploaded
      session.status = "completed";
      session.onComplete?.(sessionId, session.file);

      // Clean up after delay
      setTimeout(() => {
        this.activeSessions.delete(sessionId);
      }, 5000);
    } catch (error) {
      session.status = "error";
      session.onError?.(error);
    }
  }

  // Resume an interrupted upload
  async resumeUpload(sessionId) {
    try {
      const response = await fetch(`/api/upload/chunked/resume/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to resume upload session");
      }

      const sessionData = await response.json();
      const session = this.activeSessions.get(sessionId);

      if (session) {
        // Update session with server state
        sessionData.uploadedChunks.forEach((chunkNumber) => {
          session.uploadedChunks.add(chunkNumber);
        });

        // Continue uploading
        this.uploadChunks(sessionId);
      }

      return sessionData;
    } catch (error) {
      throw error;
    }
  }

  // Get upload status
  async getUploadStatus(sessionId) {
    try {
      const response = await fetch(`/api/upload/chunked/status/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get upload status");
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Cancel upload
  async cancelUpload(sessionId) {
    try {
      const response = await fetch(`/api/upload/chunked/cancel/${sessionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to cancel upload");
      }

      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.status = "cancelled";
        this.activeSessions.delete(sessionId);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Generate unique session ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get active sessions
  getActiveSessions() {
    return Array.from(this.activeSessions.entries());
  }

  // Cleanup old sessions
  cleanupSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.startTime > 24 * 60 * 60 * 1000) {
        // 24 hours
        this.activeSessions.delete(sessionId);
      }
    }
  }
}

// Create singleton instance
export const chunkedUploadService = new ChunkedUploadService();

// Regular cleanup
setInterval(() => {
  chunkedUploadService.cleanupSessions();
}, 60 * 60 * 1000); // Cleanup every hour
