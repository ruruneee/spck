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
    const videoId = url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : url.searchParams.get("v");
    return videoId ? `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` : null;
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

  levelsCache = levels.map((level) => ({
    id: String(level.id),
    name: String(level.name ?? "Unknown level"),
    position: Number(level.position) || 0,
    levelId: level.level_id == null ? "" : String(level.level_id)
  }));
  return levelsCache;
}

export function getLevelDetails(level) {
  if (detailsCache.has(level.id)) return detailsCache.get(level.id);

  const request = Promise.all([
    fetchJson(`${LEVELS_URL}/${encodeURIComponent(level.id)}`),
    fetchJson(`${LEVELS_URL}/${encodeURIComponent(level.id)}/records`)
  ]).then(([details, records]) => {
    const verification = details.verifications?.find((item) => item.submitted_by);
    const verifiedVideo = verification && !verification.hide_video ? verification.video_url : null;
    const thumbnail = details.thumbnail_url ?? details.thumbnail ?? getVideoThumbnail(verifiedVideo);

    return {
      verifier: verification?.submitted_by?.global_name
        ?? verification?.submitted_by?.username
        ?? null,
      thumbnail: typeof thumbnail === "string" ? thumbnail : null,
      victors: Number.isInteger(records.count) ? records.count : null
    };
  });

  detailsCache.set(level.id, request);
  request.catch(() => detailsCache.delete(level.id));
  return request;
}

export async function searchLevels(query, limit = 30) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];

  const levels = await loadLevels();
  return levels
    .filter((level) => level.name.toLocaleLowerCase().includes(needle) || level.levelId.includes(needle))
    .slice(0, limit);
}

export async function getTopLevels(limit = 150) {
  const levels = await loadLevels();
  return levels
    .filter((level) => level.position > 0 && level.position <= limit)
    .sort((a, b) => a.position - b.position);
}
