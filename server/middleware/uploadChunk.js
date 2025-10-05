const multer = require("multer");

// Configure multer for chunk uploads (memory storage)
const chunkUpload = multer({
  storage: multer.memoryStorage(), // Store in memory for chunk processing
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per chunk
  },
  fileFilter: (req, file, cb) => {
    // Only allow specific file types
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "video/mp4",
      "video/mpeg",
      "video/quicktime",
      "audio/mpeg",
      "audio/wav",
      "audio/aac",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"), false);
    }
  },
});

module.exports = chunkUpload;
