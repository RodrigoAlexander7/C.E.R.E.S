# syntax=docker/dockerfile:1.7
# Imagen de producción del frontend: Next.js standalone (sin servidor de desarrollo).
# Se construye en GitHub Actions; la VM solo descarga y ejecuta. Contexto: raíz del repositorio.

FROM node:24.16-alpine AS deps
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
COPY apps/web/scripts ./scripts
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM node:24.16-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web ./
RUN node scripts/copy-maplibre-worker.mjs && npm run build

FROM node:24.16-alpine
ARG CERES_REVISION=dev
LABEL org.opencontainers.image.title="ceres-web" org.opencontainers.image.revision="${CERES_REVISION}"
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 CERES_REVISION=${CERES_REVISION}
RUN addgroup -S ceres && adduser -S -G ceres ceres
COPY --from=build --chown=ceres:ceres /app/.next/standalone ./
COPY --from=build --chown=ceres:ceres /app/.next/static ./.next/static
COPY --from=build --chown=ceres:ceres /app/public ./public
USER ceres
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--max-old-space-size=160", "server.js"]
