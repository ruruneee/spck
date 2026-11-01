import { requireAuth, showMessage } from "./Main.js";
import { getLevelDetails, searchLevels } from "./aredl-api.js";
import { getProgress, saveProgress } from "./storage.js";

const user = requireAuth();
if (user) {
  const searchInput = document.querySelector("#level-search");
  const searchStatus = document.querySelector("[data-search-status]");
  const searchResults = document.querySelector("[data-search-results]");
  const trackedList = document.querySelector("[data-tracked-list]");
  const emptyState = document.querySelector("[data-empty-state]");
  const dialog = document.querySelector("[data-progress-dialog]");
  const progressForm = document.querySelector("[data-progress-form]");
  const progressInput = document.querySelector("#progress-percent");
  const completedInput = document.querySelector("#progress-completed");
  const progressMessage = document.querySelector("[data-progress-message]");
  const dialogLevel = document.querySelector("[data-dialog-level]");
  const dialogInfo = document.querySelector("[data-dialog-info]");
  let tracked = getProgress(user.email);
  let selectedLevel = null;
  let editingId = null;
  let searchTimer;

  function updateStats() {
    const completed = tracked.filter((item) => item.completed).length;
    const average = tracked.length
      ? Math.round(tracked.reduce((total, item) => total + item.progress, 0) / tracked.length)
      : 0;
    document.querySelector("[data-stat-total]").textContent = tracked.length;
    document.querySelector("[data-stat-completed]").textContent = completed;
    document.querySelector("[data-stat-average]").textContent = `${average}%`;
    document.querySelector("[data-list-count]").textContent = `${tracked.length} ${tracked.length === 1 ? "level" : "levels"}`;
    emptyState.hidden = tracked.length > 0;
  }

  function renderTracked() {
    trackedList.replaceChildren();
    tracked
      .slice()
      .sort((a, b) => a.position - b.position)
      .forEach((item) => {
        const row = document.createElement("article");
        row.className = "tracked-row";

        const thumbnail = createThumbnail(item, "tracked");

        const main = document.createElement("div");
        main.className = "tracked-main";
        const title = document.createElement("div");
        title.className = "tracked-title";
        const name = document.createElement("strong");
        name.textContent = item.name;
        title.append(name);

        const facts = document.createElement("div");
        facts.className = "level-facts";
        facts.append(
          createFact(item.position ? `Rank #${item.position}` : "Rank unavailable"),
          createFact(item.levelId ? `ID ${item.levelId}` : "ID unavailable"),
          createFact(item.verifier ? `Verifier: ${item.verifier}` : item.detailsError ? "Verifier unavailable" : "Loading verifier…"),
          createFact(Number.isInteger(item.victors) ? `${item.victors} ${item.victors === 1 ? "victor" : "victors"}` : item.detailsError ? "Victor count unavailable" : "Loading victors…")
        );

        const track = document.createElement("div");
        track.className = "progress-track";
        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-label", `${item.name} progress`);
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");
        track.setAttribute("aria-valuenow", String(item.progress));
        const fill = document.createElement("div");
        fill.className = `progress-fill${item.completed ? " progress-fill--complete" : ""}`;
        fill.style.width = `${item.progress}%`;
        track.append(fill);

        const meta = document.createElement("div");
        meta.className = "tracked-meta";
        const progress = document.createElement("span");
        progress.textContent = item.completed ? "Completed" : "In progress";
        const percent = document.createElement("strong");
        percent.textContent = `${item.progress}%`;
        meta.append(progress, percent);
        main.append(title, facts, track, meta);

        const actions = document.createElement("div");
        actions.className = "tracked-actions";
        const edit = document.createElement("button");
        edit.className = "button button--quiet button--small";
        edit.type = "button";
        edit.textContent = "Update";
        edit.addEventListener("click", () => openDialog(item, item.id));
        const remove = document.createElement("button");
        remove.className = "icon-button icon-button--danger";
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove ${item.name}`);
        remove.addEventListener("click", () => {
          tracked = tracked.filter((entry) => entry.id !== item.id);
          persistAndRender();
        });
        actions.append(edit, remove);
        row.append(thumbnail, main, actions);
        trackedList.append(row);
      });
    updateStats();
  }

  function persistAndRender() {
    saveProgress(user.email, tracked);
    renderTracked();
    renderSearchResults(lastResults);
  }

  let lastResults = [];

  function createThumbnail(level, variant) {
    const wrapper = document.createElement("div");
    wrapper.className = `level-thumbnail level-thumbnail--${variant}`;
    wrapper.setAttribute("aria-label", `${level.name} verification video thumbnail`);

    const fallback = document.createElement("span");
    fallback.textContent = "GD";
    wrapper.append(fallback);

    if (level.thumbnail) {
      const image = document.createElement("img");
      image.src = level.thumbnail;
      image.alt = `${level.name} verification video preview`;
      image.loading = variant === "search" ? "eager" : "lazy";
      image.addEventListener("error", () => image.remove(), { once: true });
      wrapper.append(image);
    }

    return wrapper;
  }

  function createFact(text) {
    const fact = document.createElement("span");
    fact.textContent = text;
    return fact;
  }

  function renderSearchResults(levels) {
    lastResults = levels;
    searchResults.replaceChildren();
    levels.forEach((level) => {
      const row = document.createElement("div");
      row.className = "level-row";
      const thumbnail = createThumbnail(level, "search");
      const copy = document.createElement("div");
      copy.className = "level-copy";
      const name = document.createElement("strong");
      name.textContent = level.name;
      const detail = document.createElement("span");
      detail.textContent = `Rank #${level.position || "—"} · ${level.levelId ? `ID ${level.levelId}` : "ID unavailable"}`;
      copy.append(name, detail);
      const add = document.createElement("button");
      add.className = "button button--primary button--small";
      add.type = "button";
      const existing = tracked.find((item) => item.id === level.id);
      add.textContent = existing ? (existing.completed ? "Completed" : `${existing.progress}%`) : "+ Add";
      add.setAttribute("aria-label", existing ? `${level.name} is already in your list` : `Add ${level.name}`);
      add.disabled = Boolean(existing);
      add.addEventListener("click", () => openDialog(level, null));
      row.append(thumbnail, copy, add);
      searchResults.append(row);
    });
  }

  function loadSearchDetails(levels, query) {
    levels.forEach((level) => {
      getLevelDetails(level)
        .then((details) => {
          Object.assign(level, details);

          if (tracked.some((item) => item.id === level.id)) {
            tracked = tracked.map((item) => item.id === level.id ? { ...item, ...details } : item);
            saveProgress(user.email, tracked);
            renderTracked();
          }

          if (searchInput.value.trim() === query && lastResults.some((item) => item.id === level.id)) {
            renderSearchResults(lastResults);
          }
        })
        .catch((error) => {
          if (searchInput.value.trim() === query) {
            searchStatus.textContent = `Some level details could not be loaded: ${error.message}`;
          }
        });
    });
  }

  async function runSearch(query) {
    if (query.trim().length < 2) {
      searchResults.replaceChildren();
      searchStatus.textContent = "Start typing at least 2 characters to search the AREDL level list.";
      return;
    }

    searchStatus.textContent = "Searching AREDL…";
    try {
      const levels = await searchLevels(query);
      if (searchInput.value.trim() !== query.trim()) return;
      renderSearchResults(levels);
      loadSearchDetails(levels, query.trim());
      searchStatus.textContent = levels.length
        ? `${levels.length} result${levels.length === 1 ? "" : "s"} shown${levels.length === 30 ? " (showing the first 30)" : ""}.`
        : "No matching levels found.";
    } catch (error) {
      searchResults.replaceChildren();
      searchStatus.textContent = `Could not load levels: ${error.message}`;
    }
  }

  function openDialog(level, levelId) {
    selectedLevel = level;
    editingId = levelId;
    const current = levelId ? tracked.find((item) => item.id === levelId) : null;
    dialogLevel.textContent = level.name;
    progressInput.value = current && !current.completed ? current.progress : "";
    completedInput.checked = Boolean(current?.completed);
    progressInput.disabled = completedInput.checked;
    progressInput.required = !completedInput.checked;
    progressMessage.hidden = true;
    renderDialogInfo(current ?? level, false);
    dialog.showModal();

    if (current?.verifier || Number.isInteger(current?.victors) || current?.thumbnail) return;

    getLevelDetails(level)
      .then((details) => {
        Object.assign(level, details);
        if (tracked.some((item) => item.id === level.id)) {
          tracked = tracked.map((item) => item.id === level.id ? { ...item, ...details } : item);
          saveProgress(user.email, tracked);
        }
        if (selectedLevel === level) renderDialogInfo(level, false);
        renderTracked();
        renderSearchResults(lastResults.map((item) => item.id === level.id ? { ...item, ...details } : item));
      })
      .catch((error) => {
        if (selectedLevel === level) renderDialogInfo(level, true, error.message);
      });
  }

  function renderDialogInfo(level, failed, errorMessage = "") {
    dialogInfo.replaceChildren();
    dialogInfo.append(createThumbnail(level, "dialog"));

    const details = document.createElement("div");
    details.className = "dialog-level-facts";
    const verifier = level.verifier ? `Verifier: ${level.verifier}` : failed ? "Verifier unavailable" : "Loading verifier…";
    const victors = Number.isInteger(level.victors) ? `${level.victors} ${level.victors === 1 ? "victor" : "victors"}` : failed ? "Victor count unavailable" : "Loading victor count…";
    [level.position ? `AREDL rank #${level.position}` : "AREDL rank unavailable", verifier, victors].forEach((text) => {
      details.append(createFact(text));
    });
    if (failed) {
      const error = createFact(`Could not load additional AREDL details: ${errorMessage}`);
      error.className = "dialog-level-error";
      details.append(error);
    }
    dialogInfo.append(details);
  }

  searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    const query = searchInput.value;
    searchTimer = window.setTimeout(() => runSearch(query), 250);
  });

  const initialSearch = new URLSearchParams(window.location.search).get("level");
  if (initialSearch) {
    searchInput.value = initialSearch;
    runSearch(initialSearch);
    document.querySelector(".search-panel").scrollIntoView();
  }

  completedInput.addEventListener("change", () => {
    progressInput.disabled = completedInput.checked;
    progressInput.required = !completedInput.checked;
    if (completedInput.checked) progressInput.value = "";
  });

  progressForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const completed = completedInput.checked;
    const value = Number(progressInput.value);
    if (!completed && (!Number.isInteger(value) || value < 1 || value > 99)) {
      showMessage(progressMessage, "Enter a whole-number progress value from 1 to 99, or mark the level completed.");
      return;
    }

    const entry = {
      ...selectedLevel,
      progress: completed ? 100 : value,
      completed,
      updatedAt: new Date().toISOString()
    };
    if (editingId) {
      tracked = tracked.map((item) => item.id === editingId ? entry : item);
    } else {
      tracked = [...tracked, entry];
    }
    persistAndRender();
    dialog.close();
  });

  document.querySelectorAll("[data-cancel-dialog]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });

  renderTracked();

  Promise.all(tracked.map(async (item) => {
    if (item.verifier && Number.isInteger(item.victors) && item.thumbnail) return;

    try {
      Object.assign(item, await getLevelDetails(item));
      delete item.detailsError;
    } catch (error) {
      item.detailsError = error.message;
    }
  })).then(() => {
    saveProgress(user.email, tracked);
    renderTracked();
  });
}
