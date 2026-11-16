"use client";

// Campo verificado → perfil mínimo → opciones y explicaciones en capas.
// Sin cuenta: comparación pública que no guarda nada. Con cuenta: parcela, revisiones y runs (R03, R06).

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { HelpProvider, Term } from "@/components/simple/help";
import { FieldSetup, measureField } from "@/components/simple/FieldSetup";
import { MoreDetails } from "@/components/simple/more";
import { Icon, Tip } from "@/components/simple/icons";
import { MarketPanel } from "@/components/simple/market";
import { AssociationOptions, GlobalQuestions, OptionCard, WhySheet, countQuestions, shortNames, type ResultAnswerPatch } from "@/components/simple/results";
import { WATER_NAME, Wizard, cropName, type Answers } from "@/components/simple/wizard";
import s from "@/components/simple/simple.module.css";
import { SowingWindow } from "@/components/SowingWindow";
import { ApiError, api, fmtDate, fmtNumber } from "@/lib/api";
import type { ComparisonResult, FieldContext, Parcel, Profile, Revision, Run, Strategy } from "@/lib/types";
import { CROP_LABELS } from "@/lib/types";
import { readTierra } from "@/lib/tierra";
import { useZones } from "@/lib/zones";

const PENDING = "ceres:sencillo:pendiente";
const EMPTY: Answers = { crop: null, status: null, harvest: null, availability: null, streak: null };

type Patch = ResultAnswerPatch;

function toProfile(a: Answers, base?: Profile | null): Profile {
  // Lo que respondiste en «Mi chacra → ¿Cómo está tu tierra?» (sin cuenta) se usa aquí.
  const t = base ? {} : readTierra();
  return {
    current_crop_id: a.crop ?? "",
    current_crop_streak: a.streak,
    current_status: a.status ?? "cosechado",
    expected_harvest: a.status === "en_campo" ? a.harvest : null,
    planned_next_crop_id: base?.planned_next_crop_id ?? null,
    water: { mode: "no_se", availability: a.availability, ...(base?.water.method ? { method: base.water.method } : t.method ? { method: t.method } : {}) },
    soil: base?.soil ?? { ...(t.salinity_signs !== undefined ? { salinity_signs: t.salinity_signs } : {}), ...(t.photo_assessment ? { photo_assessment: t.photo_assessment } : {}) },
    priority: "dinero",
    budget_soles: base?.budget_soles ?? null,
    residue_management: base?.residue_management ?? "no_se",
    economic_overrides: base?.economic_overrides ?? [],
    use_zone_defaults: true,
  };
}

function fromProfile(p: Profile): Answers {
  return { crop: p.current_crop_id, status: p.current_status, harvest: p.expected_harvest ?? null, availability: p.water.availability ?? null, streak: p.current_crop_streak ?? null };
}

function applyPatch(p: Profile, patch: Patch): Profile {
  const out = JSON.parse(JSON.stringify(p)) as Profile & Record<string, Record<string, unknown>>;
  for (const [path, value] of Object.entries(patch)) {
    const [head, tail] = path.split(".");
    if (tail) (out[head] ??= {})[tail] = value;
    else (out as Record<string, unknown>)[head] = value;
  }
  // Una respuesta sobre el agua sustituye al supuesto de zona.
  if ("water.allocation_min_m3" in patch || "water.allocation_max_m3" in patch) {
    out.water = { ...out.water, mode: "no_se", allocation_m3: null };
  }
  return out;
}

