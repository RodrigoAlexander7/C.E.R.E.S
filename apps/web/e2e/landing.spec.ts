import { expect, test } from "@playwright/test";

// R14: la landing explica la propuesta, muestra datos NASA reales de la API y lleva a probar sin cuenta.

test("landing con datos NASA reales, móvil sin scroll horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const ctx = page.waitForResponse((r) => r.url().endsWith("/api/v1/public/context") && r.ok());
  await page.goto("/");
  const body = await (await ctx).json();
  const yearlyEt0 = body.monthly_climatology.reduce((a: number, m: { et0_mm: number }) => a + m.et0_mm, 0);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Decide qué sembrar");
  // La cifra anual mostrada sale de la API (no está escrita a mano).
  await expect(page.getByText(Math.round(yearlyEt0).toLocaleString("es-PE")).first()).toBeVisible();
  // Vista previa con las 3 opciones reales del caso demo.
  await expect(page.locator('[aria-label*="Vista previa"] [class*="opt"]').filter({ hasText: "→" }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Interacción del gráfico: cambiar el mes cambia la cifra de ET0 del ciclo.
  const total = page.locator('[class*="resultBox"] strong').first();
  await total.scrollIntoViewIfNeeded();
  const before = await total.textContent();
  await page.getByRole("group", { name: "Mes de siembra" }).getByRole("button", { name: "Nov" }).click();
  await expect(total).not.toHaveText(before ?? "");

  // Lo próximo está marcado como tal.
  await expect(page.getByText("Próximamente").first()).toBeVisible();

  await page.getByRole("link", { name: "Ver el caso de Majes" }).first().click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole("heading", { name: /Caso público de demostración/ })).toBeVisible();
});
