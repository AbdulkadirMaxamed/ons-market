"""Command line: `pnpm data:import <file.xlsx>` and `pnpm data:status` (see package.json)."""

from __future__ import annotations

import argparse
import sqlite3
import sys
import time
from pathlib import Path

from .importer import connect, run_import
from .workbook import WorkbookError

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT / "data" / "db" / "job-market.sqlite"

# Values to compare by eye against the spreadsheet after each import.
SPOT_CHECKS = [
    ("All jobs, UK", "ALL", "K02000001", "M"),
    ("Software developers (2134), North West", "2134", "TLD", "M"),
    ("IT professionals (213), Manchester", "213", "E08000003", "M"),
    ("Software developers (2134), Manchester", "2134", "E08000003", "Q"),
]


def _print_spot_checks(conn: sqlite3.Connection) -> None:
    print("\nSpot checks (compare with the spreadsheet):")
    for label, soc, loc, cadence in SPOT_CHECKS:
        like = "%-Q%" if cadence == "Q" else "____-__"
        rows = conn.execute(
            f"""SELECT period, adverts, status FROM observations
                WHERE soc_code = ? AND location_code = ? AND period LIKE ? ORDER BY period DESC LIMIT 3""",
            (soc, loc, like),
        ).fetchall()
        shown = ", ".join(f"{p} {'[x]' if a is None else f'{a:,}'}" for p, a, _ in rows) or "no rows"
        print(f"  {label:42} {shown}")


def cmd_import(args: argparse.Namespace) -> int:
    path = Path(args.file).resolve()
    if not path.exists():
        print(f"No such file: {path}", file=sys.stderr)
        return 2
    started = time.monotonic()
    try:
        result = run_import(Path(args.db), path, args.source_url)
    except WorkbookError as e:
        print(f"Import failed, database unchanged.\n  The workbook layout isn't what we expect: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Import failed, database unchanged.\n  {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    if result.status == "skipped":
        print(f"Already imported this exact file. Nothing to do (logged as import #{result.import_id}).")
        return 0
    print(f"Imported {path.name}: {result.release_label} (latest month {result.latest_period})")
    print(f"  {result.rows_read:,} values read in {time.monotonic() - started:.0f}s")
    print(f"  {result.inserted:,} new · {result.updated:,} revised by ONS · {result.unchanged:,} unchanged")
    conn = connect(Path(args.db))
    _print_spot_checks(conn)
    conn.close()
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    conn = connect(Path(args.db))
    rows = conn.execute(
        """SELECT id, status, filename, release_label, finished_at, rows_inserted, rows_updated, error
           FROM imports ORDER BY id DESC LIMIT 10"""
    ).fetchall()
    if not rows:
        print("No imports yet.")
    for i, status, name, label, at, ins, upd, err in rows:
        detail = f"{label} · {ins:,} new · {upd:,} revised" if status == "succeeded" else (err or "")
        print(f"#{i:<3} {status:9} {at or '':25} {name}  {detail}")
    conn.close()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ons")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="SQLite database path")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("import", help="Import an ONS labour demand workbook")
    p.add_argument("file")
    p.add_argument("--source-url", default=None)
    p.set_defaults(func=cmd_import)
    s = sub.add_parser("status", help="Show recent imports")
    s.set_defaults(func=cmd_status)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
