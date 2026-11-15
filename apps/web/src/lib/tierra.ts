// «¿Cómo está tu tierra?» sin cuenta: se recuerda solo en este navegador (comodidad, no dato guardado)
// y se usa en la próxima consulta de «Qué sembrar». Con cuenta, se guarda en el perfil de la parcela.

export interface Tierra {
  salinity_signs?: "sin_signos" | "con_signos";
  method?: "goteo" | "aspersion" | "gravedad";
}

const KEY = "ceres:tierra";

export function readTierra(): Tierra {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Tierra;
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
