require("dotenv").config();

const {
  GEMINI_API_KEY,
  GEMINI_ENDPOINT_TEMPLATE,
  MAX_OUTPUT_TOKENS,
  MAX_RETRIES,
  RETRY_DELAY_MS,
  REQUEST_TIMEOUT_MS,
} = require("./config");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEndpoint() {
  if (!GEMINI_API_KEY) {
    const error = new Error("Missing GEMINI_API_KEY in backend/.env.");
    error.statusCode = 500;
    throw error;
  }

  return GEMINI_ENDPOINT_TEMPLATE.replace("API_KEY__", GEMINI_API_KEY);
}

function normalizeHistory(history) {
  return history.map((item) => ({
    role: item.role,
    parts: [{ text: item.text }],
  }));
}

function normalizeGeminiError(status, body) {
  const message = body?.error?.message || "";
  const code = body?.error?.code || status;
  const error = new Error("Unable to get a response right now.");

  error.statusCode = status >= 400 ? status : 500;

  if (code === 400) {
    error.message = "Invalid request. Please shorten or rephrase your message.";
    return error;
  }

  if (code === 401 || code === 403) {
    error.message = "Backend Gemini API key is invalid or does not have access.";
    error.statusCode = 500;
    return error;
  }

  if (code === 404) {
    error.message = "Gemini model endpoint was not found.";
    return error;
  }

  if (code === 429) {
    error.message = "Rate limit reached. Please wait a moment and try again.";
    error.statusCode = 429;
    return error;
  }

  if (code >= 500) {
    error.message = "Gemini service is temporarily unavailable. Please try again shortly.";
    error.statusCode = 502;
    return error;
  }

  if (message) {
    error.message = message;
  }

  return error;
}

async function callGemini(payload, attempt = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body = await response.json();

    if (!response.ok) {
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        return callGemini(payload, attempt + 1);
      }

      throw normalizeGeminiError(response.status, body);
    }

    return body;
  } catch (error) {
    if ((error.name === "AbortError" || error instanceof TypeError) && attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS * (attempt + 1));
      return callGemini(payload, attempt + 1);
    }

    if (error.name === "AbortError") {
      const timeoutError = new Error("The AI request timed out. Please try again.");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    if (error instanceof TypeError) {
      const networkError = new Error("Unable to reach Gemini right now. Check the backend connection and try again.");
      networkError.statusCode = 502;
      throw networkError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateMentorReply({ systemPrompt, history, userMessage }) {
  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      ...normalizeHistory(history),
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.7,
      topP: 0.9,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const body = await callGemini(payload);
  const candidate = body?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text?.trim();

  if (candidate?.finishReason === "SAFETY") {
    const error = new Error("The response was blocked by Gemini safety filters. Please rephrase your message.");
    error.statusCode = 400;
    throw error;
  }

  if (!text) {
    const error = new Error("Gemini returned an empty response.");
    error.statusCode = 502;
    throw error;
  }

  return text;
}

async function generateMindmapContent(topic) {
  const systemPrompt = `You are an expert educational content creator. The user will provide a topic.
Generate a highly comprehensive, deeply structured Markdown list representing a mind map for the given topic.
Your mind map MUST be detailed, covering at least 3-4 levels of depth (e.g., main branches, sub-concepts, definitions, and examples). 
Break down the topic thoroughly so it serves as a complete study guide.
The output must be ONLY markdown, with the root node as an H1 heading (e.g. # Topic Name), and subtopics as nested bullet points. 
CRITICAL: You MUST use standard markdown indentation for nesting (i.e. use 2 or 4 spaces before the hyphen for each deeper level, like "  - Subtopic"). Do NOT use multiple hyphens (like -- or ---).
Do NOT wrap the response in markdown code blocks (\`\`\`markdown). Return ONLY the raw markdown text.`;

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: topic }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 800,
      temperature: 0.7,
    },
  };

  const body = await callGemini(payload);
  const candidate = body?.candidates?.[0];
  let text = candidate?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw new Error("Failed to generate mind map content.");
  }

  // Ensure no code block formatting exists in the returned string
  text = text.replace(/^```markdown\n?/i, '').replace(/\n?```$/i, '');

  return text;
}

module.exports = {
  generateMentorReply,
  generateMindmapContent,
};
