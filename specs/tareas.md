# Plan de implementación por especificación

Estado al 14 de noviembre de 2026: **MVP implementado**, con las excepciones marcadas `[ ]`. Una tarea se marca solo tras comprobar su resultado; la comprobación se indica entre paréntesis. Los requisitos `R01–R13` están en `specs/requisitos.md`; los adaptadores y contratos, en `specs/diseno.md`.

## Incremento 0 — entorno, decisiones y datos de demostración

- [x] Leer `main.md`, instrucciones y especificaciones; inspeccionar checkout sin revertir cambios existentes.
- [x] Registrar versiones compatibles de Next.js/React/TypeScript, Python/FastAPI, PostgreSQL, SQLAlchemy y dependencias; fijarlas en manifests/lockfiles. (`apps/api/pyproject.toml` + `uv.lock`; `apps/web/package.json` + `package-lock.json`; TypeScript 5.9 porque TS 7 no expone la API que usa Next.)
- [x] Crear estructura de aplicación, configuración y README de arranque local con `.env.example` sin secretos. Preparar PostgreSQL, migraciones y comprobación de salud. **R12**. (`README.md`, `/api/v1/health`)
- [x] Probar una consulta NASA POWER acotada; obtener y guardar respuesta real, metadatos y hash. Después preparar periodo de referencia con controles de ausentes/unidades. **R04**. (2015–2025, 4 018 días, 0 ausentes, SHA-256; unidades validadas al cargar.)
- [x] Obtener límites referenciales con atribución y jerarquía coherente; preparar el subconjunto de demo. Comprobar la disponibilidad real del mapa base. **R01, R10**. (SERFOR/INEI actualizado 2025-10-28: departamentos, provincias y distritos de Arequipa; otros distritos bajo demanda con caché; teselas OSM comprobadas.)
- [x] Preparar tres fichas/secuencias y una asociación candidata con fuentes/estados. Etiquetar parcela, agua, costos y análisis simulados como supuestos. **R05, R07, R08**. (`data/catalog/catalog.json`, revisión en `data/catalog/REVISION.md`.)
- [x] Comprobar qué credenciales LLM existen sin imprimirlas. Dejar estado «IA no conectada» si faltan. **R09**. (No hay `OPENAI_API_KEY` ni `OPENAI_MODEL`.)

## Incremento 1 — login, parcela e historial

- [x] Registro/login/logout, sesiones opacas revocables, Argon2, CSRF + origen, cookies HttpOnly/SameSite/Secure. **R02**.
- [x] Parcela, revisión de perfil, eventos de cultivo, suelo y manejo con propietario/procedencia; migraciones y repositorios. **R03, R10**.
- [x] Formulario progresivo mínimo y parcela activa, preservando el borrador durante login. **R03, R11**. (E2E)
- [x] Recuperar perfil e historial tras recargar; revisiones anteriores conservadas al registrar cosecha/análisis. **R03**.
- [x] Pruebas con dos cuentas: IDs ajenos, fuentes privadas, sesión expirada, logout y caché privada. **R02, R10**.

## Incremento 2 — motor y ciclos explicados

- [x] Objetos de valor, validación de unidades/fechas, catálogo versionado y casos de uso independientes del framework. **R05–R07, R12**.
- [x] Tres calendarios comparables con transiciones y ciclos completos; asociación separada como ficha exploratoria. **R05, R08**.
- [x] Evidencia NASA real en el indicador climático; ET0 FAO-56 comprobada con el ejemplo 18 antes de habilitar m³. **R04, R07**.
- [x] Restricciones y estados: agua mensual, calendario, antecedente, salinidad, presupuesto; faltantes explícitos. **R06**.
- [x] Margen bruto por ciclos y escenarios; fertilidad cualitativa y faltantes cuantitativos explícitos (sin dosis). **R07**.
- [x] Prioridad con métricas comparables y razones trazables; sin compensar restricciones. **R06**.
- [x] Runs inmutables con entradas, revisión, versiones y hash NASA; cambiar agua/prioridad crea otro run. **R03, R06, R10**.
- [x] Pruebas de fechas/horizonte/bisiestos, conversiones, margen, presupuesto, ausentes y reproducción. **R05–R07**.

## Incremento 3 — mapa y experiencia completa

