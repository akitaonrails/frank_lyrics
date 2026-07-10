(function () {
  "use strict";

  const PANEL_ID = "yt-lyric-practice-panel";
  const SAMPLE_URL = chrome.runtime.getURL("data/sample-markers.json");
  const SKIP_EPSILON = 0.15;

  let videoId = null;
  let markers = [];
  let repeatEnabled = false;
  let repeatTimer = null;
  let panel = null;
  let toastTimer = null;
  let findSyncedBusy = false;
  let hasStoredMarkers = false;
  let manualEditorVisible = false;
  let lastScrolledMarkerIndex = -2;

  function getVideoId() {
    return new URLSearchParams(window.location.search).get("v");
  }

  function storageKey(id) {
    return `yt-lyric-practice:markers:${id}`;
  }

  function getVideo() {
    return document.querySelector("video");
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "--:--";
    const minutes = Math.floor(seconds / 60);
    const rest = (seconds - minutes * 60).toFixed(2).padStart(5, "0");
    return `${minutes}:${rest}`;
  }

  function normalizeMarkers(values) {
    return Array.from(new Set(values.map(Number).filter(Number.isFinite)))
      .sort((a, b) => a - b)
      .map((value) => Math.max(0, Math.round(value * 100) / 100));
  }

  async function loadSampleMarkers(id) {
    try {
      const response = await fetch(SAMPLE_URL);
      const samples = await response.json();
      return normalizeMarkers(samples[id]?.markers || []);
    } catch (error) {
      console.warn("Lyric practice: failed to load sample markers", error);
      return [];
    }
  }

  async function loadMarkers(id) {
    if (!id) return { markers: [], fromStorage: false };
    const key = storageKey(id);
    const stored = await chrome.storage.local.get(key);
    if (Array.isArray(stored[key])) {
      return { markers: normalizeMarkers(stored[key]), fromStorage: true };
    }
    return { markers: [], fromStorage: false };
  }

  async function saveMarkers() {
    if (!videoId) return;
    await chrome.storage.local.set({ [storageKey(videoId)]: markers });
    hasStoredMarkers = true;
  }

  async function loadPackagedSampleMarkers() {
    if (!videoId) return;
    const sampleMarkers = await loadSampleMarkers(videoId);
    if (!sampleMarkers.length) {
      showToast("No packaged sample markers for this video");
      return;
    }
    markers = sampleMarkers;
    await saveMarkers();
    manualEditorVisible = true;
    lastScrolledMarkerIndex = -2;
    updatePanel();
    showToast(`Loaded ${markers.length} sample markers`);
  }

  function revealManualEditor(message) {
    manualEditorVisible = true;
    lastScrolledMarkerIndex = -2;
    updatePanel();
    if (message) showToast(message);
  }

  function getYouTubeTitle() {
    return document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim()
      || document.querySelector("h1.title yt-formatted-string")?.textContent?.trim()
      || document.title;
  }

  function getYouTubeDescription() {
    return document.querySelector('meta[name="description"]')?.content?.trim()
      || document.querySelector('meta[property="og:description"]')?.content?.trim()
      || "";
  }

  async function findSyncedMarkers() {
    if (findSyncedBusy) return;
    const video = getVideo();
    if (!videoId || !video) {
      showToast("Open a YouTube watch page first");
      return;
    }

    const rawTitle = getYouTubeTitle();
    const rawDescription = getYouTubeDescription();
    const parsed = FrankLyricsMetadata.parseVideoMetadata(rawTitle, rawDescription);
    if (!parsed.track) {
      manualEditorVisible = true;
      updatePanel();
      showToast("Could not parse track from title/description");
      return;
    }

    findSyncedBusy = true;
    updatePanel();
    showToast(`Searching LRCLIB for ${parsed.track}…`);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "findSyncedMarkers",
        videoId,
        track: parsed.track,
        artist: parsed.artist,
        duration: Number.isFinite(video.duration) ? video.duration : null,
        context: `${rawTitle}\n${rawDescription}`
      });

      if (!response?.ok || !Array.isArray(response.markers) || response.markers.length === 0) {
        manualEditorVisible = true;
        updatePanel();
        showToast(response?.message || "No synced LRCLIB markers found");
        return;
      }

      markers = normalizeMarkers(response.markers);
      await saveMarkers();
      manualEditorVisible = true;
      lastScrolledMarkerIndex = -2;
      updatePanel();
      const source = response.source?.artistName ? ` from LRCLIB (${response.source.artistName})` : " from LRCLIB";
      showToast(`Loaded ${markers.length} synced markers${source}`);
    } catch (error) {
      console.warn("Lyric practice: synced marker import failed", error);
      manualEditorVisible = true;
      showToast("LRCLIB lookup failed; existing markers kept");
    } finally {
      findSyncedBusy = false;
      updatePanel();
    }
  }

  function currentMarkerIndex(time) {
    let index = -1;
    for (let i = 0; i < markers.length; i += 1) {
      if (markers[i] <= time + SKIP_EPSILON) index = i;
      else break;
    }
    return index;
  }

  function currentSegment(video) {
    if (!video || markers.length === 0) return null;
    const index = Math.max(0, currentMarkerIndex(video.currentTime));
    const start = markers[index] ?? 0;
    const end = markers[index + 1] ?? video.duration;
    return { index, start, end };
  }

  function jumpToMarker(direction) {
    const video = getVideo();
    if (!video || markers.length === 0) return;
    const now = video.currentTime;
    const index = currentMarkerIndex(now);
    const targetIndex = direction < 0
      ? Math.max(0, now - (markers[index] ?? 0) > 0.75 ? index : index - 1)
      : Math.min(markers.length - 1, index + 1);
    video.currentTime = markers[targetIndex];
    updatePanel();
  }

  function seekToMarker(index) {
    const video = getVideo();
    if (!video || !Number.isFinite(markers[index])) return;
    video.currentTime = markers[index];
    updatePanel();
  }

  async function removeMarker(index) {
    if (!Number.isFinite(markers[index])) return;
    markers = markers.filter((_, markerIndex) => markerIndex !== index);
    await saveMarkers();
    lastScrolledMarkerIndex = -2;
    updatePanel();
  }

  async function shiftMarkers(delta) {
    if (!markers.length) {
      showToast("No markers to nudge");
      return;
    }
    markers = normalizeMarkers(markers.map((marker) => marker + delta));
    await saveMarkers();
    lastScrolledMarkerIndex = -2;
    updatePanel();
    showToast(`Markers nudged ${delta > 0 ? "+" : ""}${delta.toFixed(2)}s`);
  }

  function showToast(message) {
    if (!panel) return;
    const toast = panel.querySelector(".yt-lyric-practice-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add("is-visible");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      toast.hidden = true;
    }, 1800);
  }

  async function addMarker() {
    const video = getVideo();
    if (!video) return;
    manualEditorVisible = true;
    const markerTime = Math.round(video.currentTime * 100) / 100;
    markers = normalizeMarkers([...markers, video.currentTime]);
    await saveMarkers();
    lastScrolledMarkerIndex = -2;
    updatePanel();
    showToast(`Marker added at ${formatTime(markerTime)}`);
  }

  function scrollActiveMarkerIntoView(markerList, activeIndex) {
    if (!markerList || activeIndex < 0) return;
    if (markerList.offsetParent === null) return;

    const activeItem = markerList.querySelector(`[data-marker-index="${activeIndex}"]`);
    if (!activeItem) return;

    const listRect = markerList.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    if (listRect.height <= 0 || itemRect.height <= 0) return;

    const padding = 6;
    const isVisible = itemRect.top >= listRect.top + padding
      && itemRect.bottom <= listRect.bottom - padding;

    if (activeIndex === lastScrolledMarkerIndex && isVisible) return;

    if (activeIndex !== lastScrolledMarkerIndex) {
      const itemCenter = itemRect.top + itemRect.height / 2;
      const listCenter = listRect.top + listRect.height / 2;
      markerList.scrollTop += itemCenter - listCenter;
    } else if (itemRect.top < listRect.top + padding) {
      markerList.scrollTop -= (listRect.top + padding) - itemRect.top;
    } else if (itemRect.bottom > listRect.bottom - padding) {
      markerList.scrollTop += itemRect.bottom - (listRect.bottom - padding);
    }

    lastScrolledMarkerIndex = activeIndex;
  }

  function setPlaybackRate(rate) {
    const video = getVideo();
    if (!video) return;
    video.playbackRate = rate;
    updatePanel();
  }

  function toggleRepeat() {
    repeatEnabled = !repeatEnabled;
    updateRepeatLoop();
    updatePanel();
  }

  function updateRepeatLoop() {
    if (repeatTimer) {
      window.clearInterval(repeatTimer);
      repeatTimer = null;
    }
    if (!repeatEnabled) return;
    repeatTimer = window.setInterval(() => {
      const video = getVideo();
      const segment = currentSegment(video);
      if (!video || !segment || !Number.isFinite(segment.end)) return;
      if (video.currentTime >= segment.end - 0.03) {
        video.currentTime = segment.start;
        video.play().catch(() => {});
      }
    }, 80);
  }

  function updatePanel() {
    if (!panel) return;
    const video = getVideo();
    const segment = currentSegment(video);
    const status = panel.querySelector(".yt-lyric-practice-status");
    const repeatButton = panel.querySelector("[data-action='repeat']");
    const rateButtons = panel.querySelectorAll("[data-action='rate']");
    const markerList = panel.querySelector(".yt-lyric-practice-markers");
    const timeline = panel.querySelector(".yt-lyric-practice-timeline");
    const markerCount = panel.querySelector(".yt-lyric-practice-marker-count");
    const findSyncedButton = panel.querySelector("[data-action='find-synced']");
    const manualSection = panel.querySelector(".yt-lyric-practice-manual");
    const manualToggle = panel.querySelector("[data-action='manual']");
    const sourceBadge = panel.querySelector(".yt-lyric-practice-source");
    const activeIndex = video ? currentMarkerIndex(video.currentTime) : -1;
    const duration = video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;

    if (!videoId) {
      status.textContent = "Open a YouTube watch page.";
    } else if (!hasStoredMarkers && markers.length === 0) {
      status.textContent = "No markers yet. Try synced lookup first.";
    } else {
      const prefix = hasStoredMarkers ? "Saved locally" : "Current markers";
      status.textContent = `${prefix} · ${markers.length} markers · ${segment ? `${formatTime(segment.start)} → ${formatTime(segment.end)}` : "no active segment"}`;
    }
    if (sourceBadge) {
      sourceBadge.textContent = hasStoredMarkers && markers.length ? "Local saved" : "LRCLIB first";
    }
    if (repeatButton) repeatButton.setAttribute("aria-pressed", String(repeatEnabled));
    rateButtons.forEach((button) => {
      const rate = Number(button.dataset.rate);
      const isActive = video && Math.abs(video.playbackRate - rate) < 0.01;
      button.setAttribute("aria-pressed", String(Boolean(isActive)));
    });

    if (markerCount) markerCount.textContent = `${markers.length}`;
    if (findSyncedButton) {
      findSyncedButton.disabled = findSyncedBusy;
      findSyncedButton.classList.toggle("is-searching", findSyncedBusy);
      findSyncedButton.setAttribute("aria-busy", String(findSyncedBusy));
      findSyncedButton.innerHTML = findSyncedBusy
        ? '<span class="yt-lyric-practice-spinner" aria-hidden="true"></span><span>Searching LRCLIB…</span>'
        : "Find synced lyrics";
    }
    if (manualSection) manualSection.hidden = !manualEditorVisible;
    if (manualToggle) manualToggle.hidden = manualEditorVisible;
    if (markerList) {
      const markerListKey = markers.join("|");
      const nextMarkerListHtml = markers.length
        ? markers.map((marker, index) => `
          <li data-marker-index="${index}">
            <button type="button" class="yt-lyric-practice-marker-jump" data-action="seek" data-index="${index}" title="Seek to ${formatTime(marker)}" aria-label="Seek to marker at ${formatTime(marker)}">
              <span class="yt-lyric-practice-marker-dot"></span>
              <span>${formatTime(marker)}</span>
            </button>
            <button type="button" class="yt-lyric-practice-marker-remove" data-action="remove" data-index="${index}" title="Remove marker at ${formatTime(marker)}" aria-label="Remove marker at ${formatTime(marker)}">×</button>
          </li>
        `).join("")
        : `<li class="yt-lyric-practice-empty">No markers yet. Press Alt+M or + Marker.</li>`;
      if (markerList.dataset.markerListKey !== markerListKey) {
        markerList.innerHTML = nextMarkerListHtml;
        markerList.dataset.markerListKey = markerListKey;
      }
      markerList.querySelectorAll("[data-marker-index]").forEach((item) => {
        const isActive = Number(item.dataset.markerIndex) === activeIndex;
        item.classList.toggle("is-active", isActive);
        if (isActive) item.setAttribute("aria-current", "true");
        else item.removeAttribute("aria-current");
      });
      window.requestAnimationFrame(() => scrollActiveMarkerIntoView(markerList, activeIndex));
    }
    if (timeline) {
      timeline.innerHTML = markers.length && duration
        ? markers.map((marker, index) => {
          const left = Math.max(0, Math.min(100, (marker / duration) * 100));
          return `<button type="button" class="yt-lyric-practice-tick ${index === activeIndex ? "is-active" : ""}" data-action="seek" data-index="${index}" style="left: ${left}%" title="${formatTime(marker)}"></button>`;
        }).join("")
        : "";
      timeline.setAttribute("aria-label", markers.length ? "Marker timeline" : "No marker timeline yet");
    }
  }

  function buildPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();

    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "yt-lyric-practice-panel";
    panel.innerHTML = `
      <div class="yt-lyric-practice-title">
        <span>Lyric Practice</span>
        <span class="yt-lyric-practice-source">LRCLIB first</span>
        <button type="button" data-action="close" title="Hide panel">×</button>
      </div>
      <div class="yt-lyric-practice-status">Loading markers…</div>
      <div class="yt-lyric-practice-primary">
        <button type="button" data-action="find-synced" title="Search LRCLIB and save timestamp markers for this video">Find synced lyrics</button>
      </div>
      <div class="yt-lyric-practice-toast" hidden></div>
      <button type="button" class="yt-lyric-practice-manual-toggle" data-action="manual">Manual markers / fine-tune</button>
      <div class="yt-lyric-practice-manual" hidden>
      <div class="yt-lyric-practice-manual-note">Edit only when synced lookup misses or timing needs a small shift.</div>
      <div class="yt-lyric-practice-row yt-lyric-practice-icon-row">
        <button type="button" data-action="prev" aria-label="Previous marker" title="Jump to previous marker">◀</button>
        <button type="button" data-action="next" aria-label="Next marker" title="Jump to next marker">▶</button>
      </div>
      <div class="yt-lyric-practice-row yt-lyric-practice-icon-row">
        <button type="button" data-action="repeat" aria-label="Repeat current segment" title="Repeat current segment (Alt+R)" aria-pressed="false">↻</button>
        <button type="button" data-action="add" aria-label="Add marker" title="Add marker at current time (Alt+M)">📍＋</button>
      </div>
      <div class="yt-lyric-practice-row yt-lyric-practice-speed-row" aria-label="Playback speed">
        <button type="button" data-action="rate" data-rate="1" aria-label="Set speed to 1x" title="Normal speed" aria-pressed="false">1×</button>
        <button type="button" data-action="rate" data-rate="0.9" aria-label="Set speed to 0.9x" title="Practice speed: 0.9x" aria-pressed="false">.9×</button>
        <button type="button" data-action="rate" data-rate="0.8" aria-label="Set speed to 0.8x" title="Practice speed: 0.8x" aria-pressed="false">.8×</button>
        <button type="button" data-action="rate" data-rate="0.75" aria-label="Set speed to 0.75x" title="Slow practice speed: 0.75x" aria-pressed="false">.75×</button>
      </div>
      <div class="yt-lyric-practice-row yt-lyric-practice-nudge-row">
        <button type="button" data-action="nudge-back" aria-label="Nudge all markers 0.25 seconds earlier" title="Move all markers 0.25 seconds earlier"><span>⇤</span><small>0.25s</small></button>
        <button type="button" data-action="nudge-forward" aria-label="Nudge all markers 0.25 seconds later" title="Move all markers 0.25 seconds later"><small>0.25s</small><span>⇥</span></button>
      </div>
      <div class="yt-lyric-practice-marker-head">
        <span>Markers <b class="yt-lyric-practice-marker-count">0</b></span>
        <button type="button" data-action="sample" title="Replace local markers with packaged sample markers">Load sample</button>
      </div>
      <div class="yt-lyric-practice-timeline" aria-label="Marker timeline"></div>
      <ol class="yt-lyric-practice-markers"></ol>
      <div class="yt-lyric-practice-help">Alt+←/→ jump · Alt+R repeat · Alt+M marker</div>
      </div>
    `;

    panel.addEventListener("click", (event) => {
      const control = event.target.closest("[data-action]");
      if (!control || !panel.contains(control)) return;
      const action = control.dataset.action;
      const index = Number(control.dataset.index);
      if (action === "prev") jumpToMarker(-1);
      if (action === "next") jumpToMarker(1);
      if (action === "repeat") toggleRepeat();
      if (action === "add") void addMarker();
      if (action === "find-synced") void findSyncedMarkers();
      if (action === "manual") revealManualEditor("Manual marker editor opened");
      if (action === "nudge-back") void shiftMarkers(-0.25);
      if (action === "nudge-forward") void shiftMarkers(0.25);
      if (action === "sample") void loadPackagedSampleMarkers();
      if (action === "seek") seekToMarker(index);
      if (action === "remove") void removeMarker(index);
      if (action === "rate") {
        const rate = Number(control.dataset.rate);
        if (Number.isFinite(rate)) setPlaybackRate(rate);
      }
      if (action === "close") panel.remove();
    });

    document.documentElement.appendChild(panel);
    updatePanel();
  }

  function handleKeys(event) {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      jumpToMarker(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      jumpToMarker(1);
    } else if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      toggleRepeat();
    } else if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      void addMarker();
    }
  }

  async function initForPage() {
    const nextVideoId = getVideoId();
    if (!nextVideoId) return;
    videoId = nextVideoId;
    const loaded = await loadMarkers(videoId);
    markers = loaded.markers;
    hasStoredMarkers = loaded.fromStorage;
    manualEditorVisible = hasStoredMarkers;
    lastScrolledMarkerIndex = -2;
    buildPanel();
    updateRepeatLoop();
    if (hasStoredMarkers) showToast(`Loaded ${markers.length} local markers`);
  }

  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      void initForPage();
    }
  });

  document.addEventListener("keydown", handleKeys, true);
  window.setInterval(updatePanel, 500);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  void initForPage();
})();
