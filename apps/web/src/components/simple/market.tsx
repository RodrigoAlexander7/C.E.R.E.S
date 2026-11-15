"use client";

// «Precios de esta semana» (MIDAGRI-SISAP): mayorista de Arequipa y mercados cercanos para los
// cultivos de tus opciones, y tu propio precio en chacra (que reemplaza al supuesto).

import { useEffect, useState } from "react";
import { SourceChips } from "@/components/Sources";
import { api, fmtNumber } from "@/lib/api";
import type { MarketStat, PriceItem } from "@/lib/types";
import { Term } from "./help";
import s from "./simple.module.css";

function Spark({ m }: { m: MarketStat }) {
  const pts = m.series;
  if (pts.length < 2) return null;
  const vals = pts.map((p) => p.soles_kg);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const w = 72, h = 22;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${(i / (pts.length - 1)) * w},${h - 2 - ((p.soles_kg - lo) / span) * (h - 4)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`Precio diario de ${m.first} a ${m.last}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Trend({ v }: { v: number | null }) {
  if (v == null || Math.abs(v) < 0.02) return <span className={s.trendFlat} title="Estable en estas dos semanas">→ estable</span>;
  return v > 0
    ? <span className={s.trendUp} title={`Sube unos S/ ${fmtNumber(v, 2)} por kg a la semana`}>↑ sube</span>
    : <span className={s.trendDown} title={`Baja unos S/ ${fmtNumber(-v, 2)} por kg a la semana`}>↓ baja</span>;
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
    <section className={s.panel} aria-labelledby="precios-t">
      <h2 id="precios-t" className={s.panelTitle}>Precios de esta semana</h2>
      <p className={s.panelText}>
        <Term id="precio_mayorista">Precio mayorista</Term> por kg en mercados cercanos (MIDAGRI-SISAP, 2–13 nov 2026). En la chacra te pagan menos y a la cosecha puede cambiar. <SourceChips ids={["MIDAGRI-SISAP"]} />
      </p>
      <div className={s.marketList}>
        {shown.map((it) => {
          const home = it.markets[0];
          const mine = ownPrices[it.crop_id];
          return (
            <div key={it.crop_id} className={s.marketRow}>
              <div className={s.marketHead}>
                <b style={{ textTransform: "capitalize" }}>{it.crop_name}</b>
                {home ? (
                  <span className={s.marketMain}>
                    <strong>S/ {fmtNumber(home.median_soles_kg, 2)}</strong>/kg en {home.market}
                    <small> (de {fmtNumber(home.low_soles_kg, 2)} a {fmtNumber(home.high_soles_kg, 2)})</small>
                  </span>
                ) : <span className={s.sub} style={{ margin: 0 }}>{it.note}</span>}
                {home && <span className={s.marketTrend}><Spark m={home} /><Trend v={home.trend_soles_kg_week} /></span>}
              </div>
              {it.markets.length > 1 && (
                <div className={s.marketOthers}>
                  {it.markets.slice(1).map((m) => <span key={m.market}>{m.market} S/ {fmtNumber(m.median_soles_kg, 2)}</span>)}
                </div>
              )}
              <div className={s.marketOwn}>
                <span>
                  {mine != null
                    ? <>Usamos <b>tu precio: S/ {fmtNumber(mine, 2)}/kg</b> en chacra.</>
                    : <>En chacra usamos <b>S/ {fmtNumber(it.farmgate_soles_kg, 2)}/kg</b>{it.farmgate_factor ? ` (${fmtNumber(it.farmgate_factor * 100)} % del mayorista, supuesto)` : " (supuesto)"}.</>}
                </span>
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
    </section>
  );
}
