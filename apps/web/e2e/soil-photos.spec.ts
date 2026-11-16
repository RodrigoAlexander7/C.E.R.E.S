// Componente real en un navegador aislado. No requiere Next, API, DB ni LLM real.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import type { ComparisonResult, NutritionImpact, Strategy } from "../src/lib/types";

const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));
const webRoot = path.dirname(nodeRequire.resolve("react-dom/client"));
const reactRoot = path.dirname(nodeRequire.resolve("react"));
const schedulerRoot = path.dirname(nodeRequire.resolve("scheduler"));
const compile = (filename: string) => ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

// Empaquetado CJS mínimo de dependencias instaladas; no CDN ni servidor de pruebas.
const modules: Record<string, string> = {
  react: readFileSync(path.join(reactRoot, "cjs/react.development.js"), "utf8"),
  "react/jsx-runtime": readFileSync(path.join(reactRoot, "cjs/react-jsx-runtime.development.js"), "utf8"),
  "react-dom": readFileSync(path.join(webRoot, "cjs/react-dom.development.js"), "utf8"),
  "react-dom/client": readFileSync(path.join(webRoot, "cjs/react-dom-client.development.js"), "utf8"),
  scheduler: readFileSync(path.join(schedulerRoot, "cjs/scheduler.development.js"), "utf8"),
  "@/lib/api": compile(path.resolve("src/lib/api.ts")),
  component: compile(path.resolve("src/components/simple/SoilPhotoCapture.tsx")),
  "./SoilPhotoCapture": compile(path.resolve("src/components/simple/SoilPhotoCapture.tsx")),
  "./CropPlanVisual": compile(path.resolve("src/components/simple/CropPlanVisual.tsx")),
  "./icons": compile(path.resolve("src/components/simple/icons.tsx")),
  results: compile(path.resolve("src/components/simple/results.tsx")),
  tierra: compile(path.resolve("src/components/simple/tierra.tsx")),
  "@/lib/tierra": compile(path.resolve("src/lib/tierra.ts")),
  "@/lib/zones": compile(path.resolve("src/lib/zones.ts")),
  // Aislar conectores y ayudas ajenos al componente; captura, resultados y tierra son reales.
  "@/components/NasaBadge": "exports.NasaBadge = () => require('react').createElement('span', {}, 'NASA POWER');",
  "@/components/Sources": "exports.SourceChips = ({ids}) => require('react').createElement('span', {}, ids.join(', '));",
  "./help": "exports.Term = ({children}) => children; exports.Sheet = ({open,children}) => open ? require('react').createElement('div', {}, children) : null;",
  "./simple.module.css": "module.exports = {__esModule:true, default:new Proxy({}, {get: (_, key) => key})};",
};
const bundle = `(() => {
  const process = {env: {NODE_ENV: 'development'}};
  const modules = {${Object.entries(modules).map(([name, source]) => `${JSON.stringify(name)}: function(module,exports,require){${source}\n}`).join(",\n")}};
  const cache = {};
  function require(name) { if (cache[name]) return cache[name].exports; const m = cache[name] = {exports:{}}; modules[name](m,m.exports,require); return m.exports; }
  const React = require('react');
  const Component = require('component').SoilPhotoCapture;
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  window.__applied = [];
  window.__patches = [];
  window.__render = (kind, props = {}) => {
    const results = require('results');
    const cropLabel = id => ({maiz_grano:'Maíz amarillo duro (grano seco)',frejol_grano:'Frejol canario (grano seco)'})[id] || id;
    const component = kind === 'tierra' ? require('tierra').TierraForm : results[kind];
    require('react-dom').flushSync(() => root.render(React.createElement(component, {...props, cropLabel, onAnswer: patch => window.__patches.push(patch), onWhy: () => {}, onClose: () => {}, onMore: () => {}})));
  };
  function Harness() {
    const [disabled, setDisabled] = React.useState(false);
    return React.createElement('div', {},
      React.createElement(Component, {disabled, onApply: value => window.__applied.push(value)}),
      React.createElement('button', {onClick: () => setDisabled(value => !value)}, 'Alternar captura'),
      React.createElement('button', {onClick: () => root.unmount()}, 'Cerrar captura'),
      React.createElement('button', {}, 'Elegir signos manualmente')
    );
  }
  root.render(React.createElement(Harness));
})();`;

