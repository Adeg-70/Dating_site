export class FileMessageUI {
  constructor() {
    this.uploadQueue = new Map();
  }

  // Create file attachment preview
  createFilePreview(file) {
    const preview = document.createElement("div");
    preview.className = "file-preview";
    preview.innerHTML = `
          <div class="file-info">
              <span class="file-icon">${this.getFileIcon(file.type)}</span>
              <div class="file-details">
                  <div class="file-name">${file.name}</div>
                  <div class="file-size">${this.formatFileSize(file.size)}</div>
              </div>
              <button class="remove-file" aria-label="Remove file">×</button>
          </div>
          ${
            file.type.startsWith("image/")
              ? `<div class="image-preview">
                  <img src="${URL.createObjectURL(file)}" alt="Preview">
              </div>`
              : ""
          }
      `;

    return preview;
  }

  // Create message bubble for file messages
  createFileMessageBubble(message, isSent = false) {
    const bubble = document.createElement("div");
    bubble.className = `message ${isSent ? "sent" : "received"} file-message`;

    let contentHTML = "";

    if (message.content) {
      contentHTML += `<p>${message.content}</p>`;
    }

    if (message.attachments && message.attachments.length > 0) {
      contentHTML += message.attachments
        .map((attachment) => this.createAttachmentHTML(attachment, message._id))
        .join("");
    }

    bubble.innerHTML = `
          <div class="message-content">
              ${contentHTML}
              <div class="message-time">${this.formatTime(
                message.timestamp
              )}</div>
          </div>
      `;

    return bubble;
  }

  // Create HTML for a single attachment
  createAttachmentHTML(attachment, messageId) {
    const isImage = attachment.mimetype.startsWith("image/");
    const fileUrl = `/api/messages/attachment/${messageId}/${attachment._id}`;
    const thumbnailUrl = attachment.thumbnailPath
      ? `/api/messages/thumbnail/${messageId}/${attachment._id}`
      : fileUrl;

    return `
          <div class="message-attachment ${
            isImage ? "image-attachment" : "file-attachment"
          }">
              ${
                isImage
                  ? `
                  <a href="${fileUrl}" target="_blank" class="image-link">
                      <img src="${thumbnailUrl}" alt="${attachment.originalName}" 
                           loading="lazy" class="attachment-image">
                  </a>
              `
                  : `
                  <div class="file-download">
                      <span class="file-icon">${this.getFileIcon(
                        attachment.mimetype
                      )}</span>
                      <div class="file-info">
                          <div class="file-name">${
                            attachment.originalName
                          }</div>
                          <div class="file-size">${this.formatFileSize(
                            attachment.size
                          )}</div>
                      </div>
                      <a href="${fileUrl}" download="${
                      attachment.originalName
                    }" 
                         class="download-btn" title="Download file">
                          ⬇️
                      </a>
                  </div>
              `
              }
          </div>
      `;
  }

  // Get file icon based on MIME type
  getFileIcon(mimeType) {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType === "application/pdf") return "📄";
    if (mimeType.includes("word")) return "📝";
    if (mimeType === "text/plain") return "📄";
    return "📎";
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Format time
  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Create message with upload progress
  createUploadingMessage(uploadId, files, content = "") {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message sent file-message uploading";
    messageDiv.dataset.uploadId = uploadId;

    let contentHTML = "";
    if (content) {
      contentHTML += `<p>${content}</p>`;
    }

    contentHTML += files
      .map(
        (file) => `
        <div class="message-attachment uploading-attachment">
            <div class="upload-file-info">
                <span class="file-icon">${this.getFileIcon(file.type)}</span>
                <div class="upload-file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="upload-progress">
                        <div class="progress-bar" style="width: 0%"></div>
                    </div>
                    <div class="upload-status">Starting upload...</div>
                </div>
            </div>
        </div>
    `
      )
      .join("");

    messageDiv.innerHTML = `
        <div class="message-content">
            ${contentHTML}
            <div class="message-time">Just now</div>
        </div>
    `;

    return messageDiv;
  }

  // Update upload progress in message
  updateUploadProgress(uploadId, progress, speed = 0, timeRemaining = null) {
    const message = document.querySelector(
      `.message[data-upload-id="${uploadId}"]`
    );
    if (!message) return;

    const progressBars = message.querySelectorAll(".progress-bar");
    const statusElements = message.querySelectorAll(".upload-status");

    progressBars.forEach((bar) => {
      bar.style.width = `${progress}%`;
    });

    let statusText = `Uploading... ${progress}%`;
    if (speed > 0) {
      statusText += ` • ${this.formatSpeed(speed)}`;
    }
    if (timeRemaining) {
      statusText += ` • ${this.formatTimeRemaining(timeRemaining)}`;
    }

    statusElements.forEach((element) => {
      element.textContent = statusText;
    });
  }

  // Complete upload in message
  completeUpload(uploadId, success = true, messageData = null) {
    const message = document.querySelector(
      `.message[data-upload-id="${uploadId}"]`
    );
    if (!message) return;

    if (success && messageData) {
      // Replace with actual message
      const newMessage = this.createFileMessageBubble(messageData, true);
      message.replaceWith(newMessage);
    } else {
      // Show error state
      message.classList.add("upload-failed");
      const statusElements = message.querySelectorAll(".upload-status");
      statusElements.forEach((element) => {
        element.textContent = "Upload failed";
        element.style.color = "#f44336";
      });
      const progressBars = message.querySelectorAll(".progress-bar");
      progressBars.forEach((bar) => {
        bar.style.background = "#f44336";
      });
    }
  }
}

var fileMessageUI = new FileMessageUI();
