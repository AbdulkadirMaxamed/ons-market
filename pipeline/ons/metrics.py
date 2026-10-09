"""Comparisons for one series (docs/01-architecture.md §6). Pure functions, no database.

A series is a list of advert counts aligned to consecutive periods (months or quarters); `None` means ONS
gave no figure (suppressed). Real zeros are kept and treated as values.

Every comparison is a dict with a status `s`:
  ok       both figures exist and are at least MIN_VOLUME: `abs` and `pct` are given
  small    both exist but one is under MIN_VOLUME: `abs` only, no percentage or trend word
  zero     the comparison figure is 0: `abs` only, no percentage
  missing  one of the figures doesn't exist
"""

from __future__ import annotations

from typing import Sequence

MIN_VOLUME = 30  # both figures must be at least this before we show a percentage or trend word
TREND_THRESHOLD = 10.0  # ±10% year on year decides Growing / Shrinking
AVG_COVERAGE = 0.75  # the 5-year average needs this share of periods to have a figure

LAG = {"M": 12, "Q": 4}  # one year
WINDOW_5Y = {"M": 60, "Q": 20}
WINDOW_12M = {"M": 12, "Q": 4}
ROLL = 3  # months in the monthly comparison window

Series = Sequence[int | None]


def change(current: float | None, base: float | None) -> dict:
    if current is None or base is None:
        return {"s": "missing"}
    diff = _round(current - base)
    if base == 0:
        return {"s": "zero", "abs": diff}
    if current < MIN_VOLUME or base < MIN_VOLUME:
        return {"s": "small", "abs": diff}
    return {"s": "ok", "abs": diff, "pct": round((current - base) / base * 100, 1)}


def trend(c: dict) -> str:
    """up | down | flat from an ok comparison; small | na otherwise."""
    if c["s"] == "ok":
        return "up" if c["pct"] >= TREND_THRESHOLD else "down" if c["pct"] <= -TREND_THRESHOLD else "flat"
    return "small" if c["s"] == "small" else "na"


def latest_index(values: Series) -> int | None:
    for i in range(len(values) - 1, -1, -1):
        if values[i] is not None:
            return i
    return None


def _round(x: float) -> float | int:
    return int(x) if float(x).is_integer() else round(x, 1)


def _at(values: Series, i: int) -> int | None:
    return values[i] if 0 <= i < len(values) else None


def _window_sum(values: Series, end: int, n: int) -> int | None:
    """Sum of the n periods ending at `end`, or None if any is missing or out of range."""
    if end - n + 1 < 0:
        return None
    part = values[end - n + 1 : end + 1]
    return None if any(v is None for v in part) else sum(part)


def series_metrics(values: Series, periods: Sequence[str], cadence: str) -> dict | None:
    """All comparisons for one series, anchored on the latest period that has a figure.

    Returns None when the series has no figures at all.
    """
    if len(values) != len(periods):
        raise ValueError(f"{len(values)} values for {len(periods)} periods")
    li = latest_index(values)
    if li is None:
        return None
    latest = values[li]
    lag = LAG[cadence]
    out: dict = {
        "latest": {"period": periods[li], "value": latest},
        "newest": periods[-1],  # differs from latest.period when ONS withheld the newest figure
    }

    prev_i, ya_i = li - 1, li - lag
    out["prev"] = {"period": periods[prev_i] if prev_i >= 0 else None, "value": _at(values, prev_i),
                   **change(latest, _at(values, prev_i))}
    out["yoy"] = {"period": periods[ya_i] if ya_i >= 0 else None, "value": _at(values, ya_i),
                  **change(latest, _at(values, ya_i))}

    basis = out["yoy"]
    out["basis"] = "yoy"
    if cadence == "M":
        cur, base = _window_sum(values, li, ROLL), _window_sum(values, li - lag, ROLL)
        out["roll"] = {"from": periods[li - ROLL + 1] if li >= ROLL - 1 else None, "to": periods[li],
                       "cur": cur, "base": base, **change(cur, base)}
        if out["roll"]["s"] == "ok":  # ONS advises against single-month changes, so prefer the 3-month window
            basis, out["basis"] = out["roll"], "roll"
    out["trend"] = trend(basis)

    window = WINDOW_5Y[cadence]
    in_5y = [v for v in values[max(0, li - window + 1) : li + 1] if v is not None]
    avg = sum(in_5y) / len(in_5y) if len(in_5y) >= window * AVG_COVERAGE else None
    out["avg5y"] = {"value": None if avg is None else round(avg, 1), "n": len(in_5y), **change(latest, avg)}
    out["pctile5y"] = (None if avg is None else
                       round(100 * sum(1 for v in in_5y if v < latest) / len(in_5y)))

    recent = [(periods[i], values[i]) for i in range(max(0, li - WINDOW_12M[cadence] + 1), li + 1)
              if values[i] is not None]
    hi = max(recent, key=lambda pv: pv[1])
    lo = min(recent, key=lambda pv: pv[1])
    out["high12m"] = {"period": hi[0], "value": hi[1]}
    out["low12m"] = {"period": lo[0], "value": lo[1]}
    return out


def months_to_quarters(values: Series, months: Sequence[str]) -> tuple[list[int | None], list[str]]:
    """Sum whole calendar quarters. A quarter with any month missing (or not yet published) is missing."""
    sums: dict[str, list[int | None]] = {}
    for v, m in zip(values, months):
        year, month = m.split("-")
        sums.setdefault(f"{year}-Q{(int(month) - 1) // 3 + 1}", []).append(v)
    quarters = [q for q, vs in sums.items() if len(vs) == 3]
    return [None if any(v is None for v in sums[q]) else sum(sums[q]) for q in quarters], quarters