const assessment = {
  salinity_signs: "no_concluyente",
  description: "La superficie está desenfocada.",
  limitations: "No se distingue el suelo con suficiente detalle. Una foto no confirma ni descarta salinidad.",
  source: "gemini_visual",
};
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=", "base64");
const photo = (name = "campo.png") => ({ name, mimeType: "image/png", buffer: tinyPng });

async function mount(page: Page) {
  await page.route("http://soil-photos.test/", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="es"><body><div id="root"></div></body></html>' }));
  await page.addInitScript(() => {
    const state = window as unknown as { __urls: Set<string> };
    state.__urls = new Set();
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); state.__urls.add(url); return url; };
    URL.revokeObjectURL = url => { state.__urls.delete(url); revoke(url); };
  });
  await page.goto("http://soil-photos.test/");
  await page.addScriptTag({ content: bundle });
  await page.addStyleTag({ content: readFileSync(path.resolve("src/components/simple/simple.module.css"), "utf8") });
  await page.addStyleTag({ content: "*{box-sizing:border-box}body{margin:0;padding:16px}#root{max-width:760px;margin:auto}" });
  await page.locator("body").evaluate(body => { body.className = "shell"; });
  await expect(page.getByRole("heading", { name: "Observar el suelo con fotos (opcional)" })).toBeVisible();
}

test.beforeEach(async ({ page }) => { await mount(page); });

test("comprime cuatro fotos, mantiene incertidumbre y solo aplica tras confirmación", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const source = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 2400; canvas.height = 1600;
    const context = canvas.getContext("2d")!; context.fillStyle = "#ab8960"; context.fillRect(0, 0, 2400, 1600);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  let sent = "";
  await page.route("**/api/v1/public/soil-photos", async route => {
    sent = route.request().postData()!;
    await route.fulfill({ json: assessment });
  });
  await page.getByLabel("Elegir fotos", { exact: true }).setInputFiles(Array.from({ length: 4 }, (_, i) => ({ name: `private-name-${i}.png`, mimeType: "image/png", buffer: Buffer.from(source, "base64") })));
  await expect(page.getByRole("status")).toHaveText("4 de 4 fotos listas.");
  await expect(page.getByRole("img")).toHaveCount(4);
  expect(sent).toBe("");
  await page.getByRole("button", { name: "Observar fotos con IA" }).click();
  const title = page.getByRole("heading", { name: "No se puede concluir con estas fotos" });
  await expect(title).toBeVisible();
  await expect(title).toBeFocused();
  expect(Buffer.byteLength(sent)).toBeLessThanOrEqual(5_000_000);
  expect(sent).not.toContain("private-name");
  const images = JSON.parse(sent).images;
  expect(images).toHaveLength(4);
  for (const image of images) {
    expect(Object.keys(image).sort()).toEqual(["data_base64", "mime"]);
    expect(image.mime).toBe("image/jpeg");
    const dimensions = await page.evaluate(async b64 => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
      const dimensions = [bitmap.width, bitmap.height]; bitmap.close(); return dimensions;
    }, image.data_base64);
    expect(Math.max(...dimensions)).toBe(1280);
  }
  expect(await page.evaluate(() => (window as unknown as { __applied: unknown[] }).__applied)).toEqual([]);
  await page.getByRole("button", { name: "Usar observación" }).click();
  expect(await page.evaluate(() => (window as unknown as { __applied: unknown[] }).__applied)).toEqual([assessment]);
  await expect(page.getByRole("button", { name: "Usar observación" })).toBeDisabled();
});

