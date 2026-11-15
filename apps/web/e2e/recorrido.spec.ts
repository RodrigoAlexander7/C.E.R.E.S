import { expect, test, type Page } from "@playwright/test";

// Recorrido de aceptación: mapa → Majes → dibujar → login (borrador) → comparar → escenario →
// fuentes → asistente → logout → otra cuenta no accede. Usa la API real y PostgreSQL.

const stamp = Date.now();
const userA = { email: `e2e-a-${stamp}@ceres.test`, password: `e2e-clave-${stamp}` };
const userB = { email: `e2e-b-${stamp}@ceres.test`, password: `e2e-clave-${stamp}` };

async function drawSquare(page: Page) {
  const map = page.locator(".map-wrap canvas");
  await expect(map).toBeVisible();
  const box = (await map.boundingBox())!;
  const cx = box.x + box.width * 0.55, cy = box.y + box.height * 0.45;
  for (const [dx, dy] of [[0, 0], [20, 0], [20, 15], [0, 15]]) await page.mouse.click(cx + dx, cy + dy);
}

test("recorrido principal y aislamiento", async ({ page, browser }) => {
  await page.goto("/avanzado");
  // Tema claro aunque el navegador prefiera oscuro.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(246, 244, 238)");

  // Geolocalización denegada: no bloquea.
  await page.getByRole("button", { name: "Usar mi ubicación" }).click();
  await expect(page.getByText(/No diste permiso|No se pudo obtener|no ofrece ubicación/)).toBeVisible();

  await page.getByRole("button", { name: "Ir a Majes I (piloto)" }).click();
  await expect(page.locator("#dist")).toHaveValue("dist:040520");
  await expect(page.getByText(/Zona piloto: Irrigación Majes I/)).toBeVisible();
  await page.waitForTimeout(1500); // animación de zoom

  await page.getByRole("button", { name: "Dibujar terreno" }).click();
  await drawSquare(page);
  await page.getByRole("button", { name: /Terminar \(4 puntos\)/ }).click();
  await expect(page.getByText(/Área estimada:/)).toBeVisible();
  await expect(page.getByText(/Distrito Majes/)).toBeVisible();

  await page.locator("#pname").fill("Lote E2E");
  await page.locator("#harvest").fill("2027-02-15");
  await page.getByLabel("Lo sé").check();
  await page.locator("#eff").fill("0.85");
  // Volumen amplio para que el agua no bloquee: el área depende del zoom.
  await page.locator("#alloc").fill("9000000");
  await page.getByLabel("Dinero").check();
  await page.getByRole("button", { name: /Iniciar sesión para guardar/ }).click();

  await expect(page).toHaveURL(/\/ingresar/);
  await expect(page.getByText(/Tu terreno y respuestas se conservan/)).toBeVisible();
  await page.getByRole("button", { name: "Regístrate" }).click();
  await page.getByLabel("Email").fill(userA.email);
  await page.getByLabel(/Contraseña/).fill(userA.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/\/avanzado$/);
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  await expect(page.getByText(/Área estimada:/)).toBeVisible(); // borrador restaurado
  await page.getByRole("button", { name: "Guardar y comparar", exact: true }).click();
  await expect(page).toHaveURL(/\/parcelas\/[0-9a-f]{32}$/);
  const parcelUrl = page.url();

  // Tres estrategias con estados honestos y evidencia NASA real.
  await expect(page.locator(".strategy-card")).toHaveCount(3);
  await expect(page.getByText(/instantánea\s+nasa-power-/)).toBeVisible();
  // Sin análisis de salinidad, frejol y cebolla (sensibles) no se declaran viables.
  const cardC = page.locator(".strategy-card").filter({ hasText: "C. Diversificar" });
  await expect(cardC.getByText("Requiere datos")).toBeVisible();
  await expect(cardC).toContainText("sensible a sales");

  // Recargar recupera la parcela.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Lote E2E" })).toBeVisible();

  // Cambiar agua → nuevo resultado, se conservan ambos.
  await page.locator("#scw").fill("1000");
  await page.getByRole("button", { name: "Recalcular comparación" }).click();
  await expect(page.locator(".strategy-card .status-no_viable")).toHaveCount(3);
  await expect(page.locator("table").filter({ hasText: "Historial" }).or(page.locator("section", { hasText: "Historial de comparaciones" }).locator("tbody tr"))).toHaveCount(2);

  // Abrir evidencia NASA.
  await page.getByRole("button", { name: "NASA-POWER" }).first().click();
  await expect(page.locator("dialog[open]")).toContainText("NASA Langley Research Center");
  await page.locator("dialog[open]").getByRole("button", { name: "Cerrar" }).click();

  // Asistente: respuesta respaldada o limitación clara (sin credenciales: «IA no conectada»).
  await page.getByRole("button", { name: "¿Qué cambia con menos agua?" }).click();
  // En CI no hay credenciales («IA no conectada», inmediato); en local puede llamar al proveedor real.
  await expect(page.locator(".msg-assistant").first()).toBeVisible({ timeout: 120_000 });
  await expect(page.locator(".msg-assistant").first()).toContainText(/IA no conectada|agua|dotación/i);

  // Logout y aislamiento.
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/); // tras cerrar sesión vuelve a la landing pública
  await expect(page.getByRole("banner").getByRole("link", { name: "Ingresar" })).toBeVisible();

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.goto("/ingresar");
  await pageB.getByRole("button", { name: "Regístrate" }).click();
  await pageB.getByLabel("Email").fill(userB.email);
  await pageB.getByLabel(/Contraseña/).fill(userB.password);
  await pageB.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(pageB.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  await pageB.goto(parcelUrl);
  await expect(pageB.getByText("Parcela no encontrada.")).toBeVisible();
  const id = parcelUrl.split("/").pop();
  const status = await pageB.evaluate(async (pid) => (await fetch(`/api/v1/parcels/${pid}/recommendations`)).status, id);
  expect(status).toBe(404);
  await ctxB.close();
});
