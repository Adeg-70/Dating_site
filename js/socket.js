let socket = null;

export function initSocket() {
  const token = localStorage.getItem("token");
  if (!token) return;

  // Connect to Socket.io server
  socket = io("http://localhost:5000", {
    auth: {
      token: token,
    },
  });

  socket.on("connect", () => {
    console.log("Connected to server");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function joinRoom(roomId) {
  if (socket) {
    socket.emit("join-room", roomId);
  }
}

export function sendMessage(data) {
  if (socket) {
    socket.emit("send-message", data);
  }
}

export function typing(data) {
  if (socket) {
    socket.emit("typing", data);
  }
}

// Listen for incoming messages
export function onMessageReceived(callback) {
  if (socket) {
    socket.on("receive-message", callback);
  }
}

// Listen for typing indicators
export function onTyping(callback) {
  if (socket) {
    socket.on("user-typing", callback);
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Enhanced socket initialization with reconnection logic
export function initSocket() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const socket = io("http://localhost:5000", {
      auth: {
        token: token,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      showNotification("Connection error. Trying to reconnect...", "error");
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log("Reconnected after", attemptNumber, "attempts");
      showNotification("Connection restored", "success");
    });

    socket.on("reconnect_failed", () => {
      console.error("Failed to reconnect");
      showNotification("Failed to connect to server", "error");
    });

    return socket;
  } catch (error) {
    console.error("Socket initialization error:", error);
    return null;
  }
}