test("cuota conserva las fotos y la alternativa manual permite continuar", async ({ page }) => {
  await page.route("**/api/v1/public/soil-photos", route => route.fulfill({ status: 503, json: { error: { code: "ia_sin_cuota", message: "El servicio de IA alcanzó su límite de uso. Puedes usar el formulario e intentarlo más tarde" } } }));
  await page.getByLabel("Elegir fotos", { exact: true }).setInputFiles(photo());
  await expect(page.getByRole("status")).toHaveText("1 de 4 fotos listas.");
  await page.getByRole("button", { name: "Observar fotos con IA" }).click();
  await expect(page.getByRole("alert")).toContainText("límite de uso");
  await expect(page.getByRole("img")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Observar fotos con IA" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Elegir signos manualmente" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Usar observación" })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __applied: unknown[] }).__applied)).toEqual([]);
});

test("rechaza más de cuatro y formatos no admitidos sin enviar, libera previews", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/v1/public/soil-photos", route => { calls++; return route.fulfill({ json: assessment }); });
  const input = page.getByLabel("Elegir fotos", { exact: true });
  await input.setInputFiles(Array.from({ length: 5 }, (_, i) => photo(`${i}.png`)));
  await expect(page.getByRole("alert")).toContainText("hasta cuatro");
  await expect(page.getByRole("img")).toHaveCount(0);
  await input.setInputFiles({ name: "x.gif", mimeType: "image/gif", buffer: tinyPng });
  await expect(page.getByRole("alert")).toContainText("JPEG, PNG o WebP");
  await input.setInputFiles([photo(), photo("otra.png")]);
  await expect(page.getByRole("img")).toHaveCount(2);
  expect(await page.evaluate(() => (window as unknown as { __urls: Set<string> }).__urls.size)).toBe(2);
  await page.getByRole("button", { name: "Quitar foto 1", exact: true }).click();
  await expect(page.getByRole("img")).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { __urls: Set<string> }).__urls.size)).toBe(1);
  await page.getByRole("button", { name: "Cerrar captura" }).click();
  expect(await page.evaluate(() => (window as unknown as { __urls: Set<string> }).__urls.size)).toBe(0);
  expect(calls).toBe(0);
});

