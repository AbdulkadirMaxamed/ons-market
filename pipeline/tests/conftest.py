"""Builds small workbooks with the same layout as the real ONS file (docs/03-workbook.md).
Values are made up for tests only and never leave the test run."""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Callable

import pytest
from openpyxl import Workbook

PROG = "Programmers and software development professionals"

BASE = {
    "issues": [
        ("Data issue - March 2026", ["The data in March 2026 has been suppressed due to a source problem."]),
        ("Data issue - data for June 2025", ["Users should be aware that we noticed a drop.", "Second paragraph."]),
    ],
    "months": ["Jan-26", "Feb-26", "Mar-26"],
    "quarters": ["2025Q4", "2026Q1"],
    "tables": {
        "T1": {
            "sheet": "Table 1",
            "title": "Table 1: New online job adverts in the UK, split by country between January 2017 and March 2026",
            "columns": ["Country"],
            "cadence": "M",
            "rows": [["Total UK", 1000, 1100, "[x]"], ["England", 800, 900, "[x]"], ["Unknown", 1, 2, "[x]"]],
        },
        "T2": {
            "sheet": "Table 2",
            "title": "Table 2: New online job adverts in the UK, split by Local Authority District between January 2017 and March 2026",
            "columns": ["Region", "ITL2", "Local Authority District", "Local Authority Code"],
            "cadence": "M",
            "rows": [
                ["North West", "Greater Manchester", "Manchester", "E08000003", 10, 11, "[x]"],
                ["London", "London", "London", None, 50, 51, "[x]"],
            ],
        },
        "T3": {
            "sheet": "Table 3",
            "title": "Table 3: New online job adverts in the UK, split by region and standard occupation classification (4-digit SOC2020) between January 2017 and March 2026",
            "columns": ["Region", "SOC 4 digit code", "SOC 4 digit label"],
            "cadence": "M",
            "rows": [
                ["Total UK", "2134", PROG, 1000, 0, "[x]"],
                ["North West", "2134", PROG, 100, 105, "[x]"],
                ["North West", "Unknown", "Unknown", 1, 1, 1],
            ],
        },
        "T4": {
            "sheet": "Table 4",
            "title": "Table 4: New online job adverts in the UK, split by Local Authority District and standard occupation classification (3-digit SOC2020) between January 2017 and March 2026",
            "columns": ["Region", "ITL2", "Local Authority District", "SOC 3 digit code", "SOC 3 digit label", "Local Authority Code"],
            "cadence": "M",
            "rows": [["North West", "Greater Manchester", "Manchester", "213", "Information Technology Professionals", "E08000003", 50, 0, "[x]"]],
        },
        "T5": {
            "sheet": "Table 5",
            "title": "Table 5: Quarterly new online job adverts in the UK, split by Local Authority District and standard occupation classification (4-digit SOC2020) between Quarter 4 2025 and Quarter 1 2026",
            "columns": ["Region", "ITL2", "Local Authority District", "SOC 4 digit code", "SOC 4 digit label", "Local Authority Code"],
            "cadence": "Q",
            "rows": [["North West", "Greater Manchester", "Manchester", "2134", PROG, "E08000003", 300, "[x]"]],
        },
    },
}


def write_workbook(path: Path, spec: dict) -> Path:
    wb = Workbook()
    cover = wb.active
    cover.title = "Cover sheet"
    cover.append(["Labour Demand Volumes by Standard Occupation Classification (SOC2020), UK: January 2017 - March 2026"])
    cover.append(["These tables contain the number of online job adverts split by local authority and SOC 2020."])
    cover.append(["The data tables in this spreadsheet were published on 25th April 2026."])
    cover.append(["Recent data quality and data interpretation"])
    cover.append(["Since November 2025, users should exercise more caution."])
    for heading, paragraphs in spec["issues"]:
        cover.append([heading])
        for text in paragraphs:
            cover.append([text])
    cover.append(["User guide"])
    cover.append(["For further information see the user guide:"])
    for t in spec["tables"].values():
        ws = wb.create_sheet(t["sheet"])
        ws.append([t["title"]])
        ws.append(["Subtitle"])
        ws.append(["This worksheet contains one table."])
        ws.append(['=HYPERLINK("#\'Table of contents\'!A1", "Back to contents")'])
        ws.append(t["columns"] + (spec["months"] if t["cadence"] == "M" else spec["quarters"]))
        for row in t["rows"]:
            ws.append(row)
    wb.save(path)
    return path


@pytest.fixture
def make_workbook(tmp_path: Path) -> Callable[..., Path]:
    """make_workbook(name, mutate=fn) writes a workbook; mutate(spec) can edit a deep copy of BASE first."""

    def make(name: str = "ons.xlsx", mutate: Callable[[dict], None] | None = None) -> Path:
        spec = copy.deepcopy(BASE)
        if mutate:
            mutate(spec)
        return write_workbook(tmp_path / name, spec)

    return make


NOTICES = """
[[notice]]
heading = "Data issue - March 2026"
kind = "not_collected"
months = ["2026-03"]
quarters = ["2026-Q1"]
reason = "ONS couldn't get the data."

[[notice]]
heading = "Data issue - data for June 2025"
kind = "withheld"
months = ["2025-06", "2025-07"]
quarters = ["2025-Q2"]
reason = "A source dropped out."

[[notice]]
heading = "Data issue - Not in this workbook"
kind = "caution"
months = ["2020-01"]
reason = "Dropped by ONS since."
"""


@pytest.fixture
def notices_path(tmp_path: Path) -> Path:
    path = tmp_path / "notices.toml"
    path.write_text(NOTICES)
    return path


JOBS = """
[2134]
short = "Software developers"
aliases = ["Programmer", "dev"]

[9999]
aliases = ["not in the data"]
"""


@pytest.fixture
def jobs_path(tmp_path: Path) -> Path:
    path = tmp_path / "jobs.toml"
    path.write_text(JOBS)
    return path


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "db" / "test.sqlite"
