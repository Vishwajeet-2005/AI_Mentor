(function initRoadmapPage() {
  document.addEventListener("DOMContentLoaded", async () => {
    const subtitle = document.getElementById("roadmapSubtitle");
    const summary = document.getElementById("roadmapSummary");
    const phasesRoot = document.getElementById("roadmapPhases");
    const refreshButton = document.getElementById("refreshRoadmapBtn");
    const refreshTasksButton = document.getElementById("refreshTasksBtn");
    const taskList = document.getElementById("taskList");
    const taskEmpty = document.getElementById("taskEmpty");

    const mindmapModal = document.getElementById("mindmapModal");
    const closeMindmapBtn = document.getElementById("closeMindmapBtn");
    const mindmapLoading = document.getElementById("mindmapLoading");
    const mindmapSvg = document.getElementById("mindmapSvg");
    let markmapInstance = null;

    let currentUser = null;
    let currentProfile = null;

    function setSubtitle(text) {
      if (subtitle) subtitle.textContent = text;
    }

    function renderSummary(profile) {
      if (!summary) return;

      const goals = Array.isArray(profile.goals) && profile.goals.length ? profile.goals.join(" • ") : "No goals added";
      const interests = Array.isArray(profile.interests) && profile.interests.length ? profile.interests.join(" • ") : "No interests added";

      summary.innerHTML = `
        <article class="roadmap-summary-card">
          <span class="roadmap-summary-label">Level</span>
          <strong>${profile.level || "beginner"}</strong>
        </article>
        <article class="roadmap-summary-card">
          <span class="roadmap-summary-label">Goals</span>
          <strong>${goals}</strong>
        </article>
        <article class="roadmap-summary-card">
          <span class="roadmap-summary-label">Interests</span>
          <strong>${interests}</strong>
        </article>
      `;
    }

    function renderRoadmap(roadmap) {
      phasesRoot.innerHTML = "";

      roadmap.phases.forEach((phase, index) => {
        const card = document.createElement("article");
        card.className = "roadmap-phase-card";
        card.innerHTML = `
          <div class="roadmap-phase-head">
            <span class="roadmap-phase-step">Phase ${index + 1}</span>
            <h2>${phase.title}</h2>
          </div>
          <div class="roadmap-topic-list">
            ${phase.topics.map((topic) => `
              <div class="roadmap-topic-item">
                <div>
                  <h3>${topic.title}</h3>
                  <p>${topic.estimatedDuration}</p>
                </div>
              </div>
            `).join("")}
          </div>
        `;
        phasesRoot.appendChild(card);
      });
    }

    function renderTasks(tasks) {
      taskList.innerHTML = "";
      const hasTasks = tasks.length > 0;
      taskEmpty.classList.toggle("hidden", hasTasks);

      tasks.forEach((task) => {
        const item = document.createElement("article");
        item.className = `task-item ${task.status}`;
        item.innerHTML = `
          <div class="task-copy">
            <h3>${task.title}</h3>
            <p>${task.duration || "20-40 mins"}${task.phaseTitle ? ` • ${task.phaseTitle}` : ""}</p>
          </div>
          <button class="task-action" data-task-id="${task.taskId}" data-status="${task.status}">
            ${task.status === "completed" ? "Completed" : "Mark complete"}
          </button>
        `;
        taskList.appendChild(item);
      });
    }

    async function loadRoadmap({ forceRefresh = false } = {}) {
      if (!currentUser) return;

      try {
        if (forceRefresh) {
          const { roadmap } = await MentorApi.generateRoadmap(currentUser.id);
          setSubtitle(`Fresh roadmap generated for ${currentProfile?.name || "you"}.`);
          renderRoadmap(roadmap);
          return;
        }

        const { roadmap } = await MentorApi.getRoadmap(currentUser.id);
        setSubtitle(`Roadmap built around your current goals and interests.`);
        renderRoadmap(roadmap);
      } catch (error) {
        if (error.statusCode === 404) {
          const { roadmap } = await MentorApi.generateRoadmap(currentUser.id);
          setSubtitle(`Roadmap built around your current goals and interests.`);
          renderRoadmap(roadmap);
          return;
        }

        setSubtitle(error.message || "Unable to load roadmap right now.");
      }
    }

    async function loadTasks({ forceGenerate = false } = {}) {
      if (!currentUser) return;

      try {
        const response = forceGenerate
          ? await MentorApi.generateTasks(currentUser.id)
          : await MentorApi.getTasks(currentUser.id);

        renderTasks(response.tasks || []);
      } catch (error) {
        taskEmpty.classList.remove("hidden");
        taskEmpty.textContent = error.message || "Unable to load daily tasks right now.";
      }
    }

    try {
      const { user } = await MentorApi.getCurrentUser();
      currentUser = user;
      const profileResponse = await MentorApi.getProfile(user.id);
      currentProfile = profileResponse.profile;

      if (!currentProfile?.onboardingCompleted) {
        window.location.href = "/onboarding.html";
        return;
      }

      renderSummary(currentProfile);
      await loadRoadmap();
      await loadTasks();
    } catch (_error) {
      window.location.href = "/login.html";
      return;
    }

    refreshButton?.addEventListener("click", async () => {
      refreshButton.disabled = true;
      setSubtitle("Refreshing your roadmap...");
      await loadRoadmap({ forceRefresh: true });
      refreshButton.disabled = false;
    });

    refreshTasksButton?.addEventListener("click", async () => {
      refreshTasksButton.disabled = true;
      await loadTasks({ forceGenerate: true });
      refreshTasksButton.disabled = false;
    });

    taskList?.addEventListener("click", async (event) => {
      const button = event.target.closest(".task-action");
      if (!button) return;
      if (button.dataset.status === "completed") return;

      button.disabled = true;

      try {
        const result = await MentorApi.updateTask(button.dataset.taskId, "completed");
        if (result.profile) {
          currentProfile = result.profile;
          renderSummary(currentProfile);
        }

        await loadTasks();
      } catch (_error) {
        button.disabled = false;
      }
    });

    closeMindmapBtn?.addEventListener("click", () => {
      mindmapModal.classList.add("hidden");
    });

    phasesRoot?.addEventListener("click", async (event) => {
      const item = event.target.closest(".roadmap-topic-item");
      if (!item) return;

      const topicTitle = item.querySelector("h3")?.textContent;
      if (!topicTitle) return;

      mindmapModal.classList.remove("hidden");
      mindmapLoading.classList.remove("hidden");
      mindmapLoading.textContent = "Generating mind map...";
      if (markmapInstance) {
        mindmapSvg.innerHTML = "";
        markmapInstance.destroy();
        markmapInstance = null;
      }

      try {
        const { markdown } = await MentorApi.generateMindmap(topicTitle);
        mindmapLoading.classList.add("hidden");
        
        const { Transformer } = window.markmap;
        const transformer = new Transformer();
        const { root } = transformer.transform(markdown);
        
        markmapInstance = window.markmap.Markmap.create(mindmapSvg, {
          autoFit: true,
          color: (node) => {
            const colors = ['#c8a96e', '#88c86e', '#6ec8c8', '#a96ec8'];
            return colors[node.depth % colors.length];
          }
        }, root);
      } catch (error) {
        mindmapLoading.textContent = error.message || "Failed to load mind map.";
      }
    });
  });
})();
