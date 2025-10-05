const express = require("express");
const {
  getPotentialMatches,
  handleMatchAction,
  getMatches,
} = require("../controllers/matchesController");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

router.get("/potential", getPotentialMatches);
router.post("/action", handleMatchAction);
router.get("/", getMatches);

module.exports = router;
