"""Import one ONS workbook into SQLite (docs/01-architecture.md §7).

hash → skip if already imported → back up DB → parse and validate into a staging table → upsert
observations, logging every revised value → record the import. It all happens in one transaction, so a
failure leaves the database exactly as it was.
"""

from __future__ import annotations

import hashlib
import re
import shutil
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from importlib.resources import files
from pathlib import Path

from .workbook import TABLES, Location, Occupation, Workbook

BATCH = 50_000


@dataclass
class ImportResult:
    import_id: int
    status: str  # succeeded | skipped
    rows_read: int = 0
    inserted: int = 0
    updated: int = 0
    unchanged: int = 0
    release_label: str | None = None
    latest_period: str | None = None


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, isolation_level=None)  # we manage transactions explicitly
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.executescript(files("ons").joinpath("schema.sql").read_text())
    return conn


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", " and ")).strip("-")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _unique_slugs(items: list[tuple[str, str, str]], taken: dict[str, str]) -> dict[str, str]:
    """items: (code, name, qualifier). Returns code -> slug; on a clash the qualifier is appended."""
    out: dict[str, str] = {}
    for code, name, qualifier in items:
        slug = slugify(name)
        if taken.get(slug, code) != code:
            slug = f"{slug}-{slugify(qualifier)}"
        taken[slug] = code
        out[code] = slug
    return out


def _upsert_reference(conn: sqlite3.Connection, occupations: dict[str, Occupation], locations: dict[str, Location]) -> None:
    taken = {s: c for s, c in conn.execute("SELECT slug, soc_code FROM occupations")}
    order = sorted(occupations.values(), key=lambda o: (-o.level, o.soc_code))  # 4-digit names win the plain slug
    slugs = _unique_slugs([(o.soc_code, o.name, o.soc_code) for o in order], taken)
    for o in sorted(occupations.values(), key=lambda o: o.level):  # parents before children
        parent = o.soc_code[:-1] if o.level == 4 and o.soc_code[:-1] in occupations else None
        conn.execute(
            """INSERT INTO occupations (soc_code, name, slug, level, parent_code) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(soc_code) DO UPDATE SET name = excluded.name, level = excluded.level,
                 parent_code = excluded.parent_code""",
            (o.soc_code, o.name, slugs[o.soc_code], o.level, parent),
        )

    taken = {s: c for s, c in conn.execute("SELECT slug, code FROM locations")}
    rank = {"uk": 0, "region": 1, "lad": 2, "country": 3, "unknown": 4}  # regions/LADs win plain slugs over countries
    order = sorted(locations.values(), key=lambda l: (rank[l.type], l.code))
    slugs = _unique_slugs([(l.code, l.name, l.type) for l in order], taken)
    for loc in order:
        conn.execute(
            """INSERT INTO locations (code, name, slug, type, parent_code, itl2_name) VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(code) DO UPDATE SET name = excluded.name, type = excluded.type,
                 parent_code = excluded.parent_code, itl2_name = COALESCE(excluded.itl2_name, locations.itl2_name)""",
            (loc.code, loc.name, slugs[loc.code], loc.type, loc.parent_code, loc.itl2_name),
        )


def run_import(db_path: Path, xlsx_path: Path, source_url: str | None = None) -> ImportResult:
    digest = sha256(xlsx_path)
    conn = connect(db_path)
    try:
        done = conn.execute("SELECT id FROM imports WHERE sha256 = ? AND status = 'succeeded'", (digest,)).fetchone()
        if done:
            cur = conn.execute(
                "INSERT INTO imports (filename, sha256, started_at, finished_at, status, error) VALUES (?, ?, ?, ?, 'skipped', ?)",
                (xlsx_path.name, digest, _now(), _now(), f"Same file as import #{done[0]}"),
            )
            return ImportResult(cur.lastrowid, "skipped")

        if db_path.exists() and db_path.stat().st_size > 0:
            shutil.copyfile(db_path, db_path.with_name(db_path.name + ".bak"))

        import_id = conn.execute(
            "INSERT INTO imports (filename, sha256, source_url, started_at, status) VALUES (?, ?, ?, ?, 'running')",
            (xlsx_path.name, digest, source_url, _now()),
        ).lastrowid
        try:
            result = _import(conn, xlsx_path, import_id)
        except Exception as e:
            conn.execute("UPDATE imports SET status = 'failed', finished_at = ?, error = ? WHERE id = ?",
                         (_now(), f"{type(e).__name__}: {e}", import_id))
            raise
        return result
    finally:
        conn.close()


