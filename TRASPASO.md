# Traspaso de la sesión del 15-nov-2026

Este documento es para el agente que continúe. Explica qué se hizo, qué falta, qué decidió el usuario y qué se recomienda.

## Continuación comprobada con Codex (15-nov-2026)

Este apartado actualiza el estado histórico que sigue debajo.

- Repositorio indexado con **codebase-memory-mcp**, proyecto `ceres`, modo `full`: 9 923 nodos y 14 616 relaciones iniciales; sin archivos saltados ni análisis parciales registrados. `deploy/` está excluido por diseño y se revisó directamente. Consultar `index_status` para la generación vigente.
- El usuario autorizó expresamente usar las herramientas disponibles para leer y editar, incluido `apply_patch`, al no existir Read/Edit/Write en esta sesión.
- **Cerrados localmente los incrementos 15 y 10:** casillas marcadas con evidencia en `specs/tareas.md`. La cifra correcta es **88 pruebas API**, no 89: todas pasan contra PostgreSQL real; `alembic check` no detecta diferencias de modelo.
- **Cinco E2E pasan** sobre build de producción: landing, guardado/recarga/recalculado/historial/fuentes/chat/logout/aislamiento, móvil Majes, Chilina con tabla NOAA y navegación, mapa opcional con cuatro vértices y área calculada.
- Corregidos dos fallos del rediseño: caché del historial se invalida al cambiar run/parcela; mapa vuelve a estar contenido en `.map-wrap` y ya no intercepta los botones.
- Documentación actualizada a aplicación por módulos sin modo avanzado en `main.md`, R15/R20, diseño §9 y README. Eliminada variable obsoleta `NASA_SNAPSHOT_FILE`; corregidas rutas de fuentes; creada `data/zonas/chilina/REVISION.md`.
- Caddy ahora permite `microphone=(self)`, igual que Next.js. El script de despliegue ya ejecuta migración, seed y recarga del proxy al cambiar el Caddyfile.
- Servidores de prueba aislados: API 8001 con claves LLM vacías, web 3001 (`API_ORIGIN=http://127.0.0.1:8001`). Los servidores originales 8000/3000 siguen perteneciendo a la sesión previa; el 8000 tiene LLM real, **no usarlo para E2E**. El nuevo E2E aborta si `/health` declara `llm_configured=true`.
- Publicado y verificado en Azure: `81920443e69fce4cc22667b907eafba577df12f5`, health `ok`, motor 0.3.0 y ambas zonas con snapshots distintos. Demo Chilina y ventana de siembra de 12 meses con ONI responden; redirección `/avanzado` → `/app` y cabecera de micrófono comprobadas. Workflow `43724182378`; detalles en `despliegue.md`.

Siguiente trabajo funcional: incremento 11 HLS (escenas reales, Fmask y persistencia), después 12–14. La comparación anterior con Earth Engine no se verificó técnicamente en esta continuación: no tratar como hechos que exija una cuenta de servicio, que sea pesado o que la publicación sea incompatible. La elección de catálogo público sigue autorizada por el usuario.

**Acceso HLS comprobado durante esta continuación:** consulta STAC GET `/api/stac/v1/search` de Planetary Computer, colecciones `hls2-l30,hls2-s30`, periodo 2025, bbox de las demos. Ambas zonas devuelven HTTP 200, firma SAS HTTP 200 y lectura `Range: bytes=0-15` de B04 con HTTP 206 (16 bytes):

- Majes: `HLS.S30.T18KYG.2025365T145941.v2.0`, adquisición `2025-12-31T15:08:01.774750Z`.
- Chilina: `HLS.S30.T18KZG.2025365T145941.v2.0`, adquisición `2025-12-31T15:07:59.113370Z`.
- Recursos públicos: `https://hls2euwest.blob.core.windows.net/hls2/S30/`; disponibles B04, B8A y Fmask. Para S30 usar **B8A**, no B05 (B05 es una banda red-edge); para L30 usar B05. La correspondencia está documentada por NASA en `https://hls.gsfc.nasa.gov/algorithms/`.
- No se conservaron los tokens SAS. Esta comprobación solo prueba acceso al catálogo y al archivo, no píxeles útiles, porcentaje despejado, cobertura completa del polígono ni una serie NDVI calculada; el incremento 11 sigue abierto.

Lee primero, en este orden:

