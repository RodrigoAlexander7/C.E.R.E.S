# CERES — entrada para el agente de desarrollo

Fecha de definición: 14 de noviembre de 2026. Este archivo es el encargo para **implementar** la aplicación; no es una declaración de que ya exista. El equipo entregará este archivo junto con el resto de la documentación.

## 1. Objetivo

Construye una aplicación sencilla que ayude al agricultor de Majes a elegir qué cultivar después, considerando su parcela, agua, historial y prioridades. Debe evaluar viabilidad, comparar estrategias y proponer un ciclo de cultivo justificado. Un asistente virtual IA explicará los resultados con datos de la aplicación, fuentes verificables y lenguaje sencillo. La decisión final será del agricultor.

La demo se situará en **Majes I / Pampa de Majes, Caylloma, Arequipa**. El mapa permite explorar Perú, pero no se presentará un catálogo agronómico validado para todo el país. Distinguir irrigación Majes I, valle de Majes y Majes Siguas II.

## 2. Lee estos documentos

Respeta las instrucciones del usuario y los AGENTS.md aplicables. Dentro de la documentación del producto, aplica las decisiones actuales en este orden:

1. `main.md`: encargo y alcance acordado.
2. `specs/requisitos.md`: comportamiento y criterios de aceptación.
3. `specs/diseno.md`: arquitectura, datos, API y motor.
4. `specs/tareas.md`: implementación por incrementos verificables.
5. `recursos.md`: fuentes, extracción, procedencia y disponibilidad.
6. `propuesta.md`: explicación del producto.
7. `reto.md`: texto del reto aportado por el equipo.
8. `reports/Rotaciones agrícolas para Majes.md` y `research_notes/`: evidencia y límites de la investigación.

Para preparar la publicación, leer también `despliegue.md` e `infra/azure/`. El usuario ha encargado el despliegue en Azure a este chat; el agente de desarrollo preparará los artefactos y no duplicará el aprovisionamiento.

La **sección 11** recoge la dirección de producto acordada el 15-nov-2026 (modo sencillo, cuaderno de campo, voz y asistente con memoria); cuando contradiga una sección anterior, prevalece la sección 11.

`propuesta_v2.md` y `research_notes/Rotaciones agrícolas para Majes/propuesta_original.md` son antecedentes conservados, no requisitos vigentes. No los borres ni los uses para reintroducir malezas, macheteo, alfalfa comparada injustamente o afirmaciones sin verificar. Si detectas una contradicción importante entre documentos actuales, resuélvela siguiendo las decisiones más recientes del usuario y deja constancia.

## 3. Producto que debe funcionar

### Parte pública

- Dashboard con mapa: Perú → departamento → provincia → distrito → parcela, zoom y selección manual.
- Botón voluntario de ubicación del navegador; si se deniega, el mapa sigue funcionando.
- Fuentes y contexto ambiental con fecha y resolución.
- Un caso público de demostración, separado de información privada.
- Fuera de la zona piloto, indicar que faltan fichas locales para recomendar.

### Parte privada, con registro y login

- Registro con email/contraseña, inicio y cierre de sesión.
- Crear y recuperar parcelas propias; seleccionar una como activa.
- Perfil actual, historial de cultivos, análisis conocidos, agua, manejo y preferencias.
- Recomendaciones personalizadas, ciclos y resultados guardados.
- Asistente IA contextual a la parcela y comparación seleccionadas.

El login recupera datos guardados; no mide el suelo ni descubre automáticamente el cultivo. Proteger toda operación privada en backend, no solo ocultar botones.

### Flujo inicial sencillo

1. Elegir o delimitar el terreno. Calcular/confirmar su área; GPS por sí solo no da el contorno.
2. Iniciar sesión si se desea personalización, conservando el borrador de selección.
3. Indicar último cultivo o cultivo actual y si ya se cosechó o su fecha prevista de cosecha.
4. Indicar disponibilidad de riego, admitiendo «no sé».
5. Elegir prioridad: dinero, agua o cuidado del suelo; opción equilibrada como valor inicial.
6. Ver comparación, ciclo, razones, fuentes y datos pendientes.

Suelo, costos, abonos e historial adicional se completarán progresivamente. No exijas un formulario técnico interminable para explorar, ni inventes esos datos para personalizar.

## 4. Motor de decisión

Comparar el plan del agricultor y dos alternativas del catálogo curado. La base inicial es la descrita en `propuesta.md`; no afirmar que las secuencias ilustrativas sean la práctica típica o recomendaciones ya validadas.

Una estrategia contiene secuencia de cultivos, fechas, manejo de residuos/fertilización y, cuando corresponda, una asociación simultánea. Mostrar siembra, etapas, cosecha, preparación y descansos sobre la misma superficie, horizonte y condiciones iniciales. Explorar 24 meses solo si encajan ciclos completos; ajustar el horizonte para todas cuando sea necesario. No truncar cosechas para favorecer una opción.

