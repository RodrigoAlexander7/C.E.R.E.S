"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Comparison } from "@/components/Comparison";
import { Ndvi } from "@/components/simple/ndvi";
import { ApiError, api, fmtDateTime, fmtNumber } from "@/lib/api";
import type { Parcel, Run } from "@/lib/types";
import { useZones } from "@/lib/zones";

export default function Demo() {
  const { zones, defaultId } = useZones();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [data, setData] = useState<{ parcel: Parcel; run: Run | null; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ?zona=chilina desde la landing; sin parámetro, la zona por defecto.
    setZoneId(new URLSearchParams(window.location.search).get("zona"));
  }, []);
  const zone = zones.find((z) => z.id === (zoneId ?? defaultId));

  useEffect(() => {
    if (!zone) return;
    setData(null);
    setError(null);
    api<{ parcel: Parcel; run: Run | null; note: string }>(`/public/demo?zone=${zone.id}`).then(setData).catch((e) => setError(e instanceof ApiError ? e.message : "No disponible"));
  }, [zone]);

  return (
    <div className="stack">
      {zones.length > 1 && (
        <div className="row" role="group" aria-label="Zona piloto" style={{ gap: 8, flexWrap: "wrap" }}>
          {zones.map((z) => (
            <button key={z.id} className={z.id === zone?.id ? "" : "btn-secondary"} aria-pressed={z.id === zone?.id} onClick={() => setZoneId(z.id)}>{z.name}</button>
          ))}
        </div>
      )}
      {error && <div className="card">{error}</div>}
      {!error && !data && <p className="muted">Cargando caso de demostración…</p>}
      {data && zone && (
        <>
          <div className="card stack">
            <h1>Caso público de demostración — {zone.name}</h1>
            <div className="notice notice-warn">{data.note}. Agua, suelo y precios son supuestos etiquetados; el clima es la serie real de NASA POWER de {zone.name}.</div>
            <p className="muted" style={{ margin: 0 }}>
              {fmtNumber(data.parcel.area_ha, 2)} ha dibujadas en el distrito {data.parcel.region_codes.district_name}. Comparación calculada el {data.run ? fmtDateTime(data.run.created_at) : "—"}.
              Para comparar tu propia chacra, <Link href="/app">responde 3 preguntas</Link>.
            </p>
          </div>
          <Ndvi key={zone.id} zone={zone.id} />
          {data.run?.result ? <Comparison result={data.run.result} /> : <div className="card">Sin comparación cargada.</div>}
        </>
      )}
    </div>
  );
}
