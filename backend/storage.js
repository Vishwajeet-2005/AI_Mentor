const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const { DATA_FILE } = require("./config");

const DEFAULT_STORE = {
  users: [],
  conversations: [],
  profiles: [],
  roadmaps: [],
  tasks: [],
  notifications: [],
};

let writeQueue = Promise.resolve();

async function ensureStore() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch (_error) {
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_STORE, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      roadmaps: Array.isArray(parsed.roadmaps) ? parsed.roadmaps : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    };
  } catch (_error) {
    return { ...DEFAULT_STORE };
  }
}

async function writeStore(updater) {
  writeQueue = writeQueue.then(async () => {
    const current = await readStore();
    const next = await updater(current);
    await fs.writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });

  return writeQueue;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function summarizeConversation(messages) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.text || "New conversation";
  return firstUserMessage.trim().slice(0, 72) || "New conversation";
}

async function createUser({ name, email, passwordHash, passwordSalt }) {
  const normalizedEmail = email.trim().toLowerCase();

  const store = await writeStore((current) => {
    const existingUser = current.users.find((user) => user.email === normalizedEmail);
    if (existingUser) {
      const error = new Error("An account with this email already exists.");
      error.statusCode = 409;
      throw error;
    }

    const now = new Date().toISOString();
    const user = {
      id: createId("user"),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      passwordSalt,
      createdAt: now,
    };

    return {
      ...current,
      users: [...current.users, user],
    };
  });

  return store.users.find((user) => user.email === normalizedEmail);
}

async function findUserByEmail(email) {
  const store = await readStore();
  return store.users.find((user) => user.email === email.trim().toLowerCase()) || null;
}

async function findUserById(userId) {
  const store = await readStore();
  return store.users.find((user) => user.id === userId) || null;
}

async function listConversationSummaries(userId) {
  const store = await readStore();
  return store.conversations
    .filter((conversation) => conversation.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      subject: conversation.subject,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messages.length,
    }));
}

async function getConversation(userId, conversationId) {
  const store = await readStore();
  return (
    store.conversations.find(
      (conversation) => conversation.id === conversationId && conversation.userId === userId,
    ) || null
  );
}

async function createConversation({ userId, subject }) {
  const now = new Date().toISOString();

  const store = await writeStore((current) => {
    const conversation = {
      id: createId("chat"),
      userId,
      subject,
      title: "New conversation",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    return {
      ...current,
      conversations: [conversation, ...current.conversations],
    };
  });

  return store.conversations.find((conversation) => conversation.userId === userId && conversation.createdAt === now);
}

async function appendConversationMessages({ userId, conversationId, subject, messages }) {
  const store = await writeStore((current) => {
    const conversation = current.conversations.find(
      (item) => item.id === conversationId && item.userId === userId,
    );

    if (!conversation) {
      const error = new Error("Conversation not found.");
      error.statusCode = 404;
      throw error;
    }

    conversation.subject = subject;
    conversation.messages.push(...messages);
    conversation.updatedAt = new Date().toISOString();
    conversation.title = summarizeConversation(conversation.messages);

    return current;
  });

  return store.conversations.find((conversation) => conversation.id === conversationId && conversation.userId === userId);
}

function createDefaultProfile(userId, input = {}) {
  const now = new Date().toISOString();
  return {
    userId,
    name: typeof input.name === "string" ? input.name.trim() : "",
    goals: Array.isArray(input.goals) ? input.goals : [],
    interests: Array.isArray(input.interests) ? input.interests : [],
    level: typeof input.level === "string" ? input.level : "beginner",
    weakAreas: Array.isArray(input.weakAreas) ? input.weakAreas : [],
    currentFocus: typeof input.currentFocus === "string" ? input.currentFocus.trim() : "",
    consistencyScore: typeof input.consistencyScore === "number" ? input.consistencyScore : 0,
    learningStyle: typeof input.learningStyle === "string" ? input.learningStyle.trim() : "",
    timeAvailability: typeof input.timeAvailability === "string" ? input.timeAvailability.trim() : "",
    onboardingCompleted: Boolean(input.onboardingCompleted),
    onboardingAnswers: input.onboardingAnswers && typeof input.onboardingAnswers === "object" ? input.onboardingAnswers : {},
    lastUpdated: now,
  };
}

async function getUserProfile(userId) {
  const store = await readStore();
  return store.profiles.find((profile) => profile.userId === userId) || null;
}

async function upsertUserProfile(userId, profileInput) {
  const store = await writeStore((current) => {
    const existing = current.profiles.find((profile) => profile.userId === userId);
    const nextProfile = {
      ...(existing || createDefaultProfile(userId)),
      ...profileInput,
      userId,
      lastUpdated: new Date().toISOString(),
    };

    if (existing) {
      Object.assign(existing, nextProfile);
    } else {
      current.profiles.push(nextProfile);
    }

    return current;
  });

  return store.profiles.find((profile) => profile.userId === userId) || null;
}

async function patchUserProfile(userId, fields) {
  const store = await writeStore((current) => {
    let existing = current.profiles.find((profile) => profile.userId === userId);

    if (!existing) {
      existing = createDefaultProfile(userId);
      current.profiles.push(existing);
    }

    Object.assign(existing, fields, {
      userId,
      lastUpdated: new Date().toISOString(),
    });

    return current;
  });

  return store.profiles.find((profile) => profile.userId === userId) || null;
}

async function getRoadmapByUserId(userId) {
  const store = await readStore();
  return store.roadmaps.find((roadmap) => roadmap.userId === userId) || null;
}

async function upsertRoadmap(userId, phases) {
  const store = await writeStore((current) => {
    const existing = current.roadmaps.find((roadmap) => roadmap.userId === userId);
    const nextRoadmap = {
      roadmapId: existing?.roadmapId || createId("roadmap"),
      userId,
      phases,
      lastUpdated: new Date().toISOString(),
    };

    if (existing) {
      Object.assign(existing, nextRoadmap);
    } else {
      current.roadmaps.push(nextRoadmap);
    }

    return current;
  });

  return store.roadmaps.find((roadmap) => roadmap.userId === userId) || null;
}

async function listTasksByUserAndDate(userId, date) {
  const store = await readStore();
  return store.tasks.filter((task) => task.userId === userId && task.date === date);
}

async function listTasksByUser(userId) {
  const store = await readStore();
  return store.tasks
    .filter((task) => task.userId === userId)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));
}