/** Resumen para WhatsApp: opciones en el mismo orden, con nivel y cifras; sin datos personales. */
function shareText(result: ComparisonResult, ordered: Strategy[], zoneName: string, area: number, crop: string, cropLabel: (id: string) => string): string {
  const lines = ordered.map((st, i) => {
    const f = st.simple?.facts;
    const r = f?.risk;
    const money = f?.margin_soles != null ? ` · margen bruto estimado S/ ${fmtNumber(f.margin_soles)}${st.simple?.level === "explorar" ? " (sin validar)" : ""}` : "";
    const range = r && st.simple?.level !== "explorar" ? ` (rango simulado del margen S/ ${fmtNumber(r.p10_soles)}–${fmtNumber(r.p90_soles)})` : "";
    const lead = st.risk?.role === "sugerido" ? " ⭐ plan sugerido" : "";
    return `${i + 1}. ${shortNames(st, cropLabel)} — ${st.simple?.label ?? ""}${money}${range}${lead}`;
  });
  return [
    `CERES · Qué sembrar después de mi ${crop || "cultivo"} (${zoneName}, ${fmtNumber(area, area % 1 ? 1 : 0)} ha, 24 meses):`,
    ...lines,
    ...result.associations.map((a) => `Policultivo por explorar: ${a.name}. Agua y margen pendientes de validación conjunta.`),
    "Clima: NASA POWER 2015–2025. Precios, rendimientos y costos según los datos y supuestos citados en cada opción. Margen = ventas menos costos directos; no es ganancia neta garantizada.",
    typeof window !== "undefined" ? `${window.location.origin}/app` : "",
  ].filter(Boolean).join("\n");
}

interface View {
  result: ComparisonResult;
  assumed: string[];
  area: number;
  profile: Profile;
}

