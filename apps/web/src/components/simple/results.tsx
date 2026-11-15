"use client";

import { SourceChips } from "@/components/Sources";
import { fmtDate, fmtNumber } from "@/lib/api";
import type { ComparisonResult, Decisive, Profile, Strategy } from "@/lib/types";
import { METHOD_LABEL, type Zone } from "@/lib/zones";
import { Sheet, Term } from "./help";
import s from "./simple.module.css";

const ICON: Record<string, string> = { buena: "✓", posible: "?", explorar: "◇", no_conviene: "✕" };
const CROP_COLOR: Record<string, string> = { maiz_grano: "#d9a53a", frejol_grano: "#5b9a45", cebolla_roja: "#a2456f", cebolla: "#a2456f", papa: "#8a6a3f" };

export function LevelBadge({ st }: { st: Strategy }) {
  const lvl = st.simple?.level ?? "posible";
  return (
    <span className={s.badge}>
      <b aria-hidden="true">{ICON[lvl]}</b>
      {st.simple?.label}
    </span>
  );
}

function MiniTimeline({ st, start, end }: { st: Strategy; start: string; end: string }) {
  const total = Date.parse(end) - Date.parse(start) || 1;
  return (
    <>
      <div className={s.bar} role="img" aria-label={st.timeline.filter((b) => b.kind === "cultivo").map((b) => `${b.label} de ${fmtDate(b.start)} a ${fmtDate(b.end)}`).join("; ")}>
        {st.timeline.map((b, i) => (
          <i key={i} style={{ width: `${((Date.parse(b.end) - Date.parse(b.start)) / total) * 100}%`, background: b.kind === "cultivo" ? CROP_COLOR[b.crop_id ?? ""] ?? "#888" : "#e7dcc4" }} />
        ))}
      </div>
      <div className={s.barLegend}><span>{fmtDate(start)}</span><span>24 meses</span><span>{fmtDate(end)}</span></div>
    </>
  );
}

export function OptionCard({
  st, result, onWhy, onAnswer, busy,
}: { st: Strategy; result: ComparisonResult; onWhy: () => void; onAnswer: (patch: Record<string, string | number>) => void; busy: boolean }) {
  const f = st.simple?.facts;
  const water = st.decisive?.find((d) => d.id === "agua");
  return (
    <article className={`${s.card} ${s[`lvl_${st.simple?.level ?? "posible"}`]}`} aria-labelledby={`opt-${st.strategy_id}`}>
      <div className={s.cardTop}>
        <h2 id={`opt-${st.strategy_id}`} className={`${s.names} ${s.display}`}>{st.simple?.names}</h2>
        <LevelBadge st={st} />
      </div>
      <p className={s.headline}>{st.simple?.headline}</p>
      <div className={s.facts}>
        <div className={s.fact}>
          <strong>{f?.margin_soles != null ? `S/ ${fmtNumber(f.margin_soles)}` : "—"}</strong>
          <span><Term id="margen">Ganancia estimada</Term>{f?.margin_kind === "supuesto_demo" ? " (precios de ejemplo)" : ""}</span>
        </div>
        <div className={s.fact}>
          <strong>{f?.water_m3 != null ? `${fmtNumber(f.water_m3)} m³` : "—"}</strong>
          <span><Term id="agua_bruta">Agua</Term> en 24 meses</span>
        </div>
        <div className={s.fact}>
          <strong>{f?.first_sowing ? fmtDate(f.first_sowing).replace(/ \d{4}$/, "") : "—"}</strong>
          <span>Primera siembra{f?.first_sowing ? ` ${f.first_sowing.slice(0, 4)}` : ""}</span>
        </div>
      </div>
      <MiniTimeline st={st} start={result.horizon_start} end={result.horizon_end} />
      {st.simple && st.simple.tags.length > 0 && (
        <div className={s.tags}>{st.simple.tags.map((t) => <span key={t} className={t === "Tu plan" ? `${s.tag} ${s.tagMuted}` : s.tag}>{t}</span>)}</div>
      )}
      {water && (
        <div className={s.cardQ}>
          <p>{water.question}</p>
          <small>{water.detail}</small>
          <div className={s.answerRow}>
            {water.answers.map((a) => (
              <button key={a.label} className={s.answer} disabled={busy} onClick={() => onAnswer(a.patch)}>{a.label}</button>
            ))}
          </div>
        </div>
      )}
      <div className={s.cardActions}>
        <button className={`${s.btn} ${s.btnGhost}`} onClick={onWhy}>¿Por qué?</button>
      </div>
    </article>
  );
}

