const express = require("express");
const path = require("path");
const { buildProfileFromOnboarding } = require("./onboardingService");
const { generateRoadmap } = require("./roadmapService");
const { generateDailyTasks, nextConsistencyScore, todayDateString } = require("./taskService");
const { buildDashboard } = require("./dashboardService");
const { evaluateUserNotifications } = require("./notificationService");

const {
  chatRateLimiter,
  corsMiddleware,
  requireAuth,
  validateAuthRequest,
  validateChatRequest,
  validateOnboardingPayload,
  validateProfilePayload,
  validateRoadmapRequest,
  validateTaskGenerateRequest,
  validateTaskStatusRequest,
} = require("./middleware");
const { SUBJECT_PROMPTS, DEFAULT_SUBJECT, SERVER_PORT } = require("./config");
const { generateMentorReply, generateMindmapContent } = require("./geminiService");
const {
  buildLogoutCookie,
  buildSessionCookie,
  createSessionForUser,
  getAuthenticatedUser,
  loginUser,
  registerUser,
} = require("./authService");
const {
  appendConversationMessages,
  createConversation,
  getConversation,
  getUserProfile,
  getRoadmapByUserId,
  listConversationSummaries,
  listTasksByUser,
  listTasksByUserAndDate,
  patchUserProfile,
  replaceTasksForDate,
  updateTaskStatus,
  upsertRoadmap,
  upsertUserProfile,
  createNotification,
  listNotifications,
  markNotificationRead,
} = require("./storage");

const app = express();
const frontendPath = path.join(__dirname, "..", "frontend");

app.use(corsMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use(express.static(frontendPath));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

function buildProfileContext(profile) {
  const defaultRules = [
    "MENTORING BEHAVIOR RULES (CRITICAL):",
    "1. You are a mentor, not an answer bot.",
    "2. If the user asks a question, DO NOT just give the direct answer. First, ask a guiding question or give a hint.",
    "3. Keep responses highly interactive. Limit long explanations.",
    "4. Always use the user profile context below to personalize every response."
  ];

  if (!profile) {
    return [...defaultRules, "No user profile context is available for this conversation."].join("\n");
  }

  const arrayLine = (label, value) => `${label}: ${value && value.length ? value.join(", ") : "None provided"}`;
  const score = typeof profile.consistencyScore === "number" ? profile.consistencyScore : 0;

  const contextLines = [
    ...defaultRules,
    "",
    "USER PROFILE CONTEXT:",
    `- Name: ${profile.name || "Unknown"}`,
    `- Level: ${profile.level || "beginner"}`,
    arrayLine("- Goals", profile.goals || []),
    arrayLine("- Interests", profile.interests || []),
    arrayLine("- Weak areas", profile.weakAreas || []),
    `- Current focus: ${profile.currentFocus || "None provided"}`,
    `- Learning style: ${profile.learningStyle || "Not provided"}`,
    `- Time available per day: ${profile.timeAvailability || "Not provided"}`,
    `- Consistency score: ${score}`,
    `- Last updated: ${profile.lastUpdated || "Unknown"}`,
    "",
    "DYNAMIC TONE AND FOCUS RULES:"
  ];

  if (profile.weakAreas && profile.weakAreas.length > 0) {
    contextLines.push(`- Prioritize concepts and examples from their weak areas (${profile.weakAreas.join(", ")}). Whenever they ask a general question, try to relate it back to these weak areas to reinforce learning.`);
  }

  if (score < 50) {
    contextLines.push("- Consistency is low (<50). Keep explanations simple, use beginner-friendly analogies, and gently remind the user about completing their daily tasks to build momentum.");
  } else {
    if (score >= 80 || profile.level === "advanced") {
      contextLines.push("- Consistency is high (>=80). Increase the difficulty. Use advanced terminology, provide minimal hints, and challenge the user with complex follow-up questions.");
    } else {
      contextLines.push("- The user is doing well. Maintain an encouraging and balanced tone.");
    }
  }

  contextLines.push("- If the user seems stuck or frustrated, be extremely encouraging and supportive.");

  return contextLines.join("\n");
}

app.put("/api/profiles", validateProfilePayload, async (req, res) => {
  try {
    const { userId, ...profileInput } = req.body;
    const profile = await upsertUserProfile(userId.trim(), profileInput);
    res.status(201).json({ profile });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Unable to save profile." });
  }
});

app.get("/api/profiles/:userId", async (req, res) => {
  const profile = await getUserProfile(req.params.userId);

  if (!profile) {
    return res.status(404).json({ error: "Profile not found." });
  }

  return res.json({ profile });
});

app.patch("/api/profiles/:userId", validateProfilePayload, async (req, res) => {
  try {
    const profile = await patchUserProfile(req.params.userId, req.body);
    res.json({ profile });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Unable to update profile." });
  }
});

app.post("/api/onboarding", validateOnboardingPayload, async (req, res) => {
  try {
    const profileInput = buildProfileFromOnboarding(req.body);
    const profile = await upsertUserProfile(req.body.userId.trim(), profileInput);
    res.status(201).json({ profile });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Unable to save onboarding answers." });
  }
});

app.post("/api/roadmaps/generate", validateRoadmapRequest, async (req, res) => {
  try {
    const profile = await getUserProfile(req.body.userId.trim());

    if (!profile) {
      return res.status(404).json({ error: "Profile not found. Complete onboarding first." });
    }

    const phases = generateRoadmap(profile);
    const roadmap = await upsertRoadmap(req.body.userId.trim(), phases);
    res.status(201).json({ roadmap });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Unable to generate roadmap." });
  }
});

app.get("/api/roadmaps/:userId", async (req, res) => {
  const roadmap = await getRoadmapByUserId(req.params.userId);

  if (!roadmap) {
    return res.status(404).json({ error: "Roadmap not found." });
  }

  return res.json({ roadmap });
});

app.post("/api/roadmaps/mindmap", requireAuth, async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required to generate a mind map." });
    }

    const markdown = await generateMindmapContent(topic);
    res.json({ markdown });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Unable to generate mind map." });
  }
});

