"use client";

// Ayuda contextual del modo sencillo: hoja inferior reutilizable, glosario (nivel 1, sin IA)
// y asistente IA con voz opcional (nivel 2, solo con resultado guardado y sesión iniciada).

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { SourceChips } from "@/components/Sources";
import { ApiError, api } from "@/lib/api";
import { GLOSSARY } from "@/lib/glossary";
import type { ChatMessage } from "@/lib/types";
import s from "./simple.module.css";

export function Sheet({ open, onClose, title, children, label }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={s.sheet} aria-label={label ?? title} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className={s.sheetHandle} aria-hidden="true" />
      <div className={s.sheetBody}>
        <div className={s.sheetHead}>
          <h2 className={s.display}>{title}</h2>
          <button className={s.close} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}

interface HelpCtx {
  openTerm: (id: string) => void;
  openAi: (question?: string) => void;
}
const Ctx = createContext<HelpCtx>({ openTerm: () => {}, openAi: () => {} });
export const useHelp = () => useContext(Ctx);

/** Término con ayuda: subrayado punteado que abre el glosario. */
export function Term({ id, children }: { id: string; children: React.ReactNode }) {
  const { openTerm } = useHelp();
  return (
    <button type="button" className={s.term} onClick={() => openTerm(id)} aria-label={`${typeof children === "string" ? children : GLOSSARY[id]?.title}: qué significa`}>
      {children}
    </button>
  );
}

export function HelpProvider({ children, saved }: { children: React.ReactNode; saved: { parcelId: string; runId: string } | null }) {
  const [term, setTerm] = useState<string | null>(null);
  const [ai, setAi] = useState<{ open: boolean; question?: string }>({ open: false });
  const openTerm = useCallback((id: string) => setTerm(id), []);
  const openAi = useCallback((question?: string) => setAi({ open: true, question }), []);
  const t = term ? GLOSSARY[term] : null;
  return (
    <Ctx.Provider value={{ openTerm, openAi }}>
      {children}
      <button className={s.fab} onClick={() => openAi()} aria-label="Pregúntale a la IA">
        <span className={s.orb} aria-hidden="true" /> Pregúntale a la IA
      </button>
      <Sheet open={!!t} onClose={() => setTerm(null)} title={t?.title ?? ""}>
        {t && (
          <div>
            <p style={{ lineHeight: 1.6, fontSize: "1.02rem" }}>{t.text}</p>
            {t.source && <p className={s.sub}>Fuente: <SourceChips ids={[t.source]} /></p>}
            <button className={`${s.btn} ${s.btnGhost} ${s.btnBlock}`} style={{ marginTop: 14 }} onClick={() => { setTerm(null); openAi(`¿Qué significa «${t.title}» en mi caso?`); }}>
              Explícamelo con mi caso (IA)
            </button>
          </div>
        )}
      </Sheet>
      <Sheet open={ai.open} onClose={() => setAi({ open: false })} title="Pregúntale a la IA" label="Asistente IA">
        <AiChat saved={saved} initialQuestion={ai.question} />
      </Sheet>
    </Ctx.Provider>
  );
}

const SUGGESTIONS = ["¿Por qué me conviene esta opción?", "¿Qué pasa si tengo menos agua?", "¿Qué me falta confirmar?", "¿Por qué el frejol cuida el suelo?"];

type SpeechRec = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void };

