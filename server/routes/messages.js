const express = require("express");
const {
  getConversation,
  sendMessage,
  getConversations,
  markAsRead,
  getAttachment,
  getThumbnail,
} = require("../controllers/messagesController");
const auth = require("../middleware/auth");
const upload = require("../middleware/uploadMessages");

const router = express.Router();

const messageController = require("../controllers/messagesController");
router.use(auth);

router.get("/:id", (req, res) => {
  res.json({ message: "Get message route is working!" });
});
router.get("/conversation/:userId", messageController.getConversation);
router.post(
  "/send",
  upload.array("attachments", 5),
  messageController.sendMessage
); //Allow up to 5 files
router.put("/mark-read/:senderId", messageController.markAsRead);
router.get(
  "/attachment/:messageId/:attachmentId",
  messageController.getAttachment
);
router.get(
  "/thumbnail/:messageId/:attachmentId",
  messageController.getThumbnail
);

// Add new routes
//router.get("/upload-progress/:uploadId", getUploadProgress);
router.delete("/upload/:uploadId", messageController.cancelUpload);

module.exports = router;
