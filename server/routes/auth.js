// Import express and create a Router
const express = require("express");
const router = express.Router();

// Replace 'app.post' with 'router.post'
router.post("/register", async (req, res) => {
  try {
    console.log("Registration body:", req.body);
    // ... your registration logic here
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Export the router
module.exports = router;
