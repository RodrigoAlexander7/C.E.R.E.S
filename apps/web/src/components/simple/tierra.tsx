"use client";

// «¿Cómo está tu tierra?» (Mi chacra): sal visible y método de riego. Con cuenta se guarda como nueva
// revisión del perfil de la parcela; sin cuenta, se recuerda en este navegador para la próxima consulta.

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { readTierra, writeTierra, type Tierra } from "@/lib/tierra";
import type { Revision } from "@/lib/types";
import { Icon, Tip } from "./icons";
import { SoilPhotoCapture } from "./SoilPhotoCapture";
import s from "./simple.module.css";

export function TierraForm({ parcelId }: { parcelId?: string }) {
  const [t, setT] = useState<Tierra>({});
  const [rev, setRev] = useState<Revision | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(parcelId));
  const [captureKey, setCaptureKey] = useState(0);

  useEffect(() => {
    let active = true;
    setRev(null); setMsg(null); setCaptureKey((key) => key + 1);
    if (!parcelId) { setT(readTierra()); setLoading(false); return; }
    setT({}); setLoading(true);
    api<{ items: Revision[] }>(`/parcels/${parcelId}/profile-revisions`)
      .then((r) => {
        if (!active) return;
        const last = r.items[0] ?? null;
        setRev(last);
        setT({ salinity_signs: last?.profile.soil?.salinity_signs ?? null, photo_assessment: last?.profile.soil?.photo_assessment ?? null, method: last?.profile.water?.method ?? undefined });
        if (!last) setMsg("Completa primero el perfil de tu chacra para guardar estos datos.");
      })
      .catch(() => { if (active) setMsg("No se pudo cargar el perfil de tu chacra. Vuelve a abrir esta pantalla para reintentar."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [parcelId]);

  const save = async () => {
    setMsg(null);
    if (busy || loading) return;
    if (!parcelId) {
      writeTierra(t);
      setMsg("Listo: lo usaremos en tu próxima consulta de «Qué sembrar» en este navegador.");
      return;
    }
    if (!rev) { setMsg("No se pudo cargar un perfil para guardar. Vuelve a abrir tu chacra."); return; }
    setBusy(true);
    try {
      const p = rev.profile;
      const profile = { ...p, water: { ...p.water, method: t.method ?? p.water?.method ?? null }, soil: { ...p.soil, salinity_signs: t.salinity_signs ?? null, photo_assessment: t.photo_assessment ?? null } };
      const r = await api<{ id: string }>(`/parcels/${parcelId}/profile-revisions`, { method: "POST", json: { profile, note: "Mi chacra: cómo está tu tierra" } });
      setRev({ ...rev, id: r.id, profile });
      setMsg("Guardado en tu chacra. La próxima comparación ya lo usa; las anteriores se conservan.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const opt = <K extends "salinity_signs" | "method">(k: K, v: Tierra[K], label: string) => (
    <button type="button" className={s.answer} disabled={busy || loading} aria-pressed={t[k] === v} onClick={() => {
      setMsg(null);
      setT((x) => ({ ...x, [k]: v, ...(k === "salinity_signs" ? { photo_assessment: null } : {}) }));
      if (k === "salinity_signs") setCaptureKey((key) => key + 1);
    }}>{label}</button>
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
        <div className={s.answerRow}>{opt("salinity_signs", "con_signos", "Sí, se ven")}{opt("salinity_signs", "sin_signos", "No veo signos claros")}{opt("salinity_signs", null, "No sé")}</div>
        <div className={s.soilCapture}><SoilPhotoCapture key={`${parcelId ?? "local"}-${captureKey}`} disabled={busy || loading} onApply={(assessment) => {
          setT((x) => ({ ...x, salinity_signs: assessment.salinity_signs === "no_concluyente" ? null : assessment.salinity_signs, photo_assessment: assessment }));
          setMsg("Observación elegida. Guarda los datos para usarla en tu próxima consulta.");
        }} /></div>
        {t.photo_assessment && <div className={s.photoObservation}><b>Observación visual elegida</b><p>{t.photo_assessment.description}</p><p>{t.photo_assessment.limitations}</p><p>Fuente: Gemini visual. No reemplaza un análisis de suelo.</p></div>}
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
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={save} disabled={busy || loading || (!!parcelId && !rev) || (!t.method && t.salinity_signs === undefined && !t.photo_assessment)}>Guardar datos de mi chacra</button>
      </div>
      {msg && <p className={s.sub} role="status">{msg}</p>}
    </section>
  );
}