- [x] Mapa Perú → departamento → provincia → distrito → parcela con selectores y zoom sincronizados; zona piloto distinguida. **R01**.
- [x] Geolocalización voluntaria, dibujo/entrada manual, geometría validada y área geodésica en backend. **R01**.
- [x] Tarjetas, línea de tiempo, detalle de agua/margen/suelo, supuestos y evidencia. **R05, R07, R10, R11**.
- [x] Estados de carga, falta de datos y fallos del mapa base/fuentes con alternativa manual. **R01, R10**.
- [x] Ficha exploratoria de policultivo. No se muestra información INS porque no se curó ninguna ficha. **R08**.
- [ ] Verificar móvil y teclado. (Tema claro con sistema oscuro: comprobado en E2E. Diseño responsive implementado; falta una revisión manual en móvil y solo con teclado.) **R11**.

## Incremento 4 — asistente IA con evidencia

- [x] `AnswerFarmerQuestion`, recuperación FTS de fichas autorizadas y puerto LLM. **R09, R10**.
- [x] Adaptador Responses en backend, configuración por entorno, timeout, límites y estado de indisponibilidad. **R09**.
- [x] Chat vinculado a parcela y run; aviso cuando el perfil cambió. **R03, R09**.
- [x] Validación de citas/métricas/cifras contra el contexto; fuentes renderizadas desde el registro; chat de solo lectura. **R09**.
- [x] Pruebas con proveedor simulado: explicación, menos agua, suelo desconocido, cita inventada, cifra sin respaldo, contexto ajeno e inyección en fichas. **R02, R09**.
- [x] Verificar preguntas reales con credenciales Gemini, separado de las pruebas automáticas. (`check-llm` conectado; última ejecución clásica 3/4 válidas y un 504; extracción, confirmación, memoria y simulación reales completadas con respaldo. Ver `despliegue.md`.)

## Incremento 5 — integración y presentación

- [x] Pruebas de dominio, integración PostgreSQL y E2E del recorrido de aceptación. **R01–R12**. (65 pytest + Playwright)
- [x] Paquete NASA real, atribuciones, separación datos/supuestos y ausencia de secretos. **R04, R10, R12**.
- [x] Ensayo mapa → login → parcela → comparar → cambiar agua → fuentes → asistente → logout/aislamiento (E2E; asistente en modo «IA no conectada»).
- [x] Comandos comprobados de arranque, migración, seed y tests en `README.md`. **R12**.
- [x] Resumen de lo realizado, pruebas y límites (README y `despliegue.md`). Sin validación agronómica ni IA real declaradas.

HLS, infraestructura de búsqueda vectorial, clasificación de cultivos y otras ampliaciones no desplazan estas tareas. Malezas, macheteo y herbicidas permanecen fuera del alcance.

## Incremento 6 — artefactos para despliegue Azure

Estado real de la publicación: ver `despliegue.md`.

- [x] Dockerfiles de producción web/API (Linux x64), construidos en GitHub Actions; frontend Next.js standalone.
- [x] Compose de producción con Caddy HTTPS, red interna para PostgreSQL, volumen persistente con nombre fijo y healthchecks; solo 80/443 publicados.
- [x] Variables documentadas, cookies Secure y origen HTTPS; secretos solo en `/opt/ceres/.env` del servidor.
- [x] Límites de memoria, un worker API, logs rotados y PostgreSQL ajustado; consumo medido (ver `despliegue.md`).
- [x] Migración, respaldo, verificación de restauración y rollback en `deploy/ceres.sh` (resultado en `despliegue.md`).
- [x] CI/CD: `.github/workflows/ci.yml` (PR) y `deploy.yml` (main/manual, OIDC, Run Command).

---

# Nueva dirección (15-nov-2026) — `main.md` §11, requisitos R14–R20, diseño §9

## Incremento 7 — Fase 0: especificación y landing

- [x] Registrar la nueva dirección en `main.md` §11 y enmendar §5 (Gemini, chat que propone con confirmación) y §8.
- [x] Requisitos R14–R20 y enmienda de R09; diseño §9 (rutas, supuestos de zona, cuaderno, extracción, Ceres, NASA visible).
- [x] Landing pública en `/` con datos NASA reales de la API y funciones disponibles/próximas diferenciadas; mapa actual movido a `/avanzado`. **R14**.

## Incremento 8 — Fase 1: motor sin bloqueos

