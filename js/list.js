import { requireAuth } from "./Main.js";
import { getLevelDetails, getTopLevels } from "./aredl-api.js";

if (requireAuth()) {
  const listElement = document.querySelector("[data-top-level-list]");
  const statusElement = document.querySelector("[data-list-status]");
  const searchInput = document.querySelector("#top-list-search");
  const errorState = document.querySelector("[data-list-error]");
  const errorMessage = document.querySelector("[data-list-error-message]");
  let levels = [];
  let observer;

  function makeTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function loadDetails(card, level) {
    if (card.dataset.loading === "true" || card.dataset.loaded === "true") return;
    card.dataset.loading = "true";

    getLevelDetails(level)
      .then(function (details) {
        const detailNames = Object.keys(details);
        for (let i = 0; i < detailNames.length; i++) {
          const name = detailNames[i];
          level[name] = details[name];
        }

        const thumbnail = card.querySelector(".level-thumbnail");
        thumbnail.setAttribute("aria-label", `${level.name} verification video thumbnail`);

        if (level.thumbnail) {
          const placeholder = thumbnail.querySelector("span:not(.top-level-rank)");
          if (placeholder) {
            placeholder.remove();
          }
          const image = document.createElement("img");
          image.src = level.thumbnail;
          image.alt = `${level.name} verification video preview`;
          image.loading = "lazy";
          image.addEventListener("error", function () {
            image.remove();
          }, { once: true });
          thumbnail.append(image);
        } else {
          const fallback = thumbnail.querySelector("span:not(.top-level-rank)");
          if (fallback) fallback.textContent = "GD";
        }

        const facts = card.querySelector(".level-facts");
        let verifierText = "Verifier unavailable";
        if (level.verifier) {
          verifierText = "Verifier: " + level.verifier;
        }

        let victorText = "Victor count unavailable";
        if (Number.isInteger(level.victors)) {
          let word = "victors";
          if (level.victors === 1) {
            word = "victor";
          }
          victorText = level.victors + " " + word;
        }

        facts.replaceChildren(
          makeTextElement("span", "", verifierText),
          makeTextElement("span", "", victorText)
        );
        card.dataset.loaded = "true";
      })
      .catch(function () {
        card.querySelector(".level-facts").textContent = "Additional AREDL details unavailable.";
      })
      .finally(function () {
        delete card.dataset.loading;
      });
  }

  function createCard(level) {
    const card = document.createElement("article");
    card.className = "top-level-card";
    card.dataset.name = level.name.toLocaleLowerCase();
    card.dataset.levelKey = level.id;

    const thumbnail = document.createElement("div");
    thumbnail.className = "level-thumbnail level-thumbnail--list";
    thumbnail.setAttribute("aria-label", `${level.name} verification video thumbnail`);
    thumbnail.append(makeTextElement("span", "", "Loading thumbnail…"));

    const rank = makeTextElement("span", "top-level-rank", `#${level.position}`);
    thumbnail.append(rank);

    const content = document.createElement("div");
    content.className = "top-level-content";
    let idText = "In-game ID unavailable";
    if (level.levelId) {
      idText = "In-game ID " + level.levelId;
    }

    content.append(makeTextElement("h3", "top-level-name", level.name));
    content.append(makeTextElement("p", "top-level-id", idText));
    content.append(makeTextElement("div", "level-facts", "Loading verifier and victor count…"));

    const trackLink = document.createElement("a");
    trackLink.className = "button button--quiet button--small";
    trackLink.href = `tracker.html?level=${encodeURIComponent(level.name)}`;
    trackLink.textContent = "Track level";

    card.append(thumbnail, content, trackLink);
    return card;
  }

  function renderLevels() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    listElement.replaceChildren();
    const visibleLevels = [];

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const nameMatches = level.name.toLocaleLowerCase().includes(query);
      const idMatches = level.levelId.includes(query);
      if (!nameMatches && !idMatches) {
        continue;
      }

      visibleLevels.push(level);
      const card = createCard(level);
      listElement.append(card);
      observer.observe(card);
    }

    if (query) {
      statusElement.textContent = `${visibleLevels.length} of ${levels.length} levels match your search.`;
    } else {
      statusElement.textContent = `${levels.length} levels`;
    }
  }

  searchInput.addEventListener("input", renderLevels);

  // The observer loads extra details only for cards as they come near the screen.
  getTopLevels(150)
    .then(function (currentLevels) {
      levels = currentLevels;
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          let level = null;
          for (let i = 0; i < levels.length; i++) {
            if (levels[i].id === entry.target.dataset.levelKey) {
              level = levels[i];
              break;
            }
          }
          if (level) loadDetails(entry.target, level);
        });
      }, { rootMargin: "250px" });
      renderLevels();
    })
    .catch(function (error) {
      statusElement.textContent = "The current AREDL rankings could not be loaded.";
      errorMessage.textContent = error.message;
      errorState.hidden = false;
    });
}
