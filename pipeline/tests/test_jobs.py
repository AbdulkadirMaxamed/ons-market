import json

import pytest

from ons.export import run_export
from ons.importer import run_import
from ons.jobs import DEFAULT_JOBS, job_names, load_jobs

OCCS = [("2134", "Programmers and software development professionals", "programmers-and-software-development-professionals"),
        ("5241", "Electricians and electrical fitters", "electricians-and-electrical-fitters"),
        ("2240", "Veterinarians", "veterinarians")]


def write(tmp_path, text):
    p = tmp_path / "jobs.toml"
    p.write_text(text)
    return p


def test_short_name_becomes_the_name_and_url_and_keeps_the_old_one(tmp_path):
    names, unused = job_names(OCCS, write(tmp_path, '[2134]\nshort = "Software developers"\naliases = ["Dev", "dev"]\n'))
    j = names["2134"]
    assert (j.name, j.slug, j.ons) == ("Software developers", "software-developers", OCCS[0][1])
    assert j.old_slug == "programmers-and-software-development-professionals"
    assert j.aliases == ("dev",)  # lower-cased, de-duplicated
    assert names["2240"].old_slug is None and names["2240"].name == "Veterinarians"
    assert unused == []


def test_aliases_alone_keep_the_ons_name_and_url(tmp_path):
    names, _ = job_names(OCCS, write(tmp_path, '[2240]\naliases = ["vet"]\n'))
    assert (names["2240"].name, names["2240"].slug, names["2240"].old_slug) == ("Veterinarians", "veterinarians", None)


def test_codes_not_in_the_data_are_reported_not_fatal(tmp_path):
    _, unused = job_names(OCCS, write(tmp_path, '[9999]\naliases = ["x"]\n'))
    assert unused == ["9999"]


@pytest.mark.parametrize("text, message", [
    ('[2134]\nshort = "Veterinarians"\n', "both have the name"),
    ('[2134]\nshort = "Electricians"\n[5241]\nshort = "Electricians"\n', "both have the name"),
    ('[2134]\nshort = "Veterinarians!"\n', "both have the slug"),
    ('[2134]\n', "empty entry"),
    ('[2134]\nshort = ""\n', "non-empty"),
    ('[2134]\nnickname = "x"\n', "unknown key"),
    ('[21]\naliases = ["x"]\n', "4-digit"),
    ('[2134]\naliases = "dev"\n', "list of words"),
])
def test_bad_entries_stop_with_a_clear_message(tmp_path, text, message):
    with pytest.raises(ValueError, match=message):
        job_names(OCCS, write(tmp_path, text))


def test_real_file_is_valid():
    jobs = load_jobs(DEFAULT_JOBS)
    assert jobs["2134"]["short"] == "Software developers"
    assert "sparky" in jobs["5241"]["aliases"]


def test_export_writes_friendly_names(make_workbook, db_path, jobs_path, tmp_path):
    run_import(db_path, make_workbook())
    out = tmp_path / "out"
    r = run_export(db_path, out, jobs_path=jobs_path)
    assert r.unused_jobs == ["9999"]
    s = json.loads((out / "search.json").read_text())
    assert s["occupations"] == [{
        "soc": "2134", "name": "Software developers", "slug": "software-developers", "group": "213", "pop": 1,
        "ons": "Programmers and software development professionals", "aliases": ["dev", "programmer"],
        "old": "programmers-and-software-development-professionals",
    }]
    occ = json.loads((out / "occupation/2134.json").read_text())
    assert (occ["name"], occ["slug"], occ["ons"]) == ("Software developers", "software-developers",
                                                      "Programmers and software development professionals")
