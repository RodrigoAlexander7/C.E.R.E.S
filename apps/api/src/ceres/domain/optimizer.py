"""Plan sugerido por CERES: optimización de la secuencia de siembra (R21).

Problema. Para una chacra de área A y un horizonte de 24 meses se elige una secuencia de ciclos
(cultivo c_k, fecha de siembra t_k) que maximiza

    Score = (1 − β)·E[M] + β·CVaR₂₀(M)          (β = 0,5: perfil prudente)
    M     = Σ_k A·(Y_c·ρ_y·s_c·a_k·P_c·ρ_p − C_c − C_trans)

sujeto a: ventana de siembra; ciclo completo dentro del horizonte; preparación entre ciclos;
agua del mes más exigente ≤ dotación en ≥ 9 de 11 años NASA POWER (restricción de oportunidad);
máximo 2 siembras consecutivas del mismo producto, contando el cultivo actual;
repetir familia botánica en ciclos seguidos rinde 10 % menos (supuesto); sal (FAO-29); riesgo de
frío/calor < 3 de 10 años.

Método.
1. Precálculo por (cultivo, día de siembra) del riego neto mensual con NASA POWER + FAO-56 y de la
   razón entre años (caché por instantánea NASA: la climatología no depende del año calendario).
2. Programación dinámica sobre un DAG temporal (estado = fecha libre, familia y producto anteriores,
   racha del producto, ¿hubo leguminosa?) que conserva los K mejores caminos por margen esperado.
3. Monte Carlo con números aleatorios comunes (semilla fija → resultado reproducible): año climático
   NASA por ciclo, precio log-normal (σ por cultivo, supuesto) y factor de rendimiento del catálogo.
   Da E[M], CVaR₂₀, P(M < 0) y percentiles; ordena los K candidatos por Score.
4. Precio de equilibrio y precio de cambio por bisección sobre el precio del cultivo principal.

Todo es determinista y sin dependencias externas. No usa LLM.
"""

from __future__ import annotations

import bisect
import calendar as _cal
import math
import random
from dataclasses import dataclass, field
from datetime import date, timedelta
from functools import lru_cache

from ceres.domain.catalog import Catalog, CropProfile
from ceres.domain.climate import effective_rain_monthly, historical_windows, thermal_exposure
from ceres.domain.engine import MAX_CONSECUTIVE_SOWINGS
from ceres.domain.model import ParcelInput

MM_HA_TO_M3 = 10.0
K_BEST = 8
SAMPLES = 1000
SEED = 20261115
BETA_PRUDENT = 0.5
CVAR_ALPHA = 0.2
THERMAL_MAX_SHARE = 0.3
# Repetir la familia botánica del ciclo anterior: −10 % de rendimiento por más plagas y
# enfermedades. Supuesto de demostración sin cuantificación local (verificar con el asesor).
REPEAT_YIELD = 0.9
WATER_YEARS_OK = 9 / 11
# Familias de cultivos sin ficha que pueden ser el antecedente (para la regla de rotación).
NON_CATALOG_FAMILY = {"alfalfa": "Fabaceae", "maiz_chala": "Poaceae"}


@dataclass(frozen=True)
class Profile:
    """Ciclo de un cultivo sembrado en un día del año, con clima NASA POWER histórico."""

    months: tuple[tuple[int, float], ...]  # (desfase de mes desde la siembra, riego neto mm)
    peak_net_mm: float
    total_net_mm: float
    year_ratios: tuple[float, ...]  # ETc del ciclo en cada año ÷ ETc climatológica
    ratio_ok: float  # razón que se cumple en ≥ 9 de 11 años
    thermal_bad: bool
    thermal_note: str


@dataclass
class Plan:
    cycles: tuple[tuple[str, date], ...]  # (cultivo, siembra)
    expected_ha: float  # margen esperado por ha (para la programación dinámica)
    stats: dict = field(default_factory=dict)
    score: float = 0.0
    monthly_gross_m3: dict[tuple[int, int], float] = field(default_factory=dict)

    @property
    def sequence(self) -> list[str]:
        return [c for c, _ in self.cycles]


# ---------------------------------------------------------------- precálculo de agua y clima


def _month_offset(plant: date, d: date) -> int:
    return (d.year - plant.year) * 12 + d.month - plant.month


