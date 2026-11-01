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
      .then((details) => {
        Object.assign(level, details);
        const thumbnail = card.querySelector(".level-thumbnail");
        thumbnail.setAttribute("aria-label", `${level.name} verification video thumbnail`);

        if (level.thumbnail) {
          thumbnail.querySelector("span:not(.top-level-rank)")?.remove();
          const image = document.createElement("img");
          image.src = level.thumbnail;
          image.alt = `${level.name} verification video preview`;
          image.loading = "lazy";
          image.addEventListener("error", () => image.remove(), { once: true });
          thumbnail.append(image);
        } else {
          const fallback = thumbnail.querySelector("span:not(.top-level-rank)");
          if (fallback) fallback.textContent = "GD";
        }

        const facts = card.querySelector(".level-facts");
        facts.replaceChildren(
          makeTextElement("span", "", level.verifier ? `Verifier: ${level.verifier}` : "Verifier unavailable"),
          makeTextElement("span", "", Number.isInteger(level.victors)
            ? `${level.victors} ${level.victors === 1 ? "victor" : "victors"}`
            : "Victor count unavailable")
        );
        card.dataset.loaded = "true";
      })
      .catch(() => {
        card.querySelector(".level-facts").textContent = "Additional AREDL details unavailable.";
      })
      .finally(() => {
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
    content.append(
      makeTextElement("h3", "top-level-name", level.name),
      makeTextElement("p", "top-level-id", level.levelId ? `In-game ID ${level.levelId}` : "In-game ID unavailable"),
      makeTextElement("div", "level-facts", "Loading verifier and victor count…")
    );

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
    const visibleLevels = levels.filter((level) =>
      level.name.toLocaleLowerCase().includes(query) || level.levelId.includes(query)
    );

    visibleLevels.forEach((level) => {
      const card = createCard(level);
      listElement.append(card);
      observer.observe(card);
    });

    statusElement.textContent = query
      ? `${visibleLevels.length} of ${levels.length} levels match your search.`
      : `${levels.length} levels`;
  }

  searchInput.addEventListener("input", renderLevels);

  getTopLevels(150)
    .then((currentLevels) => {
      levels = currentLevels;
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          const level = levels.find((item) => item.id === entry.target.dataset.levelKey);
          if (level) loadDetails(entry.target, level);
        });
      }, { rootMargin: "250px" });
      renderLevels();
    })
    .catch((error) => {
      statusElement.textContent = "The current AREDL rankings could not be loaded.";
      errorMessage.textContent = error.message;
      errorState.hidden = false;
    });
}
