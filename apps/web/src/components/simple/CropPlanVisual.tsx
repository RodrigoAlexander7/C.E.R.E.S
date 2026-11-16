import { fmtDate } from "@/lib/api";
import type { Strategy } from "@/lib/types";
import s from "./simple.module.css";

/** Dibujos orientativos: identifican el cultivo, nunca representan el terreno del usuario. */
export function CropIllustration({ id, size = 52 }: { id: string; size?: number }) {
  const cereal = /maiz|trigo|cebada|avena|quinua/.test(id);
  const bulb = /cebolla|ajo/.test(id);
  const legume = /frejol|haba|arveja|frijol/.test(id);
  const root = /papa|zanahoria|camote/.test(id);
  return (
    <svg className={s.cropIllustration} viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {cereal ? <>
        <path d="M32 55V12M32 42C19 41 14 34 13 26c12 1 19 7 19 16Zm0-8c12-1 17-8 18-16-11 2-18 8-18 16Z" />
        <path d="m32 26-7-6 7-6 7 6-7 6Zm0-12-4-5 4-5 4 5-4 5Z" fill="#e9c96d" />
      </> : bulb ? <>
        <path d="M28 24c-2-8-1-13 1-18m5 18c-1-8 1-13 5-18M32 24c-8 6-18 11-18 20 0 9 9 13 18 13s18-4 18-13c0-9-10-14-18-20Z" fill="#ede1ec" />
        <path d="M30 27c-9 11-10 21-4 28m9-28c9 11 10 21 4 28M27 57l-3 4m9-4v4m5-4 3 4" />
      </> : legume ? <>
        <path d="M48 10C25 9 9 27 12 43c2 14 17 14 25 4 8-9 6-23 11-37Z" fill="#e2edd8" />
        <path d="M44 14 18 48" /><circle cx="34" cy="23" r="4" fill="#b8ce91" /><circle cx="27" cy="33" r="4" fill="#b8ce91" /><circle cx="21" cy="43" r="4" fill="#b8ce91" />
      </> : root ? <>
        <path d="M31 24V8m0 9C19 18 15 12 16 6c9 0 15 5 15 11Zm1-2c10 1 15-3 16-9-9-1-15 3-16 9Z" />
        <path d="M18 29c9-8 24-5 29 5 8 16-10 24-21 22C11 54 6 40 18 29Z" fill="#ecdfc5" /><path d="m21 36 2 1m12 5 2 1m-13 6 2 1" />
      </> : id.includes("tomate") ? <>
        <path d="M32 22c-20-8-25 11-19 25 5 13 33 13 38-2 4-13-2-29-19-23Z" fill="#f2d5c8" /><path d="m21 22 11 6 10-7-10 1V12m0 10-8-7m8 7 8-7" />
      </> : <>
        <path d="M32 57V28m0 8C15 36 9 25 11 15c13 0 21 9 21 21Zm0-8C47 28 54 18 52 8c-12 0-20 9-20 20ZM17 57h30" fill="#e2edd8" />
      </>}
    </svg>
  );
}

const blocksOf = (st: Strategy, cropLabel: (id: string) => string) =>
  st.timeline.length ? st.timeline : st.sequence.map((crop_id) => ({ kind: "cultivo", crop_id, start: "", end: "", label: cropLabel(crop_id) }));

/** Qué se siembra y en qué orden: un dibujo por campaña, de izquierda a derecha («Campaña 1 → 2 → …»). */
export function CropSequence({ st, cropLabel, firstSowing }: { st: Strategy; cropLabel: (id: string) => string; firstSowing?: string | null }) {
  const growing = blocksOf(st, cropLabel).filter((block) => block.kind === "cultivo");
  const first = firstSowing && Number.isFinite(Date.parse(firstSowing)) ? firstSowing : null;
  return (
    <div className={s.cropPlan}>
      <ol className={s.sequence} aria-label="Cultivos en orden de campaña">
        {growing.map((block, index) => (
          <li key={`${block.crop_id}-${index}`}>
            <CropIllustration id={block.crop_id ?? ""} size={34} />
            <span>
              <strong>{block.crop_id ? cropLabel(block.crop_id).replace(/\s*\(.*\)$/, "") : block.label}</strong>
              <small>Campaña {index + 1}</small>
            </span>
          </li>
        ))}
      </ol>
      <p className={s.planCaption}>
        {growing.length} {growing.length === 1 ? "campaña" : "campañas"} en 24 meses{first && <> · primera siembra <time dateTime={first}>{fmtDate(first)}</time></>}
      </p>
    </div>
  );
}

