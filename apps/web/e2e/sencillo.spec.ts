import { expect, test } from "@playwright/test";

test("mapa opcional: dibujar y medir sin cubrir los controles", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/app/chacra");
  // El mapa abre de entrada (diseño de escritorio); en el celular sigue siendo plegable.
  await expect(page.getByText("Dibujar mi terreno en el mapa", { exact: true })).toBeVisible();
  const canvas = page.locator(".map-wrap canvas");
  await expect(canvas).toBeVisible();
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
  await page.getByRole("button", { name: "Valle de Chilina", exact: true }).click();
  await page.getByRole("button", { name: /^Papa/ }).click();
  await page.getByRole("button", { name: /Sí, ya coseché/ }).click();
  const comparison = page.waitForResponse(r => r.url().includes("/public/quick-compare") && r.ok());
  await page.getByRole("button", { name: /Un poco de todo/ }).click();
  const result = await (await comparison).json();
  expect(result.inputs.zone_id).toBe("chilina");
  expect(result.result.climate_snapshot_id).toBe("nasa-power-e7430e42e9be");
  await expect(page.locator("article")).toHaveCount(3);
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
  // 3 plantillas + el plan sugerido por CERES (D) y el mejor por explorar (E) cuando el optimizador los encuentra.
  await expect(cards.nth(2)).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(3);
  expect(count).toBeLessThanOrEqual(5);
  // Ningún callejón sin salida: cada opción tiene un nivel en palabras simples y un titular.
  const badges = await cards.locator("span[class*=badge]").allInnerTexts();
  for (const label of badges) expect(label).toMatch(/Buena opción|Posible, confirma|Por explorar|No conviene/);
  expect(badges.join(" ")).not.toContain("No conviene"); // con «no sé» nada se descarta solo por un supuesto
  await expect(page.getByText("Requiere datos")).toHaveCount(0);
  const onion = cards.filter({ hasText: "Cebolla" });
  await expect(onion.getByText("Por explorar")).toBeVisible();
  await expect(onion.getByRole("note", { name: /sin validar/ })).toBeVisible(); // viabilidad antes que ganancia
  // Sencillez: el plan recomendado se marca con un ícono y una palabra; el riesgo, en dos palabras.
  await expect(cards.first().getByText("Te recomendamos")).toBeVisible();
  await expect(cards.first().getByText(/Riesgo (bajo|medio|alto)/)).toBeVisible();
  await expect(cards.first().getByText(/Rango probable/)).toHaveCount(0); // el detalle va bajo demanda
  await expect(page.getByText("Precios de esta semana")).toBeVisible();
  await expect(page.getByRole("note", { name: /NASA POWER/ }).first()).toBeAttached(); // sello NASA (ícono con tooltip)
  // Una sola pregunta de agua para toda la chacra (no una por tarjeta).
  await expect(page.getByText("¿Cuánta agua te llega al mes?")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

  // Pregunta decisiva observable → recalcula.
  const recalculated = page.waitForResponse((r) => r.url().includes("/api/v1/public/quick-compare") && r.ok());
  await page.getByRole("button", { name: "Goteo" }).click();
  await recalculated;
  const again = page.waitForResponse((r) => r.url().includes("/api/v1/public/quick-compare") && r.ok());
  await page.locator("#agua").getByRole("button", { name: / o más$/ }).click();
  await again;
  await expect(cards.first().getByText(/Buena opción|Posible, confirma/)).toBeVisible();

  // «Ver más» (?) abre el detalle en capas, con el riesgo y lo usado etiquetado.
  await cards.first().getByRole("button", { name: "Ver más" }).click();
  const why = page.getByRole("dialog", { name: "Por qué" });
  await expect(why.getByText("En pocas palabras")).toBeVisible();
  await expect(why.getByText(/Rango probable/)).toBeVisible();
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

  // Con cuenta, la IA ofrece conversar sobre este resultado.
  await page.getByRole("button", { name: "Pregúntale a la IA" }).click();
  await expect(page.getByRole("dialog", { name: "Asistente IA" }).getByLabel("Tu pregunta")).toBeVisible();
});
