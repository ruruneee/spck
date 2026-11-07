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

  let tracked = getProgress(user.email);
  let results = [];
  let selectedLevel = null;
  let editingId = null;
  let searchTimer;

  // Updates the summary cards and tracked-level count.
  function updateStats() {
    let completed = 0;
    let listCompleted = 0;
    let hardest = null;

    for (let i = 0; i < tracked.length; i++) {
      const level = tracked[i];
      if (!level.completed) continue;

      completed++;
      if (level.position > 0 && level.position <= 150) listCompleted++;
      if (level.position > 0 && (!hardest || level.position < hardest.position)) {
        hardest = level;
      }
    }

    let hardestText = "—";
    if (hardest) hardestText = `#${hardest.position} ${hardest.name}`;

    document.querySelector("[data-stat-total]").textContent = tracked.length;
    document.querySelector("[data-stat-completed]").textContent = completed;
    document.querySelector("[data-stat-hardest]").textContent = hardestText;
    document.querySelector("[data-stat-list-completion]").textContent =
      `${listCompleted} / 150`;
    document.querySelector("[data-list-count]").textContent =
      tracked.length + (tracked.length === 1 ? " level" : " levels");
    emptyState.hidden = tracked.length > 0;
  }

  // Creates an element with a class and text.
  function makeText(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }

  // Creates a thumbnail for the level, using GD if there is no image.
  function makeThumbnail(level, place) {
    const thumbnail = makeText(
      "div",
      `level-thumbnail level-thumbnail--${place}`,
      "",
    );
    thumbnail.setAttribute("aria-label", level.name + " thumbnail");
    thumbnail.append(makeText("span", "", "GD"));

    if (level.thumbnail) {
      const image = document.createElement("img");
      image.src = level.thumbnail;
      image.alt = level.name + " thumbnail";
      image.loading = place === "search" ? "eager" : "lazy";
      image.addEventListener("error", function () {
        // Removes broken images so the GD fallback can show.
        image.remove();
      });
      thumbnail.append(image);
    }

    return thumbnail;
  }

  // Redraws the tracked levels with their progress, details, and buttons.
  function renderTracked() {
    trackedList.replaceChildren();
    const levels = tracked.slice();
    levels.sort(function (a, b) {
      // Sorts levels by their AREDL rank.
      return a.position - b.position;
    });

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const row = makeText("article", "tracked-row", "");
      const main = makeText("div", "tracked-main", "");
      const title = makeText("div", "tracked-title", "");
      title.append(makeText("strong", "", level.name));

      const facts = makeText("div", "level-facts", "");
      let verifierText = "Loading verifier…";
      if (level.verifier) {
        verifierText = "Verifier: " + level.verifier;
      } else if (level.detailsError) {
        verifierText = "Verifier unavailable";
      }

      facts.append(
        makeText("span", "", level.position ? `Rank #${level.position}` : "Rank unavailable"),
        makeText("span", "", level.levelId ? `ID ${level.levelId}` : "ID unavailable"),
        makeText("span", "", verifierText),
      );

      const track = makeText("div", "progress-track", "");
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", level.name + " progress");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(level.progress));
      let fillClass = "progress-fill--red";
      if (level.progress >= 20 && level.progress < 50) {
        fillClass = "progress-fill--blue";
      } else if (level.progress >= 50 && level.progress < 80) {
        fillClass = "progress-fill--purple";
      } else if (level.progress >= 80 && level.progress < 100) {
        fillClass = "progress-fill--orange";
      } else if (level.progress === 100) {
        fillClass = "progress-fill--complete";
        track.className += " progress-track--complete";
      }

      const fill = makeText("div", "progress-fill " + fillClass, "");
      fill.style.width = level.progress + "%";
      track.append(fill);

      const meta = makeText("div", "tracked-meta", "");
      meta.append(
        makeText("span", "", level.completed ? "Completed" : "In progress"),
        makeText("strong", "", level.progress + "%"),
      );
      main.append(title, facts, track, meta);

      const actions = makeText("div", "tracked-actions", "");
      const edit = makeText("button", "button button--quiet button--small", "Update");
      edit.type = "button";
      edit.addEventListener("click", function () {
        // Opens this level in the progress form.
        openDialog(level, level.id);
      });

      const remove = makeText("button", "icon-button icon-button--danger", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove " + level.name);
      remove.addEventListener("click", function () {
        // Removes the level, then saves the updated list.
        const remaining = [];
        for (let i = 0; i < tracked.length; i++) {
          if (tracked[i].id !== level.id) remaining.push(tracked[i]);
        }
        tracked = remaining;
        saveAndRender();
      });

      actions.append(edit, remove);
      row.append(makeThumbnail(level, "tracked"), main, actions);
      trackedList.append(row);
    }

    updateStats();
  }

  // Draws search results and disables levels that are already tracked.
  function renderSearchResults() {
    searchResults.replaceChildren();

    for (let i = 0; i < results.length; i++) {
      const level = results[i];
      const row = makeText("div", "level-row", "");
      const copy = makeText("div", "level-copy", "");
      copy.append(makeText("strong", "", level.name));

      let rank = "—";
      if (level.position) rank = "#" + level.position;
      let levelId = "ID unavailable";
      if (level.levelId) levelId = "ID " + level.levelId;
      copy.append(makeText("span", "", "Rank " + rank + " · " + levelId));

      let trackedLevel = null;
      for (let j = 0; j < tracked.length; j++) {
        if (tracked[j].id === level.id) {
          trackedLevel = tracked[j];
          break;
        }
      }

      if (level.verifier) {
        copy.append(makeText("span", "", "Verifier: " + level.verifier));
      } else {
        copy.append(makeText("span", "", "Loading verifier…"));
      }

      const add = makeText("button", "button button--primary button--small", "+ Add");
      add.type = "button";
      add.disabled = Boolean(trackedLevel);
      if (trackedLevel) {
        add.textContent = trackedLevel.completed
          ? "Completed"
          : trackedLevel.progress + "%";
      }
      add.addEventListener("click", function () {
        openDialog(level, null);
      });

      row.append(makeThumbnail(level, "search"), copy, add);
      searchResults.append(row);
    }
  }

  // Saves progress and refreshes the tracker and search results.
  function saveAndRender() {
    saveProgress(user.email, tracked);
    renderTracked();
    renderSearchResults();
  }

  // Loads and saves the thumbnail and verifier for a level.
  function loadDetails(level, query) {
    getLevelDetails(level)
      .then(function (details) {
        // Saves the thumbnail and verifier returned by the API.
        level.verifier = details.verifier;
        level.thumbnail = details.thumbnail;
        delete level.detailsError;

        let isTracked = false;
        for (let i = 0; i < tracked.length; i++) {
          if (tracked[i].id === level.id) {
            tracked[i].verifier = details.verifier;
            tracked[i].thumbnail = details.thumbnail;
            delete tracked[i].detailsError;
            isTracked = true;
            break;
          }
        }

        if (isTracked) {
          saveProgress(user.email, tracked);
          renderTracked();
        }

        for (let i = 0; i < results.length; i++) {
          if (results[i].id === level.id) {
            renderSearchResults();
            break;
          }
        }

        if (selectedLevel === level) renderDialogInfo(level);
      })
      .catch(function (error) {
        // Keeps an error message for this level if its details cannot load.
        level.detailsError = error.message;

        for (let i = 0; i < tracked.length; i++) {
          if (tracked[i].id === level.id) {
            tracked[i].detailsError = error.message;
            renderTracked();
            break;
          }
        }

        if (selectedLevel === level) renderDialogInfo(level, error.message);
        if (query && searchInput.value.trim() === query) {
          searchStatus.textContent = "Could not load level details: " + error.message;
        }
      });
  }

  // Shows the level thumbnail and verifier in the progress dialog.
  function renderDialogInfo(level, errorMessage) {
    const info = document.querySelector("[data-dialog-info]");
    info.replaceChildren(makeThumbnail(level, "dialog"));

    let verifier = "Loading verifier…";
    if (level.verifier) verifier = "Verifier: " + level.verifier;
    if (level.detailsError) verifier = "Verifier unavailable";
    info.append(makeText("span", "dialog-level-facts", verifier));

    if (errorMessage) {
      info.append(makeText("span", "dialog-level-error", errorMessage));
    }
  }

  // Opens the progress form for a new or tracked level.
  function openDialog(level, levelId) {
    selectedLevel = level;
    editingId = levelId;

    let current = null;
    for (let i = 0; i < tracked.length; i++) {
      if (tracked[i].id === levelId) {
        current = tracked[i];
        break;
      }
    }

    dialogLevel.textContent = level.name;
    progressInput.value = current && !current.completed ? current.progress : "";
    completedInput.checked = current ? Boolean(current.completed) : false;
    progressInput.disabled = completedInput.checked;
    progressInput.required = !completedInput.checked;
    progressMessage.hidden = true;
    renderDialogInfo(level);
    dialog.showModal();

    if (!level.verifier || !level.thumbnail) loadDetails(level);
  }

  // Searches the level list and shows any API errors.
  async function runSearch(query) {
    query = query.trim();
    if (query.length < 2) {
      results = [];
      renderSearchResults();
      searchStatus.textContent = "Type at least 2 characters to search.";
      return;
    }

    searchStatus.textContent = "Searching…";
    try {
      const foundLevels = await searchLevels(query);
      if (searchInput.value.trim() !== query) return;

      results = foundLevels;
      renderSearchResults();

      if (results.length === 0) {
        searchStatus.textContent = "No matching levels found.";
      } else {
        searchStatus.textContent = results.length + " levels found.";
        for (let i = 0; i < results.length; i++) {
          if (!results[i].verifier || !results[i].thumbnail) {
            loadDetails(results[i], query);
          }
        }
      }
    } catch (error) {
      results = [];
      renderSearchResults();
      searchStatus.textContent = "Could not search levels: " + error.message;
    }
  }

  // Waits briefly after typing before searching the API.
  searchInput.addEventListener("input", function () {
    // Resets the timer whenever the search text changes.
    window.clearTimeout(searchTimer);
    const query = searchInput.value.trim();
    searchTimer = window.setTimeout(function () {
      // Searches after the user pauses typing.
      runSearch(query);
    }, 250);
  });

  // Reads an optional level name passed from the rankings page.
  const initialSearch = new URLSearchParams(window.location.search).get("level");
  if (initialSearch) {
    searchInput.value = initialSearch;
    runSearch(initialSearch);
    document.querySelector(".search-panel").scrollIntoView();
  }

  // Completed levels count as 100%, so they do not need a progress number.
  completedInput.addEventListener("change", function () {
    // Completed levels are 100%, so the progress input is not needed.
    progressInput.disabled = completedInput.checked;
    progressInput.required = !completedInput.checked;
    if (completedInput.checked) progressInput.value = "";
  });

  // Checks and saves progress from the dialog form.
  progressForm.addEventListener("submit", function (event) {
    // Validates the progress and saves the level.
    event.preventDefault();
    const completed = completedInput.checked;
    const progress = Number(progressInput.value);

    if (!completed && (!Number.isInteger(progress) || progress < 1 || progress > 99)) {
      showMessage(progressMessage, "Enter progress from 1 to 99, or mark the level completed.");
      return;
    }

    const entry = {
      id: selectedLevel.id,
      name: selectedLevel.name,
      position: selectedLevel.position,
      levelId: selectedLevel.levelId,
      verifier: selectedLevel.verifier,
      thumbnail: selectedLevel.thumbnail,
      progress: completed ? 100 : progress,
      completed: completed,
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      for (let i = 0; i < tracked.length; i++) {
        if (tracked[i].id === editingId) {
          tracked[i] = entry;
          break;
        }
      }
    } else {
      tracked.push(entry);
    }

    saveAndRender();
    dialog.close();
  });

  // Closes the progress dialog without saving.
  document.querySelector("[data-cancel-dialog]").addEventListener("click", function () {
    // Closes the dialog without saving.
    dialog.close();
  });

  renderTracked();

  for (let i = 0; i < tracked.length; i++) {
    if (!tracked[i].verifier || !tracked[i].thumbnail) {
      loadDetails(tracked[i]);
    }
  }
}
