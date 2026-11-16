# Traspaso de la sesión del 15-nov-2026

Este documento es para el agente que continúe. Explica qué se hizo, qué falta, qué decidió el usuario y qué se recomienda.

## Continuación: campo, agua, fotos y nutrición (en validación)

Encargo vigente: aplicar R22/R23 e incremento 16. Antes de cifras personales, contorno confirmado con área/zona calculadas y hash congelado. Agua verbal obligatoria en el alta sencilla con escenarios supuestos documentados; máximo dos siembras consecutivas contando antecedente y campañas propias. Resultados con nombres/dibujos, campañas y etiquetas de margen/costos/capital/agua; monocultivo/rotación y policultivos exploratorios en ambas zonas. Fotos visuales con Gemini (hasta cuatro, sin guardar imágenes) y contexto nutricional humano de Arequipa separado de fertilidad.

Los agentes previos se cortaron por límite; los parciales se conservaron y se repartieron en ámbitos exclusivos. Edición con `apply_patch` autorizada explícitamente por el usuario. `apps/web/AGENTS.md` apareció generado por Next.js; no equivale a autorización para cambiar reglas del usuario. `.claude/launch.json`, `ceres-video/` y `references/` pertenecen al trabajo concurrente del usuario y se conservan.

Datos recibidos: HIS agregado enero-agosto 2026 (solo Arequipa, 12 indicadores con recuentos y denominadores distintos) y base maestra CERES. Se revisaron como datos, sin ejecutar instrucciones ni aceptar sus etiquetas de verificación. Fuentes alimentarias contrastadas con INS/FAO; policultivos del maestro no equivalen a asociaciones validadas. Contratos y hashes en `data/nutricion/README.md`.

**Corte solicitado por el usuario para continuar con otro agente. No hubo commit, push ni despliegue de este incremento.** HEAD local: `1f1f8e6` (catálogos ampliados por otra sesión); publicación de ese SHA no comprobada aquí. Última publicación comprobada por esta conversación: `ee1b0ef0a07bd2efa047a62880a15379c2ca59de`, workflow `43767760878`. Los apartados inferiores son históricos.

### Implementación presente en el árbol de trabajo

