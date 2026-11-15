"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Chat } from "@/components/Chat";
import { Comparison, StatusBadge } from "@/components/Comparison";
import { ProfileForm, validateProfile } from "@/components/ProfileForm";
import { useSession } from "@/components/SessionProvider";
import { SourceChips } from "@/components/Sources";
import { ApiError, api, fmtDate, fmtDateTime, fmtNumber } from "@/lib/api";
import { CROP_LABELS, PRIORITY_LABELS, type CropEvent, type Parcel, type Profile, type Revision, type Run } from "@/lib/types";
import { useZones } from "@/lib/zones";

interface ParcelDetail extends Parcel {
  profile: Revision | null;
  crop_events: CropEvent[];
  soil_observations: { id: string; sampled_on: string; depth_cm: string; method: string; parameters: Record<string, { value: number; unit: string }>; origin: string }[];
  management: { id: string; kind: string; description: string; quantity: number | null; unit: string | null; applied_on: string | null; cost_soles: number | null }[];
}

function describeProfile(p: Profile): string[] {
  return [
    `Cultivo: ${CROP_LABELS[p.current_crop_id] ?? p.current_crop_id} (${p.current_status === "en_campo" ? `en campo, cosecha prevista ${fmtDate(p.expected_harvest)}` : "cosechado"})`,
    `Agua: ${p.water.mode === "no_se" ? "no sé" : `${fmtNumber(p.water.allocation_m3 ?? null)} m³ por ${p.water.allocation_period === "anual" ? "año" : "mes"}, eficiencia ${p.water.efficiency ?? "desconocida"}`}${p.water.origin === "supuesto_demo" ? " (supuesto de demostración)" : ""}`,
    `Suelo: ${p.soil.ece_ds_m != null ? `CE ${p.soil.ece_ds_m} dS/m` : "salinidad desconocida"}${p.soil.ph != null ? `, pH ${p.soil.ph}` : ""}${p.soil.kind === "supuesto_demo" ? " (supuesto de demostración)" : ""}`,
    `Prioridad: ${PRIORITY_LABELS[p.priority]}${p.budget_soles != null ? ` · capital S/ ${fmtNumber(p.budget_soles)}` : ""}`,
  ];
}

