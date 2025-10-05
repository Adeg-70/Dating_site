// Show notification
export function showNotification(message, type = "info") {
  // Remove existing notifications
  const existingNotification = document.getElementById("notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement("div");
  notification.id = "notification";
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  // Add styles
  notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      z-index: 10000;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 300px;
  `;

  if (type === "success") {
    notification.style.background = "#4CAF50";
  } else if (type === "error") {
    notification.style.background = "#f44336";
  } else if (type === "warning") {
    notification.style.background = "#ff9800";
  } else {
    notification.style.background = "#2196F3";
  }

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Format date
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Debounce function for search
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Validate email
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Validate password strength
export function validatePassword(password) {
  if (password.length < 6) {
    return "Password must be at least 6 characters long";
  }
  return null;
}