1. `main.md` §11
2. `specs/requisitos.md` R14–R20
3. `specs/diseno.md` §9
4. `specs/tareas.md` (incrementos 7–15)
5. Este archivo

Reglas que siguen vigentes:

- AGENTS.md: edita solo con Edit/Write, nunca con sed/awk/python/heredocs. En esta sesión se rompió una vez esta regla: se añadió `.zoneTabs` a `landing.module.css` con heredoc. No lo repitas.
- Commits sin línea Co-Authored-By de Claude.
- Push a `main` = despliegue en producción (CI → GHCR → ceres-vm).

## 1. Estado del repositorio

- **Última revisión funcional publicada y verificada:** `8192044`. Sustituye a `530b761` en producción.
- `66b1c25` (zonas/ventana) y `480aebc` (rediseño) también quedaron publicados con ella.
- El bloqueo E2E de esta sección histórica quedó resuelto en la continuación de Codex; consultar el apartado actualizado de arriba.

## 2. Hecho y comprobado

### Incremento 15 — segundo piloto Valle de Chilina

Backend completo. Actualización: 88 pruebas pytest comprobadas con PostgreSQL y casillas de los incrementos 15/10 marcadas en la continuación de Codex.

**Registro de zonas**

- Estructura: `data/zonas/registro.json` y `data/zonas/<zona>/{zona.json, catalogo.json, nasa_power_daily_2015_2025.json(+meta)}`.
- Majes se movió a esa estructura con `git mv`, sin cambiar valores (solo el formato del catálogo).
- Código: `infrastructure/zones.py` (ZoneRuntime, ZoneRegistry), `domain/model.py` (`ZoneContext`).
- El motor ya no lleva textos ni fuentes de Majes escritos en el código. Las plantillas usan `sequence_rule: "alternar"` con la lista `crops`.
- `ENGINE_VERSION` pasó a 0.3.0.
- El run guarda en sus entradas `zone_id`, `zone_version` y `own_economics`. `evaluate_frozen(inputs, zone)` reproduce el resultado con la zona del run.
- Las parcelas tienen columna `zone_id` (migración `b7c1d2e3f405`, aditiva, rellena `majes` donde `in_pilot_zone`).
- Validación de cultivos por zona: error 422 `cultivo_de_otra_zona`.
- `PATCH /parcels/{id}` acepta `geometry`, pero solo dentro de la misma zona (si no, 422 `otra_zona`).

**Chilina**

| Aspecto | Valor y fuente |
|---|---|
| Distritos | Cayma 040103 y Alto Selva Alegre 040102, verificados con SERFOR/INEI y las parcelas de OSM. El sur (Arequipa 040101, Yanahuara 040126) queda fuera por ser urbano. |
| Clima | NASA POWER real, punto -16,362 / -71,535, 4 018 días, 0 ausentes, snapshot `nasa-power-e7430e42e9be`. |
| Limitación del clima | La celda está a 3 330 m y el valle a ~2 400 m (SRTM). La celda es más fría: exagera heladas e infraestima la demanda de agua. Está documentado y no se corrigió. |
| Agua | ≈ 23 000 m³/ha/año como `supuesto_zona`: 1,7268 hm³ (RA 0097-2022 ANA) ÷ 75,08 ha (RA 0258-2025 ANA). Abrí y leí los dos PDF. Vale para la margen de Alto Selva Alegre; la comisión que riega la margen de Cayma no está verificada. |
| Método de riego | Gravedad (60 %) como supuesto, a partir de EOS 2021. No está verificado en parcela. |
| Catálogo | Cebolla (FAO-56 «Arid Calif.» 210 d), papa (semi-árido 130 d) y maíz («East Africa alt.» 180 d). Kc y salinidad de FAO-56 y FAO 29. |
| Ajo | Sin ficha: no figura en FAO-56 tabla 11 ni en FAO 29. Se acepta como cultivo declarado, sin evaluación. |
| Calendario | No hay calendario oficial. Cebolla junio–julio, inferido de SENAMHI (`sin_verificar`). Papa y maíz no se restringen por mes (`sin_calendario`). |
| Helada | Regla de mínima < 0 °C, marcada `sin_verificar`. |
| Economía | Vacía (`sin_dato`): el margen queda pendiente hasta que el agricultor registre sus datos en el cuaderno. |
| Demo | Parcela de demostración en Alto Selva Alegre. |