- [x] Valores típicos de Majes I con fuente: agua 22 500 m³/ha/año (AUTODEMA, indicador 2023, consumo reportado) con reparto mensual uniforme como `supuesto_zona`; eficiencias FAO por método (60/75/90 %), aspersión supuesta si no se sabe. **Sin dato publicado de salinidad típica**: no se inventa; se pregunta de forma observable. Calendario y precios siguen como `supuesto_demo`. **R16**.
- [x] `data/catalog/zona_majes.json` versionado, aplicado solo a desconocidos y congelado en el run (`effective_profile`, `assumed`, `zone_version`). **R16**.
- [x] Nivel sencillo (`domain/simple.py`), titular, datos clave, orden por nivel y prioridad, y `decisive` con preguntas observables (agua del mes más exigente, método de riego, signos de sal); agua como intervalo (exacto / «al menos» / «menos de»). **R15, R16**.
- [x] Pruebas: «no sé» en todo → opciones útiles; supuesto en restricción obligatoria nunca da «Buena opción»; plantilla exploratoria nunca sube; respuestas recalculan; intervalo de agua; comparación pública sin guardar. (`tests/domain/test_simple.py`, `tests/integration/test_profile_runs.py`)

## Incremento 9 — Fase 2: modo sencillo

- [x] `/app`: alta en 3 preguntas (4 toques si el cultivo sigue en campo), tres opciones, «¿Por qué?» en tres capas, glosario fijo + IA bajo demanda en hoja inferior (dictado y lectura por voz del navegador, opcionales); sin cuenta usa `POST /public/quick-compare` (no guarda); «Guardar» crea parcela, revisión y run. **R15**.
- [x] Modo avanzado corregido: nivel sencillo y preguntas decisivas en la comparación; método de riego y signos de sal en el perfil; supuesto de zona explicado; enlaces cruzados. **R15**.
- [x] E2E móvil 375 px (`e2e/sencillo.spec.ts`): preguntas → opciones sin callejones sin salida → pregunta decisiva → «¿Por qué?» → glosario → IA → guardar con registro. **R15, R20**.
- [ ] Revisión manual con agricultores reales y solo con teclado/lector de pantalla (pendiente).

## Incremento 10 — Fase 3: momento NASA

- [x] `sowing-window` por mes de siembra y gráfico en modo sencillo y landing. **R19**. (`test_sowing_enso.py`, E2E landing y módulo `/app/cuando`; build de producción comprobado el 15-nov-2026.)
- [x] Comparación de años El Niño/normales con fuente NOAA registrada. **R19**. (ONI con hash, regla de cinco trimestres en dominio y tabla NOAA en E2E Chilina.)

## Incremento 11 — Fase 4: NDVI de la parcela

- [x] Acceso HLS público comprobado; NDVI real por parcela con Fmask, procedencia y calidad; demos cacheadas de ambas zonas. **R19**. (`data/hls/demo_ndvi.json`, pruebas de máscara/aislamiento/seed; memoria máxima local medida 185 MiB; interfaz en Mi chacra y demo.)

## Incremento 12 — Fase 5: cuaderno de campo

- [x] Modelo tipado, migraciones y API de campañas, ventas, costos, ganancia declarada y agenda; historial de revisiones y aislamiento por propietario. **R17**. (`field_records`/`field_revisions`, unión discriminada estricta; `test_notebook.py`.)
- [x] El motor usa datos propios y los congela con procedencia CUADERNO; gastos incompletos permanecen desconocidos. **R17**. (Integración de campaña, precio ponderado, rendimiento y costo completo; run nuevo.)
- [x] `/app/cuaderno`: resúmenes por campaña/mes, comparación con el mismo mes anterior, revisiones y agenda pendiente/hecho. **R17**. (E2E R20 y revisión visual 375/800 px.)

## Incremento 13 — Fase 6: registro por chat y voz

- [x] `ProposeRecords` (texto/audio), esquema compatible con proveedor y validación estricta backend, tarjeta editable «¿Guardo esto?», alta/corrección con confirmación atómica e idempotente, TTL/rechazo. **R17**. (Pruebas de texto/audio simulado, límites, aislamiento, rollback y revisión; extracción y confirmación con Gemini real por separado.)
- [x] Agenda y revisión mensual determinista; avisos opcionales y desactivables al abrir la app. **R17**. (Campaña sin cosecha, venta sin precio/cantidad, gastos incompletos o mes sin gastos; dominio e interfaz.)

## Incremento 15 — Segundo piloto: Valle de Chilina (Arequipa ciudad)