function AiChat({ saved, initialQuestion }: { saved: { parcelId: string; runId: string } | null; initialQuestion?: string }) {
  const { user } = useSession();
  const [conv, setConv] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [q, setQ] = useState(initialQuestion ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const [canListen, setCanListen] = useState(false);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setCanListen(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (!saved || !user) return;
    (async () => {
      try {
        const list = await api<{ items: { id: string; run_id: string }[] }>(`/parcels/${saved.parcelId}/conversations`);
        const existing = list.items.find((c) => c.run_id === saved.runId);
        if (existing) {
          const c = await api<{ id: string; messages: ChatMessage[] }>(`/conversations/${existing.id}`);
          setConv(c.id);
          setMsgs(c.messages);
        }
      } catch {}
    })();
  }, [saved, user]);

  if (!user || !saved) {
    return (
      <div>
        <p style={{ lineHeight: 1.6 }}>
          La IA explica <b>tu</b> comparación usando sus datos y fuentes. Para eso necesita que la guardes en tu cuenta (es gratis y nadie más la ve).
        </p>
        <p className={s.sub}>Mientras tanto, toca cualquier palabra subrayada para ver su explicación.</p>
        <Link href="/ingresar?volver=/app" className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`} style={{ marginTop: 14 }}>Guardar y preguntar</Link>
      </div>
    );
  }

  const send = async (question: string) => {
    if (question.trim().length < 2 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      let id = conv;
      if (!id) {
        id = (await api<{ id: string }>(`/parcels/${saved.parcelId}/conversations`, { method: "POST", json: { run_id: saved.runId } })).id;
        setConv(id);
      }
      setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: question, provider_status: null, created_at: "", payload: {} }]);
      setQ("");
      const answer = await api<ChatMessage>(`/conversations/${id}/messages`, { method: "POST", json: { question } });
      setMsgs((m) => [...m, answer]);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "No se pudo enviar la pregunta");
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!R) return;
    if (listening) return recRef.current?.stop();
    const rec = new R();
    rec.lang = "es-PE";
    rec.interimResults = false;
    rec.onresult = (e) => setQ(Array.from(e.results).map((r) => r[0].transcript).join(" "));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-PE";
    window.speechSynthesis.speak(u);
  };

  return (
    <div>
      <p className={s.sub} style={{ marginTop: 0 }}>Responde con los datos de tu comparación y sus fuentes. No cambia nada por su cuenta.</p>
      <div className={s.chatLog} aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={`${s.msg} ${m.role === "user" ? s.msgMe : s.msgBot}`}>
            {m.role === "assistant" && m.provider_status && m.provider_status !== "ok" && <div className={s.msgNote}>{m.provider_status === "no_configurado" ? "IA no conectada" : "La IA no respondió; esto es la explicación de la aplicación"}</div>}
            {m.content}
            {m.role === "assistant" && (
              <div style={{ marginTop: 6 }}>
                {m.payload.missing_data && m.payload.missing_data.length > 0 && <div style={{ fontSize: "0.85rem" }}>Falta saber: <b>{m.payload.missing_data.join("; ")}</b></div>}
                {m.payload.sources && m.payload.sources.length > 0 && <div style={{ fontSize: "0.82rem" }}>Fuentes: <SourceChips ids={m.payload.sources.map((x) => x.id)} /></div>}
                {"speechSynthesis" in globalThis && <button className={s.linkBtn} onClick={() => speak(m.content)}>Escuchar</button>}
              </div>
            )}
          </div>
        ))}
        {busy && <div className={`${s.msg} ${s.msgBot}`}>Pensando con los datos de tu comparación…</div>}
      </div>
      {msgs.length === 0 && (
        <div className={s.suggest}>
          {SUGGESTIONS.map((x) => <button key={x} className={s.chip} onClick={() => send(x)}>{x}</button>)}
        </div>
      )}
      {err && <div className={s.error} role="alert">{err}</div>}
      <form className={s.askRow} onSubmit={(e) => { e.preventDefault(); send(q); }}>
        <label className="sr-only" htmlFor="ask">Tu pregunta</label>
        <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder={listening ? "Te escucho…" : "Escribe o dicta tu pregunta"} maxLength={600} />
        {canListen && (
          <button type="button" className={s.micBtn} onClick={listen} aria-pressed={listening} aria-label={listening ? "Detener dictado" : "Dictar pregunta por voz"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm7 9a7 7 0 0 1-14 0m7 7v3" /></svg>
          </button>
        )}
        <button className={`${s.btn} ${s.btnPrimary}`} type="submit" disabled={busy || q.trim().length < 2}>Enviar</button>
      </form>
    </div>
  );
}
