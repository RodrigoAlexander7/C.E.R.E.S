"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { api, fmtNumber } from "@/lib/api";
import type { FieldContext, Geometry } from "@/lib/types";
import type { Zone } from "@/lib/zones";
import s from "./simple.module.css";
import f from "./field-setup.module.css";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <p role="status">Cargando mapa…</p> });

export function polygonFromGeoJSON(value: unknown): Extract<Geometry, { type: "Polygon" }> {
  const input = value as { type?: string; geometry?: unknown; coordinates?: unknown } | null;
  if (input?.type === "Feature") return polygonFromGeoJSON(input.geometry);
  if (input?.type !== "Polygon" || !Array.isArray(input.coordinates) || !input.coordinates.length) throw new Error("Pega una geometría Polygon o un Feature con Polygon.");
  const coordinates = input.coordinates.map((ring: unknown) => {
    if (!Array.isArray(ring) || ring.length < 4) throw new Error("Cada contorno necesita al menos tres esquinas y el punto de cierre.");
    const points = ring.map((point: unknown) => {
      if (!Array.isArray(point) || point.length < 2 || typeof point[0] !== "number" || typeof point[1] !== "number" || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new Error("Usa coordenadas válidas en orden longitud, latitud.");
      return [point[0], point[1]];
    });
    const first = points[0], last = points[points.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) throw new Error("Cierra el contorno repitiendo la primera coordenada al final.");
    return points;
  });
  return { type: "Polygon", coordinates };
}

/** El servidor es la única fuente del área geodésica y de la zona del campo. */
export async function measureField(geometry: Geometry): Promise<FieldContext> {
  if (geometry.type !== "Polygon") throw new Error("Delimita un solo campo con una geometría Polygon.");
  const info = await api<Omit<FieldContext, "geometry">>("/geometry/area", { method: "POST", json: { geometry } });
  if (!Number.isFinite(info.area_ha) || info.area_ha <= 0 || info.area_ha > 10000 || !Number.isFinite(info.centroid?.lat) || !Number.isFinite(info.centroid?.lon)) throw new Error("No se pudo verificar el área y la ubicación del campo. Revisa el contorno.");
  return { ...info, geometry };
}

export function FieldSetup({ initial, zones, onContinue, busy = false }: {
  initial: FieldContext | null; zones: Zone[]; onContinue: (field: FieldContext) => void; busy?: boolean;
}) {
  const [field, setField] = useState(initial);
  const [text, setText] = useState("");
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [drawing, setDrawing] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigationZone, setNavigationZone] = useState<string | null>(null);
  const [userPoint, setUserPoint] = useState<{ lat: number; lon: number } | null>(null);
  const request = useRef(0);
  const focus = useMemo<Geometry | null>(() => {
    if (field) return field.geometry;
    const center = zones.find((z) => z.id === navigationZone)?.center;
    if (!center) return null;
    const { lat, lon } = center, d = 0.025;
    return { type: "Polygon", coordinates: [[[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]] };
  }, [field, zones, navigationZone]);

  const invalidate = () => {
    request.current += 1;
    setField(null);
    setMeasuring(false);
    setError(null);
  };
  const measure = async (geometry: Geometry) => {
    const id = ++request.current;
    setMeasuring(true);
    setField(null);
    setError(null);
    try {
      const next = await measureField(geometry);
      if (request.current === id) setField(next);
    } catch (e) {
      if (request.current === id) setError(e instanceof Error ? e.message : "No se pudo medir. Inténtalo otra vez.");
    } finally {
      if (request.current === id) setMeasuring(false);
    }
  };

  return (
    <section aria-labelledby="field-title" className={f.setup}>
      <p className={s.stepKicker}>Primero, tu campo</p>
      <h1 id="field-title" className={`${s.q} ${s.display}`}>Delimita tu campo</h1>
      <p className={s.qHint}>Dibuja el contorno o pega su GeoJSON. Medimos su área y ubicamos la zona antes de calcular tus opciones.</p>
      <div className={f.controls} role="group" aria-label="Acercar el mapa">
        {zones.map((z) => <button key={z.id} className={`${s.btn} ${s.btnGhost}`} disabled={busy || measuring} onClick={() => { invalidate(); setVertices([]); setDrawing(false); setNavigationZone(z.id); }}>Ver {z.name}</button>)}
        <button className={`${s.btn} ${s.btnGhost}`} disabled={busy} onClick={() => {
          if (!navigator.geolocation) return setError("Tu navegador no ofrece ubicación. Puedes dibujar o pegar el GeoJSON.");
          navigator.geolocation.getCurrentPosition((position) => setUserPoint({ lat: position.coords.latitude, lon: position.coords.longitude }), () => setError("No pudimos acceder a tu ubicación. Puedes dibujar o pegar el GeoJSON."));
        }}>Acercar a mi ubicación</button>
      </div>
      <p className={s.sub}>Estos botones solo acercan el mapa. Delimita tu propio terreno.</p>
      <div className={`map-wrap ${f.map}`}>
        <MapView focus={focus} regions={[]} selectedId={null} drawing={drawing} draft={vertices} closed={!drawing && vertices.length >= 3} userPoint={userPoint} onAddVertex={(v) => { invalidate(); setVertices((points) => [...points, v]); }} />
      </div>
      <div className={f.controls}>
        <button className={`${s.btn} ${s.btnGhost}`} disabled={busy} onClick={() => { invalidate(); setVertices([]); setDrawing(true); setText(""); }}>Empezar a dibujar</button>
        {drawing && <>
          <button className={`${s.btn} ${s.btnPrimary}`} disabled={vertices.length < 3 || busy} onClick={() => { setDrawing(false); void measure({ type: "Polygon", coordinates: [[...vertices, vertices[0]]] }); }}>Terminar ({vertices.length} puntos)</button>
          <button className={`${s.btn} ${s.btnGhost}`} disabled={!vertices.length || busy} onClick={() => { invalidate(); setVertices((points) => points.slice(0, -1)); }}>Deshacer</button>
        </>}
      </div>
      {drawing && <p className={s.sub}>Toca cada esquina de tu campo en el mapa y pulsa «Terminar».</p>}
      <form className={f.geojson} onSubmit={(event) => {
        event.preventDefault();
        try { const geometry = polygonFromGeoJSON(JSON.parse(text)); setDrawing(false); setVertices([]); void measure(geometry); }
        catch (e) { invalidate(); setError(e instanceof SyntaxError ? "El texto no es JSON válido. Revisa el GeoJSON." : e instanceof Error ? e.message : "Revisa el GeoJSON."); }
      }}>
        <label htmlFor="field-geojson">Pegar GeoJSON del campo</label>
        <p id="field-geojson-help" className={s.sub}>Alternativa al dibujo: Polygon o Feature con Polygon, coordenadas longitud, latitud.</p>
        <textarea id="field-geojson" aria-describedby="field-geojson-help" rows={5} value={text} disabled={busy} onChange={(e) => { invalidate(); setDrawing(false); setVertices([]); setText(e.target.value); }} />
        <button className={`${s.btn} ${s.btnGhost}`} disabled={!text.trim() || measuring || busy} type="submit">Medir GeoJSON</button>
      </form>
      {measuring && <p role="status">Midiendo área y ubicando tu campo…</p>}
      {error && <p role="alert" className={s.error}>{error}</p>}
      {field && <div className={s.panel} role="status">
        <p><strong>{fmtNumber(field.area_ha, 4)} ha</strong> · Área geodésica del contorno</p>
        <p>{field.zone_name ?? "Fuera de las zonas piloto"}{field.district?.name ? ` · ${field.district.name}` : ""} · Centroide: {fmtNumber(field.centroid.lat, 5)}, {fmtNumber(field.centroid.lon, 5)}</p>
        {!field.zone_id && <p>Aquí puedes llevar tu cuaderno. Aún no tenemos datos locales para estimar opciones de siembra.</p>}
      </div>}
      <button className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`} disabled={!field || measuring || busy} onClick={() => { if (field) onContinue(field); }}>Usar este campo</button>
    </section>
  );
}
