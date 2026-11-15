"""Motor de comparación de estrategias.

Orden: validar entradas → construir calendarios comparables → restricciones obligatorias →
estado → métricas → orden por prioridad solo entre opciones comparables → razones trazables.
El motor no usa el LLM ni inventa datos: un valor desconocido produce un faltante explícito.
"""

from __future__ import annotations

import calendar as _cal
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from ceres.domain.catalog import Catalog, CropProfile, StrategyTemplate
from ceres.domain.climate import (
    EFFECTIVE_RAIN_METHOD_ID,
    ET0_METHOD_ID,
    ClimateSeries,
    effective_rain_monthly,
    historical_windows,
)
from ceres.domain.model import (
    ComparisonResult,
    InvalidInput,
    Metric,
    ParcelInput,
    Reason,
    StrategyAssessment,
    TimelineBlock,
)

ENGINE_VERSION = "ceres-engine-0.1.0"
MM_HA_TO_M3 = 10.0  # 1 mm sobre 1 ha = 10 m³
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def add_months(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 + months, 12)
    year, month = d.year + y, m + 1
    day = min(d.day, _cal.monthrange(year, month)[1])
    return date(year, month, day)


def fmt(d: date) -> str:
    return f"{d.day} {MESES[d.month - 1]} {d.year}"


@dataclass
class ClimateInput:
    """Evidencia NASA cargada y su identificador; `series=None` si no hay copia real disponible."""

    snapshot_id: str | None
    series: ClimateSeries | None
    scale_note: str = ""

    def __post_init__(self) -> None:
        self._et0_clim: dict[tuple[int, int], float] = {}
        self._rain_clim: dict[tuple[int, int], float] = {}
        self._rain_month: dict[int, float] = {}
        if self.series is None:
            return
        et0_acc, rain_acc = defaultdict(list), defaultdict(list)
        for d, w in self.series.days.items():
            if d in self.series.et0:
                et0_acc[(d.month, d.day)].append(self.series.et0[d])
            if w.precipitation_mm is not None:
                rain_acc[(d.month, d.day)].append(w.precipitation_mm)
        self._et0_clim = {k: sum(v) / len(v) for k, v in et0_acc.items()}
        self._rain_clim = {k: sum(v) / len(v) for k, v in rain_acc.items()}
        month_tot = defaultdict(list)
        for y in self.series.years:
            for m in range(1, 13):
                vals = [
                    self.series.days[d].precipitation_mm
                    for d in self.series.days
                    if d.year == y and d.month == m
                ]
                if vals and None not in vals:
                    month_tot[m].append(sum(vals))
        self._rain_month = {m: sum(v) / len(v) for m, v in month_tot.items()}

    @property
    def available(self) -> bool:
        return self.series is not None and bool(self._et0_clim)

    def et0(self, d: date) -> float | None:
        return self._et0_clim.get((d.month, d.day)) or self._et0_clim.get((d.month, min(d.day, 28)))

    def rain(self, d: date) -> float | None:
        return self._rain_clim.get((d.month, d.day)) or self._rain_clim.get((d.month, min(d.day, 28)))

    def rain_month(self, m: int) -> float | None:
        return self._rain_month.get(m)


# ---------------------------------------------------------------- secuencias


def sequence_for(template: StrategyTemplate, p: ParcelInput, catalog: Catalog) -> tuple[list[str], list[str]]:
    """Devuelve (secuencia de cultivos a repetir, faltantes)."""
    current = p.current_crop_id
    if template.sequence_rule == "declarada":
        nxt = p.planned_next_crop_id or current
        missing = [] if catalog.crop(nxt) else [f"Ficha agronómica para «{catalog.non_catalog_crops.get(nxt, nxt)}»"]
        return [nxt], missing
    if template.sequence_rule == "leguminosa":
        return (["maiz_grano", "frejol_grano"] if current == "frejol_grano" else ["frejol_grano", "maiz_grano"]), []
    if template.sequence_rule == "diversificar":
        return (["maiz_grano", "cebolla_roja"] if current == "cebolla_roja" else ["cebolla_roja", "maiz_grano"]), []
    raise ValueError(template.sequence_rule)


def next_window_date(crop: CropProfile, earliest: date, limit: date) -> date | None:
    d = earliest
    while d <= limit:
        if any(w.contains(d) for w in crop.windows):
            return d
        d += timedelta(days=1)
    return None


@dataclass
class Cycle:
    crop: CropProfile
    prep_start: date
    plant: date
    harvest: date
    waited_days: int


def build_cycles(seq: list[str], catalog: Catalog, release: date, horizon_end: date) -> tuple[list[Cycle], list[str]]:
    """Ciclos completos dentro del horizonte; nunca trunca una cosecha."""
    cycles: list[Cycle] = []
    notes: list[str] = []
    available = release
    i = 0
    while True:
        crop = catalog.crop(seq[i % len(seq)])
        if crop is None:
            break
        earliest = available + timedelta(days=catalog.prep_days)
        plant = next_window_date(crop, earliest, horizon_end)
        if plant is None:
            notes.append(f"No cabe otra siembra de {crop.name} dentro de su ventana antes del fin del horizonte.")
            break
        harvest = plant + timedelta(days=crop.cycle_days - 1)
        if harvest > horizon_end:
            notes.append(
                f"{crop.name} sembrado el {fmt(plant)} se cosecharía el {fmt(harvest)}, después del horizonte: "
                "no se incluye un ciclo incompleto."
            )
            break
        cycles.append(Cycle(crop, available, plant, harvest, (plant - earliest).days))
        available = harvest + timedelta(days=1)
        i += 1
        if i > 20:
            break
    return cycles, notes


