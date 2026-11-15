"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Strategy, Status } from "@/lib/types";
import s from "./landing.module.css";

// ---------------------------------------------------------------- datos

interface Clim { month: number; et0_mm: number | null; rain_mm: number | null; t_min_c: number | null; t_max_c: number | null; years: number }
interface PublicContext { monthly_climatology: Clim[]; nasa: { period: { start: string; end: string }; days: number; sha256: string } | null }
interface CatalogCrop { id: string; name: string; cycle_days: number }

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const fmt = (v: number, d = 0) => v.toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: d });

/** Reparte un ciclo de `days` días que empieza el 1 del mes `start` (0-11) entre los meses. */
function cycleShares(start: number, days: number): number[] {
  const share = new Array(12).fill(0);
  let m = start, left = days;
  while (left > 0) {
    const take = Math.min(DIM[m], left);
    share[m] += take / DIM[m];
    left -= take;
    m = (m + 1) % 12;
  }
  return share;
}

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setShown(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    // Salida de seguridad: el contenido nunca queda oculto si el observador no se dispara.
    const t = window.setTimeout(() => setShown(true), 2500);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);
  return [ref, `${s.reveal} ${shown ? s.revealed : ""}`] as const;
}

// ---------------------------------------------------------------- iconos

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);
const Icon = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I = {
  chat: "M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z",
  cards: "M4 5h16v4H4zM4 11h16v4H4zM4 17h10v3H4z",
  why: "M12 17h.01M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1.2-1.3 2.1V14M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  book: "M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Zm14 13H7a3 3 0 0 0-3 3",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm7 9a7 7 0 0 1-14 0m7 7v3",
  sat: "M13 7 9 3 5 7l4 4m4-4 4 4-4 4m-4-4 4-4m2 10a4 4 0 0 0 4-4m-8 8a8 8 0 0 0 8-8",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14",
  spark: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6",
  scale: "M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0L7 7Zm10 0-3 7a3 3 0 0 0 6 0l-3-7Z",
};

function BrandMark() {
  return (
    <svg className={s.brandMark} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#1f4d2b" />
      <path d="M16 25V12" stroke="#f6f1e6" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 15c-4 0-6-2.5-6-6 4 0 6 2.5 6 6Zm0 4c4 0 6-2.5 6-6-4 0-6 2.5-6 6Z" fill="#d9a53a" />
    </svg>
  );
}

// ---------------------------------------------------------------- ilustración de la pampa

function FieldIllustration() {
  // Mosaico determinista de lotes regados sobre la pampa desértica (evoca la Irrigación Majes).
  const plots = useMemo(() => {
    const out: { x: number; y: number; w: number; h: number; c: string }[] = [];
    const palette = ["#3f7d3a", "#5b9a45", "#7fae55", "#c9a447", "#a9c27a", "#2f6b3a", "#d8c48f"];
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 7; c++) {
        if (rnd() < 0.16) continue;
        out.push({ x: 40 + c * 78 + rnd() * 4, y: 30 + r * 68 + rnd() * 4, w: 70, h: 60, c: palette[Math.floor(rnd() * palette.length)] });
      }
    }
    return out;
  }, []);
  return (
    <svg viewBox="0 0 600 660" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ilustración de lotes regados en la Pampa de Majes">
      <defs>
        <linearGradient id="sand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efe2c6" />
          <stop offset="1" stopColor="#dcc79c" />
        </linearGradient>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#0f1c14" stopOpacity="0.55" />
        </linearGradient>
        <pattern id="rows" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#000" strokeOpacity="0.08" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="600" height="660" fill="url(#sand)" />
      {plots.map((p, i) => (
        <g key={i}>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="3" fill={p.c} />
          <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="3" fill="url(#rows)" />
        </g>
      ))}
      <path d="M0 360 C120 330 220 400 330 370 S520 300 600 330" stroke="#6fa3c8" strokeWidth="7" fill="none" opacity="0.85" />
      <path d="M-20 120 Q300 -40 640 140" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="4 7" fill="none" />
      <g transform="translate(470 88) rotate(18)">
        <rect x="-16" y="-6" width="32" height="12" rx="2" fill="#fff" />
        <rect x="-44" y="-4" width="24" height="8" fill="#9fc3df" />
        <rect x="20" y="-4" width="24" height="8" fill="#9fc3df" />
      </g>
      <rect width="600" height="660" fill="url(#shade)" />
    </svg>
  );
}

