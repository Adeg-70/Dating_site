const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directories exist
const messagesUploadDir = "uploads/messages";
if (!fs.existsSync(messagesUploadDir)) {
  fs.mkdirSync(messagesUploadDir, { recursive: true });
}

// Configure storage for message attachments
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, messagesUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      `message-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

// File filter for messages
const fileFilter = (req, file, cb) => {
  // Allow images, documents, and other common file types
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
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Maximum 5 files per request
  },
});

module.exports = upload;