Orden de evaluación:

1. Validar entradas y parámetros, incluyendo unidades y fuente.
2. Aplicar restricciones obligatorias: calendario, antecedente, suelo relevante, agua por periodo, presupuesto y condiciones comerciales/forrajeras cuando se conozcan.
3. Clasificar como `viable_con_supuestos`, `no_viable`, `requiere_datos` o `exploratoria`.
4. Comparar métricas y ordenar únicamente opciones con evidencia suficiente para la prioridad solicitada.
5. Explicar cada decisión mediante reglas, valores, fuentes y supuestos registrados.

Una preferencia económica no puede volver viable una opción que incumple agua. Un dato desconocido no es cero ni una restricción satisfecha. Si quedan menos de tres opciones viables, mostrar los descartes o faltantes sin fabricar otras.

NASA POWER real debe modificar al menos un indicador: exposición térmica y/o demanda hídrica según el calendario. El histórico no es pronóstico. Calcular ET0/ETc solo con método y unidades comprobados; si no están listos, mostrar el indicador climático disponible y dejar volúmenes pendientes. Dotación del canal, precipitación y demanda del cultivo son conceptos separados.

Economía: margen bruto estimado por todos los ciclos, con precio en chacra, rendimiento comercializable y costos explícitos. Suelo: análisis disponible, necesidades nutricionales, aportes y manejo, distinguiendo estimación de medición. Policultivo: una ficha acotada; cuantificación condicionada a parámetros propios revisados. No sumar dos monocultivos ni dar nitrógeno automático a una leguminosa; trigo no es un fijador del catálogo.

## 5. Asistente IA obligatorio

Debe responder preguntas sobre el ciclo propuesto, motivos, agua, costos, suelo y cambios de escenarios. Usará únicamente contexto autorizado: perfil/historial, resultado del motor, instantánea NASA y documentos recuperados de la aplicación.

El motor calcula; el LLM explica. Todas las afirmaciones numéricas deben corresponder a métricas o datos existentes, y las citas a fuentes realmente incluidas en su contexto. Si falta evidencia, responder claramente qué se sabe y qué dato falta. Lenguaje sencillo y breve, con detalle desplegable.

El chat no ejecuta acciones externas ni modifica datos por su cuenta. **Actualización del 15-nov-2026 (sección 11):** el asistente puede *proponer* registros extraídos de texto o voz y pedir simulaciones al motor, pero un dato solo se guarda cuando el agricultor lo confirma en la interfaz, y toda simulación crea un resultado nuevo del motor. No permitir SQL libre, navegación web arbitraria ni acceso del LLM a datos de otra cuenta.

Implementar un puerto de LLM con adaptadores intercambiables. **Proveedor elegido por el equipo: Google Gemini** (`GEMINI_API_KEY`, `GEMINI_MODEL`); OpenAI Responses queda como alternativa (`OPENAI_API_KEY`, `OPENAI_MODEL`). Las claves se configuran en el servidor; no fijar un modelo inexistente ni exponer claves. Sin configuración, mostrar «IA no conectada» y permitir consultar fichas; no presentar un mock como IA operativa. Las pruebas automatizadas usarán un proveedor simulado, y la comprobación con servicio real se registrará por separado.

## 6. Decisiones técnicas acordadas

- **Spec Driven Development:** requisitos → diseño → tareas → implementación y validación de cada incremento. Mantener trazabilidad de criterios a pruebas. No detenerse en un plan: implementar los incrementos del alcance.
- **Clean Architecture:** dominio independiente; casos de uso; puertos; adaptadores para PostgreSQL, NASA y LLM; API como presentación.
- **Frontend:** Next.js App Router, React y TypeScript; MapLibre para mapa. Español, responsive, accesible y **solo tema claro**.
- **Backend:** Python, FastAPI y Pydantic. Cálculos y permisos en backend, sin duplicarlos en el cliente.
- **Datos:** PostgreSQL, SQLAlchemy y Alembic; GeoJSON/JSONB inicialmente. Evitar infraestructura adicional que el caso no necesite.
- **Autenticación:** contraseñas con Argon2 y sesiones opacas revocables en cookie HttpOnly; aislamiento por propietario.
- Fijar versiones compatibles en archivos de dependencias y lockfiles después de inspeccionar el entorno. No usar ejemplos obsoletos por asumir una versión.

## 7. Datos, servicios y entorno

El inventario completo es `recursos.md`; no se presupone que todos los portales tengan API operativa. Priorizar NASA POWER, límites descargados con procedencia y catálogo agronómico pequeño. Preparar datos reales cacheados y supuestos de demo etiquetados. No hacer que cada carga de pantalla o pregunta descargue años de datos externos.