# ---------------------------------------------------------------- evaluación


def evaluate(p: ParcelInput, catalog: Catalog, climate: ClimateInput) -> ComparisonResult:
    p.validate()
    blocking: list[str] = []
    notes: list[str] = []

    if p.current_crop_id == "alfalfa":
        blocking.append(
            "La alfalfa establecida no se compara como un cultivo anual: requiere modelar instalación, edad, cortes y "
            "obligaciones forrajeras, que están fuera del MVP."
        )
    if not p.in_pilot_zone:
        blocking.append(
            "La parcela está fuera de la zona piloto (Majes I). Faltan fichas locales para recomendar; puedes explorar "
            "el mapa y las fuentes."
        )

    if p.current_status == "cosechado":
        release = p.reference_date
    elif p.expected_harvest is None:
        release = None
        blocking.append("Falta la fecha prevista de cosecha del cultivo actual: sin ella no se puede fijar el calendario.")
    else:
        if p.expected_harvest < p.reference_date - timedelta(days=366):
            raise InvalidInput("La fecha prevista de cosecha es muy antigua; si ya cosechaste, márcalo como cosechado")
        release = max(p.expected_harvest + timedelta(days=1), p.reference_date)

    start = release or p.reference_date
    horizon_end = add_months(start, catalog.horizon_months) - timedelta(days=1)

    strategies: list[StrategyAssessment] = []
    if not blocking:
        for t in catalog.templates:
            strategies.append(_assess(t, p, catalog, climate, start, horizon_end))
    if not climate.available:
        notes.append(
            "No hay una copia real de NASA POWER disponible: la demanda de agua y la exposición térmica quedan pendientes."
        )

    ordering = _order(strategies, p.priority)
    viable = [s for s in strategies if s.status == "viable_con_supuestos"]
    if strategies and len(viable) < 3:
        notes.append(
            f"Solo {len(viable)} de {len(strategies)} opciones son viables con los datos actuales; se muestran los motivos "
            "de las demás en lugar de fabricar alternativas."
        )
    notes.append(
        "Fechas orientativas para planificar. El clima es histórico (no pronóstico) y la decisión final es tuya."
    )

    return ComparisonResult(
        engine_version=ENGINE_VERSION,
        catalog_version=catalog.version,
        climate_snapshot_id=climate.snapshot_id if climate.available else None,
        priority=p.priority,
        horizon_start=start,
        horizon_end=horizon_end,
        strategies=strategies,
        ordering=ordering,
        associations=[_association_card(a) for a in catalog.associations],
        notes=notes,
        blocking=blocking,
    )


