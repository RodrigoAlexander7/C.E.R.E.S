"use client";

// Módulo «Mi chacra»: tus parcelas y, si quieres, su contorno en el mapa. Sin cuenta: comprobar si
// un terreno cae en una zona piloto y cuánto mide. El mapa es opcional: nunca bloquea el resto.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NasaBadge } from "@/components/NasaBadge";
import { useSession } from "@/components/SessionProvider";
import { Ndvi } from "@/components/simple/ndvi";
import s from "@/components/simple/simple.module.css";
import { ApiError, api, fmtNumber } from "@/lib/api";
import type { Geometry, Parcel } from "@/lib/types";
import { useZones, type Zone } from "@/lib/zones";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <p className={s.sub}>Cargando mapa…</p> });

interface AreaInfo { area_ha: number; zone_id: string | null; zone_name: string | null; district: { name: string } | null }

function around(z: Zone | undefined): Geometry | null {
  if (!z?.center) return null;
  const { lat, lon } = z.center, d = 0.02;
  return { type: "Polygon", coordinates: [[[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]] };
}

export default function Chacra() {
  const { user, loading, activeParcelId, refresh } = useSession();
  const { zones, defaultId } = useZones();
  const [parcels, setParcels] = useState<Parcel[] | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [closed, setClosed] = useState(false);
  const [info, setInfo] = useState<AreaInfo | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return setParcels(null);
    try {
      setParcels((await api<{ items: Parcel[] }>("/parcels")).items);
    } catch {
      setParcels([]);
    }
  }, [user]);
  useEffect(() => {
    if (!loading) load();
  }, [loading, load]);

  const active = parcels?.find((p) => p.id === activeParcelId) ?? parcels?.[0] ?? null;
  const zone = zones.find((z) => z.id === (active?.zone_id ?? defaultId));
  const polygon: Geometry | null = closed && vertices.length >= 3 ? { type: "Polygon", coordinates: [[...vertices, vertices[0]]] } : null;
  const focus = useMemo(() => active?.geometry ?? polygon ?? around(zone), [active, polygon, zone]);

  useEffect(() => {
    if (!polygon) return setInfo(null);
    api<AreaInfo>("/geometry/area", { method: "POST", json: { geometry: polygon } }).then(setInfo).catch((e) => setErr(e instanceof ApiError ? e.message : "No se pudo medir"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed, vertices.length]);

  const startDrawing = () => {
    setMapOpen(true);
    setVertices([]);
    setClosed(false);
    setDrawing(true);
    setMsg(null);
    setErr(null);
  };

  const saveOutline = async () => {
    if (!active || !polygon) return;
    try {
      await api(`/parcels/${active.id}`, { method: "PATCH", json: { geometry: polygon } });
      setMsg("Contorno guardado. Los próximos cálculos usarán esta área; los anteriores se conservan.");
      setVertices([]);
      setClosed(false);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "No se pudo guardar el contorno");
    }
  };

  const activate = async (id: string) => {
    await api(`/parcels/${id}/activate`, { method: "POST" });
    await refresh();
  };

  return (
    <section aria-labelledby="chacra-t">
      <div className={s.moduleHead}>
        <p className={s.stepKicker}>Mi chacra</p>
        <h1 id="chacra-t" className={`${s.q} ${s.display}`}>{active ? active.name || "Mi chacra" : "Tu terreno"}</h1>
        <p>{user ? "Tus parcelas guardadas. Dibujarla en el mapa es opcional: sirve para medir el área y consultar su verdor desde el satélite." : "Comprueba si tu terreno está en una zona piloto y cuánto mide. Para guardarlo, ingresa."}</p>
      </div>

      <Ndvi key={active?.id ?? zone?.id} parcelId={active?.id} zone={zone?.id} zoneName={zone?.name} />
      {msg && <div className={s.panel} role="status"><p className={s.panelText}>{msg}</p></div>}
      {err && <div className={s.error} role="alert">{err}</div>}

      {user && parcels && parcels.length === 0 && (
        <div className={s.panel}>
          <p className={s.panelText}>Aún no guardaste una chacra. Responde las 3 preguntas y pulsa «Guardar».</p>
          <Link href="/app" className={`${s.btn} ${s.btnPrimary}`}>Ir a «Qué sembrar»</Link>
        </div>
      )}

      {active && (
        <div className={s.card}>
          <div className={s.facts}>
            <div className={s.fact}><strong>{fmtNumber(active.area_ha, active.area_ha % 1 ? 2 : 0)} ha</strong><span>{active.area_origin === "geodesica" ? "medida del dibujo" : active.area_origin === "supuesto_demo" ? "área de ejemplo, por confirmar" : "área que indicaste"}</span></div>
            <div className={s.fact}><strong>{zone?.name ?? "—"}</strong><span>{active.in_pilot_zone ? "zona piloto" : "fuera de zona piloto"}</span></div>
            <div className={s.fact}><strong>{active.region_codes?.district_name ?? "—"}</strong><span>distrito</span></div>
          </div>
        </div>
      )}

      {parcels && parcels.length > 1 && (
        <details className={s.more}>
          <summary>Mis otras parcelas ({parcels.length - 1})</summary>
          <div className={s.moreBody}>
            {parcels.filter((p) => p.id !== active?.id).map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0" }}>
                <span><b>{p.name || "Sin nombre"}</b><br /><small className={s.sub}>{fmtNumber(p.area_ha, 2)} ha · {zones.find((z) => z.id === p.zone_id)?.name ?? "fuera de zona piloto"}</small></span>
                <button className={`${s.btn} ${s.btnGhost}`} onClick={() => activate(p.id)}>Usar esta</button>
              </div>
            ))}
          </div>
        </details>
      )}

      <details className={s.more} open={mapOpen} onToggle={(e) => setMapOpen((e.target as HTMLDetailsElement).open)}>
        <summary>{active?.geometry ? "Ver mi chacra en el mapa" : "Dibujar mi terreno en el mapa"}</summary>
        <div className={s.moreBody}>
          {mapOpen && (
            <div className="map-wrap" style={{ height: 360, borderRadius: 16 }}>
              <MapView
                focus={focus}
                regions={[]}
                selectedId={null}
                drawing={drawing}
                draft={vertices}
                closed={closed}
                onAddVertex={(v) => setVertices((xs) => [...xs, v])}
                parcels={active ? [{ id: active.id, name: active.name ?? "", geometry: active.geometry, point: active.point }] : []}
              />
            </div>
          )}
          <div className={s.answerRow} style={{ marginTop: 10 }}>
            {!drawing ? (
              <button className={`${s.btn} ${s.btnGhost}`} onClick={startDrawing}>{polygon || active?.geometry ? "Volver a dibujar" : "Empezar a dibujar"}</button>
            ) : (
              <>
                <button className={`${s.btn} ${s.btnPrimary}`} disabled={vertices.length < 3} onClick={() => { setClosed(true); setDrawing(false); }}>Terminar ({vertices.length} puntos)</button>
                <button className={`${s.btn} ${s.btnGhost}`} disabled={!vertices.length} onClick={() => setVertices((xs) => xs.slice(0, -1))}>Deshacer</button>
              </>
            )}
          </div>
          {drawing && <p className={s.sub}>Toca el mapa en cada esquina de tu terreno y pulsa «Terminar».</p>}
          {info && (
            <p className={s.panelText} role="status">
              Mide <b>{fmtNumber(info.area_ha, 2)} ha</b>{info.district ? ` en ${info.district.name}` : ""}. {info.zone_name ? `Está en la zona piloto ${info.zone_name}.` : "Está fuera de las zonas piloto: no hay fichas locales para recomendar ahí."}
            </p>
          )}
          {info && active && <button className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`} onClick={saveOutline}>Guardar este contorno</button>}
          {info && !user && <Link href="/ingresar?volver=/app/chacra" className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`}>Ingresar para guardar</Link>}
          <div style={{ marginTop: 10 }}><NasaBadge product="gibs" /></div>
          <p className={s.sub}>Imagen de un día, solo para ubicar y dibujar; no entra en los cálculos. Calles © colaboradores de OpenStreetMap. Un punto GPS no delimita la parcela; el área sale del dibujo.</p>
        </div>
      </details>
    </section>
  );
}
