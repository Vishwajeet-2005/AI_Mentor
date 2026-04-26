const rateLimit = require("express-rate-limit");

const {
  ALLOWED_ORIGIN,
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_TURNS,
  PROFILE_LEVELS,
  SUBJECT_PROMPTS,
} = require("./config");
const { getAuthenticatedUser } = require("./authService");

const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please slow down and try again in a minute.",
  },
});

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  if (!ALLOWED_ORIGIN || !origin || origin === ALLOWED_ORIGIN) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }

  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
}

function validateChatRequest(req, res, next) {
  const { subject, history, message, conversationId, userId } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "A non-empty message is required." });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message must be under ${MAX_MESSAGE_LENGTH} characters.` });
  }

  if (subject && !SUBJECT_PROMPTS[subject]) {
    return res.status(400).json({ error: "Invalid subject selected." });
  }

  if (history && !Array.isArray(history)) {
    return res.status(400).json({ error: "History must be an array." });
  }

  if (Array.isArray(history)) {
    if (history.length > MAX_HISTORY_TURNS * 2) {
      return res.status(400).json({ error: "Conversation history is too long." });
    }

    const hasInvalidItem = history.some((item) => {
      const validRole = item?.role === "user" || item?.role === "model";
      const validText = typeof item?.text === "string" && item.text.trim().length > 0;
      return !validRole || !validText;
    });

    if (hasInvalidItem) {
      return res.status(400).json({ error: "History items must include valid role and text values." });
    }
  }

  if (conversationId && typeof conversationId !== "string") {
    return res.status(400).json({ error: "Conversation id must be a string." });
  }

  if (userId && typeof userId !== "string") {
    return res.status(400).json({ error: "User id must be a string." });
  }

  return next();
}

function validateAuthRequest(req, res, next) {
  const { name, email, password } = req.body || {};
  const isSignup = req.path.includes("signup");

  if (isSignup && (!name || typeof name !== "string" || name.trim().length < 2)) {
    return res.status(400).json({ error: "Name must be at least 2 characters long." });
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  return next();
}

async function requireAuth(req, res, next) {
  const user = await getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({ error: "Please log in to continue." });
  }

  req.user = user;
  return next();
}

function validateProfilePayload(req, res, next) {
  const payload = req.body || {};
  const {
    userId,
    name,
    goals,
    interests,
    level,
    weakAreas,
    currentFocus,
    consistencyScore,
    learningStyle,
    timeAvailability,
    onboardingCompleted,
    onboardingAnswers,
  } = payload;

  if (req.method === "PUT" && (!userId || typeof userId !== "string" || !userId.trim())) {
    return res.status(400).json({ error: "userId is required." });
  }

  if (userId !== undefined && (typeof userId !== "string" || !userId.trim())) {
    return res.status(400).json({ error: "userId must be a non-empty string." });
  }

  if (name !== undefined && typeof name !== "string") {
    return res.status(400).json({ error: "name must be a string." });
  }

  if (goals !== undefined && !Array.isArray(goals)) {
    return res.status(400).json({ error: "goals must be an array." });
  }

  if (interests !== undefined && !Array.isArray(interests)) {
    return res.status(400).json({ error: "interests must be an array." });
  }

  if (weakAreas !== undefined && !Array.isArray(weakAreas)) {
    return res.status(400).json({ error: "weakAreas must be an array." });
  }

  if (currentFocus !== undefined && typeof currentFocus !== "string") {
    return res.status(400).json({ error: "currentFocus must be a string." });
  }

  if (learningStyle !== undefined && typeof learningStyle !== "string") {
    return res.status(400).json({ error: "learningStyle must be a string." });
  }

  if (timeAvailability !== undefined && typeof timeAvailability !== "string") {
    return res.status(400).json({ error: "timeAvailability must be a string." });
  }

  if (consistencyScore !== undefined && (typeof consistencyScore !== "number" || Number.isNaN(consistencyScore))) {
    return res.status(400).json({ error: "consistencyScore must be a valid number." });
  }

  if (onboardingCompleted !== undefined && typeof onboardingCompleted !== "boolean") {
    return res.status(400).json({ error: "onboardingCompleted must be a boolean." });
  }

  if (onboardingAnswers !== undefined && (typeof onboardingAnswers !== "object" || Array.isArray(onboardingAnswers))) {
    return res.status(400).json({ error: "onboardingAnswers must be an object." });
  }

  if (level !== undefined && !PROFILE_LEVELS.includes(level)) {
    return res.status(400).json({ error: `level must be one of: ${PROFILE_LEVELS.join(", ")}.` });
  }

  return next();
}

function validateOnboardingPayload(req, res, next) {
  const { userId, name, answers } = req.body || {};

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required." });
  }

  if (name !== undefined && typeof name !== "string") {
    return res.status(400).json({ error: "name must be a string." });
  }

  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return res.status(400).json({ error: "answers are required." });
  }

  const requiredStrings = ["primaryGoal", "skillLevel", "learningStyle", "timeAvailability", "outcomeGoal"];
  for (const key of requiredStrings) {
    if (!answers[key] || typeof answers[key] !== "string") {
      return res.status(400).json({ error: `${key} is required.` });
    }
  }

  if (!Array.isArray(answers.interests) || answers.interests.length === 0) {
    return res.status(400).json({ error: "Select at least one interest." });
  }

  if (!Array.isArray(answers.difficultAreas) || answers.difficultAreas.length === 0) {
    return res.status(400).json({ error: "Select at least one area that feels difficult." });
  }

  return next();
}

function validateRoadmapRequest(req, res, next) {
  const { userId } = req.body || {};

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required." });
  }

  return next();
}

function validateTaskGenerateRequest(req, res, next) {
  const { userId } = req.body || {};

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required." });
  }

  return next();
}

function validateTaskStatusRequest(req, res, next) {
  const { status } = req.body || {};

  if (!status || !["pending", "completed"].includes(status)) {
    return res.status(400).json({ error: "status must be either pending or completed." });
  }

  return next();
}

module.exports = {
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
};
