const crypto = require("crypto");

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickCurrentPhase(roadmap, consistencyScore = 0) {
  const phases = Array.isArray(roadmap?.phases) ? roadmap.phases : [];
  if (phases.length === 0) return null;

  if (consistencyScore >= 75 && phases[2]) return phases[2];
  if (consistencyScore >= 45 && phases[1]) return phases[1];
  return phases[0];
}

function createTaskTitle(topicTitle, weakAreas, index, consistencyScore = 0) {
  const lowerTopic = topicTitle.toLowerCase();
  const weak = Array.isArray(weakAreas) ? weakAreas : [];

  let title = index === 0
    ? `Study ${topicTitle} and write 5 key takeaways`
    : `Practice ${topicTitle}`;

  if (weak.some((area) => /problem solving/i.test(area))) {
    title = index === 0 ? `Solve 3 focused problems on ${topicTitle}` : `Review mistakes and retry 2 ${topicTitle} exercises`;
  } else if (weak.some((area) => /debugging/i.test(area))) {
    title = `Debug 2 small exercises from ${topicTitle}`;
  } else if (weak.some((area) => /fundamentals|math foundations/i.test(area))) {
    title = `Spend some time revising ${topicTitle} notes and examples`;
  } else if (lowerTopic.includes("project")) {
    title = `Work on a small ${topicTitle} milestone`;
  }

  if (consistencyScore < 50) {
    return `Easy: ${title}`;
  } else if (consistencyScore >= 80) {
    return `Challenge: Build or solve an advanced problem for ${topicTitle}`;
  }

  return title;
}

function getTaskDuration(index, consistencyScore = 0) {
  if (consistencyScore < 50) {
    return ["15 mins", "20 mins", "25 mins"][index] || "15 mins";
  } else if (consistencyScore >= 80) {
    return ["45 mins", "50 mins", "60 mins"][index] || "45 mins";
  }
  return ["20 mins", "30 mins", "40 mins"][index] || "30 mins";
}

function generateDailyTasks({ userId, roadmap, weakAreas, consistencyScore }) {
  const phase = pickCurrentPhase(roadmap, consistencyScore);
  const date = todayDateString();

  if (!phase) {
    return [];
  }

  let phaseTopics = Array.isArray(phase.topics) ? [...phase.topics] : [];
  const weak = Array.isArray(weakAreas) ? weakAreas.map(w => w.toLowerCase()) : [];
  
  if (weak.length > 0) {
    phaseTopics.sort((a, b) => {
      const aLower = a.title.toLowerCase();
      const bLower = b.title.toLowerCase();
      const aMatch = weak.some(w => aLower.includes(w) || w.includes(aLower));
      const bMatch = weak.some(w => bLower.includes(w) || w.includes(bLower));
      
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }

  const topics = phaseTopics.slice(0, 3);

  return topics.map((topic, index) => ({
    taskId: `task_${crypto.randomUUID()}`,
    userId,
    title: createTaskTitle(topic.title, weakAreas, index, consistencyScore),
    status: "pending",
    date,
    duration: getTaskDuration(index, consistencyScore),
    phaseTitle: phase.title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

function nextConsistencyScore(currentScore, statusBefore, statusAfter) {
  const current = typeof currentScore === "number" ? currentScore : 0;

  if (statusBefore !== "completed" && statusAfter === "completed") {
    return clamp(current + 5, 0, 100);
  }

  if (statusBefore === "completed" && statusAfter !== "completed") {
    return clamp(current - 5, 0, 100);
  }

  return current;
}

module.exports = {
  generateDailyTasks,
  nextConsistencyScore,
  todayDateString,
};