def _assess(
    t: StrategyTemplate, p: ParcelInput, catalog: Catalog, climate: ClimateInput, start: date, horizon_end: date
) -> StrategyAssessment:
    sid = t.id
    metrics: dict[str, Metric] = {}
    reasons: list[Reason] = []
    assumptions: list[str] = []
    missing: list[str] = []
    seq, seq_missing = sequence_for(t, p, catalog)
    missing += seq_missing
    if t.sequence_rule == "declarada" and not p.planned_next_crop_id:
        assumptions.append("No indicaste el siguiente cultivo: se supone que repites el cultivo actual.")

    if seq_missing:
        reasons.append(
            Reason(
                "CAT-01",
                "falta_dato",
                "El cultivo que planeas no tiene ficha agronómica en el catálogo de la demo; no se puede evaluar.",
                missing=seq_missing,
            )
        )
        return StrategyAssessment(
            sid, t.name, t.short, "requiere_datos", seq, [], metrics, reasons, assumptions, missing, [], {},
            "Requiere ficha agronómica del cultivo planeado.",
        )

    cycles, cal_notes = build_cycles(seq, catalog, start, horizon_end)
    timeline = _timeline(cycles, catalog, start, horizon_end, p)

    if not cycles:
        reasons.append(Reason("CAL-01", "no_cumple", "No cabe ningún ciclo completo en el horizonte común. " + " ".join(cal_notes)))
        return StrategyAssessment(
            sid, t.name, t.short, "no_viable", seq, timeline, metrics, reasons, assumptions, missing, [], {},
            "Ningún ciclo completo cabe en el horizonte.",
        )

    # --- calendario
    window_status = {c.crop.window_status for c in cycles}
    cal_sources = sorted({s for c in cycles for s in c.crop.window_source_ids + c.crop.stage_source_ids})
    reasons.append(
        Reason(
            "CAL-02",
            "cumple",
            f"{len(cycles)} ciclo(s) completo(s) entre {fmt(start)} y {fmt(horizon_end)}, respetando liberación del "
            f"terreno, {catalog.prep_days} días de preparación y ventanas de siembra.",
            source_ids=cal_sources,
            assumptions=(
                ["Ventanas de siembra y días de preparación son supuestos de demostración pendientes de revisión agronómica local."]
                if "supuesto_demo" in window_status
                else []
            ),
        )
    )
    if "supuesto_demo" in window_status:
        assumptions.append("Ventanas de siembra de demostración, sin revisión agronómica local.")
    for n in cal_notes:
        reasons.append(Reason("CAL-03", "informacion", n))
    metrics[f"{sid}.ciclos"] = Metric(f"{sid}.ciclos", "Ciclos completos en el horizonte", len(cycles), "ciclos", "derivado", "calendario")

    # --- antecedente
    prev = p.current_crop_id
    for c in cycles:
        if c.crop.id == prev:
            reasons.append(
                Reason(
                    "ANT-01",
                    "advertencia",
                    f"{c.crop.name} se repite después de sí mismo: monocultivo con mayor presión de plagas y enfermedades. "
                    "No hay cuantificación local de ese efecto en el catálogo.",
                    source_ids=["SENASA-BPA-FREJOL"],
                )
            )
            break
        prev = c.crop.id
    families = [c.crop.family for c in cycles]
    legumes = sum(1 for c in cycles if c.crop.is_legume)

    # --- suelo / salinidad
    salinity_factor: dict[str, float] = {}
    hard_fail = False
    crit_missing = False
    for crop in {c.crop.id: c.crop for c in cycles}.values():
        if crop.salinity_ece_threshold is None:
            continue
        ece = p.soil.ece_ds_m
        if ece is None:
            if crop.salinity_sensitive:
                crit_missing = True
                missing.append(f"Salinidad del suelo (CE del extracto, dS/m): {crop.name} es sensible")
                reasons.append(
                    Reason(
                        "SUE-01",
                        "falta_dato",
                        f"{crop.name} es sensible a sales (umbral {crop.salinity_ece_threshold} dS/m) y no hay análisis de "
                        "salinidad del suelo. Sin ese dato no se puede afirmar que sea viable.",
                        source_ids=list(crop.salinity_source_ids),
                        missing=["CE del extracto de saturación"],
                    )
                )
            else:
                assumptions.append(f"Salinidad no medida: se supone que no limita a {crop.name}.")
            continue
        if crop.salinity_ece_50 is not None and ece >= crop.salinity_ece_50:
            hard_fail = True
            reasons.append(
                Reason(
                    "SUE-02",
                    "no_cumple",
                    f"Con CE = {ece} dS/m, {crop.name} perdería la mitad o más del rendimiento potencial "
                    f"(50 % a {crop.salinity_ece_50} dS/m según FAO 29).",
                    metric_ids=[f"{sid}.suelo.ce"],
                    source_ids=list(crop.salinity_source_ids),
                )
            )
        elif ece > crop.salinity_ece_threshold:
            loss = 50 * (ece - crop.salinity_ece_threshold) / (crop.salinity_ece_50 - crop.salinity_ece_threshold)
            salinity_factor[crop.id] = 1 - loss / 100
            reasons.append(
                Reason(
                    "SUE-03",
                    "advertencia",
                    f"La salinidad ({ece} dS/m) supera el umbral de {crop.name} ({crop.salinity_ece_threshold} dS/m): "
                    f"se reduce el rendimiento estimado en {loss:.0f} %.",
                    metric_ids=[f"{sid}.suelo.ce"],
                    source_ids=list(crop.salinity_source_ids),
                    assumptions=["Interpolación lineal entre el umbral y el 50 % de FAO 29."],
                )
            )
        else:
            reasons.append(
                Reason(
                    "SUE-04",
                    "cumple",
                    f"La salinidad declarada ({ece} dS/m) no supera el umbral de {crop.name} ({crop.salinity_ece_threshold} dS/m).",
                    metric_ids=[f"{sid}.suelo.ce"],
                    source_ids=list(crop.salinity_source_ids),
                )
            )
    if p.soil.ece_ds_m is not None:
        metrics[f"{sid}.suelo.ce"] = Metric(
            f"{sid}.suelo.ce", "Salinidad del suelo (CE extracto)", p.soil.ece_ds_m, "dS/m", p.soil.kind, "análisis declarado",
            source_ids=["PARCELA"], detail=f"Fecha {p.soil.analysis_date or 'desconocida'}, profundidad {p.soil.depth_cm or '?'}, método {p.soil.method or '?'}",
        )

    # --- clima y agua
    monthly_water: list[dict] = []
    water_known = False
    if climate.available:
        monthly_water, water_known = _water(sid, cycles, p, climate, metrics, reasons, assumptions)
        for c in cycles:
            _thermal(sid, c, climate, metrics, reasons)
    else:
        missing.append("Serie climática NASA POWER (no disponible)")
        reasons.append(Reason("AGU-00", "falta_dato", "Sin datos NASA reales no se calcula la demanda de agua.", missing=["NASA POWER"]))
        crit_missing = True

    if p.water.mode == "no_se":
        crit_missing = True
        missing.append("Dotación de riego por mes en la toma de la parcela")
        reasons.append(
            Reason(
                "AGU-01",
                "falta_dato",
                "Indicaste que no sabes cuánta agua recibirás. La lluvia NASA no equivale al agua del canal: sin dotación "
                "no se puede confirmar que el ciclo tenga agua suficiente.",
                source_ids=["AGUA-LOCAL", "AUTODEMA-MAJES"],
                missing=["Dotación mensual (m³) y punto de entrega"],
            )
        )
    elif p.water.allocation_period == "anual":
        crit_missing = True
        missing.append("Dotación desagregada por mes")
        reasons.append(
            Reason(
                "AGU-02",
                "falta_dato",
                "Una dotación anual no demuestra disponibilidad en cada mes; se necesita la distribución mensual.",
                source_ids=["AGUA-LOCAL"],
                missing=["Dotación por mes"],
            )
        )
    elif p.water.efficiency is None:
        crit_missing = True
        missing.append("Eficiencia del sistema de riego")
        reasons.append(
            Reason(
                "AGU-03",
                "falta_dato",
                "Sin la eficiencia del riego no se puede pasar de riego neto a riego bruto en m³ y compararlo con tu dotación.",
                source_ids=["FAO-RIEGO-NETO-BRUTO"],
                missing=["Eficiencia de riego (fracción)"],
            )
        )
    elif water_known:
        exceeded = [m for m in monthly_water if m["gross_m3"] is not None and m["gross_m3"] > p.water.allocation_m3]
        if exceeded:
            hard_fail = True
            worst = max(exceeded, key=lambda m: m["gross_m3"] - p.water.allocation_m3)
            reasons.append(
                Reason(
                    "AGU-04",
                    "no_cumple",
                    f"En {len(exceeded)} mes(es) la demanda bruta supera tu dotación de {p.water.allocation_m3:,.0f} m³/mes; "
                    f"el peor es {worst['label']} con {worst['gross_m3']:,.0f} m³. Un margen alto no compensa la falta de agua.",
                    metric_ids=[f"{sid}.agua.max_mes_m3", f"{sid}.agua.dotacion_m3"],
                    source_ids=["NASA-POWER", "FAO56-PM", "FAO-TM3-PE", "PARCELA"],
                )
            )
        else:
            reasons.append(
                Reason(
                    "AGU-05",
                    "cumple",
                    f"La demanda bruta mensual estimada no supera tu dotación de {p.water.allocation_m3:,.0f} m³/mes en ningún mes.",
                    metric_ids=[f"{sid}.agua.max_mes_m3", f"{sid}.agua.dotacion_m3"],
                    source_ids=["NASA-POWER", "FAO56-PM", "FAO-TM3-PE", "PARCELA"],
                    assumptions=["Dotación declarada igual en todos los meses, medida en la toma de la parcela."],
                )
            )
        metrics[f"{sid}.agua.dotacion_m3"] = Metric(
            f"{sid}.agua.dotacion_m3", "Dotación declarada", p.water.allocation_m3, "m³/mes", "declarado", "declaración del agricultor",
            source_ids=["PARCELA"],
        )

    # --- economía
    econ_ok = _economics(sid, cycles, p, catalog, salinity_factor, metrics, reasons, assumptions, missing)
    if econ_ok and p.budget_soles is not None:
        need = metrics[f"{sid}.eco.capital"].value
        if need is not None and need > p.budget_soles:
            hard_fail = True
            reasons.append(
                Reason(
                    "ECO-03",
                    "no_cumple",
                    f"El capital necesario antes de la primera cosecha (S/ {need:,.0f}) supera tu presupuesto (S/ {p.budget_soles:,.0f}).",
                    metric_ids=[f"{sid}.eco.capital"],
                    source_ids=["PARCELA"],
                )
            )
        else:
            reasons.append(Reason("ECO-04", "cumple", "El capital necesario cabe en tu presupuesto declarado.", metric_ids=[f"{sid}.eco.capital"]))
    elif p.budget_soles is None:
        assumptions.append("Presupuesto no declarado: no se comprobó si alcanza el capital.")

    # --- suelo y fertilidad (cualitativo + faltantes cuantitativos)
    soil = _soil_section(sid, cycles, p, metrics, families, legumes)
    reasons.append(
        Reason(
            "SUE-05",
            "informacion",
            f"{len(set(families))} familia(s) botánica(s) y {legumes} ciclo(s) de leguminosa en el horizonte. "
            "Son indicadores de manejo, no mejoras de fertilidad medidas; no se asigna crédito automático de nitrógeno.",
            metric_ids=[f"{sid}.suelo.familias", f"{sid}.suelo.leguminosas"],
            source_ids=["INIA-RIZOBIOS", "UMN-LEGUMINOSAS"],
        )
    )

    # --- estado
    if hard_fail:
        status = "no_viable"
    elif crit_missing:
        status = "requiere_datos"
    elif t.cap_status == "exploratoria":
        status = "exploratoria"
        reasons.append(
            Reason(
                "EST-01",
                "advertencia",
                "Hipótesis exploratoria: falta validación agronómica y comercial local; no se recomienda todavía.",
                source_ids=list(t.source_ids),
            )
        )
    else:
        status = "viable_con_supuestos"

    summary = _summary(status, seq, catalog, metrics, sid, reasons)
    return StrategyAssessment(
        sid, t.name, t.short, status, seq, timeline, metrics, reasons, _dedupe(assumptions), _dedupe(missing),
        monthly_water, soil, summary,
    )


