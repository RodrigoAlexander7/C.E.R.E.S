"use client";
import { useEffect, useState } from "react";
import { api, ApiError, fmtNumber } from "@/lib/api";
import s from "./simple.module.css";
interface Series { needs_polygon: boolean; items: { scene_id: string; observed_on: string; ndvi: number | null; cloud_pct: number | null; valid_pct: number | null; source_url: string }[]; monthly: { month: string; ndvi: number; scenes: number }[]; job: { status: string; detail: string | null } | null }
export function Ndvi({ parcelId, zone = "majes" }: { parcelId?: string; zone?: string }) {
  const [data, setData] = useState<Series | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const path = parcelId ? `/parcels/${parcelId}/ndvi` : `/public/ndvi?zone=${zone}`;
  useEffect(() => {
    let live = true;
    const load = () => api<Series>(path).then(d => live && setData(d)).catch(() => live && setErr("No se pudo cargar HLS"));
    load(); const timer = setInterval(load, 15000);
    return () => { live = false; clearInterval(timer); };
  }, [path]);
  const refresh = async () => {
    setBusy(true); setErr("");
    try { await api(`/parcels/${parcelId}/ndvi/refresh`, { method: "POST" }); setData(d => d && ({ ...d, job: { status: "pendiente", detail: "Procesando escenas; puedes seguir usando CERES." } })); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "No se pudo actualizar"); }
    finally { setBusy(false); }
  };
  return <section className={s.panel} aria-labelledby="ndvi-title">
    <h2 id="ndvi-title" className={s.display}>Verdor desde el satélite</h2>
    <p>HLS de NASA, 30 m. El NDVI muestra vegetación; no diagnostica nutrientes ni las causas de un cambio.</p>
    {!parcelId && <p className={s.sub}>Ejemplo público de {zone}. Guarda y dibuja tu parcela para consultar la tuya.</p>}
    {err && <p role="alert">{err}</p>}
    {data?.needs_polygon && <p>Dibuja el contorno de tu parcela para consultar su NDVI.</p>}
    {data?.monthly.length ? <div role="img" aria-label="Serie mensual NDVI" style={{ display: "flex", alignItems: "end", gap: 8, minHeight: 150, overflowX: "auto" }}>{data.monthly.map(m => <div key={m.month} style={{ minWidth: 52, textAlign: "center" }}><b>{fmtNumber(m.ndvi, 2)}</b><div style={{ background: "#397746", height: Math.max(2, (m.ndvi + 1) * 55), borderRadius: 6 }} /><small>{m.month}</small></div>)}</div> : <p>{data ? "Sin observaciones válidas todavía. Los huecos no son un NDVI de cero." : "Cargando escenas…"}</p>}
    {data?.job && <p role="status">{data.job.status}: {data.job.detail}</p>}
    {parcelId && !data?.needs_polygon && <button className={`${s.btn} ${s.btnGhost}`} onClick={refresh} disabled={busy || ["pendiente", "procesando"].includes(data?.job?.status ?? "")}>Actualizar desde HLS</button>}
    {!!data?.items.length && <details className={s.more}><summary>Ver escenas y calidad</summary><div className={s.moreBody} style={{ overflowX: "auto" }}><table><thead><tr><th>Fecha</th><th>NDVI</th><th>Nubes de escena</th><th>Píxeles válidos</th></tr></thead><tbody>{data.items.map(i => <tr key={i.scene_id}><td><a href={i.source_url} target="_blank" rel="noreferrer">{i.observed_on}</a></td><td>{fmtNumber(i.ndvi, 2)}</td><td>{fmtNumber(i.cloud_pct, 1)} %</td><td>{fmtNumber(i.valid_pct, 1)} %</td></tr>)}</tbody></table><p className={s.sub}>Mediana mensual de hasta dos escenas por mes. Nubes, sombra, nieve, agua y aerosol alto enmascarados. Parcelas pequeñas pueden no contener centros de píxel.</p></div></details>}
  </section>;
}
