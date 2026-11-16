import { expect, test } from "@playwright/test";
import { CHILINA_FIELD, MAJES_FIELD, OUTSIDE_FIELD, answerProfile, assertFakeAssistant, createTestParcel, delimitField } from "./helpers/field";

test("mapa opcional: dibujar y medir sin cubrir los controles", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route(/^https:\/\/(?:tile\.openstreetmap\.org|gibs\.earthdata\.nasa\.gov)\//, (route) => route.abort());
  await page.goto("/app/chacra");
  // El mapa abre de entrada (diseño de escritorio); en el celular sigue siendo plegable.
  await expect(page.getByText("Dibujar mi terreno en el mapa", { exact: true })).toBeVisible();
  const canvas = page.locator(".map-wrap canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("region", { name: "Mapa interactivo. También puedes usar los selectores de la izquierda.", exact: true })).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Empezar a dibujar", exact: true }).click();
  // Espera a que termine el zoom inicial; el dibujo no depende de teselas de terceros.
  await page.waitForTimeout(1500);
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(360);
  for (const [x, y] of [[0.45, 0.45], [0.55, 0.45], [0.55, 0.55], [0.45, 0.55]]) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  }
  await page.getByRole("button", { name: "Terminar (4 puntos)", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /Mide/ })).toContainText("ha");
});