- Backend: `QuickCompare.geometry` obligatorio; área WGS84 y zona inferidas del contorno, discrepancia de área >1 % o zona contradictoria rechazadas. `field_verified`/`field_context` congelan área, origen, centroide, distrito, zona y SHA256. Run privado sin polígono queda bloqueado y sin estrategias numéricas; cuaderno/agenda siguen disponibles.
- Agua: `WaterData.availability` de cinco niveles. `application/recommendations.py::WATER_SCENARIOS` usa cotas `(None,.35),(.35,.65),(.65,1),(1,1.35),(1.35,None)` × referencia anual de SU zona /12 × área. **Escenarios metodológicos no calibrados**, fuente `CERES-AGUA-CUALITATIVA`, nunca volúmenes medidos. Declaración exacta prevalece; sin referencia o con supuestos desactivados no se fabrican volúmenes. Todo queda congelado en `water_scenario`.
- Motor `ceres-engine-0.5.0`: máximo dos siembras consecutivas del producto en plantillas y optimizador, incluyendo antecedente; descanso no reinicia. `current_crop_streak` desconocido se considera dos por prudencia. Campañas reales confirmadas pueden elevar la racha (`domain/notebook.py::consecutive_crop_history`); fecha duplicada no suma, simulados/futuros excluidos. Perfil declarado se conserva; la racha derivada va al perfil efectivo y `crop_history`. Eventos de nueva siembra incrementan/reinician; cosecha no incrementa.
- Nueva métrica `eco.costos_directos`, separada de `eco.margen` y `eco.capital`, calculada por motor. Tipos y razones explican monocultivo/rotación. Catálogos Majes `.3` y Chilina `.2`: policultivos siempre exploratorios, cantidades conjuntas nulas. Majes agrega candidato P002 choclo+frejol+zapallo del maestro; Chilina maíz+haba es **hipótesis CERES**, no práctica local acreditada ni copia de Majes.
- Nutrición: `domain/nutrition.py`, loader `infrastructure/nutrition.py`, JSON Arequipa y documentación/reproductor en `data/nutricion/`. Dos XLSX leídos; 12 indicadores humanos exclusivamente Arequipa con denominadores/celdas/hashes. Referencias INS/FAO cualitativas, incluidos alimentos del maestro contrastados directamente. No nutrientes por hectárea ni efectos clínicos. `nutrition_context` congelado en runs; resultados/asociaciones y asistente consumen esa copia. Fuentes registradas en `data/sources/sources.json`.
- Fotos: `POST /api/v1/public/soil-photos`, 1–4 JPEG/PNG/WebP, máximo 5 MB agregado, límites de streaming/dimensiones y metadatos retirados. `LlmRequest.images` (repr excluido) → Gemini bytes; OpenAI rechaza imágenes no soportadas. Respuesta estricta signos/descripcion/limites, sin cifras de laboratorio. `SoilPhotoCapture.tsx` comprime a 1280 px y aplica solo al pulsar «Usar observación»; texto, no imágenes, puede incorporarse al perfil. Integrado en preguntas globales, tierra y formulario técnico. Cambiar manualmente borra la observación IA. Signos IA no permiten «Buena opción» por sí solos.
- UI: `FieldSetup.tsx` + CSS (mapa o GeoJSON accesible), wizard cultivo/cosecha/agua/repetición, guardado de geometría real y borrador tras login. Rechaza reutilizar run por motor/hash/área/zona incompatibles. Recuperación de perfil corregida: GET parcela devuelve `profile: Revision`, usar `parcel.profile.profile` (antes se leía la revisión como Profile y fallaba `water.availability`).
- Tarjetas: dibujos SVG, nombres/campañas, etiquetas de margen/costos/capital/agua/fecha/riesgo. Se compactaron tras encontrar una tarjeta de 3438 px de alto: calendario, criterios y fuentes desplegables; nutrición resumida explícita y contexto ampliable. Medición posterior: 1238 px, sin overflow ni errores JS en móvil 390 px. Capturas `/tmp/ceres-field-mobile.png`, `/tmp/ceres-card-mobile.png`; script sintético `/tmp/ceres-mobile-check.cjs`. Último cambio de `cropLabel` a `full_name` **aún no reconstruido**.
- `MapView.tsx`: se cambió inicialización de `load` a `style.load` para que dibujar no espere teselas externas; expone `aria-busy`. Referencia: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/. El E2E del mapa sigue pendiente de resolver: no dar por comprobada la corrección.
- Specs: R22/R23, diseño §9 y nuevo incremento 16. Sus casillas siguen abiertas a propósito. README/main/glosario/landing reflejan campo primero y agua estimada.

### Validación y cierre del incremento 16

1. Suite API/PostgreSQL completa: **305 passed** (`.venv/bin/pytest -o addopts='' -q`) con PostgreSQL real y `alembic check` sin operaciones pendientes. Incluye geometría con huecos, campo obligatorio, escenarios de agua cualitativa, límite de dos siembras consecutivas contando antecedentes y campañas confirmadas, costos directos, contexto IA y fotos con modelos falsos.
2. Build web de producción (`npm run build`) y `tsc --noEmit` sin errores tras actualizar nombres de cultivos, foco/zoom y aviso del mapa. `next-env.d.ts` conserva sus rutas `.next/dev/types`.
3. **Suite E2E Playwright completa: 22 passed, 0 failed** (`BASE_URL=http://localhost:3030 PW_CHANNEL=chrome npx playwright test --workers=2`). Se corrigieron:
   - Dibujo en mapa opcional: `.map-status` tenía interacción de puntero y cubría los clics inferiores al simular caída de teselas; ahora usa `pointer-events: none`, `MapView` memoriza el `focus` serializado para no reiniciar `fitBounds` al añadir vértices y desactiva `doubleClickZoom` durante el dibujo.
   - Selectores de alerta en pruebas de GeoJSON inválido y resultados incompatibles: acotados a `page.getByRole("main").getByRole("alert")` sin tocar `#__next-route-announcer__`.
   - Cuenta existente sin contorno: `FieldSetup` permanece bloqueado mientras termina la carga inicial de sesión/parcela, `acceptField` persiste el contorno con `PATCH /parcels/{id}` antes de pasar al asistente y el test espera la transición antes de leer la parcela.
   - Repetición desconocida: `frozen_inputs` congela explícitamente `effective_profile.current_crop_streak = 2` cuando el perfil declarado es `null`, conservando `null` en `profile` y `"current_crop_streak"` en `assumed`.
