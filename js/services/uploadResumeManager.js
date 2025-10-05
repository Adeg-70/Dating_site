class UploadResumeManager {
  constructor() {
    this.storageKey = "upload_sessions";
    this.pendingSessions = new Map();
  }

  // Save session to localStorage
  saveSession(sessionId, sessionData) {
    const sessions = this.getSessions();
    sessions[sessionId] = {
      ...sessionData,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(this.storageKey, JSON.stringify(sessions));
  }

  // Get session from localStorage
  getSession(sessionId) {
    const sessions = this.getSessions();
    return sessions[sessionId];
  }

  // Get all sessions
  getSessions() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey)) || {};
    } catch {
      return {};
    }
  }

  // Remove session
  removeSession(sessionId) {
    const sessions = this.getSessions();
    delete sessions[sessionId];
    localStorage.setItem(this.storageKey, JSON.stringify(sessions));
  }

  // Resume interrupted uploads on page load
  async resumeInterruptedUploads() {
    const sessions = this.getSessions();
    const now = Date.now();

    for (const [sessionId, session] of Object.entries(sessions)) {
      // Skip sessions older than 24 hours
      if (now - session.lastUpdated > 24 * 60 * 60 * 1000) {
        this.removeSession(sessionId);
        continue;
      }

      if (session.status === "uploading") {
        try {
          // Try to resume the upload
          await chunkedUploadService.resumeUpload(sessionId);
          this.pendingSessions.set(sessionId, session);
        } catch (error) {
          console.warn(`Failed to resume upload session ${sessionId}:`, error);
          this.removeSession(sessionId);
        }
      }
    }
  }

  // Track upload progress for resumption
  trackUpload(sessionId, file, receiverId) {
    const sessionData = {
      sessionId,
      fileName: file.name,
      fileSize: file.size,
      receiverId,
      status: "uploading",
      startTime: Date.now(),
    };

    this.saveSession(sessionId, sessionData);
    this.pendingSessions.set(sessionId, sessionData);

    // Update session periodically
    const updateInterval = setInterval(() => {
      if (this.pendingSessions.has(sessionId)) {
        this.saveSession(sessionId, {
          ...this.pendingSessions.get(sessionId),
          lastUpdated: Date.now(),
        });
      } else {
        clearInterval(updateInterval);
      }
    }, 5000);
  }

  // Mark upload as completed
  completeUpload(sessionId) {
    const session = this.pendingSessions.get(sessionId);
    if (session) {
      session.status = "completed";
      this.saveSession(sessionId, session);
      this.pendingSessions.delete(sessionId);

      // Remove after delay
      setTimeout(() => this.removeSession(sessionId), 30000);
    }
  }

  // Mark upload as failed
  failUpload(sessionId, error) {
    const session = this.pendingSessions.get(sessionId);
    if (session) {
      session.status = "error";
      session.error = error.message;
      this.saveSession(sessionId, session);
      this.pendingSessions.delete(sessionId);
    }
  }

  // Cleanup old sessions
  cleanupOldSessions() {
    const sessions = this.getSessions();
    const now = Date.now();

    for (const [sessionId, session] of Object.entries(sessions)) {
      if (now - session.lastUpdated > 7 * 24 * 60 * 60 * 1000) {
        // 1 week
        this.removeSession(sessionId);
      }
    }
  }
}

export const uploadResumeManager = new UploadResumeManager();

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  uploadResumeManager.resumeInterruptedUploads();
});

// Regular cleanup
setInterval(() => {
  uploadResumeManager.cleanupOldSessions();
}, 24 * 60 * 60 * 1000); // Cleanup daily
