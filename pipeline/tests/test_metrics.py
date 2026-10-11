"""Edge cases from docs/01-architecture.md §6. Numbers here are made up for the tests."""

import pytest

from ons.metrics import change, months_to_quarters, series_metrics, trend


def months(n, start=(2020, 1)):
    y, m = start
    out = []
    for _ in range(n):
        out.append(f"{y}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def quarters(n, start=(2020, 1)):
    y, q = start
    out = []
    for _ in range(n):
        out.append(f"{y}-Q{q}")
        y, q = (y + 1, 1) if q == 4 else (y, q + 1)
    return out


@pytest.mark.parametrize(
    "current, base, expected",
    [
        (120, 100, {"s": "ok", "abs": 20, "pct": 20.0}),
        (100, 120, {"s": "ok", "abs": -20, "pct": -16.7}),
        (100, None, {"s": "missing"}),
        (None, 100, {"s": "missing"}),
        (50, 0, {"s": "zero", "abs": 50}),
        (0, 0, {"s": "zero", "abs": 0}),
        (29, 100, {"s": "small", "abs": -71}),
        (100, 29, {"s": "small", "abs": 71}),
        (30, 30, {"s": "ok", "abs": 0, "pct": 0.0}),
        (0, 100, {"s": "small", "abs": -100}),  # a real zero is a value, but too small for a percentage
    ],
)
def test_change(current, base, expected):
    assert change(current, base) == expected


@pytest.mark.parametrize(
    "pct, word", [(10.0, "up"), (9.9, "flat"), (0.0, "flat"), (-9.9, "flat"), (-10.0, "down"), (-50.0, "down")]
)
def test_trend_threshold_is_ten_percent(pct, word):
    assert trend({"s": "ok", "pct": pct}) == word


def test_trend_without_a_usable_comparison():
    assert trend({"s": "small"}) == "small"
    assert trend({"s": "missing"}) == "na"
    assert trend({"s": "zero"}) == "na"


def test_all_missing_series_has_no_metrics():
    assert series_metrics([None, None], months(2), "M") is None


def test_lengths_must_match():
    with pytest.raises(ValueError):
        series_metrics([1, 2], months(3), "M")


def test_quarterly_year_on_year_and_previous():
    v = [100] * 4 + [200, 150, 300, 250]
    m = series_metrics(v, quarters(8), "Q")
    assert m["latest"] == {"period": "2021-Q4", "value": 250}
    assert m["prev"] == {"period": "2021-Q3", "value": 300, "s": "ok", "abs": -50, "pct": -16.7}
    assert m["yoy"] == {"period": "2020-Q4", "value": 100, "s": "ok", "abs": 150, "pct": 150.0}
    assert m["basis"] == "yoy" and m["trend"] == "up"
    assert "roll" not in m


def test_withheld_newest_period_falls_back_to_latest_with_a_figure():
    v = [100] * 5 + [120, None]
    m = series_metrics(v, quarters(7), "Q")
    assert m["latest"] == {"period": "2021-Q2", "value": 120}
    assert m["newest"] == "2021-Q3"
    assert m["yoy"]["period"] == "2020-Q2" and m["yoy"]["pct"] == 20.0


def test_withheld_comparison_period_gives_no_percentage():
    v = [None] + [100] * 3 + [130]
    m = series_metrics(v, quarters(5), "Q")
    assert m["yoy"] == {"period": "2020-Q1", "value": None, "s": "missing"}
    assert m["trend"] == "na"


def test_zero_comparison_period_gives_no_percentage():
    v = [0, 50, 50, 50, 80]
    m = series_metrics(v, quarters(5), "Q")
    assert m["yoy"]["s"] == "zero" and "pct" not in m["yoy"]
    assert m["yoy"]["value"] == 0  # a real zero stays zero


def test_not_enough_history_for_a_year_on_year():
    m = series_metrics([100, 120], quarters(2), "Q")
    assert m["yoy"] == {"period": None, "value": None, "s": "missing"}
    assert m["trend"] == "na"


def test_small_numbers_get_no_percentage_or_trend_word():
    v = [10] * 4 + [25]
    m = series_metrics(v, quarters(5), "Q")
    assert m["yoy"] == {"period": "2020-Q1", "value": 10, "s": "small", "abs": 15}
    assert m["trend"] == "small"


def test_monthly_prefers_the_three_month_window():
    # Same three months a year earlier: 100+100+100. Last three: 90+95+150. The single month alone says +50%.
    v = [100] * 12 + [100] * 9 + [90, 95, 150]
    m = series_metrics(v, months(24), "M")
    assert m["yoy"]["pct"] == 50.0
    assert m["roll"] == {"from": "2021-10", "to": "2021-12", "cur": 335, "base": 300, "s": "ok", "abs": 35,
                         "pct": 11.7}
    assert m["basis"] == "roll" and m["trend"] == "up"


def test_monthly_window_needs_an_average_of_30_a_month():
    # Data entry administrators, Wales, Aug 2026: 59 against 31 over 3 months is under 90 a window.
    v = [100] * 9 + [10, 10, 11] + [100] * 9 + [20, 20, 19]
    m = series_metrics(v, months(24), "M")
    assert m["roll"]["s"] == "small" and "pct" not in m["roll"]
    assert m["basis"] == "roll" and m["trend"] == "small"


def test_small_window_does_not_fall_back_to_a_big_single_month():
    # Window 90 vs 85 is too small, though the single months (50 vs 35) would pass the 30 rule on their own.
    v = [100] * 9 + [25, 25, 35] + [100] * 9 + [20, 20, 50]
    m = series_metrics(v, months(24), "M")
    assert m["yoy"]["s"] == "ok"
    assert m["basis"] == "roll" and m["roll"]["s"] == "small" and m["trend"] == "small"


def test_monthly_window_with_a_gap_falls_back_to_the_single_month():
    v = [100] * 12 + [100] * 9 + [None, 100, 105]
    m = series_metrics(v, months(24), "M")
    assert m["roll"]["s"] == "missing" and m["roll"]["cur"] is None
    assert m["basis"] == "yoy" and m["trend"] == "flat"


def test_monthly_window_uses_the_latest_month_with_a_figure():
    v = [100] * 12 + [100] * 9 + [100, 100, None]
    m = series_metrics(v, months(24), "M")
    assert m["latest"]["period"] == "2021-11"
    assert (m["roll"]["from"], m["roll"]["to"]) == ("2021-09", "2021-11")
    assert m["roll"]["base"] == 300


def test_five_year_average_needs_75_percent_coverage():
    full = [100] * 14 + [None] * 5 + [200]  # 15 of the last 20 quarters have a figure
    m = series_metrics(full, quarters(20), "Q")
    assert m["avg5y"] == {"value": 106.7, "n": 15, "s": "ok", "abs": 93.3, "pct": 87.5}

    short = [100] * 13 + [None] * 6 + [200]  # 14 of 20
    m = series_metrics(short, quarters(20), "Q")
    assert m["avg5y"] == {"value": None, "n": 14, "s": "missing"}
    assert m["pctile5y"] is None


def test_five_year_average_only_looks_back_five_years():
    v = [10_000] * 10 + [100] * 20
    m = series_metrics(v, quarters(30), "Q")
    assert m["avg5y"]["value"] == 100.0 and m["avg5y"]["n"] == 20


def test_percentile_and_twelve_month_high_low():
    v = [50, 60, 70, 80] * 5  # 20 quarters, latest 80
    m = series_metrics(v, quarters(20), "Q")
    assert m["pctile5y"] == 75  # 15 of 20 quarters were lower
    assert m["high12m"] == {"period": "2024-Q4", "value": 80}
    assert m["low12m"] == {"period": "2024-Q1", "value": 50}


def test_twelve_month_high_low_skip_missing():
    v = [5] * 12 + [40, None, 30] + [None] * 9
    m = series_metrics(v, months(24), "M")
    assert m["latest"]["period"] == "2021-03"
    assert m["high12m"] == {"period": "2021-01", "value": 40}
    assert m["low12m"] == {"period": "2020-04", "value": 5}


def test_months_to_quarters_needs_all_three_months():
    v = [1, 2, 3, 4, None, 6, 7, 8]
    q, p = months_to_quarters(v, months(8))
    assert p == ["2020-Q1", "2020-Q2"]  # Q3 has only two months so far
    assert q == [6, None]


def test_months_to_quarters_keeps_real_zeros():
    q, _ = months_to_quarters([0, 0, 0], months(3))
    assert q == [0]
