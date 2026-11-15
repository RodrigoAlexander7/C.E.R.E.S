"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { api, ApiError } from "@/lib/api";
import type { Parcel } from "@/lib/types";
import { useZones } from "@/lib/zones";
import type { Book } from "./records";

export function useBook() {
  const { user, loading, activeParcelId } = useSession();
  const { zones } = useZones(); const [parcel, setParcel] = useState<Parcel | null>(null);
  const currentParcel = useRef(activeParcelId);
  currentParcel.current = activeParcelId;
  const [book, setBook] = useState<Book | null>(null); const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!user || !activeParcelId) { setBook(null); setParcel(null); return; }
    try { const [p,b] = await Promise.all([api<Parcel>(`/parcels/${activeParcelId}`), api<Book>(`/parcels/${activeParcelId}/notebook`)]); if (currentParcel.current !== activeParcelId) return; setParcel(p); setBook(b); setError(""); }
    catch (e) { setError(e instanceof ApiError ? e.message : "No se pudo cargar el cuaderno"); }
  }, [user, activeParcelId]);
  useEffect(() => { setBook(null); setParcel(null); load(); }, [load]);
  return { user, loading, parcel, book, error, setError, load, zone: zones.find(z => z.id === parcel?.zone_id) };
}