@lru_cache(maxsize=4096)
def _profile_cached(snapshot_key: str, crop_key: str, plant_md: tuple[int, int], climate_ref, crop_ref) -> Profile:
    climate, crop = climate_ref.obj, crop_ref.obj
    # Año de referencia no bisiesto: la climatología es diaria por (mes, día).
    plant = date(2027, *plant_md)
    by_off: dict[int, list] = {}
    clim_total = 0.0
    for k in range(crop.cycle_days):
        d = plant + timedelta(days=k)
        et0 = climate.et0(d)
        if et0 is None:
            return Profile((), 0.0, 0.0, (), 1.0, True, "Sin ET0 NASA para esas fechas")
        etc = crop.kc_on_day(k) * et0
        clim_total += etc
        slot = by_off.setdefault(_month_offset(plant, d), [0.0, 0, d.year, d.month])
        slot[0] += etc
        slot[1] += 1
    months = []
    for off, (etc, days, y, m) in sorted(by_off.items()):
        p_month = climate.rain_month(m)
        pe = effective_rain_monthly(p_month) * days / _cal.monthrange(y, m)[1] if p_month is not None else 0.0
        months.append((off, max(etc - pe, 0.0)))
    harvest = plant + timedelta(days=crop.cycle_days - 1)
    ratios = []
    for _, s, _e in historical_windows(climate.series, plant, harvest):
        tot, ok = 0.0, True
        for k in range(crop.cycle_days):
            v = climate.series.et0.get(s + timedelta(days=k))
            if v is None:
                ok = False
                break
            tot += crop.kc_on_day(k) * v
        if ok and clim_total > 0:
            ratios.append(tot / clim_total)
    ratios.sort()
    ratio_ok = ratios[max(math.ceil(WATER_YEARS_OK * len(ratios)) - 1, 0)] if ratios else 1.0
    # Riesgo térmico: misma regla que el motor (≥ 3 de cada 10 años con eventos → no se propone).
    bad, note = False, ""
    for rule in crop.thermal_rules:
        ranges = crop.stage_ranges(plant)
        sel = [(s, e) for n, s, e in ranges if "todas" in rule.stages or n in rule.stages]
        if not sel:
            continue
        s, e = sel[0][0], sel[-1][1]
        if rule.variable == "t_mean":
            from ceres.domain.engine import _exposure

            exp = _exposure(climate.series, s, e, "t_mean", rule.comparator, rule.threshold_c)
        else:
            exp = thermal_exposure(climate.series, s, e, rule.variable, rule.comparator, rule.threshold_c)
        if exp.share_of_years >= THERMAL_MAX_SHARE:
            bad, note = True, f"{rule.label}: {exp.years_with_events} de {exp.years_evaluated} años"
            break
    peak = max((v for _, v in months), default=0.0)
    return Profile(tuple(months), peak, sum(v for _, v in months), tuple(ratios), ratio_ok, bad, note)


class _Ref:
    """Envoltorio con hash por identidad para pasar objetos al caché sin exigir que sean hashables."""

    __slots__ = ("obj",)

    def __init__(self, obj):
        self.obj = obj

    def __hash__(self):
        return id(self.obj)

    def __eq__(self, other):
        return isinstance(other, _Ref) and other.obj is self.obj


def cycle_profile(climate, crop: CropProfile, plant: date) -> Profile:
    md = (plant.month, min(plant.day, 28) if plant.month == 2 else plant.day)
    return _profile_cached(climate.snapshot_id or "", crop.id, md, _Ref(climate), _Ref(crop))


# ---------------------------------------------------------------- economía y restricciones por cultivo


@dataclass(frozen=True)
class CropEcon:
    yield_t_ha: float
    price: float
    cost: float
    sigma: float
    salinity: float  # factor de rendimiento por sal (1 = sin pérdida)
    own_price: bool


def crop_econ(crop: CropProfile, p: ParcelInput) -> CropEcon | None:
    """Rendimiento, precio y costos efectivos (los datos propios mandan); None si falta algo o la sal lo excluye."""
    o = next((x for x in p.economic_overrides if x.crop_id == crop.id), None)
    e = crop.economics
    y = (o.yield_t_ha if o and o.yield_t_ha is not None else e.yield_t_ha)
    pr = (o.price_soles_kg if o and o.price_soles_kg is not None else e.price_soles_kg)
    cost = (o.variable_cost_soles_ha if o and o.variable_cost_soles_ha is not None else e.variable_cost_soles_ha)
    if None in (y, pr, cost):
        return None
    sal = 1.0
    ece, signs = p.soil.ece_ds_m, p.soil.salinity_signs
    if crop.salinity_ece_threshold is not None:
        if ece is not None:
            if crop.salinity_ece_50 is not None and ece >= crop.salinity_ece_50:
                return None
            if ece > crop.salinity_ece_threshold and crop.salinity_ece_50:
                sal = 1 - 0.5 * (ece - crop.salinity_ece_threshold) / (crop.salinity_ece_50 - crop.salinity_ece_threshold)
        elif signs == "con_signos" and crop.salinity_sensitive:
            return None
    return CropEcon(y, pr, cost, e.price_sigma or 0.25, sal, bool(o and o.price_soles_kg is not None))


