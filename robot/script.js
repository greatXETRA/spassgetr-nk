document.addEventListener("DOMContentLoaded", () => {
  const captcha = document.getElementById("captcha");
  const toggle = document.getElementById("captchaToggle");
  const status = document.getElementById("captcha-status");

  const LOADING_DURATION_MS = 1000;

  let state = "idle"; // "idle" | "loading" | "error"

  function startVerification() {
    if (state !== "idle") return;

    state = "loading";
    captcha.classList.add("is-loading");
    toggle.setAttribute("aria-checked", "true");
    toggle.setAttribute("aria-busy", "true");
    status.textContent = "Verifying…";

    window.setTimeout(() => {
      state = "error";
      captcha.classList.remove("is-loading");
      captcha.classList.add("is-error");
      toggle.setAttribute("aria-checked", "false");
      toggle.setAttribute("aria-busy", "false");
      toggle.setAttribute("aria-disabled", "true");
      status.textContent = "You are a robot";

      document.dispatchEvent(new CustomEvent("robot-detected"));
    }, LOADING_DURATION_MS);
  }

  toggle.addEventListener("click", startVerification);

  toggle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startVerification();
    }
  });
});
