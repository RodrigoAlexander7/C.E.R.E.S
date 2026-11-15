"use client";

// Alta en 3 preguntas (R15): qué sembraste, si ya cosechaste (y cuándo), qué te importa más.
// Cada respuesta es un toque; el mes de cosecha es un segundo toque solo si el cultivo sigue en campo.

import { useMemo, useState } from "react";
import type { Profile } from "@/lib/types";
import type { Zone } from "@/lib/zones";
import s from "./simple.module.css";

export interface Answers {
  crop: string | null;
  status: "en_campo" | "cosechado" | null;
  harvest: string | null; // YYYY-MM-15
  priority: Profile["priority"] | null;
}

const COLOR: Record<string, string> = {
  maiz_grano: "#f3e3b5", frejol_grano: "#dcebd0", cebolla_roja: "#efd6e1", cebolla: "#efd6e1", maiz_chala: "#ecdfc3",
  papa: "#eadfd2", alfalfa: "#d9e8d0", ajo: "#ece6f3",
};

const PRIORITIES: { id: Profile["priority"]; name: string; hint: string }[] = [
  { id: "dinero", name: "Ganar más", hint: "Lo que más margen deja" },
  { id: "agua", name: "Ahorrar agua", hint: "Lo que menos riego pide" },
  { id: "suelo", name: "Cuidar mi suelo", hint: "Rotar y no cansarlo" },
  { id: "equilibrada", name: "Un poco de todo", hint: "Ver los compromisos" },
];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function Wizard({
  initial, startStep = 0, onDone, zone, zones, onZone,
}: { initial: Answers; startStep?: number; onDone: (a: Answers) => void; zone: Zone; zones: Zone[]; onZone: (id: string) => void }) {
  const CROPS = zone.crops.filter((c) => c.id !== "otro");
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
          {zones.length > 1 && (
            <div className={s.zoneRow} role="group" aria-label="Tu zona">
              <span>Tu zona:</span>
              {zones.map((z) => (
                <button key={z.id} className={s.zoneBtn} aria-pressed={z.id === zone.id} onClick={() => { if (z.id !== zone.id) { setA({ ...a, crop: null }); onZone(z.id); } }}>{z.name}</button>
              ))}
            </div>
          )}
          <h1 id="wq" className={`${s.q} ${s.display}`}>¿Qué sembraste último?</h1>
          <p className={s.qHint}>Lo que tienes ahora en tu chacra o lo último que cosechaste.</p>
          <div className={s.choices}>
            {CROPS.map((c) => (
              <button key={c.id} className={s.choice} aria-pressed={a.crop === c.id} onClick={() => pick({ crop: c.id }, 1)}>
                <span className={s.dot} style={{ background: COLOR[c.id] ?? "#ece3d0", color: "#13221a" }} aria-hidden="true">{c.name[0]}</span>
                <strong>{c.name}</strong>
                {c.hint && <span>{c.hint}</span>}
              </button>
            ))}
          </div>
          {a.crop === "alfalfa" && <p className={s.wizardNote}>Comparamos qué sembrar después de levantar la alfalfa. Mantenerla no lo comparamos: es perenne (cortes, años de vida).</p>}
          {zone.crops.some((c) => c.id === a.crop && !c.in_catalog) && a.crop !== "alfalfa" && <p className={s.wizardNote}>Este cultivo aún no tiene ficha en {zone.name}: lo usamos como antecedente y comparamos lo que puedes sembrar después.</p>}
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
        Sin estudios de suelo ni formularios: lo que no sepas lo suponemos con valores típicos de {zone.name} y te lo decimos. Calculamos para un lote de {zone.default_area_ha?.value ?? 1} ha; puedes cambiarlo después.
      </p>
    </section>
  );
}

export const cropName = (zone: Zone | null, id: string | null) => (zone?.crops.find((c) => c.id === id)?.name ?? "").toLowerCase();
export const PRIORITY_NAME: Record<string, string> = Object.fromEntries(PRIORITIES.map((p) => [p.id, p.name]));