# ---------------------------------------------------------------- programación dinámica (K mejores)


def _grid(start: date, end: date) -> list[date]:
    out, d = [], date(start.year, start.month, 1)
    while d <= end:
        if d >= start:
            out.append(d)
        d = date(d.year + (d.month == 12), d.month % 12 + 1, 1)
    return out


@dataclass(frozen=True)
class Arc:
    crop: str
    family: str
    legume: bool
    plant: date
    harvest: date
    value_ha: float
    value_repeat_ha: float  # si repite la familia del ciclo anterior (supuesto de rendimiento)


def _arcs(p: ParcelInput, catalog: Catalog, climate, crops: list[str], start: date, end: date, alloc_hi: float | None) -> list[Arc]:
    eff = p.water.efficiency
    ty, ly, hy = 1.0, catalog.scenario_low[0], catalog.scenario_high[0]
    mean_yield_factor = (ly + hy) / 2 if ly and hy else ty
    trans = catalog.transition_cost_soles_ha or 0.0
    arcs: list[Arc] = []
    for cid in crops:
        crop = catalog.crop(cid)
        ec = crop_econ(crop, p) if crop else None
        if ec is None:
            continue
        gross = ec.yield_t_ha * ec.salinity * mean_yield_factor * 1000 * ec.price
        value = gross - ec.cost - trans
        value_repeat = gross * REPEAT_YIELD - ec.cost - trans
        for d in _grid(start, end):
            if not any(w.contains(d) for w in crop.windows):
                continue
            harvest = d + timedelta(days=crop.cycle_days - 1)
            if harvest > end:
                continue
            prof = cycle_profile(climate, crop, d)
            if not prof.months or prof.thermal_bad:
                continue
            if alloc_hi is not None and eff:
                peak_m3 = prof.peak_net_mm * prof.ratio_ok / eff * MM_HA_TO_M3 * p.area_ha
                if peak_m3 > alloc_hi:
                    continue
            arcs.append(Arc(cid, crop.family, crop.is_legume, d, harvest, value, value_repeat))
    arcs.sort(key=lambda a: a.plant)
    return arcs


def best_paths(
    arcs: list[Arc], start: date, prep_days: int, first_family: str | None, require_legume: bool,
    k: int = K_BEST, *, first_crop: str | None = None, current_crop_streak: int = 1,
) -> list[tuple[float, tuple[Arc, ...]]]:
    """K mejores secuencias; excluye el tercer consecutivo antes de valorar el arco.

    La racha es por producto, no por familia, y sigue vigente aunque haya meses sin sembrar.
    """
    plants = [a.plant for a in arcs]
    memo: dict[tuple[date, str | None, bool, str | None, int], list[tuple[float, tuple[Arc, ...]]]] = {}

    def solve(avail: date, fam: str | None, leg: bool, previous: str | None, streak: int) -> list[tuple[float, tuple[Arc, ...]]]:
        key = (avail, fam, leg, previous, streak)
        if key in memo:
            return memo[key]
        cands: list[tuple[float, tuple[Arc, ...]]] = []
        if leg or not require_legume:
            cands.append((0.0, ()))
        earliest = avail + timedelta(days=prep_days)
        for a in arcs[bisect.bisect_left(plants, earliest):]:
            next_streak = streak + 1 if a.crop == previous else 1
            if next_streak > MAX_CONSECUTIVE_SOWINGS:
                continue
            # El supuesto de familia se aplica solo después de cumplir el límite duro por producto.
            own = a.value_repeat_ha if a.family == fam else a.value_ha
            for v, path in solve(a.harvest + timedelta(days=1), a.family, leg or a.legume, a.crop, next_streak):
                cands.append((own + v, (a, *path)))
        cands.sort(key=lambda x: (-x[0], len(x[1]), tuple((c.plant, c.crop) for c in x[1])))
        out, seen = [], set()
        for v, path in cands:
            sig = tuple((c.crop, c.plant) for c in path)
            if sig in seen:
                continue
            seen.add(sig)
            out.append((v, path))
            if len(out) >= k:
                break
        memo[key] = out
        return out

    # Igual que build_cycles: la primera siembra cabe desde la liberación del terreno + preparación.
    return [r for r in solve(start, first_family, False, first_crop, current_crop_streak) if r[1]]