- Fuentes nuevas en `data/sources/sources.json` (versión `fuentes-2026-11-15.2`): NASA-POWER-CHILINA, ZONA-CHILINA, ANA-CHILI-REGULADO-2022, ANA-PAMPAS-NUEVAS-2025, EOS-AREQUIPA-2021, SENAMHI-CAMPINA-2025, SENAMHI-AJO-CEBOLLA, SRTM-ELEVACION, UMBRAL-HELADA-CHILINA y NOAA-ONI, con sus fichas para FTS.
- Resultado: con «no sé» en todo, Chilina da opciones «Posible, confirma tu agua», nunca «Buena», sin callejones sin salida. Lo prueba `tests/integration/test_zones.py`.

**Endpoints públicos:** `GET /public/zones`, `?zone=` en `/public/context`, `/catalog`, `/public/demo` y `/public/zone`, y `zone_id` en `POST /public/quick-compare`.

### Incremento 10 — ¿Cuándo me conviene sembrar? y años El Niño

Backend y componente hechos; comprobados en build de producción y E2E de landing/módulo móvil en la continuación de Codex.

- **Motor:** `domain/engine.py: sowing_window()` reutiliza `_water` y `_thermal`, el mismo cálculo que la comparación. `enso_summary()` agrupa las campañas por fase.
- **Fases:** `domain/enso.py` aplica la regla NOAA (ONI ≥ +0,5 / ≤ −0,5 °C durante 5 trimestres seguidos). La fase de una campaña es la que cubre al menos el 50 % de sus días.
- **ONI:** descargado de NOAA CPC en `data/noaa/oni.ascii.txt` con meta y hash. Comando: `uv run python -m ceres.cli fetch-oni`.
- **API:** `GET /public/sowing-window?crop=&zone=&method=`.
- **Pruebas:** `tests/domain/test_sowing_enso.py` (ETc igual al cálculo manual, 5 trimestres, sin promedios inventados, endpoint).
- **Interfaz:** `components/SowingWindow.tsx` y `sowing.module.css`, usados en la landing (con selector de zona), en el módulo `/app/cuando` y plegados en los resultados de `/app`.

### Rediseño pedido por el usuario a mitad de sesión

El usuario pidió: «sencillo por defecto, por módulos, sin modo avanzado; opción de ver más según sea necesario».

- **Rutas eliminadas:** `src/app/(app)/` (avanzado, parcelas), `TopBar.tsx` y `Chat.tsx`. `/avanzado` y `/parcelas*` redirigen a `/app` y `/app/chacra` (`next.config.ts`).
- **Rutas movidas:** `ingresar`, `fuentes` y `demo` pasaron al grupo `(simple)`.
- **Layout:** `(simple)/layout.tsx` tiene navegación por módulos, abajo en móvil y arriba desde 760 px: Qué sembrar `/app`, Cuándo sembrar `/app/cuando`, Mi chacra `/app/chacra`.
- **«Ver más» en `/app`** (`components/simple/more.tsx`):
  - detalle técnico (el componente `Comparison`)
  - «Mis datos de la chacra» (`ProfileForm` según la zona; guarda una revisión y recalcula)
  - resultados anteriores
  - El «¿Por qué?» enlaza con «Ver todo el detalle técnico».
- **`/app/chacra`:** parcelas, cambio de parcela activa, mapa opcional para dibujar el contorno (PATCH), y la comprobación de zona y área sin cuenta.
- **Permissions-Policy:** cambiado a `microphone=(self)`. Antes bloqueaba el dictado por voz.
- **Comprobado:** `tsc` sin errores; el flujo de Chilina en `/app` funciona en el navegador a 375 px.
- **No comprobado** tras el rediseño: navegación por módulos, `/app/cuando`, `/app/chacra` (mapa y dibujo), `/demo`, `/fuentes` y la landing con selector de zona.

### Decisión del usuario sobre HLS (incremento 11)

El usuario aceptó usar un catálogo público y dejó la elección final al agente; recomiendo **Microsoft Planetary Computer**, colecciones `hls2-l30` y `hls2-s30`. Comprobé que existen en `https://planetarycomputer.microsoft.com/api/stac/v1/collections/hls2-l30`. Es HLS v2 de NASA, sin cuenta ni secretos. Las URL de los recursos se firman con un token SAS: `GET https://planetarycomputer.microsoft.com/api/sas/v1/token/hls2-l30`.

Por qué no Google Earth Engine (el usuario tiene la API no comercial de estudiante): exige credenciales de cuenta de servicio en el servidor, añade una dependencia pesada a una VM de 1 GiB y sus términos no comerciales complican la publicación. Es preferible usarlo solo como contraste.