/** Preparación, siembra y fin de cada ciclo; va dentro del detalle de la tarjeta. */
export function CampaignCalendar({ st, cropLabel }: { st: Strategy; cropLabel: (id: string) => string }) {
  let campaign = 0;
  const blocks = blocksOf(st, cropLabel);
  return (
    <div>
      <h3>Calendario de campañas</h3>
      <p className={s.planCaption}>Preparación, siembra y fin de cada ciclo · dibujos orientativos</p>
      <ol className={s.campaigns} aria-label="Campañas y fechas del plan">
        {blocks.map((block, index) => {
          const growing = block.kind === "cultivo";
          if (growing) campaign += 1;
          const start = block.start && Number.isFinite(Date.parse(block.start)) ? block.start : null;
          const end = block.end && Number.isFinite(Date.parse(block.end)) ? block.end : null;
          return (
            <li key={`${block.kind}-${block.start}-${index}`} className={growing ? s.campaign : s.campaignPause}>
              {growing && <CropIllustration id={block.crop_id ?? ""} size={36} />}
              <div>
                <span className={s.campaignLabel}>{growing ? `Campaña ${campaign}` : block.kind === "preparacion" ? "Preparación del terreno" : block.kind === "descanso" ? "Descanso del terreno" : "Espera entre campañas"}</span>
                <strong>{growing && block.crop_id ? cropLabel(block.crop_id) : block.label}</strong>
                <span className={s.campaignDates}>
                  {start ? <><span>{growing ? "Siembra" : "Inicio"}: <time dateTime={start}>{fmtDate(start)}</time></span>{end && <span>{growing ? "Fin del ciclo" : "Fin"}: <time dateTime={end}>{fmtDate(end)}</time></span>}</> : "Fechas pendientes de confirmar"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {!blocks.length && <p className={s.sub}>Calendario pendiente: aún no hay campañas calculadas.</p>}
    </div>
  );
}

/** Versión completa (secuencia + calendario plegable), usada en la hoja «¿Por qué?». */
export function CropPlanVisual({ st, cropLabel }: { st: Strategy; cropLabel: (id: string) => string }) {
  let campaign = 0;
  const blocks = blocksOf(st, cropLabel);
  const growing = blocks.filter((block) => block.kind === "cultivo");
  const products = [...new Set(growing.map((block) => block.crop_id).filter((id): id is string => !!id))];
  return (
    <div className={s.cropPlan}>
      <ul className={s.cropSummary} aria-label="Cultivos y número de campañas">
        {products.map((id) => {
          const count = growing.filter((block) => block.crop_id === id).length;
          return <li key={id}><CropIllustration id={id} /><span><strong>{cropLabel(id)}</strong><small>{count} {count === 1 ? "campaña" : "campañas"} en el periodo</small></span></li>;
        })}
      </ul>
      <details className={s.tech}>
      <summary>Ver calendario y fechas de {growing.length} {growing.length === 1 ? "campaña" : "campañas"}</summary>
      <p className={s.planCaption}>Preparación, siembra y fin de cada ciclo · dibujos orientativos</p>
      <ol className={s.campaigns} aria-label="Campañas y fechas del plan">
        {blocks.map((block, index) => {
          const growing = block.kind === "cultivo";
          if (growing) campaign += 1;
          const start = block.start && Number.isFinite(Date.parse(block.start)) ? block.start : null;
          const end = block.end && Number.isFinite(Date.parse(block.end)) ? block.end : null;
          return (
            <li key={`${block.kind}-${block.start}-${index}`} className={growing ? s.campaign : s.campaignPause}>
              {growing && <CropIllustration id={block.crop_id ?? ""} />}
              <div>
                <span className={s.campaignLabel}>{growing ? `Campaña ${campaign}` : block.kind === "preparacion" ? "Preparación del terreno" : block.kind === "descanso" ? "Descanso del terreno" : "Espera entre campañas"}</span>
                <strong>{growing && block.crop_id ? cropLabel(block.crop_id) : block.label}</strong>
                <span className={s.campaignDates}>
                  {start ? <><span>{growing ? "Siembra" : "Inicio"}: <time dateTime={start}>{fmtDate(start)}</time></span>{end && <span>{growing ? "Fin del ciclo" : "Fin"}: <time dateTime={end}>{fmtDate(end)}</time></span>}</> : "Fechas pendientes de confirmar"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {!blocks.length && <p className={s.sub}>Calendario pendiente: aún no hay campañas calculadas.</p>}
      </details>
    </div>
  );
}
