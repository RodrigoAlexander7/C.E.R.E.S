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
- [ ] **Pendiente**: verificar preguntas reales con credenciales. Faltan `OPENAI_API_KEY` y `OPENAI_MODEL` (ver `despliegue.md`). Los mocks solo comprueban el contrato.

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
