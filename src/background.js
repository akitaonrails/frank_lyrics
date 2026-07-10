"use strict";

const LRCLIB_SEARCH_URL = "https://lrclib.net/api/search";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function textMatchScore(query, candidate) {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.includes(q) || q.includes(c)) return 0.82;

  const qTokens = new Set(q.split(" "));
  const cTokens = new Set(c.split(" "));
  let overlap = 0;
  for (const token of qTokens) {
    if (cTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(qTokens.size, cTokens.size, 1);
}

function parseLrcTimestamps(syncedLyrics) {
  const seconds = [];
  const linePattern = /^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/;

  for (const line of String(syncedLyrics || "").split(/\r?\n/)) {
    const match = linePattern.exec(line);
    if (!match || !match[4].trim()) continue;

    const minutes = Number(match[1]);
    const secs = Number(match[2]);
    const fraction = match[3] ? Number(`0.${match[3].padEnd(3, "0")}`) : 0;
    const total = minutes * 60 + secs + fraction;
    if (Number.isFinite(total)) seconds.push(Math.round(total * 100) / 100);
  }

  return Array.from(new Set(seconds)).sort((a, b) => a - b);
}

function rankCandidate(candidate, request) {
  if (!candidate?.syncedLyrics) return null;

  const markers = parseLrcTimestamps(candidate.syncedLyrics);
  if (markers.length < 2) return null;

  const trackScore = textMatchScore(request.track, candidate.trackName || candidate.name);
  if (trackScore < 0.35) return null;

  const hasArtist = Boolean(normalizeText(request.artist));
  const artistScore = textMatchScore(request.artist, candidate.artistName);
  if (hasArtist && artistScore < 0.25) return null;

  const contextScore = textMatchScore(
    request.context,
    `${candidate.trackName || candidate.name || ""} ${candidate.artistName || ""} ${candidate.albumName || ""}`
  );

  const candidateDuration = Number(candidate.duration);
  const requestDuration = Number(request.duration);
  const durationDiff = Number.isFinite(candidateDuration) && Number.isFinite(requestDuration)
    ? Math.abs(candidateDuration - requestDuration)
    : 999;
  const durationScore = Math.max(0, 1 - durationDiff / 30);
  const score = trackScore * 4
    + (hasArtist ? artistScore * 3 : 0)
    + contextScore * 2
    + durationScore * 2
    - durationDiff / 120;

  return { candidate, markers, score, durationDiff, trackScore, artistScore, contextScore };
}

async function findSyncedMarkers(request) {
  if (!request.track) {
    return { ok: false, message: "Could not parse song title" };
  }

  const searches = [];
  if (request.artist) {
    searches.push(new URLSearchParams({ track_name: request.track, artist_name: request.artist }));
    searches.push(new URLSearchParams({ q: `${request.track} ${request.artist}` }));
  }
  searches.push(new URLSearchParams({ q: `${request.track} ${request.context || ""}`.slice(0, 220) }));
  searches.push(new URLSearchParams({ track_name: request.track }));

  const resultsById = new Map();
  for (const params of searches) {
    const response = await fetch(`${LRCLIB_SEARCH_URL}?${params.toString()}`, {
    headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`LRCLIB search failed (${response.status})`);
    }

    const results = await response.json();
    for (const result of Array.isArray(results) ? results : []) {
      resultsById.set(result.id ?? `${result.trackName}-${result.artistName}-${result.duration}`, result);
    }
  }

  const ranked = Array.from(resultsById.values())
    .map((candidate) => rankCandidate(candidate, request))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return { ok: false, message: "No synced LRCLIB match found" };
  }

  const best = ranked[0];
  return {
    ok: true,
    markers: best.markers,
    source: {
      provider: "LRCLIB",
      id: best.candidate.id,
      trackName: best.candidate.trackName || best.candidate.name || "",
      artistName: best.candidate.artistName || "",
      albumName: best.candidate.albumName || "",
      duration: best.candidate.duration,
      durationDiff: Math.round(best.durationDiff * 100) / 100
    }
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "findSyncedMarkers") return false;

  findSyncedMarkers(message)
    .then(sendResponse)
    .catch((error) => {
      console.warn("Lyric practice: LRCLIB lookup failed", error);
      sendResponse({ ok: false, message: error.message || "LRCLIB lookup failed" });
    });

  return true;
});