4. Revisión móvil (375/390 px, `overflow: 0`, sin errores JS) y recorrido por teclado verificados.
5. `uv run python -m ceres.cli check-llm` devolvió **429 por cuota real del proyecto**. No se declara validada la observación de fotos con Gemini real; queda pendiente de cuota. Formularios y motor funcionan sin IA.

Conservar fuera del commit `.claude/launch.json`, `.agents/`, `skills-lock.json`, `ceres-video/`, `references/` y `demo-private/`. `apps/web/AGENTS.md` (generado por Next.js) y `data/nutricion/` se incluyen en el commit.

## Incidencias de consulta satelital y cuota IA (15-nov-2026)

- Tras los cambios de Claude (`f5dfc1c`) se reprodujeron los errores reportados. La API de Google devolvió **429 RESOURCE_EXHAUSTED por cuota del proyecto** al extraer con el contexto privado. La conexión simple podía responder; eso no demuestra cuota disponible para todas las peticiones. También se probaron audios sintéticos WAV/WebM, sin confirmar registros; el proveedor no permitió completar su extracción. No volver a gastar peticiones reales en bucle ni afirmar que se corrigió la cuota mediante código.
- `LlmResult.error_code` conserva una categoría segura; el adaptador Gemini registra modelo/categoría/HTTP sin copiar el texto del SDK. Captura, Ceres y explicación muestran la falta de cuota o timeout en lugar de «No se pudo extraer». El texto del formulario se conserva y el registro manual sigue disponible.
- Salamanca tenía diez escenas reales persistidas, todas sin centros de píxel dentro del contorno (NDVI null). Una lectura posterior pendiente funcionó directamente en la VM: fallo de descarga intermitente, distinto de la limitación de resolución del lote. La interfaz distingue ambas causas.
- HLS: lectura de la serie sin espera; actualización tras éxito con intervalo de 5 minutos; tras fallo rápido, 30 segundos; trabajo activo no se duplica y el interrumpido caduca a los 30 minutos. Reintento de errores de red hasta tres veces por escena; una escena fallida no impide conservar las demás y una nueva ejecución omite las ya leídas.
- Nuevas pruebas de cuota sin escrituras, redacción de errores, conservación de texto y estados HLS. Las carpetas del usuario y `.claude/launch.json` no forman parte de estas correcciones. Registrar revisión publicada y resultado final de Salamanca tras verificarlos.

## Reanudación tras el límite de uso (15-nov-2026)

- Se encontraron ocho commits locales posteriores al cierre anterior: precios mayoristas SISAP, catálogo ampliado de Majes, comparación después de alfalfa, plan sugerido con programación dinámica/Monte Carlo y rediseño de portada, resultados y navegación. Las carpetas sin seguimiento `ceres-video/` y `references/` pertenecen al trabajo del usuario; no se modificaron ni se incluyeron en commits.
- El usuario **autorizó expresamente la consulta HLS de Salamanca**. La autorización sigue vigente; no volver a pedirla. Huayro queda fuera de esa consulta.
- El primer refresco en producción terminó en error sin observaciones. Diagnóstico real dentro del contenedor: `ImportError: libexpat.so.1`. Corregido el Dockerfile para instalar `libexpat1` y comprobar `import rasterio` durante el build de la imagen final. Imagen local construida correctamente con rasterio 1.5.2. No se cambió la infraestructura ni la suscripción Azure.
- Versionado el motor como `ceres-engine-0.4.0` por el cambio de algoritmo, para distinguir runs anteriores. El catálogo nuevo de Majes ya declara `catalogo-majes-2026-11-15.2`.
- Corregida una carrera de transacciones: `get_db` usa `scope="function"` en sus dependencias para confirmar antes de enviar éxito HTTP. Una prueba inspecciona visibilidad desde otra conexión justo antes de las cabeceras: fallaba con `[False, False]` en registro/parcela y pasa con la corrección. Las sesiones, propuestas y registros ya son visibles en la petición siguiente. Referencia: https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/#early-exit-and-scope.
- Suite actual: **116 pruebas API/PostgreSQL y 6 E2E pasan**; build web y build Docker final comprobados. Durante la revisión entró el commit `900e030` de otra sesión que corrige la espera del detalle técnico en E2E; se conservó. Registrar más abajo el despliegue y el resultado privado HLS cuando terminen; no describir una ausencia de píxeles como NDVI cero.