# ---------------------------------------------------------------- Monte Carlo (riesgo)


@dataclass
class Draws:
    """Números aleatorios comunes: los mismos para todos los planes que se comparan."""

    year_u: list[list[float]]
    price_z: list[list[float]]
    yield_u: list[list[float]]

    @classmethod
    def make(cls, n: int = SAMPLES, slots: int = 8, seed: int = SEED) -> "Draws":
        r = random.Random(seed)
        return cls(
            [[r.random() for _ in range(slots)] for _ in range(n)],
            [[r.gauss(0.0, 1.0) for _ in range(slots)] for _ in range(n)],
            [[r.random() for _ in range(slots)] for _ in range(n)],
        )


def simulate(cycles: list[tuple[str, date]], p: ParcelInput, catalog: Catalog, climate, draws: Draws,
             alloc_hi: float | None, price_mult: dict[str, float] | None = None) -> list[float] | None:
    """Margen bruto de cada muestra (S/, toda la chacra)."""
    eff = p.water.efficiency
    trans = catalog.transition_cost_soles_ha or 0.0
    ly, hy = catalog.scenario_low[0], catalog.scenario_high[0]
    info = []
    prev_family = _family_of(p.current_crop_id, catalog)
    previous, streak = p.current_crop_id, getattr(p, "current_crop_streak", 1)
    for cid, plant in cycles:
        streak = streak + 1 if cid == previous else 1
        if streak > MAX_CONSECUTIVE_SOWINGS:
            return None  # tampoco asigna riesgo ni margen a un plan externo que viole el límite
        previous = cid
        crop = catalog.crop(cid)
        ec = crop_econ(crop, p) if crop else None
        if ec is None:
            return None
        prof = cycle_profile(climate, crop, plant)
        peak = prof.peak_net_mm / eff * MM_HA_TO_M3 * p.area_ha if eff else None
        rep = REPEAT_YIELD if crop.family == prev_family else 1.0
        prev_family = crop.family
        info.append((ec, prof, peak, (price_mult or {}).get(cid, 1.0), rep))
    out = []
    for s in range(len(draws.year_u)):
        m = 0.0
        for k, (ec, prof, peak, pm_extra, rep) in enumerate(info):
            k8 = k % len(draws.year_u[s])
            water_f = 1.0
            if alloc_hi is not None and peak and prof.year_ratios:
                ratio = prof.year_ratios[int(draws.year_u[s][k8] * len(prof.year_ratios)) % len(prof.year_ratios)]
                need = peak * ratio
                if need > alloc_hi:
                    water_f = alloc_hi / need  # falta de agua: el rendimiento baja en proporción (Ky ≈ 1, supuesto)
            yf = ly + (hy - ly) * draws.yield_u[s][k8]
            pm = math.exp(ec.sigma * draws.price_z[s][k8] - ec.sigma**2 / 2) * pm_extra
            m += p.area_ha * (ec.yield_t_ha * ec.salinity * rep * water_f * yf * 1000 * ec.price * pm - ec.cost - trans)
        out.append(m)
    return out


def risk_stats(samples: list[float], beta: float = BETA_PRUDENT) -> dict:
    xs = sorted(samples)
    n = len(xs)
    tail = xs[: max(int(CVAR_ALPHA * n), 1)]
    mean = sum(xs) / n
    cvar = sum(tail) / len(tail)
    return {
        "mean_soles": round(mean),
        "cvar20_soles": round(cvar),
        "p10_soles": round(xs[int(0.1 * n)]),
        "p90_soles": round(xs[min(int(0.9 * n), n - 1)]),
        "p_loss": round(sum(1 for x in xs if x < 0) / n, 3),
        "score_soles": round((1 - beta) * mean + beta * cvar),
        "samples": n,
    }


def _score(samples: list[float], beta: float) -> float:
    st = risk_stats(samples, beta)
    return st["score_soles"]


