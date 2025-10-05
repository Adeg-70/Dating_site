const Profile = require("../models/Profile");

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;

    // Calculate profile completion percentage
    let completion = 30; // Basic info

    if (updates.bio && updates.bio.length > 0) completion += 15;
    if (updates.interests && updates.interests.length > 0) completion += 15;
    if (updates.photos && updates.photos.length > 0) completion += 20;
    if (updates.relationshipGoal && updates.relationshipGoal.length > 0)
      completion += 20;

    updates.profileCompletion = Math.min(completion, 100);

    const profile = await Profile.findOneAndUpdate(
      { user: req.user._id },
      updates,
      { new: true, runValidators: true }
    );

    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload profile picture
exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload a file" });
    }

    const photoPath = `/uploads/profiles/${req.file.filename}`;

    const profile = await Profile.findOne({ user: req.user._id });
    profile.photos.push(photoPath);

    // Update completion if first photo
    if (profile.photos.length === 1) {
      profile.profileCompletion = Math.min(profile.profileCompletion + 20, 100);
    }

    await profile.save();

    res.json({ photo: photoPath, profile });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
