const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      min: 18,
      max: 100,
    },
    gender: {
      type: String,
      required: true,
      enum: ["male", "female", "other"],
    },
    interestedIn: {
      type: String,
      required: true,
      enum: ["men", "women", "both"],
    },
    location: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    interests: [String],
    photos: [String],
    relationshipGoal: {
      type: String,
      enum: ["dating", "relationship", "marriage", "friendship", ""],
    },
    profileCompletion: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Profile", profileSchema);
