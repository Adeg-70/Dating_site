const API_BASE_URL = "http://localhost:5000/api";

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers,
    ...options,
  });

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "login.html";
    return;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

// Auth API calls
export const authAPI = {
  login: (email, password) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (userData) =>
    apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  getCurrentUser: () => apiRequest("/auth/me"),
};

// Profile API calls
export const profileAPI = {
  getProfile: () => apiRequest("/profiles"),

  updateProfile: (profileData) =>
    apiRequest("/profiles", {
      method: "PUT",
      body: JSON.stringify(profileData),
    }),

  uploadPhoto: (formData) =>
    apiRequest("/profiles/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: formData,
    }),
};

// Matches API calls
export const matchesAPI = {
  getPotentialMatches: () => apiRequest("/matches/potential"),

  likeProfile: (targetUserId) =>
    apiRequest("/matches/action", {
      method: "POST",
      body: JSON.stringify({ targetUserId, action: "like" }),
    }),

  passProfile: (targetUserId) =>
    apiRequest("/matches/action", {
      method: "POST",
      body: JSON.stringify({ targetUserId, action: "pass" }),
    }),

  getMatches: () => apiRequest("/matches"),
};

// Messages API calls
export const messagesAPI = {
  getConversations: () => apiRequest("/messages/conversations"),

  getConversation: (userId) => apiRequest(`/messages/conversation/${userId}`),

  sendMessage: (receiverId, content) =>
    apiRequest("/messages/send", {
      method: "POST",
      body: JSON.stringify({ receiverId, content }),
    }),

  markAsRead: (senderId) =>
    apiRequest(`/messages/read/${senderId}`, {
      method: "PUT",
    }),
};
