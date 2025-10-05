const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  attachments: [
    {
      filename: String,
      originalName: String,
      mimetype: String,
      size: Number,
      path: String,
      thumbnailPath: String,
    },
  ],
  messageType: {
    type: String,
    enum: ["text", "image", "file", "system"],
    default: "text",
  },
  read: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for better query performance
messageSchema.index({ sender: 1, receiver: 1, timestamp: 1 });
messageSchema.index({ receiver: 1, read: 1 });

module.exports = mongoose.model("Message", messageSchema);