def bisect_price(fn, lo: float, hi: float, iters: int = 40) -> float | None:
    """Raíz de fn en [lo, hi] por bisección (fn monótona); None si no cambia de signo."""
    flo, fhi = fn(lo), fn(hi)
    if flo == 0:
        return lo
    if (flo > 0) == (fhi > 0):
        return None
    for _ in range(iters):
        mid = (lo + hi) / 2
        fm = fn(mid)
        if (fm > 0) == (flo > 0):
            lo, flo = mid, fm
        else:
            hi = mid
    return (lo + hi) / 2


def main_crop(cycles: list[tuple[str, date]], p: ParcelInput, catalog: Catalog) -> str | None:
    """Cultivo que más aporta al ingreso del plan."""
    rev: dict[str, float] = {}
    for cid, _ in cycles:
        ec = crop_econ(catalog.crop(cid), p) if catalog.crop(cid) else None
        if ec:
            rev[cid] = rev.get(cid, 0.0) + ec.yield_t_ha * ec.salinity * 1000 * ec.price
    return max(rev, key=rev.get) if rev else None


def breakeven(cycles, p, catalog, climate, draws, alloc_hi) -> dict | None:
    """Precio en chacra del cultivo principal con el que el margen esperado es cero (bisección)."""
    cid = main_crop(cycles, p, catalog)
    if not cid:
        return None
    price = crop_econ(catalog.crop(cid), p).price

    def mean_at(mult: float) -> float:
        xs = simulate(cycles, p, catalog, climate, draws, alloc_hi, {cid: mult})
        return sum(xs) / len(xs)

    mult = bisect_price(mean_at, 0.0, 1.0)
    return {"crop_id": cid, "price_soles_kg": round(price * mult, 2) if mult is not None else None, "current_soles_kg": price}


# ---------------------------------------------------------------- orquestación


@dataclass
class OptimizerResult:
    best: Plan | None
    explore: Plan | None
    candidates: list[Plan]
    portfolio: dict | None
    note: str
    beta: float


def _validated_crops(catalog: Catalog) -> list[str]:
    """Cultivos usados por alguna plantilla no exploratoria y no marcados exploratorios."""
    ok = set()
    for t in catalog.templates:
        if t.cap_status != "exploratoria":
            ok.update(t.crops)
    return [c for c in catalog.crops if c in ok and not catalog.crops[c].exploratory]


def _alloc_hi(p: ParcelInput) -> float | None:
    return p.water.bounds()[1]


def _family_of(crop_id: str | None, catalog: Catalog) -> str | None:
    if not crop_id:
        return None
    c = catalog.crop(crop_id)
    return c.family if c else NON_CATALOG_FAMILY.get(crop_id)


def _plans_for(p, catalog, climate, crops, start, end, draws, beta, require_legume) -> list[Plan]:
    alloc = _alloc_hi(p)
    arcs = _arcs(p, catalog, climate, crops, start, end, alloc)
    paths = best_paths(
        arcs, start, catalog.prep_days, _family_of(p.current_crop_id, catalog), require_legume,
        first_crop=p.current_crop_id, current_crop_streak=getattr(p, "current_crop_streak", 1),
    )
    plans = []
    for v, path in paths:
        cycles = tuple((a.crop, a.plant) for a in path)
        xs = simulate(list(cycles), p, catalog, climate, draws, alloc)
        if xs is None:
            continue
        plan = Plan(cycles, v)
        plan.stats = risk_stats(xs, beta)
        plan.score = plan.stats["score_soles"]
        plan.monthly_gross_m3 = monthly_gross(list(cycles), p, catalog, climate)
        plans.append(plan)
    return plans


def monthly_gross(cycles, p, catalog, climate) -> dict[tuple[int, int], float]:
    eff = p.water.efficiency or 1.0
    out: dict[tuple[int, int], float] = {}
    for cid, plant in cycles:
        prof = cycle_profile(climate, catalog.crop(cid), plant)
        for off, net in prof.months:
            y, m = plant.year + (plant.month - 1 + off) // 12, (plant.month - 1 + off) % 12 + 1
            out[(y, m)] = out.get((y, m), 0.0) + net / eff * MM_HA_TO_M3 * p.area_ha
    return out