- [x] Identificar con límites SERFOR/INEI los distritos que abarca la campiña del Valle de Chilina y definir cómo se reconoce la zona (distritos o polígono con fuente). (`zona.json`: Cayma y Alto Selva Alegre como referencia distrital; no catastro. Pruebas de reconocimiento en `test_zones.py`.)
- [x] Generalizar el piloto: registro `data/zonas/<zona>/` con clima, supuestos y catálogo propios; el run congela la zona usada. (`test_zones.py`: separación y reproducción.)
- [x] Descargar NASA POWER 2015–2025 para Chilina con hash y metadatos; documentar elevación de la celda frente a la real. (4 018 días, 0 ausentes; carga con hash validada en pruebas; `data/zonas/chilina/REVISION.md`.)
- [x] Supuestos de zona con fuente o `supuesto_zona`; fichas/calendarios con sus estados bibliográficos, inferidos o desconocidos. (`zona.json`, `catalogo.json`, `REVISION.md`; sin revisión agronómica local ni economía inventada.)
- [x] Aplicación sencilla por módulos, landing y demo muestran ambas zonas; «Ver más» integra el detalle técnico (sustituye el modo avanzado por decisión posterior). (88 pytest y 5 E2E, incluido Chilina sin mezclar clima ni supuestos; 15-nov-2026.)

## Incremento 14 — Fases 7–8: asistente Ceres, pruebas y demo

- [x] Ceres con memoria autorizada, propuestas confirmadas, `consultar_cuaderno`, `simular_escenario` y voz de entrada/salida. **R18**. (101 pytest + 6 E2E; Gemini real: recuerdo de venta y nuevo run con 1000 m³/mes aceptados por validador.)
- [x] E2E del recorrido R20, despliegue y guion de demo de 30 segundos. (101 pytest + 6 E2E en CI; revisión `06e6a6e`, workflow `43729718465` exitoso; health HTTPS y módulos comprobados; `DEMO.md`. Cuenta privada de dos lotes con 32 registros verificados; coordenadas y acceso fuera de Git.)

## Incremento 16 — campo primero y decisiones comprensibles (R22/R23)

- [x] Contorno obligatorio antes de cifras personales; área/zona calculadas en servidor, hash congelado, sin 5 ha predeterminadas ni centro de zona como campo. Rechazar discrepancias y bloquear runs sin geometría; conservar cuaderno/agenda. (`test_field_water.py`, `test_geometry.py`, E2E `sencillo.spec.ts`.)
- [x] Agua cualitativa obligatoria en alta sencilla, cinco niveles y escenarios supuestos trazables por zona/área. Mantener desconocidos y excluir «Buena opción» si una restricción depende del supuesto. (`test_field_water.py`, `test_simple.py`, E2E `sencillo.spec.ts`.)
- [x] Prohibir una tercera siembra consecutiva en plantillas y optimizador contando antecedente y campañas propias; no reiniciar por descanso ni alimentar con ejemplos simulados. (`test_engine.py`, `test_optimizer.py`, `test_field_water.py`, E2E `sencillo.spec.ts`.)
- [x] Mostrar monocultivo, rotación y policultivos con razones/límites en ambas zonas. Dibujos y nombres/campañas; etiquetas claras de margen, costos directos, capital, demanda hídrica, fecha y riesgo. (`CropPlanVisual.tsx`, `results.tsx`, E2E `sencillo.spec.ts` y `soil-photos.spec.ts`.)
- [x] Hasta cuatro fotos como alternativa a signos manuales; Gemini con esquema estricto, aplicación revisada, límites y metadatos retirados; sin almacenar imágenes ni fingir diagnóstico de laboratorio. (`test_soil_photos.py`, E2E `soil-photos.spec.ts` con LLM simulado; prueba con Gemini real pendiente de cuota del proyecto.)
- [x] Contexto nutricional humano exclusivamente Arequipa con hojas/celdas, denominadores y hashes; aportes alimentarios explícitos INS/FAO separados de fertilidad y sin beneficios clínicos inferidos. Congelar contexto en runs. (`test_nutrition.py`, `test_field_water.py`, `test_assistant.py`, E2E `soil-photos.spec.ts`.)
- [x] Pruebas API/PostgreSQL, build web, E2E móvil/guardado/fuentes/fotos/aislamiento y publicación por CI existente. Actualizar traspaso con revisión y límites comprobados. (305 pytest + `alembic check` + build web + 22 E2E Playwright; publicación en `despliegue.md` y `TRASPASO.md`.)
