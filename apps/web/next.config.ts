import type { NextConfig } from "next";

// La API se sirve bajo el mismo origen (/api/v1) mediante un rewrite: las cookies HttpOnly
// y Set-Cookie viajan sin CORS abierto. API_ORIGIN solo se lee en el servidor de Next.
const apiOrigin = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Artefacto reducido para producción (node server.js). En producción el proxy Caddy envía
  // /api/* directamente a FastAPI; el rewrite solo se usa en desarrollo.
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` },
      { source: "/api/docs", destination: `${apiOrigin}/api/docs` },
      { source: "/api/openapi.json", destination: `${apiOrigin}/api/openapi.json` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
