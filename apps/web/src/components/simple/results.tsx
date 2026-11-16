"use client";

import { useState } from "react";
import { NasaBadge } from "@/components/NasaBadge";
import { SourceChips } from "@/components/Sources";
import { fmtDate, fmtNumber } from "@/lib/api";
import type { ComparisonResult, Decisive, NutritionImpact, Profile, Strategy } from "@/lib/types";
import { METHOD_LABEL, type Zone } from "@/lib/zones";
import { Sheet, Term } from "./help";
import { CropIllustration, CropPlanVisual } from "./CropPlanVisual";
import { SoilPhotoCapture, type SoilPhotoAssessment } from "./SoilPhotoCapture";
import { Icon, MoreButton, Tip } from "./icons";
import s from "./simple.module.css";

const LEVEL_ICON: Record<string, string> = { buena: "check", posible: "question", explorar: "explore", sin_datos: "dots", no_conviene: "cross" };
const LEVEL_TIP: Record<string, string> = {
  buena: "Cumple con tu agua y tu suelo según lo que nos dijiste.",
  posible: "Puede funcionar: confirma el dato que falta (por ejemplo, tu agua).",
  explorar: "Idea con potencial, aún sin probar en tu zona. Tómala como exploración.",
  sin_datos: "Todavía no tenemos datos de este cultivo para calcularlo.",
  no_conviene: "No cumple una condición importante (agua, sal o clima).",
};

function optionLevel(st: Strategy) {
  if (st.simple?.level === "buena" && st.status === "no_viable") return "no_conviene";
  return st.simple?.level ?? (st.status === "no_viable" ? "no_conviene" : st.status === "exploratoria" ? "explorar" : "sin_datos");
}

const LEVEL_LABEL: Record<string, string> = { buena: "Buena opción con supuestos", posible: "Posible, confirma", explorar: "Por explorar", sin_datos: "Faltan datos", no_conviene: "No conviene" };

export function LevelBadge({ st }: { st: Strategy }) {
  const lvl = optionLevel(st);
  return (
    <Tip tip={LEVEL_TIP[lvl]} className={s.badge}>
      <b aria-hidden="true"><Icon name={LEVEL_ICON[lvl]} size={12} /></b>
      {LEVEL_LABEL[lvl]}
    </Tip>
  );
}

const soles = (v: number) => (v < 0 ? `−S/ ${fmtNumber(-v)}` : `S/ ${fmtNumber(v)}`);
const hasArea = (area?: number | null): area is number => typeof area === "number" && Number.isFinite(area) && area > 0;
const finite = (v?: number | null): v is number => typeof v === "number" && Number.isFinite(v);
const metric = (st: Strategy, suffix: string) => st.metrics[`${st.strategy_id}.${suffix}`];

