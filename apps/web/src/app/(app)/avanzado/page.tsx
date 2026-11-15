"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DRAFT_KEY, useSession } from "@/components/SessionProvider";
import { EMPTY_PROFILE, ProfileForm, validateProfile } from "@/components/ProfileForm";
import { ApiError, api, fmtNumber } from "@/lib/api";
import type { Geometry, Parcel, Profile, RegionNode } from "@/lib/types";
import { useZones } from "@/lib/zones";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <p className="muted" style={{ padding: "1rem" }}>Cargando mapa…</p> });

interface AreaInfo {
  area_ha: number;
  method: string;
  centroid: { lat: number; lon: number };
  district: RegionNode | null;
  in_pilot_zone: boolean;
  zone_id: string | null;
}

interface Draft {
  mode: "dibujo" | "manual";
  vertices: [number, number][];
  closed: boolean;
  point: { lat: number; lon: number } | null;
  manualArea: string;
  name: string;
  profile: Profile;
}

const NEW_DRAFT: Draft = { mode: "dibujo", vertices: [], closed: false, point: null, manualArea: "", name: "", profile: EMPTY_PROFILE };

export default function Home() {
  const router = useRouter();
  const { user, refresh } = useSession();
  const { zones } = useZones();
  const [deps, setDeps] = useState<RegionNode[]>([]);
  const [provs, setProvs] = useState<RegionNode[]>([]);
  const [dists, setDists] = useState<RegionNode[]>([]);
  const [dep, setDep] = useState("");
  const [prov, setProv] = useState("");
  const [dist, setDist] = useState("");
  const [pilotNote, setPilotNote] = useState("");
  const [regionError, setRegionError] = useState<string | null>(null);
  const [loadingRegions, setLoadingRegions] = useState(false);

  const [draft, setDraft] = useState<Draft>(NEW_DRAFT);
  const [drawing, setDrawing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [area, setArea] = useState<AreaInfo | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lon: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [pointInfo, setPointInfo] = useState<{ district: RegionNode | null; in_pilot_zone: boolean; zone_id: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [myParcels, setMyParcels] = useState<Parcel[]>([]);

  // Restaurar el borrador guardado antes de iniciar sesión.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        setDraft({ ...NEW_DRAFT, ...d });
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (draft.vertices.length || draft.point) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  useEffect(() => {
    if (!user) return setMyParcels([]);
    api<{ items: Parcel[] }>("/parcels").then((r) => setMyParcels(r.items)).catch(() => {});
  }, [user]);

  const loadChildren = useCallback(async (id: string) => {
    setLoadingRegions(true);
    setRegionError(null);
    try {
      const r = await api<{ items: RegionNode[]; pilot_note: string }>(`/regions/${id}/children`);
      return r.items;
    } catch (e) {
      setRegionError(e instanceof ApiError ? e.message : "No se pudieron cargar los límites");
      return [];
    } finally {
      setLoadingRegions(false);
    }
  }, []);

  useEffect(() => {
    api<{ items: RegionNode[]; pilot_note: string }>("/regions")
      .then((r) => {
        setDeps(r.items);
        setPilotNote(r.pilot_note);
      })
      .catch((e) => setRegionError(e instanceof ApiError ? e.message : "Límites no disponibles; puedes dibujar tu terreno igualmente."));
  }, []);

  const selectDep = async (id: string) => {
    setDep(id); setProv(""); setDist(""); setProvs([]); setDists([]);
    if (id) setProvs(await loadChildren(id));
  };
  const selectProv = async (id: string) => {
    setProv(id); setDist(""); setDists([]);
    if (id) setDists(await loadChildren(id));
  };
  const selectDist = (id: string) => setDist(id);

  const goToZone = async (code: string) => {
    await selectDep(`dep:${code.slice(0, 2)}`);
    setProv(`prov:${code.slice(0, 4)}`);
    const d = await loadChildren(`prov:${code.slice(0, 4)}`);
    setDists(d);
    setDist(`dist:${code}`);
  };

  const onRegionClick = (id: string) => {
    if (id.startsWith("dep:")) selectDep(id);
    else if (id.startsWith("prov:")) selectProv(id);
    else selectDist(id);
  };

  const selected = useMemo(() => dists.find((d) => d.id === dist) ?? provs.find((p) => p.id === prov) ?? deps.find((d) => d.id === dep) ?? null, [dist, prov, dep, dists, provs, deps]);
  const visibleChildren = dist ? dists : prov ? dists : dep ? provs : deps;

  const polygon: Geometry | null = draft.closed && draft.vertices.length >= 3 ? { type: "Polygon", coordinates: [[...draft.vertices, draft.vertices[0]]] } : null;
  const focus: Geometry | null = useMemo(() => {
    if (polygon) return polygon;
    return selected?.geometry ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, draft.closed]);

  // Área geodésica calculada en el backend.
  useEffect(() => {
    setArea(null);
    setAreaError(null);
    if (!polygon) return;
    api<AreaInfo>("/geometry/area", { method: "POST", json: { geometry: polygon } })
      .then(setArea)
      .catch((e) => setAreaError(e instanceof ApiError ? e.message : "No se pudo calcular el área"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.closed, draft.vertices.length]);

  useEffect(() => {
    setPointInfo(null);
    if (!draft.point) return;
    api<{ district: RegionNode | null; in_pilot_zone: boolean; zone_id: string | null }>(`/regions/locate?lat=${draft.point.lat}&lon=${draft.point.lon}`).then(setPointInfo).catch(() => {});
  }, [draft.point]);

  const useMyLocation = () => {
    setGeoMsg(null);
    if (!("geolocation" in navigator)) return setGeoMsg("Tu navegador no ofrece ubicación. Busca tu zona en el mapa o con los selectores.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const g = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setGeo(g);
        setGeoMsg(`Ubicación aproximada (±${Math.round(pos.coords.accuracy)} m). Esto ubica tu posición, no los límites de tu terreno: dibújalo o indica su área.`);
      },
      (err) =>
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? "No diste permiso de ubicación. No pasa nada: busca tu zona con los selectores o en el mapa."
            : "No se pudo obtener tu ubicación. Sigue con los selectores o el mapa.",
        ),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const startDrawing = () => {
    setPicking(false);
    setDraft((d) => ({ ...d, mode: "dibujo", vertices: [], closed: false, point: null }));
    setDrawing(true);
  };
  const finishDrawing = () => {
    if (draft.vertices.length < 3) return;
    setDraft((d) => ({ ...d, closed: true }));
    setDrawing(false);
  };

  const inPilot = draft.mode === "dibujo" ? area?.in_pilot_zone : pointInfo?.in_pilot_zone;
  const zoneHere = zones.find((z) => z.id === (draft.mode === "dibujo" ? area?.zone_id : pointInfo?.zone_id)) ?? null;
  const terrainReady = draft.mode === "dibujo" ? Boolean(polygon && area) : Boolean(draft.point && Number(draft.manualArea) > 0);

  const save = async () => {
    const errs = validateProfile(draft.profile);
    if (!terrainReady) errs.unshift("Delimita el terreno o indica ubicación y área.");
    setFormErrors(errs);
    if (errs.length) return;
    if (!user) {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {}
      router.push("/ingresar?volver=/avanzado");
      return;
    }
    setSaving(true);
    try {
      const body =
        draft.mode === "dibujo"
          ? { name: draft.name || null, geometry: polygon, profile: draft.profile }
          : { name: draft.name || null, point: draft.point, area_ha: Number(draft.manualArea), profile: draft.profile };
      const p = await api<Parcel>("/parcels", { method: "POST", json: body });
      await api(`/parcels/${p.id}/recommendations`, { method: "POST", json: {} });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      await refresh();
      router.push(`/parcelas/${p.id}`);
    } catch (e) {
      setFormErrors([e instanceof ApiError ? e.message + (e.details ? ": " + e.details.map((d) => `${d.field} ${d.message}`).join("; ") : "") : "No se pudo guardar"]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="layout-map">
      <section className="card" aria-labelledby="t-flujo">
        <h1 id="t-flujo">¿Qué cultivar después?</h1>
        <p className="muted">Compara tu plan con dos alternativas según agua, costos, suelo y clima histórico NASA. La decisión es tuya.</p>
        {user && myParcels.length > 0 && (
          <div className="notice notice-info" style={{ marginBottom: "1rem" }}>
            Tienes {myParcels.length} parcela(s) guardada(s). <Link href="/parcelas">Ver mis parcelas</Link>
          </div>
        )}
        <ol className="steps">
          <li>
            <h2>Busca tu zona</h2>
            <div className="stack">
              <div>
                <label htmlFor="dep">Departamento</label>
                <select id="dep" value={dep} onChange={(e) => selectDep(e.target.value)}>
                  <option value="">Todo el Perú</option>
                  {deps.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="prov">Provincia</label>
                <select id="prov" value={prov} onChange={(e) => selectProv(e.target.value)} disabled={!dep}>
                  <option value="">—</option>
                  {provs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="dist">Distrito</label>
                <select id="dist" value={dist} onChange={(e) => selectDist(e.target.value)} disabled={!prov}>
                  <option value="">—</option>
                  {dists.map((d) => <option key={d.id} value={d.id}>{d.name}{d.pilot ? " (zona piloto)" : ""}</option>)}
                </select>
              </div>
              <div className="row">
                {zones.map((z) => (
                  <button key={z.id} className="btn-secondary" onClick={() => goToZone(z.districts[z.districts.length - 1])}>Ir a {z.name} (piloto)</button>
                ))}
                <button className="btn-secondary" onClick={useMyLocation}>Usar mi ubicación</button>
                {loadingRegions && <span className="spinner" aria-label="Cargando límites" />}
              </div>
              {geoMsg && <div className="notice notice-info" role="status">{geoMsg}</div>}
              {regionError && <div className="notice notice-warn" role="alert">{regionError}</div>}
              {selected && (
                <p className="small muted">
                  {selected.name} · {selected.level} · límites {selected.provenance.provider}, actualizados {selected.provenance.source_update ?? "fecha desconocida"}. {selected.provenance.note}
                </p>
              )}
              {dist && !selected?.pilot && <div className="notice notice-warn">Fuera de la zona piloto faltan fichas locales para recomendar. Puedes explorar el mapa y las fuentes.</div>}
              {selected?.pilot && selected.level === "distrito" && <div className="notice notice-ok">{pilotNote}</div>}
            </div>
          </li>
          <li>
            <h2>Delimita tu terreno</h2>
            <div className="stack">
              <div className="row">
                {!drawing ? (
                  <button className="btn-primary" onClick={startDrawing}>{draft.closed ? "Volver a dibujar" : "Dibujar terreno"}</button>
                ) : (
                  <>
                    <button className="btn-primary" onClick={finishDrawing} disabled={draft.vertices.length < 3}>Terminar ({draft.vertices.length} puntos)</button>
                    <button className="btn-secondary" onClick={() => setDraft((d) => ({ ...d, vertices: d.vertices.slice(0, -1) }))} disabled={!draft.vertices.length}>Deshacer punto</button>
                  </>
                )}
                <button className="linklike" onClick={() => { setDrawing(false); setPicking(true); setDraft((d) => ({ ...d, mode: "manual", vertices: [], closed: false })); }}>
                  No puedo dibujar: indicar ubicación y área
                </button>
              </div>
              {drawing && <p className="hint">Haz clic en el mapa en cada esquina de tu terreno y pulsa «Terminar».</p>}
              {draft.mode === "dibujo" && area && (
                <div className="notice notice-ok" role="status">
                  Área estimada: <strong>{fmtNumber(area.area_ha, 2)} ha</strong> <span className="small">({area.method})</span>
                  {area.district ? <> · Distrito {area.district.name}</> : <> · Fuera de los distritos precargados</>}
                </div>
              )}
              {areaError && <div className="notice notice-bad" role="alert">{areaError}</div>}
              {draft.mode === "manual" && (
                <div className="stack">
                  <p className="hint">{draft.point ? `Ubicación marcada: ${draft.point.lat.toFixed(5)}, ${draft.point.lon.toFixed(5)}.` : "Haz clic en el mapa donde está tu terreno"}{geo && !draft.point && <> o <button className="linklike" onClick={() => setDraft((d) => ({ ...d, point: geo }))}>usa tu ubicación actual</button></>}.</p>
                  <div>
                    <label htmlFor="marea">Área del terreno (ha) <span className="hint">Un punto no delimita la parcela: el área la declaras tú.</span></label>
                    <input id="marea" type="number" min={0.01} step={0.01} value={draft.manualArea} onChange={(e) => setDraft((d) => ({ ...d, manualArea: e.target.value }))} />
                  </div>
                </div>
              )}
              {inPilot === false && <div className="notice notice-warn">Este terreno está fuera de las zonas piloto ({zones.map((z) => z.name).join(" y ")}): podrás guardarlo, pero la aplicación no tiene fichas locales para recomendar allí.</div>}
              {zoneHere && <div className="notice notice-ok" role="status">Zona piloto: {zoneHere.zone}. Se usarán su clima NASA, sus supuestos y su catálogo.</div>}
            </div>
          </li>
          <li>
            <h2>Cuéntanos lo mínimo</h2>
            <div className="field">
              <label htmlFor="pname">Nombre de la parcela <span className="hint">Opcional</span></label>
              <input id="pname" type="text" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <ProfileForm value={draft.profile} onChange={(profile) => setDraft((d) => ({ ...d, profile }))} compact zone={zoneHere} />
            </div>
          </li>
          <li>
            <h2>Compara</h2>
            {formErrors.length > 0 && (
              <div className="notice notice-bad" role="alert">
                <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>{formErrors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}
            <div className="row" style={{ marginTop: "0.5rem" }}>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? "Guardando…" : user ? "Guardar y comparar" : "Iniciar sesión para guardar y comparar"}
              </button>
              <Link href="/demo">o mira el caso de demostración</Link>
            </div>
            {!user && <p className="hint">Tu dibujo y respuestas se conservan mientras inicias sesión.</p>}
          </li>
        </ol>
      </section>
      <section aria-label="Mapa" className="map-col">
        <div className="map-wrap">
          <MapView
            focus={focus}
            regions={visibleChildren}
            selectedId={dist || prov || dep || null}
            onRegionClick={onRegionClick}
            drawing={drawing}
            draft={draft.vertices}
            closed={draft.closed}
            onAddVertex={(ll) => setDraft((d) => ({ ...d, vertices: [...d.vertices, ll] }))}
            parcels={myParcels.map((p) => ({ id: p.id, name: p.name ?? "", geometry: p.geometry, point: p.point }))}
            userPoint={geo}
            pinPoint={draft.mode === "manual" ? draft.point : null}
            picking={picking && draft.mode === "manual"}
            onPick={(ll) => setDraft((d) => ({ ...d, point: { lon: ll[0], lat: ll[1] } }))}
          />
        </div>
        <p className="small muted" style={{ marginTop: "0.5rem" }}>
          Haz clic en una zona del mapa para acercarte. Verde: zona piloto. Los límites son referenciales, no catastro.
        </p>
      </section>
    </div>
  );
}