def _dedupe(xs: list[str]) -> list[str]:
    return list(dict.fromkeys(xs))


def _timeline(cycles: list[Cycle], catalog: Catalog, start: date, end: date, p: ParcelInput) -> list[TimelineBlock]:
    blocks: list[TimelineBlock] = []
    prev = p.current_crop_id
    for c in cycles:
        prep_end = c.prep_start + timedelta(days=catalog.prep_days - 1)
        blocks.append(TimelineBlock("preparacion", c.prep_start, prep_end, label="Preparación del terreno"))
        if c.waited_days > 0:
            blocks.append(
                TimelineBlock(
                    "espera", prep_end + timedelta(days=1), c.plant - timedelta(days=1),
                    label=f"Espera de ventana de siembra de {c.crop.name}",
                )
            )
        why = [
            f"Después de {catalog.crops[prev].name if prev in catalog.crops else catalog.non_catalog_crops.get(prev, prev)}"
            + (" (otra familia botánica)" if prev not in catalog.crops or catalog.crops[prev].family != c.crop.family else " (misma familia)"),
            f"Ventana de siembra {', '.join(w.label() for w in c.crop.windows)} ({c.crop.window_status.replace('_', ' ')})",
            f"Duración {c.crop.cycle_days} días (FAO-56, tabla 11)",
        ]
        if c.crop.is_legume:
            why.append("Leguminosa: puede fijar nitrógeno con rizobios; el aporte depende del manejo de residuos y no se cuantifica")
        blocks.append(
            TimelineBlock(
                "cultivo", c.plant, c.harvest, c.crop.id, c.crop.name,
                stages=[{"name": n, "start": s, "end": e} for n, s, e in c.crop.stage_ranges(c.plant)],
                why=why,
            )
        )
        prev = c.crop.id
    last = cycles[-1].harvest if cycles else start - timedelta(days=1)
    if last < end:
        blocks.append(TimelineBlock("descanso", last + timedelta(days=1), end, label="Descanso / sin ciclo completo hasta el fin del horizonte"))
    return blocks


