# syntax=docker/dockerfile:1.7
# Imagen de producción de la API (Linux x64). Contexto de build: raíz del repositorio.
# No contiene secretos: la configuración llega por variables de entorno en el servidor.

FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev --no-install-project
COPY apps/api/src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev --no-editable

FROM python:3.12-slim
ARG CERES_REVISION=dev
LABEL org.opencontainers.image.title="ceres-api" org.opencontainers.image.revision="${CERES_REVISION}"
RUN useradd --system --uid 10001 --home-dir /app ceres
WORKDIR /app
COPY --from=build /app/.venv /app/.venv
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/migrations ./migrations
# Paquete de datos trazable (NASA real, límites, catálogo, fuentes). La caché de distritos
# descargados bajo demanda se escribe en data/regions/distritos, por eso es del usuario ceres.
COPY --chown=ceres:ceres data /data
ENV PATH=/app/.venv/bin:$PATH \
    DATA_DIR=/data \
    PYTHONUNBUFFERED=1 \
    CERES_REVISION=${CERES_REVISION}
USER ceres
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4).status == 200 else 1)"
# Un solo worker: VM de 1 GiB. Las cabeceras X-Forwarded-* solo llegan desde el proxy interno.
CMD ["uvicorn", "ceres.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header"]
