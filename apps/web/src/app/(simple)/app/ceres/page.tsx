"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useBook } from "@/components/simple/useBook";
import { CaptureInput, ProposalCard, type CaptureData, type Proposal } from "@/components/simple/records";
import { Comparison } from "@/components/Comparison";
import { SourceChips } from "@/components/Sources";
import type { Run } from "@/lib/types";
import s from "@/components/simple/simple.module.css";
interface Reply { status: string; answer: string; conversation_id?: string; proposal: Proposal | null; tool?: {name:string;run_id?:string}; run?: Run; message?: {payload:{sources?:{id:string}[]}} }
interface Line { role: string; content: string; sources?: string[] }

export default function Ceres() {
  const { user, loading, parcel, book, zone, error, setError, load } = useBook();
  const [lines,setLines] = useState<Line[]>([]); const [conv,setConv] = useState<string|null>(null);
  const [busy,setBusy] = useState(false); const [proposal,setProposal] = useState<Proposal|null>(null);
  const [run,setRun] = useState<Run|null>(null);
  useEffect(()=>{
    let live=true;
    setLines([]);setConv(null);setRun(null);setProposal(null);
    if(parcel) api<{items:{id:string}[]}>(`/parcels/${parcel.id}/conversations`).then(async list=>{
      if(!list.items[0])return;
      const cv=await api<{id:string;messages:{role:string;content:string}[]}>(`/conversations/${list.items[0].id}`);
      if(live){setConv(cv.id);setLines(cv.messages.map(m=>({role:m.role,content:m.content})));}
    }).catch(()=>{});
    return()=>{live=false;};
  },[parcel?.id]);
  useEffect(()=>()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel();},[]);
  if(loading)return <p>Cargando…</p>;
  if(!user||!parcel)return <section className={s.panel}><h1>Conversa con Ceres</h1><p>Guarda tu chacra para conversar con memoria de sus campañas y simular escenarios.</p><Link href="/app">Ir a Qué sembrar</Link></section>;
  const send=async (capture:CaptureData)=>{
    setBusy(true);setError("");
    try{
      const reply=await api<Reply>(`/parcels/${parcel.id}/ceres`,{method:"POST",json:{...capture,conversation_id:conv}});
      setLines(ls=>[...ls,{role:"user",content:capture.text||"Mensaje de voz (audio descartado)"},{role:"assistant",content:reply.answer,sources:reply.message?.payload.sources?.map(s=>s.id)}]);
      if(reply.conversation_id)setConv(reply.conversation_id);
      if(reply.proposal)setProposal(reply.proposal);
      if(reply.run&&reply.tool?.name==="simular_escenario")setRun(reply.run);
      return true;
    }catch(e){setError(e instanceof ApiError?e.message:"No se pudo conversar");return false;}
    finally{setBusy(false);}
  };
  const speak=(text:string)=>{if("speechSynthesis" in window){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="es-PE";window.speechSynthesis.speak(u);}};
  return <section><div className={s.moduleHead}><p className={s.stepKicker}>{parcel.name}</p><h1 className={`${s.q} ${s.display}`}>Conversa con Ceres</h1><p>Recuerdo tu cuaderno confirmado. Puedo proponer registros o pedir al motor un escenario nuevo. Tú confirmas cada alta o corrección de datos.</p></div>
    <details className={s.more}><summary>Lo que Ceres recuerda</summary><div className={s.moreBody}><p>{book?.items.length??0} registros de esta chacra.</p>{book?.items.slice(0,20).map(r=><p key={r.id}>{r.data.kind} · {String(r.data.date??r.data.sowing_date??r.data.due_on??"sin fecha")} · {String(r.data.crop_id??r.data.title??r.data.concept??"")} · revisión {r.revision}</p>)}<Link href="/app/cuaderno">Abrir cuaderno y agenda</Link></div></details>
    <div className={s.chatLog} aria-live="polite">{lines.map((l,i)=><div key={i} className={`${s.msg} ${l.role==="user"?s.msgMe:s.msgBot}`}><p>{l.content}</p>{l.sources&&<SourceChips ids={l.sources}/>} {l.role==="assistant"&&<button className={s.linkBtn} onClick={()=>speak(l.content)}>Escuchar</button>}</div>)}</div>
    {!lines.length&&<div className={s.answerRow}>{["¿Qué recuerdas de mis campañas?","¿Qué me falta completar este mes?"].map(q=><button key={q} className={s.chip} disabled={busy} onClick={()=>send({text:q})}>{q}</button>)}</div>}
    {error&&<p className={s.error} role="alert">{error}</p>}{busy&&<p role="status">Ceres consulta tus datos…</p>}
    {proposal&&<ProposalCard key={proposal.id} parcelId={parcel.id} value={proposal} records={book?.items??[]} zone={zone} onDone={()=>{setProposal(null);load();setLines(ls=>[...ls,{role:"assistant",content:"Propuesta procesada. Puedes comprobar el resultado en tu cuaderno."}]);}}/>}
    <section className={s.panel}><CaptureInput busy={busy} onSend={send} label="Tu mensaje para Ceres"/></section>
    {run?.result&&<section className={s.panel}><h2>Nuevo escenario del motor</h2><p>Resultado guardado por separado. No cambia el perfil de tu chacra.</p><details className={s.more}><summary>Ver comparación del escenario</summary><div className={s.moreBody}><Comparison result={run.result}/></div></details></section>}
  </section>;
}
