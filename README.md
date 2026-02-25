# Nonword Repetition Scoring

Browser-based scoring tool for Japanese nonword repetition audio.

## Rules implemented
- Accuracy is binary only: complete correct response = `1`, otherwise `0`
- No partial credit
- Scored slides: `1 / 2 / 4 / 6 / 8 / 10`
- Skipped slides: `3 / 5 / 7 / 9 / 11`
- Per-item notes (`備考`) supported
- `rater_id` included in exported files

## Data setup
Run once (or whenever source data changes):

```bash
python3 build/prepare-data.py
```

This script:
- reads participant/session structure from
  - `../Analysis/BehavioralData/ImmediateData/NonwordRepetition`
  - `../Analysis/BehavioralData/DelayedData/NonwordRepetition`
- extracts 53-item scoring template from
  - `../Analysis/BehavioralData/NonwordRepetition.xlsx`
- writes `data/participants.json`
- creates symlinks under `data/audio/`

## Run
From this directory:

```bash
python3 -m http.server 8080
```

Open:

- `http://localhost:8080/index.html`

## Exports
- Participant completion popup offers per-participant `.xlsx` download
- Footer has manual export buttons:
  - `Export Participant (.xlsx)`
  - `Export Selected (CSV)`

Export rows include:
- rater_id
- dataset/timing
- participant/session identifiers
- slide/trial/task/item metadata
- accuracy
- note
- scored_at
