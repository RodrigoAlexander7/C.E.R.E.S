"""ET0 y lluvia efectiva contra ejemplos publicados por FAO (no contra el propio código)."""

from datetime import date

import pytest

from ceres.domain.climate import (
    ClimateSeries,
    DailyWeather,
    effective_rain_monthly,
    et0_fao56,
    historical_windows,
    pressure_from_elevation,
    shift_to_year,
    thermal_exposure,
)


def test_fao56_example_18_bruselas_6_julio():
    """FAO-56, cap. 4, Ejemplo 18: Bruselas, 6 de julio, 50°48'N, 100 m.

    Valores publicados: P=100,1 kPa; es=1,997; ea=1,409; Ra=41,09; Rso=30,90; Rns=16,99;
    Rnl=3,71; Rn=13,28 MJ m⁻² d⁻¹; ET0 = 3,9 mm/día. Rs=22,07 se toma del ejemplo (n = 9,25 h).
    """
    r = et0_fao56(
        t_max=21.5,
        t_min=12.3,
        u2=2.078,
        rs=22.07,
        lat_deg=50 + 48 / 60,
        doy=187,
        elevation_m=100,
        rh_max=84,
        rh_min=63,
    )
    assert pressure_from_elevation(100) == pytest.approx(100.1, abs=0.05)
    assert r.es == pytest.approx(1.997, abs=0.002)
    assert r.ea == pytest.approx(1.409, abs=0.002)
    assert r.ra == pytest.approx(41.09, abs=0.05)
    assert r.rso == pytest.approx(30.90, abs=0.05)
    assert r.rns == pytest.approx(16.99, abs=0.02)
    assert r.rnl == pytest.approx(3.71, abs=0.02)
    assert r.rn == pytest.approx(13.28, abs=0.03)
    assert r.et0 == pytest.approx(3.9, abs=0.05)


@pytest.mark.parametrize(
    "p, pe",
    # FAO Irrigation Water Management, Training Manual 3, sección 4.2 (ejemplo resuelto).
    [(35, 11), (90, 47), (116, 68), (5, 0), (260, 183), (75, 35)],
)
def test_effective_rain_fao_training_manual_3(p, pe):
    assert effective_rain_monthly(p) == pytest.approx(pe, abs=0.5)


def test_effective_rain_rejects_negative():
    with pytest.raises(ValueError):
        effective_rain_monthly(-1)


def _series(start: date, n: int, t_min=10.0, missing: set[date] | None = None):
    from datetime import timedelta

    missing = missing or set()
    days = []
    for i in range(n):
        d = start + timedelta(days=i)
        days.append(
            DailyWeather(d, 15, None if d in missing else t_min, 22, 0.0, 50, 2, 20, 90)
        )
    return ClimateSeries.from_days(days, latitude=-16.35, elevation_m=1400)


def test_leap_day_maps_to_28_february():
    assert shift_to_year(date(2028, 2, 29), 2023) == date(2023, 2, 28)
    assert shift_to_year(date(2028, 2, 29), 2024) == date(2024, 2, 29)


def test_windows_crossing_year_need_complete_data():
    s = _series(date(2015, 1, 1), 365 * 3 + 1)  # 2015-01-01 .. 2018-01-01
    w = historical_windows(s, date(2027, 12, 1), date(2028, 1, 31))
    assert [y for y, _, _ in w] == [2015, 2016]  # 2017-12 → 2018-01-31 no está completo


def test_missing_values_are_not_zero():
    missing = {date(2015, 6, 10)}
    s = _series(date(2015, 1, 1), 365 * 2, t_min=-5, missing=missing)
    exp = thermal_exposure(s, date(2030, 6, 1), date(2030, 6, 30), "t_min", "<", 0)
    # 2015 tiene un ausente en la ventana → no se evalúa; 2016 sí.
    assert exp.years_evaluated == 1
    assert exp.mean_days_per_year == 30
    assert s.incomplete_days == 1
