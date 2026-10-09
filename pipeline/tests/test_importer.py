import sqlite3

import pytest

from ons import importer
from ons.importer import run_import
from ons.workbook import WorkbookError


def obs(db_path, soc, loc, period):
    with sqlite3.connect(db_path) as c:
        return c.execute(
            "SELECT adverts, status, source_table, first_import_id, last_import_id FROM observations "
            "WHERE soc_code = ? AND location_code = ? AND period = ?",
            (soc, loc, period),
        ).fetchone()


def snapshot(db_path):
    with sqlite3.connect(db_path) as c:
        return c.execute("SELECT * FROM observations ORDER BY 1, 2, 3").fetchall()


def imports(db_path):
    with sqlite3.connect(db_path) as c:
        return c.execute("SELECT status, error FROM imports ORDER BY id").fetchall()


def test_imports_every_table(make_workbook, db_path):
    r = run_import(db_path, make_workbook())
    assert r.status == "succeeded"
    assert r.release_label == "January 2017 - March 2026"
    assert r.latest_period == "2026-03"
    assert r.rows_read == 3 * 3 + 2 * 3 + 3 * 3 + 1 * 3 + 1 * 2
    assert r.inserted == r.rows_read and r.updated == 0

    assert obs(db_path, "ALL", "K02000001", "2026-01")[:3] == (1000, "value", "T1")
    assert obs(db_path, "2134", "TLD", "2026-02")[:3] == (105, "value", "T3")
    assert obs(db_path, "213", "E08000003", "2026-01")[:3] == (50, "value", "T4")
    assert obs(db_path, "2134", "E08000003", "2025-Q4")[:3] == (300, "value", "T5")

    with sqlite3.connect(db_path) as c:
        assert c.execute("SELECT published_on FROM imports").fetchone()[0] == "2026-04-25"
        assert c.execute("SELECT type, parent_code, itl2_name FROM locations WHERE code = 'E08000003'").fetchone() == (
            "lad", "TLD", "Greater Manchester")
        assert c.execute("SELECT parent_code FROM occupations WHERE soc_code = '2134'").fetchone()[0] == "213"


def test_suppressed_stays_missing_and_zero_stays_zero(make_workbook, db_path):
    run_import(db_path, make_workbook())
    assert obs(db_path, "2134", "TLD", "2026-03")[:2] == (None, "suppressed")
    assert obs(db_path, "2134", "K02000001", "2026-02")[:2] == (0, "value")
    assert obs(db_path, "213", "E08000003", "2026-02")[:2] == (0, "value")


def test_london_and_unknowns_map_to_stable_codes(make_workbook, db_path):
    run_import(db_path, make_workbook())
    assert obs(db_path, "ALL", "TLI", "2026-01")[0] == 50  # London row in Table 2 has no LAD code
    assert obs(db_path, "UNKNOWN-4", "TLD", "2026-03")[0] == 1
    assert obs(db_path, "ALL", "UNKNOWN", "2026-02")[0] == 2


def test_same_file_twice_is_skipped(make_workbook, db_path):
    path = make_workbook()
    run_import(db_path, path)
    before = snapshot(db_path)
    r = run_import(db_path, path)
    assert r.status == "skipped"
    assert snapshot(db_path) == before
    assert [s for s, _ in imports(db_path)] == ["succeeded", "skipped"]


