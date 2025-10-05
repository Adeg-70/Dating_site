const User = require("../models/User");
const Profile = require("../models/Profile");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// Register new user
exports.register = async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      age,
      gender,
      interestedIn,
      location,
    } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create user
    const user = await User.create({ email, password });

    // Create profile
    const profile = await Profile.create({
      user: user._id,
      firstName,
      lastName,
      age,
      gender,
      interestedIn,
      location,
      profileCompletion: 30, // Basic info completed
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
      },
      profile,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.correctPassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken(user._id);

    // Get user profile
    const profile = await Profile.findOne({ user: user._id });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
      },
      profile,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get current user
exports.getMe = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id }).populate(
      "user",
      "email"
    );

    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
