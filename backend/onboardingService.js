function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function mapSkillLevel(skillLevel) {
  if (skillLevel === "intermediate" || skillLevel === "advanced") {
    return "intermediate";
  }

  return "beginner";
}

function mapWeakAreas(skillLevel, difficultAreas, interests) {
  const weakAreas = [...(Array.isArray(difficultAreas) ? difficultAreas : [])];

  if (skillLevel === "beginner") {
    weakAreas.push("Fundamentals");
  }

  if (interests.includes("DSA") && skillLevel === "beginner") {
    weakAreas.push("Problem solving");
  }

  if (interests.includes("AI") && skillLevel === "beginner") {
    weakAreas.push("Math foundations");
  }

  return uniq(weakAreas);
}

function mapGoals(primaryGoal, outcomeGoal, timeAvailability) {
  const mapped = [];

  if (primaryGoal) mapped.push(primaryGoal);
  if (outcomeGoal) mapped.push(outcomeGoal);

  if (timeAvailability === "lt30") {
    mapped.push("Build a consistent daily learning habit");
  }

  if (timeAvailability === "gt120") {
    mapped.push("Follow a deep practice routine");
  }

  return uniq(mapped);
}

function mapCurrentFocus(interests, primaryGoal) {
  if (interests.length > 0) {
    return interests[0];
  }

  return primaryGoal || "";
}

function buildProfileFromOnboarding({ userId, name, answers }) {
  const interests = Array.isArray(answers.interests) ? uniq(answers.interests) : [];
  const level = mapSkillLevel(answers.skillLevel);
  const goals = mapGoals(answers.primaryGoal, answers.outcomeGoal, answers.timeAvailability);
  const weakAreas = mapWeakAreas(answers.skillLevel, answers.difficultAreas || [], interests);

  return {
    userId,
    name: typeof name === "string" ? name.trim() : "",
    goals,
    interests,
    level,
    weakAreas,
    currentFocus: mapCurrentFocus(interests, answers.primaryGoal),
    consistencyScore: 50,
    learningStyle: answers.learningStyle || "",
    timeAvailability: answers.timeAvailability || "",
    onboardingCompleted: true,
    onboardingAnswers: answers,
  };
}

module.exports = {
  buildProfileFromOnboarding,
};
