import { expect, test } from "@playwright/test";

// API y PostgreSQL reales; arrancar el servidor E2E sin claves LLM.
test("recorrido sencillo, historial inmutable y aislamiento", async ({ page, browser, baseURL }) => {
  const assistant = await (await page.request.get("/api/v1/assistant/status")).json();
  expect(!assistant.configured || assistant.model === "simulado-pruebas", "E2E nunca debe usar un LLM real").toBe(true);
  await page.goto("/app");
  await page.getByRole("button", { name: /^Maíz Amarillo duro/ }).click();
  await page.getByRole("button", { name: /Sí, ya coseché/ }).click();
  await page.getByRole("button", { name: /Un poco de todo/ }).click();
  await expect(page.locator("article").nth(2)).toBeVisible(); // 3 plantillas (+ plan sugerido y por explorar)
  await page.getByRole("button", { name: "Crear cuenta y guardar" }).click();
  await page.getByRole("button", { name: "Regístrate" }).click();
  await page.getByLabel("Email").fill(`e2e-rec-${Date.now()}@ceres.test`);
  await page.getByLabel(/Contraseña/).fill("e2e-clave-segura-123");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByText("Guardado en tu cuenta")).toBeVisible();
  const parcels = await (await page.request.get("/api/v1/parcels")).json();
  const pid = parcels.items[0].id;
  const initialRuns = await (await page.request.get(`/api/v1/parcels/${pid}/recommendations`)).json();
  const firstId = initialRuns.items[0].id;
  await page.reload();
  await expect(page.getByText("Guardado en tu cuenta")).toBeVisible();
  await page.getByText("Resultados anteriores", { exact: true }).click();
  const history = page.locator("details").filter({ has: page.locator("summary", { hasText: /^Resultados anteriores$/ }) });
  await expect(history.locator("li")).toHaveCount(1);
  const created = page.waitForResponse(r => r.url().endsWith(`/parcels/${pid}/recommendations`) && r.request().method() === "POST" && r.ok());
  await page.locator("#agua").getByRole("button", { name: /^Menos de/ }).click();
  await created;
  await history.locator("summary").click();
  await history.locator("summary").click();
  await expect(history.locator("li")).toHaveCount(2);
  const original = await (await page.request.get(`/api/v1/recommendations/${firstId}`)).json();
  expect(original.inputs.profile.water.allocation_max_m3).toBeFalsy();
  await page.getByText("Detalle técnico de la comparación", { exact: true }).click();
  await expect(page.locator(".strategy-card").nth(2)).toBeVisible(); // ≥ 3 opciones (espera a que abra el detalle)
  await page.getByText("¿Por qué este estado? Reglas, datos faltantes y fuentes", { exact: true }).click();
  await page.getByRole("button", { name: "NASA-POWER", exact: true }).first().click();
  await expect(page.locator("dialog[open]")).toContainText("NASA Langley Research Center");
  await page.locator("dialog[open]").getByRole("button", { name: "Cerrar" }).click();
  await page.getByRole("button", { name: "Pregúntale a la IA" }).click();
  const chat = page.getByRole("dialog", { name: "Asistente IA" });
  await chat.getByLabel("Tu pregunta").fill("¿Qué me falta confirmar?");
  await chat.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(chat.getByText(/IA no conectada|Revisa el agua de tu chacra/)).toBeVisible();
  const conversations = await (await page.request.get(`/api/v1/parcels/${pid}/conversations`)).json();
  const cid = conversations.items[0].id;
  await chat.getByRole("button", { name: "Cerrar" }).click();
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await page.request.get(`/api/v1/parcels/${pid}`)).status()).toBe(401);

  const other = await browser.newContext({ baseURL });
  const origin = new URL(baseURL!).origin;
  const registered = await other.request.post("/api/v1/auth/register", {
    headers: { Origin: origin },
    data: { email: `e2e-other-${Date.now()}@ceres.test`, password: "e2e-clave-segura-123" },
  });
  expect(registered.status()).toBe(201);
  for (const path of [`parcels/${pid}`, `parcels/${pid}/recommendations`, `recommendations/${firstId}`, `conversations/${cid}`]) {
    expect((await other.request.get(`/api/v1/${path}`)).status()).toBe(404);
  }
  await other.close();
});
