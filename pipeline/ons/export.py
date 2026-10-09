"""SQLite → static JSON files the website reads (docs/01-architecture.md §5).

Files written to `public/data/` (git-ignored, deployed with the site):

  meta.json                 release, latest month and quarter, periods ONS withheld entirely, and the notices
                            explaining missing/estimated periods (ONS's own text + our short reason, S-010)
  search.json               every 4-digit job and every place, for search and URL slugs
  overview.json             homepage: UK all-jobs series, jobs rising and falling fastest
  occupation/{soc4}.json    one exact job: monthly UK + regions (Table 3), quarterly for every place
                            (Table 5 for local authorities and London; whole quarters of Table 3 for the
                            UK and other regions, marked `derived`)
  group/{soc3}.json         one broader job group: monthly for every local authority and London (Table 4), used by the
                            Monthly view of a local authority

Series are arrays aligned to the shard's `months` / `quarters` (`start` … `end`, consecutive); `null` means ONS
withheld the figure. Every place carries its comparisons from `metrics.series_metrics`.

The export is written to a temporary folder and swapped in only when complete.
"""

from __future__ import annotations

import json
import shutil
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .metrics import series_metrics, months_to_quarters
from .notices import DEFAULT_NOTICES, load_notices
from .workbook import UK, next_period

OVERVIEW_MIN_BASE = 1500  # risers/fallers: at least this many UK adverts in the 3 months a year earlier
OVERVIEW_TOP = 10


@dataclass
class ExportResult:
    files: int
    bytes: int
    occupations: int
    groups: int


def _periods(start: str, end: str) -> list[str]:
    out = [start]
    while out[-1] != end:
        out.append(next_period(out[-1]))
    return out


def _span(periods: list[str]) -> dict:
    return {"start": periods[0], "end": periods[-1]}


def _write(path: Path, data: object) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    path.write_text(text, encoding="utf-8")
    return len(text.encode())


def _series(conn: sqlite3.Connection, soc: str, table: str, periods: list[str],
            locations: Iterable[str] | None = None) -> dict[str, list[int | None]]:
    """location code → values aligned to `periods`. Locations with no rows at all are left out."""
    index = {p: i for i, p in enumerate(periods)}
    out: dict[str, list[int | None]] = {}
    for loc, period, adverts in conn.execute(
        "SELECT location_code, period, adverts FROM observations WHERE soc_code = ? AND source_table = ?",
        (soc, table),
    ):
        if loc == "UNKNOWN" or (locations is not None and loc not in locations):
            continue
        i = index.get(period)
        if i is None:
            raise ValueError(f"{table} {soc} {loc}: period {period} is outside {periods[0]}…{periods[-1]}")
        out.setdefault(loc, [None] * len(periods))[i] = adverts
    return out


def _place(values: list[int | None], periods: list[str], cadence: str, **extra) -> dict:
    return {"v": values, "m": series_metrics(values, periods, cadence), **extra}


def _withheld_everywhere(conn: sqlite3.Connection, table: str) -> list[str]:
    return [p for (p,) in conn.execute(
        f"SELECT period FROM observations WHERE source_table = ? GROUP BY period "
        f"HAVING SUM(status = 'value') = 0 ORDER BY period", (table,))]


def _notices(conn: sqlite3.Connection, import_id: int, notices_path: Path) -> list[dict]:
    """The latest release's ONS data issues, joined to our labels. Raises if one isn't explained."""
    mapped = load_notices(notices_path)
    out = []
    for heading, text in conn.execute(
            "SELECT heading, text FROM data_issues WHERE import_id = ? ORDER BY position", (import_id,)):
        n = mapped.get(heading)
        if n is None:
            raise ValueError(f"ONS data issue {heading!r} isn't in {notices_path.name}. Add it, then export again.")
        out.append({"heading": heading, "kind": n.kind, "reason": n.reason,
                    "months": list(n.months), "quarters": list(n.quarters), "ons": text})
    return out


def run_export(db_path: Path, out_dir: Path, notices_path: Path = DEFAULT_NOTICES) -> ExportResult:
    if not db_path.exists():
        raise FileNotFoundError(f"No database at {db_path}. Run `pnpm data:import <file.xlsx>` first.")
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    tmp = out_dir.with_name(out_dir.name + ".tmp")
    try:
        return _export(conn, out_dir, tmp, notices_path)
    finally:
        conn.close()
        shutil.rmtree(tmp, ignore_errors=True)


