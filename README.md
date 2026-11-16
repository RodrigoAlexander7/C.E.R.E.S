# CERES Majes

Apoyo a decisiones de cultivo para la Irrigación Majes I (Arequipa): compara el plan del agricultor con dos alternativas usando clima histórico NASA POWER real, agua declarada, suelo, costos y prioridades; un asistente IA explica el resultado con fuentes. La decisión final es del agricultor.

- Encargo y alcance: [main.md](main.md) · requisitos: [specs/requisitos.md](specs/requisitos.md) · diseño: [specs/diseno.md](specs/diseno.md) · tareas: [specs/tareas.md](specs/tareas.md)
- Fuentes de datos: [recursos.md](recursos.md) · revisión agronómica: [data/zonas/majes/REVISION.md](data/zonas/majes/REVISION.md) · despliegue: [despliegue.md](despliegue.md)

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

Abrir http://localhost:3000: la landing pública está en `/`, el **modo sencillo** en `/app`, los módulos «Cuándo sembrar» en `/app/cuando` y «Mi chacra» en `/app/chacra`, con detalle técnico bajo «Ver más» y el caso público de demostración en `/demo`. Primero se delimita y confirma el campo; después cultivo, cosecha, disponibilidad de agua y repeticiones. La dirección vigente está en `main.md` §11 y `specs/tareas.md`.

Variables: `DATABASE_URL`, `APP_ORIGIN` y `DEV_INSECURE_COOKIES` son necesarias para arrancar (ver `.env.example`). `GEMINI_API_KEY` + `GEMINI_MODEL` habilitan el asistente con Google Gemini (proveedor elegido por el equipo; `OPENAI_API_KEY` + `OPENAI_MODEL` quedan como alternativa); sin claves la interfaz muestra «IA no conectada» y la explicación determinista del motor.

### Datos

Los archivos de `data/` ya están descargados y versionados. Para regenerarlos:

```bash
cd apps/api && uv run python -m ceres.cli fetch-nasa --zone majes
```

```bash
cd apps/api && uv run python -m ceres.cli fetch-regions
```

Comprobar el asistente con credenciales reales (no imprime la clave):

```bash
cd apps/api && uv run python -m ceres.cli check-llm
```

Validar el asistente real de punta a punta (crea una cuenta de prueba en la base de desarrollo y hace las preguntas de la demo):

```bash
cd apps/api && uv run python scripts/validar_asistente_real.py
```

El registro `data/zonas/registro.json` incluye Majes I y Valle de Chilina, cada uno con catálogo, supuestos e instantánea POWER propios. Para actualizar Chilina usa `fetch-nasa --zone chilina`; para el índice de fases ENSO usa `uv run python -m ceres.cli fetch-oni`. La revisión de Chilina está en [data/zonas/chilina/REVISION.md](data/zonas/chilina/REVISION.md).

## Pruebas

```bash
cd apps/api && uv run pytest
```

305 pruebas: ET0 contra el ejemplo 18 de FAO-56, lluvia efectiva FAO, calendario/horizonte/bisiestos, unidades mm→m³, margen por ciclos, costos directos, restricciones, zonas, reproducción, optimización de secuencias, precios SISAP, geometría con huecos, nutrición Arequipa e imágenes de suelo; integración con PostgreSQL real (propietarios aislados, sesiones, CSRF, historial, runs, HLS, campo obligatorio, escenarios de agua cualitativa y cuaderno); propuestas confirmadas y asistente con proveedor **simulado** (citas inventadas, cifras sin respaldo, inyección, contexto ajeno y cuotas). Incluyen confirmación de transacciones antes de enviar éxito HTTP, reintentos HLS y centros de píxel ausentes, área desconocida, exclusión de datos simulados de la economía propia y registro fuera de los pilotos sin tomar su clima ni catálogo. Las pruebas automáticas nunca llaman al proveedor real; la conexión real se valida aparte.

E2E del recorrido de aceptación y de la landing (con API y web en marcha):

```bash
cd apps/web && npx playwright test
```

## Cuaderno, agenda y Ceres

Las estimaciones personales requieren contorno, ubicación y hectáreas confirmados. `POST /api/v1/public/quick-compare` requiere `geometry` Polygon; el servidor calcula área/zona y rechaza valores contradictorios. Los resultados antiguos se conservan como historial y requieren recalcular si cambian motor o contorno. Agua verbal (`muy_poca`, `poca`, `media`, `alta`, `no_es_problema`) produce escenarios **supuestos y no calibrados** de SU zona, sin presentarlos como volúmenes medidos. El motor impide la tercera siembra consecutiva del mismo producto, contando antecedentes/campañas propias.

