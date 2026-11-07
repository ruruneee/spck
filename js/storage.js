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

  const users = readUsers();
  for (let i = 0; i < users.length; i++) {
    if (users[i].email === email) {
      return users[i];
    }
  }

  return null;
}

export function createUser(accountInfo) {
  const username = accountInfo.username;
  const email = accountInfo.email;
  const password = accountInfo.password;
  const users = readUsers();

  for (let i = 0; i < users.length; i++) {
    if (users[i].email === email) {
      throw new Error("An account with this email already exists.");
    }
  }

  const user = { username, email, password, progress: [] };
  users.push(user);
  writeUsers(users);
  localStorage.setItem(SESSION_KEY, email);
  return user;
}

export function signIn(email, password) {
  const users = readUsers();

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.email === email && user.password === password) {
      localStorage.setItem(SESSION_KEY, email);
      return user;
    }
  }

  throw new Error("That email and password combination was not found.");
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function updateUser(email, changes) {
  const users = readUsers();
  let index = -1;

  for (let i = 0; i < users.length; i++) {
    if (users[i].email === email) {
      index = i;
      break;
    }
  }

  if (index === -1) throw new Error("Your account could not be found.");

  const updatedUser = users[index];
  const changeNames = Object.keys(changes);
  for (let i = 0; i < changeNames.length; i++) {
    const name = changeNames[i];
    updatedUser[name] = changes[name];
  }

  writeUsers(users);
  return updatedUser;
}

export function getProgress(email) {
  const users = readUsers();
  let user = null;

  for (let i = 0; i < users.length; i++) {
    if (users[i].email === email) {
      user = users[i];
      break;
    }
  }

  if (!user) throw new Error("Your account could not be found.");
  if (!Array.isArray(user.progress)) {
    throw new Error("Saved level progress is not in the expected format.");
  }
  return user.progress;
}

export function saveProgress(email, progress) {
  updateUser(email, { progress });
}
