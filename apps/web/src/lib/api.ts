// Cliente de la API del mismo origen. Las cookies de sesión son HttpOnly; el token CSRF
// se lee de la cookie legible `ceres_csrf` y se envía en cada operación con cambios.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

function csrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.split("; ").find((c) => c.startsWith("ceres_csrf="));
  return m ? decodeURIComponent(m.split("=")[1]) : null;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  if (method !== "GET") {
    const t = csrfToken();
    if (t) headers.set("X-CSRF-Token", t);
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { ...init, method, headers, body, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError(0, "sin_conexion", "No se pudo conectar con el servidor de CERES");
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string; details?: { field: string; message: string }[] } })?.error;
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? `Error ${res.status}`, err?.details);
  }
  return data as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return { error: { code: "respuesta_invalida", message: "Respuesta no válida del servidor" } };
  }
}

export function fmtNumber(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("es-PE", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "medium", timeStyle: "short" });
}
