// Simple JavaScript for interactive elements
document.addEventListener("DOMContentLoaded", function () {
  // Login/Signup button functionality (for demo)
  const loginBtn = document.querySelector(".login-btn");
  const signupBtn = document.querySelector(".signup-btn");
  const createProfileBtn = document.querySelector(".btn-primary");

  if (loginBtn) {
    loginBtn.addEventListener("click", function (e) {
      e.preventDefault();
      alert("Login feature will be implemented in the next phase!");
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener("click", function (e) {
      e.preventDefault();
      alert("Sign up form will be implemented in the next phase!");
    });
  }

  if (createProfileBtn) {
    createProfileBtn.addEventListener("click", function () {
      alert("Profile creation will be implemented in the next phase!");
    });
  }

  // Animate profile cards on scroll
  const profileCards = document.querySelectorAll(".profile-card");

  function checkScroll() {
    profileCards.forEach((card) => {
      const cardPosition = card.getBoundingClientRect().top;
      const screenPosition = window.innerHeight / 1.3;

      if (cardPosition < screenPosition) {
        card.style.opacity = "1";
        card.style.transform = "translateY(0) rotate(0deg)";
      }
    });
  }

  // Initialize card styles
  profileCards.forEach((card) => {
    card.style.opacity = "0";
    card.style.transition = "all 0.5s ease";

    if (card.classList.contains("preview-card-1")) {
      card.style.transform = "translateY(-50px) rotate(-5deg)";
    } else if (card.classList.contains("preview-card-2")) {
      card.style.transform = "translateY(50px) rotate(2deg)";
    } else {
      card.style.transform = "translateY(50px) rotate(5deg)";
    }
  });

  // Check scroll position on load and scroll
  window.addEventListener("scroll", checkScroll);
  window.addEventListener("load", checkScroll);
});
