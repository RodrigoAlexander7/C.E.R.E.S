"use client";

import { useState } from "react";
import { fmtDate, fmtNumber } from "@/lib/api";
import { CROP_LABELS, KIND_LABELS, PRIORITY_LABELS, STATUS_LABELS, type ComparisonResult, type Metric, type Reason, type Status, type Strategy, type TimelineBlock } from "@/lib/types";
import { SourceChips } from "./Sources";

const STATUS_ICON: Record<Status, string> = { viable_con_supuestos: "✓", no_viable: "✕", requiere_datos: "?", exploratoria: "◇" };
const REASON_ICON: Record<Reason["state"], string> = { cumple: "✓", no_cumple: "✕", falta_dato: "?", advertencia: "!", informacion: "i" };
const REASON_LABEL: Record<Reason["state"], string> = { cumple: "Cumple", no_cumple: "No cumple", falta_dato: "Falta un dato", advertencia: "Advertencia", informacion: "Información" };

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status status-${status}`}>
      <span aria-hidden="true">{STATUS_ICON[status]}</span> {STATUS_LABELS[status]}
    </span>
  );
}

function days(a: string, b: string) {
  return (Date.parse(b) - Date.parse(a)) / 86400000 + 1;
}

export function Timeline({ blocks, start, end }: { blocks: TimelineBlock[]; start: string; end: string }) {
  const total = days(start, end);
  return (
    <div>
      <div className="timeline" role="img" aria-label={blocks.filter((b) => b.kind === "cultivo").map((b) => `${b.label} del ${fmtDate(b.start)} al ${fmtDate(b.end)}`).join("; ") || "Sin ciclos"}>
        {blocks.map((b, i) => {
          const w = (days(b.start, b.end) / total) * 100;
          const cls = b.kind === "cultivo" ? `tl-cultivo-${b.crop_id}` : `tl-${b.kind}`;
          const short = b.kind === "cultivo" ? (CROP_LABELS[b.crop_id ?? ""] ?? b.label).split(" ")[0] : "";
          return (
            <div key={i} className={`tl-seg ${cls}`} style={{ width: `${w}%` }} title={`${b.label}: ${fmtDate(b.start)} – ${fmtDate(b.end)}`}>
              {w > 8 ? short : ""}
            </div>
          );
        })}
      </div>
      <div className="row small muted" style={{ justifyContent: "space-between", marginTop: 2 }}>
        <span>{fmtDate(start)}</span>
        <span>{fmtDate(end)}</span>
      </div>
    </div>
  );
}

function metric(s: Strategy, key: string): Metric | undefined {
  return s.metrics[`${s.strategy_id}.${key}`];
}

function waterLine(s: Strategy): string {
  const g = metric(s, "agua.bruto_m3");
  if (g?.value != null) return `${fmtNumber(g.value)} m³ (bruto)`;
  const n = metric(s, "agua.neto_mm");
  if (n?.value != null) return `${fmtNumber(n.value)} mm neto · volumen pendiente`;
  return "Pendiente";
}

function moneyLine(s: Strategy): string {
  const m = metric(s, "eco.margen");
  if (m?.value == null) return "Pendiente";
  const lo = metric(s, "eco.margen_bajo")?.value, hi = metric(s, "eco.margen_alto")?.value;
  return `S/ ${fmtNumber(m.value)}${lo != null && hi != null ? ` (S/ ${fmtNumber(lo)} a ${fmtNumber(hi)})` : ""}`;
}

function mainReason(s: Strategy): string {
  const r = s.reasons.find((x) => x.state === "no_cumple") ?? s.reasons.find((x) => x.state === "falta_dato") ?? s.reasons.find((x) => x.state === "advertencia" && x.rule_id === "EST-01");
  return r?.message ?? s.summary;
}

export function Comparison({ result, onSelect }: { result: ComparisonResult; onSelect?: (id: string) => void }) {
  const [sel, setSel] = useState<string>(result.ordering.ranked[0] ?? result.strategies[0]?.strategy_id ?? "");
  const chosen = result.strategies.find((s) => s.strategy_id === sel);
  const pick = (id: string) => {
    setSel(id);
    onSelect?.(id);
  };

  if (result.blocking.length) {
    return (
      <div className="card stack">
        <h2>No hay comparación para esta parcela</h2>
        {result.blocking.map((b) => <div key={b} className="notice notice-warn">{b}</div>)}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Comparación de ciclos · {fmtDate(result.horizon_start)} a {fmtDate(result.horizon_end)}</h2>
          <span className="tag">Prioridad: {PRIORITY_LABELS[result.priority]}</span>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Mismo terreno, estado inicial y horizonte para las tres opciones. Orden: {result.ordering.rule}
          {result.ordering.ties.length > 0 && <> {result.ordering.ties.join(" ")}</>}
        </p>
        {result.ordering.tradeoffs.length > 0 && (
          <ul className="small" style={{ margin: 0 }}>
            {result.ordering.tradeoffs.map((t) => <li key={t.criterio}>{t.criterio}: <strong>{t.opcion ?? "sin opción comparable"}</strong></li>)}
          </ul>
        )}
        {result.notes.map((n) => <p key={n} className="small muted" style={{ margin: 0 }}>{n}</p>)}
        <div className="tl-legend" aria-hidden="true">
          <span style={{ ["--c" as string]: "#c99a1f" }}>Maíz</span>
          <span style={{ ["--c" as string]: "#6b8e23" }}>Frejol</span>
          <span style={{ ["--c" as string]: "#8e3b6e" }}>Cebolla</span>
          <span style={{ ["--c" as string]: "#b8ad94" }}>Preparación</span>
          <span style={{ ["--c" as string]: "#e5e0d3" }}>Espera / descanso</span>
        </div>
      </div>

      <div className="cards">
        {result.strategies.map((s) => (
          <article key={s.strategy_id} className={`card strategy-card st-${s.status}`} aria-labelledby={`st-${s.strategy_id}`}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 id={`st-${s.strategy_id}`} style={{ margin: 0 }}>{s.name}</h3>
              <StatusBadge status={s.status} />
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {s.sequence.map((c) => CROP_LABELS[c] ?? c).join(" → ")} (repetido en el horizonte)
              {s.rank != null && <> · <span className="rank">#{s.rank} según tu prioridad</span></>}
            </p>
            <Timeline blocks={s.timeline} start={result.horizon_start} end={result.horizon_end} />
            <dl className="kv">
              <dt>Agua</dt><dd>{waterLine(s)}</dd>
              <dt>Margen bruto</dt><dd>{moneyLine(s)}</dd>
              <dt>Suelo</dt><dd>{s.soil.indicators ? `${s.soil.indicators.families} familia(s), ${s.soil.indicators.legume_cycles} leguminosa(s)` : "—"}</dd>
            </dl>
            {s.simple && (
              <p style={{ margin: 0 }}>
                <span className="tag" style={{ fontWeight: 700 }}>En palabras simples: {s.simple.label}</span>{" "}
                {s.simple.headline}
              </p>
            )}
            <p style={{ margin: 0 }}><strong>Razón principal:</strong> {mainReason(s)}</p>
            <button className={sel === s.strategy_id ? "btn-primary" : "btn-secondary"} onClick={() => pick(s.strategy_id)} aria-pressed={sel === s.strategy_id}>
              {sel === s.strategy_id ? "Viendo el detalle" : "Ver ciclo, razones y fuentes"}
            </button>
          </article>
        ))}
      </div>

      {chosen && <StrategyDetail s={chosen} />}

      {result.associations.map((a) => (
        <section key={a.id} className="card stack" aria-labelledby={`as-${a.id}`}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 id={`as-${a.id}`} style={{ margin: 0 }}>Policultivo: {a.name}</h3>
            <StatusBadge status="exploratoria" />
          </div>
          <p style={{ margin: 0 }}>Estructura ilustrativa: <code>{a.structure}</code>. {a.warning}</p>
          <div className="grid-2">
            <div><strong>Lo que se sabe</strong><ul>{a.known.map((k) => <li key={k}>{k}</li>)}</ul></div>
            <div><strong>Lo que falta</strong><ul>{a.missing.map((k) => <li key={k}>{k}</li>)}</ul></div>
          </div>
          <div>Fuentes: <SourceChips ids={a.source_ids} /></div>
        </section>
      ))}
    </div>
  );
}

function StrategyDetail({ s }: { s: Strategy }) {
  const metrics = Object.values(s.metrics);
  return (
    <section className="card stack" aria-labelledby="detail-title">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 id="detail-title" style={{ margin: 0 }}>{s.name}: ciclo y justificación</h2>
        <StatusBadge status={s.status} />
      </div>

      <details open>
        <summary>Ciclo propuesto paso a paso</summary>
        <ol>
          {s.timeline.map((b, i) => (
            <li key={i} style={{ marginBottom: "0.5rem" }}>
              <strong>{b.label}</strong> — {fmtDate(b.start)} a {fmtDate(b.end)}
              {b.kind === "cultivo" && (
                <>
                  <div className="small muted">Siembra {fmtDate(b.start)} · cosecha {fmtDate(b.end)} · etapas: {b.stages.map((st) => `${st.name} (${fmtDate(st.start)})`).join(", ")}</div>
                  <ul className="small">{b.why.map((w) => <li key={w}>{w}</li>)}</ul>
                </>
              )}
            </li>
          ))}
        </ol>
        <p className="hint">Fechas orientativas para planificar, no un pronóstico ni una garantía de cosecha.</p>
      </details>

      <details>
        <summary>¿Por qué este estado? Reglas, datos faltantes y fuentes</summary>
        <div>
          {s.reasons.map((r, i) => (
            <div key={i} className={`reason r-${r.state}`}>
              <span className="reason-icon" aria-hidden="true">{REASON_ICON[r.state]}</span>
              <div>
                <span className="sr-only">{REASON_LABEL[r.state]}: </span>
                {r.message} <span className="small muted">[{r.rule_id}]</span>
                {r.assumptions.length > 0 && <div className="small muted">Supuesto: {r.assumptions.join(" ")}</div>}
                {r.missing.length > 0 && <div className="small">Falta: <strong>{r.missing.join(", ")}</strong></div>}
                <div><SourceChips ids={r.source_ids} /></div>
              </div>
            </div>
          ))}
        </div>
        {s.missing.length > 0 && <div className="notice notice-warn">Datos que cambiarían el resultado: {s.missing.join("; ")}.</div>}
        {s.decisive && s.decisive.length > 0 && (
          <div className="notice notice-info">
            <strong>Preguntas que cambiarían el nivel de esta opción</strong> (respóndelas en el modo sencillo o actualiza el perfil):
            <ul style={{ margin: "0.3rem 0 0" }}>{s.decisive.map((d) => <li key={d.id}>{d.question} <span className="small muted">{d.detail}</span></li>)}</ul>
          </div>
        )}
        {s.assumptions.length > 0 && (
          <div className="small"><strong>Supuestos visibles:</strong><ul>{s.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></div>
        )}
      </details>

      <details>
        <summary>Agua mes a mes (clima histórico NASA)</summary>
        {s.monthly_water.length === 0 ? (
          <p>Pendiente: sin serie NASA o sin ciclos.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Mes</th><th className="num">ETc (mm)</th><th className="num">Lluvia efectiva (mm)</th><th className="num">Riego neto (mm)</th><th className="num">Riego bruto (m³)</th></tr>
              </thead>
              <tbody>
                {s.monthly_water.map((m) => (
                  <tr key={m.label}><td>{m.label}</td><td className="num">{fmtNumber(m.etc_mm)}</td><td className="num">{fmtNumber(m.pe_mm)}</td><td className="num">{fmtNumber(m.net_mm)}</td><td className="num">{m.gross_m3 != null ? fmtNumber(m.gross_m3) : "pendiente"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">
          ETc = demanda del cultivo (Kc × ET0). ET0 = demanda atmosférica calculada con FAO-56 a partir de NASA POWER. Riego neto = ETc − lluvia efectiva. Riego bruto = neto ÷ eficiencia. La lluvia NASA no es el agua del canal; el balance omite reserva del suelo, ascenso capilar y lavado de sales.
        </p>
      </details>

      <details>
        <summary>Suelo, fertilidad y abonos</summary>
        <div className="stack">
          {s.soil.analysis && (
            <p>
              Análisis registrado: CE {s.soil.analysis.ece_ds_m ?? "desconocida"} dS/m · pH {s.soil.analysis.ph ?? "desconocido"} · MO {s.soil.analysis.organic_matter_pct ?? "desconocida"} % · fecha {s.soil.analysis.date ?? "—"} · profundidad {s.soil.analysis.depth_cm ?? "—"} · {KIND_LABELS[String(s.soil.analysis.kind)] ?? s.soil.analysis.kind}
            </p>
          )}
          <p><strong>Necesidades de fertilización:</strong> {s.soil.needs}</p>
          <p><strong>Aportes y manejo:</strong> {s.soil.contributions?.residues}. {s.soil.contributions?.legume_note}</p>
          <ul>{s.soil.per_crop?.map((c, i) => <li key={i}><strong>{c.crop}:</strong> {c.residue} {c.nutrition}</li>)}</ul>
          <p className="small muted">{s.soil.advice} <SourceChips ids={s.soil.source_ids ?? []} /></p>
        </div>
      </details>

      <details>
        <summary>Todas las métricas y su procedencia</summary>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Métrica</th><th className="num">Valor</th><th>Tipo</th><th>Método</th><th>Fuentes</th></tr></thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id}>
                  <td>{m.label}{m.detail && <div className="small muted">{m.detail}</div>}</td>
                  <td className="num">{m.value != null ? fmtNumber(m.value, m.unit === "dS/m" ? 1 : 0) : "—"} {m.unit}</td>
                  <td><span className={`tag tag-${m.kind}`}>{KIND_LABELS[m.kind] ?? m.kind}</span></td>
                  <td className="small">{m.method}</td>
                  <td><SourceChips ids={m.source_ids} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
