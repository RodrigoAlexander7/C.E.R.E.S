"use client";
import { useEffect, useState } from "react";
import { Icon, Tip } from "./icons";
import { api, ApiError, fmtNumber } from "@/lib/api";
import s from "./simple.module.css";
interface Series { needs_polygon: boolean; items: { scene_id: string; observed_on: string; ndvi: number | null; cloud_pct: number | null; valid_pct: number | null; source_url: string }[]; monthly: { month: string; ndvi: number; scenes: number }[]; job: { status: string; detail: string | null } | null }

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const monthLabel = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
/** Escala fija 0–1: la altura de la barra es el NDVI, para que 0,07 se vea como lo que es (suelo casi sin verde). */
const H = 140;

function reading(v: number): string {
  if (v < 0.2) return "suelo sin cultivo o muy poco verde";
  if (v < 0.3) return "poco verde";
  return "cultivo verde";
}

export function Ndvi({ parcelId, zone = "majes", zoneName }: { parcelId?: string; zone?: string; zoneName?: string }) {
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
  const months = data?.monthly ?? [];
  const period = months.length ? (months.length > 1 ? `${monthLabel(months[0].month)} – ${monthLabel(months[months.length - 1].month)}` : monthLabel(months[0].month)) : null;
  const last = months[months.length - 1];
  return <section className={s.panel} aria-labelledby="ndvi-title">
    <p className={s.qLine} style={{ marginBottom: 4 }}>
      <span className={s.qIcon}><Icon name="sprout" /></span>
      <b id="ndvi-title" className={s.display} style={{ fontSize: "1.15rem" }}>¿Qué tan verde está?</b>
      <Tip className={s.qHelp} tip={`Índice de verdor (NDVI) de NASA HLS, 30 m${period ? `, ${period}` : ""}. Muestra cuánta planta verde hay; no mide nutrientes ni explica la causa de un cambio.`}><Icon name="question" size={14} /></Tip>
    </p>
    {!parcelId && <p className={s.sub} style={{ marginTop: 0 }}>Ejemplo de {zoneName ?? zone}. Dibuja tu chacra para ver la tuya.</p>}
    {err && <p role="alert">{err}</p>}
    {data?.needs_polygon && <p>Dibuja el contorno de tu parcela para consultar su NDVI.</p>}
    {months.length ? (
      <>
        <div className={s.ndviChart} role="img" aria-label={`NDVI mensual: ${months.map(m => `${monthLabel(m.month)} ${fmtNumber(m.ndvi, 2)}`).join(", ")}`}>
          <div className={s.ndviBands} style={{ height: H }} aria-hidden="true">
            <i style={{ bottom: 0.3 * H }}><span>0,3 cultivo verde</span></i>
            <i style={{ bottom: 0.2 * H }}><span>0,2 suelo</span></i>
          </div>
          {months.map(m => (
            <div key={m.month} className={s.ndviCol}>
              <b>{fmtNumber(m.ndvi, 2)}</b>
              <div className={s.ndviTrack} style={{ height: H }}><div style={{ height: Math.max(2, Math.min(1, Math.max(0, m.ndvi)) * H), background: m.ndvi >= 0.3 ? "#3f7d3a" : m.ndvi >= 0.2 ? "#a6b86a" : "#c9b48a" }} /></div>
              <small>{monthLabel(m.month)}</small>
            </div>
          ))}
        </div>
        {last && <p className={s.sub}>Último mes: <b>{reading(last.ndvi)}</b> ({fmtNumber(last.ndvi, 2)} de 1).</p>}
      </>
    ) : <p>{data ? "Sin observaciones válidas todavía. Los huecos no son un NDVI de cero." : "Cargando escenas…"}</p>}
    {data?.job && data.job.status !== "completo" && <p role="status">{data.job.status}: {data.job.detail}</p>}
    {parcelId && !data?.needs_polygon && <button className={`${s.btn} ${s.btnGhost}`} onClick={refresh} disabled={busy || ["pendiente", "procesando"].includes(data?.job?.status ?? "")}>Actualizar desde HLS</button>}
    {!!data?.items.length && <details className={s.more}><summary>Ver escenas y calidad</summary><div className={s.moreBody} style={{ overflowX: "auto" }}><table><thead><tr><th>Fecha</th><th>NDVI</th><th>Nubes de escena</th><th>Píxeles válidos</th></tr></thead><tbody>{data.items.map(i => <tr key={i.scene_id}><td><a href={i.source_url} target="_blank" rel="noreferrer">{i.observed_on}</a></td><td>{fmtNumber(i.ndvi, 2)}</td><td>{fmtNumber(i.cloud_pct, 1)} %</td><td>{fmtNumber(i.valid_pct, 1)} %</td></tr>)}</tbody></table><p className={s.sub}>NASA HLS v2 (Landsat 8/9 y Sentinel-2 armonizados, 30 m). Mediana mensual de hasta dos escenas por mes. Nubes, sombra, nieve, agua y aerosol alto enmascarados. Parcelas pequeñas pueden no contener centros de píxel.</p></div></details>}
  </section>;
}