def _pick(plans: list[Plan], priority: str) -> Plan | None:
    if not plans:
        return None
    by_score = sorted(plans, key=lambda x: (-x.score, x.cycles))
    if priority == "agua":
        top = by_score[0].stats["mean_soles"]
        ok = [x for x in plans if x.stats["mean_soles"] >= 0.8 * top] or by_score
        return min(ok, key=lambda x: (sum(x.monthly_gross_m3.values()), -x.score, x.cycles))
    return by_score[0]


def optimize(p: ParcelInput, catalog: Catalog, climate, start: date, end: date) -> OptimizerResult | None:
    if not climate.available or not p.water.efficiency:
        return None
    beta = BETA_PRUDENT if p.priority in ("dinero", "equilibrada", "suelo") else 0.3
    draws = Draws.make()
    require_legume = p.priority == "suelo"
    validated = _validated_crops(catalog)
    plans = _plans_for(p, catalog, climate, validated, start, end, draws, beta, require_legume)
    all_plans = _plans_for(p, catalog, climate, list(catalog.crops), start, end, draws, beta, require_legume)
    best = _pick(plans, p.priority)
    best_all = _pick(all_plans, p.priority)
    explore = best_all if best_all and (best is None or (best_all.cycles != best.cycles and best_all.score > best.score)) else None
    portfolio = _portfolio(plans, p, catalog, climate, draws, beta) if best else None
    note = (
        f"Comparó {len(plans)} plan(es) con cultivos validados y {len(all_plans)} incluyendo cultivos por explorar; "
        f"{SAMPLES} escenarios (año NASA POWER, precio y rendimiento) con semilla fija. "
        "Excluye un tercer consecutivo del mismo producto, contando el cultivo actual; descansar no reinicia la racha."
    )
    return OptimizerResult(best, explore, plans, portfolio, note, beta)


def _cycles_of(st) -> tuple[tuple[str, date], ...]:
    return tuple((b.crop_id, b.start) for b in st.timeline if b.kind == "cultivo" and b.crop_id)


def attach(strategies: list, p: ParcelInput, catalog: Catalog, climate, start: date, end: date, assess) -> dict | None:
    """Agrega el plan sugerido (D) y el mejor por explorar (E) como estrategias normales del motor, y el
    riesgo y precio de equilibrio de TODAS las opciones con la misma muestra Monte Carlo."""
    from ceres.domain.catalog import StrategyTemplate

    res = optimize(p, catalog, climate, start, end)
    if res is None:
        return None
    existing = {_cycles_of(st): st for st in strategies}
    roles: dict[str, str] = {}
    src = (climate.source_id, "FAO56-PM", "FAO56-KC", "FAO29-SAL", "MIDAGRI-SISAP", "DEMO-ECONOMIA")
    for sid, plan, role, name, short, cap, why in (
        ("D", res.best, "sugerido", "D. Plan sugerido por CERES", "Plan sugerido con tus datos", None,
         "Mejor secuencia con cultivos validados en la zona: programación dinámica sobre las fechas de siembra y "
         "1 000 escenarios Monte Carlo (año NASA POWER, precio y rendimiento), con perfil prudente."),
        ("E", res.explore, "explorar", "E. Mejor ganancia, por explorar", "Mejor ganancia con cultivos por explorar", "exploratoria",
         "Mismo método, incluyendo cultivos aún sin validación local (papa, ajo, arveja verde, zanahoria): "
         "supuestos de rendimiento, costos y precio en chacra por confirmar."),
    ):
        if plan is None:
            continue
        twin = existing.get(plan.cycles)
        if twin is not None:
            roles[twin.strategy_id] = role  # la plantilla ya es ese plan: solo se marca
            continue
        t = StrategyTemplate(sid, name, short, "explicita", cap, why, src, tuple(plan.sequence), tuple(d for _, d in plan.cycles))
        st = assess(t)
        strategies.append(st)
        existing[_cycles_of(st)] = st
        roles[sid] = role

    draws = Draws.make()
    alloc = _alloc_hi(p)
    scored: dict[str, tuple[list, list[float]]] = {}
    for st in strategies:
        cyc = list(_cycles_of(st))
        xs = simulate(cyc, p, catalog, climate, draws, alloc) if cyc else None
        if xs is None:
            st.risk = {"role": roles.get(st.strategy_id)} if st.strategy_id in roles else None
            continue
        st.risk = risk_stats(xs, res.beta) | {
            "role": roles.get(st.strategy_id),
            "breakeven": breakeven(cyc, p, catalog, climate, draws, alloc),
        }
        scored[st.strategy_id] = (cyc, xs)

    # Precio de cambio: ¿a qué precio del cultivo principal del plan sugerido conviene la mejor otra opción?
    switch = None
    lead = next((sid for sid, r in roles.items() if r == "sugerido"), None)
    if lead and lead in scored:
        rivals = [st for st in strategies if st.strategy_id in scored and st.strategy_id != lead and st.status != "exploratoria"
                  and roles.get(st.strategy_id) != "explorar"]
        if rivals:
            rival = max(rivals, key=lambda s: s.risk["score_soles"])
            cyc = scored[lead][0]
            crop = main_crop(cyc, p, catalog)
            target = rival.risk["score_soles"]

            def gap(mult: float) -> float:
                return _score(simulate(cyc, p, catalog, climate, draws, alloc, {crop: mult}), res.beta) - target

            mult = bisect_price(gap, 0.0, 1.0) if crop else None
            if mult is not None:
                price = crop_econ(catalog.crop(crop), p).price
                switch = {"crop_id": crop, "price_soles_kg": round(price * mult, 2), "current_soles_kg": price,
                          "lead": lead, "rival": rival.strategy_id}
    return {
        "method": "Programación dinámica (K mejores caminos) + Monte Carlo con números aleatorios comunes; bisección para precios.",
        "objective": f"Score = (1 − β)·E[M] + β·CVaR₂₀(M), β = {res.beta}",
        "samples": SAMPLES,
        "seed": SEED,
        "beta": res.beta,
        "candidates": len(res.candidates),
        "roles": roles,
        "portfolio": res.portfolio,
        "switch": switch,
        "note": res.note,
        "constraints": [{
            "rule_id": "ANT-02", "type": "hard", "max_consecutive_sowings": MAX_CONSECUTIVE_SOWINGS,
            "current_crop_id": p.current_crop_id, "current_crop_streak": getattr(p, "current_crop_streak", 1),
            "includes_current_crop": True, "rest_resets_streak": False,
        }],
        "assumptions": [
            "Precio log-normal con σ por cultivo (supuesto de demostración); precio de hoy, no el de la cosecha.",
            "Si en un año NASA el mes más exigente supera tu agua, el rendimiento baja en proporción (Ky ≈ 1, supuesto).",
            "Repetir familia de cultivo en ciclos seguidos rinde 10 % menos (supuesto por verificar; no sustituye el límite de 2 por producto).",
        ],
    }


