"use client";

import { useState } from "react";
import { CROP_LABELS, type Profile } from "@/lib/types";

export const EMPTY_PROFILE: Profile = {
  current_crop_id: "maiz_grano",
  current_status: "en_campo",
  expected_harvest: null,
  planned_next_crop_id: null,
  water: { mode: "no_se", allocation_period: "mensual" },
  soil: {},
  priority: "equilibrada",
  budget_soles: null,
  residue_management: "no_se",
  economic_overrides: [],
};

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function validateProfile(p: Profile): string[] {
  const errs: string[] = [];
  if (p.current_status === "en_campo" && !p.expected_harvest) errs.push("Indica cuándo cosechas (fecha aproximada).");
  if (p.water.mode === "conozco" && (p.water.allocation_m3 == null || Number.isNaN(p.water.allocation_m3))) errs.push("Indica el volumen de agua que recibes o elige «No sé».");
  if (p.water.efficiency != null && !(p.water.efficiency > 0 && p.water.efficiency <= 1)) errs.push("La eficiencia es una fracción entre 0 y 1 (por ejemplo 0,85).");
  if (p.soil.ece_ds_m != null && p.soil.kind === "observado" && (!p.soil.analysis_date || !p.soil.method)) errs.push("Un análisis medido necesita fecha y método.");
  return errs;
}

