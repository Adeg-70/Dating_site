import { getSocket, initSocket } from "./socket.js";

class ConversationService {
  constructor() {
    this.socket = null;
    this.currentConversation = null;
    this.typingTimeouts = new Map();
    this.messageHandlers = new Set();
    this.typingHandlers = new Set();
    this.readReceiptHandlers = new Set();
  }

  // Initialize the conversation service
  initialize() {
    this.socket = initSocket();
    if (!this.socket) return false;

    this.setupEventListeners();
    return true;
  }

  // Set up Socket.io event listeners
  setupEventListeners() {
    this.socket.on("receive-message", (message) => {
      this.handleIncomingMessage(message);
    });

    this.socket.on("message-sent", (message) => {
      this.handleMessageSent(message);
    });

    this.socket.on("user-typing", (data) => {
      this.handleTypingIndicator(data);
    });

    this.socket.on("messages-read", (data) => {
      this.handleReadReceipts(data);
    });

    this.socket.on("message-error", (error) => {
      console.error("Message error:", error);
    });
  }

  // Join a conversation
  joinConversation(conversationId, otherUserId) {
    if (!this.socket) return;

    this.currentConversation = {
      id: conversationId,
      otherUserId: otherUserId,
    };

    this.socket.emit("join-conversation", conversationId);
  }

  // Send a message
  sendMessage(content) {
    if (!this.socket || !this.currentConversation) {
      throw new Error("Not connected to conversation");
    }

    const messageData = {
      receiverId: this.currentConversation.otherUserId,
      conversationId: this.currentConversation.id,
      content: content.trim(),
    };

    if (!messageData.content) {
      throw new Error("Message cannot be empty");
    }

    this.socket.emit("send-message", messageData);
  }

  // Handle incoming message
  handleIncomingMessage(message) {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message, "received");
      } catch (error) {
        console.error("Error in message handler:", error);
      }
    });
  }

  // Handle sent message confirmation
  handleMessageSent(message) {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message, "sent");
      } catch (error) {
        console.error("Error in message handler:", error);
      }
    });
  }

  // Handle typing indicators
  handleTypingIndicator(data) {
    this.typingHandlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error("Error in typing handler:", error);
      }
    });
  }

  // Handle read receipts
  handleReadReceipts(data) {
    this.readReceiptHandlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error("Error in read receipt handler:", error);
      }
    });
  }

  // Send typing start indicator
  startTyping() {
    if (!this.socket || !this.currentConversation) return;

    const typingData = {
      receiverId: this.currentConversation.otherUserId,
      conversationId: this.currentConversation.id,
    };

    this.socket.emit("typing-start", typingData);

    // Clear existing timeout
    if (this.typingTimeouts.has(this.currentConversation.id)) {
      clearTimeout(this.typingTimeouts.get(this.currentConversation.id));
    }

    // Set timeout to automatically stop typing indicator
    const timeout = setTimeout(() => {
      this.stopTyping();
    }, 3000);

    this.typingTimeouts.set(this.currentConversation.id, timeout);
  }

  // Send typing stop indicator
  stopTyping() {
    if (!this.socket || !this.currentConversation) return;

    const typingData = {
      receiverId: this.currentConversation.otherUserId,
      conversationId: this.currentConversation.id,
    };

    this.socket.emit("typing-stop", typingData);

    // Clear timeout
    if (this.typingTimeouts.has(this.currentConversation.id)) {
      clearTimeout(this.typingTimeouts.get(this.currentConversation.id));
      this.typingTimeouts.delete(this.currentConversation.id);
    }
  }

  // Mark messages as read
  markMessagesAsRead(senderId) {
    if (!this.socket || !this.currentConversation) return;

    const readData = {
      senderId: senderId,
      conversationId: this.currentConversation.id,
    };

    this.socket.emit("mark-messages-read", readData);
  }

  // Add message event handler
  onMessage(handler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  // Add typing indicator handler
  onTyping(handler) {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  // Add read receipt handler
  onReadReceipt(handler) {
    this.readReceiptHandlers.add(handler);
    return () => this.readReceiptHandlers.delete(handler);
  }

  // Get current conversation
  getCurrentConversation() {
    return this.currentConversation;
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentConversation = null;
    this.messageHandlers.clear();
    this.typingHandlers.clear();
    this.readReceiptHandlers.clear();
    this.typingTimeouts.clear();
  }

  // Add this method to the ConversationService class
  async sendMessageWithFiles(content, files) {
    if (!this.socket || !this.currentConversation) {
      throw new Error("Not connected to conversation");
    }

    // First upload files
    const uploadResult = await fileUploader.uploadFiles(
      files,
      `/api/messages/send`
    );

    if (!uploadResult.success) {
      throw new Error("File upload failed");
    }

    // Then send message via socket
    const messageData = {
      receiverId: this.currentConversation.otherUserId,
      conversationId: this.currentConversation.id,
      content: content,
      messageType: files.length > 0 ? "file" : "text",
    };

    this.socket.emit("send-message", messageData);
    return uploadResult.data;
  }

  // Update the sendMessage method to handle file messages
  async sendMessage(content, files = []) {
    if (files && files.length > 0) {
      return this.sendMessageWithFiles(content, files);
    }

    // Original text message handling
    if (!this.socket || !this.currentConversation) {
      throw new Error("Not connected to conversation");
    }

    const messageData = {
      receiverId: this.currentConversation.otherUserId,
      conversationId: this.currentConversation.id,
      content: content.trim(),
    };

    if (!messageData.content && files.length === 0) {
      throw new Error("Message cannot be empty");
    }

    this.socket.emit("send-message", messageData);
  }
}

// Create singleton instance
export const conversationService = new ConversationService();
