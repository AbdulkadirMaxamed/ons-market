import json
import sqlite3

import pytest

from ons.export import run_export
from ons.importer import run_import
from ons.notices import DEFAULT_NOTICES, UnexplainedIssue, load_notices
from ons.workbook import Workbook


def issues(db_path):
    with sqlite3.connect(db_path) as c:
        return c.execute("SELECT import_id, heading, text FROM data_issues ORDER BY import_id, position").fetchall()


def test_reads_data_issues_from_the_cover_sheet(make_workbook):
    wb = Workbook(make_workbook())
    try:
        assert wb.data_issues() == [
            ("Data issue - March 2026", "The data in March 2026 has been suppressed due to a source problem."),
            ("Data issue - data for June 2025", "Users should be aware that we noticed a drop.\n\nSecond paragraph."),
        ]
    finally:
        wb.close()


def test_import_saves_ons_text(make_workbook, db_path, notices_path):
    run_import(db_path, make_workbook(), notices_path=notices_path)
    assert [h for _, h, _ in issues(db_path)] == ["Data issue - March 2026", "Data issue - data for June 2025"]


def test_unexplained_issue_stops_the_import(make_workbook, db_path, notices_path):
    def new_issue(spec):
        spec["issues"].insert(0, ("Data issue - September 2026", ["Users should be aware that we noticed a drop in new adverts. More text."]))

    with pytest.raises(UnexplainedIssue, match=r'"Data issue - September 2026"\n    "Users should be aware that we noticed a drop in new adverts\."'):
        run_import(db_path, make_workbook(mutate=new_issue), notices_path=notices_path)
    with sqlite3.connect(db_path) as c:
        assert c.execute("SELECT COUNT(*) FROM observations").fetchone()[0] == 0
        assert c.execute("SELECT status FROM imports").fetchone()[0] == "failed"
    assert issues(db_path) == []


def test_issue_with_no_text_is_a_layout_error(make_workbook, db_path, notices_path):
    def empty(spec):
        spec["issues"][0] = ("Data issue - March 2026", [])

    with pytest.raises(Exception, match="has no text under it"):
        run_import(db_path, make_workbook(mutate=empty), notices_path=notices_path)


def test_skipped_reimport_backfills_issues_for_older_imports(make_workbook, db_path, notices_path):
    path = make_workbook()
    run_import(db_path, path, notices_path=notices_path)
    with sqlite3.connect(db_path) as c:
        c.execute("DELETE FROM data_issues")
    assert run_import(db_path, path, notices_path=notices_path).status == "skipped"
    assert len(issues(db_path)) == 2


def test_export_joins_ons_text_to_our_reasons(make_workbook, db_path, notices_path, tmp_path):
    run_import(db_path, make_workbook(), notices_path=notices_path)
    out = tmp_path / "data"
    run_export(db_path, out, notices_path=notices_path)
    notices = json.loads((out / "meta.json").read_text())["notices"]
    assert notices[0] == {
        "heading": "Data issue - March 2026", "kind": "not_collected", "reason": "ONS couldn't get the data.",
        "months": ["2026-03"], "quarters": ["2026-Q1"],
        "ons": "The data in March 2026 has been suppressed due to a source problem.",
    }
    assert [n["heading"] for n in notices] == ["Data issue - March 2026", "Data issue - data for June 2025"]


@pytest.mark.parametrize(
    "toml, message",
    [
        ('[[notice]]\nheading = "X"\nkind = "gone"\nmonths = ["2026-01"]\nreason = "r"', "kind must be one of"),
        ('[[notice]]\nheading = "X"\nkind = "withheld"\nmonths = ["Jan-26"]\nreason = "r"', "bad months"),
        ('[[notice]]\nheading = "X"\nkind = "withheld"\nreason = "r"', "at least one month or quarter"),
        ('[[notice]]\nheading = "X"\nkind = "withheld"\nmonths = ["2026-01"]', "missing reason"),
        ('[[notice]]\nheading = "X"\nkind = "withheld"\nmonths = ["2026-01"]\nreason = "r"\n' * 2, "listed twice"),
        ('[[notice]\nheading = "X"', "Couldn't read"),
    ],
)
def test_malformed_notices_file(tmp_path, toml, message):
    path = tmp_path / "notices.toml"
    path.write_text(toml)
    with pytest.raises(ValueError, match=message):
        load_notices(path)


def test_the_real_notices_file_is_valid():
    notices = load_notices(DEFAULT_NOTICES)
    assert notices["Data issue - March 2026"].kind == "not_collected"