test("disabled impide captura y aplicar; cambiar fotos invalida el resultado anterior", async ({ page }) => {
  await page.route("**/api/v1/public/soil-photos", route => route.fulfill({ json: assessment }));
  await page.getByRole("button", { name: "Alternar captura" }).click();
  await expect(page.getByLabel("Elegir fotos", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Observar fotos con IA" })).toBeDisabled();
  await page.getByRole("button", { name: "Alternar captura" }).click();
  await page.getByLabel("Tomar una foto con la cámara").setInputFiles(photo());
  await expect(page.getByRole("status")).toHaveText("1 de 4 fotos listas.");
  await page.getByRole("button", { name: "Observar fotos con IA" }).click();
  await expect(page.getByRole("button", { name: "Usar observación" })).toBeVisible();
  await page.getByRole("button", { name: "Alternar captura" }).click();
  await expect(page.getByRole("button", { name: "Usar observación" })).toBeDisabled();
  await page.getByRole("button", { name: "Alternar captura" }).click();
  await page.getByRole("button", { name: "Quitar foto 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Usar observación" })).toHaveCount(0);
});

// Cifras centinela solo del fixture: detectan filtraciones de totales sin área.
const strategy: Strategy = {
  strategy_id: "A", name: "Plan del fixture", short: "Plan", status: "no_viable", sequence: ["maiz_grano", "frejol_grano"],
  timeline: [{ kind: "cultivo", crop_id: "maiz_grano", start: "2027-01-01", end: "2027-05-01", label: "Maíz", stages: [], why: [] }],
  metrics: { "A.eco.costos_directos": { id: "A.eco.costos_directos", label: "Costos directos", value: 91357, unit: "S/", kind: "supuesto_demo", method: "fixture", source_ids: [], detail: "fixture" } },
  reasons: [], assumptions: [], missing: [], monthly_water: [], soil: {}, summary: "", rank: null,
  simple: { type: "rotacion", rationale: "Razón del escenario para revisar localmente.", level: "posible", label: "Posible, confirma", names: "", headline: "Confirma el agua del escenario.", tags: [], facts: { margin_soles: 82139, margin_kind: "supuesto_demo", water_m3: 71293, first_sowing: "2027-01-01", cycles: 1 } },
  decisive: [{ id: "sal", label: "sal", question: "¿Ves signos de sal?", detail: "Observación manual", source_ids: [], answers: [{ label: "Sí, se ven", patch: { "soil.salinity_signs": "con_signos" } }] }],
};
const result = { strategies: [strategy], horizon_start: "2027-01-01", horizon_end: "2028-12-31" } as ComparisonResult;
async function render(page: Page, kind: string, props: object = {}) {
  await page.evaluate(({ kind, props }) => (window as unknown as { __render: (kind: string, props: object) => void }).__render(kind, props), { kind, props });
}
async function patches(page: Page) {
  return page.evaluate(() => (window as unknown as { __patches: unknown[] }).__patches);
}

test("preguntas aplica incertidumbre como null y una respuesta manual borra la evaluación", async ({ page }) => {
  await page.route("**/api/v1/public/soil-photos", route => route.fulfill({ json: assessment }));
  await render(page, "GlobalQuestions", { result, area: 0, busy: false });
  await page.getByLabel("Elegir fotos", { exact: true }).setInputFiles(photo());
  await expect(page.getByRole("status")).toHaveText("1 de 4 fotos listas.");
  await page.getByRole("button", { name: "Observar fotos con IA" }).click();
  expect(await patches(page)).toEqual([]);
  await page.getByRole("button", { name: "Usar observación" }).click();
  expect(await patches(page)).toEqual([{ "soil.salinity_signs": null, "soil.photo_assessment": assessment }]);
  await page.getByRole("button", { name: "Sí, se ven", exact: true }).click();
  expect((await patches(page)).at(-1)).toEqual({ "soil.salinity_signs": "con_signos", "soil.photo_assessment": null });
  await expect(page.getByRole("button", { name: "Usar observación" })).toHaveCount(0);
  await page.getByRole("button", { name: "No sé", exact: true }).click();
  expect((await patches(page)).at(-1)).toEqual({ "soil.salinity_signs": null, "soil.photo_assessment": null });
});

test("tierra guarda solo observación elegida y el cambio manual la elimina", async ({ page }) => {
  await page.route("**/api/v1/public/soil-photos", route => route.fulfill({ json: assessment }));
  await render(page, "tierra");
  await expect(page.getByRole("heading", { name: "¿Cómo está tu tierra?", exact: true })).toBeVisible();
  await page.getByLabel("Elegir fotos", { exact: true }).setInputFiles(photo("private-field.png"));
  await expect(page.getByRole("status")).toHaveText("1 de 4 fotos listas.");
  await page.getByRole("button", { name: "Observar fotos con IA" }).click();
  await page.getByRole("button", { name: "Usar observación" }).click();
  await page.getByRole("button", { name: "Guardar datos de mi chacra" }).click();
  const saved = await page.evaluate(() => localStorage.getItem("ceres:tierra")!);
  expect(JSON.parse(saved)).toEqual({ salinity_signs: null, photo_assessment: assessment });
  expect(saved).not.toMatch(/data_base64|private-field|blob:|data:image/);
  await page.getByRole("button", { name: "No veo signos claros", exact: true }).click();
  await page.getByRole("button", { name: "Guardar datos de mi chacra" }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ceres:tierra")!))).toEqual({ salinity_signs: "sin_signos", photo_assessment: null });
});

test("tarjeta respeta posible R16, cultivos y calendario; oculta totales sin área", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await render(page, "OptionCard", { st: strategy, result, busy: false });
  await expect(page.getByRole("heading", { name: "Maíz amarillo duro (grano seco) y Frejol canario (grano seco)", exact: true })).toBeVisible();
  await expect(page.getByText("Posible, confirma", { exact: true })).toBeVisible();
  await expect(page.getByText("Rotación · cultivos en campañas sucesivas")).toBeVisible();
  await expect(page.locator("time").first()).toHaveAttribute("datetime", "2027-01-01");
  await expect(page.locator("dd").filter({ hasText: "Pendiente de delimitar el área" })).toHaveCount(5);
  expect(await page.locator("article").innerText()).not.toMatch(/82,139|91,357|71,293/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await render(page, "OptionCard", { st: strategy, result, areaHa: 2, zoneName: "Zona del fixture", busy: false });
  await expect(page.locator("dd").filter({ hasText: "S/ 91,357" })).toHaveCount(1);
  await expect(page.getByText("Escenario con cifras de ejemplo", { exact: false })).toBeVisible();
});

test("nutrición renderiza el objeto real Arequipa y sus porcentajes sin multiplicar", async ({ page }) => {
  const regional_context = JSON.parse(readFileSync(path.resolve("../../data/nutricion/arequipa_context.json"), "utf8"));
  const nutrition: NutritionImpact = { foods: [], explanation: "Contexto regional proporcionado para revisión.", source_ids: regional_context.source_ids, regional_context };
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await render(page, "NutritionSection", { nutrition });
  await page.getByText("Contexto de alimentación y salud de Arequipa · SIEN-HIS", { exact: true }).click();
  await expect(page.getByText("Población evaluada: " + regional_context.population + ".", { exact: true })).toBeVisible();
  const anemia = regional_context.indicators.find((item: { id: string }) => item.id === "anemia_total");
  const row = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: anemia.label, exact: true }) });
  await expect(row).toContainText(anemia.percent.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + anemia.percent_unit);
  await expect(row).toContainText(anemia.denominator.toLocaleString("es-PE"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
