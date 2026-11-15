"use client";

import { NasaBadge } from "@/components/NasaBadge";
import { SourceChips } from "@/components/Sources";
import { fmtDate, fmtNumber } from "@/lib/api";
import type { ComparisonResult, Decisive, Profile, Strategy } from "@/lib/types";
import { METHOD_LABEL, type Zone } from "@/lib/zones";
import { Sheet, Term } from "./help";
import { CropSeq, Icon, MoreButton, Tip, cropColor } from "./icons";
import s from "./simple.module.css";

const LEVEL_ICON: Record<string, string> = { buena: "check", posible: "question", explorar: "explore", sin_datos: "dots", no_conviene: "cross" };
const LEVEL_TIP: Record<string, string> = {
  buena: "Cumple con tu agua y tu suelo según lo que nos dijiste.",
  posible: "Puede funcionar: confirma el dato que falta (por ejemplo, tu agua).",
  explorar: "Idea con potencial, aún sin probar en tu zona. Tómala como exploración.",
  sin_datos: "Todavía no tenemos datos de este cultivo para calcularlo.",
  no_conviene: "No cumple una condición importante (agua, sal o clima).",
};

export function LevelBadge({ st }: { st: Strategy }) {
  const lvl = st.simple?.level ?? "posible";
  return (
    <Tip tip={LEVEL_TIP[lvl]} className={s.badge}>
      <b aria-hidden="true"><Icon name={LEVEL_ICON[lvl]} size={12} /></b>
      {st.simple?.label}
    </Tip>
  );
}

function MiniTimeline({ st, start, end }: { st: Strategy; start: string; end: string }) {
  const total = Date.parse(end) - Date.parse(start) || 1;
  return (
    <>
      <div className={s.bar} role="img" aria-label={st.timeline.filter((b) => b.kind === "cultivo").map((b) => `${b.label} de ${fmtDate(b.start)} a ${fmtDate(b.end)}`).join("; ")}>
        {st.timeline.map((b, i) => (
          <i key={i} style={{ width: `${((Date.parse(b.end) - Date.parse(b.start)) / total) * 100}%`, background: b.kind === "cultivo" ? cropColor(b.crop_id ?? "") : "#e7dcc4" }} />
        ))}
      </div>
      <div className={s.barLegend}><span>{fmtDate(start)}</span><span>24 meses</span><span>{fmtDate(end)}</span></div>
    </>
  );
}

const soles = (v: number) => (v < 0 ? `−S/ ${fmtNumber(-v)}` : `S/ ${fmtNumber(v)}`);

