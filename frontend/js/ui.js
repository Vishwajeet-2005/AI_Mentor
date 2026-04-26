const UI = (() => {
  const els = {
    messagesContainer: () => document.getElementById("messagesContainer"),
    messagesList: () => document.getElementById("messagesList"),
    welcomeScreen: () => document.getElementById("welcomeScreen"),
    userInput: () => document.getElementById("userInput"),
    sendBtn: () => document.getElementById("sendBtn"),
    charCount: () => document.getElementById("charCount"),
    errorToast: () => document.getElementById("errorToast"),
    toastMessage: () => document.getElementById("toastMessage"),
    chatSubjectBadge: () => document.getElementById("chatSubjectBadge"),
    sidebar: () => document.getElementById("sidebar"),
    apiStatus: () => document.getElementById("apiStatus"),
    conversationList: () => document.getElementById("conversationList"),
    conversationEmpty: () => document.getElementById("conversationEmpty"),
    accountName: () => document.getElementById("accountName"),
    accountEmail: () => document.getElementById("accountEmail"),
    activeConversationTitle: () => document.getElementById("activeConversationTitle"),
    subjectSelect: () => document.getElementById("subjectSelect"),
  };

  let toastTimer = null;
  let typingEl = null;

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseMarkdown(text) {
    if (!text) return "";

    let html = escapeHtml(text);

    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
      const label = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : "";
      return `<pre>${label}<code>${escapeHtml(code.trim())}</code></pre>`;
    });

    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/(^[-*] .+(\n[-*] .+)*)/gm, (block) => {
      const items = block.split("\n").map((line) => `<li>${line.replace(/^[-*] /, "")}</li>`).join("");
      return `<ul>${items}</ul>`;
    });
    html = html.replace(/(^\d+\. .+(\n\d+\. .+)*)/gm, (block) => {
      const items = block.split("\n").map((line) => `<li>${line.replace(/^\d+\. /, "")}</li>`).join("");
      return `<ol>${items}</ol>`;
    });

    return html
      .split(/\n\n+/)
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (/^<(h[123]|ul|ol|pre|blockquote)/.test(trimmed)) return trimmed;
        return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
      })
      .join("\n");
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateTime(value) {
    const date = new Date(value);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function hideWelcome() {
    const welcome = els.welcomeScreen();
    if (welcome) welcome.classList.add("hidden");
  }

  function showWelcome() {
    const welcome = els.welcomeScreen();
    const list = els.messagesList();
    if (welcome) welcome.classList.remove("hidden");
    if (list) list.innerHTML = "";
  }

  function clearMessages() {
    const list = els.messagesList();
    if (list) list.innerHTML = "";
  }

  function appendMessage(role, text, createdAt = new Date().toISOString()) {
    hideWelcome();

    const list = els.messagesList();
    const msgEl = document.createElement("div");
    const avatarEl = document.createElement("div");
    const contentEl = document.createElement("div");
    const bubbleEl = document.createElement("div");
    const metaEl = document.createElement("div");

    msgEl.className = `message ${role}`;
    avatarEl.className = "msg-avatar";
    contentEl.className = "msg-content";
    bubbleEl.className = "msg-bubble";
    metaEl.className = "msg-meta";

    avatarEl.textContent = role === "mentor" ? "M" : "You";
    metaEl.textContent = formatTime(new Date(createdAt));

    if (role === "mentor") {
      bubbleEl.innerHTML = parseMarkdown(text);
    } else {
      bubbleEl.textContent = text;
    }

    contentEl.appendChild(bubbleEl);
    contentEl.appendChild(metaEl);
    msgEl.appendChild(avatarEl);
    msgEl.appendChild(contentEl);
    list.appendChild(msgEl);
    scrollToBottom();
  }

  function renderMessages(messages) {
    clearMessages();
    if (!messages.length) {
      showWelcome();
      return;
    }

    hideWelcome();
    messages.forEach((message) => {
      appendMessage(message.role === "model" ? "mentor" : "user", message.text, message.createdAt);
    });
  }

  function showTyping() {
    if (typingEl) return;

    const list = els.messagesList();
    typingEl = document.createElement("div");
    typingEl.className = "typing-indicator";
    typingEl.innerHTML = `
      <div class="msg-avatar">M</div>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;

    list.appendChild(typingEl);
    scrollToBottom();
  }

  function hideTyping() {
    if (!typingEl) return;
    typingEl.remove();
    typingEl = null;
  }

  function scrollToBottom() {
    const container = els.messagesContainer();
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  function setSendEnabled(enabled) {
    const button = els.sendBtn();
    if (button) button.disabled = !enabled;
  }

  function updateCharCount(length) {
    const counter = els.charCount();
    if (!counter) return;
    counter.textContent = `${length} / ${CONFIG.MAX_INPUT_LENGTH}`;
    counter.classList.toggle("warning", length > CONFIG.MAX_INPUT_LENGTH * 0.85);
  }

  function clearInput() {
    const input = els.userInput();
    if (!input) return;
    input.value = "";
    input.style.height = "auto";
    updateCharCount(0);
    setSendEnabled(false);
  }

  function setLoading(isLoading) {
    const input = els.userInput();
    const button = els.sendBtn();
    if (input) input.disabled = isLoading;
    if (button) button.disabled = isLoading;
  }

  function showToast(message, duration = 5000) {
    const toast = els.errorToast();
    const toastMessage = els.toastMessage();
    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;
    toast.classList.add("visible");

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hideToast(), duration);
  }

  function hideToast() {
    const toast = els.errorToast();
    if (toast) toast.classList.remove("visible");
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  }

  function setSubjectBadge(label) {
    const badge = els.chatSubjectBadge();
    if (badge) badge.textContent = label;
  }

  function setSubjectSelection(subject) {
    const select = els.subjectSelect();
    if (select) select.value = subject;
  }

  function setApiStatus(message, isError = false) {
    const status = els.apiStatus();
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function setAccount(user) {
    const name = els.accountName();
    const email = els.accountEmail();
    if (name) name.textContent = user?.name || "Guest";
    if (email) email.textContent = user?.email || "";
  }

  function setConversationTitle(title) {
    const target = els.activeConversationTitle();
    if (target) target.textContent = title || "New conversation";
  }

  function renderConversationList(conversations, activeConversationId) {
    const list = els.conversationList();
    const emptyState = els.conversationEmpty();
    if (!list) return;

    list.innerHTML = "";
    const hasItems = conversations.length > 0;

    if (emptyState) {
      emptyState.classList.toggle("hidden", hasItems);
    }

    conversations.forEach((conversation) => {
      const button = document.createElement("button");
      button.className = "conversation-item";
      button.dataset.conversationId = conversation.id;
      button.classList.toggle("active", conversation.id === activeConversationId);
      button.innerHTML = `
        <div class="conversation-topline">
          <span class="conversation-time">${escapeHtml(formatDateTime(conversation.updatedAt))}</span>
        </div>
        <span class="conversation-title">${escapeHtml(conversation.title || "New conversation")}</span>
      `;
      list.appendChild(button);
    });
  }

  function toggleSidebar() {
    const sidebar = els.sidebar();
    const overlay = document.getElementById("sidebarOverlay");
    if (!sidebar) return;

    const isOpen = sidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("visible", isOpen);
  }

  function closeSidebar() {
    const sidebar = els.sidebar();
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("visible");
  }

  return {
    appendMessage,
    clearInput,
    clearMessages,
    closeSidebar,
    hideToast,
    hideTyping,
    renderConversationList,
    renderMessages,
    scrollToBottom,
    setAccount,
    setApiStatus,
    setConversationTitle,
    setLoading,
    setSendEnabled,
    setSubjectBadge,
    setSubjectSelection,
    showToast,
    showTyping,
    showWelcome,
    toggleSidebar,
    updateCharCount,
  };
})();
