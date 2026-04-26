const MentorApi = (() => {
  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    let body = {};

    try {
      body = await response.json();
    } catch (_error) {
      body = {};
    }

    if (!response.ok) {
      const error = new Error(body.error || "Request failed.");
      error.statusCode = response.status;
      throw error;
    }

    return body;
  }

  async function getCurrentUser() {
    return request(CONFIG.API_AUTH_ME_ENDPOINT, { method: "GET" });
  }

  async function login(payload) {
    return request(CONFIG.API_LOGIN_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function signup(payload) {
    return request(CONFIG.API_SIGNUP_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function logout() {
    return request(CONFIG.API_LOGOUT_ENDPOINT, { method: "POST" });
  }

  async function getProfile(userId) {
    return request(`${CONFIG.API_PROFILES_ENDPOINT}/${encodeURIComponent(userId)}`, { method: "GET" });
  }

  async function saveProfile(payload) {
    return request(CONFIG.API_PROFILES_ENDPOINT, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async function patchProfile(userId, payload) {
    return request(`${CONFIG.API_PROFILES_ENDPOINT}/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async function submitOnboarding(payload) {
    return request(CONFIG.API_ONBOARDING_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function getRoadmap(userId) {
    return request(`${CONFIG.API_ROADMAPS_ENDPOINT}/${encodeURIComponent(userId)}`, { method: "GET" });
  }

  async function generateRoadmap(userId) {
    return request(`${CONFIG.API_ROADMAPS_ENDPOINT}/generate`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  }

  async function generateMindmap(topic) {
    return request(`${CONFIG.API_ROADMAPS_ENDPOINT}/mindmap`, {
      method: "POST",
      body: JSON.stringify({ topic }),
    });
  }

  async function generateTasks(userId) {
    return request(`${CONFIG.API_TASKS_ENDPOINT}/generate`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  }

  async function getTasks(userId, date = "") {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    return request(`${CONFIG.API_TASKS_ENDPOINT}/${encodeURIComponent(userId)}${query}`, { method: "GET" });
  }

  async function updateTask(taskId, status) {
    return request(`${CONFIG.API_TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async function getDashboard(userId) {
    return request(`${CONFIG.API_DASHBOARD_ENDPOINT}/${encodeURIComponent(userId)}`, { method: "GET" });
  }

  async function getNotifications() {
    return request(CONFIG.API_NOTIFICATIONS_ENDPOINT, { method: "GET" });
  }

  async function markNotificationRead(notificationId) {
    return request(`${CONFIG.API_NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(notificationId)}/read`, {
      method: "PATCH",
    });
  }

  async function listConversations() {
    return request(CONFIG.API_CONVERSATIONS_ENDPOINT, { method: "GET" });
  }

  async function createConversation(subject) {
    return request(CONFIG.API_CONVERSATIONS_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({ subject }),
    });
  }

  async function getConversation(conversationId) {
    return request(`${CONFIG.API_CONVERSATIONS_ENDPOINT}/${conversationId}`, { method: "GET" });
  }

  async function sendMessage({ subject, history, message, conversationId }) {
    return request(CONFIG.API_CHAT_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        subject,
        history,
        message,
        conversationId,
      }),
    });
  }

  return {
    createConversation,
    getConversation,
    getCurrentUser,
    getDashboard,
    getProfile,
    getRoadmap,
    getTasks,
    getNotifications,
    markNotificationRead,
    listConversations,
    login,
    logout,
    patchProfile,
    generateRoadmap,
    generateTasks,
    saveProfile,
    sendMessage,
    submitOnboarding,
    signup,
    updateTask,
    generateMindmap,
  };
})();
