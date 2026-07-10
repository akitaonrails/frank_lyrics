#!/usr/bin/env python3
"""Fetch synced-lyric timestamps from LRCLIB and emit marker JSON.

This script intentionally discards lyric text and keeps only timestamps so the
extension can use phrase boundaries without storing copyrighted lyrics.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request


TIMESTAMP_RE = re.compile(r"^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$")


def parse_lrc_timestamps(synced_lyrics: str, keep_blank_lines: bool) -> list[float]:
    markers: list[float] = []
    for line in synced_lyrics.splitlines():
        match = TIMESTAMP_RE.match(line)
        if not match:
            continue
        payload = match.group(4).strip()
        if not payload and not keep_blank_lines:
            continue

        minutes = int(match.group(1))
        seconds = int(match.group(2))
        fraction = match.group(3) or "0"
        millis = int(fraction.ljust(3, "0")[:3])
        markers.append(round(minutes * 60 + seconds + millis / 1000, 2))

    return sorted(set(markers))


def fetch_json(url: str) -> object:
    request = urllib.request.Request(url, headers={"User-Agent": "frank-lyrics-prototype/0.1"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video-id", required=True)
    parser.add_argument("--track", required=True)
    parser.add_argument("--artist", required=True)
    parser.add_argument("--duration", type=float, default=None)
    parser.add_argument("--keep-blank-lines", action="store_true")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    query = urllib.parse.urlencode({"track_name": args.track, "artist_name": args.artist})
    url = f"https://lrclib.net/api/search?{query}"
    results = fetch_json(url)
    if not isinstance(results, list) or not results:
        print("No LRCLIB results", file=sys.stderr)
        return 1

    candidates = [item for item in results if item.get("syncedLyrics")]
    if args.duration is not None:
        candidates.sort(key=lambda item: abs(float(item.get("duration") or 0) - args.duration))

    if not candidates:
        print("No synced lyrics in LRCLIB results", file=sys.stderr)
        return 1

    chosen = candidates[0]
    markers = parse_lrc_timestamps(chosen["syncedLyrics"], args.keep_blank_lines)
    payload = {
        args.video_id: {
            "source": "LRCLIB synced lyric timestamps; lyric text intentionally discarded",
            "trackName": chosen.get("trackName"),
            "artistName": chosen.get("artistName"),
            "albumName": chosen.get("albumName"),
            "duration": chosen.get("duration"),
            "markers": markers,
        }
    }

    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        with open(args.out, "w", encoding="utf-8") as file:
            file.write(text)
    else:
        print(text, end="")

    print(f"Fetched {len(markers)} markers from LRCLIB result {chosen.get('id')}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