def _portfolio(plans: list[Plan], p, catalog, climate, draws, beta) -> dict | None:
    """Repartir la chacra entre dos planes: diversifica precio y escalona los picos de agua."""
    if len(plans) < 2:
        return None
    alloc = _alloc_hi(p)
    best_single = max(x.score for x in plans)
    top = sorted(plans, key=lambda x: -x.score)[:5]
    full = {x.cycles: simulate(list(x.cycles), p, catalog, climate, draws, None) for x in top}
    best = None
    for i, a in enumerate(top):
        for b in top[i + 1 :]:
            if set(a.sequence) == set(b.sequence):
                continue
            for x in (0.3, 0.5, 0.7):
                if alloc is not None:
                    months = set(a.monthly_gross_m3) | set(b.monthly_gross_m3)
                    if any(x * a.monthly_gross_m3.get(m, 0) + (1 - x) * b.monthly_gross_m3.get(m, 0) > alloc for m in months):
                        continue
                xs = [x * u + (1 - x) * v for u, v in zip(full[a.cycles], full[b.cycles])]
                st = risk_stats(xs, beta)
                if best is None or st["score_soles"] > best["stats"]["score_soles"]:
                    best = {"share": x, "a": a, "b": b, "stats": st}
    if best is None or best_single <= 0 or best["stats"]["score_soles"] < 1.05 * best_single:
        return None
    a, b, x = best["a"], best["b"], best["share"]
    return {
        "lots": [
            {"share": x, "area_ha": round(p.area_ha * x, 2), "sequence": a.sequence, "cycles": [(c, d.isoformat()) for c, d in a.cycles]},
            {"share": round(1 - x, 2), "area_ha": round(p.area_ha * (1 - x), 2), "sequence": b.sequence, "cycles": [(c, d.isoformat()) for c, d in b.cycles]},
        ],
        "stats": best["stats"],
        "gain_vs_single": round(best["stats"]["score_soles"] / best_single - 1, 3),
    }