test("Chilina: catálogo propio, módulo NASA y fuentes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/app");
  await delimitField(page, CHILINA_FIELD);
  const comparison = page.waitForResponse(r => r.url().includes("/public/quick-compare") && r.ok());
  await answerProfile(page, { crop: /^Papa/ });
  const result = await (await comparison).json();
  expect(result.inputs.zone_id).toBe("chilina");
  expect(result.result.climate_snapshot_id).toBe("nasa-power-e7430e42e9be");
  await expect(page.locator("article[aria-labelledby^='opt-']")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Policultivo: cultivos juntos en el terreno" })).toBeVisible();
  await expect(page.getByText("Buena opción", { exact: true })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Módulos" }).getByRole("link", { name: "Cuándo sembrar" }).click();
  await page.getByRole("button", { name: "Valle de Chilina", exact: true }).click();
  await page.getByRole("group", { name: "Cultivo", exact: true }).getByRole("button", { name: "Papa", exact: true }).click();
  await expect(page.getByRole("img", { name: /Agua de riego/ })).toBeVisible();
  await page.getByRole("button", { name: "Ene", exact: true }).click();
  await page.getByText(/¿Y en años El Niño\?/).click();
  await expect(page.getByRole("columnheader", { name: "Fase (NOAA)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "NOAA-ONI", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("navigation", { name: "Módulos" }).getByRole("link", { name: "Mi chacra" }).click();
  await expect(page.getByRole("heading", { name: "Tu terreno", exact: true })).toBeVisible();
});

// R15/R16/R20: móvil 375 px, campo obligatorio y perfil mínimo,
// «¿Por qué?» en capas, pregunta decisiva que recalcula, y guardado en cuenta conservando la consulta.

test("modo sencillo en móvil: campo → agua y repetición → opciones → guardar", async ({ page }) => {
  await assertFakeAssistant(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/app");

  const field = await delimitField(page);
  const compared = page.waitForResponse((r) => r.url().includes("/api/v1/public/quick-compare") && r.ok());
  await answerProfile(page);
  const comparison = await compared;
  const body = comparison.request().postDataJSON();
  expect(body.geometry).toEqual(MAJES_FIELD);
  expect(body.area_ha).toBe(field.area_ha);
  expect(body.profile.priority).toBe("dinero");
  expect(body.profile.water).toMatchObject({ mode: "no_se", availability: "media" });
  expect(body.profile.water.allocation_m3).toBeUndefined();
  expect(body.profile.current_crop_streak).toBe(1);

  const cards = page.locator("article[aria-labelledby^='opt-']");
  // 3 plantillas + el plan sugerido por CERES (D) y el mejor por explorar (E) cuando el optimizador los encuentra.
  await expect(cards.nth(2)).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(3);
  expect(count).toBeLessThanOrEqual(5);
  // Ningún callejón sin salida: cada opción tiene un nivel en palabras simples y un titular.
  const badges = await cards.locator("span[class*=badge]").allInnerTexts();
  for (const label of badges) expect(label).toMatch(/Buena opción|Posible, confirma|Por explorar|No conviene/);
  await expect(page.getByText("Requiere datos")).toHaveCount(0);
  await expect(cards.first().getByText(/ha delimitadas/)).toBeVisible();
  await expect(cards.first().getByText("Margen bruto estimado", { exact: true })).toBeVisible();
  await expect(cards.first().getByText("Riesgo económico simulado", { exact: true })).toBeVisible();
  await expect(cards.first().getByText(/Rango probable/)).toHaveCount(0); // el detalle va bajo demanda
  await expect(page.getByText("Precios de esta semana")).toBeVisible();
  await expect(page.getByRole("note", { name: /NASA POWER/ }).first()).toBeAttached(); // sello NASA (ícono con tooltip)
  // Ya dijo «Media» en el asistente: categoría + área bastan, no se vuelve a preguntar el agua.
  await expect(page.getByText("¿Cómo es tu disponibilidad de agua para regar?")).toHaveCount(0);
  await expect(page.getByText(/confirma tu agua/i)).toHaveCount(0);
  await expect(page.locator("#agua")).toHaveCount(0);
  // Las opciones que no son el plan sugerido son filas compactas que se expanden a pedido.
  const secondary = cards.nth(1);
  await expect(secondary.getByText("Margen bruto estimado")).toHaveCount(0);
  await secondary.getByRole("button", { name: /Ver cifras y detalle/ }).click();
  await expect(secondary.getByText("Margen bruto estimado")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

  // Pregunta decisiva observable → recalcula.
  const recalculated = page.waitForResponse((r) => r.url().includes("/api/v1/public/quick-compare") && r.ok());
  await page.getByRole("button", { name: "Goteo", exact: true }).click();
  await recalculated;
  await expect(cards.first().getByText(/ha delimitadas/)).toBeVisible();

  // «Ver más» (?) abre el detalle en capas, con el riesgo y lo usado etiquetado.
  await cards.first().getByRole("button", { name: "Ver más" }).click();
  const why = page.getByRole("dialog", { name: "Por qué" });
  await expect(why.getByText("En pocas palabras")).toBeVisible();
  await why.getByText(/Ver los \d+ datos que usamos/).click();
  await expect(why.getByText("Tu respuesta").first()).toBeVisible();
  await why.getByRole("button", { name: "Cerrar" }).click();

  // Glosario sin IA.
  await page.getByText("Precios de esta semana").click(); // precios plegados: se abren a pedido
  await page.getByRole("button", { name: /Precio mayorista: qué significa/ }).click();
  await expect(page.getByRole("dialog", { name: /Precio mayorista/ })).toContainText("acopiador");
  await page.getByRole("dialog", { name: /Precio mayorista/ }).getByRole("button", { name: "Cerrar" }).click();

  // IA sin cuenta: explica que necesita guardar.
  await page.getByRole("button", { name: "Pregúntale a la IA" }).click();
  await expect(page.getByRole("dialog", { name: "Asistente IA" }).getByRole("link", { name: "Guardar y preguntar" })).toBeVisible();
  await page.getByRole("dialog", { name: "Asistente IA" }).getByRole("button", { name: "Cerrar" }).click();

  // Guardar → registro → vuelve con la consulta guardada.
  await page.getByRole("button", { name: "Crear cuenta y guardar" }).click();
  await expect(page).toHaveURL(/\/ingresar/);
  await page.getByRole("button", { name: "Regístrate" }).click();
  await page.getByLabel("Email").fill(`e2e-s-${Date.now()}@ceres.test`);
  await page.getByLabel(/Contraseña/).fill(`e2e-clave-${Date.now()}`);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Guardado en tu cuenta")).toBeVisible({ timeout: 20_000 });
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
  const parcels = await (await page.request.get("/api/v1/parcels")).json();
  const stored = await (await page.request.get(`/api/v1/parcels/${parcels.items[0].id}`)).json();
  expect(stored.geometry).toEqual(MAJES_FIELD);
  expect(stored.area_ha).toBe(field.area_ha);
  expect(stored.area_origin).toBe("geodesica");

  // Con cuenta, la IA ofrece conversar sobre este resultado.
  await page.getByRole("button", { name: "Pregúntale a la IA" }).click();
  await expect(page.getByRole("dialog", { name: "Asistente IA" }).getByLabel("Tu pregunta")).toBeVisible();
});

test("campo obligatorio: GeoJSON inválido, medición fallida y edición invalidan el área", async ({ page }) => {
  await page.goto("/app");
  const main = page.getByRole("main");
  const input = page.getByLabel("Pegar GeoJSON del campo", { exact: true });
  const useField = page.getByRole("button", { name: "Usar este campo" });
  await input.fill('{"type":"Point","coordinates":[-72,-16]}');
  await page.getByRole("button", { name: "Medir GeoJSON" }).click();
  await expect(main.getByRole("alert")).toContainText("Polygon");
  await expect(useField).toBeDisabled();
  await page.route("**/api/v1/geometry/area", (route) => route.fulfill({ status: 503, json: { error: { code: "sin_conexion", message: "No se pudo medir el campo" } } }));
  await input.fill(JSON.stringify(MAJES_FIELD));
  await page.getByRole("button", { name: "Medir GeoJSON" }).click();
  await expect(main.getByRole("alert")).toContainText("No se pudo medir");
  await expect(useField).toBeDisabled();
  await page.unroute("**/api/v1/geometry/area");
  await page.getByRole("button", { name: "Medir GeoJSON" }).click();
  await expect(useField).toBeEnabled();
  await input.fill("{}");
  await expect(useField).toBeDisabled();
  await expect(page.getByRole("heading", { name: "¿Qué sembraste último?" })).toHaveCount(0);
});

test("fuera del piloto: cuaderno disponible sin comparación ni estimaciones", async ({ page }) => {
  let comparisons = 0;
  page.on("request", (request) => { if (request.url().includes("/public/quick-compare")) comparisons += 1; });
  await page.goto("/app");
  const info = await delimitField(page, OUTSIDE_FIELD);
  expect(info.zone_id).toBeNull();
  await expect(page.getByRole("heading", { name: "Tu campo está fuera de los pilotos" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
  await page.getByRole("button", { name: "Crear cuenta y llevar mi cuaderno" }).click();
  await expect(page).toHaveURL(/\/ingresar/);
  const pending = await page.evaluate(() => JSON.parse(sessionStorage.getItem("ceres:sencillo:pendiente")!));
  expect(pending.field.geometry).toEqual(OUTSIDE_FIELD);
  expect(comparisons).toBe(0);
});

test("cuenta existente sin contorno pide delimitar antes de recuperar resultados", async ({ page, baseURL }) => {
  const { parcel } = await createTestParcel(page, baseURL!, false);
  let requestedRuns = false;
  page.on("request", (request) => { if (request.url().includes(`/parcels/${parcel.id}/recommendations`)) requestedRuns = true; });
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Delimita tu campo" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
  expect(requestedRuns).toBe(false);
  await delimitField(page);
  await expect(page.getByRole("heading", { name: "¿Qué sembraste último?" })).toBeVisible();
  const stored = await (await page.request.get(`/api/v1/parcels/${parcel.id}`)).json();
  expect(stored.geometry).toEqual(MAJES_FIELD);
});

for (const stale of ["motor", "sin_verificar", "contorno"] as const) {
  test(`resultado anterior incompatible (${stale}) pide recalcular y conserva el histórico`, async ({ page, baseURL }) => {
    const { parcel, headers } = await createTestParcel(page, baseURL!);
    const response = await page.request.post(`/api/v1/parcels/${parcel.id}/recommendations`, { headers, data: {} });
    expect(response.status()).toBe(201);
    const original = await response.json();
    if (stale === "contorno") {
      // Traslación de igual área: la comprobación por hectáreas sola no detecta el cambio.
      const moved = { ...MAJES_FIELD, coordinates: MAJES_FIELD.coordinates.map((ring) => ring.map(([lon, lat]) => [lon + 0.0001, lat])) };
      const patched = await page.request.patch(`/api/v1/parcels/${parcel.id}`, { headers, data: { geometry: moved } });
      expect(patched.ok()).toBe(true);
      expect((await patched.json()).area_ha).toBeCloseTo(parcel.area_ha, 3);
    } else {
      await page.route(`**/api/v1/recommendations/${original.id}`, async (route) => {
        const json = stale === "motor" ? { ...original, engine_version: "ceres-engine-0.4.0" } : { ...original, inputs: { ...original.inputs, field_verified: false } };
        await route.fulfill({ json });
      });
    }
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "¿Qué sembraste último?" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("el resultado anterior se conserva");
    await expect(page.locator("article")).toHaveCount(0);
    const unchanged = await (await page.request.get(`/api/v1/recommendations/${original.id}`)).json();
    expect(unchanged).toEqual(original);
  });
}

test("repetición desconocida se envía como null y el motor la trata con cautela", async ({ page }) => {
  await page.goto("/app");
  await delimitField(page);
  const compared = page.waitForResponse((r) => r.url().includes("/public/quick-compare") && r.ok());
  await answerProfile(page, { streak: "No sé" });
  const response = await compared;
  expect(response.request().postDataJSON().profile.current_crop_streak).toBeNull();
  const result = await response.json();
  expect(result.inputs.effective_profile.current_crop_streak).toBe(2);
  await expect(page.locator("article[aria-labelledby^='opt-']").first()).toBeVisible();
});
