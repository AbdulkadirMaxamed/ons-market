"""Friendly job names and search aliases (S-003): `pipeline/jobs.toml` checked against the imported jobs."""

from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass
from pathlib import Path

DEFAULT_JOBS = Path(__file__).resolve().parents[1] / "jobs.toml"
SOC4 = re.compile(r"^\d{4}$")


@dataclass(frozen=True)
class JobName:
    soc: str
    name: str  # shown on the site: the short name, or ONS's name when there isn't one
    ons: str  # ONS's official name
    slug: str
    old_slug: str | None  # the slug before the short name, so old links can redirect
    aliases: tuple[str, ...]


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", " and ")).strip("-")


def load_jobs(path: Path = DEFAULT_JOBS) -> dict[str, dict]:
    """soc → {"short": str | None, "aliases": [str]}. Raises ValueError naming the entry if malformed."""
    try:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as e:
        raise ValueError(f"Couldn't read {path.name}: {e}") from e
    out: dict[str, dict] = {}
    for soc, entry in raw.items():
        where = f"{path.name} [{soc}]"
        if not SOC4.match(soc) or not isinstance(entry, dict):
            raise ValueError(f"{where}: expected a 4-digit SOC code table")
        unknown = set(entry) - {"short", "aliases"}
        if unknown:
            raise ValueError(f"{where}: unknown key {', '.join(sorted(unknown))}")
        short = entry.get("short")
        if short is not None and (not isinstance(short, str) or not short.strip()):
            raise ValueError(f"{where}: short must be a non-empty string")
        aliases = entry.get("aliases", [])
        if not isinstance(aliases, list) or any(not isinstance(a, str) or not a.strip() for a in aliases):
            raise ValueError(f"{where}: aliases must be a list of words")
        if short is None and not aliases:
            raise ValueError(f"{where}: empty entry")
        out[soc] = {"short": short and short.strip(), "aliases": sorted({a.strip().lower() for a in aliases})}
    return out


def job_names(occupations: list[tuple[str, str, str]], path: Path = DEFAULT_JOBS) -> tuple[dict[str, JobName], list[str]]:
    """occupations: (soc, ONS name, current slug). Returns (soc → JobName, codes in jobs.toml that aren't in the
    data). Unused entries are ignored (ONS may drop a job), but reported so a mistyped code gets noticed.

    Fails if two jobs would share a name or a URL.
    """
    curated = load_jobs(path)
    unused = sorted(set(curated) - {soc for soc, _, _ in occupations})
    out: dict[str, JobName] = {}
    for soc, ons, slug in occupations:
        c = curated.get(soc, {"short": None, "aliases": []})
        name = c["short"] or ons
        new = _slugify(name) if c["short"] else slug
        out[soc] = JobName(soc, name, ons, new, slug if new != slug else None, tuple(c["aliases"]))
    for attr in ("name", "slug"):
        seen: dict[str, str] = {}
        for j in out.values():
            key = getattr(j, attr).lower()
            if key in seen:
                raise ValueError(f"jobs.toml: {seen[key]} and {j.soc} would both have the {attr} {key!r}")
            seen[key] = j.soc
    slugs = {j.slug: j.soc for j in out.values()}
    for j in out.values():
        if j.old_slug and j.old_slug in slugs:
            raise ValueError(f"jobs.toml: {j.soc}'s old URL {j.old_slug!r} is now {slugs[j.old_slug]}'s URL")
    return out, unused