def test_ons_revisions_update_history_and_are_logged(make_workbook, db_path):
    run_import(db_path, make_workbook("v1.xlsx"))

    def revise(spec):
        spec["months"].append("Apr-26")
        for t in spec["tables"].values():
            for row in t["rows"]:
                row.append(5) if t["cadence"] == "M" else None
        spec["tables"]["T3"]["rows"][1][3] = 120  # NW 2134 Jan-26: 100 -> 120
        spec["tables"]["T3"]["rows"][1][5] = 99  # NW 2134 Mar-26: [x] -> 99

    r = run_import(db_path, make_workbook("v2.xlsx", revise))
    assert r.updated == 2
    assert r.inserted == 3 + 2 + 3 + 1  # the new month for every monthly row
    assert obs(db_path, "2134", "TLD", "2026-01") == (120, "value", "T3", 1, 2)
    assert obs(db_path, "2134", "TLD", "2026-03")[:2] == (99, "value")
    assert obs(db_path, "2134", "TLD", "2026-04")[:2] == (5, "value")
    with sqlite3.connect(db_path) as c:
        revs = c.execute("SELECT period, old_adverts, new_adverts, old_status, new_status FROM observation_revisions "
                         "ORDER BY period").fetchall()
    assert revs == [("2026-01", 100, 120, "value", "value"), ("2026-03", None, 99, "suppressed", "value")]


def test_duplicate_rows_fail_without_writing(make_workbook, db_path):
    def dup(spec):
        spec["tables"]["T3"]["rows"].append(list(spec["tables"]["T3"]["rows"][1]))

    with pytest.raises(ValueError, match="Duplicate observation in T3: SOC 2134, location TLD, period 2026-01"):
        run_import(db_path, make_workbook(mutate=dup))
    assert snapshot(db_path) == []
    assert imports(db_path)[0][0] == "failed"


def test_bad_value_rolls_back_to_previous_release(make_workbook, db_path):
    run_import(db_path, make_workbook("good.xlsx"))
    before = snapshot(db_path)

    def corrupt(spec):
        spec["tables"]["T2"]["rows"][0][5] = "n/a"

    with pytest.raises(WorkbookError, match=r"Table 2!F6: expected a whole number or '\[x\]', found 'n/a'"):
        run_import(db_path, make_workbook("bad.xlsx", corrupt))
    assert snapshot(db_path) == before
    status, error = imports(db_path)[-1]
    assert status == "failed" and "Table 2!F6" in error


@pytest.mark.parametrize(
    "mutate, message",
    [
        (lambda s: s["tables"]["T3"]["columns"].__setitem__(1, "SOC code"), r"Table 3 row 5: expected columns"),
        (lambda s: s["tables"].pop("T4"), r"Couldn't find these tables by title: T4"),
        (lambda s: s["months"].__setitem__(1, "Mar-26"), r"periods not consecutive"),
        (lambda s: s["tables"]["T2"]["rows"][0].__setitem__(3, "M123"), r"expected a local authority code"),
        (lambda s: s["tables"]["T3"]["rows"][0].__setitem__(1, 2134), r"expected a 4-digit SOC code as text"),
    ],
)
def test_changed_layout_is_rejected(make_workbook, db_path, mutate, message):
    with pytest.raises(WorkbookError, match=message):
        run_import(db_path, make_workbook(mutate=mutate))
    assert snapshot(db_path) == []


def test_failure_midway_rolls_back_everything(make_workbook, db_path, monkeypatch):
    run_import(db_path, make_workbook("v1.xlsx"))
    before = snapshot(db_path)

    def boom(*args, **kwargs):
        raise RuntimeError("disk full")

    monkeypatch.setattr(importer, "_upsert_reference", boom)

    def change(spec):
        spec["tables"]["T1"]["rows"][0][1] = 5

    with pytest.raises(RuntimeError):
        run_import(db_path, make_workbook("v2.xlsx", change))
    assert snapshot(db_path) == before
    with sqlite3.connect(db_path) as c:
        assert c.execute("SELECT COUNT(*) FROM observation_revisions").fetchone()[0] == 0
    assert imports(db_path)[-1] == ("failed", "RuntimeError: disk full")


def test_not_a_workbook(tmp_path, db_path):
    bogus = tmp_path / "notes.xlsx"
    bogus.write_text("hello")
    with pytest.raises(WorkbookError, match="Couldn't open notes.xlsx"):
        run_import(db_path, bogus)