/** «Frejol ×4» en vez de «frejol → frejol → frejol → frejol»: se lee de un vistazo. */
export function shortNames(st: Strategy, cropLabel: (id: string) => string): string {
  const runs: { id: string; n: number }[] = [];
  for (const id of st.sequence) {
    const last = runs[runs.length - 1];
    if (last && last.id === id) last.n += 1;
    else runs.push({ id, n: 1 });
  }
  const txt = runs.map((r) => `${cropLabel(r.id)}${r.n > 1 ? ` ×${r.n}` : ""}`).join(" → ") || st.simple?.names || st.short;
  return txt.replace(/^./, (c) => c.toUpperCase());
}
const listEs = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} o ${xs[xs.length - 1]}`);

/** «No pierdes si vendes X a ≥ S/ p*» (bisección sobre la media Monte Carlo). */
function BreakevenLine({ st, cropLabel }: { st: Strategy; cropLabel: (id: string) => string }) {
  const be = st.simple?.facts.breakeven;
  if (!be?.price_soles_kg) return null;
  return (
    <p className={s.breakeven}>
      No pierdes si vendes {cropLabel(be.crop_id)} a <b>S/ {fmtNumber(be.price_soles_kg, 2)}/kg</b> o más en chacra (usamos S/ {fmtNumber(be.current_soles_kg, 2)}).
    </p>
  );
}

function RiskLine({ st }: { st: Strategy }) {
  const r = st.simple?.facts.risk;
  if (!r) return null;
  return (
    <p className={s.riskLine}>
      Rango probable <b>{soles(r.p10_soles)} – {soles(r.p90_soles)}</b> · probabilidad de perder <b>{fmtNumber(r.p_loss * 100, r.p_loss < 0.01 && r.p_loss > 0 ? 1 : 0)} %</b>
      {" "}<Term id="riesgo">¿Cómo se calcula?</Term>
    </p>
  );
}

export function OptionCard({
  st, result, onWhy, busy: _busy, cropLabel,
}: { st: Strategy; result: ComparisonResult; onWhy: () => void; onAnswer?: (patch: Record<string, string | number | null>) => void; busy: boolean; cropLabel: (id: string) => string }) {
  const f = st.simple?.facts;
  const water = st.decisive?.find((d) => d.id === "agua");
  const role = st.risk?.role ?? null;
  const lvl = st.simple?.level ?? "posible";
  const unvalidated = lvl === "explorar" || lvl === "no_conviene";
  const mine = st.strategy_id === "A";
  // Tarjeta mínima: qué sembrar (fichas de color), veredicto, 2–3 cifras con ícono y un «?» para todo lo demás.
  return (
    <article className={`${s.card} ${s[`lvl_${lvl}`]} ${role === "sugerido" ? s.cardLead : ""} ${lvl === "sin_datos" ? s.cardWide : ""}`} aria-labelledby={`opt-${st.strategy_id}`}>
      {role === "sugerido" && (
        <Tip className={s.ribbon} tip="Lo que más te deja con tu agua sin arriesgar de más, según 11 años de clima NASA y los precios de esta semana.">
          <Icon name="star" size={14} /> Te recomendamos
        </Tip>
      )}
      {role === "explorar" && (
        <Tip className={`${s.ribbon} ${s.ribbonExplore}`} tip="Gana más en el papel, pero usa cultivos aún sin probar en tu zona. Tómalo como idea, no como recomendación.">
          <Icon name="explore" size={14} /> Para explorar
        </Tip>
      )}
      {mine && <Tip className={`${s.ribbon} ${s.ribbonMine}`} tip="Lo que tenías pensado hacer."><Icon name="sprout" size={14} /> Tu plan</Tip>}
      <div className={s.cardTop}>
        <div className={s.cardTitle}>
          <CropSeq ids={st.sequence} label={cropLabel} />
          <h2 id={`opt-${st.strategy_id}`} className={`${s.names} ${s.display}`}>{shortNames(st, cropLabel)}</h2>
        </div>
        <LevelBadge st={st} />
      </div>
      <p className={s.headline}>{st.simple?.headline}</p>
      {lvl !== "sin_datos" && (
        <div className={s.iconFacts}>
          <Tip className={`${s.iconFact} ${unvalidated ? s.factMuted : ""}`} tip={unvalidated ? "Ganancia en 24 meses, sin validar en tu zona." : "Ganancia estimada en 24 meses (lo que queda después de los gastos). No es segura."}>
            <Icon name="money" />
            <strong>{f?.margin_soles != null ? soles(f.margin_soles) : "—"}</strong>
          </Tip>
          <Tip className={s.iconFact} tip="Agua de riego que necesitas en 24 meses, calculada con 11 años de clima NASA POWER.">
            <Icon name="water" />
            <strong>{f?.water_m3 != null ? `${fmtNumber(f.water_m3 / 1000, f.water_m3 < 10000 ? 1 : 0)} mil m³` : "—"}</strong>
          </Tip>
          <Tip className={s.iconFact} tip="Cuándo sembrarías por primera vez.">
            <Icon name="calendar" />
            <strong>{f?.first_sowing ? fmtDate(f.first_sowing).replace(/ \d{4}$/, "") : "—"}</strong>
          </Tip>
          {!unvalidated && f?.risk && (
            <Tip className={s.iconFact} tip={`En 1 000 campañas simuladas, perdiste dinero en ${fmtNumber(f.risk.p_loss * 100, 1)} % de ellas.`}>
              <Icon name="shield" />
              <strong>{f.risk.p_loss < 0.05 ? "Riesgo bajo" : f.risk.p_loss < 0.15 ? "Riesgo medio" : "Riesgo alto"}</strong>
            </Tip>
          )}
        </div>
      )}
      <div className={s.cardActions}>
        {water && (
          <a href="#agua" className={s.waterLink} title={`Depende del agua que te llega en ${water.label.replace(/^tu agua de /, "")}`}>
            <Icon name="water" size={16} /> Confirma tu agua
          </a>
        )}
        {lvl !== "sin_datos" && <MoreButton onClick={onWhy} />}
      </div>
    </article>
  );
}

/** Lo que antes llenaba la tarjeta, ahora bajo demanda (dentro de «Ver más»). */
function Highlights({ st, result, cropLabel }: { st: Strategy; result: ComparisonResult; cropLabel: (id: string) => string }) {
  const role = st.risk?.role ?? null;
  const portfolio = role === "sugerido" ? result.optimizer?.portfolio : null;
  const sw = role === "sugerido" ? result.optimizer?.switch : null;
  const rival = sw ? result.strategies.find((x) => x.strategy_id === sw.rival) : null;
  const unvalidated = st.simple?.level === "explorar" || st.simple?.level === "no_conviene";
  return (
    <>
      {!unvalidated && <RiskLine st={st} />}
      {!unvalidated && <BreakevenLine st={st} cropLabel={cropLabel} />}
      {portfolio && (
        <div className={s.portfolio}>
          <b>Mejor aún: reparte tu chacra</b>
          <span>
            {portfolio.lots.map((l) => `${fmtNumber(l.area_ha, l.area_ha % 1 ? 1 : 0)} ha ${l.sequence.map(cropLabel).join(" → ")}`).join(" + ")}
            . Reparte el agua y el riesgo de precio: rango {soles(portfolio.stats.p10_soles)} – {soles(portfolio.stats.p90_soles)}.
          </span>
        </div>
      )}
      {sw && rival && (
        <p className={s.switchLine}>Si {cropLabel(sw.crop_id)} baja de <b>S/ {fmtNumber(sw.price_soles_kg, 2)}/kg</b> en chacra, conviene más «{rival.simple?.names}».</p>
      )}
      <MiniTimeline st={st} start={result.horizon_start} end={result.horizon_end} />
      <p className={s.sub} style={{ marginTop: 6 }}>
        Agua calculada con <NasaBadge product="power" variant="micro" /> · <Term id="margen">¿Qué es la ganancia estimada?</Term>
      </p>
    </>
  );
}

type Answer = { label: string; patch: Record<string, string | number | null> };

/**
 * Una sola pregunta de agua para toda la chacra («escalera»): los umbrales salen del mes más exigente
 * de cada opción; cada respuesta fija mínimo y máximo a la vez, así nunca queda mínimo > máximo.
 */
export function waterLadder(result: ComparisonResult, area: number): (Decisive & { answers: Answer[] }) | null {
  const qs = result.strategies.flatMap((st) => st.decisive ?? []).filter((d) => d.id === "agua" && d.critical_value != null);
  const cuts = [...new Set(qs.map((d) => Math.round(d.critical_value!)))].sort((a, b) => a - b);
  if (!cuts.length) return null;
  // Etiquetas cortas en «mil m³» (más fáciles de leer que 10,745 m³).
  const f = (v: number) => `${fmtNumber(v / 1000, 1)} mil m³`;
  const answers: Answer[] = [{ label: `Menos de ${f(cuts[0])}`, patch: { "water.allocation_min_m3": null, "water.allocation_max_m3": cuts[0] - 1 } }];
  cuts.forEach((c, i) => {
    const next = cuts[i + 1];
    answers.push(next != null
      ? { label: `${fmtNumber(c / 1000, 1)} a ${f(next)}`, patch: { "water.allocation_min_m3": c, "water.allocation_max_m3": next - 1 } }
      : { label: `${f(c)} o más`, patch: { "water.allocation_min_m3": c, "water.allocation_max_m3": null } });
  });
  const months = [...new Set(qs.map((d) => d.label.replace(/^tu agua de /, "")))];
  return {
    id: "agua",
    label: "tu agua",
    question: "¿Cuánta agua te llega al mes?",
    detail: `En la época de más riego (${listEs(months)}), para tus ${fmtNumber(area, area % 1 ? 1 : 0)} ha. Cada opción pide distinto; con tu respuesta sabemos cuáles alcanzan. Calculado con clima NASA POWER.`,
    answers,
    source_ids: qs[0].source_ids,
  };
}

const Q_ICON: Record<string, string> = { agua: "water", riego: "sprout", sal: "salt" };

/** Preguntas que sirven para todas las opciones (agua, riego, sal), sin repetir. */
export function GlobalQuestions({ result, area, onAnswer, busy }: { result: ComparisonResult; area: number; onAnswer: (patch: Record<string, string | number | null>) => void; busy: boolean }) {
  const seen = new Map<string, Decisive>();
  const ladder = waterLadder(result, area);
  if (ladder) seen.set("agua", ladder);
  for (const st of result.strategies) for (const d of st.decisive ?? []) if (d.id !== "agua" && !seen.has(d.id)) seen.set(d.id, d);
  if (!seen.size) return null;
  return (
    <section className={s.panel} aria-labelledby="afinar" id="preguntas">
      <h2 id="afinar" className={s.panelTitle}>Afina tu resultado</h2>
      <div className={s.questionsGrid}>
        {[...seen.values()].map((d) => (
          <div key={d.id} id={d.id === "agua" ? "agua" : undefined} className={s.question}>
            <p className={s.qLine}>
              <span className={s.qIcon}><Icon name={Q_ICON[d.id] ?? "question"} /></span>
              <b>{d.question}</b>
              <Tip tip={d.detail} className={s.qHelp}><Icon name="question" size={14} /></Tip>
            </p>
            <div className={s.answerRow}>
              {d.answers.map((a) => <button key={a.label} className={s.answer} disabled={busy} onClick={() => onAnswer(a.patch)}>{a.label}</button>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function countQuestions(result: ComparisonResult): number {
  const ids = new Set(result.strategies.flatMap((x) => x.decisive ?? []).map((d) => d.id));
  return ids.size;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «¿Por qué?» en tres capas: frase → lo que usamos → detalle técnico con fuentes. */
export function WhySheet({ st, profile, assumed, area, zone, onClose, onMore, result, cropLabel }: { st: Strategy | null; profile: Profile | null; assumed: string[]; area: number; zone: Zone | null; onClose: () => void; onMore: () => void; result?: ComparisonResult | null; cropLabel?: (id: string) => string }) {
  const w = profile?.water;
  const used: { text: React.ReactNode; kind: "tuyo" | "zona" | "nasa" | "demo" | "mercado"; label: string }[] = [];
  const typical = zone?.water_m3_ha_year?.value ?? null;
  const method = zone?.default_method?.value ?? "";
  const eff = Number(zone?.efficiency_by_method?.[method] ?? 0);
  if (st && profile) {
    used.push({ kind: "nasa", label: "NASA", text: <>Clima de 11 años (2015–2025) de la celda de {zone?.name ?? "tu zona"} para las fechas de siembra de esta opción. <Term id="nasa">¿Qué es?</Term></> });
    if (assumed.includes("water.allocation") && typical != null) used.push({ kind: "zona", label: "Supuesto de zona", text: <>No indicaste cuánta agua recibes: usamos el <Term id="agua_tipica">agua típica de {zone?.name}</Term> ({fmtNumber((typical / 12) * area)} m³ al mes para {fmtNumber(area, area % 1 ? 1 : 0)} ha). {zone?.water_m3_ha_year?.label}</> });
    else if (w?.allocation_min_m3 != null) used.push({ kind: "tuyo", label: "Tu respuesta", text: <>Recibes al menos {fmtNumber(w.allocation_min_m3)} m³ al mes.</> });
    else if (w?.allocation_max_m3 != null) used.push({ kind: "tuyo", label: "Tu respuesta", text: <>Recibes menos de {fmtNumber(w.allocation_max_m3 + 1)} m³ al mes.</> });
    else if (w?.allocation_m3 != null) used.push({ kind: "tuyo", label: "Tu dato", text: <>Recibes {fmtNumber(w.allocation_m3)} m³ al mes.</> });
    if (assumed.includes("water.efficiency")) used.push({ kind: "zona", label: "Supuesto de zona", text: <>Riego por {METHOD_LABEL[method] ?? method} (<Term id="eficiencia">eficiencia</Term> {fmtNumber(eff * 100)} %), porque no indicaste cómo riegas.</> });
    else if (w?.method) used.push({ kind: "tuyo", label: "Tu respuesta", text: <>Riegas por {w.method === "aspersion" ? "aspersión" : w.method}.</> });
    const signs = profile.soil?.salinity_signs;
    if (profile.soil?.ece_ds_m != null) used.push({ kind: "tuyo", label: "Tu análisis", text: <>Sal del suelo medida: CE {profile.soil.ece_ds_m} dS/m.</> });
    else if (signs) used.push({ kind: "tuyo", label: "Tu observación", text: <>{signs === "con_signos" ? "Ves signos de sal en tu chacra." : "No ves signos de sal en tu chacra."} Una observación no reemplaza un análisis.</> });
    else used.push({ kind: "zona", label: "Sin dato", text: <>No sabemos si tu suelo tiene <Term id="sal">sal</Term>.</> });
    if (st.simple?.facts.margin_soles == null) used.push({ kind: "zona", label: "Sin dato", text: <>No hay precios ni rendimientos locales verificados: la ganancia queda pendiente hasta que registres los tuyos.</> });
    if (st.simple?.facts.margin_kind === "supuesto_demo") used.push({ kind: "demo", label: "Ejemplo", text: <>Rendimientos y costos de ejemplo, no de tu chacra. Con tus números el resultado será más fiel.</> });
    if (st.simple?.facts.margin_soles != null) used.push({ kind: "mercado", label: "Mercado", text: <>Precio en chacra = precio mayorista de Arequipa (MIDAGRI-SISAP, 2–13 nov 2026) × un factor chacra supuesto. Es el precio de hoy, no el de tu cosecha. <SourceChips ids={["MIDAGRI-SISAP"]} /></> });
    const rk = st.simple?.facts.risk;
    if (rk) used.push({ kind: "nasa", label: "Riesgo", text: <>1 000 escenarios con años reales de NASA POWER, precio y rendimiento: lo más probable es ganar entre S/ {fmtNumber(rk.p10_soles)} y S/ {fmtNumber(rk.p90_soles)} (promedio S/ {fmtNumber(rk.mean_soles)}); en el peor 20 % de los casos, S/ {fmtNumber(rk.cvar20_soles)} en promedio. Probabilidad de perder: {fmtNumber(rk.p_loss * 100, 1)} %.</> });
  }
  const icon: Record<string, string> = { cumple: "✓", no_cumple: "✕", falta_dato: "?", advertencia: "!", informacion: "i" };
  return (
    <Sheet open={!!st} onClose={onClose} title={st ? `${shortNames(st, cropLabel ?? ((id) => id))}: ${st.simple?.label}` : ""} label="Por qué">
      {st && (
        <>
          <section className={s.layer}>
            <h3 className={s.layerTitle}><span>1</span>En pocas palabras</h3>
            <p style={{ margin: 0, lineHeight: 1.55, fontSize: "1.02rem" }}>{st.simple?.headline}</p>
            {result && <Highlights st={st} result={result} cropLabel={cropLabel ?? ((id) => id)} />}
            {st.timeline.filter((b) => b.kind === "cultivo").length > 0 && (
              <p className={s.sub}>
                Calendario: {st.timeline.filter((b) => b.kind === "cultivo").map((b) => `${b.label.split(" (")[0].toLowerCase()} de ${MESES[+b.start.slice(5, 7) - 1]} ${b.start.slice(0, 4)} a ${MESES[+b.end.slice(5, 7) - 1]} ${b.end.slice(0, 4)}`).join(" → ")}.
              </p>
            )}
          </section>
          <section className={s.layer}>
            <h3 className={s.layerTitle}><span>2</span>Lo que usamos</h3>
            <details className={s.tech}>
              <summary>Ver los {used.length} datos que usamos</summary>
              <ul className={s.used}>
                {used.map((u, i) => (
                  <li key={i}><span className={`${s.kind} ${s[`k_${u.kind}`]}`}>{u.label}</span><span>{u.text}</span></li>
                ))}
              </ul>
            </details>
          </section>
          <section className={s.layer}>
            <h3 className={s.layerTitle}><span>3</span>Detalle técnico y fuentes</h3>
            <details className={s.tech}>
              <summary>Ver las reglas que revisó el motor ({st.reasons.length})</summary>
              {st.reasons.map((r, i) => (
                <div key={i} className={s.reason}>
                  <b aria-hidden="true">{icon[r.state]}</b>
                  <div>{r.message} <SourceChips ids={r.source_ids} /></div>
                </div>
              ))}
            </details>
            {st.monthly_water.length > 0 && (
              <details className={s.tech}>
                <summary>Ver el agua mes a mes</summary>
                <table className={s.waterTable}>
                  <thead><tr><th>Mes</th><th>Pide el cultivo (mm)</th><th>Llevar (m³)</th></tr></thead>
                  <tbody>{st.monthly_water.map((m) => <tr key={m.label}><td>{m.label}</td><td>{fmtNumber(m.etc_mm)}</td><td>{m.gross_m3 != null ? fmtNumber(m.gross_m3) : "—"}</td></tr>)}</tbody>
                </table>
              </details>
            )}
            <button className={s.linkBtn} onClick={onMore}>Ver todo el detalle técnico</button>
          </section>
        </>
      )}
    </Sheet>
  );
}