app.post("/api/tasks/generate", validateTaskGenerateRequest, async (req, res) => {
  try {
    const userId = req.body.userId.trim();
    const profile = await getUserProfile(userId);
    const roadmap = await getRoadmapByUserId(userId);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found." });
    }

    if (!roadmap) {
      return res.status(404).json({ error: "Roadmap not found. Generate a roadmap first." });
    }

    const date = todayDateString();
    const existingTasks = await listTasksByUserAndDate(userId, date);
    if (existingTasks.length > 0) {
      return res.status(201).json({ tasks: existingTasks });
    }

    const tasks = generateDailyTasks({
      userId,
      roadmap,
      weakAreas: profile.weakAreas || [],
      consistencyScore: profile.consistencyScore || 0,
    });

    const savedTasks = await replaceTasksForDate(userId, date, tasks);
    
    await createNotification({ 
      userId, 
      message: "Your daily tasks are ready. Let's start learning." 
    });

    return res.status(201).json({ tasks: savedTasks });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Unable to generate daily tasks." });
  }
});

app.get("/api/tasks/:userId", async (req, res) => {
  const date = typeof req.query.date === "string" && req.query.date ? req.query.date : todayDateString();
  const tasks = await listTasksByUserAndDate(req.params.userId, date);
  return res.json({ tasks, date });
});

app.patch("/api/tasks/:taskId", validateTaskStatusRequest, async (req, res) => {
  try {
    const task = await updateTaskStatus(req.params.taskId, req.body.status);
    const profile = await getUserProfile(task.userId);

    if (profile) {
      const updatedScore = nextConsistencyScore(profile.consistencyScore, task.previousStatus, req.body.status);
      const nextProfile = await patchUserProfile(task.userId, { consistencyScore: updatedScore });
      return res.json({ task, profile: nextProfile });
    }

    return res.json({ task });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Unable to update task." });
  }
});

app.get("/api/dashboard/:userId", async (req, res) => {
  const userId = req.params.userId;
  const [profile, roadmap, tasks] = await Promise.all([
    getUserProfile(userId),
    getRoadmapByUserId(userId),
    listTasksByUser(userId),
  ]);

  if (!profile) {
    return res.status(404).json({ error: "Profile not found." });
  }

  const dashboard = buildDashboard(profile, roadmap, tasks, todayDateString());
  return res.json({ dashboard });
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await evaluateUserNotifications(userId);
    const notifications = await listNotifications(userId);
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to fetch notifications." });
  }
});

app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const notification = await markNotificationRead(req.params.id, req.user.id);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found." });
    }
    res.json({ notification });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to update notification." });
  }
});

app.post("/api/auth/signup", validateAuthRequest, async (req, res) => {
  try {
    const user = await registerUser(req.body);
    res.setHeader("Set-Cookie", buildSessionCookie(createSessionForUser(user.id)));
    res.status(201).json({ user });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Unable to create account." });
  }
});

app.post("/api/auth/login", validateAuthRequest, async (req, res) => {
  try {
    const user = await loginUser(req.body);
    res.setHeader("Set-Cookie", buildSessionCookie(createSessionForUser(user.id)));
    res.json({ user });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Unable to log in." });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", buildLogoutCookie());
  res.json({ ok: true });
});

app.get("/api/auth/me", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  return res.json({ user });
});

app.get("/api/conversations", requireAuth, async (req, res) => {
  const conversations = await listConversationSummaries(req.user.id);
  res.json({ conversations });
});

app.post("/api/conversations", requireAuth, async (req, res) => {
  const subject = req.body?.subject || DEFAULT_SUBJECT;
  const conversation = await createConversation({
    userId: req.user.id,
    subject: SUBJECT_PROMPTS[subject] ? subject : DEFAULT_SUBJECT,
  });
  res.status(201).json({ conversation });
});

app.get("/api/conversations/:conversationId", requireAuth, async (req, res) => {
  const conversation = await getConversation(req.user.id, req.params.conversationId);

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  return res.json({ conversation });
});

app.post("/api/chat", requireAuth, chatRateLimiter, validateChatRequest, async (req, res) => {
  const { subject = DEFAULT_SUBJECT, history = [], message, conversationId, userId } = req.body;
  const basePrompt = SUBJECT_PROMPTS[subject] || SUBJECT_PROMPTS[DEFAULT_SUBJECT];
  const profile = await getUserProfile(userId || req.user.id);
  const systemPrompt = `${basePrompt}\n\n${buildProfileContext(profile)}`;

  try {
    const reply = await generateMentorReply({
      systemPrompt,
      history,
      userMessage: message,
    });

    const savedConversation = await appendConversationMessages({
      userId: req.user.id,
      conversationId,
      subject,
      messages: [
        { role: "user", text: message, createdAt: new Date().toISOString() },
        { role: "model", text: reply, createdAt: new Date().toISOString() },
      ],
    });

    res.json({
      reply,
      conversation: {
        id: savedConversation.id,
        title: savedConversation.title,
        subject: savedConversation.subject,
        updatedAt: savedConversation.updatedAt,
        messageCount: savedConversation.messages.length,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.message || "Something went wrong while generating a response.",
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(SERVER_PORT, () => {
  console.log(`Mentor AI server running on http://localhost:${SERVER_PORT}`);
});
