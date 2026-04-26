const {
  listNotifications,
  createNotification,
  listTasksByUser,
  getUserProfile,
} = require("./storage");
const { todayDateString } = require("./taskService");

async function evaluateUserNotifications(userId) {
  const [notifications, tasks, profile] = await Promise.all([
    listNotifications(userId),
    listTasksByUser(userId),
    getUserProfile(userId),
  ]);

  const newNotifications = [];
  const today = todayDateString();
  const yesterdayDate = new Date(new Date(today).getTime() - 86400000);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  // 1. Evaluate missed tasks from yesterday
  const yesterdayTasks = tasks.filter(t => t.date === yesterdayStr);
  if (yesterdayTasks.length > 0) {
    const allCompleted = yesterdayTasks.every(t => t.status === "completed");
    if (!allCompleted) {
      const missedMsg = "You skipped yesterday’s task. Complete today’s to stay on track.";
      const alreadyNotified = notifications.some(n => 
        n.message === missedMsg && n.createdAt.startsWith(today)
      );
      if (!alreadyNotified) {
        newNotifications.push(await createNotification({ userId, message: missedMsg }));
      }
    }
  }

  // 2. Evaluate low consistency
  if (profile && typeof profile.consistencyScore === "number" && profile.consistencyScore < 50) {
    const consistencyMsg = "Your consistency score is dropping. Complete a small task today to build your streak!";
    const recentConsistencyNotif = notifications.find(n => n.message === consistencyMsg);
    
    let shouldNotify = false;
    if (!recentConsistencyNotif) {
      shouldNotify = true;
    } else {
      const diffTime = new Date().getTime() - new Date(recentConsistencyNotif.createdAt).getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);
      if (diffDays > 3) shouldNotify = true;
    }

    if (shouldNotify) {
      newNotifications.push(await createNotification({ userId, message: consistencyMsg }));
    }
  }

  // 3. Evaluate inactivity
  const completedTasks = tasks.filter(t => t.status === "completed");
  let daysSinceLastCompleted = 0;
  
  if (completedTasks.length > 0) {
    const lastCompleted = completedTasks.sort((a, b) => new Date(b.updatedAt || b.createdAt || b.date).getTime() - new Date(a.updatedAt || a.createdAt || a.date).getTime())[0];
    const diffTime = new Date().getTime() - new Date(lastCompleted.updatedAt || lastCompleted.createdAt || lastCompleted.date).getTime();
    daysSinceLastCompleted = diffTime / (1000 * 3600 * 24);
  } else if (profile && profile.createdAt) {
    const diffTime = new Date().getTime() - new Date(profile.createdAt).getTime();
    daysSinceLastCompleted = diffTime / (1000 * 3600 * 24);
  }

  if (daysSinceLastCompleted >= 3) {
    const inactiveMsg = "We haven't seen you in a few days! Jump back in with a quick 5-minute review to keep your momentum alive.";
    const recentInactiveNotif = notifications.find(n => n.message === inactiveMsg);
    
    let shouldNotify = false;
    if (!recentInactiveNotif) {
      shouldNotify = true;
    } else {
      const diffTime = new Date().getTime() - new Date(recentInactiveNotif.createdAt).getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);
      if (diffDays > 3) shouldNotify = true;
    }

    if (shouldNotify) {
      newNotifications.push(await createNotification({ userId, message: inactiveMsg }));
    }
  }

  return newNotifications;
}

module.exports = {
  evaluateUserNotifications,
};
