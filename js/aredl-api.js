const LEVELS_URL = "https://api.aredl.net/v2/api/aredl/levels";
let levelsCache;
const detailsCache = new Map();

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The AREDL API returned an error (${response.status}).`);
  }
  return response.json();
}

function getVideoThumbnail(videoUrl) {
  if (!videoUrl) return null;

  try {
    const url = new URL(videoUrl);
    let videoId = url.searchParams.get("v");
    if (url.hostname === "youtu.be") {
      videoId = url.pathname.slice(1);
    }

    if (!videoId) return null;
    return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
  } catch {
    return null;
  }
}

async function loadLevels() {
  if (levelsCache) return levelsCache;

  const levels = await fetchJson(LEVELS_URL);
  if (!Array.isArray(levels)) {
    throw new Error("The AREDL API returned an unexpected response.");
  }

  levelsCache = [];
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    let name = "Unknown level";
    if (level.name != null) {
      name = String(level.name);
    }

    let levelId = "";
    if (level.level_id !== null && level.level_id !== undefined) {
      levelId = String(level.level_id);
    }

    levelsCache.push({
      id: String(level.id),
      name: name,
      position: Number(level.position) || 0,
      levelId: levelId,
    });
  }
  return levelsCache;
}

export function getLevelDetails(level) {
  if (detailsCache.has(level.id)) return detailsCache.get(level.id);

  const levelUrl = LEVELS_URL + "/" + encodeURIComponent(level.id);
  // Both API requests can run at the same time because they do not depend on each other.
  const request = Promise.all([
    fetchJson(levelUrl),
    fetchJson(levelUrl + "/records"),
  ]).then(function (responses) {
    const details = responses[0];
    const records = responses[1];
    let verification = null;

    if (Array.isArray(details.verifications)) {
      for (let i = 0; i < details.verifications.length; i++) {
        if (details.verifications[i].submitted_by) {
          verification = details.verifications[i];
          break;
        }
      }
    }

    let verifiedVideo = null;
    if (verification && !verification.hide_video) {
      verifiedVideo = verification.video_url;
    }

    let thumbnail = details.thumbnail_url;
    if (thumbnail == null) {
      thumbnail = details.thumbnail;
    }
    if (thumbnail == null) {
      thumbnail = getVideoThumbnail(verifiedVideo);
    }

    let verifier = null;
    if (verification && verification.submitted_by) {
      verifier = verification.submitted_by.global_name;
      if (verifier == null) {
        verifier = verification.submitted_by.username;
      }
    }

    let safeThumbnail = null;
    if (typeof thumbnail === "string") {
      safeThumbnail = thumbnail;
    }

    let victorCount = null;
    if (Number.isInteger(records.count)) {
      victorCount = records.count;
    }

    return {
      verifier: verifier,
      thumbnail: safeThumbnail,
      victors: victorCount,
    };
  });

  // Keep the request itself so other pages can reuse it while it is still running.
  detailsCache.set(level.id, request);
  request.catch(function () {
    detailsCache.delete(level.id);
  });
  return request;
}

export async function searchLevels(query, limit = 30) {
  const needle = query.trim().toLocaleLowerCase();
  const resultLimit = Math.floor(limit);
  if (!needle || !(resultLimit > 0)) return [];

  const levels = await loadLevels();
  const results = [];

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const nameMatches = level.name.toLocaleLowerCase().includes(needle);
    const idMatches = level.levelId.includes(needle);

    if (nameMatches || idMatches) {
      results.push(level);
      if (results.length >= resultLimit) {
        break;
      }
    }
  }

  return results;
}

export async function getTopLevels(limit = 150) {
  const levels = await loadLevels();
  const topLevels = [];

  for (let i = 0; i < levels.length; i++) {
    if (levels[i].position > 0 && levels[i].position <= limit) {
      topLevels.push(levels[i]);
    }
  }

  topLevels.sort(function (levelA, levelB) {
    return levelA.position - levelB.position;
  });
  return topLevels;
}
