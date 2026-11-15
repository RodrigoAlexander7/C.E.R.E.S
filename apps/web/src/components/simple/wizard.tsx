"use client";

// Alta en 3 preguntas (R15): qué sembraste, si ya cosechaste (y cuándo), qué te importa más.
// Cada respuesta es un toque; el mes de cosecha es un segundo toque solo si el cultivo sigue en campo.

import { useMemo, useState } from "react";
import type { Profile } from "@/lib/types";
import s from "./simple.module.css";

export interface Answers {
  crop: string | null;
  status: "en_campo" | "cosechado" | null;
  harvest: string | null; // YYYY-MM-15
  priority: Profile["priority"] | null;
}

const CROPS: { id: string; name: string; hint: string; color: string }[] = [
  { id: "maiz_grano", name: "Maíz", hint: "Amarillo duro, para grano", color: "#f3e3b5" },
  { id: "frejol_grano", name: "Frejol", hint: "Grano seco", color: "#dcebd0" },
  { id: "cebolla_roja", name: "Cebolla", hint: "Roja, para bulbo", color: "#efd6e1" },
  { id: "maiz_chala", name: "Maíz chala", hint: "Para forraje", color: "#ecdfc3" },
  { id: "papa", name: "Papa", hint: "", color: "#eadfd2" },
  { id: "alfalfa", name: "Alfalfa", hint: "Instalada", color: "#d9e8d0" },
];

const PRIORITIES: { id: Profile["priority"]; name: string; hint: string }[] = [
  { id: "dinero", name: "Ganar más", hint: "Lo que más margen deja" },
  { id: "agua", name: "Ahorrar agua", hint: "Lo que menos riego pide" },
  { id: "suelo", name: "Cuidar mi suelo", hint: "Rotar y no cansarlo" },
  { id: "equilibrada", name: "Un poco de todo", hint: "Ver los compromisos" },
];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function Wizard({ initial, startStep = 0, onDone }: { initial: Answers; startStep?: number; onDone: (a: Answers) => void }) {
  const [a, setA] = useState<Answers>(initial);
  const [step, setStep] = useState(startStep);
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 15);
      return { iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-15`, label: MESES[d.getMonth()], year: d.getFullYear() };
    });
  }, []);

  const pick = (patch: Partial<Answers>, next?: number) => {
    const na = { ...a, ...patch };
    setA(na);
    if (next === 3) onDone(na);
    else if (next !== undefined) setStep(next);
  };

  return (
    <section aria-labelledby="wq">
      <div className={s.progress} aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} data-on={i <= step} />)}</div>
      <p className={s.stepKicker}>Pregunta {step + 1} de 3</p>

      {step === 0 && (
        <>
          <h1 id="wq" className={`${s.q} ${s.display}`}>¿Qué sembraste último?</h1>
          <p className={s.qHint}>Lo que tienes ahora en tu chacra o lo último que cosechaste.</p>
          <div className={s.choices}>
            {CROPS.map((c) => (
              <button key={c.id} className={s.choice} aria-pressed={a.crop === c.id} onClick={() => pick({ crop: c.id }, 1)}>
                <span className={s.dot} style={{ background: c.color, color: "#13221a" }} aria-hidden="true">{c.name[0]}</span>
                <strong>{c.name}</strong>
                {c.hint && <span>{c.hint}</span>}
              </button>
            ))}
          </div>
          {a.crop === "alfalfa" && <p className={s.wizardNote}>La alfalfa instalada se maneja distinto (cortes, años de vida): por ahora CERES no la compara como un cultivo de campaña.</p>}
        </>
      )}

      {step === 1 && (
        <>
          <h1 id="wq" className={`${s.q} ${s.display}`}>¿Ya cosechaste?</h1>
          <p className={s.qHint}>Así sabemos desde cuándo queda libre tu terreno.</p>
          <div className={s.choices}>
            <button className={`${s.choice} ${s.choiceWide}`} aria-pressed={a.status === "cosechado"} onClick={() => pick({ status: "cosechado", harvest: null }, 2)}>
              <span className={s.dot} style={{ background: "#dfe9d6", color: "#1f4d2b" }} aria-hidden="true">✓</span>
              <span><strong style={{ display: "block", color: "#13221a" }}>Sí, ya coseché</strong>El terreno está libre</span>
            </button>
            <button className={`${s.choice} ${s.choiceWide}`} aria-pressed={a.status === "en_campo"} onClick={() => pick({ status: "en_campo" })}>
              <span className={s.dot} style={{ background: "#fbecc9", color: "#7a5300" }} aria-hidden="true">…</span>
              <span><strong style={{ display: "block", color: "#13221a" }}>Todavía está en campo</strong>Elige el mes en que cosechas</span>
            </button>
          </div>
          {a.status === "en_campo" && (
            <div className={s.months} role="group" aria-label="Mes de cosecha">
              {months.map((m) => (
                <button key={m.iso} className={s.monthBtn} aria-pressed={a.harvest === m.iso} onClick={() => pick({ harvest: m.iso }, 2)}>
                  {m.label}<small>{m.year}</small>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <h1 id="wq" className={`${s.q} ${s.display}`}>¿Qué te importa más?</h1>
          <p className={s.qHint}>Ordenamos tus opciones según esto. Siempre verás todas.</p>
          <div className={s.choices}>
            {PRIORITIES.map((p) => (
              <button key={p.id} className={s.choice} aria-pressed={a.priority === p.id} onClick={() => pick({ priority: p.id }, 3)}>
                <strong>{p.name}</strong>
                <span>{p.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className={s.wizardNav}>
        {step > 0 ? <button className={s.linkBtn} onClick={() => setStep(step - 1)}>← Atrás</button> : <span />}
      </div>
      <p className={s.wizardNote}>
        Sin estudios de suelo ni formularios: lo que no sepas lo suponemos con valores típicos de Majes I y te lo decimos. Calculamos para un lote de 5 ha; puedes cambiarlo después.
      </p>
    </section>
  );
}

export const CROP_NAME: Record<string, string> = Object.fromEntries(CROPS.map((c) => [c.id, c.name.toLowerCase()]));
export const PRIORITY_NAME: Record<string, string> = Object.fromEntries(PRIORITIES.map((p) => [p.id, p.name]));
