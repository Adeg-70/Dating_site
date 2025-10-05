const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
  user1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  user2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "matched", "rejected"],
    default: "pending",
  },
  matchedAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure we don't create duplicate matches
matchSchema.index({ user1: 1, user2: 1 }, { unique: true });

module.exports = mongoose.model("Match", matchSchema);