// ---------------------------------------------------------------- vista previa del teléfono

const LEVEL: Record<Status, { label: string; cls: string }> = {
  viable_con_supuestos: { label: "Buena opción", cls: s.pillGood },
  requiere_datos: { label: "Posible, confirma", cls: s.pillMaybe },
  no_viable: { label: "No conviene", cls: s.pillNo },
  exploratoria: { label: "Por explorar", cls: s.pillExplore },
};
const CROP_COLOR: Record<string, string> = { maiz_grano: "#d9a53a", frejol_grano: "#5b9a45", cebolla_roja: "#a2456f" };
const SHORT: Record<string, string> = { maiz_grano: "Maíz", frejol_grano: "Frejol", cebolla_roja: "Cebolla" };

function PhonePreview({ strategies }: { strategies: Strategy[] | null }) {
  return (
    <div className={s.phone} aria-label="Vista previa del modo sencillo con el caso demo de Majes">
      <div className={s.phoneScreen}>
        <div className={s.phoneTop}><span>CERES</span><span>Caso demo · Majes I</span></div>
        <p className={s.phoneTitle}>Tus 3 opciones</p>
        <p className={s.phoneSub}>Después del maíz que cosechas</p>
        {!strategies &&
          [0, 1, 2].map((i) => <div key={i} className={`${s.opt} ${s.skeleton}`} style={{ height: 96 }} />)}
        {strategies?.map((st) => {
          const lvl = LEVEL[st.status];
          const margin = st.metrics[`${st.strategy_id}.eco.margen`]?.value;
          const water = st.metrics[`${st.strategy_id}.agua.bruto_m3`]?.value ?? null;
          const total = st.timeline.reduce((a, b) => a + (Date.parse(b.end) - Date.parse(b.start)), 0) || 1;
          return (
            <div key={st.strategy_id} className={s.opt}>
              <div className={s.optHead}>
                <span className={s.optName}>{st.sequence.map((c) => SHORT[c] ?? c).join(" → ")}</span>
                <span className={`${s.pill} ${lvl.cls}`}>{lvl.label}</span>
              </div>
              <p className={s.optLine}>
                {margin != null ? <>Margen ≈ S/ {fmt(margin)}</> : "Margen pendiente"}
                {water != null ? <> · agua ≈ {fmt(water)} m³</> : null}
              </p>
              <div className={s.bar} aria-hidden="true">
                {st.timeline.map((b, i) => (
                  <i key={i} style={{ width: `${((Date.parse(b.end) - Date.parse(b.start)) / total) * 100}%`, background: b.kind === "cultivo" ? CROP_COLOR[b.crop_id ?? ""] ?? "#888" : "#e7dcc4" }} />
                ))}
              </div>
              <div className={s.optFoot}><span>24 meses</span><span className={s.why}>¿Por qué? →</span></div>
            </div>
          );
        })}
        <p className={s.phoneNote}>Cifras reales del motor con supuestos de demostración</p>
      </div>
    </div>
  );
}

/** Razón principal en lenguaje llano, construida solo con datos del resultado del motor. */
function plainReason(st: Strategy): string {
  const blocking = st.reasons.find((r) => r.state === "no_cumple" || r.state === "falta_dato");
  if (blocking) return blocking.message;
  const crops = st.sequence.map((c) => (SHORT[c] ?? c).toLowerCase()).join(" y ");
  const fam = st.metrics[`${st.strategy_id}.suelo.familias`]?.value;
  const waterOk = st.reasons.some((r) => r.rule_id === "AGU-05");
  const margin = st.metrics[`${st.strategy_id}.eco.margen`]?.value;
  const parts = [`Alterna ${crops}${fam && fam > 1 ? `, de ${fam} familias distintas` : ""}`];
  if (waterOk) parts.push("el agua declarada alcanza en todos los meses");
  if (margin != null) parts.push(`su margen estimado es S/ ${fmt(margin)} en 24 meses`);
  return parts.join("; ") + ".";
}