def _water(sid, cycles, p: ParcelInput, climate: ClimateInput, metrics, reasons, assumptions):
    by_month: dict[tuple[int, int], dict] = {}
    etc_total = 0.0
    year_totals: list[float] = []
    for c in cycles:
        n = c.crop.cycle_days
        for k in range(n):
            d = c.plant + timedelta(days=k)
            et0 = climate.et0(d)
            if et0 is None:
                return [], False
            etc = c.crop.kc_on_day(k) * et0
            etc_total += etc
            key = (d.year, d.month)
            slot = by_month.setdefault(key, {"etc": 0.0, "days": 0})
            slot["etc"] += etc
            slot["days"] += 1
        # rango histórico por año
        per_year = []
        for _, s, e in historical_windows(climate.series, c.plant, c.harvest):
            tot, ok = 0.0, True
            for k in range(n):
                v = climate.series.et0.get(s + timedelta(days=k))
                if v is None:
                    ok = False
                    break
                tot += c.crop.kc_on_day(k) * v
            if ok:
                per_year.append(tot)
        year_totals.append((min(per_year), max(per_year)) if per_year else (None, None))

    monthly = []
    net_total = 0.0
    eff = p.water.efficiency
    for (y, m), slot in sorted(by_month.items()):
        dim = _cal.monthrange(y, m)[1]
        p_month = climate.rain_month(m)
        pe = effective_rain_monthly(p_month) * slot["days"] / dim if p_month is not None else 0.0
        net = max(slot["etc"] - pe, 0.0)
        net_total += net
        gross_mm = net / eff if eff else None
        monthly.append(
            {
                "year": y,
                "month": m,
                "label": f"{MESES[m - 1]} {y}",
                "days": slot["days"],
                "etc_mm": round(slot["etc"], 1),
                "pe_mm": round(pe, 1),
                "net_mm": round(net, 1),
                "gross_mm": round(gross_mm, 1) if gross_mm is not None else None,
                "gross_m3": round(gross_mm * MM_HA_TO_M3 * p.area_ha) if gross_mm is not None else None,
            }
        )
    src = ["NASA-POWER", "FAO56-PM", "FAO56-KC"]
    lo = sum(v[0] for v in year_totals if v[0] is not None) if all(v[0] is not None for v in year_totals) else None
    hi = sum(v[1] for v in year_totals if v[1] is not None) if all(v[1] is not None for v in year_totals) else None
    metrics[f"{sid}.agua.etc_mm"] = Metric(
        f"{sid}.agua.etc_mm", "Demanda del cultivo ETc (todos los ciclos)", etc_total, "mm", "derivado",
        f"{ET0_METHOD_ID} con NASA POWER 2015–2025 × Kc FAO-56 por etapa (sin ajuste climático del Kc)",
        source_ids=src,
        detail=f"Rango entre años históricos: {lo:,.0f}–{hi:,.0f} mm" if lo is not None else "",
    )
    metrics[f"{sid}.agua.neto_mm"] = Metric(
        f"{sid}.agua.neto_mm", "Riego neto (ETc − lluvia efectiva)", net_total, "mm", "derivado",
        f"Balance mensual simplificado; lluvia efectiva {EFFECTIVE_RAIN_METHOD_ID}. Omite reserva del suelo, ascenso capilar y lavado de sales.",
        source_ids=src + ["FAO-TM3-PE"],
    )
    metrics[f"{sid}.agua.neto_m3"] = Metric(
        f"{sid}.agua.neto_m3", "Riego neto en volumen", net_total * MM_HA_TO_M3 * p.area_ha, "m³", "derivado",
        f"1 mm × 1 ha = 10 m³; área {p.area_ha:g} ha", source_ids=src + ["FAO-TM3-PE"],
    )
    assumptions.append("Kc de tablas FAO-56 sin ajuste por clima local; el balance omite reserva del suelo, ascenso capilar y lavado de sales.")
    if eff:
        gross_total = net_total / eff
        metrics[f"{sid}.agua.bruto_m3"] = Metric(
            f"{sid}.agua.bruto_m3", "Riego bruto en volumen", gross_total * MM_HA_TO_M3 * p.area_ha, "m³", "derivado",
            f"Riego neto ÷ eficiencia {eff:g} (declarada)", source_ids=src + ["FAO-TM3-PE", "FAO-RIEGO-NETO-BRUTO", "PARCELA"],
        )
        mx = max(monthly, key=lambda r: r["gross_m3"] or 0)
        metrics[f"{sid}.agua.max_mes_m3"] = Metric(
            f"{sid}.agua.max_mes_m3", "Mes de mayor demanda bruta", mx["gross_m3"], "m³", "derivado",
            f"Mes {mx['label']}", source_ids=src + ["FAO-RIEGO-NETO-BRUTO", "PARCELA"],
        )
    reasons.append(
        Reason(
            "AGU-06",
            "informacion",
            f"Demanda del cultivo calculada con clima histórico NASA para las fechas del calendario: ETc ≈ {etc_total:,.0f} mm "
            f"y riego neto ≈ {net_total:,.0f} mm en el horizonte. Cambiar las fechas cambia esta cifra.",
            metric_ids=[f"{sid}.agua.etc_mm", f"{sid}.agua.neto_mm"],
            source_ids=src + ["FAO-TM3-PE"],
        )
    )
    return monthly, True


