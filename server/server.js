// 1. Import dependencies at the top
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("./models/User");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profiles");
const matchesRoutes = require("./routes/matches");
const messagesRoutes = require("./routes/messages");
const chunkedUploadRoutes = require("./routes/chunkedUpload");

const tf = require("@tensorflow/tfjs");

const config = require("./config/" +
  (process.env.NODE_ENV || "development") +
  ".json");
// If using database.js, ensure it's correctly configured
// const databaseConfig = require("./config/database");

// 2. Initialize Express app FIRST
const app = express();
const server = http.createServer(app);

// 3. Now configure middleware (AFTER app declaration)
/*app.use(cors({ origin: config.corsOrigin }));*/

// With this:
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:5500"], // Add your origins here
    credentials: true, // Keep this if you're using cookies/sessions
  })
);

app.use(express.json());
app.use(express.static("../")); // Serve frontend files

// 4. Configure Socket.io
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// 5. Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error("Authentication error"));
    }

    socket.userId = user._id.toString();
    next();
  } catch (error) {
    next(new Error("Authentication error"));
  }
});

// 6. SINGLE Socket.io connection handler (removed duplicates)
io.on("connection", (socket) => {
  console.log("User connected:", socket.userId);

  // Join user's personal room
  socket.join(socket.userId);

  // Handle joining conversation rooms
  socket.on("join-conversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.userId} joined conversation ${conversationId}`);
  });

  // Handle sending messages
  socket.on("send-message", async (data) => {
    try {
      // Save message to database
      const Message = require("./models/Message");
      const message = new Message({
        sender: socket.userId,
        receiver: data.receiverId,
        content: data.content,
        timestamp: new Date(),
      });

      await message.save();

      // Populate sender info for the response
      await message.populate("sender", "email");

      // Emit to the receiver
      socket
        .to(data.receiverId)
        .to(data.conversationId)
        .emit("receive-message", {
          _id: message._id,
          sender: {
            _id: message.sender._id,
            email: message.sender.email,
          },
          receiver: data.receiverId,
          content: data.content,
          timestamp: message.timestamp,
          read: false,
        });

      // Also send back to sender for confirmation
      socket.emit("message-sent", {
        _id: message._id,
        sender: {
          _id: socket.userId,
          email: message.sender.email,
        },
        receiver: data.receiverId,
        content: data.content,
        timestamp: message.timestamp,
        read: false,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("message-error", { error: "Failed to send message" });
    }
  });

  // Handle typing indicators
  socket.on("typing-start", (data) => {
    socket.to(data.conversationId).to(data.receiverId).emit("user-typing", {
      userId: socket.userId,
      conversationId: data.conversationId,
      isTyping: true,
    });
  });

  socket.on("typing-stop", (data) => {
    socket.to(data.conversationId).to(data.receiverId).emit("user-typing", {
      userId: socket.userId,
      conversationId: data.conversationId,
      isTyping: false,
    });
  });

  // Handle message read receipts
  socket.on("mark-messages-read", async (data) => {
    try {
      const Message = require("./models/Message");
      await Message.updateMany(
        {
          sender: data.senderId,
          receiver: socket.userId,
          read: false,
        },
        { read: true, readAt: new Date() }
      );

      // Notify the sender that messages were read
      socket.to(data.senderId).emit("messages-read", {
        readerId: socket.userId,
        conversationId: data.conversationId,
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.userId);
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// 7. Routes
app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/matches", matchesRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/upload/chunked", chunkedUploadRoutes);

// 8. MongoDB connection with error handling
/*mongoose
  .connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/loveconnect", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => {
    console.log("MongoDB connection error:", err);*/

/*mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })*/

mongoose
  .connect(process.env.MONGODB_URI)

  .then(() => console.log("MongoDB connected successfully to Atlas!"))
  .catch((err) => {
    console.log("MongoDB connection error:", err);
    process.exit(1); // Exit if database connection fails
  });

// 9. Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
