"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, fmtNumber } from "@/lib/api";
import { useBook } from "@/components/simple/useBook";
import { CaptureInput, ProposalCard, RecordEditor, emptyData, KINDS, LABELS, type FieldRecord, type Data, type Proposal, type CaptureData } from "@/components/simple/records";
import { Icon, Tip } from "@/components/simple/icons";
import s from "@/components/simple/simple.module.css";

export default function Notebook() {
  const { user, loading, parcel, book, error, setError, load, zone } = useBook();
  const [kind, setKind] = useState("campana"); const [draft, setDraft] = useState<Data | null>(null);
  const [editing, setEditing] = useState<FieldRecord | null>(null); const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null); const [pending, setPending] = useState<Proposal[]>([]);
  const [history, setHistory] = useState<{ revision: number; data: Data; origin: string }[] | null>(null);
  const [notifications, setNotifications] = useState(false);
  const fetchPending = async () => {
    if (parcel) try { setPending((await api<{ items: Proposal[] }>(`/parcels/${parcel.id}/proposals`)).items); } catch {}
  };
  useEffect(() => { fetchPending(); }, [parcel?.id]);
  useEffect(() => {
    if (parcel) setNotifications(localStorage.getItem(`ceres:agenda:${parcel.id}`) === "on");
  }, [parcel?.id]);
  useEffect(() => {
    if (!notifications || !book || !parcel || !("Notification" in window) || Notification.permission !== "granted") return;
    for (const task of book.agenda) {
      const due = String(task.data.due_on); const key = `ceres:avisado:${task.id}:${due}`;
      if (due <= new Date().toLocaleDateString("en-CA") && !localStorage.getItem(key)) {
        new Notification("Agenda de CERES", { body: String(task.data.title) }); localStorage.setItem(key, "yes");
      }
    }
  }, [book, notifications, parcel]);
  const toggleNotifications = async () => {
    if (!parcel || !("Notification" in window)) return setError("Este navegador no ofrece notificaciones. Puedes consultar aquí tu agenda.");
    const enabled = !notifications && await Notification.requestPermission() === "granted";
    setNotifications(enabled); localStorage.setItem(`ceres:agenda:${parcel.id}`, enabled ? "on" : "off");
  };
  if (loading) return <p>Cargando…</p>;
  if (!user || !parcel) return <section className={s.panel}><h1>Cuaderno y agenda</h1><p>Guarda tu chacra para registrar su historia y preparar las próximas labores.</p><Link href="/app">Ir a Qué sembrar</Link></section>;
  const execute = async (fn: () => Promise<void>) => { setBusy(true); setError(""); try { await fn(); await load(); return true; } catch (e) { setError(e instanceof ApiError ? e.message : "No se pudo guardar"); return false; } finally { setBusy(false); } };
  const save = () => execute(async () => {
    await api(`/parcels/${parcel.id}/notebook${editing ? `/${editing.id}` : ""}`, { method: editing ? "PUT" : "POST", json: { data: draft, revision: editing?.revision ?? null } }); setDraft(null); setEditing(null);
  });
  const propose = (capture: CaptureData) => execute(async () => { setProposal(await api<Proposal>(`/parcels/${parcel.id}/proposals`, { method: "POST", json: capture })); });
  // Voz primero y lo demás plegado: el agricultor ve un micrófono, su agenda y su historial.
  return <section><div className={s.moduleHead}><p className={s.stepKicker}>{parcel.name}</p><h1 className={`${s.q} ${s.display}`}>Cuaderno de campo</h1><p>Habla con Ceres. Tu chacra queda anotada.</p></div>
    {error && <p className={s.error} role="alert">{error}</p>}
    {book?.contains_simulated && <p className={s.sub} role="status"><Tip tip="Esta cuenta mezcla datos reales y registros simulados para la demo. Los simulados están marcados y no cuentan en tus números."><Icon name="info" size={14} /> Incluye registros de demostración</Tip></p>}
    <section className={`${s.panel} ${s.voicePanel}`}><CaptureInput onSend={propose} busy={busy} /></section>
    {(proposal || pending[0]) && <ProposalCard key={(proposal ?? pending[0]).id} value={proposal ?? pending[0]} parcelId={parcel.id} records={book?.items ?? []} zone={zone} onDone={() => { setProposal(null); fetchPending(); load(); }} />}
    <section className={s.panel}>
      <p className={s.qLine}><span className={s.qIcon}><Icon name="calendar" /></span><b>Próximas labores</b>
        <button type="button" className={s.iconBtn} style={{ marginLeft: "auto" }} onClick={toggleNotifications} title={notifications ? "Desactivar avisos" : "Avisarme al abrir la app"} aria-pressed={notifications}>{notifications ? "Avisos activos" : "Avisarme"}</button>
      </p>
      {!book?.agenda.length && <p className={s.sub}>Sin labores pendientes.</p>}
      {book?.agenda.map(r => <div key={r.id} className={s.agendaRow}><span><b>{String(r.data.due_on)}</b> · {String(r.data.title)}</span><button className={s.iconBtn} disabled={busy} onClick={() => execute(async () => { await api(`/parcels/${parcel.id}/notebook/${r.id}`, {method:"PUT",json:{data:{...r.data,done:true},revision:r.revision}}); })}><Icon name="check" size={16} /> Marcar hecho</button></div>)}
    </section>
    <details className={s.more} open={!!draft}><summary>Registrar con formulario</summary><div className={s.moreBody} style={{ display: "grid", gap: 10 }}><label>Tipo de registro<select value={kind} onChange={e => { setKind(e.target.value); setDraft(null); setEditing(null); }}>{Object.entries(KINDS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setEditing(null); const d = emptyData(kind, zone?.crops[0]?.id ?? ""); if(kind === "campana" && parcel.area_origin !== "supuesto_demo") d.area_ha = parcel.area_ha; setDraft(d); }}>Nuevo registro</button>
    {draft && <div style={{ display:"grid", gap:12 }}><h3>{editing ? "Corregir" : "Nuevo"}: {KINDS[draft.kind]}</h3><RecordEditor value={draft} onChange={setDraft} records={book?.items ?? []} zone={zone} /><div className={s.answerRow}><button className={`${s.btn} ${s.btnPrimary}`} disabled={busy} onClick={save}>Guardar registro</button><button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setDraft(null); setEditing(null); }}>Cancelar</button></div></div>}</div></details>
    <details className={s.more}><summary>Revisión de este mes</summary><div className={s.moreBody}>{book?.review.map((r,i) => <p key={i}>{r.question}{r.record_id && <button className={s.linkBtn} onClick={() => { const item=book.items.find(x=>x.id===r.record_id); if(item){setEditing(item);setDraft(item.data);window.scrollTo({top:0});} }}>Completar registro</button>}</p>)}</div></details>
    <details className={s.more}><summary>Resúmenes de campañas y meses</summary><div className={s.moreBody}>{book?.campaigns.map(c => <div key={c.id}><h3>{zone?.crops.find(x=>x.id===c.crop_id)?.name ?? c.crop_id}</h3><p>Ventas: S/ {fmtNumber(c.revenue_soles)} · costos completos: S/ {fmtNumber(c.cost_soles)} · margen calculado de registros: S/ {fmtNumber(c.margin_soles)}</p><p>Ganancia que declaraste: {c.declared_profit.length ? c.declared_profit.map(p=>`S/ ${fmtNumber(p)}`).join(", ") : "pendiente"}</p></div>)}{book?.monthly.map(m=><p key={m.month}>{m.month}: ventas S/ {fmtNumber(m.sales_soles)} · gastos registrados S/ {fmtNumber(m.costs_soles)} · ganancia declarada S/ {fmtNumber(m.declared_profit_soles)}</p>)}<p>El año pasado en este mes: {book?.last_year_this_month ? `ventas S/ ${fmtNumber(book.last_year_this_month.sales_soles)}, gastos S/ ${fmtNumber(book.last_year_this_month.costs_soles)}` : "sin registros"}. Los importes pendientes no equivalen a cero.</p></div></details>
    <h2>Historial de mi chacra</h2>{book?.items.map(r => <article key={r.id} className={s.card}><h3>{KINDS[r.data.kind]} · {String(r.data.date ?? r.data.sowing_date ?? r.data.due_on ?? "Fecha pendiente")}</h3><p>{String(r.data.title ?? r.data.concept ?? zone?.crops.find(c=>c.id===r.data.crop_id)?.name ?? r.data.crop_id ?? r.data.note ?? "")}</p><small>Revisión {r.revision} · {r.origin === "supuesto_demo" ? "Simulado para demo" : r.origin === "declarado_chat_confirmado" ? "Declarado por chat, confirmado" : "Declarado"}</small><div className={s.answerRow}><button className={`${s.btn} ${s.btnGhost}`} onClick={()=>{setEditing(r);setDraft(r.data);window.scrollTo({top:0});}}>Corregir</button><button className={`${s.btn} ${s.btnGhost}`} onClick={()=>execute(async()=>{await api(`/parcels/${parcel.id}/notebook/${r.id}?revision=${r.revision}`,{method:"DELETE"});})}>Eliminar</button><button className={`${s.btn} ${s.btnGhost}`} onClick={()=>execute(async()=>{setHistory((await api<{items:{revision:number;data:Data;origin:string}[]}>(`/parcels/${parcel.id}/notebook/${r.id}/history`)).items);})}>Ver revisiones</button></div></article>)}
    {history && <section className={s.panel}><h2>Revisiones conservadas</h2>{history.map(h=><details key={h.revision}><summary>Revisión {h.revision} · {h.origin}</summary><dl>{Object.entries(h.data).filter(([k])=>k!=="kind"&&k!=="previous").map(([k,v])=><div key={k}><dt>{LABELS[k]??(k==="deleted"?"Eliminado":k)}</dt><dd>{v==null?"Pendiente":typeof v==="boolean"?(v?"Sí":"No"):String(v)}</dd></div>)}</dl></details>)}<button className={s.linkBtn} onClick={()=>setHistory(null)}>Cerrar revisiones</button></section>}
  </section>;
}