def _thermal(sid, c: Cycle, climate: ClimateInput, metrics, reasons):
    from ceres.domain.climate import thermal_exposure

    for rule in c.crop.thermal_rules:
        ranges = c.crop.stage_ranges(c.plant)
        selected = [(s, e) for n, s, e in ranges if "todas" in rule.stages or n in rule.stages]
        if not selected:
            continue
        s, e = selected[0][0], selected[-1][1]
        var = rule.variable if rule.variable != "t_mean" else "t_mean"
        exp = _exposure(climate.series, s, e, var, rule.comparator, rule.threshold_c) if var == "t_mean" else thermal_exposure(
            climate.series, s, e, var, rule.comparator, rule.threshold_c
        )
        mid = f"{sid}.clima.{c.crop.id}.{c.plant.isoformat()}.{rule.id}"
        metrics[mid] = Metric(
            mid,
            f"{rule.label} — {c.crop.name} ({fmt(s)} a {fmt(e)})",
            exp.mean_days_per_year,
            "días/año (promedio histórico)",
            "derivado",
            f"NASA POWER {rule.variable} {rule.comparator} {rule.threshold_c} °C; {exp.years_with_events} de {exp.years_evaluated} años con eventos",
            source_ids=["NASA-POWER", *rule.source_ids],
            detail=rule.note,
        )
        state = "advertencia" if exp.share_of_years >= 0.3 else "informacion"
        reasons.append(
            Reason(
                "CLI-01",
                state,
                f"{rule.label} en {c.crop.name} ({fmt(s)} a {fmt(e)}): {exp.years_with_events} de {exp.years_evaluated} años históricos tuvieron días "
                f"con {_var_label(rule.variable)} {rule.comparator} {rule.threshold_c:g} °C en esas fechas "
                f"(promedio {exp.mean_days_per_year:.1f} días/año). Es frecuencia histórica, no pronóstico.",
                metric_ids=[mid],
                source_ids=["NASA-POWER", *rule.source_ids],
                assumptions=[f"Umbral {rule.status.replace('_', ' ')}: {rule.note}"],
            )
        )


def _var_label(v: str) -> str:
    return {"t_min": "mínima", "t_max": "máxima", "t_mean": "media"}[v]


def _exposure(series: ClimateSeries, s: date, e: date, variable: str, comparator: str, threshold: float):
    from ceres.domain.climate import ThermalExposure

    years_eval = years_ev = 0
    counts = []
    for _, ws, we in historical_windows(series, s, e):
        n = (we - ws).days + 1
        vals = [getattr(series.days.get(ws + timedelta(days=i)), "t_mean", None) for i in range(n)]
        if None in vals:
            continue
        years_eval += 1
        hits = sum(1 for v in vals if (v < threshold if comparator == "<" else v > threshold))
        counts.append(hits)
        years_ev += 1 if hits else 0
    return ThermalExposure(variable, comparator, threshold, years_eval, years_ev, sum(counts) / len(counts) if counts else 0.0)