Crear un `.env.example` sin secretos con las variables realmente utilizadas: conexión PostgreSQL, configuración de sesión/origen, `GEMINI_API_KEY`, `GEMINI_MODEL` (u `OPENAI_*`) y opciones de fuentes/caché. Earthdata solo si se implementa HLS. Documentar qué es obligatorio para arrancar y qué habilita funciones adicionales.

Sin claves LLM o acceso a un portal, avanzar con interfaces, persistencia, adaptadores y pruebas independientes. Registrar lo pendiente con causa concreta. **La aceptación de NASA real y de IA conectada no se satisface con mocks.** El usuario ha autorizado preparar el despliegue de CERES en Azure, reutilizando `rodrygo-resource-group` y priorizando el beneficio de estudiante. El agente de desarrollo entregará imágenes y configuración desplegables; el aprovisionamiento y publicación se coordinarán desde este chat según `despliegue.md`. No contratar servicios adicionales, crear otro grupo, cambiar la suscripción a pago por uso ni retirar su límite de gasto por iniciativa propia.

Actualización de autorización: el usuario permite usar crédito estudiantil y una eventual migración a pago por uso. Actualmente el despliegue conserva la suscripción de estudiante y su límite; esa gestión corresponde a este chat y no requiere que el agente de desarrollo cree recursos o cambie la cuenta.

## 8. Fuera de alcance

Detección de malezas, fecha de macheteo, herbicidas, clasificación automática de cultivos, predicción propia de clima/precios, diagnóstico de nutrientes por imagen, prescripción automática de dosis sin análisis, recomendaciones clínicas/anemia, WhatsApp/SMS real y validación agronómica nacional. La voz se usa **dentro de la aplicación web** (sección 11), no por canales de mensajería. La composición alimentaria INS es información complementaria, sin promesas de salud.

## 9. Cómo empezar y cuándo considerar terminada la implementación

1. Inspeccionar checkout, instrucciones y cambios existentes; conservar el trabajo de otros. No crear otro checkout por rutina.
2. Leer las especificaciones, comprobar entorno y registrar decisiones de implementación que falten.
3. Desarrollar las tareas por incrementos funcionales, empezando por persistencia, acceso a fuentes y un recorrido vertical completo.
4. Mantener un arranque local reproducible, migraciones, seed de demo y README con comandos comprobados.
5. Ejecutar pruebas significativas de autorización, cálculos, fechas/unidades, procedencia e integración de interfaz. No sustituirlas por capturas decorativas o tests que repitan el código.
6. Entregar resultado ejecutable y resumen de lo probado, datos reales usados y limitaciones restantes. No declarar implementado o validado un componente que solo tenga una interfaz o mock.

La definición de terminado verificable está en `specs/requisitos.md`. El punto decisivo de la demo será: seleccionar Majes, recuperar una parcela, comparar ciclos con evidencia NASA, cambiar agua/prioridad y preguntar a la IA por qué cambió el resultado, viendo las fuentes.

## 10. Preparación para el VPS Azure

Entregar Dockerfiles de producción para web/API y un Compose de despliegue con PostgreSQL persistente y proxy HTTPS, además del entorno local. Next.js debe construirse fuera del VPS y ejecutarse en modo de producción con artefacto reducido. No ejecutar servidor de desarrollo ni construir dependencias pesadas en una VM de 1 GiB.

La configuración candidata es Linux x64 `Standard_B2ats_v2`, 2 vCPU/1 GiB, con swap como apoyo y recursos limitados para una demo pequeña. Su suficiencia debe comprobarse con el recorrido completo; no se promete capacidad de producción. Solo el proxy publica 80/443. Base de datos y API quedan en la red interna; las cookies privadas usan HTTPS y el mismo origen. Las claves LLM se cargan en el servidor, nunca en imagen, repositorio o datos de inicialización de Azure.

El código debe ofrecer healthchecks, migraciones ejecutables, carga de datos reproducible, rotación de logs y un procedimiento de respaldo/restauración. Si el consumo no cabe o se requiere una VM mayor, informar de mediciones y costo antes de cambiar el dimensionamiento. El estado real del despliegue y las condiciones de costo se registran en `despliegue.md`.

## 11. Nueva dirección de producto (15 de noviembre de 2026)

Decisión del usuario tras evaluar el MVP: la versión actual es rigurosa pero compleja para un agricultor que no tiene estudio de suelos y solo recuerda lo que sembró en los últimos meses. Además, casi todas las opciones quedaban en «Requiere datos». CERES pasa de ser una calculadora de una sola vez a ser **el cuaderno de campo del agricultor**, que aprende de su historia y explica sus decisiones.

### Principios

