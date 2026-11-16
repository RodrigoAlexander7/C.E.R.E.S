// «¿Cómo está tu tierra?» sin cuenta: se recuerda solo en este navegador (comodidad, no dato guardado)
// y se usa en la próxima consulta de «Qué sembrar». Con cuenta, se guarda en el perfil de la parcela.

import type { SoilPhotoAssessment } from "@/components/simple/SoilPhotoCapture";

export interface Tierra {
  salinity_signs?: "sin_signos" | "con_signos" | null;
  photo_assessment?: SoilPhotoAssessment | null;
  method?: "goteo" | "aspersion" | "gravedad";
}

const KEY = "ceres:tierra";

export function readTierra(): Tierra {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    const t: Tierra = {};
    if (["sin_signos", "con_signos", null].includes(stored.salinity_signs)) t.salinity_signs = stored.salinity_signs;
    if (["goteo", "aspersion", "gravedad"].includes(stored.method)) t.method = stored.method;
    const a = stored.photo_assessment;
    if (a && ["con_signos", "sin_signos", "no_concluyente"].includes(a.salinity_signs)
      && a.source === "gemini_visual" && typeof a.description === "string" && a.description.trim() && a.description.length <= 320
      && typeof a.limitations === "string" && a.limitations.trim() && a.limitations.length <= 600
      && (a.salinity_signs === "no_concluyente" ? t.salinity_signs === null : t.salinity_signs === a.salinity_signs)) {
      t.photo_assessment = { salinity_signs: a.salinity_signs, description: a.description, limitations: a.limitations, source: "gemini_visual" };
    }
    return t;
  } catch {
    return {};
  }
}

export function writeTierra(t: Tierra) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // sin almacenamiento: la respuesta vale solo para esta pantalla
  }
}