def _economics(sid, cycles, p: ParcelInput, catalog: Catalog, salinity_factor, metrics, reasons, assumptions, missing) -> bool:
    overrides = {o.crop_id: o for o in p.economic_overrides}
    events: list[tuple[date, float]] = []
    central = low = high = 0.0
    lacking: list[str] = []
    kinds: set[str] = set()
    per_cycle = []
    for c in cycles:
        e = c.crop.economics
        o = overrides.get(c.crop.id)
        y = o.yield_t_ha if o and o.yield_t_ha is not None else e.yield_t_ha
        pr = o.price_soles_kg if o and o.price_soles_kg is not None else e.price_soles_kg
        cost = o.variable_cost_soles_ha if o and o.variable_cost_soles_ha is not None else e.variable_cost_soles_ha
        kinds.add("declarado" if o else e.status)
        if None in (y, pr, cost):
            lacking.append(c.crop.name)
            continue
        y_eff = y * salinity_factor.get(c.crop.id, 1.0)
        trans = catalog.transition_cost_soles_ha or 0.0
        margin = (y_eff * 1000 * pr - cost - trans) * p.area_ha
        ly, lp = catalog.scenario_low
        hy, hp = catalog.scenario_high
        central += margin
        low += (y_eff * ly * 1000 * pr * lp - cost - trans) * p.area_ha
        high += (y_eff * hy * 1000 * pr * hp - cost - trans) * p.area_ha
        events += [(c.prep_start, -trans * p.area_ha), (c.plant, -cost * p.area_ha), (c.harvest, y_eff * 1000 * pr * p.area_ha)]
        per_cycle.append({"crop": c.crop.name, "harvest": c.harvest.isoformat(), "margin_soles": round(margin)})
    if lacking:
        missing.append("Precio en chacra, rendimiento o costos de: " + ", ".join(lacking))
        reasons.append(
            Reason(
                "ECO-01",
                "falta_dato",
                "Faltan precio, rendimiento o costos de algún ciclo: no se calcula un margen preciso.",
                missing=["Precio en chacra", "Rendimiento comercializable", "Costos variables"],
            )
        )
        return False
    events.sort(key=lambda x: x[0])
    cum, worst = 0.0, 0.0
    for _, v in events:
        cum += v
        worst = min(worst, cum)
    kind = "supuesto_demo" if "supuesto_demo" in kinds else "declarado"
    src = sorted({s for c in cycles for s in c.crop.economics.source_ids}) + (["PARCELA"] if "declarado" in kinds else [])
    metrics[f"{sid}.eco.margen"] = Metric(
        f"{sid}.eco.margen", "Margen bruto estimado (escenario central)", central, "S/", kind,
        "Σ ciclos (rendimiento comercializable × precio en chacra − costos variables − transición) × área",
        source_ids=src, detail="No es ganancia neta: excluye alquiler de tierra, depreciación, impuestos y costo financiero.",
    )
    metrics[f"{sid}.eco.margen_bajo"] = Metric(
        f"{sid}.eco.margen_bajo", "Margen bruto, escenario bajo", low, "S/", kind,
        f"Rendimiento ×{catalog.scenario_low[0]}, precio ×{catalog.scenario_low[1]}", source_ids=src,
    )
    metrics[f"{sid}.eco.margen_alto"] = Metric(
        f"{sid}.eco.margen_alto", "Margen bruto, escenario alto", high, "S/", kind,
        f"Rendimiento ×{catalog.scenario_high[0]}, precio ×{catalog.scenario_high[1]}", source_ids=src,
    )
    metrics[f"{sid}.eco.capital"] = Metric(
        f"{sid}.eco.capital", "Capital necesario antes de recuperar con cosechas", -worst, "S/", kind,
        "Máximo saldo negativo acumulado (costos al sembrar, ingresos al cosechar)", source_ids=src,
    )
    if kind == "supuesto_demo":
        assumptions.append("Precios, rendimientos y costos son supuestos de demostración, no datos de SIEA ni del productor.")
    assumptions.append("El precio de hoy no se garantiza para la cosecha futura.")
    reasons.append(
        Reason(
            "ECO-02",
            "informacion",
            f"Margen bruto estimado de S/ {central:,.0f} (rango S/ {low:,.0f} a S/ {high:,.0f}) sumando {len(cycles)} ciclo(s).",
            metric_ids=[f"{sid}.eco.margen", f"{sid}.eco.margen_bajo", f"{sid}.eco.margen_alto"],
            source_ids=src,
        )
    )
    metrics[f"{sid}.eco.margen"].detail += " Por ciclo: " + "; ".join(f"{x['crop']}: S/ {x['margin_soles']:,}" for x in per_cycle)
    return True