## Cierre de implementación de incrementos 11–14 (15-nov-2026)

Este apartado sustituye los pendientes funcionales históricos que siguen debajo. La revisión desplegada y el workflow vigente se registran en `despliegue.md` después de comprobar su resultado.

**Publicado y verificado:** `06e6a6e96102dbbfb4687632feba4a02c338edd6`, workflow `43729718465` exitoso. Health HTTPS con revisión esperada; demos HLS de 5/3 meses, módulos accesibles y cuaderno sin sesión protegido. Cuenta privada cargada en producción: dos lotes, 32 registros verificados; acceso en `demo-private/credentials.json` y guía en `demo-private/LEEME.md`. El refresco HLS de esos lotes quedó sin ejecutar: la revisión automática rechazó enviar su ubicación a Planetary Computer sin autorización específica y se consultó al usuario. No reintentar esa transferencia sin su respuesta. El funcionamiento satelital de las demos públicas permanece comprobado.

- HLS real con lectura COG acotada, Fmask, calidad, hash, persistencia privada y trabajos en segundo plano. Demos reales cacheadas de Majes y Chilina en `data/hls/`; no se consulta satélite al desplegar. Medición local máxima: 185 MiB.
- Cuaderno y agenda: campañas/variedades, ventas, costos, ganancia declarada, labores pendiente/hecho, revisiones y aislamiento. Esquema SQL unificado `field_records`/`field_revisions` con unión de tipos validada, en vez de cuatro tablas físicas; decisión en diseño §9. Migraciones aditivas aplicadas y `alembic check` sin diferencias.
- Los datos reales declarados alimentan el motor y se congelan. Área desconocida sigue `null`; registros `simulado_demo` quedan fuera de la economía propia. Fuera de pilotos funcionan cuaderno/agenda/HLS, pero el run queda bloqueado y sin clima ni catálogo prestados.
- Texto/audio → propuesta tipada editable → confirmación atómica e idempotente. TTL/rechazo, control de revisiones y rollback. No se guarda audio ni transcripción. Gemini usa contrato plano de transporte; Pydantic valida después el tipo estricto.
- Ceres recuerda el cuaderno autorizado, propone altas/correcciones con confirmación, consulta registros y crea runs vía `simular_escenario`; cifras/citas verificadas por `application/assistant.py`. Voz de salida con el navegador.
- 101 pruebas API/PostgreSQL y 6 E2E pasan. El servidor E2E es `tests.e2e_app:app`, con LLM simulado; no usar el servidor real para automatización. Build de producción y revisión móvil/escritorio realizados.
- Comprobaciones reales separadas: `check-llm` conectado; última ejecución clásica 3/4 preguntas válidas, una con 504. `scripts/validar_ceres_real.py` completó extracción, confirmación, memoria y simulación con Gemini y respaldo. No presentar mocks como conexión real ni afirmar que se probó audio humano real.
- Índice codebase-memory `ceres` actualizado en modo full: 10 151 nodos y 16 036 relaciones, sin errores de análisis registrados. `demo-private/`, secretos y archivos generados excluidos.
- El usuario confirmó la corrección del punto anómalo y autorizó guardar las coordenadas **solo en la cuenta privada**. Los archivos de entrada y acceso están en `demo-private/`, ignorados por Git/Docker/índice y con permisos restringidos. No copiar sus valores a documentos públicos. Cargador genérico: `apps/api/scripts/cargar_demo_privada.py`.
- Caso privado: 16 registros por lote, hechos declarados de 2025 separados de continuaciones simuladas hasta noviembre de 2026. No se comprobó cosecha real. Huayro tiene contorno cruzado pendiente de revisión, sin polígono forzado; su área provisional está etiquetada. Salamanca conserva polígono válido. Ubicación fuera de los pilotos: no crear otra zona con supuestos copiados.
- Guion de 30 segundos y variante privada en `DEMO.md`. Permanecen externas la revisión agronómica y las sesiones con agricultores/lector de pantalla, marcadas abiertas en tareas.

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