1. **Primero opciones, después el porqué.** El agricultor ve tres opciones claras con una frase cada una; «¿Por qué?» abre la justificación en capas, de lo simple a lo técnico.
2. **Nunca un callejón sin salida.** Ante un dato desconocido se usa un **supuesto típico de la zona** con fuente o marcado como supuesto, visible y editable, y se dice **qué dato cambiaría la decisión**, preguntado de forma observable («¿ves costras blancas en tu chacra?»). La regla «un dato desconocido no es cero» se mantiene: el supuesto se etiqueta, no se presenta como medición.
3. **El motor calcula; la IA explica, pregunta y propone.** Las cifras salen del motor o de los registros del agricultor. La IA puede extraer datos de texto/voz y proponerlos, pero solo se guardan con confirmación.
4. **Lo propio vale más que lo supuesto.** Rendimientos, precios, costos y ganancias registrados por el agricultor sustituyen a los supuestos de demostración en sus cálculos.
5. **Rigor disponible, no impuesto.** Una sola aplicación sencilla, organizada por módulos; el detalle técnico, el perfil completo y el historial se abren con «Ver más» dentro de cada módulo.

### Superficies del producto

- **Landing pública** que explica la propuesta con datos reales y distingue lo disponible de lo próximo.
- **Modo sencillo** (nueva interfaz, primero para móvil): alta en 3 preguntas (qué sembraste, cuándo cosechas, qué te importa más), tres opciones en lenguaje cotidiano («Buena opción», «Posible, confirma X», «No conviene»), «¿Por qué?» en capas, botón de IA junto a términos difíciles (glosario fijo primero, IA bajo demanda) y mapa opcional.
- **Módulos**: «Qué sembrar», «Cuándo sembrar» y «Mi chacra», ampliados con Cuaderno y Ceres cuando estén implementados. Mapa opcional en «Mi chacra»; comparación técnica, perfil completo e historial en «Ver más». Las rutas antiguas redirigen a la aplicación.
- **Cuaderno de campo**: campañas (cultivo, hectáreas, fechas, rendimiento), ventas, costos y ganancia declarada por campaña/mes; resúmenes del tipo «el año pasado en este mes…».
- **Registro por chat y voz**: texto o audio → extracción estructurada → tarjeta «¿Guardo esto?» → registro `declarado (chat, confirmado)`. Revisión mensual dentro de la app y notificaciones opcionales del navegador; el agente pregunta lo que falta. El audio no se conserva, solo la transcripción confirmada.
- **Asistente conversacional «Ceres»** (el usuario lo llamó modo «Jarvis»; se usa un nombre propio): conversación sobre qué sembrar con memoria del cuaderno, simulaciones pedidas al motor, respuestas con fuentes y voz de salida del navegador. Distingue «ganancia que declaraste» de «margen estimado».
- **Evidencia NASA visible**: «¿cuándo me conviene sembrar?» según el mes, con los 11 años de NASA POWER, comparación de años El Niño/normales, e índice de vegetación (NDVI, HLS 30 m) de la parcela.

### Orden de implementación

Fase 0 especificación y landing → Fase 1 motor sin bloqueos → Fase 2 modo sencillo → Fase 3 momento NASA → Fase 4 NDVI de la parcela → Fase 5 cuaderno de campo → Fase 6 registro por chat/voz → Fase 7 asistente Ceres → Fase 8 pruebas, despliegue y guion de demo. Detalle en `specs/tareas.md` (incrementos 7–14).

### Segundo piloto: Valle de Chilina, Arequipa ciudad (decisión del 15-nov-2026)

Además de Majes I, CERES tendrá un segundo piloto en la **campiña del Valle de Chilina** (río Chili, ciudad de Arequipa). Implica pasar de un piloto fijo a **zonas piloto configurables**: límites/distritos de la zona (verificar con SERFOR/INEI cuáles abarca el valle), su propia instantánea NASA POWER (otra celda y otra altitud que Majes), sus supuestos de zona con fuente (agua de la junta de usuarios correspondiente, método de riego habitual) o marcados como `supuesto_zona`, y fichas/calendarios revisados para sus cultivos habituales. No trasladar valores de Majes a Chilina. Detalle en `specs/tareas.md` (incremento 15).

### Decisiones pendientes del usuario

- Canal de las preguntas mensuales: por defecto, revisión al abrir la app + notificaciones del navegador; WhatsApp/SMS sigue fuera de alcance.
- Acceso HLS decidido: verificar el catálogo público de Microsoft Planetary Computer para las parcelas piloto; el usuario autorizó esta alternativa sin cuenta Earthdata.
- Valores típicos de Majes I (dotación, eficiencia, salinidad, calendario, precios): deben obtenerse de AUTODEMA, Junta de Usuarios, Agencia Agraria o SIEA antes de presentarlos como «típicos»; si no se consiguen, se muestran como supuestos de zona.
