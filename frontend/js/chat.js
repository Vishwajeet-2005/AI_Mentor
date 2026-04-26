const Chat = (() => {
  const state = {
    user: null,
    history: [],
    currentSubject: "general",
    currentConversationId: null,
    currentConversationTitle: "New conversation",
    conversations: [],
    isLoading: false,
  };

  function getDisplayTitle(conversation) {
    return conversation?.title || "New conversation";
  }

  function syncConversationList() {
    UI.renderConversationList(state.conversations, state.currentConversationId);
    UI.setConversationTitle(state.currentConversationTitle);
  }

  function updateConversationSummary(summary) {
    const existing = state.conversations.find((conversation) => conversation.id === summary.id);
    if (existing) {
      Object.assign(existing, summary);
    } else {
      state.conversations.unshift(summary);
    }

    state.conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    state.currentConversationTitle = getDisplayTitle(summary);
    syncConversationList();
  }

  async function ensureConversation() {
    if (state.currentConversationId) return state.currentConversationId;

    const { conversation } = await MentorApi.createConversation(state.currentSubject);
    state.currentConversationId = conversation.id;
    state.currentConversationTitle = getDisplayTitle(conversation);
    updateConversationSummary(conversation);
    return conversation.id;
  }

  async function loadUser() {
    const { user } = await MentorApi.getCurrentUser();
    state.user = user;
    UI.setAccount(user);
    return user;
  }

  async function loadConversationList() {
    const { conversations } = await MentorApi.listConversations();
    state.conversations = conversations;
    syncConversationList();
  }

  async function loadConversation(conversationId) {
    const { conversation } = await MentorApi.getConversation(conversationId);
    state.currentConversationId = conversation.id;
    state.currentSubject = conversation.subject;
    state.history = conversation.messages.map((message) => ({
      role: message.role,
      text: message.text,
      createdAt: message.createdAt,
    }));
    state.currentConversationTitle = getDisplayTitle(conversation);

    UI.setSubjectBadge(CONFIG.SUBJECTS[conversation.subject] || CONFIG.SUBJECTS.general);
    UI.setSubjectSelection(conversation.subject);
    UI.renderMessages(state.history);

    syncConversationList();
  }

  async function sendMessage(rawMessage) {
    const message = rawMessage.trim();
    if (!message || state.isLoading) return;

    state.isLoading = true;
    UI.setLoading(true);
    UI.clearInput();
    UI.appendMessage("user", message);
    UI.showTyping();

    try {
      const conversationId = await ensureConversation();
      const result = await MentorApi.sendMessage({
        subject: state.currentSubject,
        history: state.history,
        message,
        conversationId,
      });

      state.history.push({ role: "user", text: message, createdAt: new Date().toISOString() });
      state.history.push({ role: "model", text: result.reply, createdAt: new Date().toISOString() });

      UI.hideTyping();
      UI.appendMessage("mentor", result.reply);
      UI.setApiStatus("Connected to backend");

      if (result.conversation) {
        updateConversationSummary(result.conversation);
      }
    } catch (error) {
      UI.hideTyping();

      if (error.statusCode === 401) {
        window.location.href = "/login.html";
        return;
      }

      UI.showToast(error.message || "An unexpected error occurred.", 7000);
      UI.appendMessage("mentor", `**Connection issue:**\n\n${error.message || "Please try again."}`);
      UI.setApiStatus("Backend request failed", true);
    } finally {
      state.isLoading = false;
      UI.setLoading(false);

      const input = document.getElementById("userInput");
      if (input && input.value.trim()) {
        UI.setSendEnabled(true);
      }
    }
  }

  function switchSubject(subject) {
    if (!CONFIG.SUBJECTS[subject]) return;

    state.currentSubject = subject;
    state.currentConversationId = null;
    state.currentConversationTitle = "New conversation";
    state.history = [];

    UI.setSubjectBadge(CONFIG.SUBJECTS[subject]);
    UI.setSubjectSelection(subject);
    UI.showWelcome();
    syncConversationList();
  }

  function clearChat() {
    state.currentConversationId = null;
    state.currentConversationTitle = "New conversation";
    state.history = [];
    UI.showWelcome();
    syncConversationList();
  }

  async function logout() {
    await MentorApi.logout();
    window.location.href = "/login.html";
  }

  return {
    clearChat,
    loadConversation,
    loadConversationList,
    loadUser,
    logout,
    sendMessage,
    switchSubject,
  };
})();
