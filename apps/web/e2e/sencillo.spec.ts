import { expect, test } from "@playwright/test";

// R15/R16/R20 (pasos 2–3): móvil 375 px, 3 preguntas, opciones útiles sin callejones sin salida,
// «¿Por qué?» en capas, pregunta decisiva que recalcula, y guardado en cuenta conservando la consulta.

test("modo sencillo en móvil: 3 preguntas → opciones → por qué → guardar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/app");

  await expect(page.getByRole("heading", { name: "¿Qué sembraste último?" })).toBeVisible();
  await page.getByRole("button", { name: /^Maíz Amarillo duro/ }).click();
  await page.getByRole("button", { name: /Sí, ya coseché/ }).click();
  const compared = page.waitForResponse((r) => r.url().includes("/api/v1/public/quick-compare") && r.ok());
  await page.getByRole("button", { name: /Ganar más/ }).click();
  await compared;

  const cards = page.locator("article");
  await expect(cards).toHaveCount(3);
  // Ningún callejón sin salida: cada opción tiene un nivel en palabras simples y un titular.
  const badges = await cards.locator("span[class*=badge]").allInnerTexts();
  for (const label of badges) expect(label).toMatch(/Buena opción|Posible, confirma|Por explorar|No conviene/);
  expect(badges.join(" ")).not.toContain("No conviene"); // con «no sé» nada se descarta solo por un supuesto
  await expect(page.getByText("Requiere datos")).toHaveCount(0);
  await expect(cards.filter({ hasText: "Cebolla" }).getByText("Por explorar")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

  // Pregunta decisiva observable → recalcula.
  const recalculated = page.waitForResponse((r) => r.url().includes("/api/v1/public/quick-compare") && r.ok());
  await page.getByRole("button", { name: "Goteo" }).click();
  await recalculated;
  const again = page.waitForResponse((r) => r.url().includes("/api/v1/public/quick-compare") && r.ok());
  await cards.first().getByRole("button", { name: "Sí, al menos eso" }).click();
  await again;
  await expect(cards.first().getByText(/Buena opción|Posible, confirma/)).toBeVisible();

  // «¿Por qué?» en capas, con lo usado etiquetado.
  await cards.first().getByRole("button", { name: "¿Por qué?" }).click();
  const why = page.getByRole("dialog", { name: "Por qué" });
  await expect(why.getByText("En pocas palabras")).toBeVisible();
  await expect(why.getByText("Lo que usamos")).toBeVisible();
  await expect(why.getByText("Tu respuesta").first()).toBeVisible();
  await why.getByRole("button", { name: "Cerrar" }).click();

  // Glosario sin IA.
  await cards.first().getByRole("button", { name: /Ganancia estimada: qué significa/ }).click();
  await expect(page.getByRole("dialog", { name: /Ganancia estimada/ })).toContainText("no es una ganancia garantizada");
  await page.getByRole("dialog", { name: /Ganancia estimada/ }).getByRole("button", { name: "Cerrar" }).click();

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
  await expect(cards).toHaveCount(3);

  // Con cuenta, la IA ofrece conversar sobre este resultado.
  await page.getByRole("button", { name: "Pregúntale a la IA" }).click();
  await expect(page.getByRole("dialog", { name: "Asistente IA" }).getByLabel("Tu pregunta")).toBeVisible();
});
