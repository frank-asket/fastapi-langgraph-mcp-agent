#!/usr/bin/env python3
"""
Merge GTEC \"Programmes by institution\" CSV exports into one JSON for the Next.js assessment.

Usage:
  python scripts/merge_gtec_csv.py /path/to/folder/with/GTEC*.csv frontend/public/data/gtec_tertiary.json

Expected CSV columns (header row): Programme, Start, Duration(Years), End, Status
Institution name is taken from the filename: ... institutions(Name Here).csv
"""

from __future__ import annotations

import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


def slugify(text: str) -> str:
    s = unicodedata.normalize("NFKD", text)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:120] or "inst"


def institution_from_filename(path: Path) -> str:
    m = re.search(r"institutions\s*\((.+)\)\s*\.csv$", path.name, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return path.stem.replace("GTEC  Programes by institutions", "").strip("() ")


def classify_institution(name: str) -> str:
    """Bucket for assessment filters: university | technical_university | other_tertiary."""
    n = name.lower()
    if "technical university" in n:
        return "technical_university"
    if "university" in n:
        return "university"
    return "other_tertiary"


def read_programmes_csv(path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    raw = path.read_text(encoding="utf-8-sig", errors="replace")
    if not raw.strip():
        return rows
    sample = raw[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel()
    reader = csv.DictReader(raw.splitlines(), dialect=dialect)
    if not reader.fieldnames:
        return rows
    # Normalise keys
    fn = [str(f or "").strip() for f in reader.fieldnames]
    key_map = {f.lower(): f for f in fn}

    def pick(*candidates: str) -> str | None:
        for c in candidates:
            for k, orig in key_map.items():
                if c.lower() in k.replace(" ", ""):
                    return orig
        return None

    pkey = pick("programme", "program")
    if not pkey:
        return rows
    dkey = pick("duration", "years")
    skey = pick("status")

    for r in reader:
        prog = (r.get(pkey) or "").strip()
        if not prog:
            continue
        dur_raw = (r.get(dkey) if dkey else "") or ""
        try:
            duration = int(float(str(dur_raw).strip())) if str(dur_raw).strip() else None
        except ValueError:
            duration = None
        status = (r.get(skey) if skey else "") or ""
        status = str(status).strip() or None
        rows.append({"name": prog, "duration_years": duration, "status": status})
    return rows


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    src = Path(sys.argv[1]).expanduser().resolve()
    out = Path(sys.argv[2]).expanduser().resolve()
    if not src.is_dir():
        print(f"Not a directory: {src}", file=sys.stderr)
        return 1

    pattern = re.compile(r"GTEC.*institutions\s*\(.+\)\.csv$", re.IGNORECASE)
    files = sorted(p for p in src.iterdir() if p.is_file() and pattern.search(p.name))
    if not files:
        print(f"No matching GTEC CSV files in {src}", file=sys.stderr)
        return 1

    by_cat: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    seen_slugs: dict[str, int] = {}

    for fp in files:
        inst = institution_from_filename(fp)
        if not inst or inst in {"1", "(1)"} or inst.replace(".", "").isdigit():
            continue
        cat = classify_institution(inst)
        progs = read_programmes_csv(fp)
        if not progs:
            continue
        base_slug = slugify(inst)
        slug = base_slug
        n = seen_slugs.get(base_slug, 0)
        seen_slugs[base_slug] = n + 1
        if n:
            slug = f"{base_slug}-{n}"
        by_cat[cat][slug] = {"id": slug, "name": inst, "programmes": progs}

    payload = {
        "source": "Merged from GTEC per-institution CSV exports (local script).",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "file_count": len(files),
        "categories": {},
    }

    for cat in ("university", "technical_university", "other_tertiary"):
        insts = sorted(by_cat[cat].values(), key=lambda x: x["name"].lower())
        payload["categories"][cat] = insts

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=0), encoding="utf-8")

    sz = out.stat().st_size
    nu = len(payload["categories"]["university"])
    nt = len(payload["categories"]["technical_university"])
    no = len(payload["categories"]["other_tertiary"])
    print(f"Wrote {out} ({sz / 1024 / 1024:.2f} MiB)")
    print(f"Institutions: university={nu}, technical_university={nt}, other_tertiary={no}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
