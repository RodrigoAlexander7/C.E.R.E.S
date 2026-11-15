"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, MapMouseEvent, StyleSpecification } from "maplibre-gl";
import type { Geometry, RegionNode } from "@/lib/types";

const PERU_BOUNDS: [[number, number], [number, number]] = [[-81.4, -18.4], [-68.6, 0.1]];

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">colaboradores de OpenStreetMap</a> · Límites referenciales SERFOR/INEI',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#e8efe6" } },
    { id: "osm", type: "raster", source: "osm" },
  ],
};

export function bboxOf(g: Geometry | { type: "Point"; coordinates: number[] }): [[number, number], [number, number]] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as number[];
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  visit(g.coordinates);
  return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
}

const empty = { type: "FeatureCollection" as const, features: [] as GeoJSON.Feature[] };

export interface MapViewProps {
  focus: Geometry | null;
  regions: RegionNode[];
  selectedId: string | null;
  onRegionClick?: (id: string) => void;
  drawing: boolean;
  draft: [number, number][];
  closed: boolean;
  onAddVertex?: (lngLat: [number, number]) => void;
  parcels?: { id: string; name: string; geometry: Geometry | null; point: { lat: number; lon: number } | null }[];
  userPoint?: { lat: number; lon: number } | null;
  pinPoint?: { lat: number; lon: number } | null;
  onPick?: (lngLat: [number, number]) => void;
  picking?: boolean;
}

export default function MapView(props: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (disposed || !el.current) return;
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const m = new maplibregl.Map({ container: el.current, style: STYLE, bounds: PERU_BOUNDS, attributionControl: { compact: false } });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
      // Solo un fallo de la fuente de teselas OSM muestra el aviso de mapa base.
      m.on("error", (e: unknown) => {
        const ev = e as { sourceId?: string; error?: Error };
        if (ev.sourceId === "osm") setTileError(true);
      });
      m.on("data", (e: unknown) => {
        const ev = e as { sourceId?: string; tile?: unknown };
        if (ev.sourceId === "osm" && ev.tile) setTileError(false);
      });
      m.on("load", () => {
        m.addSource("children", { type: "geojson", data: empty });
        m.addSource("focus", { type: "geojson", data: empty });
        m.addSource("parcels", { type: "geojson", data: empty });
        m.addSource("draft", { type: "geojson", data: empty });
        m.addSource("points", { type: "geojson", data: empty });
        m.addLayer({ id: "children-fill", type: "fill", source: "children", paint: { "fill-color": ["case", ["get", "pilot"], "#2f6b3a", "#5b7f9e"], "fill-opacity": ["case", ["get", "selected"], 0.35, 0.12] } });
        m.addLayer({ id: "children-line", type: "line", source: "children", paint: { "line-color": ["case", ["get", "pilot"], "#2f6b3a", "#3b5d7a"], "line-width": ["case", ["get", "pilot"], 2.5, 1.2] } });
        m.addLayer({ id: "focus-line", type: "line", source: "focus", paint: { "line-color": "#1f2a1f", "line-width": 2.5, "line-dasharray": [2, 1] } });
        m.addLayer({ id: "parcels-fill", type: "fill", source: "parcels", paint: { "fill-color": "#b5651d", "fill-opacity": 0.35 } });
        m.addLayer({ id: "parcels-line", type: "line", source: "parcels", paint: { "line-color": "#b5651d", "line-width": 2 } });
        m.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#d9a400", "fill-opacity": 0.35 } });
        m.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["!=", "$type", "Point"], paint: { "line-color": "#8a5a00", "line-width": 2.5 } });
        m.addLayer({ id: "draft-pts", type: "circle", source: "draft", filter: ["==", "$type", "Point"], paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#8a5a00", "circle-stroke-width": 2 } });
        m.addLayer({ id: "points", type: "circle", source: "points", paint: { "circle-radius": 7, "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
        m.on("click", (e: MapMouseEvent) => {
          const p = latest.current;
          const ll: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          if (p.drawing && !p.closed) return p.onAddVertex?.(ll);
          if (p.picking) return p.onPick?.(ll);
          const f = m.queryRenderedFeatures(e.point, { layers: ["children-fill"] })[0];
          if (f && p.onRegionClick) p.onRegionClick(String(f.properties?.id));
        });
        m.on("mousemove", "children-fill", () => (m.getCanvas().style.cursor = latest.current.drawing ? "crosshair" : "pointer"));
        m.on("mouseleave", "children-fill", () => (m.getCanvas().style.cursor = latest.current.drawing ? "crosshair" : ""));
        setReady(true);
      });
      map.current = m;
    })();
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Subdivisiones y selección
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("children") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: props.regions
        .filter((c) => c.geometry)
        .map((c) => ({ type: "Feature", properties: { id: c.id, name: c.name, pilot: c.pilot, selected: c.id === props.selectedId }, geometry: c.geometry as GeoJSON.Geometry })),
    });
  }, [ready, props.regions, props.selectedId]);

  // Zoom al área seleccionada
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("focus") as GeoJSONSource).setData(props.focus ? { type: "Feature", properties: {}, geometry: props.focus as GeoJSON.Geometry } : empty);
    const b = props.focus ? bboxOf(props.focus) : null;
    m.fitBounds(b ?? PERU_BOUNDS, { padding: 40, duration: 700, maxZoom: 17 });
  }, [ready, props.focus]);

  // Parcelas guardadas
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("parcels") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (props.parcels ?? []).filter((p) => p.geometry).map((p) => ({ type: "Feature", properties: { id: p.id, name: p.name }, geometry: p.geometry as GeoJSON.Geometry })),
    });
  }, [ready, props.parcels]);

  // Dibujo
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const feats: GeoJSON.Feature[] = props.draft.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } }));
    if (props.closed && props.draft.length >= 3) {
      feats.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...props.draft, props.draft[0]]] } });
    } else if (props.draft.length >= 2) {
      feats.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: props.draft } });
    }
    (m.getSource("draft") as GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
    m.getCanvas().style.cursor = props.drawing || props.picking ? "crosshair" : "";
  }, [ready, props.draft, props.closed, props.drawing, props.picking]);

  // Puntos: ubicación del navegador y referencia manual
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const feats: GeoJSON.Feature[] = [];
    if (props.userPoint) feats.push({ type: "Feature", properties: { color: "#1d5fd1" }, geometry: { type: "Point", coordinates: [props.userPoint.lon, props.userPoint.lat] } });
    if (props.pinPoint) feats.push({ type: "Feature", properties: { color: "#b5651d" }, geometry: { type: "Point", coordinates: [props.pinPoint.lon, props.pinPoint.lat] } });
    (m.getSource("points") as GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
    if (props.userPoint) m.flyTo({ center: [props.userPoint.lon, props.userPoint.lat], zoom: 15 });
  }, [ready, props.userPoint, props.pinPoint]);

  return (
    <div className="map" role="region" aria-label="Mapa interactivo. También puedes usar los selectores de la izquierda.">
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {tileError && (
        <div className="map-status">
          <div className="notice notice-warn" role="status">
            El mapa base no cargó. Los selectores, los límites locales y el dibujo de tu terreno siguen funcionando.
          </div>
        </div>
      )}
    </div>
  );
}
