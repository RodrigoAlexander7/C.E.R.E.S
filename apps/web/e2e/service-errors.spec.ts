import { expect, test } from "@playwright/test";

test("cuota de IA conserva texto y HLS distingue falta de píxeles de un fallo", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const auth = await page.request.post("/api/v1/auth/register", { headers: { Origin: origin }, data: { email: `errores-${Date.now()}@ceres.test`, password: "prueba-errores-123" } });
  expect(auth.status()).toBe(201);
  const parcel = await page.request.post("/api/v1/parcels", { headers: { Origin: origin, "X-CSRF-Token": (await auth.json()).csrf_token }, data: {
    name: "Parcela de prueba", point: { lat: -16.35, lon: -72.19 }, area_ha: 1,
    profile: { current_crop_id: "maiz_grano", current_status: "cosechado", water: { mode: "no_se" } },
  } });
  expect(parcel.status()).toBe(201);
  await page.route("**/api/v1/parcels/*/proposals", route => route.request().method() === "POST" ? route.fulfill({ status: 503, json: { error: { code: "ia_sin_cuota", message: "El servicio de IA alcanzó su límite de uso. Puedes usar el formulario e intentarlo más tarde" } } }) : route.continue());
  await page.goto("/app/cuaderno");
  const text = page.getByRole("textbox", { name: "Cuenta lo que hiciste", exact: true });
  await text.fill("Gasté 35 soles en riego");
  await page.getByRole("button", { name: "Enviar texto" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("límite de uso");
  await expect(text).toHaveValue("Gasté 35 soles en riego");
  await page.route("**/api/v1/parcels/*/ndvi", route => route.fulfill({ json: {
    needs_polygon: false, items: [], monthly: [], coverage: "no_pixel_centers",
    refresh: { allowed: true, retry_after_seconds: 0, reason: null },
    job: { status: "error", detail: "Una escena no se pudo leer. Puedes reintentar." },
  } }));
  await page.route("**/api/v1/parcels/*/ndvi/refresh", route => route.fulfill({ status: 202, json: { status: "pendiente" } }));
  await page.goto("/app/chacra");
  await expect(page.getByText(/no hay centros de píxel HLS dentro/)).toBeVisible();
  await expect(page.getByText(/no equivale a cero/)).toBeVisible();
  await page.getByRole("button", { name: "Actualizar desde HLS" }).click();
  await expect(page.getByRole("button", { name: "Actualizar desde HLS" })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: /Procesando escenas/ })).toBeVisible();
});
