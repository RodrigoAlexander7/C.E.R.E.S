"use client";

// Perfil mínimo después de delimitar el campo: cultivo, cosecha, agua y repetición.
// Cada respuesta es un toque; el mes de cosecha es un segundo toque solo si el cultivo sigue en campo.

import { useMemo, useState } from "react";
import type { Profile } from "@/lib/types";
import type { Zone } from "@/lib/zones";
import s from "./simple.module.css";

export interface Answers {
  crop: string | null;
  status: "en_campo" | "cosechado" | null;
  harvest: string | null; // YYYY-MM-15
  availability: NonNullable<Profile["water"]["availability"]> | null;
  streak: 1 | 2 | null;
}

const COLOR: Record<string, string> = {
  maiz_grano: "#f3e3b5", frejol_grano: "#dcebd0", cebolla_roja: "#efd6e1", cebolla: "#efd6e1", maiz_chala: "#ecdfc3",
  papa: "#eadfd2", alfalfa: "#d9e8d0", ajo: "#ece6f3",
  haba_verde: "#e1eed3", tomate: "#f3d9d4", trigo: "#f1e6c8",
};

const WATER: { id: NonNullable<Answers["availability"]>; name: string; hint: string }[] = [
  { id: "muy_poca", name: "Muy poca", hint: "El agua limita mucho lo que puedo sembrar" },
  { id: "poca", name: "Poca", hint: "Debo cuidar cada riego" },
  { id: "media", name: "Media", hint: "Alcanza con cuidado" },
  { id: "alta", name: "Alta", hint: "Tengo buena disponibilidad" },
  { id: "no_es_problema", name: "El agua no es un problema", hint: "Puedo cubrir el riego que necesito" },
];

export const WATER_NAME = Object.fromEntries(WATER.map((water) => [water.id, water.name]));

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function Wizard({
  initial, startStep = 0, onDone, zone,
}: { initial: Answers; startStep?: number; onDone: (a: Answers) => void; zone: Zone }) {
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
    if (next === 4) {
      if (na.crop && na.status && na.availability && (na.status !== "en_campo" || na.harvest)) onDone(na);
      else setStep(!na.crop ? 0 : !na.status || (na.status === "en_campo" && !na.harvest) ? 1 : 2);
    }
    else if (next !== undefined) setStep(next);
  };

  return (
    <section aria-labelledby="wq">
      <div className={s.progress} aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} data-on={i <= step} />)}</div>
      <p className={s.stepKicker}>Pregunta {step + 1} de 4 · {zone.name}</p>

      {step === 0 && (
        <>
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
          <h1 id="wq" className={`${s.q} ${s.display}`}>¿Cuánta agua tienes para regar?</h1>
          <p className={s.qHint}>Elige cómo te alcanza. No necesitas saber los metros cúbicos.</p>
          <div className={s.choices}>
            {WATER.map((p) => (
              <button key={p.id} className={s.choice} aria-pressed={a.availability === p.id} onClick={() => pick({ availability: p.id }, 3)}>
                <strong>{p.name}</strong>
                <span>{p.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 id="wq" className={`${s.q} ${s.display}`}>¿Cuántas campañas seguidas sembraste este cultivo?</h1>
          <p className={s.qHint}>La repetición y el suelo limitan las opciones, aunque dejen más dinero. Si no recuerdas, calculamos con cautela.</p>
          <div className={s.choices}>
            <button className={s.choice} aria-pressed={a.streak === 1} onClick={() => pick({ streak: 1 }, 4)}><strong>1 campaña</strong></button>
            <button className={s.choice} aria-pressed={a.streak === 2} onClick={() => pick({ streak: 2 }, 4)}><strong>2 o más campañas</strong></button>
            <button className={s.choice} aria-pressed={a.streak === null} onClick={() => pick({ streak: null }, 4)}><strong>No sé</strong></button>
          </div>
        </>
      )}

      <div className={s.wizardNav}>
        {step > 0 ? <button className={s.linkBtn} onClick={() => setStep(step - 1)}>← Atrás</button> : <span />}
      </div>
      <p className={s.wizardNote}>
        Buscamos margen económico respetando el agua, el suelo y la repetición. Los datos desconocidos se muestran como supuestos de {zone.name}.
      </p>
    </section>
  );
}

export const cropName = (zone: Zone | null, id: string | null) => (zone?.crops.find((c) => c.id === id)?.name ?? "").toLowerCase();
