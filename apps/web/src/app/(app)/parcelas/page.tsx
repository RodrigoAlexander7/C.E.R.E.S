"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { ApiError, api, fmtDateTime, fmtNumber } from "@/lib/api";
import type { Parcel } from "@/lib/types";

export default function Parcels() {
  const { user, loading, refresh } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Parcel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/ingresar?volver=/parcelas");
    api<{ items: Parcel[] }>("/parcels").then((r) => setItems(r.items)).catch((e) => setError(e instanceof ApiError ? e.message : "Error"));
  }, [user, loading, router]);

  const activate = async (id: string) => {
    await api(`/parcels/${id}/activate`, { method: "POST" });
    await refresh();
    setItems((xs) => xs?.map((p) => ({ ...p, is_active: p.id === id })) ?? null);
  };

  if (loading || (!items && !error)) return <p className="muted">Cargando tus parcelas…</p>;
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Mis parcelas</h1>
        <Link className="btn btn-primary" style={{ color: "#fff" }} href="/avanzado">Agregar parcela</Link>
      </div>
      {error && <div className="notice notice-bad">{error}</div>}
      {items && items.length === 0 && <div className="card">Todavía no guardaste parcelas. <Link href="/avanzado">Delimita tu terreno en el mapa</Link>.</div>}
      <div className="grid-3">
        {items?.map((p) => (
          <article key={p.id} className="card stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>{p.name || "Parcela sin nombre"}</h2>
              {p.is_active ? <span className="status status-viable_con_supuestos">✓ Activa</span> : <button className="btn-ghost" onClick={() => activate(p.id)}>Marcar como activa</button>}
            </div>
            <dl className="kv">
              <dt>Área</dt><dd>{fmtNumber(p.area_ha, 2)} ha <span className="tag">{p.area_origin === "geodesica" ? "calculada del dibujo" : "declarada"}</span></dd>
              <dt>Distrito</dt><dd>{p.region_codes.district_name ?? "—"}</dd>
              <dt>Zona piloto</dt><dd>{p.in_pilot_zone ? `Sí (${p.zone_id === "chilina" ? "Valle de Chilina" : "Majes I"})` : "No: sin fichas locales"}</dd>
              <dt>Creada</dt><dd>{fmtDateTime(p.created_at)}</dd>
            </dl>
            <Link className="btn btn-secondary" href={`/parcelas/${p.id}`}>Abrir perfil y comparación</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