// ---------------------------------------------------------------- gráfico «¿cuándo sembrar?»

function SowingChart({ clim, crops }: { clim: Clim[] | null; crops: CatalogCrop[] }) {
  const [crop, setCrop] = useState("frejol_grano");
  const [start, setStart] = useState(2);
  const cycle = crops.find((c) => c.id === crop)?.cycle_days ?? 95;

  const calc = useMemo(() => {
    if (!clim || clim.some((c) => c.et0_mm == null)) return null;
    const et0 = clim.map((c) => c.et0_mm as number);
    const rain = clim.map((c) => c.rain_mm ?? 0);
    const totals = Array.from({ length: 12 }, (_, m) => {
      const sh = cycleShares(m, cycle);
      return { et0: sh.reduce((a, f, i) => a + f * et0[i], 0), rain: sh.reduce((a, f, i) => a + f * rain[i], 0) };
    });
    return { et0, shares: cycleShares(start, cycle), totals };
  }, [clim, cycle, start]);

  if (!calc) return <div className={`${s.chartCard} ${s.skeleton}`} style={{ height: 420 }} aria-label="Cargando datos NASA" />;

  const max = Math.max(...calc.et0);
  const cur = calc.totals[start];
  const sorted = [...calc.totals.keys()].sort((a, b) => calc.totals[a].et0 - calc.totals[b].et0);
  const best = sorted[0], worst = sorted[11];
  const diff = (1 - calc.totals[best].et0 / calc.totals[worst].et0) * 100;
  const W = 600, H = 220, bw = W / 12;

  return (
    <div className={s.chartCard}>
      <div className={s.cropTabs} role="group" aria-label="Cultivo">
        {crops.map((c) => (
          <button key={c.id} className={s.month} aria-pressed={crop === c.id} onClick={() => setCrop(c.id)}>
            {SHORT[c.id] ?? c.name} · {c.cycle_days} d
          </button>
        ))}
      </div>
      <p className={s.chartQ}>¿En qué mes siembras?</p>
      <div className={s.months} role="group" aria-label="Mes de siembra">
        {MESES.map((m, i) => (
          <button key={m} className={s.month} aria-pressed={start === i} onClick={() => setStart(i)}>{m}</button>
        ))}
      </div>
      <svg className={s.chartSvg} viewBox={`0 0 ${W} ${H + 36}`} role="img" aria-label={`Evapotranspiración de referencia mensual promedio 2015–2025; el ciclo de ${SHORT[crop]} sembrado en ${MESES_LARGO[start]} cubre los meses resaltados`}>
        {calc.et0.map((v, i) => {
          const h = (v / max) * (H - 30);
          const inCycle = calc.shares[i] > 0;
          return (
            <g key={i}>
              <rect x={i * bw + 6} y={H - h} width={bw - 12} height={h} rx="7" fill={inCycle ? (calc.shares[i] > 0.999 ? "#1f4d2b" : "#5b9a45") : "#dfe9d6"} />
              <title>{`${MESES_LARGO[i]}: ${Math.round(v)} mm${inCycle ? ` · ${Math.round(calc.shares[i] * 100)} % del mes dentro del ciclo` : ""}`}</title>
              <text x={i * bw + bw / 2} y={H - h - 8} textAnchor="middle" fontSize="17" fill={inCycle ? "#13221a" : "#8a9384"} fontWeight="700">{Math.round(v)}</text>
              <text x={i * bw + bw / 2} y={H + 26} textAnchor="middle" fontSize="18" fill="#66705f">{MESES[i]}</text>
            </g>
          );
        })}
      </svg>
      <div className={s.legend}><span><i style={{ background: "#1f4d2b" }} />Mes completo del ciclo</span><span><i style={{ background: "#5b9a45" }} />Mes parcial</span><span><i style={{ background: "#dfe9d6" }} />Resto del año · ET0 en mm</span></div>
      <div className={s.resultRow}>
        <div className={s.resultBox}><strong>{fmt(cur.et0)} mm</strong><span>pide la atmósfera durante el ciclo (ET0)</span></div>
        <div className={s.resultBox}><strong>{fmt(cur.rain)} mm</strong><span>de lluvia promedio en esos meses</span></div>
      </div>
      <p className={s.insight}>
        Sembrando {SHORT[crop].toLowerCase()} en <b>{MESES_LARGO[best]}</b>, la atmósfera pide cerca de <b>{fmt(diff)} % menos</b> agua que sembrando en {MESES_LARGO[worst]}. Casi todo tendrá que venir del canal.
      </p>
      <p className={s.fine}>
        Promedios mensuales de NASA POWER (2015–2025) en la celda de Majes; ET0 calculada por CERES con FAO-56. Es demanda de la atmósfera, no el riego del cultivo: la app completa aplica el coeficiente de cada etapa (ETc = Kc × ET0) y la lluvia efectiva. Clima histórico, no pronóstico.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- página

export default function Landing() {
  const [ctx, setCtx] = useState<PublicContext | null>(null);
  const [strategies, setStrategies] = useState<Strategy[] | null>(null);
  const [crops, setCrops] = useState<CatalogCrop[]>([]);
  const [r1, c1] = useReveal<HTMLDivElement>();
  const [r2, c2] = useReveal<HTMLDivElement>();
  const [r3, c3] = useReveal<HTMLDivElement>();
  const [r4, c4] = useReveal<HTMLDivElement>();
  const [r5, c5] = useReveal<HTMLDivElement>();
  const [r6, c6] = useReveal<HTMLDivElement>();

  useEffect(() => {
    api<PublicContext>("/public/context").then(setCtx).catch(() => setCtx(null));
    api<{ run: { result: { strategies: Strategy[] } } | null }>("/public/demo").then((d) => setStrategies(d.run?.result.strategies ?? [])).catch(() => setStrategies([]));
    api<{ crops: CatalogCrop[] }>("/catalog").then((c) => setCrops(c.crops)).catch(() => {});
  }, []);

  const yearly = useMemo(() => {
    const c = ctx?.monthly_climatology;
    if (!c?.length || c.some((m) => m.et0_mm == null || m.rain_mm == null)) return null;
    const et0 = c.reduce((a, m) => a + (m.et0_mm as number), 0);
    const rain = c.reduce((a, m) => a + (m.rain_mm as number), 0);
    return { et0, rain, pct: (rain / et0) * 100 };
  }, [ctx]);

  const reasonB = strategies?.find((x) => x.strategy_id === "B");
  const layerReason = reasonB ? plainReason(reasonB) : null;
  const layerSources = Array.from(new Set(reasonB?.reasons.flatMap((r) => r.source_ids) ?? [])).slice(0, 5);

  return (
    <div className={s.page}>
      <header className={s.nav}>
        <div className={`${s.container} ${s.navInner}`}>
          <Link href="/" className={s.brand} aria-label="CERES, inicio"><BrandMark /> CERES <span>Majes</span></Link>
          <nav className={s.navLinks} aria-label="Secciones">
            <a href="#como">Cómo funciona</a>
            <a href="#nasa">Datos NASA</a>
            <a href="#viene">Lo que viene</a>
            <Link href="/fuentes">Fuentes</Link>
          </nav>
          <div className={s.navCta}>
            <Link href="/ingresar" className={`${s.btn} ${s.btnGhost} ${s.btnSmall} ${s.hideXs}`}>Ingresar</Link>
            <Link href="/demo" className={`${s.btn} ${s.btnPrimary} ${s.btnSmall}`}>Probar</Link>
          </div>
        </div>
      </header>

      <main id="contenido">
        {/* HERO */}
        <section className={s.hero}>
          <div className={`${s.container} ${s.heroGrid}`}>
            <div>
              <span className={s.eyebrow}><span className={s.eyebrowDot} />NASA Space Apps 2026 · Pampa de Majes, Arequipa</span>
              <h1 className={`${s.display} ${s.h1}`}>Decide qué sembrar después, con <em>datos de la NASA</em> y tus propias cuentas.</h1>
              <p className={s.lead}>
                CERES compara tu siguiente siembra con dos alternativas según el agua del canal, el clima de los últimos 11 años y lo que te importa más. Primero ves opciones claras; después, el porqué. La decisión es tuya.
              </p>
              <div className={s.heroCtas}>
                <Link href="/demo" className={`${s.btn} ${s.btnPrimary}`}>Ver el caso de Majes</Link>
                <Link href="/avanzado" className={`${s.btn} ${s.btnGhost}`}>Comparar mi parcela</Link>
              </div>
              <div className={s.trust}>
                <span><Check />Clima NASA POWER 2015–2025</span>
                <span><Check />Método FAO-56 verificado</span>
                <span><Check />Cada cifra con su fuente</span>
              </div>
            </div>
            <div className={s.visual}>
              <div className={s.fieldCard}><FieldIllustration /><span className={s.fieldLabel}>Irrigación Majes I</span></div>
              <PhonePreview strategies={strategies} />
              {yearly && (
                <div className={`${s.chip} ${s.chipNasa}`}>
                  <small>NASA POWER · demanda anual</small>
                  <strong>{fmt(yearly.et0)} mm</strong>
                  <small>vs {fmt(yearly.rain)} mm de lluvia</small>
                </div>
              )}
              <div className={`${s.chip} ${s.chipAi}`}>
                <span className={s.aiOrb}><span>IA</span></span>
                <span><b>¿Por qué frejol?</b><br /><small>La IA explica con fuentes</small></span>
              </div>
            </div>
          </div>
        </section>

        {/* DATOS NASA */}
        <section className={s.sectionTight}>
          <div className={s.container}>
            <div ref={r1} className={`${s.dataBand} ${c1}`}>
              <p className={s.kicker}>El problema</p>
              <h2 className={`${s.display} ${s.h2}`}>En la pampa, casi toda el agua viene del canal.</h2>
              <p className={s.sub}>Elegir solo por el precio de una cosecha deja fuera cuánta agua pedirá el cultivo, en qué meses y qué viene después. CERES lo pone sobre la mesa con datos.</p>
              <div className={s.stats}>
                <div className={s.stat}>
                  <div className={s.statValue}>{yearly ? fmt(yearly.et0) : "—"}<small>mm/año</small></div>
                  <div className={s.statLabel}>de agua que pide la atmósfera (evapotranspiración de referencia)</div>
                </div>
                <div className={s.stat}>
                  <div className={s.statValue}>{yearly ? fmt(yearly.rain) : "—"}<small>mm/año</small></div>
                  <div className={s.statLabel}>de lluvia promedio en la misma zona</div>
                </div>
                <div className={s.stat}>
                  <div className={s.statValue}>{yearly ? fmt(yearly.pct) : "—"}<small>%</small></div>
                  <div className={s.statLabel}>de esa demanda que cubre la lluvia; el resto, riego</div>
                </div>
              </div>
              <p className={s.dataNote}>
                Promedios 2015–2025 de NASA POWER{ctx?.nasa ? ` (${fmt(ctx.nasa.days)} días, sin datos faltantes)` : ""} para la celda regional de Majes; ET0 calculada por CERES con FAO-56. <Link href="/fuentes">Ver fuente y procedencia</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section id="como" className={s.section}>
          <div ref={r2} className={`${s.container} ${c2}`}>
            <p className={s.kicker}>Cómo funciona</p>
            <h2 className={`${s.display} ${s.h2}`}>Tres preguntas, tres opciones, un porqué.</h2>
            <div className={s.steps}>
              <article className={s.step}>
                <span className={s.stepNum} aria-hidden="true">1</span>
                <div className={s.stepIcon}><Icon d={I.chat} /></div>
                <h3>Cuéntanos lo básico</h3>
                <p>Sin estudios de suelo ni formularios largos. Si no sabes algo, responde «no sé».</p>
                <ul className={s.qList}><li>¿Qué sembraste?</li><li>¿Cuándo cosechas?</li><li>¿Qué te importa más?</li></ul>
              </article>
              <article className={s.step}>
                <span className={s.stepNum} aria-hidden="true">2</span>
                <div className={s.stepIcon}><Icon d={I.cards} /></div>
                <h3>Mira tus opciones</h3>
                <p>Tu plan y dos alternativas sobre los mismos 24 meses: cuándo sembrar y cosechar, agua por mes y margen estimado.</p>
              </article>
              <article className={s.step}>
                <span className={s.stepNum} aria-hidden="true">3</span>
                <div className={s.stepIcon}><Icon d={I.why} /></div>
                <h3>Pregunta por qué</h3>
                <p>Cada opción se explica en capas, hasta la fuente. Y si falta un dato, te decimos cuál cambiaría la decisión.</p>
              </article>
            </div>
          </div>
        </section>

        {/* GRÁFICO NASA */}
        <section id="nasa" className={s.section} style={{ paddingTop: 0 }}>
          <div ref={r3} className={`${s.container} ${s.chartWrap} ${c3}`}>
            <div>
              <p className={s.kicker}>Datos NASA que cambian la decisión</p>
              <h2 className={`${s.display} ${s.h2}`}>¿Cuándo te conviene sembrar?</h2>
              <p className={s.sub}>
                El mismo cultivo no pide la misma agua en cualquier mes. Con 11 años de datos diarios de la NASA, CERES calcula cuánta agua exigirá cada ciclo según la fecha de siembra. Prueba cambiando el mes.
              </p>
            </div>
            <SowingChart clim={ctx?.monthly_climatology ?? null} crops={crops.length ? crops : [{ id: "frejol_grano", name: "Frejol", cycle_days: 95 }]} />
          </div>
        </section>

        {/* POR QUÉ EN CAPAS */}
        <section className={s.section} style={{ paddingTop: 0 }}>
          <div ref={r4} className={`${s.container} ${s.whyWrap} ${c4}`}>
            <div>
              <p className={s.kicker}>Opciones primero, el porqué después</p>
              <h2 className={`${s.display} ${s.h2}`}>Nada de cajas negras.</h2>
              <p className={s.sub}>
                Cada recomendación se abre en capas: primero la razón en una frase, luego los datos y supuestos usados, y al final el detalle técnico con sus fuentes. Los supuestos se marcan como supuestos; nunca se presentan como mediciones.
              </p>
            </div>
            <div className={s.layers}>
              <div className={s.layer}>
                <span className={s.layerN}>1</span>
                <div><h4>La razón, en una frase</h4><p>{layerReason ?? "Cargando la explicación del caso demo…"}</p></div>
              </div>
              <div className={s.layer}>
                <span className={s.layerN}>2</span>
                <div><h4>Datos y supuestos usados</h4><p>Agua declarada, clima NASA de esas fechas, umbrales del cultivo y precios — cada uno etiquetado como observado, declarado o supuesto.</p></div>
              </div>
              <div className={s.layer}>
                <span className={s.layerN}>3</span>
                <div>
                  <h4>Detalle técnico y fuentes</h4>
                  <p>Fórmulas, unidades y reglas del motor, con la fuente original de cada parámetro.</p>
                  {layerSources.length > 0 && <div className={s.layerSrc}>{layerSources.map((x) => <span key={x}>{x}</span>)}</div>}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LO QUE VIENE */}
        <section id="viene" className={s.section} style={{ paddingTop: 0 }}>
          <div ref={r5} className={`${s.container} ${c5}`}>
            <p className={s.kicker}>Hoy y lo que viene</p>
            <h2 className={`${s.display} ${s.h2}`}>De calculadora a cuaderno de campo.</h2>
            <p className={s.sub}>Lo que ya funciona y hacia dónde va CERES: cuanto más registras, más se parecen las recomendaciones a tu chacra.</p>
            <div className={s.features}>
              {[
                { icon: I.cards, bg: "#dfe9d6", fg: "#1f4d2b", t: "Comparación de 3 ciclos", d: "Tu plan y dos alternativas con calendario, agua mes a mes y margen.", live: true },
                { icon: I.scale, bg: "#d9e8f2", fg: "#2f6f9f", t: "Evidencia y fuentes", d: "Cada cifra enlaza a su fuente: NASA, FAO, SERFOR/INEI o tu propio dato.", live: true },
                { icon: I.spark, bg: "#f3e6c8", fg: "#8a5a00", t: "Asistente IA con citas", d: "Explica en lenguaje sencillo; una respuesta con cifras sin respaldo se rechaza.", live: true },
                { icon: I.map, bg: "#ece3d0", fg: "#3d4b40", t: "Modo avanzado", d: "Mapa del Perú, perfil completo, simulación de escenarios e historial para asesores.", live: true },
                { icon: I.book, bg: "#dfe9d6", fg: "#1f4d2b", t: "Cuaderno de campo", d: "Campañas, ventas, costos y ganancias: tus números reemplazan los supuestos.", live: false },
                { icon: I.mic, bg: "#f8ddd6", fg: "#9b2f1f", t: "Registro por voz", d: "Manda un audio: «vendí 40 toneladas a un sol diez». CERES propone y tú confirmas.", live: false },
                { icon: I.chat, bg: "#ebe4f6", fg: "#5d4189", t: "Conversa con Ceres", d: "Un asistente que recuerda tus campañas y simula escenarios contigo.", live: false },
                { icon: I.sat, bg: "#d9e8f2", fg: "#2f6f9f", t: "Tu chacra desde el satélite", d: "Índice de vegetación mensual (HLS de NASA, 30 m) de tu lote.", live: false },
                { icon: I.cards, bg: "#f3e6c8", fg: "#8a5a00", t: "Modo sencillo", d: "Tres preguntas, opciones en palabras simples y ayuda junto a cada término.", live: false },
              ].map((f) => (
                <article key={f.t} className={s.feature}>
                  <div className={s.featureTop}>
                    <span className={s.featureIcon} style={{ background: f.bg, color: f.fg }}><Icon d={f.icon} /></span>
                    <span className={`${s.badge} ${f.live ? s.badgeLive : s.badgeSoon}`}>{f.live ? "Disponible" : "Próximamente"}</span>
                  </div>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CERES */}
        <section className={s.section} style={{ paddingTop: 0 }}>
          <div className={s.container}>
            <div ref={r6} className={`${s.ceres} ${c6}`}>
              <div>
                <p className={s.kicker}>Próximamente · Ceres</p>
                <h2 className={`${s.display} ${s.h2}`}>Un asistente que te pregunta, te escucha y recuerda.</h2>
                <p className={s.sub}>Cada mes, Ceres te pregunta lo que falta en tu cuaderno. Respondes con un audio y él lo convierte en registros que tú confirmas. Luego conversa contigo sobre qué sembrar, recordando tus campañas anteriores.</p>
                <ul className={s.ceresList}>
                  <li><Check /><span>Habla o escribe; no hace falta llenar formularios.</span></li>
                  <li><Check /><span>Nada se guarda sin tu confirmación.</span></li>
                  <li><Check /><span>Las cifras salen de tus registros o del motor, nunca inventadas.</span></li>
                </ul>
              </div>
              <div>
                <div className={s.chat} aria-label="Ejemplo ilustrativo de conversación con Ceres">
                  <div className={s.chatHead}>
                    <span className={s.aiOrb}><span>IA</span></span>
                    <div><strong>Ceres</strong><small>Revisión de noviembre</small></div>
                  </div>
                  <div className={s.msgs}>
                    <div className={`${s.msg} ${s.msgBot}`}>Hola, Rosa. Este mes no registraste ventas. ¿Ya vendiste el maíz del lote 3?</div>
                    <div className={`${s.msg} ${s.msgMe}`}>
                      <div className={s.voice}>
                        <b aria-hidden="true">▶</b>
                        <span className={s.wave} aria-hidden="true">{[9, 16, 22, 12, 18, 8, 20, 14, 10, 17].map((h, i) => <i key={i} style={{ height: h, animationDelay: `${i * 0.09}s` }} />)}</span>
                        <span>0:12</span>
                      </div>
                    </div>
                    <div className={s.confirm}>
                      Entendí esto. ¿Lo guardo en tu cuaderno?
                      <dl><dt>Venta</dt><dd>Maíz amarillo duro</dd><dt>Cantidad</dt><dd>40 t</dd><dt>Precio</dt><dd>S/ 1,10 por kg</dd></dl>
                      <div className={s.confirmBtns}><span style={{ background: "#1f4d2b", color: "#fff" }}>Guardar</span><span style={{ background: "#ece3d0" }}>Corregir</span></div>
                    </div>
                  </div>
                  <p className={s.illus}>Ejemplo ilustrativo de la próxima versión</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HONESTIDAD */}
        <section className={s.sectionTight}>
          <div className={s.container}>
            <p className={s.kicker}>Con los pies en la tierra</p>
            <h2 className={`${s.display} ${s.h2}`}>Lo que CERES no hace.</h2>
            <div className={s.honest}>
              <div className={s.honestItem}><h4>No promete cosechas</h4><p>Estima con supuestos visibles; no garantiza rendimientos, precios ni ahorro.</p></div>
              <div className={s.honestItem}><h4>No pronostica el clima</h4><p>Usa 11 años de historia de la NASA para comparar fechas, no para adivinar la próxima campaña.</p></div>
              <div className={s.honestItem}><h4>No inventa tus datos</h4><p>Si algo se supone, lo dice. Tus registros siempre valen más que un promedio.</p></div>
              <div className={s.honestItem}><h4>No decide por ti</h4><p>Te da opciones y razones. La última palabra es tuya y de tu asesor.</p></div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className={s.section}>
          <div className={s.container}>
            <div className={s.final}>
              <h2 className={`${s.display} ${s.h2}`}>Mira cómo decide CERES con un caso real de Majes.</h2>
              <p>Explora la comparación pública con datos NASA, o crea tu cuenta para guardar tu parcela y preguntarle a la IA.</p>
              <div className={s.finalCtas}>
                <Link href="/demo" className={`${s.btn} ${s.btnLight}`}>Ver el caso de Majes</Link>
                <Link href="/ingresar" className={`${s.btn} ${s.btnGhost}`}>Crear mi cuenta</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.container}`}>
          <div className={s.footGrid}>
            <div>
              <Link href="/" className={s.brand}><BrandMark /> CERES <span>Majes</span></Link>
              <p style={{ marginTop: 12, lineHeight: 1.6 }}>Apoyo a decisiones de cultivo para la Irrigación Majes I. Proyecto para el NASA Space Apps Challenge 2026 — «Field Shift: Adapting Farms with NASA Data».</p>
            </div>
            <div>
              <h5>Producto</h5>
              <ul><li><Link href="/demo">Caso demo</Link></li><li><Link href="/avanzado">Modo avanzado</Link></li><li><Link href="/ingresar">Ingresar</Link></li></ul>
            </div>
            <div>
              <h5>Datos</h5>
              <ul><li><Link href="/fuentes">Fuentes y procedencia</Link></li><li><a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER</a></li><li><a href="https://www.fao.org/4/x0490e/x0490e00.htm" target="_blank" rel="noreferrer">FAO-56</a></li></ul>
            </div>
          </div>
          <div className={s.footBottom}>
            Prototipo: no garantiza rendimientos, precios ni ahorro, y no reemplaza la asesoría agronómica local. Clima histórico de NASA POWER (celda regional, no medición de la parcela). Límites referenciales SERFOR/INEI. Mapa © colaboradores de OpenStreetMap.
          </div>
        </div>
      </footer>
    </div>
  );
}
