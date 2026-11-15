"use client";

// «¿Cuándo me conviene sembrar?» (R19): cifras del MISMO motor de la comparación (GET /public/sowing-window),
// por mes de siembra y por hectárea, con 11 años de NASA POWER y la comparación de años El Niño / La Niña / neutros
// según el ONI de NOAA. El cliente no recalcula nada: solo muestra.

import { useEffect, useMemo, useState } from "react";
import { NasaBadge } from "@/components/NasaBadge";
import { SourceChips } from "@/components/Sources";
import { ApiError, api, fmtNumber } from "@/lib/api";
import s from "./sowing.module.css";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

interface Thermal { rule_id: string; label: string; comparator: string; threshold_c: number; years_with_events: number; years_evaluated: number; mean_days_per_year: number; state: string; status: string; source_ids: string[] }
interface Month { month: number; available: boolean; plant?: string; harvest?: string; in_window?: boolean; etc_mm?: number; etc_mm_range?: [number, number] | null; net_mm?: number; gross_m3_ha?: number; peak_month?: string; peak_gross_m3_ha?: number; thermal?: Thermal[] }
interface Group { phase: string; label: string; n: number; years: number[]; etc_mm?: number | null; rain_mm?: number | null; t_max_mean_c?: number | null; t_min_mean_c?: number | null }
export interface SowingData {
  zone_id: string;
  zone_name: string;
  crop: { id: string; name: string; short: string; cycle_days: number; windows: string[]; window_status: string; window_source_ids: string[] };
  efficiency: { method: string; label: string; value: number; kind: string; source_ids: string[] };
  months: Month[];
  enso: { available: boolean; summary: { month: number; groups: Group[] }[]; source_ids: string[]; definition: string; limitation: string; oni: { fetched_at: string; sha256: string } | null };
  method: Record<string, string>;
  source_ids: string[];
  note: string;
}

