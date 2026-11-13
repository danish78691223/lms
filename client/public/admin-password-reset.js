const form = document.getElementById("reset-form");
const button = document.getElementById("submit-button");
const message = document.getElementById("message");


document.querySelectorAll(".toggle-password").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const input = document.getElementById(toggle.dataset.target);
    if (!input) return;

    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    toggle.textContent = reveal ? "Hide" : "Show";
    toggle.setAttribute("aria-pressed", String(reveal));

    const fieldName = input.id === "reset-key"
      ? "reset key"
      : input.id === "new-password"
        ? "new password"
        : "confirmation password";
    toggle.setAttribute("aria-label", (reveal ? "Hide " : "Show ") + fieldName);
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  message.className = "message";

  const resetKey = document.getElementById("reset-key").value.trim();
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  if (newPassword.length < 12) {
    message.textContent = "Use a password with at least 12 characters.";
    message.classList.add("error");
    return;
  }
  if (newPassword !== confirmPassword) {
    message.textContent = "The new passwords do not match.";
    message.classList.add("error");
    return;
  }
  if (resetKey.length < 32) {
    message.textContent = "Enter the full one-time reset key.";
    message.classList.add("error");
    return;
  }

  button.disabled = true;
  button.textContent = "Resetting password…";
  try {
    const response = await fetch("/api/auth/admin-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ resetKey, newPassword })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Password reset failed.");

    form.reset();
    message.textContent = result.message || "Admin password reset successfully. Sign in with the new password.";
    message.classList.add("success");
    button.textContent = "Reset completed";
  } catch (error) {
    message.textContent = error.message || "Could not connect to the LMS server.";
    message.classList.add("error");
    button.disabled = false;
    button.textContent = "Reset admin password";
  }
});
