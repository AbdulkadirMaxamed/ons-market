"""Reasons for missing and estimated figures (S-010): `pipeline/notices.toml` checked against the workbook."""

from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass
from pathlib import Path

from .workbook import WorkbookError

DEFAULT_NOTICES = Path(__file__).resolve().parents[1] / "notices.toml"
KINDS = {"not_collected", "withheld", "estimated", "caution"}
PERIOD = {"months": re.compile(r"^\d{4}-(0[1-9]|1[0-2])$"), "quarters": re.compile(r"^\d{4}-Q[1-4]$")}


class UnexplainedIssue(WorkbookError):
    """The workbook has an ONS data issue that notices.toml doesn't explain yet."""


@dataclass(frozen=True)
class Notice:
    heading: str
    kind: str
    months: tuple[str, ...]
    quarters: tuple[str, ...]
    reason: str


def load_notices(path: Path = DEFAULT_NOTICES) -> dict[str, Notice]:
    """heading → Notice. Raises ValueError naming the entry if the file is malformed."""
    try:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as e:
        raise ValueError(f"Couldn't read {path.name}: {e}") from e
    out: dict[str, Notice] = {}
    for i, entry in enumerate(raw.get("notice", []), 1):
        where = f"{path.name} notice #{i}"
        heading = entry.get("heading")
        if not isinstance(heading, str) or not heading.strip():
            raise ValueError(f"{where}: missing heading")
        if heading in out:
            raise ValueError(f"{where}: heading {heading!r} is listed twice")
        if entry.get("kind") not in KINDS:
            raise ValueError(f"{where} ({heading}): kind must be one of {', '.join(sorted(KINDS))}")
        if not isinstance(entry.get("reason"), str) or not entry["reason"].strip():
            raise ValueError(f"{where} ({heading}): missing reason")
        for key, pattern in PERIOD.items():
            bad = [p for p in entry.get(key, []) if not isinstance(p, str) or not pattern.match(p)]
            if bad:
                raise ValueError(f"{where} ({heading}): bad {key} {bad}")
        if not entry.get("months") and not entry.get("quarters"):
            raise ValueError(f"{where} ({heading}): give at least one month or quarter")
        out[heading] = Notice(heading, entry["kind"], tuple(entry.get("months", [])),
                              tuple(entry.get("quarters", [])), entry["reason"].strip())
    return out


def check_issues(issues: list[tuple[str, str]], notices: dict[str, Notice]) -> None:
    """Every ONS data issue in the workbook must have an entry in notices.toml."""
    missing = [(h, text) for h, text in issues if h not in notices]
    if missing:
        listed = "\n".join(f'  "{h}"\n    "{_first_sentence(t)}"' for h, t in missing)
        raise UnexplainedIssue(
            f"ONS added {'a data issue' if len(missing) == 1 else 'data issues'} we haven't explained yet:\n"
            f"{listed}\n  Add {'it' if len(missing) == 1 else 'them'} to pipeline/notices.toml and run the import again.")


def _first_sentence(text: str) -> str:
    first = re.split(r"(?<=\.)\s", text.strip(), maxsplit=1)[0]
    return first if len(first) <= 120 else first[:117] + "…"
