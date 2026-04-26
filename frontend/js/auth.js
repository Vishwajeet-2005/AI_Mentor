(function initAuthPage() {
  document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const switchButtons = document.querySelectorAll("[data-auth-target]");
    const message = document.getElementById("authMessage");

    function setMode(mode) {
      document.body.dataset.authMode = mode;
    }

    function setMessage(text, isError = false) {
      if (!message) return;
      message.textContent = text;
      message.classList.toggle("error", isError);
    }

    switchButtons.forEach((button) => {
      button.addEventListener("click", () => setMode(button.dataset.authTarget));
    });

    loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);

      try {
        await MentorApi.login({
          email: String(formData.get("email") || ""),
          password: String(formData.get("password") || ""),
        });
        window.location.href = "/onboarding.html";
      } catch (error) {
        setMessage(error.message || "Unable to log in.", true);
      }
    });

    signupForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(signupForm);

      try {
        await MentorApi.signup({
          name: String(formData.get("name") || ""),
          email: String(formData.get("email") || ""),
          password: String(formData.get("password") || ""),
        });
        window.location.href = "/onboarding.html";
      } catch (error) {
        setMessage(error.message || "Unable to create account.", true);
      }
    });

    setMode("login");
  });
})();