/** Preguntas que sirven para todas las opciones (riego, sal), sin repetir. */
export function GlobalQuestions({ result, onAnswer, busy }: { result: ComparisonResult; onAnswer: (patch: Record<string, string | number>) => void; busy: boolean }) {
  const seen = new Map<string, Decisive>();
  for (const st of result.strategies) for (const d of st.decisive ?? []) if (d.id !== "agua" && !seen.has(d.id)) seen.set(d.id, d);
  if (!seen.size) return null;
  return (
    <section className={s.panel} aria-labelledby="afinar">
      <h2 id="afinar" className={s.panelTitle}>Afina tu resultado</h2>
      <p className={s.panelText}>{seen.size === 1 ? "Una pregunta rápida" : `${seen.size} preguntas rápidas`} que pueden cambiar las opciones. Sin estudios ni análisis.</p>
      {[...seen.values()].map((d) => (
        <div key={d.id} style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>{d.question}</p>
          <p className={s.sub} style={{ margin: "0 0 8px" }}>{d.detail} {d.id === "sal" && <Term id="sal">¿Qué es la CE?</Term>}{d.id === "riego" && <Term id="eficiencia">¿Por qué importa?</Term>}</p>
          <div className={s.answerRow}>
            {d.answers.map((a) => <button key={a.label} className={s.answer} disabled={busy} onClick={() => onAnswer(a.patch)}>{a.label}</button>)}
          </div>
        </div>
      ))}
    </section>
  );
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «¿Por qué?» en tres capas: frase → lo que usamos → detalle técnico con fuentes. */
export function WhySheet({ st, profile, assumed, area, zone, onClose, onMore }: { st: Strategy | null; profile: Profile | null; assumed: string[]; area: number; zone: Zone | null; onClose: () => void; onMore: () => void }) {
  const w = profile?.water;
  const used: { text: React.ReactNode; kind: "tuyo" | "zona" | "nasa" | "demo"; label: string }[] = [];
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
    if (st.simple?.facts.margin_kind === "supuesto_demo") used.push({ kind: "demo", label: "Ejemplo", text: <>Precios, rendimientos y costos de ejemplo, no de tu chacra. Con tus números el resultado será más fiel.</> });
  }
  const icon: Record<string, string> = { cumple: "✓", no_cumple: "✕", falta_dato: "?", advertencia: "!", informacion: "i" };
  return (
    <Sheet open={!!st} onClose={onClose} title={st ? `¿Por qué «${st.simple?.label}»?` : ""} label="Por qué">
      {st && (
        <>
          <section className={s.layer}>
            <h3 className={s.layerTitle}><span>1</span>En pocas palabras</h3>
            <p style={{ margin: 0, lineHeight: 1.55, fontSize: "1.02rem" }}><b style={{ textTransform: "capitalize" }}>{st.simple?.names}.</b> {st.simple?.headline}</p>
            {st.timeline.filter((b) => b.kind === "cultivo").length > 0 && (
              <p className={s.sub}>
                Calendario: {st.timeline.filter((b) => b.kind === "cultivo").map((b) => `${b.label.split(" (")[0].toLowerCase()} de ${MESES[+b.start.slice(5, 7) - 1]} ${b.start.slice(0, 4)} a ${MESES[+b.end.slice(5, 7) - 1]} ${b.end.slice(0, 4)}`).join(" → ")}.
              </p>
            )}
          </section>
          <section className={s.layer}>
            <h3 className={s.layerTitle}><span>2</span>Lo que usamos</h3>
            <ul className={s.used}>
              {used.map((u, i) => (
                <li key={i}><span className={`${s.kind} ${s[`k_${u.kind}`]}`}>{u.label}</span><span>{u.text}</span></li>
              ))}
            </ul>
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
