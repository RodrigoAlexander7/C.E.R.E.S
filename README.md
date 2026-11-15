# CERES Majes

Apoyo a decisiones de cultivo para la Irrigación Majes I (Arequipa): compara el plan del agricultor con dos alternativas usando clima histórico NASA POWER real, agua declarada, suelo, costos y prioridades; un asistente IA explica el resultado con fuentes. La decisión final es del agricultor.

- Encargo y alcance: [main.md](main.md) · requisitos: [specs/requisitos.md](specs/requisitos.md) · diseño: [specs/diseno.md](specs/diseno.md) · tareas: [specs/tareas.md](specs/tareas.md)
- Fuentes de datos: [recursos.md](recursos.md) · revisión agronómica: [data/catalog/REVISION.md](data/catalog/REVISION.md) · despliegue: [despliegue.md](despliegue.md)

## Estructura

```text
apps/api/      FastAPI + dominio puro (motor, clima FAO-56) + SQLAlchemy/Alembic + adaptadores NASA/LLM
apps/web/      Next.js 16 (App Router) + MapLibre, solo tema claro
data/          paquete trazable: NASA POWER real (+hash), límites SERFOR/INEI, catálogo y fuentes
deploy/        Compose de producción, Caddy (HTTPS) y script de operación de la VM
.github/       CI (pull requests) y CD (main/manual) hacia ceres-vm en Azure
```

## Arranque local (comandos comprobados)

Requisitos: Docker + Compose, Python 3.12 con [uv](https://docs.astral.sh/uv/) 0.13, Node.js ≥ 20.9 (probado con 24).

```bash
cp .env.example .env
```

```bash
docker compose up -d db
```

```bash
cd apps/api && uv sync && uv run alembic upgrade head && uv run python -m ceres.cli seed
```

```bash
cd apps/api && uv run uvicorn ceres.main:app --host 127.0.0.1 --port 8000
```

```bash
cd apps/web && npm ci && npm run dev
```

Abrir http://localhost:3000. El caso público de demostración está en `/demo`.

Variables: `DATABASE_URL`, `APP_ORIGIN` y `DEV_INSECURE_COOKIES` son necesarias para arrancar (ver `.env.example`). `OPENAI_API_KEY` + `OPENAI_MODEL` habilitan el asistente; sin ellas la interfaz muestra «IA no conectada» y la explicación determinista del motor.

### Datos

Los archivos de `data/` ya están descargados y versionados. Para regenerarlos:

```bash
cd apps/api && uv run python -m ceres.cli fetch-nasa
```

```bash
cd apps/api && uv run python -m ceres.cli fetch-regions
```

Comprobar el asistente con credenciales reales (no imprime la clave):

```bash
cd apps/api && uv run python -m ceres.cli check-llm
```

## Pruebas

```bash
cd apps/api && uv run pytest
```

65 pruebas: ET0 contra el ejemplo 18 de FAO-56, lluvia efectiva FAO, calendario/horizonte/bisiestos, unidades mm→m³, margen por ciclos, restricciones de agua/salinidad/presupuesto, estados, reproducibilidad; integración con PostgreSQL real (dos cuentas aisladas, sesión revocada/expirada, CSRF/origen, historial, runs inmutables); asistente con proveedor **simulado** (citas inventadas, cifras sin respaldo, inyección en fichas, contexto ajeno). Los mocks no validan la conexión real con OpenAI.

E2E del recorrido de aceptación (con API y web en marcha):

```bash
cd apps/web && npx playwright test
```

## Estado de las validaciones del plan

| Validación | Estado |
|---|---|
| Datos NASA reales para Majes | **Hecho**: POWER diario 2015–2025, 4 018 días, 0 ausentes, SHA-256 en `data/nasa/*.meta.json`. Celda a 835 m (la pampa está a ~1 400 m): limitación documentada. |
| Parámetros agronómicos y calendarios | **Revisión documental hecha** (Kc, etapas, salinidad, ET0). Calendarios, umbrales térmicos y economía siguen como supuestos/sin verificar: ver `data/catalog/REVISION.md`. |
| Credenciales del asistente IA | **Pendiente**: no hay `OPENAI_API_KEY`/`OPENAI_MODEL` configuradas. Adaptador, validación y estado «IA no conectada» implementados y probados con proveedor simulado. |
