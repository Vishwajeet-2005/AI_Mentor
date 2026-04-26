(function initApp() {
  document.addEventListener("DOMContentLoaded", async () => {
    const overlay = document.createElement("div");
    overlay.id = "sidebarOverlay";
    overlay.className = "sidebar-overlay";
    document.body.appendChild(overlay);

    try {
      const user = await Chat.loadUser();
      const profileResponse = await MentorApi.getProfile(user.id).catch((error) => {
        if (error.statusCode === 404) {
          window.location.href = "/onboarding.html";
          return null;
        }

        throw error;
      });

      if (!profileResponse) return;
      if (!profileResponse.profile?.onboardingCompleted) {
        window.location.href = "/onboarding.html";
        return;
      }

      await Chat.loadConversationList();
    } catch (_error) {
      window.location.href = "/login.html";
      return;
    }

    setupInputHandlers();
    setupSidebarHandlers();
    setupStarterCards();
    setupToastClose();
    setupClearChat();
    setupConversationHandlers();
    setupLogoutHandler();

    UI.setApiStatus("Ready to chat");
    document.getElementById("userInput")?.focus();
  });

  function setupInputHandlers() {
    const input = document.getElementById("userInput");
    const sendBtn = document.getElementById("sendBtn");

    if (!input || !sendBtn) return;

    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 200)}px`;

      const length = input.value.length;
      UI.updateCharCount(length);
      UI.setSendEnabled(length > 0 && length <= CONFIG.MAX_INPUT_LENGTH);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!sendBtn.disabled) {
          Chat.sendMessage(input.value);
        }
      }
    });

    sendBtn.addEventListener("click", () => {
      Chat.sendMessage(input.value);
    });
  }

  function setupSidebarHandlers() {
    const toggleBtn = document.getElementById("sidebarToggle");
    const newChatBtn = document.getElementById("newChatBtn");
    const subjectSelect = document.getElementById("subjectSelect");

    toggleBtn?.addEventListener("click", UI.toggleSidebar);

    document.addEventListener("click", (event) => {
      const overlay = document.getElementById("sidebarOverlay");
      if (overlay && event.target === overlay) {
        UI.closeSidebar();
      }
    });

    newChatBtn?.addEventListener("click", () => {
      Chat.clearChat();
      UI.closeSidebar();
      document.getElementById("userInput")?.focus();
    });

    subjectSelect?.addEventListener("change", (event) => {
      Chat.switchSubject(event.target.value);
      document.getElementById("userInput")?.focus();
    });
  }

  function setupStarterCards() {
    const starterGrid = document.querySelector(".starter-grid");
    if (!starterGrid) return;

    starterGrid.addEventListener("click", (event) => {
      const card = event.target.closest(".starter-card");
      if (!card) return;
      Chat.sendMessage(card.dataset.prompt || "");
    });
  }

  function setupToastClose() {
    document.getElementById("toastClose")?.addEventListener("click", UI.hideToast);
  }

  function setupClearChat() {
    document.getElementById("clearChatBtn")?.addEventListener("click", () => {
      if (window.confirm("Start a fresh conversation? Your saved chats will still be available in history.")) {
        Chat.clearChat();
      }
    });
  }

  function setupConversationHandlers() {
    document.getElementById("conversationList")?.addEventListener("click", async (event) => {
      const button = event.target.closest(".conversation-item");
      if (!button) return;
      await Chat.loadConversation(button.dataset.conversationId);
      UI.closeSidebar();
    });
  }

  function setupLogoutHandler() {
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      await Chat.logout();
    });
  }
})();
