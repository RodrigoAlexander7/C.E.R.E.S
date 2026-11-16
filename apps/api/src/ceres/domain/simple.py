"""Capa sencilla del resultado (R15, R16): nivel en palabras cotidianas, titular, datos clave
y el «dato que cambiaría la decisión» con una pregunta observable.

Todo es determinista y se deriva del estado técnico y de las métricas del motor; no usa LLM.
Regla R16: un supuesto de zona que afecta a una restricción obligatoria nunca da «Buena opción».
"""

from __future__ import annotations

from datetime import date

from ceres.domain.catalog import Catalog
from ceres.domain.model import ComparisonResult, ParcelInput, StrategyAssessment

LEVELS = {
    "buena": "Buena opción",
    "posible": "Posible, confirma",
    "explorar": "Por explorar",
    "sin_datos": "Requiere datos",
    "no_conviene": "No conviene",
}
LEVEL_ORDER = {"buena": 0, "posible": 1, "explorar": 2, "sin_datos": 3, "no_conviene": 4}
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


WATER_WORDS = {"muy_poca": "muy poca", "poca": "poca", "media": "media", "alta": "alta", "no_es_problema": "no es problema"}


def _fmt(v: float) -> str:
    return f"{v:,.0f}"


def _lacks_profile(st: StrategyAssessment) -> bool:
    """El cultivo planeado no tiene ficha agronómica: no hay nada que estimar (no es «posible»)."""
    return any(r.rule_id == "CAT-01" for r in st.reasons)


def level_of(st: StrategyAssessment, cap: str | None = None) -> str:
    if _lacks_profile(st):
        return "sin_datos"
    failing = [r for r in st.reasons if r.state == "no_cumple"]
    # Si solo falla por un supuesto de zona, no es un «no» definitivo: hay que confirmarlo.
    only_assumed = bool(failing) and all(r.assumed_inputs for r in failing)
    if st.status == "exploratoria" or cap == "exploratoria":
        # Una plantilla exploratoria nunca se presenta mejor que «Por explorar».
        return "no_conviene" if st.status == "no_viable" and not only_assumed else "explorar"
    if st.status == "no_viable":
        return "posible" if only_assumed else "no_conviene"
    if st.status == "requiere_datos":
        return "posible"
    if any(r.assumed_inputs for r in st.reasons if r.state == "cumple"):
        return "posible"
    return "buena"


def _metric(st: StrategyAssessment, key: str) -> float | None:
    m = st.metrics.get(f"{st.strategy_id}.{key}")
    return m.value if m else None


def _peak(st: StrategyAssessment) -> dict | None:
    rows = [m for m in st.monthly_water if m.get("gross_m3") is not None]
    return max(rows, key=lambda m: m["gross_m3"]) if rows else None


def decisive_for(st: StrategyAssessment, p: ParcelInput, catalog: Catalog) -> list[dict]:
    """Preguntas observables cuya respuesta puede cambiar el nivel de esta opción."""
    out: list[dict] = []
    lo, hi = p.water.bounds()
    peak = _peak(st)
    water_exact = p.water.mode == "conozco" and p.water.allocation_m3 is not None and "water.allocation" not in p.assumed
    # Con una respuesta cualitativa (muy poca … alta) y el área del campo basta: no se insiste en un volumen exacto.
    if peak and not water_exact and not p.water.availability:
        need = peak["gross_m3"]
        settled = (lo is not None and need <= lo and "water.allocation" not in p.assumed) or (
            hi is not None and need > hi and "water.allocation" not in p.assumed
        )
        if not settled:
            per_ha = need / p.area_ha
            out.append(
                {
                    "id": "agua",
                    "label": f"tu agua de {MESES[peak['month'] - 1]}",
                    "question": f"¿Recibes al menos {_fmt(need)} m³ de agua en {MESES[peak['month'] - 1]}?",
                    "detail": f"Unos {_fmt(per_ha)} m³ por hectárea. Es el mes en que esta opción pide más agua; "
                    "si recibes menos, le faltaría riego.",
                    "critical_value": round(need),
                    "unit": "m³/mes",
                    "answers": [
                        {"label": "Sí, al menos eso", "patch": {"water.allocation_min_m3": round(need)}},
                        {"label": "No, recibo menos", "patch": {"water.allocation_max_m3": max(round(need) - 1, 0)}},
                    ],
                    "source_ids": [p.zone.nasa_source_id, "FAO56-PM", *p.zone.water_source_ids],
                }
            )
    if "water.efficiency" in p.assumed and not p.water.method:
        out.append(
            {
                "id": "riego",
                "label": "cómo riegas",
                "question": "¿Cómo riegas tu chacra?",
                "detail": "Con goteo se pierde menos agua que con aspersión o gravedad (FAO: 90 %, 75 % y 60 % de eficiencia).",
                "answers": [
                    {"label": "Goteo", "patch": {"water.method": "goteo"}},
                    {"label": "Aspersión", "patch": {"water.method": "aspersion"}},
                    {"label": "Gravedad", "patch": {"water.method": "gravedad"}},
                ],
                "source_ids": ["FAO-EFICIENCIA"],
            }
        )
    sensitive = [c for c in st.sequence if catalog.crop(c) and catalog.crop(c).salinity_sensitive]
    if p.soil.ece_ds_m is None and p.soil.salinity_signs is None and sensitive:
        crops = " y ".join(catalog.crop(c).short_name for c in dict.fromkeys(sensitive))
        out.append(
            {
                "id": "sal",
                "label": "si tu suelo tiene sal",
                "question": "¿Ves costras blancas o manchas de sal en tu chacra?",
                "detail": f"Sensible a la sal: {crops}. Si hay sal, no conviene hasta medirla con un análisis de suelo.",
                "answers": [
                    {"label": "No, no veo", "patch": {"soil.salinity_signs": "sin_signos"}},
                    {"label": "Sí, se ven", "patch": {"soil.salinity_signs": "con_signos"}},
                ],
                "source_ids": ["FAO29-SAL"],
            }
        )
    return out