## 3. Dirección del producto

Para quien continúe:

- **Una sola aplicación sencilla, por módulos.** Cada módulo responde una pregunta del agricultor. El rigor técnico vive dentro de «Ver más», nunca en una pantalla aparte.
- **Módulos previstos:** Qué sembrar · Cuándo sembrar · Mi chacra (aquí va el NDVI) · Cuaderno (`/app/cuaderno`) · Ceres (`/app/ceres`). Añade cada módulo a `MODULES` en `(simple)/layout.tsx` solo cuando funcione.
- **Mantener sin excepciones:**
  - Un dato desconocido no es cero.
  - Los supuestos se etiquetan y nunca dan «Buena opción» en una restricción obligatoria.
  - El motor calcula y la IA explica, con cifras y citas validadas en `application/assistant.py`.
  - Las pruebas nunca llaman al LLM real.
  - Solo tema claro, mobile-first y accesible.
- **Nada se copia entre zonas.** Una zona sin dato publicado deja el campo como desconocido (ver `apply_zone_defaults`).

## 4. Pendiente, en orden

### 4.1 Cerrar el rediseño y el incremento 15 (antes de cualquier push)

1. **E2E:** reescribir `apps/web/e2e/recorrido.spec.ts`, que aún usa `/avanzado` y `/parcelas/<id>`. El recorrido debe quedar en `/app`:
   preguntas → guardar (registro) → recargar y recuperar → responder la pregunta del agua (crea un run nuevo) → «Resultados anteriores» muestra ambos → «Ver más» con detalle técnico y fuentes → IA («IA no conectada» en CI) → salir → otra cuenta no ve la parcela, ni sus runs ni su chat (por API).
   Revisa también `sencillo.spec.ts` (textos «Majes I», «Ver detalle en modo avanzado») y `landing.spec.ts` (`/public/context` ahora lleva `?zone=`).
   Añade un caso de Chilina y otro de `/app/cuando`.
2. **Comprobar en el navegador** (`preview_start` ceres-api y ceres-web, 375 px y escritorio) las pantallas no comprobadas de la sección 2. En `/app/chacra`, revisa que `MapView` con `regions={[]}` dibuje bien.
3. **Actualizar la documentación con la decisión «sin modo avanzado»:**
   - `main.md` §11: superficies, «Rigor disponible» → «Ver más».
   - R15 último punto y R20 paso 6 («pasa al modo avanzado» → «abre Ver más y encuentra la misma comparación con detalle técnico»).
   - `specs/diseno.md` §9: tabla de rutas.
   - README: estructura, rutas, comandos `fetch-nasa --zone`, `fetch-oni`, número de pruebas.
   - `.env.example`: quitar `NASA_SNAPSHOT_FILE`, que ya no existe en `config.py`.
   - Crear `data/zonas/chilina/REVISION.md` (lo cita el catálogo y no existe).
   - En `data/zonas/majes/REVISION.md` y `sources.json`, las rutas a `data/catalog`/`data/nasa` quedaron antiguas: actualízalas.
4. **Marcar en `specs/tareas.md`** las casillas del incremento 15 y del 10 con su comprobación. Después, commit y push a `main`.
5. **Revisar el despliegue:** comprueba que `deploy/ceres.sh` ejecuta la migración y el seed (crea la demo de Chilina). Valida con `GET /api/v1/health`: debe listar las 2 zonas. Registra la versión en `despliegue.md`.

### 4.2 Incremento 11 — NDVI con HLS (Planetary Computer)

- Adaptador `infrastructure/hls.py`:
  - STAC search (`pystac-client` o httpx) sobre el polígono de la parcela, de 2015 en adelante, con nubosidad menor que X.
  - Firma SAS.
  - Lectura de COG por ventana (`rasterio` con vsicurl): B04 y B05 en L30, B04 y B8A en S30, escala 0,0001.
  - Máscara Fmask: bits 1 nube, 2 adyacente, 3 sombra, 4 nieve, 5 agua.
  - Media o mediana de NDVI por escena; guardar fecha, colección, id de escena, nubosidad, % de píxeles válidos y hash o URL.
