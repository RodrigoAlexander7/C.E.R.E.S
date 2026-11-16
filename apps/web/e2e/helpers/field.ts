import { expect, type Page } from "@playwright/test";

// Contornos sintéticos públicos; nunca parcelas ni credenciales del usuario.
export const MAJES_FIELD = { type: "Polygon", coordinates: [[[-72.1911, -16.351], [-72.189, -16.351], [-72.189, -16.349], [-72.1911, -16.349], [-72.1911, -16.351]]] };
export const CHILINA_FIELD = { type: "Polygon", coordinates: [[[-71.53, -16.3655], [-71.5291, -16.3655], [-71.5291, -16.3646], [-71.53, -16.3646], [-71.53, -16.3655]]] };
export const OUTSIDE_FIELD = { type: "Polygon", coordinates: [[[-77.05, -12.05], [-77.049, -12.05], [-77.049, -12.049], [-77.05, -12.049], [-77.05, -12.05]]] };

export async function assertFakeAssistant(page: Page) {
  const status = await (await page.request.get("/api/v1/assistant/status")).json();
  expect(!status.configured || status.model === "simulado-pruebas", "E2E nunca debe usar un LLM real").toBe(true);
}

export async function delimitField(page: Page, geometry = MAJES_FIELD) {
  await expect(page.getByRole("heading", { name: "Delimita tu campo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Usar este campo" })).toBeDisabled();
  await page.getByLabel("Pegar GeoJSON del campo", { exact: true }).fill(JSON.stringify(geometry));
  const measured = page.waitForResponse((r) => r.url().includes("/geometry/area") && r.request().method() === "POST" && r.ok());
  await page.getByRole("button", { name: "Medir GeoJSON" }).click();
  const info = await (await measured).json();
  await expect(page.getByRole("button", { name: "Usar este campo" })).toBeEnabled();
  await page.getByRole("button", { name: "Usar este campo" }).click();
  return info;
}

export async function answerProfile(page: Page, { crop = /^Maíz Amarillo duro/, water = /^Media/, streak = "1 campaña" }: { crop?: RegExp; water?: RegExp; streak?: string } = {}) {
  await page.getByRole("button", { name: crop }).click();
  await page.getByRole("button", { name: /Sí, ya coseché/ }).click();
  await expect(page.getByRole("heading", { name: "¿Cuánta agua tienes para regar?" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
  await page.getByRole("button", { name: water }).click();
  await page.getByRole("button", { name: streak, exact: true }).click();
}

export async function createTestParcel(page: Page, baseURL: string, withGeometry = true) {
  await assertFakeAssistant(page);
  const origin = new URL(baseURL).origin;
  const auth = await page.request.post("/api/v1/auth/register", { headers: { Origin: origin }, data: { email: `campo-${Date.now()}-${Math.random().toString(36).slice(2)}@ceres.test`, password: "prueba-campo-segura-123" } });
  expect(auth.status()).toBe(201);
  const headers = { Origin: origin, "X-CSRF-Token": (await auth.json()).csrf_token };
  const profile = { current_crop_id: "maiz_grano", current_status: "cosechado", current_crop_streak: 1, water: { mode: "no_se", availability: "media" }, priority: "dinero" };
  const response = await page.request.post("/api/v1/parcels", { headers, data: { name: "Campo sintético E2E", ...(withGeometry ? { geometry: MAJES_FIELD } : { point: { lat: -16.35, lon: -72.19 }, area_ha: 1 }), profile } });
  expect(response.status()).toBe(201);
  return { parcel: await response.json(), headers };
}
