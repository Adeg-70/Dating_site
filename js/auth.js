import { authAPI } from "./api.js";

// Check if user is logged in
export function isLoggedIn() {
  return !!localStorage.getItem("token");
}

// Redirect if not logged in
export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

// Redirect if already logged in
export function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = "dashboard.html";
    return true;
  }
  return false;
}

// Login function
export async function login(email, password) {
  try {
    const response = await authAPI.login(email, password);

    if (response.token) {
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      return { success: true, data: response };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Register function
export async function register(userData) {
  try {
    const response = await authAPI.register(userData);

    if (response.token) {
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      return { success: true, data: response };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Logout function
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

// Get current user
export function getCurrentUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}
