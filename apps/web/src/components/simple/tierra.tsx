"use client";

// «¿Cómo está tu tierra?» (Mi chacra): sal visible y método de riego. Con cuenta se guarda como nueva
// revisión del perfil de la parcela; sin cuenta, se recuerda en este navegador para la próxima consulta.

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { readTierra, writeTierra, type Tierra } from "@/lib/tierra";
import type { Revision } from "@/lib/types";
import { Icon, Tip } from "./icons";
import s from "./simple.module.css";

export function TierraForm({ parcelId }: { parcelId?: string }) {
  const [t, setT] = useState<Tierra>({});
  const [rev, setRev] = useState<Revision | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!parcelId) return setT(readTierra());
    api<{ items: Revision[] }>(`/parcels/${parcelId}/profile-revisions`)
      .then((r) => {
        const last = r.items[0] ?? null;
        setRev(last);
        setT({ salinity_signs: last?.profile.soil?.salinity_signs ?? undefined, method: last?.profile.water?.method ?? undefined });
      })
      .catch(() => setT({}));
  }, [parcelId]);

  const save = async () => {
    setMsg(null);
    if (!parcelId || !rev) {
      writeTierra(t);
      setMsg("Listo: lo usaremos en tu próxima consulta de «Qué sembrar» en este navegador.");
      return;
    }
    setBusy(true);
    try {
      const p = rev.profile;
      const profile = { ...p, water: { ...p.water, method: t.method ?? p.water?.method ?? null }, soil: { ...p.soil, salinity_signs: t.salinity_signs ?? p.soil?.salinity_signs ?? null } };
      const r = await api<{ id: string }>(`/parcels/${parcelId}/profile-revisions`, { method: "POST", json: { profile, note: "Mi chacra: cómo está tu tierra" } });
      setRev({ ...rev, id: r.id, profile });
      setMsg("Guardado en tu chacra. La próxima comparación ya lo usa; las anteriores se conservan.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const opt = <K extends keyof Tierra>(k: K, v: NonNullable<Tierra[K]>, label: string) => (
    <button type="button" className={s.answer} aria-pressed={t[k] === v} onClick={() => setT((x) => ({ ...x, [k]: v }))}>{label}</button>
  );

  return (
    <section className={`${s.panel} ${s.tierra}`} aria-labelledby="tierra-t">
      <h2 id="tierra-t" className={s.display} style={{ margin: "0 0 12px" }}>¿Cómo está tu tierra?</h2>
      <div className={s.question}>
        <p className={s.qLine}>
          <span className={s.qIcon}><Icon name="salt" /></span>
          <b>¿Ves costras blancas o manchas de sal?</b>
          <Tip className={s.qHelp} tip="La sal le hace daño a cultivos como el frejol y la cebolla. Si ves costras blancas, no te los recomendamos hasta medirla con un análisis."><Icon name="question" size={14} /></Tip>
        </p>
        <div className={s.answerRow}>{opt("salinity_signs", "con_signos", "Sí, se ven")}{opt("salinity_signs", "sin_signos", "No, la veo normal")}</div>
      </div>
      <div className={s.question} style={{ marginTop: 14 }}>
        <p className={s.qLine}>
          <span className={s.qIcon}><Icon name="water" /></span>
          <b>¿Cómo riegas tu chacra?</b>
          <Tip className={s.qHelp} tip="Con goteo se pierde menos agua que con aspersión o gravedad (FAO: 90 %, 75 % y 60 %)."><Icon name="question" size={14} /></Tip>
        </p>
        <div className={s.answerRow}>{opt("method", "goteo", "Goteo")}{opt("method", "aspersion", "Aspersión")}{opt("method", "gravedad", "Gravedad")}</div>
      </div>
      <div className={s.saveBar}>
        <span>Tu tierra, el punto de partida.</span>
        <button className={`${s.btn} ${s.btnPrimary}`} onClick={save} disabled={busy || (!t.method && !t.salinity_signs)}>Guardar datos de mi chacra</button>
      </div>
      {msg && <p className={s.sub} role="status">{msg}</p>}
    </section>
  );
}
