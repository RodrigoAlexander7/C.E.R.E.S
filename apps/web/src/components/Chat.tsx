"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { SourceChips } from "./Sources";

const SUGGESTIONS = ["¿Por qué sugieres frejol después del maíz?", "¿Qué cambia con menos agua?", "¿Qué falta saber de mi suelo?", "¿Por qué la cebolla es exploratoria?"];

const STATUS_NOTE: Record<string, string> = {
  no_configurado: "IA no conectada: se muestra la explicación registrada por la aplicación.",
  error_proveedor: "El servicio de IA falló: se muestra la explicación registrada por la aplicación.",
  respuesta_no_validada: "La respuesta de la IA no pasó la verificación de cifras y fuentes.",
};

export function Chat({ parcelId, runId, runLabel }: { parcelId: string; runId: string; runLabel: string }) {
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ configured: boolean; label: string; model: string | null } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ configured: boolean; label: string; model: string | null }>("/assistant/status").then(setStatus).catch(() => {});
  }, []);

  // Una conversación por resultado consultado; se recupera si ya existe.
  useEffect(() => {
    let cancelled = false;
    setConvId(null);
    setMessages([]);
    (async () => {
      try {
        const list = await api<{ items: { id: string; run_id: string }[] }>(`/parcels/${parcelId}/conversations`);
        const existing = list.items.find((c) => c.run_id === runId);
        if (existing) {
          const conv = await api<{ id: string; messages: ChatMessage[] }>(`/conversations/${existing.id}`);
          if (!cancelled) {
            setConvId(conv.id);
            setMessages(conv.messages);
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [parcelId, runId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const send = async (question: string) => {
    if (question.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      let id = convId;
      if (!id) {
        const conv = await api<{ id: string }>(`/parcels/${parcelId}/conversations`, { method: "POST", json: { run_id: runId } });
        id = conv.id;
        setConvId(id);
      }
      const optimistic: ChatMessage = { id: "tmp", role: "user", content: question, provider_status: null, created_at: new Date().toISOString(), payload: {} };
      setMessages((m) => [...m, optimistic]);
      setQ("");
      const answer = await api<ChatMessage>(`/conversations/${id}/messages`, { method: "POST", json: { question } });
      setMessages((m) => [...m.filter((x) => x.id !== "tmp"), { ...optimistic, id: `u-${answer.id}` }, answer]);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== "tmp"));
      setError(e instanceof ApiError ? e.message : "No se pudo enviar la pregunta");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card chat" aria-labelledby="chat-title">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 id="chat-title" style={{ margin: 0 }}>Asistente</h2>
        {status && <span className={`status ${status.configured ? "status-viable_con_supuestos" : "status-requiere_datos"}`}>{status.label}</span>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Explica la comparación «{runLabel}» con sus datos y fuentes. No cambia tu perfil ni recalcula: para otro escenario usa los controles de simulación.
      </p>
      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 && <p className="muted small">Pregunta, por ejemplo:</p>}
        {messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            {m.role === "assistant" && m.provider_status && m.provider_status !== "ok" && <div className="small" style={{ color: "var(--warn)", fontWeight: 600 }}>{STATUS_NOTE[m.provider_status] ?? m.provider_status}</div>}
            {m.role === "assistant" && m.payload.profile_changed && <div className="small" style={{ color: "var(--warn)" }}>Tu perfil cambió después de este resultado; la respuesta usa los datos del resultado consultado.</div>}
            <p style={{ margin: 0, whiteSpace: "pre-line" }}>{m.content}</p>
            {m.role === "assistant" && (
              <>
                {m.payload.missing_data && m.payload.missing_data.length > 0 && <p className="small" style={{ margin: "0.3rem 0 0" }}>Falta saber: <strong>{m.payload.missing_data.join("; ")}</strong></p>}
                {m.payload.sources && m.payload.sources.length > 0 && (
                  <div className="small" style={{ marginTop: "0.3rem" }}>Fuentes: <SourceChips ids={m.payload.sources.map((s) => s.id)} /></div>
                )}
                {(m.payload.detail || (m.payload.assumptions?.length ?? 0) > 0 || (m.payload.fragments?.length ?? 0) > 0) && (
                  <details style={{ marginTop: "0.4rem" }}>
                    <summary className="small">Más detalle</summary>
                    {m.payload.detail && <p className="small" style={{ whiteSpace: "pre-line" }}>{m.payload.detail}</p>}
                    {m.payload.assumptions && m.payload.assumptions.length > 0 && <p className="small">Supuestos: {m.payload.assumptions.join("; ")}</p>}
                    {m.provider_status !== "ok" && m.payload.fragments && m.payload.fragments.length > 0 && (
                      <div className="small">
                        <strong>Fichas relacionadas:</strong>
                        <ul>{m.payload.fragments.map((f) => <li key={f.id}>{f.title}: {f.text} <SourceChips ids={[f.source_id]} /></li>)}</ul>
                      </div>
                    )}
                    {m.payload.model && <p className="small muted">Modelo: {m.payload.model}</p>}
                  </details>
                )}
              </>
            )}
          </div>
        ))}
        {busy && <p className="muted small"><span className="spinner" /> Pensando con los datos de tu comparación…</p>}
      </div>
      <div className="suggestions">
        {SUGGESTIONS.map((s) => <button key={s} className="btn-secondary" onClick={() => send(s)} disabled={busy}>{s}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="row">
        <label htmlFor="q" className="sr-only">Tu pregunta</label>
        <input id="q" type="text" maxLength={600} placeholder="Escribe tu pregunta" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <button className="btn-primary" type="submit" disabled={busy || q.trim().length < 2}>Preguntar</button>
      </form>
      {error && <div className="notice notice-bad" role="alert">{error}</div>}
    </section>
  );
}
