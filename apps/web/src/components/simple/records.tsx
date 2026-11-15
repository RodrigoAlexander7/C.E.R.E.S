"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Zone } from "@/lib/zones";
import s from "./simple.module.css";

export type Data = Record<string, string | number | boolean | null> & { kind: string };
export interface FieldRecord { id: string; parcel_id: string; data: Data; revision: number; origin: string; created_at: string }
export interface Change { operation: "crear" | "actualizar"; record_id: string | null; revision: number | null; data: Data }
export interface Proposal { id: string; expires_at: string; proposal: { transcript: string; changes: Change[] } }
export interface Book { contains_simulated?: boolean; items: FieldRecord[]; campaigns: { id: string; crop_id: string; revenue_soles: number | null; cost_soles: number | null; margin_soles: number | null; declared_profit: number[] }[]; monthly: { month: string; sales_soles: number | null; costs_soles: number | null; declared_profit_soles: number | null }[]; last_year_this_month: { month: string; sales_soles: number | null; costs_soles: number | null; declared_profit_soles: number | null } | null; review: { record_id: string | null; question: string }[]; agenda: FieldRecord[] }
export const KINDS: Record<string, string> = { campana: "Campaña", venta: "Venta", costo: "Costo", ganancia: "Ganancia declarada", agenda: "Pendiente de agenda" };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function emptyData(kind: string, crop = "maiz_grano"): Data {
  if (kind === "campana") return { kind, crop_id: crop, variety: "", area_ha: null, sowing_date: null, expected_harvest: null, harvest_date: null, yield_kg: null, costs_complete: false, note: "" };
  if (kind === "venta") return { kind, campaign_id: null, date: today(), quantity_kg: null, price_soles_kg: null, buyer: "", note: "" };
  if (kind === "costo") return { kind, campaign_id: null, date: today(), concept: "", amount_soles: null, note: "" };
  if (kind === "ganancia") return { kind, campaign_id: null, date: today(), amount_soles: null, note: "" };
  return { kind: "agenda", due_on: today(), title: "", done: false, note: "" };
}
const LABELS: Record<string, string> = { crop_id: "Cultivo", area_ha: "Área (ha)", sowing_date: "Fecha de siembra", expected_harvest: "Cosecha prevista", harvest_date: "Fecha de cosecha real", yield_kg: "Cosecha (kg)", costs_complete: "Ya registré todos los gastos de esta campaña", campaign_id: "Campaña relacionada", date: "Fecha", quantity_kg: "Cantidad vendida (kg)", price_soles_kg: "Precio (S/ por kg)", buyer: "Comprador (opcional)", concept: "Concepto del gasto", amount_soles: "Monto (S/)", note: "Nota (opcional)", due_on: "Fecha pendiente", title: "Labor o recordatorio", done: "Ya lo hice" };
const NUMBERS = ["area_ha", "yield_kg", "quantity_kg", "price_soles_kg", "amount_soles"];

