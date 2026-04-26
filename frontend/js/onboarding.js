(function initOnboardingPage() {
  document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("onboardingForm");
    const steps = Array.from(document.querySelectorAll(".quiz-step"));
    const nextButton = document.getElementById("quizNextBtn");
    const backButton = document.getElementById("quizBackBtn");
    const submitButton = document.getElementById("quizSubmitBtn");
    const message = document.getElementById("quizMessage");
    const progressBar = document.getElementById("quizProgressBar");
    const stepLabel = document.getElementById("quizStepLabel");

    let currentStep = 0;
    let currentUser = null;

    try {
      const { user } = await MentorApi.getCurrentUser();
      currentUser = user;

      const existing = await MentorApi.getProfile(user.id).catch((error) => {
        if (error.statusCode === 404) return null;
        throw error;
      });

      if (existing?.profile?.onboardingCompleted) {
        window.location.href = "/";
        return;
      }
    } catch (_error) {
      window.location.href = "/login.html";
      return;
    }

    function setMessage(text, isError = false) {
      if (!message) return;
      message.textContent = text;
      message.classList.toggle("error", isError);
    }

    function updateStepView() {
      steps.forEach((step, index) => {
        step.classList.toggle("active", index === currentStep);
      });

      const progress = ((currentStep + 1) / steps.length) * 100;
      if (progressBar) progressBar.style.width = `${progress}%`;
      if (stepLabel) stepLabel.textContent = `Question ${currentStep + 1} of ${steps.length}`;

      backButton.disabled = currentStep === 0;
      nextButton.classList.toggle("hidden", currentStep === steps.length - 1);
      submitButton.classList.toggle("hidden", currentStep !== steps.length - 1);
    }

    function getCheckedValues(name) {
      return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
    }

    function isCurrentStepValid() {
      const step = steps[currentStep];
      const radio = step.querySelector('input[type="radio"]');
      const checkboxes = step.querySelectorAll('input[type="checkbox"]');

      if (radio) {
        return Boolean(step.querySelector('input[type="radio"]:checked'));
      }

      if (checkboxes.length > 0) {
        return step.querySelectorAll('input[type="checkbox"]:checked').length > 0;
      }

      return true;
    }

    nextButton.addEventListener("click", () => {
      if (!isCurrentStepValid()) {
        setMessage("Please choose an option before continuing.", true);
        return;
      }

      setMessage("This takes about a minute.");
      currentStep += 1;
      updateStepView();
    });

    backButton.addEventListener("click", () => {
      if (currentStep === 0) return;
      setMessage("This takes about a minute.");
      currentStep -= 1;
      updateStepView();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!isCurrentStepValid()) {
        setMessage("Please choose an option before finishing.", true);
        return;
      }

      const answers = {
        primaryGoal: form.querySelector('input[name="primaryGoal"]:checked')?.value || "",
        skillLevel: form.querySelector('input[name="skillLevel"]:checked')?.value || "",
        learningStyle: form.querySelector('input[name="learningStyle"]:checked')?.value || "",
        timeAvailability: form.querySelector('input[name="timeAvailability"]:checked')?.value || "",
        interests: getCheckedValues("interests"),
        difficultAreas: getCheckedValues("difficultAreas"),
        outcomeGoal: form.querySelector('input[name="outcomeGoal"]:checked')?.value || "",
      };

      try {
        submitButton.disabled = true;
        await MentorApi.submitOnboarding({
          userId: currentUser.id,
          name: currentUser.name,
          answers,
        });
        window.location.href = "/";
      } catch (error) {
        submitButton.disabled = false;
        setMessage(error.message || "Unable to save your onboarding answers.", true);
      }
    });

    updateStepView();
  });
})();
