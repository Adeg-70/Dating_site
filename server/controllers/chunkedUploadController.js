const UploadSession = require("../models/UploadSession");
const Message = require("../models/Message");
const chunkStorage = require("../utils/chunkStorage");
const { generateThumbnail } = require("../utils/thumbnailGenerator");
const mongoose = require("mongoose");

const bandwidthThrottler = require("../middleware/bandwidthThrottle");

const bandwidthPredictor = require("../services/bandwidthPredictor");

const encryptionService = require("../services/encryptionService");

const virusScanner = require("../services/virusScanner");

// Initialize predictor
bandwidthPredictor.initialize();

class ChunkedUploadController {
  // Start a new upload session
  async startUploadSession(req, res) {
    try {
      const {
        fileName,
        fileSize,
        totalChunks,
        chunkSize,
        receiverId,
        mimeType,
      } = req.body;

      const sessionId = chunkStorage.generateSessionId();

      const session = new UploadSession({
        sessionId,
        userId: req.user._id,
        fileName,
        fileSize,
        totalChunks,
        chunkSize,
        metadata: {
          originalName: fileName,
          mimeType,
          receiverId,
        },
      });

      await session.save();

      res.json({
        sessionId,
        chunkSize: parseInt(chunkSize),
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Upload a chunk
  // Add bandwidth throttling to uploadChunk method
  // Add encryption to upload process
  async uploadChunk(req, res) {
    try {
      const { sessionId, chunkNumber } = req.params;
      const chunkData = req.file.buffer;

      // Scan for viruses
      const scanResult = await virusScanner.scanBuffer(chunkData);

      if (scanResult.isInfected) {
        return res.status(400).json({
          message: "File contains viruses",
          viruses: scanResult.viruses,
          infected: true,
        });
      }

      const chunkSize = chunkData.length;

      const encryptionService = require("../services/encryptionService");

      const encryptionKey = req.headers["x-encryption-key"];

      let processedData = chunkData;

      // Encrypt if key is provided
      if (encryptionKey) {
        const keyBuffer = Buffer.from(encryptionKey, "hex");
        const encryptedResult = await encryptionService.encryptBuffer(
          chunkData,
          keyBuffer
        );
        processedData = encryptedResult.fullData;
      }

      // Get network features for prediction
      const networkFeatures = {
        downlink: req.headers["x-network-downlink"],
        rtt: req.headers["x-network-rtt"],
        effectiveType: req.headers["x-network-type"],
      };

      const predictedBandwidth = await bandwidthPredictor.predictBandwidth(
        bandwidthPredictor.extractFeatures(networkFeatures, {})
      );

      // Adaptive throttling based on prediction
      const throttleTime = Math.max(
        0,
        (chunkSize / predictedBandwidth) * 1000 - 100
      );
      await new Promise((resolve) => setTimeout(resolve, throttleTime));

      // ... rest of the upload logic ...

      // Throttle bandwidth
      try {
        await bandwidthThrottler.throttleUser(
          req.user._id.toString(),
          chunkSize
        );
      } catch (throttleError) {
        return res.status(429).json({
          message: throttleError.message,
          retryAfter: 5, // seconds
        });
      }

      const session = await UploadSession.findOne({
        sessionId,
        userId: req.user._id,
      });

      if (!session) {
        return res.status(404).json({ message: "Upload session not found" });
      }

      if (session.status !== "uploading") {
        return res
          .status(400)
          .json({ message: "Upload session is not active" });
      }

      // Check if chunk already exists
      if (session.uploadedChunks.includes(parseInt(chunkNumber))) {
        return res.json({ message: "Chunk already uploaded" });
      }

      // Save chunk
      await chunkStorage.saveChunk(sessionId, chunkNumber, chunkData);

      // Update session
      session.uploadedChunks.push(parseInt(chunkNumber));
      session.uploadedChunks.sort((a, b) => a - b);

      // Check if upload is complete
      if (session.uploadedChunks.length === session.totalChunks) {
        await this.completeUpload(session);
      } else {
        await session.save();
      }

      res.json({
        uploadedChunks: session.uploadedChunks,
        progress: Math.round(
          (session.uploadedChunks.length / session.totalChunks) * 100
        ),
        status: session.status,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Add bandwidth usage endpoint
  async getBandwidthUsage(req, res) {
    try {
      const usage = await bandwidthThrottler.getUserBandwidthUsage(
        req.user._id.toString()
      );
      res.json(usage);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Complete the upload and assemble the file
  async completeUpload(session) {
    const sessionId = session.sessionId;

    try {
      // Create final file path
      const finalDir = path.join("uploads", "messages");
      if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
      }

      const fileExt = path.extname(session.fileName);
      const finalFileName = `${sessionId}${fileExt}`;
      const finalPath = path.join(finalDir, finalFileName);

      // Assemble chunks into final file
      await chunkStorage.assembleFile(
        sessionId,
        session.totalChunks,
        finalPath
      );

      // Generate thumbnail if it's an image
      let thumbnailPath = null;
      if (session.metadata.mimeType.startsWith("image/")) {
        thumbnailPath = await generateThumbnail(finalPath, finalFileName);
      }

      // Create message with attachment
      const message = new Message({
        sender: session.userId,
        receiver: session.metadata.receiverId,
        content: `Sent a file: ${session.metadata.originalName}`,
        attachments: [
          {
            filename: finalFileName,
            originalName: session.metadata.originalName,
            mimetype: session.metadata.mimeType,
            size: session.fileSize,
            path: finalPath,
            thumbnailPath: thumbnailPath,
          },
        ],
        messageType: "file",
      });

      await message.save();

      // Update session
      session.status = "completed";
      session.messageId = message._id;
      await session.save();

      // Cleanup chunks
      await chunkStorage.cleanupSession(sessionId);

      return message;
    } catch (error) {
      session.status = "error";
      session.error = error.message;
      await session.save();
      throw error;
    }
  }

  // Get upload session status
  async getUploadStatus(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await UploadSession.findOne({
        sessionId,
        userId: req.user._id,
      });

      if (!session) {
        return res.status(404).json({ message: "Upload session not found" });
      }

      res.json({
        uploadedChunks: session.uploadedChunks,
        totalChunks: session.totalChunks,
        progress: Math.round(
          (session.uploadedChunks.length / session.totalChunks) * 100
        ),
        status: session.status,
        fileSize: session.fileSize,
        uploadedSize: await chunkStorage.getSessionSize(sessionId),
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Resume upload session
  async resumeUpload(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await UploadSession.findOne({
        sessionId,
        userId: req.user._id,
      });

      if (!session) {
        return res.status(404).json({ message: "Upload session not found" });
      }

      if (session.status !== "uploading") {
        return res
          .status(400)
          .json({ message: "Cannot resume completed or cancelled session" });
      }

      // Verify which chunks are already uploaded
      const existingChunks = [];
      for (let i = 0; i < session.totalChunks; i++) {
        if (await chunkStorage.chunkExists(sessionId, i)) {
          existingChunks.push(i);
        }
      }

      // Update session with actually existing chunks
      session.uploadedChunks = existingChunks;
      await session.save();

      res.json({
        uploadedChunks: existingChunks,
        totalChunks: session.totalChunks,
        chunkSize: session.chunkSize,
        progress: Math.round(
          (existingChunks.length / session.totalChunks) * 100
        ),
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Cancel upload session
  async cancelUpload(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await UploadSession.findOne({
        sessionId,
        userId: req.user._id,
      });

      if (!session) {
        return res.status(404).json({ message: "Upload session not found" });
      }

      session.status = "cancelled";
      await session.save();

      // Cleanup chunks
      await chunkStorage.cleanupSession(sessionId);

      res.json({ message: "Upload cancelled successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // List user's upload sessions
  async listSessions(req, res) {
    try {
      const sessions = await UploadSession.find({
        userId: req.user._id,
      })
        .sort({ createdAt: -1 })
        .limit(10);

      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new ChunkedUploadController();
