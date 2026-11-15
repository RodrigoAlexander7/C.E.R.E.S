"""Fases ENSO a partir del ONI (NOAA) y clasificación de campañas históricas. Funciones puras.

Definición operativa de NOAA CPC: El Niño cuando el ONI es ≥ +0,5 °C y La Niña cuando es ≤ −0,5 °C
durante al menos 5 trimestres móviles consecutivos. El ONI mide el Pacífico central (Niño 3.4):
el «Niño costero» peruano (Niño 1+2, p. ej. 2017) puede no aparecer como El Niño en este índice.
"""

from __future__ import annotations

from datetime import date, timedelta

PHASES = ("el_nino", "la_nina", "neutro")
PHASE_LABEL = {"el_nino": "El Niño", "la_nina": "La Niña", "neutro": "Neutro (normal)"}
THRESHOLD = 0.5
MIN_RUN = 5


def monthly_phases(anomalies: dict[tuple[int, int], float]) -> dict[tuple[int, int], str]:
    """(año, mes central) → fase, aplicando la regla de 5 trimestres consecutivos."""
    keys = sorted(anomalies)
    out = {k: "neutro" for k in keys}
    for phase, test in (("el_nino", lambda v: v >= THRESHOLD), ("la_nina", lambda v: v <= -THRESHOLD)):
        run: list[tuple[int, int]] = []
        for k in keys + [None]:
            if k is not None and test(anomalies[k]) and (not run or _next_month(run[-1]) == k):
                run.append(k)
                continue
            if len(run) >= MIN_RUN:
                for r in run:
                    out[r] = phase
            run = [k] if (k is not None and test(anomalies[k])) else []
    return out


def _next_month(k: tuple[int, int]) -> tuple[int, int]:
    y, m = k
    return (y + 1, 1) if m == 12 else (y, m + 1)


def campaign_phase(start: date, end: date, phases: dict[tuple[int, int], str]) -> str | None:
    """Fase de una campaña: la que cubre al menos la mitad de sus días; si ninguna, «neutro».
    None si algún mes de la campaña no tiene ONI."""
    counts = {p: 0 for p in PHASES}
    d, n = start, 0
    while d <= end:
        ph = phases.get((d.year, d.month))
        if ph is None:
            return None
        counts[ph] += 1
        n += 1
        d += timedelta(days=1)
    for ph in ("el_nino", "la_nina"):
        if counts[ph] * 2 >= n:
            return ph
    return "neutro"
