const USERS_KEY = "gdtrack.users";
const SESSION_KEY = "gdtrack.session";

function readUsers() {
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) return [];

  const users = JSON.parse(stored);
  if (!Array.isArray(users)) {
    throw new Error("Saved account data is not in the expected format.");
  }
  return users;
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getUsers() {
  return readUsers();
}

export function getCurrentUser() {
  const email = localStorage.getItem(SESSION_KEY);
  if (!email) return null;
  return readUsers().find((user) => user.email === email) ?? null;
}

export function createUser({ username, email, password }) {
  const users = readUsers();
  if (users.some((user) => user.email === email)) {
    throw new Error("An account with this email already exists.");
  }

  const user = { username, email, password, progress: [] };
  writeUsers([...users, user]);
  localStorage.setItem(SESSION_KEY, email);
  return user;
}

export function signIn(email, password) {
  const user = readUsers().find((account) => account.email === email && account.password === password);
  if (!user) throw new Error("That email and password combination was not found.");
  localStorage.setItem(SESSION_KEY, email);
  return user;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function updateUser(email, changes) {
  const users = readUsers();
  const index = users.findIndex((user) => user.email === email);
  if (index === -1) throw new Error("Your account could not be found.");

  users[index] = { ...users[index], ...changes };
  writeUsers(users);
  return users[index];
}

export function getProgress(email) {
  const user = readUsers().find((account) => account.email === email);
  if (!user) throw new Error("Your account could not be found.");
  if (!Array.isArray(user.progress)) {
    throw new Error("Saved level progress is not in the expected format.");
  }
  return user.progress;
}

export function saveProgress(email, progress) {
  updateUser(email, { progress });
}