export { LABELS };
export function RecordEditor({ value, onChange, records, zone }: { value: Data; onChange: (v: Data) => void; records: FieldRecord[]; zone?: Zone | null }) {
  return <div style={{ display: "grid", gap: 12 }}>{Object.entries({ evidence: "declarado", ...value }).filter(([key]) => key !== "kind").map(([key, v]) => <label key={key} style={{ display: "grid", gap: 4, fontWeight: 600 }}>
    {LABELS[key] ?? (key === "evidence" ? "Procedencia" : key === "variety" ? "Variedad" : key)}
    {key === "evidence" ? <select value={String(v)} onChange={e => onChange({ ...value, evidence: e.target.value })}><option value="declarado">Dato real declarado</option><option value="simulado_demo">Simulado para demo</option></select> : key === "crop_id" && zone ? <select value={String(v ?? "")} onChange={e => onChange({ ...value, [key]: e.target.value })}>{zone?.crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : key === "campaign_id" ? <select value={String(v ?? "")} onChange={e => onChange({ ...value, [key]: e.target.value || null })}><option value="">Sin campaña asociada</option>{String(v ?? "").startsWith("nuevo:") && <option value={String(v)}>Campaña nueva en esta propuesta</option>}{records.filter(r => r.data.kind === "campana").map(r => <option key={r.id} value={r.id}>{r.data.crop_id} · {r.data.sowing_date ?? r.created_at.slice(0,10)}</option>)}</select> : typeof v === "boolean" ? <input type="checkbox" checked={v} onChange={e => onChange({ ...value, [key]: e.target.checked })} /> : <input
      type={key.endsWith("date") || key === "expected_harvest" || key === "due_on" ? "date" : NUMBERS.includes(key) ? "number" : "text"}
      step={NUMBERS.includes(key) ? "any" : undefined} value={v == null ? "" : String(v)}
      onChange={e => onChange({ ...value, [key]: NUMBERS.includes(key) ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value || (key.endsWith("date") || key === "expected_harvest" ? null : "") })} />}
  </label>)}</div>;
}

export function ProposalCard({ parcelId, value, records, zone, onDone }: { parcelId: string; value: Proposal; records: FieldRecord[]; zone?: Zone | null; onDone: () => void }) {
  const [changes, setChanges] = useState(value.proposal.changes);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const send = async (confirm: boolean) => {
    setBusy(true); setErr("");
    try { await api(`/parcels/${parcelId}/proposals/${value.id}/${confirm ? "confirm" : "reject"}`, { method: "POST", ...(confirm ? { json: { transcript: "", changes } } : {}) }); onDone(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "No se pudo completar"); }
    finally { setBusy(false); }
  };
  return <section className={s.panel} aria-label="Propuesta de registros"><h2 className={s.display}>¿Guardo esto?</h2><p>Revisa y corrige los campos. Caduca en 15 minutos. Hasta que confirmes, el cuaderno no cambia.</p>
    {value.proposal.transcript && <p>Entendí: «{value.proposal.transcript}»</p>}
    {changes.map((x,i) => <details key={i} className={s.more} open><summary>{x.operation === "crear" ? "Crear" : "Actualizar"} {KINDS[x.data.kind]}</summary><div className={s.moreBody}><RecordEditor value={x.data} records={records} zone={zone} onChange={data => setChanges(xs => xs.map((v,j) => i === j ? { ...v, data } : v))} /></div></details>)}
    {err && <p role="alert">{err}</p>}<div className={s.answerRow}><button className={`${s.btn} ${s.btnPrimary}`} disabled={busy} onClick={() => send(true)}>Sí, guardar</button><button className={`${s.btn} ${s.btnGhost}`} disabled={busy} onClick={() => send(false)}>Descartar</button></div>
  </section>;
}

export interface CaptureData { text: string; audio_base64?: string; audio_mime?: string; duration_seconds?: number }
export function CaptureInput({ onSend, busy, label = "Cuenta lo que hiciste" }: { onSend: (capture: CaptureData) => Promise<void | boolean>; busy: boolean; label?: string }) {
  const [text, setText] = useState(""); const [recording, setRecording] = useState(false); const [err, setErr] = useState("");
  const recorder = useRef<MediaRecorder | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); recorder.current?.stream.getTracks().forEach(t => t.stop()); if (recorder.current?.state === "recording") recorder.current.stop(); }; }, []);
  const record = async () => {
    if (recording) { recorder.current?.stop(); return; }
    try {
      setErr(""); const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { stream.getTracks().forEach(t => t.stop()); return; }
      const mime = ["audio/webm", "audio/ogg", "audio/mp4"].find(m => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); recorder.current = r;
      const chunks: BlobPart[] = []; let size = 0; const start = performance.now();
      r.ondataavailable = e => { size += e.data.size; if (size <= 4_000_000) chunks.push(e.data); else if (r.state === "recording") r.stop(); };
      r.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); if (timer.current) clearTimeout(timer.current);
        if (!mounted.current) return; setRecording(false);
        if (size > 4_000_000) { setErr("Audio demasiado grande; usa una grabación más corta."); return; }
        const blob = new Blob(chunks, { type: r.mimeType }); const reader = new FileReader();
        reader.onload = async () => { if (!mounted.current) return; try { const sent = await onSend({ text, audio_base64: String(reader.result).split(",")[1], audio_mime: r.mimeType.split(";")[0], duration_seconds: Math.min(120, (performance.now()-start)/1000) }); if (sent !== false) setText(""); } catch { setErr("No se pudo procesar el audio; prueba con texto."); } };
        reader.readAsDataURL(blob);
      };
      r.start(1000); setRecording(true); timer.current = setTimeout(() => r.state === "recording" && r.stop(), 119000);
    } catch { setErr("No se pudo usar el micrófono. Puedes escribir el mismo mensaje."); }
  };
  return <form onSubmit={async e => { e.preventDefault(); try { const sent = await onSend({ text }); if (sent !== false) setText(""); } catch { setErr("No se pudo enviar; tu texto se conserva."); } }} style={{ display: "grid", gap: 10 }}>
    <label style={{ display: "grid", gap: 6 }}>{label}<textarea value={text} onChange={e => setText(e.target.value)} maxLength={6000} rows={3} placeholder="Ej.: coseché 4 toneladas y vendí 1000 kg a S/ 1,20" /></label>
    <div className={s.answerRow}><button className={`${s.btn} ${s.btnPrimary}`} disabled={busy || recording || text.trim().length < 2}>Enviar texto</button><button type="button" className={`${s.btn} ${s.btnGhost}`} disabled={busy} onClick={record}>{recording ? "Terminar grabación" : "Grabar audio"}</button></div>
    <small>Audio de hasta 2 minutos, enviado a la IA para procesarlo y descartado después; no se guarda.</small>{err && <p role="alert">{err}</p>}
  </form>;
}
