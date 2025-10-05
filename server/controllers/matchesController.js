const Match = require("../models/Match");
const Profile = require("../models/Profile");

// Get potential matches
exports.getPotentialMatches = async (req, res) => {
  try {
    const userProfile = await Profile.findOne({ user: req.user._id });

    // Find profiles that match preferences
    const potentialMatches = await Profile.find({
      user: { $ne: req.user._id },
      gender:
        userProfile.interestedIn === "both"
          ? { $in: ["male", "female"] }
          : userProfile.interestedIn,
      age: { $gte: userProfile.age - 5, $lte: userProfile.age + 5 },
      interestedIn: { $in: [userProfile.gender, "both"] },
    }).populate("user", "email");

    // Exclude already matched or rejected profiles
    const existingMatches = await Match.find({
      $or: [{ user1: req.user._id }, { user2: req.user._id }],
    });

    const excludedUserIds = existingMatches.map((match) =>
      match.user1.toString() === req.user._id.toString()
        ? match.user2
        : match.user1
    );

    const filteredMatches = potentialMatches.filter(
      (profile) => !excludedUserIds.includes(profile.user._id.toString())
    );

    res.json(filteredMatches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Like or pass on a profile
exports.handleMatchAction = async (req, res) => {
  try {
    const { targetUserId, action } = req.body; // action: 'like' or 'pass'

    if (action === "like") {
      // Check if the other user has already liked you
      const existingLike = await Match.findOne({
        user1: targetUserId,
        user2: req.user._id,
        status: "pending",
      });

      if (existingLike) {
        // It's a match!
        existingLike.status = "matched";
        await existingLike.save();

        // Create the reverse match record
        await Match.create({
          user1: req.user._id,
          user2: targetUserId,
          status: "matched",
        });

        return res.json({ match: true, message: "It's a match!" });
      } else {
        // Just a like, no match yet
        await Match.create({
          user1: req.user._id,
          user2: targetUserId,
          status: "pending",
        });

        return res.json({ match: false, message: "Like sent!" });
      }
    } else if (action === "pass") {
      // Record a pass (rejection)
      await Match.create({
        user1: req.user._id,
        user2: targetUserId,
        status: "rejected",
      });

      return res.json({ message: "Profile passed" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user's matches
exports.getMatches = async (req, res) => {
  try {
    const matches = await Match.find({
      $or: [
        { user1: req.user._id, status: "matched" },
        { user2: req.user._id, status: "matched" },
      ],
    }).populate("user1 user2", "email");

    // Get match details with profile information
    const matchDetails = await Promise.all(
      matches.map(async (match) => {
        const otherUserId =
          match.user1._id.toString() === req.user._id.toString()
            ? match.user2._id
            : match.user1._id;

        const profile = await Profile.findOne({ user: otherUserId });

        return {
          matchId: match._id,
          userId: otherUserId,
          name: `${profile.firstName} ${profile.lastName}`,
          age: profile.age,
          photos: profile.photos,
          matchedAt: match.matchedAt,
        };
      })
    );

    res.json(matchDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
