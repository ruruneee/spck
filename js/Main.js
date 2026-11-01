import { clearSession, getCurrentUser } from "./storage.js";

export function requireAuth() {
  const user = getCurrentUser();

  if (!user) {
    window.location.replace("index.html");
    return null;
  }

  const username = document.querySelector("[data-current-username]");
  if (username) username.textContent = user.username;

  const activePage = document.body.dataset.page;
  document.querySelectorAll("[data-nav-page]").forEach((link) => {
    if (link.dataset.navPage === activePage) {
      link.setAttribute("aria-current", "page");
    }
  });

  document.querySelector("[data-signout]")?.addEventListener("click", () => {
    clearSession();
    window.location.replace("index.html");
  });

  return user;
}

export function showMessage(element, message, type = "error") {
  if (!element) return;
  element.textContent = message;
  element.className = `message message--${type}`;
  element.hidden = false;
}

export function clearMessage(element) {
  if (!element) return;
  element.textContent = "";
  element.hidden = true;
}