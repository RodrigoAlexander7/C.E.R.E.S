"""Clima histórico: ET0 FAO-56 Penman–Monteith diaria, lluvia efectiva y estadísticas por ventana.

Funciones puras. Unidades: °C, %, m/s a 2 m, MJ m⁻² d⁻¹, kPa, mm/día.
El histórico describe años pasados; no es un pronóstico de la próxima campaña.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta

ET0_METHOD_ID = "FAO56-PM-diaria"
EFFECTIVE_RAIN_METHOD_ID = "FAO-TM3-mensual"


@dataclass(frozen=True)
class DailyWeather:
    day: date
    t_mean: float | None
    t_min: float | None
    t_max: float | None
    precipitation_mm: float | None
    rh_mean: float | None
    wind_2m: float | None
    solar_mj: float | None
    pressure_kpa: float | None


@dataclass(frozen=True)
class Et0Breakdown:
    delta: float
    gamma: float
    es: float
    ea: float
    ra: float
    rso: float
    rns: float
    rnl: float
    rn: float
    et0: float


def sat_vapour_pressure(t: float) -> float:
    """e°(T) en kPa (FAO-56, ec. 11)."""
    return 0.6108 * math.exp(17.27 * t / (t + 237.3))


def pressure_from_elevation(z_m: float) -> float:
    """Presión atmosférica en kPa (FAO-56, ec. 7)."""
    return 101.3 * ((293 - 0.0065 * z_m) / 293) ** 5.26


def extraterrestrial_radiation(lat_deg: float, doy: int) -> float:
    """Ra en MJ m⁻² d⁻¹ (FAO-56, ec. 21–25)."""
    phi = math.radians(lat_deg)
    dr = 1 + 0.033 * math.cos(2 * math.pi / 365 * doy)
    decl = 0.409 * math.sin(2 * math.pi / 365 * doy - 1.39)
    ws = math.acos(max(-1.0, min(1.0, -math.tan(phi) * math.tan(decl))))
    gsc = 0.0820
    return (
        24 * 60 / math.pi * gsc * dr
        * (ws * math.sin(phi) * math.sin(decl) + math.cos(phi) * math.cos(decl) * math.sin(ws))
    )


def et0_fao56(
    *,
    t_max: float,
    t_min: float,
    u2: float,
    rs: float,
    lat_deg: float,
    doy: int,
    elevation_m: float,
    pressure_kpa: float | None = None,
    rh_max: float | None = None,
    rh_min: float | None = None,
    rh_mean: float | None = None,
) -> Et0Breakdown:
    """ET0 diaria (mm/día) con FAO-56 Penman–Monteith, ec. 6; G = 0 a escala diaria.

    La humedad se toma de RHmax/RHmin (ec. 17) o, si solo hay media, de la ec. 19.
    """

    if t_max < t_min:
        raise ValueError("t_max < t_min")
    if u2 < 0 or rs < 0:
        raise ValueError("viento y radiación no pueden ser negativos")
    t_mean = (t_max + t_min) / 2
    p = pressure_kpa if pressure_kpa is not None else pressure_from_elevation(elevation_m)
    gamma = 0.665e-3 * p
    delta = 4098 * sat_vapour_pressure(t_mean) / (t_mean + 237.3) ** 2
    e_tmax = sat_vapour_pressure(t_max)
    e_tmin = sat_vapour_pressure(t_min)
    es = (e_tmax + e_tmin) / 2
    if rh_max is not None and rh_min is not None:
        ea = (e_tmin * rh_max / 100 + e_tmax * rh_min / 100) / 2
    elif rh_mean is not None:
        ea = rh_mean / 100 * es
    else:
        raise ValueError("falta humedad relativa")
    ra = extraterrestrial_radiation(lat_deg, doy)
    rso = (0.75 + 2e-5 * elevation_m) * ra
    rns = (1 - 0.23) * rs
    sigma = 4.903e-9
    rs_rso = min(rs / rso, 1.0) if rso > 0 else 0.0
    rnl = (
        sigma
        * ((t_max + 273.16) ** 4 + (t_min + 273.16) ** 4)
        / 2
        * (0.34 - 0.14 * math.sqrt(max(ea, 0.0)))
        * (1.35 * rs_rso - 0.35)
    )
    rn = rns - rnl
    g = 0.0
    et0 = (0.408 * delta * (rn - g) + gamma * 900 / (t_mean + 273) * u2 * (es - ea)) / (
        delta + gamma * (1 + 0.34 * u2)
    )
    return Et0Breakdown(delta, gamma, es, ea, ra, rso, rns, rnl, rn, max(et0, 0.0))


def effective_rain_monthly(p_month_mm: float) -> float:
    """Lluvia efectiva mensual (FAO, Training Manual 3, cap. 3):
    Pe = 0,8·P − 25 si P > 75 mm/mes; Pe = 0,6·P − 10 si P ≤ 75 mm/mes; nunca negativa.
    Fórmula empírica para climas áridos/semiáridos; no considera reserva del suelo.
    """
    if p_month_mm < 0:
        raise ValueError("precipitación negativa")
    pe = 0.8 * p_month_mm - 25 if p_month_mm > 75 else 0.6 * p_month_mm - 10
    return max(pe, 0.0)


@dataclass
class ClimateSeries:
    """Serie diaria indexada por fecha con ET0 calculada y días incompletos marcados."""

    latitude: float
    elevation_m: float
    days: dict[date, DailyWeather]
    et0: dict[date, float] = field(default_factory=dict)
    incomplete_days: int = 0

    @classmethod
    def from_days(cls, days: list[DailyWeather], latitude: float, elevation_m: float) -> "ClimateSeries":
        series = cls(latitude=latitude, elevation_m=elevation_m, days={d.day: d for d in days})
        for d in days:
            if None in (d.t_max, d.t_min, d.wind_2m, d.solar_mj, d.rh_mean):
                series.incomplete_days += 1
                continue
            series.et0[d.day] = et0_fao56(
                t_max=d.t_max,
                t_min=d.t_min,
                u2=d.wind_2m,
                rs=d.solar_mj,
                lat_deg=latitude,
                doy=d.day.timetuple().tm_yday,
                elevation_m=elevation_m,
                pressure_kpa=d.pressure_kpa,
                rh_mean=d.rh_mean,
            ).et0
        return series

    @property
    def years(self) -> list[int]:
        """Años calendario completos disponibles."""
        if not self.days:
            return []
        first, last = min(self.days), max(self.days)
        out = []
        for y in range(first.year, last.year + 1):
            if first <= date(y, 1, 1) and date(y, 12, 31) <= last:
                out.append(y)
        return out


def shift_to_year(d: date, year: int) -> date:
    """Lleva una fecha futura a otro año histórico; 29-feb pasa a 28-feb en años no bisiestos."""
    try:
        return d.replace(year=year)
    except ValueError:
        return d.replace(year=year, day=28)


def historical_windows(series: ClimateSeries, start: date, end: date) -> list[tuple[int, date, date]]:
    """Ventanas históricas equivalentes [start, end] completas dentro de la serie.

    El año de anclaje es el del inicio; si la ventana cruza de año, termina en el siguiente.
    Solo se devuelven ventanas cuyo rango completo existe en los datos.
    """
    if end < start:
        raise ValueError("fin anterior al inicio")
    span_years = end.year - start.year
    if not series.days:
        return []
    first, last = min(series.days), max(series.days)
    out = []
    for y in range(first.year, last.year + 1):
        s = shift_to_year(start, y)
        e = shift_to_year(end, y + span_years)
        if first <= s and e <= last:
            out.append((y, s, e))
    return out


@dataclass(frozen=True)
class WindowClimate:
    years_used: int
    et0_mm_mean: float | None
    et0_mm_min: float | None
    et0_mm_max: float | None
    rain_mm_mean: float | None
    t_min_mean: float | None
    t_max_mean: float | None


def window_climate(series: ClimateSeries, start: date, end: date) -> WindowClimate:
    windows = historical_windows(series, start, end)
    et0_totals, rain_totals, tmins, tmaxs = [], [], [], []
    for _, s, e in windows:
        n = (e - s).days + 1
        days = [s + timedelta(days=i) for i in range(n)]
        et0_vals = [series.et0[d] for d in days if d in series.et0]
        if len(et0_vals) == n:
            et0_totals.append(sum(et0_vals))
        rains = [series.days[d].precipitation_mm for d in days if d in series.days]
        if len(rains) == n and None not in rains:
            rain_totals.append(sum(rains))
        tmins.extend(series.days[d].t_min for d in days if d in series.days and series.days[d].t_min is not None)
        tmaxs.extend(series.days[d].t_max for d in days if d in series.days and series.days[d].t_max is not None)

    def mean(xs):
        return sum(xs) / len(xs) if xs else None

    return WindowClimate(
        years_used=len(et0_totals),
        et0_mm_mean=mean(et0_totals),
        et0_mm_min=min(et0_totals) if et0_totals else None,
        et0_mm_max=max(et0_totals) if et0_totals else None,
        rain_mm_mean=mean(rain_totals),
        t_min_mean=mean(tmins),
        t_max_mean=mean(tmaxs),
    )


@dataclass(frozen=True)
class ThermalExposure:
    """Frecuencia histórica de días fuera de un umbral durante una etapa."""

    variable: str  # "t_min" | "t_max"
    comparator: str  # "<" | ">"
    threshold_c: float
    years_evaluated: int
    years_with_events: int
    mean_days_per_year: float

    @property
    def share_of_years(self) -> float:
        return self.years_with_events / self.years_evaluated if self.years_evaluated else 0.0


def thermal_exposure(
    series: ClimateSeries, start: date, end: date, variable: str, comparator: str, threshold_c: float
) -> ThermalExposure:
    if variable not in ("t_min", "t_max") or comparator not in ("<", ">"):
        raise ValueError("umbral térmico mal definido")
    years_eval, years_events, counts = 0, 0, []
    for _, s, e in historical_windows(series, start, end):
        n = (e - s).days + 1
        values = [getattr(series.days.get(s + timedelta(days=i)), variable, None) for i in range(n)]
        values = [v for v in values if v is not None]
        if len(values) < n:  # ventana con ausentes: no se evalúa ese año
            continue
        years_eval += 1
        hits = sum(1 for v in values if (v < threshold_c if comparator == "<" else v > threshold_c))
        counts.append(hits)
        if hits:
            years_events += 1
    return ThermalExposure(
        variable=variable,
        comparator=comparator,
        threshold_c=threshold_c,
        years_evaluated=years_eval,
        years_with_events=years_events,
        mean_days_per_year=sum(counts) / len(counts) if counts else 0.0,
    )


def monthly_climatology(series: ClimateSeries) -> list[dict]:
    """Promedios mensuales (años completos) para el contexto público."""
    out = []
    years = series.years
    for m in range(1, 13):
        et0_m, rain_m, tmin_m, tmax_m = [], [], [], []
        for y in years:
            days = [d for d in series.days if d.year == y and d.month == m]
            et = [series.et0[d] for d in days if d in series.et0]
            if len(et) == len(days):
                et0_m.append(sum(et))
            r = [series.days[d].precipitation_mm for d in days]
            if None not in r:
                rain_m.append(sum(r))
            tmin_m.extend(series.days[d].t_min for d in days if series.days[d].t_min is not None)
            tmax_m.extend(series.days[d].t_max for d in days if series.days[d].t_max is not None)
        out.append(
            {
                "month": m,
                "et0_mm": round(sum(et0_m) / len(et0_m), 1) if et0_m else None,
                "rain_mm": round(sum(rain_m) / len(rain_m), 1) if rain_m else None,
                "t_min_c": round(sum(tmin_m) / len(tmin_m), 1) if tmin_m else None,
                "t_max_c": round(sum(tmax_m) / len(tmax_m), 1) if tmax_m else None,
                "years": len(et0_m),
            }
        )
    return out