def _import(conn: sqlite3.Connection, xlsx_path: Path, import_id: int) -> ImportResult:
    wb = Workbook(xlsx_path)
    conn.execute("BEGIN IMMEDIATE")
    try:
        info = wb.release_info()
        conn.execute("""CREATE TEMP TABLE staging (
                          soc_code TEXT NOT NULL, location_code TEXT NOT NULL, period TEXT NOT NULL,
                          adverts INTEGER, status TEXT NOT NULL, source_table TEXT NOT NULL,
                          PRIMARY KEY (soc_code, location_code, period)) WITHOUT ROWID""")
        occupations: dict[str, Occupation] = {}
        locations: dict[str, Location] = {}
        rows_read = 0
        for spec in TABLES:
            batch: list[tuple] = []
            for obs in wb.observations(spec):
                occupations.setdefault(obs.occupation.soc_code, obs.occupation)
                locations.setdefault(obs.location.code, obs.location)
                batch.append((obs.occupation.soc_code, obs.location.code, obs.period, obs.adverts,
                              "suppressed" if obs.adverts is None else "value", spec.key))
                if len(batch) >= BATCH:
                    _stage(conn, batch)
                    rows_read += len(batch)
                    batch = []
            _stage(conn, batch)
            rows_read += len(batch)

        _upsert_reference(conn, occupations, locations)

        inserted = conn.execute("""SELECT COUNT(*) FROM staging s WHERE NOT EXISTS (
                                     SELECT 1 FROM observations o WHERE o.soc_code = s.soc_code
                                       AND o.location_code = s.location_code AND o.period = s.period)""").fetchone()[0]
        updated = conn.execute(
            """INSERT INTO observation_revisions
                 (soc_code, location_code, period, old_adverts, new_adverts, old_status, new_status, import_id)
               SELECT s.soc_code, s.location_code, s.period, o.adverts, s.adverts, o.status, s.status, ?
               FROM staging s JOIN observations o
                 ON o.soc_code = s.soc_code AND o.location_code = s.location_code AND o.period = s.period
               WHERE o.adverts IS NOT s.adverts OR o.status <> s.status""",
            (import_id,),
        ).rowcount
        conn.execute(
            """INSERT INTO observations
                 (soc_code, location_code, period, adverts, status, source_table, first_import_id, last_import_id)
               SELECT soc_code, location_code, period, adverts, status, source_table, ?, ? FROM staging WHERE true
               ON CONFLICT(soc_code, location_code, period) DO UPDATE SET
                 adverts = excluded.adverts, status = excluded.status,
                 source_table = excluded.source_table, last_import_id = excluded.last_import_id""",
            (import_id, import_id),
        )
        conn.execute(
            """UPDATE imports SET status = 'succeeded', finished_at = ?, release_label = ?, latest_period = ?,
                 published_on = ?, rows_read = ?, rows_inserted = ?, rows_updated = ?, rows_unchanged = ?
               WHERE id = ?""",
            (_now(), info.release_label, info.latest_period,
             info.published_on.isoformat() if info.published_on else None,
             rows_read, inserted, updated, rows_read - inserted - updated, import_id),
        )
        conn.execute("DROP TABLE staging")
        conn.execute("COMMIT")
        return ImportResult(import_id, "succeeded", rows_read, inserted, updated, rows_read - inserted - updated,
                            info.release_label, info.latest_period)
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        wb.close()


def _stage(conn: sqlite3.Connection, batch: list[tuple]) -> None:
    if not batch:
        return
    conn.execute("SAVEPOINT batch")
    try:
        conn.executemany("INSERT INTO staging VALUES (?, ?, ?, ?, ?, ?)", batch)
        conn.execute("RELEASE batch")
    except sqlite3.IntegrityError:
        conn.execute("ROLLBACK TO batch")
        for row in batch:  # replay one by one to name the offending row
            try:
                conn.execute("INSERT INTO staging VALUES (?, ?, ?, ?, ?, ?)", row)
            except sqlite3.IntegrityError:
                raise ValueError(
                    f"Duplicate observation in {row[5]}: SOC {row[0]}, location {row[1]}, period {row[2]}"
                ) from None
        raise
