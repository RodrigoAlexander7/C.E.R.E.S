"use client";

// «Precios de esta semana» (MIDAGRI-SISAP): mayorista de Arequipa y mercados cercanos para los
// cultivos de tus opciones, y tu propio precio en chacra (que reemplaza al supuesto).

import { useEffect, useState } from "react";
import { SourceChips } from "@/components/Sources";
import { api, fmtNumber } from "@/lib/api";
import type { PriceItem } from "@/lib/types";
import { Term } from "./help";
import { Icon, Tip, cropColor } from "./icons";
import s from "./simple.module.css";

function Trend({ v }: { v: number | null }) {
  if (v == null || Math.abs(v) < 0.02) return <Tip className={s.trendFlat} tip="Estable en estas dos semanas"><Icon name="flat" size={16} /></Tip>;
  return v > 0
    ? <Tip className={s.trendUp} tip={`Sube unos S/ ${fmtNumber(v, 2)} por kg a la semana`}><Icon name="trendUp" size={16} /></Tip>
    : <Tip className={s.trendDown} tip={`Baja unos S/ ${fmtNumber(-v, 2)} por kg a la semana`}><Icon name="trendDown" size={16} /></Tip>;
}

export function MarketPanel({ zone, cropIds, ownPrices, onPrice, busy }: {
  zone: string;
  cropIds: string[];
  ownPrices: Record<string, number>;
  onPrice: (cropId: string, price: number | null) => void;
  busy: boolean;
}) {
  const [items, setItems] = useState<PriceItem[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    api<{ items: PriceItem[] }>(`/public/prices?zone=${zone}`).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [zone]);
  const shown = (items ?? []).filter((i) => cropIds.includes(i.crop_id));
  if (!items || !shown.length) return null;
  return (
    <details className={`${s.panel} ${s.marketPanel}`} aria-labelledby="precios-t">
      <summary className={s.marketSummary}>
        <span className={s.qIcon}><Icon name="money" /></span>
        <b id="precios-t">Precios de esta semana</b>
        <span className={s.marketMini} aria-hidden="true">
          {shown.filter((i) => i.markets[0]).slice(0, 3).map((i) => (
            <span key={i.crop_id}><i style={{ background: cropColor(i.crop_id) }} />S/ {fmtNumber(i.markets[0].median_soles_kg, 2)}</span>
          ))}
        </span>
      </summary>
      <p className={s.panelText}>
        <Term id="precio_mayorista">Precio mayorista</Term> por kg en Arequipa (MIDAGRI-SISAP, 2–13 nov 2026). En la chacra te pagan menos. <SourceChips ids={["MIDAGRI-SISAP"]} />
      </p>
      <div className={s.marketList}>
        {shown.map((it) => {
          const home = it.markets[0];
          const mine = ownPrices[it.crop_id];
          const others = it.markets.slice(1).map((m) => `${m.market} S/ ${fmtNumber(m.median_soles_kg, 2)}`).join(" · ");
          return (
            <div key={it.crop_id} className={s.marketRow}>
              <div className={s.marketHead}>
                <span className={s.cropDot} style={{ background: cropColor(it.crop_id) }} aria-hidden="true">{it.crop_name.slice(0, 1).toUpperCase()}</span>
                <b style={{ textTransform: "capitalize" }}>{it.crop_name}</b>
                {home ? (
                  <Tip className={s.marketMain} tip={`Mayorista en ${home.market}: de S/ ${fmtNumber(home.low_soles_kg, 2)} a ${fmtNumber(home.high_soles_kg, 2)} en dos semanas.${others ? ` Otros mercados: ${others}.` : ""}`}>
                    <strong>S/ {fmtNumber(home.median_soles_kg, 2)}</strong>/kg
                  </Tip>
                ) : <Tip className={s.marketMain} tip={it.note ?? "Sin precio publicado"}><strong>—</strong></Tip>}
                {home && <span className={s.marketTrend}><Trend v={home.trend_soles_kg_week} /></span>}
              </div>
              <div className={s.marketOwn}>
                <Tip tip={mine != null ? "Usamos el precio que nos diste." : it.farmgate_factor ? `Suponemos que en chacra te pagan el ${fmtNumber(it.farmgate_factor * 100)} % del mayorista. Si sabes tu precio, escríbelo.` : "Es un precio supuesto. Si sabes tu precio, escríbelo."}>
                  <span>En chacra: <b>S/ {fmtNumber(mine ?? it.farmgate_soles_kg, 2)}/kg</b>{mine != null ? " (tuyo)" : ""}</span>
                </Tip>
                <form
                  className={s.priceForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = Number((draft[it.crop_id] ?? "").replace(",", "."));
                    if (v > 0 && v < 100) onPrice(it.crop_id, v);
                  }}
                >
                  <label>
                    <span className={s.srOnly}>¿A cuánto te pagan {it.crop_name} en chacra? (S/ por kg)</span>
                    <input inputMode="decimal" placeholder="Me pagan S/ …/kg" value={draft[it.crop_id] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [it.crop_id]: e.target.value }))} />
                  </label>
                  <button className={s.answer} disabled={busy}>Usar</button>
                  {mine != null && <button type="button" className={s.linkBtn} disabled={busy} onClick={() => onPrice(it.crop_id, null)}>Quitar</button>}
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
