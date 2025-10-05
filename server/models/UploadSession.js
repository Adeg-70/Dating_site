const mongoose = require("mongoose");

const uploadSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    totalChunks: {
      type: Number,
      required: true,
    },
    chunkSize: {
      type: Number,
      required: true,
    },
    uploadedChunks: {
      type: [Number],
      default: [],
    },
    status: {
      type: String,
      enum: ["uploading", "completed", "cancelled", "error"],
      default: "uploading",
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    metadata: {
      originalName: String,
      mimeType: String,
      receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  },
  {
    timestamps: true,
  }
);

// Index for cleanup
uploadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
uploadSessionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("UploadSession", uploadSessionSchema);