- Tabla nueva `ndvi_observations` (migración Alembic) por parcela y propietario.
- Tarea fuera de la petición web: CLI `ceres.cli ndvi --parcel` y/o `BackgroundTasks` en `POST /parcels/{id}/ndvi/refresh`. Lectura con `GET /parcels/{id}/ndvi` y versión pública para las parcelas demo.
- Mide memoria: el contenedor de la API tiene un límite de 384 MiB.
- Interfaz en «Mi chacra»: serie mensual con fecha de escena y nubosidad, y la advertencia «no diagnostica nutrientes ni causas». **Nunca** muestres datos simulados como satelitales: las pruebas usan respuestas guardadas, etiquetadas como tales.
- La parcela necesita polígono: las creadas solo con punto deben dibujarse en «Mi chacra».

### 4.3 Incremento 12 — Cuaderno de campo

- Tablas `campaigns`, `sales`, `costs` y `profit_declarations` con `owner_id` y FK a parcela, origen (`declarado` / `declarado_chat_confirmado`), referencia al mensaje y revisión.
- API CRUD aislada por propietario, con pruebas de dos cuentas.
- `presentation/app.py: own_economics()` ya existe como punto de enganche (hoy devuelve `[]`). Debe devolver, por cultivo de la zona, el `yield_t_ha`, `price_soles_kg` y `variable_cost_soles_ha` de las campañas más recientes.
- El motor ya marca la fuente `CUADERNO`, combina campo a campo y etiqueta el margen como `supuesto_demo` si queda algún valor de ejemplo. Lo prueba `tests/domain/test_engine.py`.
- Vista `/app/cuaderno` con resúmenes por campaña y mes («el año pasado en este mes…»). Distinguir «ganancia que declaraste» de «margen estimado».

### 4.4 Incremento 13 — Registro por texto o voz

- `ProposeRecords`: texto o audio (webm/ogg, ≤ 2 min, procesado en memoria y sin guardar) → Gemini con un esquema JSON estricto (inline audio) → validación Pydantic → propuesta pendiente con TTL.
- La tarjeta «¿Guardo esto?» se puede editar. Confirmar escribe los registros; rechazar o caducar borra la transcripción.
- Amplía el puerto `LanguageModel` y `FakeLanguageModel` para la extracción.
- Revisión mensual determinista (campaña sin cosecha, venta sin precio, mes sin costos). Notificaciones del navegador opcionales y revocables.

### 4.5 Incremento 14 — Ceres, E2E de R20, despliegue y demo

- Asistente con memoria del cuaderno y herramientas `simular_escenario` (crea un run vía `create_run` con `apply_scenario`) y `consultar_cuaderno`.
- Implementar como bucle de salida estructurada `{accion, args, answer...}` para que funcione con Gemini y con el proveedor simulado.
- La validación de cifras admite valores del cuaderno y de los runs creados en la conversación.
- Voz de salida con `speechSynthesis`.
- E2E del recorrido R20 completo.
- Comprobar la conexión real con `uv run python -m ceres.cli check-llm` y `scripts/validar_asistente_real.py`.
- Guion de demo de 30 s y push.

## 5. Recomendaciones

- **Clima de Chilina:** antes de presentarlo como decisivo, contrasta la temperatura con una estación SENAMHI de Arequipa (p. ej. La Pampilla). Una corrección por altura solo con un método citado; si no, deja la advertencia visible, como ahora.
- **Agua de Chilina:** pide a la Comisión de Usuarios Pampas Nuevas de Chilina (Junta Chili Regulado) la dotación por turno. Averigua también qué comisión riega Carmen Alto (Cayma).
- **ENSO:** el ONI no ve el Niño costero (Niño 1+2). Si se quiere más señal local, añade el índice ICEN del ENFEN como fuente adicional, siempre registrada con hash.
- **Pruebas frágiles por búsqueda de texto:** al añadir fichas, la recuperación FTS (límite 5) puede desplazar documentos. Ya pasó con la prueba de inyección; ajusté su texto.
- **Commits por incremento:** haz commit al cerrar cada incremento y push solo con el CI local en verde (pytest con PostgreSQL de `docker compose up -d db`, `npx tsc --noEmit`, `npm run build` y Playwright con la API y la web en marcha).

## 6. Comandos útiles

```bash
docker compose up -d db
```

```bash
cd apps/api && uv run alembic upgrade head && uv run python -m ceres.cli seed && uv run pytest -q
```

```bash
cd apps/api && uv run python -m ceres.cli fetch-nasa --zone chilina
```

```bash
cd apps/web && npx tsc --noEmit && npx playwright test
```