export function SowingWindow({ zone, crops, initialCrop, initialMonth, wide = false }: { zone: string; crops: { id: string; name: string }[]; initialCrop?: string; initialMonth?: number; wide?: boolean }) {
  const [crop, setCrop] = useState(initialCrop && crops.some((c) => c.id === initialCrop) ? initialCrop : crops[0]?.id);
  const [month, setMonth] = useState(initialMonth ?? new Date().getMonth() + 1);
  const [data, setData] = useState<SowingData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!crops.some((c) => c.id === crop)) setCrop(crops[0]?.id);
  }, [crops, crop]);

  useEffect(() => {
    if (!crop) return;
    let live = true;
    setErr(null);
    api<SowingData>(`/public/sowing-window?zone=${encodeURIComponent(zone)}&crop=${encodeURIComponent(crop)}`)
      .then((d) => live && setData(d))
      .catch((e) => live && setErr(e instanceof ApiError ? e.message : "No se pudo calcular"));
    return () => {
      live = false;
    };
  }, [zone, crop]);

  const view = useMemo(() => {
    if (!data || data.crop.id !== crop || data.zone_id !== zone) return null;
    const rows = data.months.filter((m) => m.available);
    if (!rows.length) return null;
    const max = Math.max(...rows.map((m) => m.gross_m3_ha ?? 0));
    const sorted = [...rows].sort((a, b) => (a.gross_m3_ha ?? 0) - (b.gross_m3_ha ?? 0));
    // «Mejor mes»: dentro de la ventana del catálogo, sin frío/calor en ≥ 3 de 10 años y con menos riego.
    const safe = sorted.filter((m) => m.in_window && !(m.thermal ?? []).some((t) => t.state === "advertencia"));
    return { rows, max, best: sorted[0], worst: sorted[sorted.length - 1], recommended: safe[0] ?? null };
  }, [data, crop, zone]);

  if (err) return <div className={s.card}><p role="alert">{err}</p></div>;
  if (!crops.length) return null;

  const cur = data?.months.find((m) => m.month === month && m.available);
  const enso = data?.enso.summary.find((x) => x.month === month);
  const W = 600, H = 210, bw = W / 12;
  const risky = (m: Month) => (m.thermal ?? []).some((t) => t.state === "advertencia");

  return (
    <div className={`${s.card} ${wide ? s.wide : ""}`}>
      {view?.recommended && data && (
        <div className={s.banner}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4 9 2 2 4-4" /></svg>
          <div>
            <small>{data.crop.short.toUpperCase()}</small>
            <b>Mejor mes para sembrar {data.crop.short}: {MESES_LARGO[view.recommended.month - 1]}</b>
            <span>Menos riego dentro de la ventana de siembra ({fmtNumber(view.recommended.gross_m3_ha)} m³/ha) y sin frío ni calor frecuentes en 11 años NASA POWER.</span>
          </div>
          {month !== view.recommended.month && <button className={s.bannerBtn} onClick={() => setMonth(view.recommended!.month)}>Ver {MESES_LARGO[view.recommended.month - 1]}</button>}
        </div>
      )}
      <div className={s.tabs} role="group" aria-label="Cultivo">
        {crops.map((c) => (
          <button key={c.id} className={s.tab} aria-pressed={crop === c.id} onClick={() => setCrop(c.id)}>{c.name}</button>
        ))}
      </div>
      <p className={s.q}>¿En qué mes siembras?</p>
      <div className={s.months} role="group" aria-label="Mes de siembra">
        {MESES.map((m, i) => (
          <button key={m} className={s.month} aria-pressed={month === i + 1} onClick={() => setMonth(i + 1)}>{m}</button>
        ))}
      </div>

      {!view || !data ? (
        <div className={s.skeleton} aria-label="Calculando con datos NASA" role="status" />
      ) : (
        <div className={s.split}>
          <div>
          <svg className={s.svg} viewBox={`0 0 ${W} ${H + 40}`} role="img" aria-label={`Agua de riego por hectárea según el mes de siembra de ${data.crop.short}; el mes elegido es ${MESES_LARGO[month - 1]}`}>
            {data.months.map((m, i) => {
              if (!m.available) return null;
              const h = ((m.gross_m3_ha ?? 0) / view.max) * (H - 34);
              const sel = m.month === month;
              return (
                <g key={i} onClick={() => setMonth(m.month)} style={{ cursor: "pointer" }}>
                  <rect x={i * bw + 6} y={H - h} width={bw - 12} height={h} rx="7" fill={sel ? "#1f4d2b" : m.in_window ? "#5b9a45" : "#cfdcc3"} />
                  <title>{`Siembra en ${MESES_LARGO[i]}: ${fmtNumber(m.gross_m3_ha)} m³/ha de riego${m.in_window ? " (dentro de la ventana del catálogo)" : ""}${risky(m) ? "; riesgo térmico en 3 o más de cada 10 años" : ""}`}</title>
                  <text x={i * bw + bw / 2} y={H - h - 8} textAnchor="middle" fontSize="15" fill={sel ? "#13221a" : "#66705f"} fontWeight="700">{fmtNumber((m.gross_m3_ha ?? 0) / 1000, 1)}</text>
                  {risky(m) && <text x={i * bw + bw / 2} y={H - h - 28} textAnchor="middle" fontSize="16" fill="#9b2f1f" fontWeight="800">!</text>}
                  <text x={i * bw + bw / 2} y={H + 24} textAnchor="middle" fontSize="16" fill={sel ? "#13221a" : "#66705f"} fontWeight={sel ? 800 : 500}>{MESES[i]}</text>
                </g>
              );
            })}
          </svg>
          <div className={s.legend}>
            <span><i style={{ background: "#5b9a45" }} />Ventana del catálogo{data.crop.window_status === "supuesto_demo" ? " (ejemplo)" : ""}</span>
            <span><i style={{ background: "#cfdcc3" }} />Fuera de ventana</span>
            <span><b style={{ color: "#9b2f1f" }}>!</b> Frío o calor en ≥ 3 de cada 10 años</span>
            <span>Miles de m³ por ha</span>
          </div>
          </div>

          <div>
          {cur && (
            <>
              <div className={s.boxes}>
                <div className={s.box}><strong>{fmtNumber(cur.gross_m3_ha)} m³</strong><span>de riego por hectárea en todo el ciclo ({data.efficiency.label}{data.efficiency.kind === "supuesto_zona" ? ", supuesto" : ""})</span></div>
                <div className={s.box}><strong>{fmtNumber(cur.etc_mm)} mm</strong><span>pide el cultivo{cur.etc_mm_range ? `; entre ${fmtNumber(cur.etc_mm_range[0])} y ${fmtNumber(cur.etc_mm_range[1])} según el año` : ""}</span></div>
                <div className={s.box}><strong>{cur.peak_month}</strong><span>mes más exigente: {fmtNumber(cur.peak_gross_m3_ha)} m³/ha</span></div>
              </div>
              <ul className={s.thermal}>
                {(cur.thermal ?? []).map((t) => (
                  <li key={t.rule_id} data-warn={t.state === "advertencia"}>
                    <b>{t.label}:</b> {t.years_with_events} de {t.years_evaluated} años con días de media {t.comparator === "<" ? "bajo" : "sobre"} {t.threshold_c} °C en esas etapas{t.years_with_events ? ` (≈ ${fmtNumber(t.mean_days_per_year, 1)} días/año)` : ""}.
                    {t.status !== "referencia_bibliografica" && <small> Umbral por verificar.</small>}
                  </li>
                ))}
              </ul>
              <p className={s.insight}>
                Sembrando {data.crop.short} en <b>{MESES_LARGO[view.best.month - 1]}</b> el riego baja a {fmtNumber(view.best.gross_m3_ha)} m³/ha, frente a {fmtNumber(view.worst.gross_m3_ha)} m³/ha en {MESES_LARGO[view.worst.month - 1]}
                {view.best.in_window ? "" : " (fuera de la ventana del catálogo: revisa otros riesgos)"}.
              </p>
            </>
          )}

          {data.enso.available && enso && (
            <details className={s.enso}>
              <summary>¿Y en años El Niño? Campañas sembradas en {MESES_LARGO[month - 1]}, 2015–2025</summary>
              <div className={s.tableWrap}>
                <table>
                  <thead><tr><th>Fase (NOAA)</th><th>Campañas</th><th>Pide el cultivo</th><th>Lluvia</th><th>Máx / mín</th></tr></thead>
                  <tbody>
                    {enso.groups.map((g) => (
                      <tr key={g.phase}>
                        <th scope="row">{g.label}</th>
                        <td>{g.n ? `${g.n} (${g.years.join(", ")})` : "Ninguna"}</td>
                        <td>{g.n ? `${fmtNumber(g.etc_mm)} mm` : "—"}</td>
                        <td>{g.n ? `${fmtNumber(g.rain_mm)} mm` : "—"}</td>
                        <td>{g.n ? `${fmtNumber(g.t_max_mean_c, 1)} / ${fmtNumber(g.t_min_mean_c, 1)} °C` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={s.fine}>{data.enso.definition} {data.enso.limitation} <SourceChips ids={data.enso.source_ids} /></p>
            </details>
          )}
          <details className={s.enso} open={wide || undefined}>
            <summary>¿De dónde sacamos este dato?</summary>
            <NasaBadge product="power" variant="block" />
            <p className={s.fine}>
              {data.method.etc}. {data.method.net}. {data.method.gross}. {data.method.sowing_day}. {data.note} <SourceChips ids={[...data.source_ids, ...data.crop.window_source_ids, ...data.efficiency.source_ids]} />
            </p>
          </details>
          </div>
        </div>
      )}
    </div>
  );
}
