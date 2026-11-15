"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Comparison } from "@/components/Comparison";
import { ApiError, api, fmtDateTime, fmtNumber } from "@/lib/api";
import type { Parcel, Run } from "@/lib/types";

export default function Demo() {
  const [data, setData] = useState<{ parcel: Parcel; run: Run | null; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ parcel: Parcel; run: Run | null; note: string }>("/public/demo").then(setData).catch((e) => setError(e instanceof ApiError ? e.message : "No disponible"));
  }, []);

  if (error) return <div className="card">{error}</div>;
  if (!data) return <p className="muted">Cargando caso de demostración…</p>;
  return (
    <div className="stack">
      <div className="card stack">
        <h1>Caso público de demostración — Majes I</h1>
        <div className="notice notice-warn">{data.note} Agua, suelo y precios son supuestos de demostración etiquetados; el clima es la serie real de NASA POWER.</div>
        <p className="muted" style={{ margin: 0 }}>
          {fmtNumber(data.parcel.area_ha, 2)} ha dibujadas en el distrito {data.parcel.region_codes.district_name}. Comparación calculada el {data.run ? fmtDateTime(data.run.created_at) : "—"}.
          Para comparar tu propia parcela y usar el asistente, <Link href="/">delimítala en el mapa</Link> e inicia sesión.
        </p>
      </div>
      {data.run?.result ? <Comparison result={data.run.result} /> : <div className="card">Sin comparación cargada.</div>}
    </div>
  );
}
