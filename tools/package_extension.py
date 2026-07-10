#!/usr/bin/env python3
"""Package the unpacked Chrome extension into a release zip.

The project intentionally has no build step. This script copies only runtime
extension files into dist/frank-lyrics-v<manifest.version>.zip.
"""

from __future__ import annotations

import argparse
import json
import zipfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
INCLUDE_FILES = ["manifest.json", "README.md"]
INCLUDE_DIRS = ["src", "data"]
LICENSE_NAMES = ["LICENSE", "LICENSE.md", "LICENSE.txt"]


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_json_object(path: Path) -> dict[str, Any]:
    value = read_json(path)
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object in {path.relative_to(ROOT)}")
    return value


def collect_files() -> list[Path]:
    files: list[Path] = []

    for name in INCLUDE_FILES:
        path = ROOT / name
        if path.is_file():
            files.append(path)

    for name in LICENSE_NAMES:
        path = ROOT / name
        if path.is_file():
            files.append(path)
            break

    for directory_name in INCLUDE_DIRS:
        directory = ROOT / directory_name
        if not directory.is_dir():
            continue
        files.extend(path for path in directory.rglob("*") if path.is_file())

    return sorted(files, key=lambda path: path.relative_to(ROOT).as_posix())


def validate_json_files() -> None:
    read_json_object(ROOT / "manifest.json")
    data_dir = ROOT / "data"
    if data_dir.is_dir():
        for path in data_dir.rglob("*.json"):
            read_json(path)


def package_extension() -> Path:
    manifest = read_json_object(ROOT / "manifest.json")
    version = str(manifest["version"])

    DIST.mkdir(exist_ok=True)
    zip_path = DIST / f"frank-lyrics-v{version}.zip"
    if zip_path.exists():
        zip_path.unlink()

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in collect_files():
            archive.write(path, path.relative_to(ROOT).as_posix())

    return zip_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Package the Frank Lyrics Chrome extension")
    parser.add_argument("--skip-json-validation", action="store_true")
    args = parser.parse_args()

    if not args.skip_json_validation:
        validate_json_files()

    zip_path = package_extension()
    print(zip_path.relative_to(ROOT))


if __name__ == "__main__":
    main()