def _soil_section(sid, cycles, p: ParcelInput, metrics, families, legumes) -> dict:
    metrics[f"{sid}.suelo.familias"] = Metric(f"{sid}.suelo.familias", "Familias botánicas distintas", len(set(families)), "familias", "derivado", "conteo del calendario")
    metrics[f"{sid}.suelo.leguminosas"] = Metric(f"{sid}.suelo.leguminosas", "Ciclos de leguminosa", legumes, "ciclos", "derivado", "conteo del calendario")
    analysis = {
        "ece_ds_m": p.soil.ece_ds_m,
        "ph": p.soil.ph,
        "organic_matter_pct": p.soil.organic_matter_pct,
        "date": p.soil.analysis_date.isoformat() if p.soil.analysis_date else None,
        "depth_cm": p.soil.depth_cm,
        "method": p.soil.method,
        "kind": p.soil.kind,
    }
    return {
        "analysis": analysis,
        "needs": "Pendiente: los requerimientos y la extracción de N-P-K por cultivo no tienen parámetros revisados en el catálogo; no se calcula dosis.",
        "contributions": {
            "residues": {"incorporar": "Residuos incorporados (declarado)", "retirar": "Residuos retirados (declarado)", "no_se": "Manejo de residuos no declarado"}[p.residue_management],
            "legume_note": "La leguminosa puede fijar N con rizobios; lo que queda para el siguiente cultivo depende de la cosecha y residuos. Sin crédito fijo.",
        },
        "per_crop": [{"crop": c.crop.name, "residue": c.crop.residue_note, "nutrition": c.crop.nutrition_note} for c in cycles],
        "indicators": {"families": len(set(families)), "legume_cycles": legumes},
        "advice": "SENASA recomienda partir del análisis de suelo para elaborar el plan de fertilización.",
        "source_ids": ["SENASA-BPA-FREJOL", "INIA-RIZOBIOS", "UMN-LEGUMINOSAS"],
    }


def _summary(status, seq, catalog: Catalog, metrics, sid, reasons) -> str:
    names = " → ".join(catalog.crops[c].name.split(" (")[0] for c in seq if c in catalog.crops)
    main = next((r.message for r in reasons if r.state == "no_cumple"), None) or next(
        (r.message for r in reasons if r.state == "falta_dato"), None
    )
    if main:
        return f"{names}. {main}"
    m = metrics.get(f"{sid}.eco.margen")
    w = metrics.get(f"{sid}.agua.neto_mm")
    parts = [names]
    if w:
        parts.append(f"riego neto ≈ {w.value:,.0f} mm")
    if m:
        parts.append(f"margen bruto estimado ≈ S/ {m.value:,.0f}")
    return "; ".join(parts) + "."


def _order(strategies: list[StrategyAssessment], priority: str) -> dict:
    viable = [s for s in strategies if s.status == "viable_con_supuestos"]
    rule, ranked, excluded, ties = "", [], [], []
    if priority == "dinero":
        rule = "ORD-DINERO: margen bruto central descendente; solo opciones viables con margen calculado."
        comparable = [s for s in viable if f"{s.strategy_id}.eco.margen" in s.metrics]
        ranked = sorted(comparable, key=lambda s: -s.metrics[f"{s.strategy_id}.eco.margen"].value)
    elif priority == "agua":
        rule = "ORD-AGUA: riego bruto total ascendente (mismo método, horizonte y punto de entrega); solo opciones viables."
        comparable = [s for s in viable if f"{s.strategy_id}.agua.bruto_m3" in s.metrics]
        ranked = sorted(comparable, key=lambda s: s.metrics[f"{s.strategy_id}.agua.bruto_m3"].value)
    elif priority == "suelo":
        rule = (
            "ORD-SUELO: más familias botánicas distintas y luego más ciclos de leguminosa (criterio cualitativo de manejo, "
            "no fertilidad medida); empates se informan."
        )

        def key(s):
            return (-s.metrics[f"{s.strategy_id}.suelo.familias"].value, -s.metrics[f"{s.strategy_id}.suelo.leguminosas"].value)

        ranked = sorted(viable, key=key)
        for a, b in zip(ranked, ranked[1:]):
            if key(a) == key(b):
                ties.append(f"{a.name} y {b.name} empatan en el criterio de suelo.")
    else:
        rule = "EQUILIBRADA: sin puntaje único; se muestran los compromisos entre margen, agua y suelo."
    for i, s in enumerate(ranked, 1):
        s.rank = i
    excluded = [
        {"strategy_id": s.strategy_id, "reason": f"Estado {s.status.replace('_', ' ')}" if s.status != "viable_con_supuestos" else "Sin métrica comparable para este criterio"}
        for s in strategies
        if s not in ranked
    ]
    tradeoffs = []
    if priority == "equilibrada" and viable:
        def best(metric, reverse):
            c = [s for s in viable if f"{s.strategy_id}.{metric}" in s.metrics]
            if not c:
                return None
            return sorted(c, key=lambda s: s.metrics[f"{s.strategy_id}.{metric}"].value, reverse=reverse)[0].name
        tradeoffs = [
            {"criterio": "Mayor margen bruto", "opcion": best("eco.margen", True)},
            {"criterio": "Menor riego bruto", "opcion": best("agua.bruto_m3", False)},
            {"criterio": "Más diversidad de familias", "opcion": best("suelo.familias", True)},
        ]
    return {
        "priority": priority,
        "rule": rule,
        "ranked": [s.strategy_id for s in ranked],
        "excluded": excluded,
        "ties": ties,
        "tradeoffs": tradeoffs,
    }


def _association_card(a) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "structure": a.structure,
        "status": a.status,
        "known": list(a.known),
        "missing": list(a.missing),
        "source_ids": list(a.source_ids),
        "warning": a.warning,
    }
