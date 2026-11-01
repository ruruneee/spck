import { requireAuth, showMessage } from "./Main.js";
import { updateUser } from "./storage.js";

const user = requireAuth();
if (user) {
  const profileForm = document.querySelector("[data-profile-form]");
  const passwordForm = document.querySelector("[data-password-form]");
  const profileMessage = document.querySelector("[data-profile-message]");
  const passwordMessage = document.querySelector("[data-password-message]");
  profileForm.elements.username.value = user.username;
  profileForm.elements.email.value = user.email;

  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const formData = new FormData(profileForm);
      if (String(formData.get("currentPassword")) !== user.password) {
        throw new Error("Current password is incorrect.");
      }

      const username = String(formData.get("username")).trim();
      updateUser(user.email, { username });
      user.username = username;
      document.querySelector("[data-current-username]").textContent = username;
      profileForm.elements.currentPassword.value = "";
      showMessage(profileMessage, "Username saved.", "success");
    } catch (error) {
      showMessage(profileMessage, error.message);
    }
  });

  passwordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const formData = new FormData(passwordForm);
      if (String(formData.get("currentPassword")) !== user.password) {
        throw new Error("Current password is incorrect.");
      }

      const password = String(formData.get("password"));
      if (password.length < 4) throw new Error("Your password must be at least 4 characters.");
      updateUser(user.email, { password });
      user.password = password;
      passwordForm.reset();
      showMessage(passwordMessage, "Password updated.", "success");
    } catch (error) {
      showMessage(passwordMessage, error.message);
    }
  });
}
