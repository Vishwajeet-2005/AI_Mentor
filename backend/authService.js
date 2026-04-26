const crypto = require("crypto");

const { SESSION_COOKIE_NAME, SESSION_SECRET, SESSION_TTL_MS } = require("./config");
const { createUser, findUserByEmail, findUserById } = require("./storage");

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return {
    salt,
    hash: derivedKey,
  };
}

function verifyPassword(password, salt, expectedHash) {
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derivedKey, "hex"), Buffer.from(expectedHash, "hex"));
}

function encodeSessionValue(payload) {
  const serialized = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(serialized, "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payloadBase64).digest("base64url");
  return `${payloadBase64}.${signature}`;
}

function decodeSessionValue(value) {
  if (!value || !value.includes(".")) return null;

  const [payloadBase64, signature] = value.split(".");
  const expectedSignature = crypto.createHmac("sha256", SESSION_SECRET).update(payloadBase64).digest("base64url");

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
    if (!payload.userId || !payload.expiresAt || Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch (_error) {
    return null;
  }
}

function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, item) => {
      const separatorIndex = item.indexOf("=");
      if (separatorIndex === -1) return accumulator;
      const key = item.slice(0, separatorIndex);
      const value = item.slice(separatorIndex + 1);
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function buildSessionCookie(sessionValue) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function buildLogoutCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

async function registerUser({ name, email, password }) {
  const { salt, hash } = hashPassword(password);
  const user = await createUser({
    name,
    email,
    passwordHash: hash,
    passwordSalt: salt,
  });

  return sanitizeUser(user);
}

async function loginUser({ email, password }) {
  const user = await findUserByEmail(email);

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  return sanitizeUser(user);
}

function createSessionForUser(userId) {
  return encodeSessionValue({
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

async function getAuthenticatedUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const session = decodeSessionValue(cookies[SESSION_COOKIE_NAME]);
  if (!session) return null;

  const user = await findUserById(session.userId);
  return user ? sanitizeUser(user) : null;
}

module.exports = {
  buildLogoutCookie,
  buildSessionCookie,
  createSessionForUser,
  getAuthenticatedUser,
  loginUser,
  registerUser,
};