export function ProfileForm({ value, onChange, compact = false }: { value: Profile; onChange: (p: Profile) => void; compact?: boolean }) {
  const p = value;
  const set = (patch: Partial<Profile>) => onChange({ ...p, ...patch });
  const setWater = (patch: Partial<Profile["water"]>) => onChange({ ...p, water: { ...p.water, ...patch } });
  const setSoil = (patch: Partial<Profile["soil"]>) => onChange({ ...p, soil: { ...p.soil, ...patch } });
  const [open, setOpen] = useState(!compact);
  const ov = (crop: string) => p.economic_overrides?.find((o) => o.crop_id === crop) ?? { crop_id: crop };
  const setOv = (crop: string, patch: Record<string, number | null>) => {
    const rest = (p.economic_overrides ?? []).filter((o) => o.crop_id !== crop);
    const merged = { ...ov(crop), ...patch };
    const hasAny = ["yield_t_ha", "price_soles_kg", "variable_cost_soles_ha"].some((k) => (merged as Record<string, unknown>)[k] != null);
    set({ economic_overrides: hasAny ? [...rest, merged] : rest });
  };

  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="crop">¿Qué sembraste? <span className="hint">Cultivo actual o el último que cosechaste</span></label>
        <select id="crop" value={p.current_crop_id} onChange={(e) => set({ current_crop_id: e.target.value })}>
          {Object.entries(CROP_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {p.current_crop_id === "alfalfa" && <p className="hint">La alfalfa establecida no se compara como cultivo anual en esta versión.</p>}
      </div>

      <fieldset>
        <legend>¿Ya cosechaste?</legend>
        <div className="choice">
          <label><input type="radio" name="status" checked={p.current_status === "en_campo"} onChange={() => set({ current_status: "en_campo" })} /> Todavía está en campo</label>
          <label><input type="radio" name="status" checked={p.current_status === "cosechado"} onChange={() => set({ current_status: "cosechado", expected_harvest: null })} /> Ya coseché</label>
        </div>
        {p.current_status === "en_campo" && (
          <div className="field" style={{ marginTop: "0.6rem" }}>
            <label htmlFor="harvest">¿Cuándo cosechas? <span className="hint">Fecha aproximada</span></label>
            <input id="harvest" type="date" value={p.expected_harvest ?? ""} onChange={(e) => set({ expected_harvest: e.target.value || null })} />
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>¿Cuánta agua de riego recibes?</legend>
        <div className="choice">
          <label><input type="radio" name="water" checked={p.water.mode === "no_se"} onChange={() => setWater({ mode: "no_se" })} /> No sé</label>
          <label><input type="radio" name="water" checked={p.water.mode === "conozco"} onChange={() => setWater({ mode: "conozco", allocation_period: p.water.allocation_period ?? "mensual" })} /> Lo sé</label>
        </div>
        {p.water.mode === "no_se" && <p className="hint" style={{ marginTop: "0.4rem" }}>Sin la dotación no se puede confirmar que un ciclo tenga agua suficiente; verás qué dato falta.</p>}
        {p.water.mode === "conozco" && (
          <div className="grid-2" style={{ marginTop: "0.6rem" }}>
            <div>
              <label htmlFor="alloc">Volumen para toda la parcela (m³) <span className="hint">Medido en tu toma</span></label>
              <input id="alloc" type="number" min={0} step={100} inputMode="decimal" value={p.water.allocation_m3 ?? ""} onChange={(e) => setWater({ allocation_m3: num(e.target.value) })} />
            </div>
            <div>
              <label htmlFor="period">Por</label>
              <select id="period" value={p.water.allocation_period ?? "mensual"} onChange={(e) => setWater({ allocation_period: e.target.value as "mensual" | "anual" })}>
                <option value="mensual">mes</option>
                <option value="anual">año</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="eff">Eficiencia del riego <span className="hint">Fracción de 0 a 1; goteo bien manejado ≈ 0,85–0,90. Déjalo vacío si no sabes.</span></label>
              <input id="eff" type="number" min={0.1} max={1} step={0.01} inputMode="decimal" value={p.water.efficiency ?? ""} onChange={(e) => setWater({ efficiency: num(e.target.value) })} />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>¿Qué te importa más?</legend>
        <div className="choice">
          {([["equilibrada", "Equilibrado"], ["dinero", "Dinero"], ["agua", "Agua"], ["suelo", "Cuidado del suelo"]] as const).map(([k, l]) => (
            <label key={k}><input type="radio" name="prio" checked={p.priority === k} onChange={() => set({ priority: k })} /> {l}</label>
          ))}
        </div>
      </fieldset>

      <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>Más datos (opcional): plan, suelo, presupuesto y precios</summary>
        <div className="stack">
          <div className="field">
            <label htmlFor="next">¿Qué piensas sembrar después? <span className="hint">Si lo dejas vacío se supone que repites el cultivo</span></label>
            <select id="next" value={p.planned_next_crop_id ?? ""} onChange={(e) => set({ planned_next_crop_id: e.target.value || null })}>
              <option value="">— No lo sé —</option>
              {Object.entries(CROP_LABELS).filter(([k]) => k !== "alfalfa").map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend>Análisis de suelo</legend>
            <div className="grid-2">
              <div>
                <label htmlFor="ece">Salinidad CE (dS/m)</label>
                <input id="ece" type="number" min={0} step={0.1} inputMode="decimal" value={p.soil.ece_ds_m ?? ""} onChange={(e) => setSoil({ ece_ds_m: num(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="ph">pH</label>
                <input id="ph" type="number" min={1} max={13} step={0.1} inputMode="decimal" value={p.soil.ph ?? ""} onChange={(e) => setSoil({ ph: num(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="sdate">Fecha del análisis</label>
                <input id="sdate" type="date" value={p.soil.analysis_date ?? ""} onChange={(e) => setSoil({ analysis_date: e.target.value || null })} />
              </div>
              <div>
                <label htmlFor="smethod">Método / laboratorio</label>
                <input id="smethod" type="text" value={p.soil.method ?? ""} onChange={(e) => setSoil({ method: e.target.value || null })} />
              </div>
              <div>
                <label htmlFor="sdepth">Profundidad (cm)</label>
                <input id="sdepth" type="text" placeholder="0-30" value={p.soil.depth_cm ?? ""} onChange={(e) => setSoil({ depth_cm: e.target.value || null })} />
              </div>
              <div>
                <label htmlFor="skind">Origen del dato</label>
                <select id="skind" value={p.soil.kind ?? "declarado"} onChange={(e) => setSoil({ kind: e.target.value as "observado" | "declarado" })}>
                  <option value="observado">Análisis de laboratorio</option>
                  <option value="declarado">Lo recuerdo / estimado</option>
                </select>
              </div>
            </div>
            <p className="hint">Si no tienes análisis, déjalo vacío: no se supone suelo sano.</p>
          </fieldset>
          <div className="grid-2">
            <div>
              <label htmlFor="budget">Capital disponible (S/)</label>
              <input id="budget" type="number" min={0} step={100} value={p.budget_soles ?? ""} onChange={(e) => set({ budget_soles: num(e.target.value) })} />
            </div>
            <div>
              <label htmlFor="res">Residuos de cosecha</label>
              <select id="res" value={p.residue_management} onChange={(e) => set({ residue_management: e.target.value as Profile["residue_management"] })}>
                <option value="no_se">No sé</option>
                <option value="incorporar">Los incorporo</option>
                <option value="retirar">Los retiro</option>
              </select>
            </div>
          </div>
          <fieldset>
            <legend>Tus precios y costos (reemplazan los supuestos de demostración)</legend>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Cultivo</th><th>Rendimiento (t/ha)</th><th>Precio en chacra (S/ por kg)</th><th>Costos variables (S/ por ha)</th></tr>
                </thead>
                <tbody>
                  {["maiz_grano", "frejol_grano", "cebolla_roja"].map((c) => {
                    const o = ov(c) as unknown as Record<string, number | null | undefined>;
                    return (
                      <tr key={c}>
                        <td>{CROP_LABELS[c]}</td>
                        {(["yield_t_ha", "price_soles_kg", "variable_cost_soles_ha"] as const).map((k) => (
                          <td key={k}>
                            <input aria-label={`${k} ${CROP_LABELS[c]}`} type="number" min={0} step="any" value={o[k] ?? ""} onChange={(e) => setOv(c, { [k]: num(e.target.value) })} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </fieldset>
        </div>
      </details>
    </div>
  );
}
