import { defineConfig } from "@playwright/test";

// E2E contra la app en ejecución (web + API + PostgreSQL). BASE_URL permite apuntar a otro entorno.
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    channel: process.env.PW_CHANNEL ?? "chrome",
    headless: true,
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark", // la app debe seguir en tema claro aunque el sistema prefiera oscuro
    permissions: [],
  },
});
