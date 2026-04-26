(function initDashboardPage() {
  document.addEventListener("DOMContentLoaded", async () => {
    const subtitle = document.getElementById("dashboardSubtitle");
    const progressPercent = document.getElementById("progressPercent");
    const progressBar = document.getElementById("progressBar");
    const progressSummary = document.getElementById("progressSummary");
    const completedTasksValue = document.getElementById("completedTasksValue");
    const pendingTasksValue = document.getElementById("pendingTasksValue");
    const streakValue = document.getElementById("streakValue");
    const currentFocusValue = document.getElementById("currentFocusValue");
    const weakAreasList = document.getElementById("weakAreasList");
    const weakAreasEmpty = document.getElementById("weakAreasEmpty");
    const realityDate = document.getElementById("realityDate");
    const plannedTasksValue = document.getElementById("plannedTasksValue");
    const realityCompletedValue = document.getElementById("realityCompletedValue");
    const realityRateValue = document.getElementById("realityRateValue");
    const realitySummary = document.getElementById("realitySummary");
    const notificationBtn = document.getElementById("notificationBtn");
    const notificationBadge = document.getElementById("notificationBadge");
    const notificationPanel = document.getElementById("notificationPanel");
    const notificationList = document.getElementById("notificationList");

    function setSubtitle(text) {
      if (subtitle) {
        subtitle.textContent = text;
      }
    }

    function formatDateLabel(dateString) {
      if (!dateString) {
        return "No tasks yet";
      }

      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) {
        return dateString;
      }

      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }

    function renderWeakAreas(weakAreas) {
      weakAreasList.innerHTML = "";

      if (!Array.isArray(weakAreas) || weakAreas.length === 0) {
        weakAreasEmpty.classList.remove("hidden");
        return;
      }

      weakAreasEmpty.classList.add("hidden");

      weakAreas.forEach((area) => {
        const chip = document.createElement("span");
        chip.className = "dashboard-tag";
        chip.textContent = area;
        weakAreasList.appendChild(chip);
      });
    }

    function renderDashboard(dashboard) {
      const progress = dashboard.progress || {};
      const tasks = dashboard.tasks || {};
      const realityCheck = dashboard.realityCheck || {};

      progressPercent.textContent = `${progress.percent || 0}%`;
      progressBar.style.width = `${progress.percent || 0}%`;
      progressSummary.textContent = progress.totalTopics
        ? `${progress.completedTopicsEstimate || 0} of ${progress.totalTopics} roadmap topics covered. ${progress.currentPhase ? `Current phase: ${progress.currentPhase}.` : ""}`
        : "Generate a roadmap to start tracking progress.";

      completedTasksValue.textContent = `${tasks.completed || 0}`;
      pendingTasksValue.textContent = `${tasks.pending || 0}`;
      streakValue.textContent = `${dashboard.consistencyStreak || 0}`;
      currentFocusValue.textContent = dashboard.currentFocus || "No current focus set yet.";

      realityDate.textContent = formatDateLabel(realityCheck.date);
      plannedTasksValue.textContent = `${realityCheck.plannedTasks || 0}`;
      realityCompletedValue.textContent = `${realityCheck.completedTasks || 0}`;
      realityRateValue.textContent = `${realityCheck.completionRate || 0}%`;
      realitySummary.textContent = realityCheck.summary || "No tasks planned yet.";

      renderWeakAreas(dashboard.weakAreas || []);
    }

    function renderNotifications(notifications) {
      if (!notificationList) return;
      
      const unreadCount = notifications.filter(n => !n.read).length;
      if (unreadCount > 0) {
        notificationBadge.classList.remove("hidden");
      } else {
        notificationBadge.classList.add("hidden");
      }

      if (notifications.length === 0) {
        notificationList.innerHTML = `<div class="notification-empty">No notifications yet.</div>`;
        return;
      }

      notificationList.innerHTML = "";
      notifications.forEach(n => {
        const item = document.createElement("div");
        item.className = `notification-item ${n.read ? "" : "unread"}`;
        item.textContent = n.message;
        
        item.addEventListener("click", async () => {
          if (!n.read) {
            try {
              await MentorApi.markNotificationRead(n.id);
              n.read = true;
              renderNotifications(notifications);
            } catch (err) {
              console.error("Failed to mark as read", err);
            }
          }
        });
        
        notificationList.appendChild(item);
      });
    }

    if (notificationBtn) {
      notificationBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        notificationPanel.classList.toggle("hidden");
      });
      
      document.addEventListener("click", (e) => {
        if (!notificationPanel.contains(e.target) && e.target !== notificationBtn) {
          notificationPanel.classList.add("hidden");
        }
      });
    }

    try {
      const { user } = await MentorApi.getCurrentUser();
      const { profile } = await MentorApi.getProfile(user.id);

      if (!profile?.onboardingCompleted) {
        window.location.href = "/onboarding.html";
        return;
      }

      const { dashboard } = await MentorApi.getDashboard(user.id);
      setSubtitle(`A quick read on how ${profile.name || "your"} learning plan is going.`);
      renderDashboard(dashboard);

      try {
        const { notifications } = await MentorApi.getNotifications();
        renderNotifications(notifications);
      } catch (err) {
        console.error("Failed to load notifications", err);
      }
    } catch (error) {
      if (error.statusCode === 401) {
        window.location.href = "/login.html";
        return;
      }

      setSubtitle(error.message || "Unable to load the dashboard right now.");
    }
  });
})();
