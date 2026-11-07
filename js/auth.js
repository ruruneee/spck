import { clearSession, createUser, getCurrentUser, signIn } from "./storage.js";
import { clearMessage, showMessage } from "./Main.js";

const loginForm = document.querySelector("[data-login-form]");
const signupForm = document.querySelector("[data-signup-form]");

if (getCurrentUser()) {
  window.location.replace("tracker.html");
}

if (loginForm) {
  const message = document.querySelector("[data-auth-message]");
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    clearMessage(message);
    const formData = new FormData(loginForm);
    // FormData reads the values from the named form fields.
    const email = String(formData.get("email")).trim().toLocaleLowerCase();

    try {
      signIn(email, String(formData.get("password")));
      window.location.assign("tracker.html");
    } catch (error) {
      showMessage(message, error.message);
    }
  });
}

if (signupForm) {
  const message = document.querySelector("[data-auth-message]");
  signupForm.addEventListener("submit", function (event) {
    event.preventDefault();
    clearMessage(message);
    const formData = new FormData(signupForm);

    try {
      const accountInfo = {
        username: String(formData.get("username")).trim(),
        email: String(formData.get("email")).trim().toLocaleLowerCase(),
        password: String(formData.get("password")),
      };
      createUser(accountInfo);
      window.location.assign("tracker.html");
    } catch (error) {
      showMessage(message, error.message);
    }
  });
}

window.addEventListener("storage", function (event) {
  if (event.key === "gdtrack.session" && !event.newValue) {
    clearSession();
    window.location.replace("index.html");
  }
});