export default function ParcelPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading, refresh } = useSession();
  const [parcel, setParcel] = useState<ParcelDetail | null>(null);
  const { zones } = useZones();
  const zone = zones.find((z) => z.id === parcel?.zone_id) ?? null;
  const [runs, setRuns] = useState<Run[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftProfile, setDraftProfile] = useState<Profile | null>(null);
  const [formErr, setFormErr] = useState<string[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  // escenario
  const [scWater, setScWater] = useState<string>("");
  const [scNoSe, setScNoSe] = useState(false);
  const [scEff, setScEff] = useState<string>("");
  const [scPrio, setScPrio] = useState<string>("");
  const [scHarvest, setScHarvest] = useState<string>("");
  // registros
  const [harvestDate, setHarvestDate] = useState("");
  const [soil, setSoil] = useState({ sampled_on: "", depth_cm: "0-30", method: "", ece_ds_m: "", ph: "", organic_matter_pct: "" });
  const [mgmt, setMgmt] = useState({ kind: "abono", description: "", quantity: "", unit: "kg", applied_on: "", cost_soles: "" });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, rs, revs] = await Promise.all([
        api<ParcelDetail>(`/parcels/${id}`),
        api<{ items: Run[] }>(`/parcels/${id}/recommendations`),
        api<{ items: Revision[] }>(`/parcels/${id}/profile-revisions`),
      ]);
      setParcel(p);
      setRuns(rs.items);
      setRevisions(revs.items);
      if (rs.items[0]) setRun(await api<Run>(`/recommendations/${rs.items[0].id}`));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "Parcela no encontrada." : e instanceof ApiError ? e.message : "Error al cargar");
    }
  }, [id]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/ingresar?volver=/parcelas/${id}`);
      return;
    }
    load();
  }, [user, loading, load, router, id]);

  const openRun = async (rid: string) => setRun(await api<Run>(`/recommendations/${rid}`));

  const recompute = async (scenario: Record<string, unknown> | null) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<Run>(`/parcels/${id}/recommendations`, { method: "POST", json: scenario ? { scenario } : {} });
      setRun(r);
      setRuns((xs) => [r, ...xs]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo recalcular");
    } finally {
      setBusy(false);
    }
  };

  const simulate = () => {
    const sc: Record<string, unknown> = {};
    if (scNoSe) sc.water_mode = "no_se";
    else if (scWater) sc.allocation_m3 = Number(scWater);
    if (scEff) sc.efficiency = Number(scEff.replace(",", "."));
    if (scPrio) sc.priority = scPrio;
    if (scHarvest) sc.expected_harvest = scHarvest;
    recompute(Object.keys(sc).length ? sc : null);
  };

  const saveProfile = async () => {
    if (!draftProfile) return;
    const errs = validateProfile(draftProfile);
    setFormErr(errs);
    if (errs.length) return;
    try {
      await api(`/parcels/${id}/profile-revisions`, { method: "POST", json: { profile: draftProfile, note: "Actualización del perfil" } });
      setEditing(false);
      await load();
      await recompute(null);
      setMsg("Perfil guardado como nueva revisión y comparación recalculada. Las comparaciones anteriores conservan sus datos.");
    } catch (e) {
      setFormErr([e instanceof ApiError ? e.message : "No se pudo guardar"]);
    }
  };

  const post = async (path: string, body: unknown, ok: string) => {
    setMsg(null);
    setError(null);
    try {
      await api(`/parcels/${id}/${path}`, { method: "POST", json: body });
      setMsg(ok);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message + (e.details ? ": " + e.details.map((d) => d.field).join(", ") : "") : "No se pudo registrar");
    }
  };

  const remove = async () => {
    if (!confirm("¿Eliminar esta parcela? Dejará de ser accesible junto con sus comparaciones.")) return;
    await api(`/parcels/${id}`, { method: "DELETE" });
    await refresh();
    router.push("/parcelas");
  };

  if (error && !parcel) return <div className="card"><p>{error}</p><Link href="/parcelas">Volver a mis parcelas</Link></div>;
  if (!parcel) return <p className="muted">Cargando parcela…</p>;
  const profile = parcel.profile?.profile;
  const n = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>{parcel.name || "Parcela sin nombre"}</h1>
          <div className="row">
            <Link href="/parcelas">Mis parcelas</Link>
            <button className="btn-danger" onClick={remove}>Eliminar</button>
          </div>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {fmtNumber(parcel.area_ha, 2)} ha ({parcel.area_origin === "geodesica" ? "área calculada del dibujo" : "área declarada"}) · {parcel.region_codes.district_name ?? "distrito no identificado"} ·{" "}
          {zone ? `Zona piloto ${zone.name}` : parcel.in_pilot_zone ? "Zona piloto" : "Fuera de las zonas piloto"}
        </p>
        {msg && <div className="notice notice-ok" role="status">{msg}</div>}
        {error && <div className="notice notice-bad" role="alert">{error}</div>}
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="card stack" aria-labelledby="sim-title">
          <h2 id="sim-title">Simular otro escenario</h2>
          <p className="small muted" style={{ margin: 0 }}>Crea una nueva comparación sin cambiar tu perfil guardado. La anterior se conserva en el historial.</p>
          <div className="grid-2">
            <div>
              <label htmlFor="scw">Agua por mes (m³)</label>
              <input id="scw" type="number" min={0} step={500} value={scWater} disabled={scNoSe} placeholder={profile?.water.allocation_m3 != null ? String(profile.water.allocation_m3) : "no sé"} onChange={(e) => setScWater(e.target.value)} />
              <label className="small" style={{ fontWeight: 400, marginTop: 4 }}><input type="checkbox" checked={scNoSe} onChange={(e) => setScNoSe(e.target.checked)} /> Simular «no sé»</label>
            </div>
            <div>
              <label htmlFor="sce">Eficiencia (0–1)</label>
              <input id="sce" type="number" min={0.1} max={1} step={0.01} value={scEff} placeholder={profile?.water.efficiency != null ? String(profile.water.efficiency) : "desconocida"} onChange={(e) => setScEff(e.target.value)} />
            </div>
            <div>
              <label htmlFor="scp">Prioridad</label>
              <select id="scp" value={scPrio} onChange={(e) => setScPrio(e.target.value)}>
                <option value="">La de mi perfil ({profile ? PRIORITY_LABELS[profile.priority] : "—"})</option>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sch">Fecha de cosecha actual</label>
              <input id="sch" type="date" value={scHarvest} onChange={(e) => setScHarvest(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <button className="btn-primary" onClick={simulate} disabled={busy}>{busy ? "Calculando…" : "Recalcular comparación"}</button>
            <button className="btn-secondary" onClick={() => recompute(null)} disabled={busy}>Recalcular con mi perfil</button>
          </div>
        </section>

        <section className="card stack" aria-labelledby="hist-title">
          <h2 id="hist-title">Historial de comparaciones</h2>
          {runs.length === 0 && <p className="muted">Sin comparaciones todavía.</p>}
          <div className="table-scroll">
            <table>
              <thead><tr><th>Fecha</th><th>Escenario</th><th>A</th><th>B</th><th>C</th><th /></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} aria-current={run?.id === r.id ? "true" : undefined} style={run?.id === r.id ? { background: "var(--brand-soft)" } : undefined}>
                    <td className="small">{fmtDateTime(r.created_at)}</td>
                    <td className="small">{r.scenario_label ?? "Perfil guardado"} · {PRIORITY_LABELS[r.priority] ?? r.priority}</td>
                    {["A", "B", "C"].map((k) => <td key={k}>{r.statuses[k] ? <StatusBadge status={r.statuses[k]} /> : "—"}</td>)}
                    <td><button className="btn-ghost" onClick={() => openRun(r.id)}>{run?.id === r.id ? "Abierta" : "Abrir"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {run?.result && (
        <>
          {run.profile_changed && <div className="notice notice-warn">Tu perfil cambió después de esta comparación. <button className="linklike" onClick={() => recompute(null)}>Recalcular con el perfil actual</button></div>}
          <div className="card small">
            <strong>Evidencia NASA de esta comparación:</strong> {run.dataset_snapshot_id ? <>instantánea <code>{run.dataset_snapshot_id}</code> (SHA-256 {run.dataset_sha256?.slice(0, 12)}…), NASA POWER diaria 2015–2025, celda regional; clima histórico, no pronóstico.</> : "no disponible (agua pendiente)."}{" "}
            <SourceChips ids={["NASA-POWER", "FAO56-PM"]} /> · motor {run.engine_version} · catálogo {run.catalog_version}
            {run.scenario_label && <> · escenario: {run.scenario_label}</>}
          </div>
          <Comparison key={run.id} result={run.result} />
          {parcel.in_pilot_zone && <Chat parcelId={parcel.id} runId={run.id} runLabel={`${fmtDateTime(run.created_at)}${run.scenario_label ? ` · ${run.scenario_label}` : ""}`} />}
        </>
      )}

      <section className="card stack" aria-labelledby="perfil-title">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 id="perfil-title" style={{ margin: 0 }}>Perfil de la parcela {parcel.profile && <span className="small muted">(revisión {parcel.profile.number})</span>}</h2>
          {!editing && profile && <button className="btn-secondary" onClick={() => { setDraftProfile(profile); setEditing(true); }}>Actualizar perfil</button>}
        </div>
        {profile && !editing && <ul>{describeProfile(profile).map((l) => <li key={l}>{l}</li>)}</ul>}
        {editing && draftProfile && (
          <div className="stack">
            <ProfileForm value={draftProfile} onChange={setDraftProfile} zone={zone} />
            {formErr.length > 0 && <div className="notice notice-bad" role="alert">{formErr.join(" ")}</div>}
            <div className="row">
              <button className="btn-primary" onClick={saveProfile}>Guardar nueva revisión</button>
              <button className="btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </div>
        )}
        <details>
          <summary>Revisiones anteriores ({revisions.length})</summary>
          <ul>
            {revisions.map((r) => <li key={r.id}><strong>#{r.number}</strong> · {fmtDateTime(r.created_at)} · {r.note ?? ""}<div className="small muted">{describeProfile(r.profile).join(" · ")}</div></li>)}
          </ul>
        </details>
      </section>

      <div className="grid-3">
        <section className="card stack" aria-labelledby="h-cosecha">
          <h3 id="h-cosecha">Registrar cosecha</h3>
          <p className="small muted">Se conserva el antecedente y se crea una nueva revisión del perfil.</p>
          <label htmlFor="hd">Fecha real de cosecha</label>
          <input id="hd" type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
          <button className="btn-secondary" disabled={!harvestDate || !profile} onClick={() => profile && post("crop-events", { crop_id: profile.current_crop_id, status: "cosechado", actual_harvest: harvestDate }, "Cosecha registrada.")}>Registrar</button>
          <details>
            <summary>Historial de cultivos ({parcel.crop_events.length})</summary>
            <ul className="small">{parcel.crop_events.map((e) => <li key={e.id}>{CROP_LABELS[e.crop_id] ?? e.crop_id} · {e.status === "cosechado" ? `cosechado ${fmtDate(e.actual_harvest)}` : `en campo${e.expected_harvest ? `, cosecha prevista ${fmtDate(e.expected_harvest)}` : ""}`} · {e.origin}</li>)}</ul>
          </details>
        </section>

        <section className="card stack" aria-labelledby="h-suelo">
          <h3 id="h-suelo">Análisis de suelo</h3>
          <div className="grid-2">
            <div><label htmlFor="so1">Fecha de muestreo</label><input id="so1" type="date" value={soil.sampled_on} onChange={(e) => setSoil({ ...soil, sampled_on: e.target.value })} /></div>
            <div><label htmlFor="so2">Profundidad (cm)</label><input id="so2" type="text" value={soil.depth_cm} onChange={(e) => setSoil({ ...soil, depth_cm: e.target.value })} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label htmlFor="so3">Método / laboratorio</label><input id="so3" type="text" value={soil.method} onChange={(e) => setSoil({ ...soil, method: e.target.value })} /></div>
            <div><label htmlFor="so4">CE (dS/m)</label><input id="so4" type="number" step={0.1} value={soil.ece_ds_m} onChange={(e) => setSoil({ ...soil, ece_ds_m: e.target.value })} /></div>
            <div><label htmlFor="so5">pH</label><input id="so5" type="number" step={0.1} value={soil.ph} onChange={(e) => setSoil({ ...soil, ph: e.target.value })} /></div>
          </div>
          <button className="btn-secondary" disabled={!soil.sampled_on || !soil.method} onClick={() => post("soil-observations", { sampled_on: soil.sampled_on, depth_cm: soil.depth_cm, method: soil.method, ece_ds_m: n(soil.ece_ds_m), ph: n(soil.ph), organic_matter_pct: n(soil.organic_matter_pct) }, "Análisis registrado; se creó una nueva revisión del perfil.")}>Registrar análisis</button>
          <ul className="small">{parcel.soil_observations.map((o) => <li key={o.id}>{fmtDate(o.sampled_on)} · {o.depth_cm} cm · {o.method} · {Object.entries(o.parameters).map(([k, v]) => `${k.split("_")[0]} ${v.value} ${v.unit}`).join(", ")}</li>)}</ul>
        </section>

        <section className="card stack" aria-labelledby="h-manejo">
          <h3 id="h-manejo">Abonos y manejo</h3>
          <div className="grid-2">
            <div><label htmlFor="m1">Tipo</label><select id="m1" value={mgmt.kind} onChange={(e) => setMgmt({ ...mgmt, kind: e.target.value })}><option value="abono">Abono</option><option value="fertilizante">Fertilizante</option><option value="residuos">Residuos</option><option value="otro">Otro</option></select></div>
            <div><label htmlFor="m2">Fecha</label><input id="m2" type="date" value={mgmt.applied_on} onChange={(e) => setMgmt({ ...mgmt, applied_on: e.target.value })} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label htmlFor="m3">Descripción</label><input id="m3" type="text" value={mgmt.description} onChange={(e) => setMgmt({ ...mgmt, description: e.target.value })} /></div>
            <div><label htmlFor="m4">Cantidad</label><input id="m4" type="number" value={mgmt.quantity} onChange={(e) => setMgmt({ ...mgmt, quantity: e.target.value })} /></div>
            <div><label htmlFor="m5">Costo (S/)</label><input id="m5" type="number" value={mgmt.cost_soles} onChange={(e) => setMgmt({ ...mgmt, cost_soles: e.target.value })} /></div>
          </div>
          <button className="btn-secondary" disabled={mgmt.description.length < 2} onClick={() => post("management", { kind: mgmt.kind, description: mgmt.description, quantity: n(mgmt.quantity), unit: mgmt.unit, applied_on: mgmt.applied_on || null, cost_soles: n(mgmt.cost_soles) }, "Registro de manejo guardado.")}>Registrar</button>
          <ul className="small">{parcel.management.map((r) => <li key={r.id}>{r.kind}: {r.description}{r.quantity != null ? ` · ${r.quantity} ${r.unit ?? ""}` : ""}{r.applied_on ? ` · ${fmtDate(r.applied_on)}` : ""}{r.cost_soles != null ? ` · S/ ${fmtNumber(r.cost_soles)}` : ""}</li>)}</ul>
          <p className="hint">Se registran como antecedentes declarados; no se calcula una dosis sin análisis y reglas revisadas.</p>
        </section>
      </div>
    </div>
  );
}
