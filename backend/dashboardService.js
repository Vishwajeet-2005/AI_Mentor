function countRoadmapTopics(roadmap) {
  if (!roadmap || !Array.isArray(roadmap.phases)) {
    return 0;
  }

  return roadmap.phases.reduce((total, phase) => {
    const topics = Array.isArray(phase.topics) ? phase.topics.length : 0;
    return total + topics;
  }, 0);
}

function getCurrentPhase(roadmap, completedTaskCount) {
  if (!roadmap || !Array.isArray(roadmap.phases) || roadmap.phases.length === 0) {
    return "";
  }

  let remainingSteps = completedTaskCount;

  for (const phase of roadmap.phases) {
    const topicCount = Array.isArray(phase.topics) ? phase.topics.length : 0;
    if (remainingSteps < topicCount || topicCount === 0) {
      return phase.title || "";
    }

    remainingSteps -= topicCount;
  }

  return roadmap.phases[roadmap.phases.length - 1].title || "";
}

function buildTaskDays(tasks) {
  const map = new Map();

  tasks.forEach((task) => {
    if (!map.has(task.date)) {
      map.set(task.date, []);
    }

    map.get(task.date).push(task);
  });

  return map;
}

function getCompletedDayStreak(taskDays) {
  const dates = [...taskDays.keys()].sort((a, b) => new Date(b) - new Date(a));
  let streak = 0;
  let previousDate = null;

  for (const date of dates) {
    const tasks = taskDays.get(date) || [];
    const completed = tasks.length > 0 && tasks.every((task) => task.status === "completed");

    if (!completed) {
      break;
    }

    if (previousDate) {
      const previous = new Date(previousDate);
      const current = new Date(date);
      const dayDifference = Math.round((previous - current) / 86400000);

      if (dayDifference !== 1) {
        break;
      }
    }

    streak += 1;
    previousDate = date;
  }

  return streak;
}

function buildRealityCheck(tasks, fallbackDate) {
  const targetDate = tasks[0]?.date || fallbackDate;
  const dailyTasks = tasks.filter((task) => task.date === targetDate);
  const plannedTasks = dailyTasks.length;
  const completedTasks = dailyTasks.filter((task) => task.status === "completed").length;
  const pendingTasks = plannedTasks - completedTasks;
  const completionRate = plannedTasks ? Math.round((completedTasks / plannedTasks) * 100) : 0;

  let summary = "No tasks planned yet.";

  if (plannedTasks > 0 && completionRate === 100) {
    summary = "You finished everything planned for this day.";
  } else if (plannedTasks > 0 && completedTasks > 0) {
    summary = `You completed ${completedTasks} of ${plannedTasks} planned tasks.`;
  } else if (plannedTasks > 0) {
    summary = "Planned work is waiting for your first completed task.";
  }

  return {
    date: targetDate,
    plannedTasks,
    completedTasks,
    pendingTasks,
    completionRate,
    summary,
  };
}

function buildDashboard(profile, roadmap, tasks, today) {
  const safeProfile = profile || {};
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const totalTopics = countRoadmapTopics(roadmap);
  const completedTasks = safeTasks.filter((task) => task.status === "completed").length;
  const pendingTasks = safeTasks.filter((task) => task.status !== "completed").length;
  const progressPercent = totalTopics
    ? Math.min(100, Math.round((Math.min(completedTasks, totalTopics) / totalTopics) * 100))
    : 0;
  const taskDays = buildTaskDays(safeTasks);
  const streak = getCompletedDayStreak(taskDays);

  return {
    userId: safeProfile.userId || "",
    progress: {
      percent: progressPercent,
      completedTopicsEstimate: Math.min(completedTasks, totalTopics),
      totalTopics,
      currentPhase: getCurrentPhase(roadmap, completedTasks),
    },
    tasks: {
      completed: completedTasks,
      pending: pendingTasks,
      total: completedTasks + pendingTasks,
    },
    weakAreas: Array.isArray(safeProfile.weakAreas) ? safeProfile.weakAreas : [],
    consistencyStreak: streak,
    currentFocus: safeProfile.currentFocus || "Set your current focus in the profile to guide the mentor.",
    realityCheck: buildRealityCheck(safeTasks, today),
  };
}

module.exports = {
  buildDashboard,
};
