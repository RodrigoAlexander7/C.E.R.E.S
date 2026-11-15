"use client";

import { useEffect, useState } from "react";
import { SourceChips } from "@/components/Sources";
import { api, fmtNumber } from "@/lib/api";
import { NASA } from "@/lib/nasa";
import { KIND_LABELS, type SourceRec } from "@/lib/types";
import { useZones, type Zone } from "@/lib/zones";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface Clim { month: number; et0_mm: number | null; rain_mm: number | null; t_min_c: number | null; t_max_c: number | null; years: number }

interface Ctx { zone_name: string; nasa: Nasa | null; monthly_climatology: Clim[]; climatology_note: string; pilot_note: string; nasa_error: string | null }
interface Nasa { source_id: string; request_url: string; period: { start: string; end: string }; fetched_at: string; sha256: string; spatial_scale: string; cell_elevation_m: number; query_latitude: number; query_longitude: number; days: number; time_standard: string }

export default function Fuentes() {
  const [items, setItems] = useState<SourceRec[]>([]);
  const { zones } = useZones();
  useEffect(() => {
    api<{ items: SourceRec[] }>("/sources").then((r) => setItems(r.items)).catch(() => {});
  }, []);

  return (
    <div className="stack">
      <h1>Fuentes y procedencia</h1>
      <section className="card stack" aria-labelledby="nasa-t">
        <h2 id="nasa-t">Datos de la NASA que usa CERES</h2>
        <p className="muted" style={{ margin: 0 }}>Datos abiertos de la NASA, con producto, período y resolución. CERES no está respaldado por la NASA. El Niño (NOAA) y los precios (MIDAGRI-SISAP) no son datos NASA.</p>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Producto</th><th>Período y resolución</th><th>Qué hace CERES con él</th></tr></thead>
            <tbody>
              {Object.values(NASA).map((p) => (
                <tr key={p.id} id={`nasa-${p.id}`} style={{ scrollMarginTop: 80 }}>
                  <td><a href={p.url} target="_blank" rel="noreferrer"><b>{p.name}</b></a><div><SourceChips ids={[p.sourceId]} /></div></td>
                  <td className="small">{p.detail}</td>
                  <td className="small">{p.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {zones.map((z) => <ZoneNasa key={z.id} zone={z} />)}
      <section className="card stack" aria-labelledby="src-t">
        <h2 id="src-t">Registro de fuentes</h2>
        <p className="muted">Cada cifra de la aplicación apunta a una de estas fuentes. Los supuestos de demostración y de zona están marcados y deben reemplazarse con datos locales.</p>
        <div className="table-scroll">
          <table>
            <thead><tr><th>ID</th><th>Fuente</th><th>Tipo</th><th>Estado</th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td><SourceChips ids={[s.id]} /></td>
                  <td>{s.title}<div className="small muted">{s.institution}{s.scope ? ` · ${s.scope}` : ""}</div></td>
                  <td><span className={`tag tag-${s.kind}`}>{KIND_LABELS[s.kind] ?? s.kind}</span></td>
                  <td className="small">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ZoneNasa({ zone }: { zone: Zone }) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  useEffect(() => {
    api<Ctx>(`/public/context?zone=${zone.id}`).then(setCtx).catch(() => setCtx(null));
  }, [zone.id]);
  const nasa = ctx?.nasa;
  return (
    <section className="card stack" aria-labelledby={`nasa-${zone.id}`}>
      <h2 id={`nasa-${zone.id}`}>Clima NASA POWER — {zone.name}</h2>
      {ctx?.pilot_note && <p className="small muted" style={{ margin: 0 }}>{ctx.pilot_note}</p>}
      {ctx?.nasa_error && <div className="notice notice-bad">NASA no disponible: {ctx.nasa_error}</div>}
      {nasa && (
          <>
            <dl className="kv">
              <dt>Consulta</dt><dd>Punto {nasa.query_latitude}, {nasa.query_longitude} · {nasa.days} días · {nasa.period.start} a {nasa.period.end} · hora {nasa.time_standard}</dd>
              <dt>Escala</dt><dd>{nasa.spatial_scale} Elevación de la celda: {fmtNumber(nasa.cell_elevation_m)} m; el campo está cerca de {fmtNumber(zone.elevation_m?.value ?? null)} m.{zone.elevation_m?.note ? ` ${zone.elevation_m.note}` : ""}</dd>
              <dt>Obtenido</dt><dd>{nasa.fetched_at} · SHA-256 <code>{nasa.sha256.slice(0, 16)}…</code></dd>
              <dt>Tipo</dt><dd><span className="tag tag-observado">Observado (reanálisis)</span> <SourceChips ids={[nasa.source_id, "FAO56-PM"]} /></dd>
            </dl>
            <div className="table-scroll">
              <table>
                <caption className="small muted" style={{ textAlign: "left", marginBottom: 4 }}>{ctx?.climatology_note}</caption>
                <thead><tr><th>Mes</th><th className="num">ET0 (mm)</th><th className="num">Lluvia (mm)</th><th className="num">T mín (°C)</th><th className="num">T máx (°C)</th><th className="num">Años</th></tr></thead>
                <tbody>
                  {ctx?.monthly_climatology.map((m) => (
                    <tr key={m.month}><td>{MESES[m.month - 1]}</td><td className="num">{fmtNumber(m.et0_mm, 1)}</td><td className="num">{fmtNumber(m.rain_mm, 1)}</td><td className="num">{fmtNumber(m.t_min_c, 1)}</td><td className="num">{fmtNumber(m.t_max_c, 1)}</td><td className="num">{m.years}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
    </section>
  );
}
