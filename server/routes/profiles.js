const express = require("express");
const {
  getProfile,
  updateProfile,
  uploadPhoto,
} = require("../controllers/profileController");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

router.use(auth);

router.get("/", getProfile);
router.put("/", updateProfile);
router.post("/upload", upload.single("photo"), uploadPhoto);

module.exports = router;
