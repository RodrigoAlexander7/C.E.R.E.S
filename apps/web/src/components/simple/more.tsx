"use client";

// «Ver más»: lo que antes era el modo avanzado, plegado dentro del módulo y abierto solo cuando hace falta.

import { useEffect, useState } from "react";
import { Comparison } from "@/components/Comparison";
import { ProfileForm, validateProfile } from "@/components/ProfileForm";
import { api, fmtDateTime } from "@/lib/api";
import type { ComparisonResult, Profile, Run } from "@/lib/types";
import type { Zone } from "@/lib/zones";
import s from "./simple.module.css";

export function MoreDetails({
  result, saved, zone, profile, busy, detailOpen, onDetailToggle, onRecompute, onOpenRun,
}: {
  result: ComparisonResult;
  saved: { parcelId: string; runId: string } | null;
  zone: Zone | null;
  profile: Profile;
  busy: boolean;
  detailOpen: boolean;
  onDetailToggle: (open: boolean) => void;
  onRecompute: (p: Profile) => void;
  onOpenRun: (runId: string) => void;
}) {
  const [draft, setDraft] = useState<Profile>(profile);
  const [errs, setErrs] = useState<string[]>([]);
  const [runs, setRuns] = useState<Run[] | null>(null);
  useEffect(() => setDraft(profile), [profile]);

  const loadRuns = async () => {
    if (!saved || runs) return;
    try {
      setRuns((await api<{ items: Run[] }>(`/parcels/${saved.parcelId}/recommendations`)).items);
    } catch {
      setRuns([]);
    }
  };

  return (
    <div>
      <details id="detalle" className={s.more} open={detailOpen} onToggle={(e) => onDetailToggle((e.target as HTMLDetailsElement).open)}>
        <summary>Detalle técnico de la comparación</summary>
        <div className={s.moreBody}>
          <p className={s.sub} style={{ marginTop: 0 }}>Calendario, agua mes a mes, margen, suelo, reglas del motor y fuentes de cada cifra.</p>
          {detailOpen && <Comparison result={result} />}
        </div>
      </details>

      {saved && (
        <details className={s.more}>
          <summary>Mis datos de la chacra</summary>
          <div className={s.moreBody}>
            <p className={s.sub} style={{ marginTop: 0 }}>Análisis de suelo, agua exacta, presupuesto y tus precios. Cada cambio guarda una revisión nueva y recalcula; el resultado anterior se conserva.</p>
            <ProfileForm value={draft} onChange={setDraft} zone={zone} />
            {errs.length > 0 && <div className={s.error} role="alert">{errs.join(" ")}</div>}
            <button
              className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`}
              style={{ marginTop: 12 }}
              disabled={busy}
              onClick={() => {
                const e = validateProfile(draft);
                setErrs(e);
                if (!e.length) onRecompute(draft);
              }}
            >
              Guardar y recalcular
            </button>
          </div>
        </details>
      )}

      {saved && (
        <details className={s.more} onToggle={(e) => (e.target as HTMLDetailsElement).open && loadRuns()}>
          <summary>Resultados anteriores</summary>
          <div className={s.moreBody}>
            {!runs && <p className={s.sub}>Cargando…</p>}
            {runs?.length === 0 && <p className={s.sub}>Aún no hay otros resultados.</p>}
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {runs?.map((r) => (
                <li key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span>
                    <b>{fmtDateTime(r.created_at)}</b>
                    {r.scenario_label ? ` · ${r.scenario_label}` : ""}
                    {r.id === saved.runId ? " · el que ves" : ""}
                    <br />
                    <small className={s.sub}>{Object.entries(r.statuses ?? {}).map(([k, v]) => `${k}: ${v.replace(/_/g, " ")}`).join(" · ")}</small>
                  </span>
                  {r.id !== saved.runId && <button className={`${s.btn} ${s.btnGhost}`} onClick={() => onOpenRun(r.id)}>Ver</button>}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
      {!saved && <p className={s.sub}>Guarda tu chacra para editar todos sus datos y ver tus resultados anteriores.</p>}
    </div>
  );
}
