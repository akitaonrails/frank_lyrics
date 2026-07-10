#!/usr/bin/env python3
"""Quick pause-boundary experiment for a YouTube music-video audio clip.

This intentionally uses only the Python standard library + NumPy so the
experiment is portable. It detects *energy valleys*, not true lyric/vocal
pauses. For songs with continuous backing tracks, that distinction matters.
"""

from __future__ import annotations

import argparse
import wave
from dataclasses import dataclass

import numpy as np


@dataclass
class Region:
    start: float
    end: float
    min_db: float
    avg_db: float

    @property
    def duration(self) -> float:
        return self.end - self.start


def read_wav_mono(path: str) -> tuple[np.ndarray, int]:
    with wave.open(path, "rb") as wf:
        channels = wf.getnchannels()
        rate = wf.getframerate()
        width = wf.getsampwidth()
        frames = wf.getnframes()
        raw = wf.readframes(frames)

    if width != 2:
        raise SystemExit(f"Expected 16-bit PCM WAV; got sample width {width}")

    audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)
    return audio, rate


def frame_db(audio: np.ndarray, rate: int, frame_ms: int, hop_ms: int) -> tuple[np.ndarray, np.ndarray]:
    frame = int(rate * frame_ms / 1000)
    hop = int(rate * hop_ms / 1000)
    if len(audio) < frame:
        raise SystemExit("Audio too short")
    count = 1 + (len(audio) - frame) // hop
    shape = (count, frame)
    strides = (audio.strides[0] * hop, audio.strides[0])
    windows = np.lib.stride_tricks.as_strided(audio, shape=shape, strides=strides)
    rms = np.sqrt(np.mean(windows * windows, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    times = (np.arange(count) * hop + frame / 2) / rate
    return times, db


def smooth(values: np.ndarray, frames: int) -> np.ndarray:
    kernel = np.ones(frames, dtype=np.float32) / frames
    return np.convolve(values, kernel, mode="same")


def detect_regions(times: np.ndarray, db: np.ndarray, threshold: float, min_ms: int, pad_ms: int) -> list[Region]:
    below = db < threshold
    hop = float(np.median(np.diff(times))) if len(times) > 1 else 0.01
    min_frames = max(1, int((min_ms / 1000) / hop))
    pad_frames = max(0, int((pad_ms / 1000) / hop))
    regions: list[Region] = []

    i = 0
    while i < len(below):
        if not below[i]:
            i += 1
            continue
        j = i
        while j < len(below) and below[j]:
            j += 1
        if j - i >= min_frames:
            a = max(0, i - pad_frames)
            b = min(len(times) - 1, j + pad_frames)
            segment = db[i:j]
            regions.append(Region(float(times[a]), float(times[b]), float(segment.min()), float(segment.mean())))
        i = j
    return regions


def format_time(seconds: float) -> str:
    m = int(seconds // 60)
    s = seconds - 60 * m
    return f"{m:02d}:{s:05.2f}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("wav")
    parser.add_argument("--frame-ms", type=int, default=40)
    parser.add_argument("--hop-ms", type=int, default=10)
    parser.add_argument("--smooth-ms", type=int, default=120)
    parser.add_argument("--min-ms", type=int, default=120)
    parser.add_argument("--pad-ms", type=int, default=40)
    parser.add_argument("--threshold-db", type=float, default=None)
    args = parser.parse_args()

    audio, rate = read_wav_mono(args.wav)
    times, db = frame_db(audio, rate, args.frame_ms, args.hop_ms)
    smooth_frames = max(1, args.smooth_ms // args.hop_ms)
    db_s = smooth(db, smooth_frames)

    p10, p20, p50, p90 = np.percentile(db_s, [10, 20, 50, 90])
    threshold = args.threshold_db if args.threshold_db is not None else min(p20 + 1.5, p50 - 5.0)
    regions = detect_regions(times, db_s, threshold, args.min_ms, args.pad_ms)

    print(f"file={args.wav}")
    print(f"duration={len(audio)/rate:.2f}s rate={rate}Hz")
    print(f"energy_db percentiles: p10={p10:.1f} p20={p20:.1f} p50={p50:.1f} p90={p90:.1f}")
    print(f"threshold={threshold:.1f}dB min_pause={args.min_ms}ms")
    print("candidate_pause_regions:")
    for idx, r in enumerate(regions[:80], 1):
        print(
            f"{idx:02d} {format_time(r.start)}-{format_time(r.end)} "
            f"dur={r.duration:.2f}s min={r.min_db:.1f} avg={r.avg_db:.1f}"
        )

    starts = [r.start for r in regions if r.start > 0.25]
    print("\nbookmark_boundaries_seconds:")
    print(", ".join(f"{x:.2f}" for x in starts[:120]))


if __name__ == "__main__":
    main()
