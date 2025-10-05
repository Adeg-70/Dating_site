export class ProgressUI {
  constructor() {
    this.progressBars = new Map();
  }

  // Create progress bar for a file
  createProgressBar(uploadId, fileName) {
    const progressBar = document.createElement("div");
    progressBar.className = "upload-progress-item";
    progressBar.innerHTML = `
          <div class="progress-file-info">
              <span class="file-icon">📄</span>
              <div class="progress-file-details">
                  <div class="progress-file-name">${fileName}</div>
                  <div class="progress-file-size">0%</div>
              </div>
              <button class="cancel-upload" data-upload-id="${uploadId}" title="Cancel upload">✕</button>
          </div>
          <div class="progress-bar-container">
              <div class="progress-bar" style="width: 0%"></div>
          </div>
          <div class="upload-status">Uploading...</div>
      `;

    return progressBar;
  }

  // Update progress bar
  updateProgressBar(uploadId, progress, speed = 0, timeRemaining = null) {
    const progressBar = this.progressBars.get(uploadId);
    if (!progressBar) return;

    const progressElement = progressBar.querySelector(".progress-bar");
    const percentElement = progressBar.querySelector(".progress-file-size");
    const statusElement = progressBar.querySelector(".upload-status");

    progressElement.style.width = `${progress}%`;
    percentElement.textContent = `${progress}%`;

    let statusText = "Uploading...";
    if (speed > 0) {
      statusText += ` • ${this.formatSpeed(speed)}`;
    }
    if (timeRemaining) {
      statusText += ` • ${this.formatTimeRemaining(timeRemaining)}`;
    }

    statusElement.textContent = statusText;
  }

  // Complete progress bar
  completeProgressBar(uploadId, success = true) {
    const progressBar = this.progressBars.get(uploadId);
    if (!progressBar) return;

    const progressElement = progressBar.querySelector(".progress-bar");
    const statusElement = progressBar.querySelector(".upload-status");
    const cancelButton = progressBar.querySelector(".cancel-upload");

    progressElement.style.width = "100%";
    progressElement.style.background = success ? "#4CAF50" : "#f44336";
    statusElement.textContent = success ? "Upload complete" : "Upload failed";
    statusElement.style.color = success ? "#4CAF50" : "#f44336";

    if (cancelButton) {
      cancelButton.remove();
    }

    // Auto-remove after delay if successful
    if (success) {
      setTimeout(() => {
        progressBar.remove();
        this.progressBars.delete(uploadId);
      }, 2000);
    }
  }

  // Show progress container
  showProgressContainer() {
    let container = document.getElementById("uploadProgressContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "uploadProgressContainer";
      container.className = "upload-progress-container";
      container.innerHTML = `
              <div class="progress-header">
                  <h4>Uploading Files</h4>
                  <button class="minimize-progress">−</button>
              </div>
              <div class="progress-items"></div>
          `;
      document.body.appendChild(container);

      // Add minimize functionality
      container
        .querySelector(".minimize-progress")
        .addEventListener("click", () => {
          container.classList.toggle("minimized");
        });
    }
    return container;
  }

  // Add upload to progress container
  addUploadToProgress(uploadId, fileName) {
    const container = this.showProgressContainer();
    const progressItems = container.querySelector(".progress-items");

    const progressBar = this.createProgressBar(uploadId, fileName);
    this.progressBars.set(uploadId, progressBar);

    progressItems.appendChild(progressBar);

    // Add cancel functionality
    const cancelButton = progressBar.querySelector(".cancel-upload");
    cancelButton.addEventListener("click", (e) => {
      e.preventDefault();
      this.cancelUpload(uploadId);
    });

    return progressBar;
  }

  // Cancel upload
  cancelUpload(uploadId) {
    const progressBar = this.progressBars.get(uploadId);
    if (progressBar) {
      progressBar.querySelector(".progress-bar").style.background = "#ff9800";
      progressBar.querySelector(".upload-status").textContent = "Cancelling...";
      progressBar.querySelector(".upload-status").style.color = "#ff9800";
    }

    // This will call the fileUploader.cancelUpload method
    const event = new CustomEvent("cancelUpload", { detail: { uploadId } });
    document.dispatchEvent(event);
  }

  // Format speed (bytes per second to human readable)
  formatSpeed(bytesPerSecond) {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    }
  }

  // Format time remaining
  formatTimeRemaining(seconds) {
    if (seconds < 60) {
      return `${Math.round(seconds)}s remaining`;
    } else {
      return `${Math.round(seconds / 60)}m ${Math.round(
        seconds % 60
      )}s remaining`;
    }
  }

  // Calculate upload speed and time remaining
  calculateSpeedAndTime(startTime, loaded, total) {
    const elapsed = (Date.now() - startTime) / 1000; // seconds
    const speed = elapsed > 0 ? loaded / elapsed : 0;

    let timeRemaining = null;
    if (speed > 0 && loaded < total) {
      timeRemaining = (total - loaded) / speed;
    }

    return { speed, timeRemaining };
  }

  // Create chunked upload progress item
  createChunkedProgressItem(sessionId, fileName, fileSize, totalChunks) {
    const progressItem = document.createElement("div");
    progressItem.className = "upload-progress-item chunked-upload";
    progressItem.dataset.sessionId = sessionId;

    progressItem.innerHTML = `
      <div class="progress-file-info">
          <span class="file-icon">📦</span>
          <div class="progress-file-details">
              <div class="progress-file-name">${fileName}</div>
              <div class="file-size">${this.formatFileSize(fileSize)}</div>
              <div class="chunk-progress">
                  <div class="progress-bar" style="width: 0%"></div>
              </div>
              <div class="upload-status">Preparing upload...</div>
              <div class="chunk-details">
                  <span class="chunks-uploaded">0</span> of 
                  <span class="total-chunks">${totalChunks}</span> chunks
              </div>
          </div>
          <button class="cancel-upload" data-session-id="${sessionId}" title="Cancel upload">✕</button>
      </div>
      <div class="upload-speed"></div>
  `;

    return progressItem;
  }

  // Update chunked upload progress
  updateChunkedProgress(
    sessionId,
    progress,
    uploadedChunks,
    totalChunks,
    speed = 0
  ) {
    const progressItem = document.querySelector(
      `.upload-progress-item[data-session-id="${sessionId}"]`
    );
    if (!progressItem) return;

    const progressBar = progressItem.querySelector(".progress-bar");
    const progressText = progressItem.querySelector(".upload-status");
    const chunksUploaded = progressItem.querySelector(".chunks-uploaded");
    const speedElement = progressItem.querySelector(".upload-speed");

    progressBar.style.width = `${progress}%`;
    chunksUploaded.textContent = uploadedChunks;
    progressText.textContent = `Uploading... ${progress}%`;

    if (speed > 0) {
      speedElement.textContent = this.formatSpeed(speed);
    }
  }

  // Show resume prompt for interrupted uploads
  showResumePrompt(sessionId, fileName, progress) {
    const prompt = document.createElement("div");
    prompt.className = "resume-prompt";
    prompt.innerHTML = `
      <div class="prompt-content">
          <h4>Resume Upload?</h4>
          <p>Upload of "${fileName}" was interrupted. ${progress}% completed.</p>
          <div class="prompt-actions">
              <button class="btn-secondary resume-no">Cancel Upload</button>
              <button class="btn-primary resume-yes">Resume Upload</button>
          </div>
      </div>
  `;

    document.body.appendChild(prompt);

    return new Promise((resolve) => {
      prompt.querySelector(".resume-yes").addEventListener("click", () => {
        prompt.remove();
        resolve(true);
      });

      prompt.querySelector(".resume-no").addEventListener("click", () => {
        prompt.remove();
        resolve(false);
      });
    });
  }
}

export const progressUI = new ProgressUI();