async function replaceTasksForDate(userId, date, tasks) {
  const store = await writeStore((current) => {
    current.tasks = current.tasks.filter((task) => !(task.userId === userId && task.date === date));
    current.tasks.push(...tasks);
    return current;
  });

  return store.tasks.filter((task) => task.userId === userId && task.date === date);
}

async function updateTaskStatus(taskId, status) {
  let previousStatus = "pending";

  const store = await writeStore((current) => {
    const task = current.tasks.find((item) => item.taskId === taskId);

    if (!task) {
      const error = new Error("Task not found.");
      error.statusCode = 404;
      throw error;
    }

    previousStatus = task.status;
    task.status = status;
    task.updatedAt = new Date().toISOString();
    return current;
  });

  const task = store.tasks.find((item) => item.taskId === taskId) || null;
  return task ? { ...task, previousStatus } : null;
}

async function createNotification({ userId, message }) {
  const now = new Date().toISOString();
  const notification = {
    id: createId("notif"),
    userId,
    message,
    read: false,
    createdAt: now,
  };

  const store = await writeStore((current) => {
    return {
      ...current,
      notifications: [notification, ...(current.notifications || [])],
    };
  });

  return store.notifications.find((n) => n.id === notification.id);
}

async function listNotifications(userId) {
  const store = await readStore();
  return (store.notifications || [])
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function markNotificationRead(notificationId, userId) {
  const store = await writeStore((current) => {
    const notification = (current.notifications || []).find((n) => n.id === notificationId && n.userId === userId);
    if (notification) {
      notification.read = true;
    }
    return current;
  });

  return store.notifications.find((n) => n.id === notificationId && n.userId === userId) || null;
}

module.exports = {
  appendConversationMessages,
  createConversation,
  createUser,
  findUserByEmail,
  findUserById,
  getConversation,
  getUserProfile,
  getRoadmapByUserId,
  listTasksByUser,
  listTasksByUserAndDate,
  listConversationSummaries,
  createNotification,
  listNotifications,
  markNotificationRead,
  patchUserProfile,
  replaceTasksForDate,
  updateTaskStatus,
  upsertRoadmap,
  upsertUserProfile,
};