def _first_sowing(st: StrategyAssessment) -> date | None:
    for b in st.timeline:
        if b.kind == "cultivo":
            return b.start
    return None


def simplify(result: ComparisonResult, p: ParcelInput, catalog: Catalog) -> None:
    """Completa `simple`, `decisive` y `simple_order` en el resultado (in situ)."""
    sts = result.strategies
    if not sts:
        return
    caps = {t.id: t.cap_status for t in catalog.templates}
    zone = p.zone.name
    for st in sts:
        cap = caps.get(st.strategy_id)
        if any(catalog.crop(c) and catalog.crop(c).exploratory for c in st.sequence):
            cap = "exploratoria"  # un cultivo sin validación local nunca sube de «Por explorar»
        strategy_type = "rotacion" if len(set(st.sequence)) > 1 else "monocultivo"
        rationale = next((r.message for r in st.reasons if r.rule_id == "EST-02"),
                         "Monocultivo: un solo producto por ciclo; faltan datos para evaluarlo.")
        st.simple = {"level": level_of(st, cap), "type": strategy_type, "rationale": rationale}
        st.decisive = decisive_for(st, p, catalog)

    usable = [s for s in sts if s.simple["level"] in ("buena", "posible")]
    def best(key: str, reverse: bool) -> str | None:
        c = [s for s in usable if _metric(s, key) is not None]
        return sorted(c, key=lambda s: _metric(s, key), reverse=reverse)[0].strategy_id if c else None

    richest = best("eco.margen", True)
    thriftiest = best("agua.bruto_m3", False)

    for st in sts:
        lvl = st.simple["level"]
        names = " → ".join(catalog.crop(c).short_name if catalog.crop(c) else catalog.crop_label(c).lower() for c in st.sequence)
        tags: list[str] = ["Rotación" if st.simple["type"] == "rotacion" else "Monocultivo"]
        role = (st.risk or {}).get("role")
        if role == "sugerido":
            tags.append("Plan sugerido por CERES")
        elif role == "explorar":
            tags.append("Mejor ganancia por explorar")
        if st.strategy_id == richest:
            tags.append("Más ganancia estimada")
        if st.strategy_id == thriftiest:
            tags.append("Menos agua")
        if any(catalog.crop(c) and catalog.crop(c).is_legume for c in st.sequence):
            tags.append("Cuida el suelo (leguminosa)")
        if st.strategy_id == "A":
            tags.append("Tu plan")

        failing = next((r for r in st.reasons if r.state == "no_cumple"), None)
        if lvl == "sin_datos":
            crop = st.sequence[0] if st.sequence else ""
            label = catalog.crop_label(crop).lower() if crop else "ese cultivo"
            # Frases cortas: el agricultor lee una línea; el detalle está en «Ver más».
            why = "es perenne, no la comparamos" if crop == "alfalfa" else "aún sin ficha, no lo calculamos"
            headline = f"Seguir con {label}: {why}."
            # Sin ficha no hay agua ni ganancia que confirmar: ninguna pregunta cambia esta tarjeta.
            st.decisive = []
        elif lvl == "no_conviene" and failing:
            headline = _plain_failure(failing.rule_id, st)
        elif lvl == "explorar":
            headline = f"Aún sin probar en {zone}."
        elif lvl == "posible" and failing and st.decisive:
            # Falla solo por un supuesto de zona: decirlo así, sin presentarlo como un «no» definitivo.
            if "water.allocation" in failing.assumed_inputs:
                cause = f"con el agua que indicaste ({WATER_WORDS[p.water.availability]})" if p.water.availability in WATER_WORDS else "con el agua típica de la zona"
            else:
                cause = "con el riego típico de la zona"
            headline = f"{_plain_failure(failing.rule_id, st).rstrip('.')} {cause}."
        elif lvl == "posible" and st.decisive:
            headline = f"Puede funcionar; confirma {st.decisive[0]['label']}."
        elif lvl == "posible" and p.water.availability in WATER_WORDS and "water.allocation" in p.assumed:
            headline = f"Cumple con el agua que indicaste ({WATER_WORDS[p.water.availability]}); es un escenario según tu respuesta, no una medición."
        elif lvl == "posible":
            missing = next((r for r in st.reasons if r.state == "falta_dato"), None)
            headline = f"Falta un dato: {missing.missing[0] if missing and missing.missing else 'confírmalo con tu asesor'}."
        else:
            headline = "Cumple con tu agua y tu suelo."
        if role == "sugerido" and lvl in ("buena", "posible") and not failing:
            headline = (
                "Lo que más te deja con tu agua, sin arriesgar de más."
            )
        limited = next((r for r in st.reasons if r.rule_id == "ANT-02"), None)
        if limited and limited.state != "no_cumple":
            headline += " Plan truncado: antes de volver a sembrar debes cambiar de producto (máximo 2 consecutivas)."

        margin = _metric(st, "eco.margen")
        water = _metric(st, "agua.bruto_m3") or None
        sow = _first_sowing(st)
        st.simple.update(
            {
                "label": LEVELS[lvl],
                "names": names,
                "headline": headline,
                "tags": tags,
                "facts": {
                    "margin_soles": round(margin) if margin is not None else None,
                    "margin_kind": st.metrics.get(f"{st.strategy_id}.eco.margen").kind if margin is not None else None,
                    "water_m3": round(water) if water is not None else None,
                    "first_sowing": sow.isoformat() if sow else None,
                    "cycles": int(_metric(st, "ciclos") or 0),
                    # Riesgo (Monte Carlo): rango probable y probabilidad de perder; precio de equilibrio.
                    "risk": {k: st.risk[k] for k in ("mean_soles", "cvar20_soles", "p10_soles", "p90_soles", "p_loss") if k in st.risk}
                    if st.risk and "mean_soles" in st.risk else None,
                    "breakeven": (st.risk or {}).get("breakeven"),
                },
            }
        )

    # Orden sencillo: primero por nivel; dentro del nivel, por la prioridad elegida (sin puntaje único).
    def within(s: StrategyAssessment) -> float:
        if p.priority == "dinero":
            v = _metric(s, "eco.margen")
            return -v if v is not None else float("inf")
        if p.priority == "agua":
            v = _metric(s, "agua.bruto_m3") or _metric(s, "agua.neto_mm")
            return v if v is not None else float("inf")
        if p.priority == "suelo":
            return -((_metric(s, "suelo.familias") or 0) * 10 + (_metric(s, "suelo.leguminosas") or 0))
        return 0.0

    def lead(s: StrategyAssessment) -> int:
        # Dentro del mismo nivel, el plan sugerido va primero (ya optimizó según la prioridad elegida).
        return 0 if (s.risk or {}).get("role") == "sugerido" else 1

    result.simple_order = [
        s.strategy_id for s in sorted(sts, key=lambda s: (LEVEL_ORDER[s.simple["level"]], lead(s), within(s), s.strategy_id))
    ]
    result.assumed = sorted(p.assumed)


def _plain_failure(rule_id: str, st: StrategyAssessment) -> str:
    if rule_id == "ANT-02":
        return "Sería la tercera siembra consecutiva del mismo producto: cambia de cultivo."
    if rule_id == "AGU-04":
        peak = _peak(st)
        return f"Le faltaría agua en {MESES[peak['month'] - 1]}." if peak else "Le faltaría agua."
    if rule_id in ("SUE-02", "SUE-06"):
        return "Es sensible a la sal de tu suelo."
    if rule_id == "ECO-03":
        return "Necesita más capital del que indicaste."
    if rule_id == "CAL-01":
        return "No cabe ningún ciclo completo en los próximos 24 meses."
    return "No cumple una condición obligatoria."
