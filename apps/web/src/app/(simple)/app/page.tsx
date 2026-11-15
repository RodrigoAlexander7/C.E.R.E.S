"use client";

// Modo sencillo (R15/R16): 3 preguntas → 3 opciones en palabras simples → «¿Por qué?» en capas.
// Sin cuenta: comparación pública que no guarda nada. Con cuenta: parcela, revisiones y runs (R03, R06).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { HelpProvider, Sheet, Term } from "@/components/simple/help";
import { GlobalQuestions, OptionCard, WhySheet } from "@/components/simple/results";
import { CROP_NAME, PRIORITY_NAME, Wizard, type Answers } from "@/components/simple/wizard";
import s from "@/components/simple/simple.module.css";
import { ApiError, api, fmtDate, fmtNumber } from "@/lib/api";
import type { ComparisonResult, Parcel, Profile, Run, Strategy } from "@/lib/types";

const PENDING = "ceres:sencillo:pendiente";
const MAJES_I = { lat: -16.35, lon: -72.19 }; // ubicación aproximada de la zona piloto (no delimita el lote)
const EMPTY: Answers = { crop: null, status: null, harvest: null, priority: null };

type Patch = Record<string, string | number>;

function toProfile(a: Answers, base?: Profile | null): Profile {
  return {
    current_crop_id: a.crop ?? "maiz_grano",
    current_status: a.status ?? "cosechado",
    expected_harvest: a.status === "en_campo" ? a.harvest : null,
    planned_next_crop_id: base?.planned_next_crop_id ?? null,
    water: base?.water ?? { mode: "no_se" },
    soil: base?.soil ?? {},
    priority: a.priority ?? "equilibrada",
    budget_soles: base?.budget_soles ?? null,
    residue_management: base?.residue_management ?? "no_se",
    economic_overrides: base?.economic_overrides ?? [],
    use_zone_defaults: true,
  };
}