export default function SimpleApp() {
  const router = useRouter();
  const { user, loading, activeParcelId, refresh } = useSession();
  const { zones, engineVersion, error: zonesError } = useZones();
  const [field, setField] = useState<FieldContext | null>(null);
  const fieldRef = useRef<FieldContext | null>(null);
  const zone = zones.find((z) => z.id === field?.zone_id) ?? null;
  const [mode, setMode] = useState<"loading" | "field" | "outside" | "wizard" | "results">("loading");
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState(0);
  const [view, setView] = useState<View | null>(null);
  const areaHa = field?.area_ha ?? 0;
  const [parcelId, setParcelId] = useState<string | null>(null);
  const [baseProfile, setBaseProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<{ parcelId: string; runId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [why, setWhy] = useState<Strategy | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const useField = useCallback((next: FieldContext | null) => {
    fieldRef.current = next;
    setField(next);
  }, []);

  const showRun = useCallback((run: Run, parcelId: string) => {
    const actual = fieldRef.current;
    if (!actual?.zone_id || !run.result || !run.inputs) return;
    // Un run antiguo conserva su área: no atribuir sus cifras a un contorno corregido.
    if (!engineVersion || run.engine_version !== engineVersion || !run.inputs.field_verified || !actual.geometry_sha256 || run.inputs.field_context?.geometry_sha256 !== actual.geometry_sha256 || run.inputs.zone_id !== actual.zone_id || Math.abs(run.inputs.area_ha - actual.area_ha) / actual.area_ha > 0.01) {
      setAnswers(fromProfile(run.inputs.profile));
      setBaseProfile(run.inputs.profile);
      setSaved(null);
      setView(null);
      setStep(0);
      setMode("wizard");
      setErr("Este resultado usa otro motor o un contorno sin verificar o distinto. Confirma tus respuestas para recalcular con tu campo actual; el resultado anterior se conserva.");
      return;
    }
    setView({ result: run.result, assumed: run.inputs.assumed ?? [], area: run.inputs.area_ha, profile: run.inputs.profile });
    setAnswers(fromProfile(run.inputs.profile));
    setSaved({ parcelId, runId: run.id });
    setMode("results");
  }, [engineVersion]);

  const createSaved = useCallback(async (profile: Profile, context: FieldContext) => {
    const verified = await measureField(context.geometry);
    useField(verified);
    const p = await api<Parcel>("/parcels", { method: "POST", json: { name: verified.zone_name ? `Mi chacra (${verified.zone_name})` : "Mi campo", geometry: verified.geometry, profile } });
    setParcelId(p.id);
    if (verified.zone_id) {
      const run = await api<Run>(`/parcels/${p.id}/recommendations`, { method: "POST", json: {} });
      showRun(run, p.id);
    } else router.push("/app/cuaderno");
    sessionStorage.removeItem(PENDING);
    await refresh();
  }, [refresh, router, showRun, useField]);

  // Arranque: guardado pendiente tras login → parcela activa con resultado → asistente.
  useEffect(() => {
    if (loading || (!engineVersion && !zonesError)) return;
    let cancelled = false;
    (async () => {
      try {
        const pending = sessionStorage.getItem(PENDING);
        if (user && pending) {
          const { profile, field: pendingField } = JSON.parse(pending) as { profile: Profile; field?: FieldContext };
          if (!pendingField?.geometry) {
            sessionStorage.removeItem(PENDING);
            setErr("Tu consulta anterior no tenía contorno. Delimita el campo para continuar.");
            setMode("field");
            return;
          }
          setBusy(true);
          await createSaved(profile, pendingField);
          return;
        }
        if (user && activeParcelId) {
          const parcel = await api<Parcel & { profile: Revision | null }>(`/parcels/${activeParcelId}`);
          if (cancelled) return;
          setParcelId(parcel.id);
          setBaseProfile(parcel.profile?.profile ?? null);
          if (parcel.profile) setAnswers(fromProfile(parcel.profile.profile));
          if (!parcel.geometry || parcel.geometry.type !== "Polygon") {
            useField(null);
            setMode("field");
            return;
          }
          const actual = await measureField(parcel.geometry);
          if (cancelled) return;
          useField(actual);
          if (!actual.zone_id) { setMode("outside"); return; }
          const runs = await api<{ items: Run[] }>(`/parcels/${activeParcelId}/recommendations`);
          if (runs.items[0]) {
            const run = await api<Run>(`/recommendations/${runs.items[0].id}`);
            if (run.result?.simple_order) return showRun(run, activeParcelId);
          }
          setMode("wizard");
          return;
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "No se pudo cargar tu campo. Inténtalo otra vez.");
      } finally {
        setBusy(false);
      }
      if (!cancelled) setMode((m) => (m === "loading" ? "field" : m));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id, activeParcelId, engineVersion, zonesError]);

  const compute = async (profile: Profile, areaHa: number) => {
    if (!field?.zone_id || !zone || (!profile.water.availability && profile.water.allocation_m3 == null && profile.water.allocation_min_m3 == null && profile.water.allocation_max_m3 == null)) {
      setErr("Delimita un campo dentro del piloto y responde cuánta agua tienes antes de comparar.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const targetParcelId = parcelId ?? activeParcelId;
      if (user && targetParcelId) {
        setParcelId(targetParcelId);
        await api(`/parcels/${targetParcelId}`, { method: "PATCH", json: { geometry: field.geometry } });
        await api(`/parcels/${targetParcelId}/profile-revisions`, { method: "POST", json: { profile, note: "Modo sencillo" } });
        const run = await api<Run>(`/parcels/${targetParcelId}/recommendations`, { method: "POST", json: {} });
        showRun(run, targetParcelId);
      } else {
        const r = await api<{ result: ComparisonResult; inputs: { assumed: string[]; area_ha: number } }>("/public/quick-compare", { method: "POST", json: { profile, geometry: field.geometry, area_ha: areaHa, zone_id: field.zone_id } });
        setView({ result: r.result, assumed: r.inputs.assumed, area: r.inputs.area_ha, profile });
        setAnswers(fromProfile(profile));
        setMode("results");
      }
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "No se pudo calcular. Revisa tu conexión e inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  };

  const onWizardDone = (a: Answers) => {
    setAnswers(a);
    compute(toProfile(a, view?.profile ?? baseProfile), areaHa);
  };

  const acceptField = async (next: FieldContext) => {
    setBusy(true);
    setErr(null);
    try {
      let targetParcelId = parcelId ?? activeParcelId;
      if (!targetParcelId) {
        try {
          const me = await api<{ user: { id: string; email: string }; active_parcel_id: string | null }>("/me");
          targetParcelId = me.active_parcel_id;
          if (targetParcelId) setParcelId(targetParcelId);
        } catch {}
      }
      if (targetParcelId) await api(`/parcels/${targetParcelId}`, { method: "PATCH", json: { geometry: next.geometry } });
      useField(next);
      setView(null);
      setSaved(null);
      setStep(0);
      setMode(next.zone_id ? "wizard" : "outside");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar el contorno.");
    } finally { setBusy(false); }
  };

  const openNotebook = async () => {
    if (!field) return;
    if (user && parcelId) { router.push("/app/cuaderno"); return; }
    const profile = baseProfile ?? toProfile({ ...EMPTY, crop: "otro", status: "cosechado" });
    if (!user) {
      try { sessionStorage.setItem(PENDING, JSON.stringify({ profile, field })); }
      catch { setErr("No se pudo conservar tu campo para iniciar sesión."); return; }
      router.push("/ingresar?volver=/app");
      return;
    }
    setBusy(true);
    try { await createSaved(profile, field); }
    catch (e) { setErr(e instanceof Error ? e.message : "No se pudo guardar tu campo."); }
    finally { setBusy(false); }
  };

  const onAnswer = (patch: Patch) => {
    if (!view) return;
    compute(applyPatch(view.profile, patch), areaHa);
  };

  // Tu precio en chacra reemplaza al supuesto (mayorista × factor) en todas las opciones.
  const onPrice = (cropId: string, price: number | null) => {
    if (!view) return;
    const rest = (view.profile.economic_overrides ?? []).filter((o) => o.crop_id !== cropId);
    const prev = (view.profile.economic_overrides ?? []).find((o) => o.crop_id === cropId);
    const next = price == null ? (prev ? { ...prev, price_soles_kg: null } : null) : { ...(prev ?? { crop_id: cropId }), price_soles_kg: price };
    const keep = next && (next.price_soles_kg != null || next.yield_t_ha != null || next.variable_cost_soles_ha != null);
    compute({ ...view.profile, economic_overrides: keep ? [...rest, next] : rest }, areaHa);
  };
  const ownPrices = Object.fromEntries((view?.profile.economic_overrides ?? []).filter((o) => o.price_soles_kg != null).map((o) => [o.crop_id, o.price_soles_kg as number]));
  const cropLabel = (id: string) => zone?.crops.find((c) => c.id === id)?.full_name.toLowerCase() ?? CROP_LABELS[id]?.toLowerCase() ?? id;

  const save = async () => {
    if (!view || !field) return;
    if (!user) {
      try {
        sessionStorage.setItem(PENDING, JSON.stringify({ profile: view.profile, field }));
      } catch { setErr("No se pudo conservar tu campo para iniciar sesión. Habilita el almacenamiento del navegador."); return; }
      router.push("/ingresar?volver=/app");
      return;
    }
    setBusy(true);
    try {
      await createSaved(view.profile, field);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const edit = (toStep: number) => {
    setStep(toStep);
    setMode("wizard");
  };

  const restart = () => {
    setSaved(null);
    setView(null);
    setAnswers(EMPTY);
    setParcelId(null);
    setBaseProfile(null);
    fieldRef.current = null;
    setField(null);
    setStep(0);
    setMode("field");
  };

  const result = view?.result;
  const ordered = result ? (result.simple_order ?? result.strategies.map((x) => x.strategy_id)).map((id) => result.strategies.find((x) => x.strategy_id === id)!).filter(Boolean) : [];
  const harvestLabel = answers.status === "en_campo" && answers.harvest ? `Cosecho en ${fmtDate(answers.harvest).replace(/^\d+ /, "")}` : "Ya coseché";

  return (
    <HelpProvider saved={saved}>
      {mode !== "results" && err && <div className={s.error} role="alert">{err}</div>}
      {zonesError && <div className={s.error} role="alert">{zonesError}</div>}
      {(mode === "loading" || (busy && mode !== "results" && mode !== "field")) && (
        <div className={s.loading} role="status"><span className={s.spin} aria-hidden="true" />Preparando tus opciones…</div>
      )}

      {mode === "field" && <FieldSetup initial={field} zones={zones} onContinue={acceptField} busy={busy || loading} />}

      {mode === "outside" && field && <section className={s.panel}>
        <h1 className={`${s.q} ${s.display}`}>Tu campo está fuera de los pilotos</h1>
        <p>{fmtNumber(field.area_ha, 4)} ha · {field.district?.name ?? "Ubicación sin datos locales de siembra"}</p>
        <p>Puedes llevar tu cuaderno y agenda. Aún no tenemos datos locales para mostrar estimaciones en este campo.</p>
        <button className={`${s.btn} ${s.btnPrimary}`} onClick={openNotebook} disabled={busy}>{user ? "Ir a mi cuaderno" : "Crear cuenta y llevar mi cuaderno"}</button>
        <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setMode("field")} disabled={busy}>Revisar contorno</button>
      </section>}

      {mode === "wizard" && !busy && field && (
        <>
          <p className={s.sub}>{fmtNumber(field.area_ha, 4)} ha · {field.zone_name ?? "Zona sin catálogo disponible"} · Área geodésica del contorno</p>
          <button className={s.linkBtn} onClick={() => setMode("field")}>Revisar contorno</button>
          {zone ? <Wizard key={`${step}-${zone.id}`} initial={answers} startStep={step} onDone={onWizardDone} zone={zone} /> : <p role="status">Esperando el catálogo de tu zona. Puedes seguir al <a href="/app/cuaderno">cuaderno</a>.</p>}
        </>
      )}

      {mode === "results" && result && view && (
        <>
          <header className={s.resultHead}>
            <p className={s.stepKicker}>{saved ? "Guardado en tu cuenta" : "Tus opciones"}</p>
            <h1 className={`${s.h1} ${s.display}`}>Qué sembrar después {cropName(zone, answers.crop) ? `de tu ${cropName(zone, answers.crop)}` : ""}</h1>
            <div className={s.chips}>
              <button className={s.chip} onClick={() => edit(0)}>{(cropName(zone, answers.crop) || "Cultivo").replace(/^./, (c) => c.toUpperCase())} ✎</button>
              <button className={s.chip} onClick={() => edit(1)}>{harvestLabel} ✎</button>
              <button className={s.chip} onClick={() => edit(2)}>Agua: {WATER_NAME[answers.availability ?? ""] ?? "por confirmar"} ✎</button>
              <button className={s.chip} onClick={() => edit(3)}>{answers.streak === 1 ? "1 campaña" : answers.streak === 2 ? "2 o más campañas" : "Repetición por confirmar"} ✎</button>
              <button className={s.chip} onClick={() => setMode("field")}>{fmtNumber(areaHa, 4)} ha · Contorno ✎</button>
            </div>
            <div className={s.headMeta}>
              <span>{field?.zone_name} · Área geodésica del contorno · próximos 24 meses</span>
              <Tip tip="Clima de 11 años (2015–2025) de NASA POWER para tu zona. Es historia, no pronóstico."><span className={s.nasaDot}><Icon name="sat" size={14} /> NASA</span></Tip>
              {view.assumed.length > 0 && <Term id="supuesto">Usamos datos típicos de la zona</Term>}
            </div>
          </header>

          {err && <div className={s.error} role="alert">{err}</div>}
          {busy && <div className={s.loading} style={{ padding: "12px 0" }} role="status"><span className={s.spin} aria-hidden="true" />Recalculando…</div>}

          {result.blocking.length > 0 ? (
            <section className={s.panel}>
              <h2 className={s.panelTitle}>Aún no podemos comparar</h2>
              {result.blocking.map((b) => <p key={b} className={s.panelText}>{b}</p>)}
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => edit(0)}>Cambiar mi respuesta</button>
            </section>
          ) : (
            <>
              {countQuestions(result) > 0 && (
                <a href="#preguntas" className={s.nudge}><Icon name="question" size={16} /> Responde {countQuestions(result) === 1 ? "1 pregunta" : `${countQuestions(result)} preguntas`} y afinamos ↓</a>
              )}
              <div className={s.cards}>
                {ordered.map((st) => (
                  <OptionCard key={st.strategy_id} st={st} result={result} onWhy={() => setWhy(st)} busy={busy} cropLabel={cropLabel} areaHa={areaHa} zoneName={field?.zone_name ?? undefined} />
                ))}
              </div>
              <AssociationOptions associations={result.associations} result={result} cropLabel={cropLabel} areaHa={areaHa} zoneName={field?.zone_name ?? undefined} />
              <GlobalQuestions result={result} area={areaHa} onAnswer={onAnswer} busy={busy} />
              {zone && (
                <MarketPanel
                  zone={zone.id}
                  cropIds={[...new Set(ordered.flatMap((x) => x.sequence))]}
                  ownPrices={ownPrices}
                  onPrice={onPrice}
                  busy={busy}
                />
              )}
              {zone && (
                <details className={s.sowSection}>
                  <summary>¿Cuándo me conviene sembrar? <span aria-hidden="true">▾</span></summary>
                  <SowingWindow
                    zone={zone.id}
                    crops={zone.crops.filter((c) => c.in_catalog).map((c) => ({ id: c.id, name: c.name }))}
                    initialCrop={ordered.flatMap((x) => x.sequence).find((c) => zone.crops.some((z) => z.id === c && z.in_catalog))}
                    initialMonth={ordered[0]?.simple?.facts.first_sowing ? Number(ordered[0].simple.facts.first_sowing.slice(5, 7)) : undefined}
                  />
                </details>
              )}
            </>
          )}

          {!saved && (
            <section className={s.saveCard}>
              <h3 className={s.display}>Guarda tu chacra</h3>
              <p>Guarda este resultado y lleva tu cuaderno. Solo tú lo ves.</p>
              <button className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`} onClick={save} disabled={busy}>{user ? "Guardar en mi cuenta" : "Crear cuenta y guardar"}</button>
            </section>
          )}

          {result.blocking.length === 0 && (
            <MoreDetails
              result={result}
              saved={saved}
              zone={zone}
              profile={view.profile}
              busy={busy}
              detailOpen={detailOpen}
              onDetailToggle={setDetailOpen}
              onRecompute={(p) => compute(p, areaHa)}
              onOpenRun={async (id) => { if (saved) showRun(await api<Run>(`/recommendations/${id}`), saved.parcelId); window.scrollTo({ top: 0 }); }}
            />
          )}

          <div className={s.shareRow}>
            <a className={s.iconBtn} href={`https://wa.me/?text=${encodeURIComponent(shareText(result, ordered, zone?.name ?? "", areaHa, cropName(zone, answers.crop), cropLabel))}`} target="_blank" rel="noreferrer" title="Compartir por WhatsApp" aria-label="Compartir por WhatsApp"><Icon name="share" /> WhatsApp</a>
            <button className={s.iconBtn} onClick={() => window.print()} title="Guardar como PDF" aria-label="Guardar como PDF"><Icon name="print" /> PDF</button>
          </div>
          <div className={s.footerActions}>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={restart}>Nueva consulta</button>
          </div>
          <p className={s.sub} style={{ textAlign: "center" }}>Fechas orientativas. El clima es histórico, no un pronóstico. La decisión es tuya.</p>

          <WhySheet
            st={why} profile={view.profile} assumed={view.assumed} area={view.area} zone={zone} onClose={() => setWhy(null)} result={result} cropLabel={cropLabel}
            onMore={() => { setWhy(null); setDetailOpen(true); setTimeout(() => document.getElementById("detalle")?.scrollIntoView({ behavior: "smooth" }), 50); }}
          />
        </>
      )}
    </HelpProvider>
  );
}