Las tarjetas distinguen margen bruto estimado, costos directos y capital de trabajo, con nombres/dibujos y fechas. Los policultivos incluyen motivos y faltantes: sin parámetros conjuntos revisados permanecen exploratorios, sin suma de monocultivos. La observación visual de Gemini admite hasta cuatro fotos; requiere revisión para aplicar y no guarda imágenes ni diagnostica EC/pH/NPK. Las fichas alimentarias INS/FAO se muestran separadas de fertilidad; el [contexto SIEN-HIS de Arequipa](data/nutricion/README.md) conserva denominadores, celdas y hash y no atribuye efectos clínicos a una siembra.

- `/app/cuaderno`: campañas, ventas, gastos y ganancia declarada; revisiones y agenda de labores con fechas. Los gastos incompletos permanecen desconocidos. Tus datos sustituyen los ejemplos del motor al crear otro run.
- `/app/ceres`: conversación con memoria autorizada del cuaderno. Propone altas y correcciones; la tarjeta «¿Guardo esto?» requiere confirmación. Puede pedir una simulación al motor y guarda un resultado nuevo.
- Texto y grabación de voz (máximo 2 minutos / 4 MB), sin guardar audio. Voz de salida del navegador. Micrófono y notificaciones son opcionales.
- `/app/chacra` y `/demo`: NDVI HLS real, mensual, con escena, nubes y píxeles válidos. Dibujar el contorno permite actualizar la serie propia. El seed carga demos reales cacheadas; no descarga satélite al desplegar.

Las cuentas privadas pueden registrar su historia y agenda fuera de los pilotos; las recomendaciones requieren catálogo y clima locales. Cada registro distingue `declarado` de `simulado_demo`. Estos últimos se muestran como ejemplos y no alimentan la economía propia del motor. `scripts/cargar_demo_privada.py` carga un caso idempotente desde archivos locales en `demo-private/`, excluidos de Git, del índice y del contexto Docker; nunca imprime coordenadas ni contraseñas.

Actualizar HLS fuera de peticiones web: `uv run python -m ceres.cli ndvi --parcel ID --start 2025-06-01 --end 2025-08-31`. Memoria máxima medida en local: 185 MiB; la lectura queda acotada por ventana y caché. Hay que medir de nuevo bajo concurrencia antes de ampliar el uso.

E2E completo: arrancar la API explícitamente con `uv run uvicorn tests.e2e_app:app --host 127.0.0.1 --port 8000` y sin claves LLM. Este servidor usa `FakeLanguageModel` y nunca se importa en producción. Luego `npx playwright test` (22 pruebas E2E, incluidos R20, fotos, nutrición, campo obligatorio y fallos de servicios). La validación real se ejecuta aparte con `uv run python scripts/validar_ceres_real.py`. [Guion de demo de 30 segundos](DEMO.md).

La serie HLS guardada se consulta sin espera. Buscar escenas nuevas tiene una espera de cinco minutos tras completar una consulta y de 30 segundos tras un fallo rápido. Si una escena falla se conservan las demás y el reintento omite las ya leídas. La falta de centros de píxel en un lote pequeño se muestra expresamente, sin inventar NDVI. Los límites de Gemini pertenecen al proyecto de Google; un 429 se muestra como cuota de IA y no impide usar los formularios. [Consultar los límites del proyecto en AI Studio](https://aistudio.google.com/rate-limit?timeRange=last-28-days).

## Estado de las validaciones del plan

| Validación | Estado |
|---|---|
| Datos NASA reales para Majes | **Hecho**: POWER diario 2015–2025, 4 018 días, 0 ausentes, SHA-256 en `data/zonas/majes/*.meta.json`. Celda a 835 m (la pampa está a ~1 400 m): limitación documentada. |
| Parámetros agronómicos y calendarios | **Revisión documental hecha** (Kc, etapas, salinidad, ET0). Calendarios, umbrales térmicos y economía siguen como supuestos/sin verificar: ver `data/zonas/majes/REVISION.md`. |
| Credenciales del asistente IA | **Conectadas en producción y verificadas aparte en local.** El 15-nov, `check-llm` respondió; la última ejecución del asistente clásico validó 3/4 preguntas (una falló por 504). `validar_ceres_real.py`, con respaldo configurado, completó extracción, confirmación, memoria y simulación con cifras/citas validadas. Las comprobaciones históricas están en `despliegue.md`. |
