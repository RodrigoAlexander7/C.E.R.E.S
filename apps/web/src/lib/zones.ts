"use client";

// Zonas piloto (registro data/zonas/ del backend). Las tres superficies las leen de /public/zones.

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface ZoneCrop { id: string; name: string; full_name: string; hint: string; in_catalog: boolean }

export interface Zone {
  id: string;
  name: string;
  zone: string;
  region: string | null;
  version: string;
  districts: string[];
  recognition: string | null;
  center: { lat: number; lon: number; note?: string } | null;
  elevation_m: { value: number; note?: string } | null;
  catalog_version: string;
  nasa_snapshot_id: string | null;
  nasa_source_id: string;
  crops: ZoneCrop[];
  water_m3_ha_year: { value: number | null; unit: string; label?: string; source_id?: string; note?: string } | null;
  default_method: { value: string; note?: string } | null;
  efficiency_by_method: Record<string, number | string> | null;
  default_area_ha: { value: number; note?: string } | null;
  zone_source_id: string;
}

let cache: { default: string; items: Zone[]; engine_version: string } | null = null;

export function useZones() {
  const [data, setData] = useState(cache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (cache) return;
    api<{ default: string; items: Zone[]; engine_version: string }>("/public/zones")
      .then((d) => {
        cache = d;
        setData(d);
      })
      .catch(() => setError("No se pudieron cargar las zonas piloto"));
  }, []);
  return { zones: data?.items ?? [], defaultId: data?.default ?? "majes", engineVersion: data?.engine_version ?? null, error };
}

export const METHOD_LABEL: Record<string, string> = { goteo: "goteo", aspersion: "aspersión", gravedad: "gravedad" };
