const express = require("express");
const chunkedUploadController = require("../controllers/chunkedUploadController");
const chunkUpload = require("../middleware/uploadChunk");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

router.post("/start", chunkedUploadController.startUploadSession);
router.post(
  "/chunk/:sessionId/:chunkNumber",
  chunkUpload.single("chunk"),
  chunkedUploadController.uploadChunk
);
router.get("/status/:sessionId", chunkedUploadController.getUploadStatus);
router.get("/resume/:sessionId", chunkedUploadController.resumeUpload);
router.delete("/cancel/:sessionId", chunkedUploadController.cancelUpload);
router.get("/sessions", chunkedUploadController.listSessions);

module.exports = router;
