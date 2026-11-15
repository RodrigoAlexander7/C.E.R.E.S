"use client";

// Módulo «Cuándo sembrar» (R19): agua y riesgo térmico por mes de siembra con 11 años de NASA POWER,
// y años El Niño / La Niña según el ONI de NOAA. Público, sin cuenta.

import { useState } from "react";
import { Icon, Tip } from "@/components/simple/icons";
import s from "@/components/simple/simple.module.css";
import { SowingWindow } from "@/components/SowingWindow";
import { useZones } from "@/lib/zones";

export default function Cuando() {
  const { zones, defaultId, error } = useZones();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const zone = zones.find((z) => z.id === (zoneId ?? defaultId));
  return (
    <section aria-labelledby="cuando-t">
      <div className={s.moduleHead}>
        <p className={s.stepKicker}>Datos NASA</p>
        <h1 id="cuando-t" className={`${s.q} ${s.display}`}>¿Cuándo me conviene sembrar?</h1>
        <p className={s.headMeta} style={{ marginTop: 6 }}>
          <span>Elige cultivo y mes.</span>
          <Tip tip="Agua y riesgo de frío o calor calculados con 11 años (2015–2025) de clima diario de NASA POWER. Es historia, no pronóstico."><span className={s.nasaDot}><Icon name="sat" size={14} /> NASA</span></Tip>
        </p>
      </div>
      {error && <div className={s.error} role="alert">{error}</div>}
      {zones.length > 1 && (
        <div className={s.zoneRow} role="group" aria-label="Zona">
          <span>Zona:</span>
          {zones.map((z) => (
            <button key={z.id} className={s.zoneBtn} aria-pressed={z.id === zone?.id} onClick={() => setZoneId(z.id)}>{z.name}</button>
          ))}
        </div>
      )}
      {zone && <SowingWindow key={zone.id} wide zone={zone.id} crops={zone.crops.filter((c) => c.in_catalog).map((c) => ({ id: c.id, name: c.name }))} />}
    </section>
  );
}