function fromProfile(p: Profile): Answers {
  return { crop: p.current_crop_id, status: p.current_status, harvest: p.expected_harvest ?? null, priority: p.priority };
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

interface View {
  result: ComparisonResult;
  assumed: string[];
  area: number;
  profile: Profile;
}

export default function SimpleApp() {
  const router = useRouter();
  const { user, loading, activeParcelId, refresh } = useSession();
  const [mode, setMode] = useState<"loading" | "wizard" | "results">("loading");
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState(0);
  const [view, setView] = useState<View | null>(null);
  const [area, setArea] = useState(5);
  const [saved, setSaved] = useState<{ parcelId: string; runId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [why, setWhy] = useState<Strategy | null>(null);
  const [areaOpen, setAreaOpen] = useState(false);
  const [areaDraft, setAreaDraft] = useState("5");

  const showRun = useCallback((run: Run, parcelId: string) => {
    if (!run.result || !run.inputs) return;
    setView({ result: run.result, assumed: run.inputs.assumed ?? [], area: run.inputs.area_ha, profile: run.inputs.profile });
    setArea(run.inputs.area_ha);
    setAnswers(fromProfile(run.inputs.profile));
    setSaved({ parcelId, runId: run.id });
    setMode("results");
  }, []);

  const createSaved = useCallback(async (profile: Profile, areaHa: number) => {
    const p = await api<Parcel>("/parcels", { method: "POST", json: { name: "Mi chacra (Majes I)", point: MAJES_I, area_ha: areaHa, profile } });
    const run = await api<Run>(`/parcels/${p.id}/recommendations`, { method: "POST", json: {} });
    await refresh();
    showRun(run, p.id);
  }, [refresh, showRun]);

  // Arranque: guardado pendiente tras login → parcela activa con resultado → asistente.
  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        const pending = sessionStorage.getItem(PENDING);
        if (user && pending) {
          sessionStorage.removeItem(PENDING);
          const { profile, area: a } = JSON.parse(pending) as { profile: Profile; area: number };
          setBusy(true);
          await createSaved(profile, a);
          return;
        }
        if (user && activeParcelId) {
          const runs = await api<{ items: Run[] }>(`/parcels/${activeParcelId}/recommendations`);
          if (runs.items[0]) {
            const run = await api<Run>(`/recommendations/${runs.items[0].id}`);
            if (run.result?.simple_order) return showRun(run, activeParcelId);
          }
        }
      } catch {
        // si falla, se empieza con las preguntas
      } finally {
        setBusy(false);
      }
      setMode((m) => (m === "loading" ? "wizard" : m));
    })();
  }, [loading, user, activeParcelId, createSaved, showRun]);

  const compute = async (profile: Profile, areaHa: number) => {
    setBusy(true);
    setErr(null);
    try {
      if (user && saved) {
        await api(`/parcels/${saved.parcelId}/profile-revisions`, { method: "POST", json: { profile, note: "Modo sencillo" } });
        const run = await api<Run>(`/parcels/${saved.parcelId}/recommendations`, { method: "POST", json: {} });
        showRun(run, saved.parcelId);
      } else {
        const r = await api<{ result: ComparisonResult; inputs: { assumed: string[]; area_ha: number } }>("/public/quick-compare", { method: "POST", json: { profile, area_ha: areaHa } });
        setView({ result: r.result, assumed: r.inputs.assumed, area: r.inputs.area_ha, profile });
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
    compute(toProfile(a, view?.profile), area);
  };

  const onAnswer = (patch: Patch) => {
    if (!view) return;
    compute(applyPatch(view.profile, patch), area);
  };

  const save = async () => {
    if (!view) return;
    if (!user) {
      try {
        sessionStorage.setItem(PENDING, JSON.stringify({ profile: view.profile, area }));
      } catch {}
      router.push("/ingresar?volver=/app");
      return;
    }
    setBusy(true);
    try {
      await createSaved(view.profile, area);
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
    setStep(0);
    setMode("wizard");
  };

  const result = view?.result;
  const ordered = result ? (result.simple_order ?? result.strategies.map((x) => x.strategy_id)).map((id) => result.strategies.find((x) => x.strategy_id === id)!).filter(Boolean) : [];
  const harvestLabel = answers.status === "en_campo" && answers.harvest ? `Cosecho en ${fmtDate(answers.harvest).replace(/^\d+ /, "")}` : "Ya coseché";

  return (
    <HelpProvider saved={saved}>
      {(mode === "loading" || (busy && mode !== "results")) && (
        <div className={s.loading} role="status"><span className={s.spin} aria-hidden="true" />Preparando tus opciones…</div>
      )}

      {mode === "wizard" && !busy && <Wizard key={step} initial={answers} startStep={step} onDone={onWizardDone} />}

      {mode === "results" && result && view && (
        <>
          <header className={s.resultHead}>
            <p className={s.stepKicker}>{saved ? "Guardado en tu cuenta" : "Tus opciones"}</p>
            <h1 className={`${s.h1} ${s.display}`}>Qué sembrar después {CROP_NAME[answers.crop ?? ""] ? `del ${CROP_NAME[answers.crop ?? ""]}` : ""}</h1>
            <div className={s.chips}>
              <button className={s.chip} onClick={() => edit(0)}>{(CROP_NAME[answers.crop ?? ""] ?? "Cultivo").replace(/^./, (c) => c.toUpperCase())} ✎</button>
              <button className={s.chip} onClick={() => edit(1)}>{harvestLabel} ✎</button>
              <button className={s.chip} onClick={() => edit(2)}>{PRIORITY_NAME[answers.priority ?? "equilibrada"]} ✎</button>
              <button className={s.chip} onClick={() => { setAreaDraft(String(area)); setAreaOpen(true); }} disabled={!!saved}>{fmtNumber(area, area % 1 ? 1 : 0)} ha{saved ? "" : " ✎"}</button>
            </div>
            <p className={s.sub}>
              Majes I · clima <Term id="nasa">NASA</Term> 2015–2025 · {result.horizon_start ? `de ${fmtDate(result.horizon_start)} a ${fmtDate(result.horizon_end)}` : ""}.
              {view.assumed.length > 0 && <> Lo que no sabías lo completamos con <Term id="supuesto">supuestos</Term> de la zona.</>}
            </p>
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
              {result.strategies.some((x) => x.decisive?.some((d) => d.id !== "agua")) && (
                <a href="#afinar" className={s.nudge}>Responde {result.strategies.flatMap((x) => x.decisive ?? []).filter((d, i, arr) => d.id !== "agua" && arr.findIndex((y) => y.id === d.id) === i).length} pregunta(s) rápida(s) para afinar estas opciones ↓</a>
              )}
              <div className={s.cards}>
                {ordered.map((st) => (
                  <OptionCard key={st.strategy_id} st={st} result={result} onWhy={() => setWhy(st)} onAnswer={onAnswer} busy={busy} />
                ))}
              </div>
              <GlobalQuestions result={result} onAnswer={onAnswer} busy={busy} />
            </>
          )}

          {!saved && (
            <section className={s.saveCard}>
              <h3 className={s.display}>Guarda tu chacra</h3>
              <p>Con una cuenta guardas este resultado, le preguntas a la IA por qué y, pronto, llevarás tu cuaderno de campo. Nadie más ve tus datos.</p>
              <button className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`} onClick={save} disabled={busy}>{user ? "Guardar en mi cuenta" : "Crear cuenta y guardar"}</button>
            </section>
          )}

          <div className={s.footerActions}>
            <Link href={saved ? `/parcelas/${saved.parcelId}` : "/avanzado"} className={`${s.btn} ${s.btnGhost}`}>Ver detalle en modo avanzado</Link>
            <button className={`${s.btn} ${s.btnGhost}`} onClick={restart}>Nueva consulta</button>
          </div>
          <p className={s.sub} style={{ textAlign: "center" }}>Fechas orientativas. El clima es histórico, no un pronóstico. La decisión es tuya.</p>

          <WhySheet st={why} profile={view.profile} assumed={view.assumed} area={view.area} onClose={() => setWhy(null)} advancedHref={saved ? `/parcelas/${saved.parcelId}` : "/avanzado"} />
          <Sheet open={areaOpen} onClose={() => setAreaOpen(false)} title="¿Cuántas hectáreas tiene tu lote?">
            <form onSubmit={(e) => { e.preventDefault(); const v = Number(areaDraft.replace(",", ".")); if (v > 0 && v <= 10000) { setArea(v); setAreaOpen(false); compute(view.profile, v); } }}>
              <label htmlFor="area" className={s.sub} style={{ display: "block", marginTop: 0 }}>Cambia márgenes y volúmenes; no la viabilidad por hectárea.</label>
              <input id="area" inputMode="decimal" value={areaDraft} onChange={(e) => setAreaDraft(e.target.value)} style={{ width: "100%", minHeight: 52, fontSize: "1.3rem", borderRadius: 14, border: "1.5px solid #e0d7c3", padding: "0 14px", margin: "10px 0 14px" }} />
              <button className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`} type="submit">Recalcular</button>
            </form>
          </Sheet>
        </>
      )}
    </HelpProvider>
  );
}