def _export(conn: sqlite3.Connection, out_dir: Path, tmp: Path, notices_path: Path) -> ExportResult:
    release = conn.execute(
        "SELECT id, release_label, published_on, latest_period FROM imports "
        "WHERE status = 'succeeded' ORDER BY id DESC LIMIT 1").fetchone()
    if release is None:
        raise ValueError("No successful import in the database yet.")
    import_id, label, published_on, _ = release

    (m0, m1), = conn.execute("SELECT MIN(period), MAX(period) FROM observations WHERE source_table = 'T3'")
    (q0, q1), = conn.execute("SELECT MIN(period), MAX(period) FROM observations WHERE source_table = 'T5'")
    months, quarters = _periods(m0, m1), _periods(q0, q1)

    occupations = conn.execute(
        "SELECT soc_code, name, slug, parent_code FROM occupations WHERE level = 4 ORDER BY soc_code").fetchall()
    groups = {code: (name, slug) for code, name, slug in conn.execute(
        "SELECT soc_code, name, slug FROM occupations WHERE level = 3 ORDER BY soc_code")}
    places = conn.execute(
        "SELECT code, name, slug, type, parent_code FROM locations WHERE type IN ('uk', 'region', 'lad') "
        "ORDER BY type = 'lad', name").fetchall()
    lads = {code for code, _, _, t, _ in places if t == "lad"} | {"TLI"}  # London: one area in Tables 4 and 5

    shutil.rmtree(tmp, ignore_errors=True)
    files = size = 0

    def write(rel: str, data: object) -> None:
        nonlocal files, size
        size += _write(tmp / rel, data)
        files += 1

    month_span, quarter_span = _span(months), _span(quarters)

    write("meta.json", {
        "importId": import_id,
        "releaseLabel": label,
        "publishedOn": published_on,
        "latestMonth": months[-1],
        "latestQuarter": quarters[-1],
        "withheldEverywhere": _withheld_everywhere(conn, "T3") + _withheld_everywhere(conn, "T5"),
        "notices": _notices(conn, import_id, notices_path),
    })

    write("search.json", {
        "occupations": [{"soc": s, "name": n, "slug": sl, "group": p} for s, n, sl, p in occupations],
        "groups": {code: {"name": n, "slug": sl} for code, (n, sl) in groups.items()},
        "places": [{"code": c, "name": n, "slug": sl, "type": t, "region": p if t == "lad" else None}
                   for c, n, sl, t, p in places],
    })

    movers = []
    for soc, name, slug, group in occupations:
        monthly = _series(conn, soc, "T3", months)
        monthly_places = {loc: _place(v, months, "M") for loc, v in monthly.items()}
        uk = monthly_places.get(UK[0])
        r = uk and uk["m"] and uk["m"]["roll"]
        if r and r["s"] == "ok" and r["base"] >= OVERVIEW_MIN_BASE:
            movers.append({"soc": soc, "name": name, "slug": slug, "cur": r["cur"], "base": r["base"], "pct": r["pct"]})
        quarterly_lad = _series(conn, soc, "T5", quarters)
        quarterly = {}
        for loc, values in monthly.items():
            if loc in quarterly_lad:  # London has its own quarterly row in Table 5
                continue
            q, qp = months_to_quarters(values, months)
            aligned = dict(zip(qp, q))
            quarterly[loc] = _place([aligned.get(p) for p in quarters], quarters, "Q", derived=True)
        for loc, values in quarterly_lad.items():
            quarterly[loc] = _place(values, quarters, "Q")
        write(f"occupation/{soc}.json", {
            "soc": soc, "name": name, "slug": slug, "group": group,
            "months": month_span, "quarters": quarter_span,
            "monthly": monthly_places,
            "quarterly": quarterly,
        })

    # Homepage: all jobs in the UK, and the UK jobs rising and falling fastest (3 months vs a year earlier).
    uk_all = _series(conn, "ALL", "T1", months).get(UK[0])
    uk_place = _place(uk_all, months, "M") if uk_all else None
    roll = uk_place and uk_place["m"] and uk_place["m"]["roll"]
    movers.sort(key=lambda x: x["pct"])
    write("overview.json", {
        "months": month_span,
        "uk": uk_place,
        "moversWindow": roll and {"from": roll["from"], "to": roll["to"]},
        "moversMinBase": OVERVIEW_MIN_BASE,
        "rising": [x for x in reversed(movers) if x["pct"] > 0][:OVERVIEW_TOP],
        "falling": [x for x in movers if x["pct"] < 0][:OVERVIEW_TOP],
    })

    for code, (name, slug) in groups.items():
        write(f"group/{code}.json", {
            "soc": code, "name": name, "slug": slug, "months": month_span,
            "monthly": {loc: _place(v, months, "M") for loc, v in _series(conn, code, "T4", months, lads).items()},
        })

    old = out_dir.with_name(out_dir.name + ".old")
    shutil.rmtree(old, ignore_errors=True)
    if out_dir.exists():
        out_dir.rename(old)
    tmp.rename(out_dir)
    shutil.rmtree(old, ignore_errors=True)
    return ExportResult(files=files, bytes=size, occupations=len(occupations), groups=len(groups))
