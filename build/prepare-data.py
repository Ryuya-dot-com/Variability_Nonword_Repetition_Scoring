#!/usr/bin/env python3
"""Prepare data manifest and audio symlinks for Nonword Repetition scorer."""
from __future__ import annotations

import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from openpyxl import load_workbook

APP_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = APP_ROOT.parent
DATA_DIR = APP_ROOT / "data"
AUDIO_DIR = DATA_DIR / "audio"

IMMEDIATE_SRC = PROJECT_ROOT / "Analysis" / "BehavioralData" / "ImmediateData" / "NonwordRepetition"
DELAYED_SRC = PROJECT_ROOT / "Analysis" / "BehavioralData" / "DelayedData" / "NonwordRepetition"
SCORES_XLSX = PROJECT_ROOT / "Analysis" / "BehavioralData" / "NonwordRepetition.xlsx"
MANIFEST_PATH = DATA_DIR / "participants.json"

DIR_PATTERN = re.compile(r"^(\d+)_")
SLIDE_PATTERN = re.compile(r"_slide(\d+)\.wav$", re.IGNORECASE)


def normalize_pid(raw: object) -> str:
    text = str(raw).strip()
    if text.isdigit():
        return str(int(text))
    return text


def find_participants(root: Path) -> list[dict]:
    participants = []
    if not root.exists():
        return participants

    for entry in sorted(root.iterdir(), key=lambda p: p.name):
        if not entry.is_dir():
            continue
        m = DIR_PATTERN.match(entry.name)
        if not m:
            continue
        pid = str(int(m.group(1)))
        slide_nums = []
        for wav in entry.glob("*.wav"):
            sm = SLIDE_PATTERN.search(wav.name)
            if sm:
                slide_nums.append(int(sm.group(1)))
        slide_nums = sorted(set(slide_nums))
        participants.append(
            {
                "id": pid,
                "sessionDir": entry.name,
                "availableSlides": slide_nums,
            }
        )

    participants.sort(key=lambda p: int(p["id"]))
    return participants


def extract_trial_template(xlsx_path: Path) -> list[dict]:
    wb = load_workbook(xlsx_path)
    ws = wb[wb.sheetnames[0]]

    by_participant: dict[str, list[dict]] = defaultdict(list)

    for r in range(2, ws.max_row + 1):
        pid = ws.cell(r, 1).value
        slide = ws.cell(r, 2).value
        trial = ws.cell(r, 3).value
        task = ws.cell(r, 4).value
        item = ws.cell(r, 5).value

        if pid in (None, ""):
            continue
        if slide in (None, "") or trial in (None, "") or task in (None, "") or item in (None, ""):
            continue

        pid_norm = normalize_pid(pid)
        by_participant[pid_norm].append(
            {
                "slide": int(slide),
                "trial": int(trial),
                "task": str(task),
                "item": str(item),
            }
        )

    if not by_participant:
        raise RuntimeError("No trial template rows found in Excel.")

    # Use the participant with the largest complete block (expected 53 rows).
    template_pid, template_rows = max(by_participant.items(), key=lambda kv: len(kv[1]))

    trial_counts: Counter[int] = Counter()
    slide_counts: Counter[int] = Counter()

    template = []
    for i, row in enumerate(template_rows, start=1):
        trial_counts[row["trial"]] += 1
        slide_counts[row["slide"]] += 1
        template.append(
            {
                "index": i,
                "slide": row["slide"],
                "trial": row["trial"],
                "task": row["task"],
                "item": row["item"],
                "itemOrderInTrial": trial_counts[row["trial"]],
                "itemOrderInSlide": slide_counts[row["slide"]],
            }
        )

    print(f"Template source participant: {template_pid} ({len(template)} rows)")
    return template


def ensure_symlink(link_path: Path, target_path: Path) -> None:
    link_path.parent.mkdir(parents=True, exist_ok=True)

    if os.path.lexists(link_path):
        if link_path.is_symlink():
            current = os.readlink(link_path)
            expected = os.path.relpath(target_path, start=link_path.parent)
            if current == expected:
                return
            link_path.unlink()
        else:
            print(f"Skip symlink for {link_path} (already exists and is not symlink)")
            return

    rel_target = os.path.relpath(target_path, start=link_path.parent)
    link_path.symlink_to(rel_target)
    print(f"Linked {link_path} -> {rel_target}")


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    immediate = find_participants(IMMEDIATE_SRC)
    delayed = find_participants(DELAYED_SRC)
    template = extract_trial_template(SCORES_XLSX)

    manifest = {
        "version": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "skipSlides": [3, 5, 7, 9, 11],
        "scoring": {
            "accuracyValues": [0, 1],
            "partialCredit": False,
            "rule": "Completely correct response = 1, otherwise 0",
        },
        "trialTemplate": template,
        "datasets": [
            {
                "id": "immediate",
                "label": "Immediate",
                "timing": "immediate",
                "audioRoot": "data/audio/immediate",
                "participants": immediate,
            },
            {
                "id": "delayed",
                "label": "Delayed",
                "timing": "delayed",
                "audioRoot": "data/audio/delayed",
                "participants": delayed,
            },
        ],
    }

    with MANIFEST_PATH.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    ensure_symlink(AUDIO_DIR / "immediate", IMMEDIATE_SRC)
    ensure_symlink(AUDIO_DIR / "delayed", DELAYED_SRC)

    total = len({p["id"] for p in immediate + delayed})
    print(f"Manifest written: {MANIFEST_PATH}")
    print(f"Immediate: {len(immediate)} participants")
    print(f"Delayed:   {len(delayed)} participants")
    print(f"Total unique participants: {total}")


if __name__ == "__main__":
    main()
