import json

import pytest

from ons import export
from ons.export import run_export
from ons.importer import run_import


def load(out, rel):
    return json.loads((out / rel).read_text())


@pytest.fixture
def out(make_workbook, db_path, tmp_path):
    run_import(db_path, make_workbook())
    out = tmp_path / "public" / "data"
    run_export(db_path, out)
    return out


def test_writes_every_file(out):
    names = sorted(str(p.relative_to(out)) for p in out.rglob("*.json"))
    assert names == ["group/213.json", "meta.json", "occupation/2134.json", "overview.json", "search.json"]


def test_meta(out):
    meta = load(out, "meta.json")
    assert meta["releaseLabel"] == "January 2017 - March 2026"
    assert meta["publishedOn"] == "2026-04-25"
    assert (meta["latestMonth"], meta["latestQuarter"]) == ("2026-03", "2026-Q1")
    assert meta["withheldEverywhere"] == ["2026-Q1"]  # Mar-26 still has a figure for unknown jobs


def test_search_leaves_out_unknowns_and_countries(out):
    s = load(out, "search.json")
    assert [o["soc"] for o in s["occupations"]] == ["2134"]
    assert s["occupations"][0]["group"] == "213"
    assert s["groups"]["213"]["name"] == "Information Technology Professionals"
    places = {p["code"]: p for p in s["places"]}
    assert set(places) == {"K02000001", "TLD", "TLI", "E08000003"}
    assert places["E08000003"]["region"] == "TLD" and places["TLD"]["region"] is None


def test_occupation_shard_monthly_and_quarterly(out):
    o = load(out, "occupation/2134.json")
    assert o["months"] == {"start": "2026-01", "end": "2026-03"}
    assert o["quarters"] == {"start": "2025-Q4", "end": "2026-Q1"}
    assert o["monthly"]["K02000001"]["v"] == [1000, 0, None]  # real zero kept, [x] stays missing
    assert o["monthly"]["TLD"]["v"] == [100, 105, None]
    assert o["monthly"]["TLD"]["m"]["latest"] == {"period": "2026-02", "value": 105}
    assert "UNKNOWN" not in o["monthly"]

    q = o["quarterly"]
    assert q["E08000003"]["v"] == [300, None] and "derived" not in q["E08000003"]
    assert q["TLD"] == {"v": [None, None], "m": None, "derived": True}  # Q1 has a withheld month, Q4 no months


def test_group_shard_has_local_authorities_and_london(out):
    g = load(out, "group/213.json")
    assert set(g["monthly"]) == {"E08000003"}  # the test workbook has no London row in Table 4
    assert g["monthly"]["E08000003"]["v"] == [50, 0, None]


def test_overview(out):
    o = load(out, "overview.json")
    assert o["uk"]["v"] == [1000, 1100, None]
    assert o["rising"] == [] and o["falling"] == []  # not enough history for a year-on-year


def test_failed_export_keeps_previous_files(out, db_path, monkeypatch):
    before = (out / "meta.json").read_text()

    def boom(path, data):
        raise OSError("disk full")

    monkeypatch.setattr(export, "_write", boom)
    with pytest.raises(OSError):
        run_export(db_path, out)
    assert (out / "meta.json").read_text() == before
    assert not out.with_name("data.tmp").exists()


def test_no_database(tmp_path):
    with pytest.raises(FileNotFoundError, match="pnpm data:import"):
        run_export(tmp_path / "none.sqlite", tmp_path / "out")
