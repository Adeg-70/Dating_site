const Message = require("../models/Message");
const Match = require("../models/Match");
const { generateThumbnail } = require("../utils/thumbnailGenerator");
const fs = require("fs");
const path = require("path");
const uploadProgress = require("../middleware/uploadProgress");

const messagesController = {
  getMessage: async (req, res) => {
    try {
      const messageId = req.params.id;
      // Your logic to get message by ID
      res.status(200).json({
        success: true,
        message: `Message ${messageId} retrieved successfully`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  getUploadProgress: async (req, res) => {
    try {
      const { uploadId } = req.params;
      const progress = uploadProgress.getProgress(uploadId);

      if (!progress) {
        return res.status(404).json({ message: "Upload not found" });
      }

      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  cancelUpload: async (req, res) => {
    try {
      const { uploadId } = req.params;
      const success = uploadProgress.cancelUpload(uploadId);

      if (success) {
        res.json({ message: "Upload cancelled" });
      } else {
        res
          .status(404)
          .json({ message: "Upload not found or already completed" });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  sendMessage: async (req, res) => {
    try {
      const { receiverId, content, messageType = "text" } = req.body;

      // Verify that users are matched
      const match = await Match.findOne({
        $or: [
          { user1: req.user._id, user2: receiverId, status: "matched" },
          { user1: receiverId, user2: req.user._id, status: "matched" },
        ],
      });

      if (!match) {
        return res.status(403).json({ message: "Users are not matched" });
      }

      const messageData = {
        sender: req.user._id,
        receiver: receiverId,
        content: content,
        messageType: messageType,
      };

      // Handle file attachments
      if (req.files && req.files.length > 0) {
        messageData.attachments = await Promise.all(
          req.files.map(async (file) => {
            let thumbnailPath = null;

            // Generate thumbnail for images
            if (file.mimetype.startsWith("image/")) {
              thumbnailPath = await generateThumbnail(file.path, file.filename);
            }

            return {
              filename: file.filename,
              originalName: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              path: file.path,
              thumbnailPath: thumbnailPath,
            };
          })
        );
      }

      const message = await Message.create(messageData);
      await message.populate("sender", "email");

      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getAttachment: async (req, res) => {
    try {
      const { messageId, attachmentId } = req.params;

      const message = await Message.findOne({
        _id: messageId,
        $or: [{ sender: req.user._id }, { receiver: req.user._id }],
      });

      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      const attachment = message.attachments.id(attachmentId);
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      // Check if file exists
      if (!fs.existsSync(attachment.path)) {
        return res.status(404).json({ message: "File not found" });
      }

      // Set appropriate headers
      res.setHeader("Content-Type", attachment.mimetype);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${attachment.originalName}"`
      );

      // Stream the file
      const fileStream = fs.createReadStream(attachment.path);
      fileStream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getThumbnail: async (req, res) => {
    try {
      const { messageId, attachmentId } = req.params;

      const message = await Message.findOne({
        _id: messageId,
        $or: [{ sender: req.user._id }, { receiver: req.user._id }],
      });

      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      const attachment = message.attachments.id(attachmentId);
      if (!attachment || !attachment.thumbnailPath) {
        return res.status(404).json({ message: "Thumbnail not available" });
      }

      // Check if thumbnail exists
      if (!fs.existsSync(attachment.thumbnailPath)) {
        return res.status(404).json({ message: "Thumbnail not found" });
      }

      res.setHeader("Content-Type", "image/jpeg");
      const fileStream = fs.createReadStream(attachment.thumbnailPath);
      fileStream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getConversation: async (req, res) => {
    try {
      const { userId } = req.params;

      // Verify that users are matched
      const match = await Match.findOne({
        $or: [
          { user1: req.user._id, user2: userId, status: "matched" },
          { user1: userId, user2: req.user._id, status: "matched" },
        ],
      });

      if (!match) {
        return res.status(403).json({ message: "Users are not matched" });
      }

      // Fetch messages between the two users
      const messages = await Message.find({
        $or: [
          { sender: req.user._id, receiver: userId },
          { sender: userId, receiver: req.user._id },
        ],
      })
        .sort({ createdAt: 1 })
        .populate("sender", "email")
        .populate("receiver", "email");

      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  markAsRead: async (req, res) => {
    try {
      const { senderId } = req.params;

      await Message.updateMany(
        {
          sender: senderId,
          receiver: req.user._id,
          read: false,
        },
        { read: true }
      );

      res.json({ message: "Messages marked as read" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = messagesController;
