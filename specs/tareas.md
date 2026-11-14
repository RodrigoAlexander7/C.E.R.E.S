# Plan de implementación por especificación

Estado inicial: **pendiente de implementación**. Marcar una tarea solo después de comprobar su resultado. Los requisitos `R01–R12` están en `specs/requisitos.md`; los adaptadores y contratos, en `specs/diseno.md`.

## Incremento 0 — entorno, decisiones y datos de demostración

- [ ] Leer `main.md`, instrucciones y especificaciones; inspeccionar checkout sin revertir cambios existentes.
- [ ] Registrar versiones compatibles de Next.js/React/TypeScript, Python/FastAPI, PostgreSQL, SQLAlchemy y dependencias; fijarlas en manifests/lockfiles.
- [ ] Crear estructura de aplicación, configuración y README de arranque local con `.env.example` sin secretos. Preparar PostgreSQL, migraciones y comprobación de salud. **R12**.
- [ ] Probar una consulta NASA POWER acotada; obtener y guardar respuesta real, metadatos y hash. Después preparar periodo de referencia con controles de ausentes/unidades. Si falla, registrar causa y continuar tareas independientes; no inventar datos NASA. **R04**.
- [ ] Obtener límites referenciales con atribución y jerarquía coherente; preparar el subconjunto de demo. Comprobar la disponibilidad real del mapa base. **R01, R10**.
- [ ] Preparar tres fichas/secuencias y una asociación candidata con fuentes/estados. Etiquetar parcela, agua, costos y análisis simulados como supuestos, nunca como entrevistas o mediciones realizadas. **R05, R07, R08**.
- [ ] Comprobar qué credenciales LLM existen sin imprimirlas. Elegir/configurar un modelo accesible; dejar estado «IA no conectada» si faltan. No bloquear el resto del desarrollo. **R09**.

Salida: aplicación mínima arrancable y registro honesto del paquete de datos. Tener una URL de documentación no equivale a completar una extracción.

## Incremento 1 — login, parcela e historial

- [ ] Implementar registro/login/logout y sesiones revocables, hashing, protección de mutaciones y manejo seguro de cookies. **R02**.
- [ ] Modelar parcela, revisión de perfil, eventos de cultivo, observaciones de suelo y manejo con propietario/procedencia. Crear migraciones y repositorios. **R03, R10**.
- [ ] Implementar formulario progresivo mínimo y selección de parcela activa, preservando el borrador durante login. **R03, R11**.
- [ ] Recuperar perfil e historial después de recargar; mantener revisiones anteriores al registrar cambios/cosechas. **R03**.
- [ ] Probar con dos cuentas: IDs ajenos, fuentes privadas, sesión expirada, logout y caché privada. **R02, R10**.

Salida: usuario inicia sesión, guarda una parcela y recupera su perfil; otra cuenta no puede verlo.

## Incremento 2 — motor y ciclos explicados

- [ ] Implementar objetos de valor, validación de unidades/fechas, catálogo versionado y casos de uso independientes del framework. **R05–R07, R12**.
- [ ] Construir tres calendarios comparables, con transiciones y ciclos completos; separar asociaciones simultáneas de solapamientos erróneos. **R05, R08**.
- [ ] Integrar la evidencia NASA real al indicador climático. Implementar ET0/ETc solo después de comprobar método y ejemplo de referencia; sin ello dejar volúmenes pendientes. **R04, R07**.
- [ ] Implementar restricciones y estados: agua por periodo, calendario, antecedente, suelo y demás limitantes conocidas; faltantes explícitos. **R06**.
- [ ] Implementar margen bruto por ciclos y escenarios, aportes/necesidades de fertilización cuando haya datos e indicadores cualitativos cuando no. **R07**.
- [ ] Aplicar prioridad con métricas comparables y razones trazables; no compensar restricciones incumplidas con puntuación. **R06**.
- [ ] Guardar runs inmutables con entradas, revisiones y fuentes; cambiar agua/prioridad genera otro run. **R03, R06, R10**.
- [ ] Probar fechas/horizonte, conversiones, margen, presupuesto insuficiente, datos ausentes y reproducción de resultados. **R05–R07**.

Salida: una comparación reproducible con tres estados honestos, ciclo justificado y aporte NASA visible, incluso si alguna alternativa requiere datos.

## Incremento 3 — mapa y experiencia completa

- [ ] Implementar mapa Perú → departamento → provincia → distrito → parcela; sincronizar selectores/zoom y distinguir cobertura de demo. **R01**.
- [ ] Implementar geolocalización voluntaria, dibujo/entrada manual, geometría validada y área geodésica. **R01**.
- [ ] Presentar tarjetas, línea de tiempo, detalle de agua/margen/suelo, supuestos y evidencia sin obligar a entender términos técnicos. **R05, R07, R10, R11**.
- [ ] Resolver estados de carga, falta de datos y fallos del mapa/fuentes, con alternativa manual cuando corresponda. **R01, R10**.
- [ ] Incorporar ficha exploratoria de policultivo. Mostrar información INS únicamente si se curó con unidad, alimento y estado correctos. **R08**.
- [ ] Verificar móvil, teclado y tema claro incluso con sistema en modo oscuro. **R11**.

Salida: recorrido público y privado usable; no se confunde explorar Perú con contar con recomendaciones validadas para todo Perú.

## Incremento 4 — asistente IA con evidencia

- [ ] Implementar `AnswerFarmerQuestion`, recuperación de fichas/contexto autorizado y puerto LLM. **R09, R10**.
- [ ] Integrar adaptador Responses en backend, configuración por entorno, timeout, límites y estado de indisponibilidad. **R09**.
- [ ] Vincular chat a parcela y run; separar contexto histórico de perfil recién actualizado. **R03, R09**.
- [ ] Validar citas/métricas contra el contexto y renderizar fuentes desde el registro. No permitir acciones externas ni modificaciones del perfil desde el chat. **R09**.
- [ ] Probar: explicación del ciclo, menos agua, suelo desconocido, cita inventada, cifra sin respaldo, contexto de otra cuenta e instrucciones insertadas en una ficha. **R02, R09**.
- [ ] Con credenciales disponibles, verificar preguntas reales y sus fuentes; registrar modelo/configuración. Los mocks solo comprueban el contrato, no esta conexión. **R09**.

Salida: asistente que explica los resultados existentes o reconoce que falta evidencia, sin reemplazar el motor.

## Incremento 5 — integración y presentación

- [ ] Ejecutar pruebas de dominio, integración PostgreSQL y E2E del recorrido de aceptación. Corregir fallos materiales. **R01–R12**.
- [ ] Confirmar paquete NASA real, atribuciones, fuentes, separación entre datos/supuestos y ausencia de secretos. **R04, R10, R12**.
- [ ] Ensayar: mapa → login → recuperar parcela → comparar ciclos → cambiar agua/prioridad → consultar IA → abrir fuentes → historial/logout. **R01–R12**.
- [ ] Documentar comandos comprobados de arranque, migración, seed y tests; anotar credenciales/configuración que el equipo deba aportar sin incluir valores secretos. **R12**.
- [ ] Entregar resumen del código realizado, pruebas ejecutadas y límites pendientes. No afirmar validación agronómica ni conexión real de servicios que no se haya comprobado.

HLS, infraestructura de búsqueda vectorial, clasificación de cultivos y otras ampliaciones no desplazan estas tareas. Malezas, macheteo y herbicidas permanecen fuera del alcance.
