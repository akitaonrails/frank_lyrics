# Frank Lyrics

Frank Lyrics is an experimental Chrome Manifest V3 extension for YouTube lyric practice. It injects a small control panel on YouTube watch pages, controls the page's native `<video>` element with `currentTime` and `playbackRate`, and stores timestamp markers locally per YouTube video ID.

The preferred flow is synced timestamp import from LRCLIB. If no match is available, you can add, remove, nudge, and repeat manual markers.

## Install from Releases

1. Download the latest `frank-lyrics-vX.Y.Z.zip` from GitHub Releases.
2. Unzip it to a folder you can keep, for example `Frank Lyrics/`.
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the unzipped folder.
6. Open a YouTube watch page.

Chrome cannot directly install an arbitrary extension zip outside the Chrome Web Store. For now, the release zip must be unpacked and loaded with Developer mode.

## Developer install from source

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository root containing `manifest.json`.

No package manager or build step is required.

## How to use

- **Find synced lyrics**: primary action. The extension parses the YouTube title, asks the background worker to search LRCLIB, imports only synced timestamp markers, and saves them locally for the current YouTube video ID.
- **Saved markers on reload**: locally saved markers in `chrome.storage.local` are preferred the next time that video page loads.
- **Manual markers / fine-tune**: reveals the editor for adding, removing, nudging, or loading sample markers. It opens automatically when LRCLIB has no match.
- **📍＋** or **Alt+M**: add a local marker at the current playback time.
- **⇤ 0.25s / 0.25s ⇥**: nudge all markers earlier or later to align imported timestamps with a specific upload.
- **Alt+ArrowLeft / Alt+ArrowRight**: jump to previous or next marker.
- **↻** or **Alt+R**: toggle repeat for the current segment.
- **Speed buttons**: choose `1x`, `0.9x`, `0.8x`, or `0.75x` practice speed.
- **Marker list / mini timeline**: click marker times or ticks to seek; click **×** to remove a marker.
- **Load sample**: secondary development fallback for packaged sample markers, currently documented in `data/sample-markers.json`.

All marker changes are saved to Chrome extension local storage for the specific YouTube video ID. The extension does not use `window.localStorage` on youtube.com.

## Privacy and copyright

For LRCLIB lookup, the content script derives and sends `{ track, artist, duration }` to the extension background service worker, which queries `https://lrclib.net/`. The video ID is used only for local marker storage.

LRCLIB synced lyric text is used only to parse timestamps. The background worker discards lyric text and returns marker seconds plus source metadata. The extension stores only timestamp markers locally in `chrome.storage.local` per YouTube video ID; it does not store or display lyric text.

## Current limitations

- Title parsing is heuristic and aimed at common music/anime upload titles; it will miss some videos.
- LRCLIB availability varies by song, artist spelling, and duration match.
- Imported timestamps may need nudging for uploads with intros, edits, or music-video timing differences.
- This is not packaged for the Chrome Web Store yet; releases are unpacked-extension zip files.
- The UI is intentionally small and experimental.

## Packaging

Create a release zip locally:

```sh
python3 tools/package_extension.py
```

The script reads `manifest.json`, validates manifest/data JSON, and writes `dist/frank-lyrics-v<version>.zip` containing only runtime extension files (`manifest.json`, `src/`, `data/`, `README.md`, and `LICENSE` if present).

## Release process

GitHub Actions validates JavaScript/JSON and uploads a packaged artifact on pushes and pull requests. To publish a GitHub Release artifact, push a version tag matching the manifest version, for example:

```sh
git tag v0.1.0
git push origin v0.1.0
```

You can also run the workflow manually with `release=true`.

## Experiment notes

Pure silence detection on mixed YouTube audio was not enough for reliable lyric boundaries. In the pause experiment, `ffmpeg` only found initial silence at `-25dB`, and a simple energy-valley detector produced sparse candidate regions because backing audio continues under vocals.

The stronger path is metadata lookup plus manual correction: use LRCLIB/precomputed markers first, then improve alignment by hand. Later detector work may use vocal separation and/or VAD before generating marker suggestions.

For the sample video, LRCLIB has synced LRC timing for `Hana ni Natte` by `Ryokuoushoku Shakai` with a duration close to the video, so `data/sample-markers.json` stores only timestamp markers.