/** El título identifica cultivos; las repeticiones y fechas se explican por campaña. */
export function shortNames(st: Strategy, cropLabel: (id: string) => string): string {
  const txt = [...new Set(st.sequence)].map(cropLabel).join(" y ") || st.name || "Plan de cultivo pendiente";
  return txt.replace(/^./, (c) => c.toUpperCase());
}
const listEs = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} o ${xs[xs.length - 1]}`);

/** El precio de equilibrio cubre costos directos del escenario, no todos los gastos. */
function BreakevenLine({ st, cropLabel }: { st: Strategy; cropLabel: (id: string) => string }) {
  const be = st.simple?.facts.breakeven;
  if (!finite(be?.price_soles_kg)) return null;
  return (
    <p className={s.breakeven}>
      Precio de equilibrio estimado para {cropLabel(be!.crop_id)}: <b>S/ {fmtNumber(be!.price_soles_kg!, 2)}/kg</b> en chacra. Cubre costos directos del escenario; otros gastos quedan fuera.
    </p>
  );
}

function RiskLine({ st, areaHa }: { st: Strategy; areaHa?: number }) {
  const r = st.simple?.facts.risk;
  if (!r || !finite(r.p_loss)) return null;
  return (
    <p className={s.riskLine}>
      {hasArea(areaHa) && finite(r.p10_soles) && finite(r.p90_soles) && <>Rango simulado del margen bruto <b>{soles(r.p10_soles)} – {soles(r.p90_soles)}</b> · </>}Probabilidad simulada de margen bruto negativo <b>{fmtNumber(r.p_loss * 100, r.p_loss < 0.01 && r.p_loss > 0 ? 1 : 0)} %</b>. Depende de los datos y supuestos; no garantiza tu resultado.
      {" "}<Term id="riesgo">¿Cómo se calcula?</Term>
    </p>
  );
}

export function OptionCard({
  st, result, onWhy, busy: _busy, cropLabel, areaHa, zoneName,
}: { st: Strategy; result: ComparisonResult; onWhy: () => void; onAnswer?: (patch: Record<string, string | number | null>) => void; busy: boolean; cropLabel: (id: string) => string; areaHa?: number; zoneName?: string }) {
  const f = st.simple?.facts;
  const water = st.decisive?.find((d) => d.id === "agua");
  const role = st.risk?.role ?? null;
  const lvl = optionLevel(st);
  const unvalidated = lvl === "explorar" || lvl === "no_conviene";
  const mine = st.strategy_id === "A";
  const realArea = hasArea(areaHa);
  const margin = metric(st, "eco.margen");
  const capital = metric(st, "eco.capital");
  const costs = metric(st, "eco.costos_directos") ?? metric(st, "eco.costos");
  const estimatedWater = metric(st, "agua.bruto_m3");
  const demoEconomics = [f?.margin_kind, margin?.kind, costs?.kind, capital?.kind].some((kind) => kind === "supuesto_demo" || kind === "sin_verificar");
  const risk = f?.risk;
  const riskKnown = realArea && !unvalidated && !demoEconomics && !!risk && finite(risk.p_loss) && risk.p_loss >= 0 && risk.p_loss <= 1 && finite(f?.margin_soles);
  const firstSowing = f?.first_sowing ?? st.timeline.find((block) => block.kind === "cultivo")?.start;
  const why = st.reasons.find((r) => r.state === "no_cumple") ?? st.reasons.find((r) => r.state === "falta_dato");
  return (
    <article className={`${s.card} ${s[`lvl_${lvl}`]} ${role === "sugerido" ? s.cardLead : ""} ${lvl === "sin_datos" ? s.cardWide : ""}`} aria-labelledby={`opt-${st.strategy_id}`}>
      {role === "sugerido" && !unvalidated && (
        <span className={s.ribbon}><Icon name="star" size={14} /> Opción sugerida con supuestos</span>
      )}
      {role === "explorar" && (
        <span className={`${s.ribbon} ${s.ribbonExplore}`}>
          <Icon name="explore" size={14} /> Para explorar
        </span>
      )}
      {mine && <Tip className={`${s.ribbon} ${s.ribbonMine}`} tip="Lo que tenías pensado hacer."><Icon name="sprout" size={14} /> Tu plan</Tip>}
      <div className={s.cardTop}>
        <div className={s.cardTitle}>
          <p className={s.planType}>{(st.simple?.type ?? (new Set(st.sequence).size > 1 ? "rotacion" : "monocultivo")) === "rotacion" ? "Rotación · cultivos en campañas sucesivas" : "Monocultivo · mismo cultivo entre campañas"}</p>
          <h2 id={`opt-${st.strategy_id}`} className={`${s.names} ${s.display}`}>{shortNames(st, cropLabel)}</h2>
        </div>
        <LevelBadge st={st} />
      </div>
      <p className={s.headline}>{st.simple?.headline}</p>
      <p className={s.planScope}>
        {zoneName && <span>Zona: <b>{zoneName}</b>. </span>}
        Periodo: {fmtDate(result.horizon_start)} a {fmtDate(result.horizon_end)}.
        {realArea ? <> Totales para <b>{fmtNumber(areaHa, 3)} ha delimitadas</b>.</> : " Delimita tu terreno para calcular los totales de tu área real."}
      </p>
      <CropPlanVisual st={st} cropLabel={cropLabel} />
      <dl className={s.planFacts}>
        <div><dt><Icon name="money" /> Margen bruto estimado</dt>
          <dd>{!realArea ? "Pendiente de delimitar el área" : finite(f?.margin_soles) ? soles(f.margin_soles) : "Sin datos suficientes"}</dd>
        </div>
        <div><dt><Icon name="money" /> Costos directos del periodo</dt>
          <dd>{!realArea ? "Pendiente de delimitar el área" : finite(costs?.value) ? soles(costs.value) : "Pendientes de datos de costos"}</dd>
        </div>
        <div><dt><Icon name="money" /> Capital de trabajo estimado</dt>
          <dd>{!realArea ? "Pendiente de delimitar el área" : finite(capital?.value) ? soles(capital.value) : "Sin datos suficientes"}</dd>
        </div>
        <div><dt><Icon name="water" /> Agua de riego estimada del periodo</dt>
          <dd>{!realArea ? "Pendiente de delimitar el área" : finite(f?.water_m3) ? `${fmtNumber(f.water_m3)} m³` : "Falta confirmar agua o método de riego"}</dd>
          <NasaBadge product="power" variant="micro" />
        </div>
        <div><dt><Icon name="calendar" /> Primera fecha de siembra estimada</dt>
          <dd>{firstSowing && Number.isFinite(Date.parse(firstSowing)) ? <time dateTime={firstSowing}>{fmtDate(firstSowing)}</time> : "Fecha pendiente"}</dd>
        </div>
        <div><dt><Icon name="shield" /> Riesgo económico simulado</dt>
          <dd>{!realArea ? "Pendiente de delimitar el área" : riskKnown ? `${fmtNumber(risk.p_loss * 100, 1)} % de margen bruto negativo` : "Sin estimación validada"}</dd>
        </div>
      </dl>
      <p className={s.evidenceNote}>Margen = ventas − costos directos; no es ganancia neta. {demoEconomics ? "Escenario con cifras de ejemplo: confirma precios, rendimientos y costos." : "Los datos y supuestos no garantizan tu resultado."}</p>
      <p className={s.evidenceNote}>{st.simple?.type === "rotacion" ? "Cambia de producto entre campañas; la diversidad no demuestra una mejora medida del suelo." : "Un producto por campaña; exige cambiar antes de la tercera siembra seguida."}</p>
      <details className={s.tech}>
      <summary>Ver criterios, inversión y fuentes</summary>
      <p>Los costos directos suman insumos, labores y transiciones del periodo. El capital de trabajo es el máximo dinero necesario antes de recuperar ventas; no equivale al margen ni al total de gastos. El margen excluye alquiler, depreciación, impuestos y financiamiento.</p>
      <p>Agua: demanda calculada del plan, no volumen que recibirás. El riesgo usa precios, rendimientos y clima supuestos; los faltantes no significan riesgo cero.{unvalidated && " Esta opción no está validada para tu zona."}</p>
      {(margin?.source_ids.length || estimatedWater?.source_ids.length) ? <SourceChips ids={[...new Set([...(margin?.source_ids ?? []), ...(estimatedWater?.source_ids ?? [])])]} /> : null}
      <div className={s.planReason}><h3>Por qué considerar esta opción</h3><p>{st.simple?.rationale ?? "Revisa la secuencia de cultivos y su manejo antes de elegir."}</p><p>{why?.message ?? st.simple?.headline}</p>
        <p><b>Límites:</b> {st.missing.length ? st.missing.join("; ") : "El resultado depende de los supuestos de clima, agua, costos y precios."}</p>
      </div>
      <div className={s.soilBlock}><h3>Suelo y fertilización</h3><p>{st.soil.advice ?? "Confirma un análisis de suelo antes de definir la fertilización."}</p>{st.soil.needs && <p>{st.soil.needs}</p>}</div>
      </details>
      <NutritionSection nutrition={st.nutrition} cropLabel={cropLabel} compact />
      <div className={s.cardActions}>
        {water && (
          <a href="#agua" className={s.waterLink} title={`Depende del agua que te llega en ${water.label.replace(/^tu agua de /, "")}`}>
            <Icon name="water" size={16} /> Confirma tu agua
          </a>
        )}
        <MoreButton onClick={onWhy} />
      </div>
    </article>
  );
}

export function NutritionSection({ nutrition, cropLabel, compact = false }: { nutrition?: NutritionImpact | null; cropLabel: (id: string) => string; compact?: boolean }) {
  if (compact) return <div className={s.nutritionBlock}>
    <h3>Aporte alimentario potencial</h3>
    <p>{nutrition?.foods.length ? nutrition.foods.map((food) => `${cropLabel(food.crop_id)}: ${food.nutrients?.join(", ") || (food.status === "forraje" ? "forraje, sin aporte humano calculado" : "sin ficha verificada")}`).join(". ") : "Pendiente de referencias alimentarias."}.</p>
    <details className={s.tech}><summary>Ver aportes, fuentes y contexto de Arequipa</summary><NutritionSection nutrition={nutrition} cropLabel={cropLabel} /></details>
  </div>;
  const context = nutrition?.regional_context;
  const regional = context?.region === "Arequipa" ? context : null;
  return (
    <div className={s.nutritionBlock}>
      <h3>Aporte alimentario</h3>
      {!!nutrition?.foods.length && <ul>{nutrition.foods.map((food) => <li key={food.crop_id}><b>{food.food ?? cropLabel(food.crop_id)}</b>{food.nutrients?.length ? <> · {food.nutrients.join(", ")}</> : " · Aporte humano sin calcular"}<p>{food.explanation}</p></li>)}</ul>}
      <p>{nutrition?.explanation ?? "Aporte nutricional pendiente de una fuente revisada para estos cultivos."}</p>
      {nutrition?.source_ids?.length ? <SourceChips ids={nutrition.source_ids} /> : <p className={s.evidenceNote}>Fuente nutricional: pendiente.</p>}
      <p className={s.evidenceNote}>Límite: describe alimentos potenciales; no calcula una dieta ni garantiza autoconsumo. Depende de la parte comestible, preparación y destino de la cosecha.</p>
      {regional ? <details className={s.tech}>
        <summary>Contexto de alimentación y salud de Arequipa · SIEN-HIS</summary>
        <p><b>Periodo acumulado:</b> {regional.period.label} (<time dateTime={regional.period.start}>{fmtDate(regional.period.start)}</time> a <time dateTime={regional.period.end}>{fmtDate(regional.period.end)}</time>).</p>
        <p><b>Población evaluada:</b> {regional.population}.</p>
        <p>Estos datos describen a quienes acudieron a establecimientos de salud; no estiman la salud de tu familia ni el efecto de sembrar un cultivo.</p>
        <div className={s.nutritionTableWrap}><table className={s.nutritionTable}>
          <caption>Indicadores de Arequipa; cada fila conserva su propio denominador.</caption>
          <thead><tr><th scope="col">Indicador</th><th scope="col">Casos / evaluados</th><th scope="col">Porcentaje de evaluados</th></tr></thead>
          <tbody>{regional.indicators.map((indicator) => <tr key={indicator.id}><th scope="row">{indicator.label}</th><td>{finite(indicator.count) && finite(indicator.denominator) && indicator.denominator > 0 ? `${fmtNumber(indicator.count)} / ${fmtNumber(indicator.denominator)}` : "Sin dato"}</td><td>{finite(indicator.percent) && indicator.percent >= 0 && indicator.percent <= 100 ? `${fmtNumber(indicator.percent, 2)} ${indicator.percent_unit}` : "Sin dato"}</td></tr>)}</tbody>
        </table></div>
        <ul>{regional.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>
        {!!regional.source_ids.length && <SourceChips ids={regional.source_ids} />}
      </details> : <p className={s.evidenceNote}>Contexto regional de Arequipa no disponible.</p>}
    </div>
  );
}

export interface AssociationOption {
  id: string;
  name: string;
  status: string;
  components?: unknown[];
  why?: string | string[];
  rationale?: string;
  nutrition?: NutritionImpact | null;
  unknowns?: string[];
  structure?: string;
  known?: string[];
  missing?: string[];
  warning?: string;
  source_ids?: string[];
}

function componentName(component: unknown, cropLabel?: (id: string) => string): { id: string; name: string } | null {
  if (typeof component === "string") return { id: component, name: cropLabel ? cropLabel(component) : component.replaceAll("_", " ") };
  if (!component || typeof component !== "object") return null;
  const item = component as Record<string, unknown>;
  const id = typeof item.crop_id === "string" ? item.crop_id : typeof item.id === "string" ? item.id : "";
  const name = typeof item.name === "string" ? item.name : typeof item.crop_name === "string" ? item.crop_name : id && cropLabel ? cropLabel(id) : "";
  return name ? { id, name } : null;
}

/** Alternativas simultáneas sin sumar márgenes/agua de monocultivos como si fueran policultivos. */
export function AssociationOptions({ associations, result: _result, cropLabel, areaHa, zoneName }: {
  associations: AssociationOption[];
  result?: ComparisonResult;
  cropLabel?: (id: string) => string;
  areaHa?: number;
  zoneName?: string;
}) {
  if (!associations.length) return null;
  return (
    <section className={s.associationOptions} aria-labelledby="asociaciones-titulo">
      <h2 id="asociaciones-titulo" className={s.display}>Policultivo: cultivos juntos en el terreno</h2>
      <p className={s.panelText}>En monocultivo se mantiene un cultivo; en rotación cambian entre campañas. En policultivo conviven varios cultivos durante parte de la misma campaña. Estas asociaciones son exploratorias{zoneName ? ` para ${zoneName}` : ""}.</p>
      <div className={s.associationGrid}>
        {associations.map((association) => {
          const components = (association.components ?? []).map((component) => componentName(component, cropLabel)).filter((component) => component !== null);
          const why = typeof association.why === "string" ? [association.why] : association.why ?? association.known ?? [];
          const unknowns = association.unknowns ?? association.missing ?? [];
          return (
            <article key={association.id} className={`${s.card} ${s.lvl_explorar}`} aria-labelledby={`asociacion-${association.id}`}>
              <span className={`${s.ribbon} ${s.ribbonExplore}`}><Icon name="explore" size={14} /> Asociación exploratoria</span>
              <h3 id={`asociacion-${association.id}`} className={`${s.names} ${s.display}`}>{association.name}</h3>
              {association.structure && <p className={s.sub}>{association.structure}</p>}
              <ul className={s.associationCrops} aria-label="Cultivos de la asociación">{components.map((component, index) => <li key={`${component.id}-${index}`}><CropIllustration id={component.id} /><strong>{component.name}</strong></li>)}</ul>
              <div className={s.planReason}><h4>Por qué explorarla</h4>{association.rationale && <p>{association.rationale}</p>}{why.length ? <ul>{why.map((text, index) => <li key={index}>{text}</li>)}</ul> : !association.rationale && <p>Justificación local pendiente de revisar.</p>}</div>
              <div className={s.planReason}><h4>Qué falta confirmar</h4>{unknowns.length ? <ul>{unknowns.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>Compatibilidad local, distribución en el terreno, manejo y calendario por validar.</p>}</div>
              <p className={s.evidenceNote}>{association.warning || "No hay validación local suficiente para recomendar esta asociación."}</p>
              <p className={s.sub}>{hasArea(areaHa) ? `Área delimitada: ${fmtNumber(areaHa, 3)} ha. ` : "Delimita tu terreno para estudiar la distribución. "}Margen bruto, costos directos, agua, riesgo y fechas de siembra de la asociación: pendientes. No se suman los resultados de cultivos individuales.</p>
              <NutritionSection nutrition={association.nutrition} cropLabel={cropLabel ?? ((id) => id.replaceAll("_", " "))} />
              {association.source_ids?.length ? <SourceChips ids={association.source_ids} /> : <p className={s.sub}>Fuente local: pendiente.</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Lo que antes llenaba la tarjeta, ahora bajo demanda (dentro de «Ver más»). */
function Highlights({ st, result, cropLabel, areaHa }: { st: Strategy; result: ComparisonResult; cropLabel: (id: string) => string; areaHa?: number }) {
  const role = st.risk?.role ?? null;
  const portfolio = role === "sugerido" ? result.optimizer?.portfolio : null;
  const sw = role === "sugerido" ? result.optimizer?.switch : null;
  const rival = sw ? result.strategies.find((x) => x.strategy_id === sw.rival) : null;
  const unvalidated = optionLevel(st) === "explorar" || optionLevel(st) === "no_conviene";
  const demoEconomics = [st.simple?.facts.margin_kind, metric(st, "eco.margen")?.kind].some((kind) => kind === "supuesto_demo" || kind === "sin_verificar");
  return (
    <>
      {!unvalidated && !demoEconomics && hasArea(areaHa) && <RiskLine st={st} areaHa={areaHa} />}
      {!unvalidated && !demoEconomics && hasArea(areaHa) && <BreakevenLine st={st} cropLabel={cropLabel} />}
      {portfolio && !demoEconomics && !unvalidated && hasArea(areaHa) && (
        <div className={s.portfolio}>
          <b>Alternativa calculada: repartir el terreno</b>
          <span>
            {portfolio.lots.map((l) => `${fmtNumber(l.area_ha, l.area_ha % 1 ? 1 : 0)} ha ${l.sequence.map(cropLabel).join(" → ")}`).join(" + ")}
            . Reparte el agua y el riesgo de precio: rango {soles(portfolio.stats.p10_soles)} – {soles(portfolio.stats.p90_soles)}.
          </span>
        </div>
      )}
      {sw && rival && !demoEconomics && !unvalidated && hasArea(areaHa) && (
        <p className={s.switchLine}>Si {cropLabel(sw.crop_id)} baja de <b>S/ {fmtNumber(sw.price_soles_kg, 2)}/kg</b> en chacra, conviene más «{rival.simple?.names}».</p>
      )}
      <CropPlanVisual st={st} cropLabel={cropLabel} />
      <p className={s.sub} style={{ marginTop: 6 }}>
        Agua calculada con <NasaBadge product="power" variant="micro" /> · <Term id="margen">¿Qué es el margen bruto estimado?</Term>
      </p>
    </>
  );
}

type Answer = { label: string; patch: Record<string, string | number | null> };

/**
 * Una sola pregunta de agua para toda la chacra («escalera»): los umbrales salen del mes más exigente
 * de cada opción; cada respuesta fija mínimo y máximo a la vez, así nunca queda mínimo > máximo.
 */
export function waterLadder(result: ComparisonResult, area: number): (Decisive & { answers: Answer[] }) | null {
  if (!hasArea(area)) return null;
  const qs = result.strategies.flatMap((st) => st.decisive ?? []).filter((d) => d.id === "agua" && d.critical_value != null);
  const cuts = [...new Set(qs.map((d) => Math.round(d.critical_value!)).filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b);
  if (!cuts.length) return null;
  // Etiquetas cortas en «mil m³» (más fáciles de leer que 10,745 m³).
  const f = (v: number) => `${fmtNumber(v / 1000, 1)} mil m³`;
  const answers: Answer[] = [{ label: `Menos de ${f(cuts[0])}`, patch: { "water.allocation_min_m3": null, "water.allocation_max_m3": cuts[0] - 1 } }];
  cuts.forEach((c, i) => {
    const next = cuts[i + 1];
    answers.push(next != null
      ? { label: `${fmtNumber(c / 1000, 1)} a ${f(next)}`, patch: { "water.allocation_min_m3": c, "water.allocation_max_m3": next - 1 } }
      : { label: `${f(c)} o más`, patch: { "water.allocation_min_m3": c, "water.allocation_max_m3": null } });
  });
  const months = [...new Set(qs.map((d) => d.label.replace(/^tu agua de /, "")))];
  return {
    id: "agua",
    label: "tu agua",
    question: "¿Cuánta agua te llega al mes?",
    detail: `En la época de más riego (${listEs(months)}), para tus ${fmtNumber(area, area % 1 ? 1 : 0)} ha. Cada opción pide distinto; con tu respuesta sabemos cuáles alcanzan. Calculado con clima NASA POWER.`,
    answers,
    source_ids: qs[0].source_ids,
  };
}

const Q_ICON: Record<string, string> = { agua: "water", riego: "sprout", sal: "salt" };
export type ResultAnswerPatch = Record<string, string | number | null | SoilPhotoAssessment>;
const WATER_LEVELS = [
  { value: "muy_poca", label: "Muy poca" },
  { value: "poca", label: "Poca" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "no_es_problema", label: "El agua no es problema" },
];
// Mismo contrato que application/recommendations.py: escenarios, sin calibración local.
const WATER_SCENARIOS: Record<string, [number | null, number | null]> = {
  muy_poca: [null, 0.35], poca: [0.35, 0.65], media: [0.65, 1], alta: [1, 1.35], no_es_problema: [1.35, null],
};

/** Preguntas que sirven para todas las opciones (agua, riego, sal), sin repetir. */
export function GlobalQuestions({ result, area, onAnswer, busy }: { result: ComparisonResult; area: number; onAnswer: (patch: ResultAnswerPatch) => void; busy: boolean }) {
  const [salinityVersion, setSalinityVersion] = useState(0);
  const answer = (patch: ResultAnswerPatch) => {
    if ("soil.salinity_signs" in patch && !patch["soil.photo_assessment"]) setSalinityVersion((version) => version + 1);
    onAnswer(patch);
  };
  const seen = new Map<string, Decisive>();
  const ladder = waterLadder(result, area);
  for (const st of result.strategies) for (const d of st.decisive ?? []) if (!seen.has(d.id)) seen.set(d.id, d);
  if (!seen.size) return null;
  return (
    <section className={s.panel} aria-labelledby="afinar" id="preguntas">
      <h2 id="afinar" className={s.panelTitle}>Afina tu resultado</h2>
      <div className={s.questionsGrid}>
        {[...seen.values()].map((d) => (
          <div key={d.id} id={d.id === "agua" ? "agua" : undefined} className={s.question}>
            <p className={s.qLine}>
              <span className={s.qIcon}><Icon name={Q_ICON[d.id] ?? "question"} /></span>
              <b>{d.id === "agua" ? "¿Cómo es tu disponibilidad de agua para regar?" : d.question}</b>
              {d.id !== "agua" && <Tip tip={d.detail} className={s.qHelp}><Icon name="question" size={14} /></Tip>}
            </p>
            {d.id === "agua" && <p className={s.panelText}>Piensa en la regularidad de tus turnos y cuánto te alcanza el riego. El modelo usa supuestos para traducir esta respuesta; confírmalos en el detalle.</p>}
            <div className={s.answerRow}>
              {d.id === "agua" ? WATER_LEVELS.map((level) => <button type="button" key={level.value} className={s.answer} disabled={busy} onClick={() => answer({ "water.availability": level.value, "water.allocation_m3": null, "water.allocation_min_m3": null, "water.allocation_max_m3": null })}>{level.label}</button>) : d.answers.map((a) => <button type="button" key={a.label} className={s.answer} disabled={busy} onClick={() => answer(d.id === "sal" ? { ...a.patch, "soil.photo_assessment": null } : a.patch)}>{a.label}</button>)}
              {d.id === "sal" && !d.answers.some((a) => a.patch["soil.salinity_signs"] === null) && <button type="button" className={s.answer} disabled={busy} onClick={() => answer({ "soil.salinity_signs": null, "soil.photo_assessment": null })}>No sé</button>}
            </div>
            {d.id === "agua" && ladder && <details className={s.tech}><summary>Opcional: conozco mi volumen mensual de agua</summary><p className={s.panelText}>{ladder.detail}</p><div className={s.answerRow}>{ladder.answers.map((answer) => <button type="button" key={answer.label} className={s.answer} disabled={busy} onClick={() => onAnswer({ ...answer.patch, "water.availability": null })}>{answer.label}</button>)}</div></details>}
            {d.id === "sal" && <div className={s.soilCapture}><SoilPhotoCapture key={salinityVersion} disabled={busy} onApply={(assessment) => onAnswer({ "soil.salinity_signs": assessment.salinity_signs === "no_concluyente" ? null : assessment.salinity_signs, "soil.photo_assessment": assessment })} /></div>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function countQuestions(result: ComparisonResult): number {
  const ids = new Set(result.strategies.flatMap((x) => x.decisive ?? []).map((d) => d.id));
  return ids.size;
}

/** «¿Por qué?» en tres capas: frase → lo que usamos → detalle técnico con fuentes. */
export function WhySheet({ st, profile, assumed, area, zone, onClose, onMore, result, cropLabel }: { st: Strategy | null; profile: Profile | null; assumed: string[]; area?: number; zone: Zone | null; onClose: () => void; onMore: () => void; result?: ComparisonResult | null; cropLabel?: (id: string) => string }) {
  const w = profile?.water;
  const used: { text: React.ReactNode; kind: "tuyo" | "zona" | "nasa" | "demo" | "mercado" | "ia"; label: string }[] = [];
  const typical = zone?.water_m3_ha_year?.value ?? null;
  const method = zone?.default_method?.value ?? "";
  const eff = Number(zone?.efficiency_by_method?.[method] ?? 0);
  if (st && profile) {
    used.push({ kind: "nasa", label: "NASA", text: <>Clima de 11 años (2015–2025) de la celda de {zone?.name ?? "tu zona"} para las fechas de siembra de esta opción. <Term id="nasa">¿Qué es?</Term></> });
    if (w?.availability) {
      const factors = WATER_SCENARIOS[w.availability];
      const monthly = hasArea(area) && finite(typical) && typical > 0 ? typical / 12 * area : null;
      used.push({ kind: "tuyo", label: "Tu categoría de agua", text: <>Disponibilidad declarada: <b>{WATER_LEVELS.find((level) => level.value === w.availability)?.label ?? w.availability}</b>.</> });
      if (assumed.includes("water.allocation") && factors) {
        const [lo, hi] = factors;
        used.push({ kind: "zona", label: "Escenario supuesto", text: <>CERES aplica factores {lo === null ? `hasta ${fmtNumber(hi!, 2)}` : hi === null ? `desde ${fmtNumber(lo, 2)}` : `${fmtNumber(lo, 2)} a ${fmtNumber(hi, 2)}`} sobre el agua típica mensual de la zona. Son factores metodológicos CERES sin calibración local.
          {monthly !== null ? <> Intervalo del escenario para {fmtNumber(area, 3)} ha: {lo === null ? <>hasta {fmtNumber(monthly * hi!)} m³/mes</> : hi === null ? <>desde {fmtNumber(monthly * lo)} m³/mes, sin cota superior conocida</> : <>{fmtNumber(monthly * lo)} a {fmtNumber(monthly * hi)} m³/mes</>}.</> : " Volumen del escenario pendiente de área y referencia de agua."} Confirma la disponibilidad con tus turnos o mediciones. <SourceChips ids={["CERES-AGUA-CUALITATIVA"]} /></> });
      } else used.push({ kind: "zona", label: "Volumen sin confirmar", text: <>La categoría declarada conserva la incertidumbre de volumen. <SourceChips ids={["CERES-AGUA-CUALITATIVA"]} /></> });
    } else if (assumed.includes("water.allocation") && typical != null) used.push({ kind: "zona", label: "Supuesto de zona", text: <>Usamos el <Term id="agua_tipica">agua típica de {zone?.name}</Term>{hasArea(area) && <> como escenario de {fmtNumber((typical / 12) * area)} m³ al mes para {fmtNumber(area, 3)} ha</>}. {zone?.water_m3_ha_year?.label} Confirma este supuesto.</> });
    else if (hasArea(area) && w?.allocation_min_m3 != null && w?.allocation_max_m3 != null) used.push({ kind: "tuyo", label: "Tu intervalo declarado", text: <>Declaraste entre {fmtNumber(w.allocation_min_m3)} y {fmtNumber(w.allocation_max_m3)} m³ al mes.</> });
    else if (hasArea(area) && w?.allocation_min_m3 != null) used.push({ kind: "tuyo", label: "Tu respuesta", text: <>Declaraste al menos {fmtNumber(w.allocation_min_m3)} m³ al mes.</> });
    else if (hasArea(area) && w?.allocation_max_m3 != null) used.push({ kind: "tuyo", label: "Tu respuesta", text: <>Declaraste hasta {fmtNumber(w.allocation_max_m3)} m³ al mes.</> });
    else if (hasArea(area) && w?.allocation_m3 != null) used.push({ kind: "tuyo", label: "Tu dato", text: <>Declaraste {fmtNumber(w.allocation_m3)} m³ {w.allocation_period === "anual" ? "al año" : "al mes"}.</> });
    if (assumed.includes("water.efficiency")) used.push({ kind: "zona", label: "Supuesto de zona", text: <>Riego por {METHOD_LABEL[method] ?? method} (<Term id="eficiencia">eficiencia</Term> {fmtNumber(eff * 100)} %), porque no indicaste cómo riegas.</> });
    else if (w?.method) used.push({ kind: "tuyo", label: "Tu respuesta", text: <>Riegas por {w.method === "aspersion" ? "aspersión" : w.method}.</> });
    const signs = profile.soil?.salinity_signs;
    if (profile.soil?.ece_ds_m != null) used.push({ kind: "tuyo", label: "Tu análisis", text: <>Sal del suelo medida: CE {profile.soil.ece_ds_m} dS/m.</> });
    const photo = profile.soil?.photo_assessment;
    if (photo) used.push({ kind: "ia", label: "IA visual revisada por ti", text: <>{photo.description} {photo.limitations} Fuente: Gemini visual. {photo.salinity_signs === "no_concluyente" && "Resultado no concluyente: se conserva el dato de signos como desconocido."}</> });
    else if (signs) used.push({ kind: "tuyo", label: "Tu observación manual", text: <>{signs === "con_signos" ? "Declaraste que ves signos compatibles con sales." : "Declaraste que no ves signos claros de sal."} Una observación no confirma ni descarta salinidad ni reemplaza un análisis.</> });
    else if (profile.soil?.ece_ds_m == null) used.push({ kind: "zona", label: "Sin dato", text: <>No sabemos si tu suelo tiene <Term id="sal">sal</Term>.</> });
    if (st.simple?.facts.margin_soles == null) used.push({ kind: "zona", label: "Sin dato", text: <>No hay precios ni rendimientos locales verificados: la ganancia queda pendiente hasta que registres los tuyos.</> });
    const margin = metric(st, "eco.margen");
    const demoEconomics = [st.simple?.facts.margin_kind, margin?.kind].some((kind) => kind === "supuesto_demo" || kind === "sin_verificar");
    if (demoEconomics) used.push({ kind: "demo", label: "Ejemplo o sin verificar", text: <>El escenario incluye precios, rendimientos o costos de ejemplo o sin verificar. Confirma los datos de tu chacra antes de decidir.</> });
    const marketSources = margin?.source_ids.filter((id) => id.includes("SISAP")) ?? [];
    if (marketSources.length) used.push({ kind: "mercado", label: "Referencia de mercado", text: <>El escenario usa referencias mayoristas MIDAGRI-SISAP para parte de sus precios y factores supuestos de precio en chacra. Revisa la fecha y producto de cada fuente; el precio actual no garantiza el de tu cosecha. <SourceChips ids={marketSources} /></> });
    else if (margin) used.push({ kind: "tuyo", label: "Base económica", text: <>Revisa los precios, rendimientos y costos usados en el escenario. {margin.source_ids.length ? <SourceChips ids={margin.source_ids} /> : "Fuente económica pendiente."}</> });
    const rk = st.simple?.facts.risk;
    if (rk && hasArea(area) && !demoEconomics && !["explorar", "no_conviene"].includes(optionLevel(st))) used.push({ kind: "nasa", label: "Riesgo simulado", text: <RiskLine st={st} areaHa={area} /> });
  }
  const icon: Record<string, string> = { cumple: "✓", no_cumple: "✕", falta_dato: "?", advertencia: "!", informacion: "i" };
  return (
    <Sheet open={!!st} onClose={onClose} title={st ? `${shortNames(st, cropLabel ?? ((id) => id))}: ${st.simple?.label}` : ""} label="Por qué">
      {st && (
        <>
          <section className={s.layer}>
            <h3 className={s.layerTitle}><span>1</span>En pocas palabras</h3>
            <p style={{ margin: 0, lineHeight: 1.55, fontSize: "1.02rem" }}>{st.simple?.headline}</p>
            {result && <Highlights st={st} result={result} areaHa={area} cropLabel={cropLabel ?? ((id) => id)} />}
          </section>
          <section className={s.layer}>
            <h3 className={s.layerTitle}><span>2</span>Lo que usamos</h3>
            <details className={s.tech}>
              <summary>Ver los {used.length} datos que usamos</summary>
              <ul className={s.used}>
                {used.map((u, i) => (
                  <li key={i}><span className={`${s.kind} ${s[`k_${u.kind}`]}`}>{u.label}</span><div>{u.text}</div></li>
                ))}
              </ul>
            </details>
          </section>
          <section className={s.layer}>
            <h3 className={s.layerTitle}><span>3</span>Detalle técnico y fuentes</h3>
            <details className={s.tech}>
              <summary>Ver las reglas que revisó el motor ({st.reasons.length})</summary>
              {st.reasons.map((r, i) => (
                <div key={i} className={s.reason}>
                  <b aria-hidden="true">{icon[r.state]}</b>
                  <div>{r.message} <SourceChips ids={r.source_ids} /></div>
                </div>
              ))}
            </details>
            {st.monthly_water.length > 0 && (
              <details className={s.tech}>
                <summary>Ver el agua mes a mes</summary>
                <table className={s.waterTable}>
                  <thead><tr><th>Mes</th><th>Pide el cultivo (mm)</th><th>Llevar (m³)</th></tr></thead>
                  <tbody>{st.monthly_water.map((m) => <tr key={m.label}><td>{m.label}</td><td>{fmtNumber(m.etc_mm)}</td><td>{hasArea(area) && m.gross_m3 != null ? fmtNumber(m.gross_m3) : "Pendiente de área"}</td></tr>)}</tbody>
                </table>
              </details>
            )}
            <button className={s.linkBtn} onClick={onMore}>Ver todo el detalle técnico</button>
          </section>
        </>
      )}
    </Sheet>
  );
}
