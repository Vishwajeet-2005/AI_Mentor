function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function pickIntroTopics(interests) {
  const topics = [];

  if (interests.includes("Web Dev")) {
    topics.push("HTML, CSS, and layout fundamentals", "JavaScript syntax and DOM basics");
  }

  if (interests.includes("DSA")) {
    topics.push("Problem solving mindset", "Arrays, strings, and complexity basics");
  }

  if (interests.includes("AI")) {
    topics.push("Python foundations", "Math for ML: algebra and statistics basics");
  }

  if (interests.includes("System Design")) {
    topics.push("Backend and API fundamentals", "Databases and data modeling basics");
  }

  if (topics.length === 0) {
    topics.push("Core learning fundamentals", "Practice routine and concept review");
  }

  return uniq(topics);
}

function pickIntermediateTopics(interests) {
  const topics = [];

  if (interests.includes("Web Dev")) {
    topics.push("State management and APIs", "Project architecture and deployment");
  }

  if (interests.includes("DSA")) {
    topics.push("Recursion, sorting, and searching", "Stacks, queues, trees, and graphs");
  }

  if (interests.includes("AI")) {
    topics.push("Model training workflow", "Data preprocessing and evaluation");
  }

  if (interests.includes("System Design")) {
    topics.push("Scalability basics", "Caching, queues, and service boundaries");
  }

  if (topics.length === 0) {
    topics.push("Structured practice projects", "Applied problem solving");
  }

  return uniq(topics);
}

function pickAdvancedTopics(interests, goals) {
  const topics = [];

  if (goals.some((goal) => /interview/i.test(goal))) {
    topics.push("Interview question drills", "Mock interviews and review loops");
  }

  if (goals.some((goal) => /project|portfolio/i.test(goal))) {
    topics.push("Portfolio-quality capstone", "Documentation and presentation");
  }

  if (interests.includes("AI")) {
    topics.push("End-to-end mini AI project");
  }

  if (interests.includes("Web Dev")) {
    topics.push("Full-stack capstone and polish");
  }

  if (topics.length === 0) {
    topics.push("Capstone project", "Revision and long-term study plan");
  }

  return uniq(topics);
}

function buildTopics(topics, defaultWeeks) {
  return topics.map((topic, index) => ({
    topicId: `topic_${index + 1}`,
    title: topic,
    estimatedDuration: defaultWeeks,
  }));
}

function generateRoadmap(profile) {
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];
  const goals = Array.isArray(profile?.goals) ? profile.goals : [];
  const isIntermediate = profile?.level === "intermediate" || profile?.level === "advanced";

  const phases = [
    {
      phaseId: "phase_basics",
      title: isIntermediate ? "Foundation Refresh" : "Basics",
      topics: buildTopics(pickIntroTopics(interests), isIntermediate ? "1 week each" : "1-2 weeks each"),
    },
    {
      phaseId: "phase_intermediate",
      title: "Intermediate",
      topics: buildTopics(pickIntermediateTopics(interests), "1-2 weeks each"),
    },
    {
      phaseId: "phase_advanced",
      title: "Advanced",
      topics: buildTopics(pickAdvancedTopics(interests, goals), "2-3 weeks each"),
    },
  ];

  return phases;
}

module.exports = {
  generateRoadmap,
};
