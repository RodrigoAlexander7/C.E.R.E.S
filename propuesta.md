# CERES Majes: apoyo a decisiones de cultivo y cuidado del suelo

Propuesta para la hackatón, revisada el 14 de noviembre de 2026. Diseño pendiente de validación local; la aplicación todavía no se ha construido.

## Problema y propuesta de valor

El agricultor necesita decidir qué sembrar después de su cultivo actual, considerando agua, capital, comprador y condiciones del lote. Elegir por el precio de una cosecha deja fuera los costos y efectos de las campañas siguientes.

**CERES Majes será un sistema de apoyo a la toma de decisiones que evalúe qué estrategias agrícolas son viables para la parcela y recomiende alternativas según el agua disponible, el presupuesto, la fertilidad del suelo y las prioridades del agricultor.** Comparará la secuencia prevista con dos alternativas, explicando demanda de agua, margen bruto estimado, necesidades de fertilización y manejo del suelo. Combinará datos históricos NASA con información local; la decisión final será del agricultor, acompañado por su asesor.

Cada alternativa propondrá un **ciclo completo con calendario y justificación**: qué sembrar, después de qué cultivo, cuándo podría sembrarse y cosecharse, y qué condiciones deben confirmarse. Un **asistente virtual IA** usará el perfil de la parcela, los resultados calculados y las fuentes de la aplicación para responder preguntas en lenguaje sencillo y explicar las recomendaciones.

El piloto será la **Irrigación Pampa de Majes / Majes I, distrito de Majes, Caylloma, Arequipa**. AUTODEMA distingue esta primera etapa de las pampas de Siguas y describe su trasvase desde el Colca: la disponibilidad de riego debe ser una entrada local, separada de la lluvia. [Contexto AUTODEMA](https://www.autodema.gob.pe/generalidades-pemsii/).

Usuario inicial, como hipótesis: agricultor con un lote destinado a anuales, acompañado por un asesor. Cooperativas, asociaciones o asistencia técnica serían posibles facilitadores o clientes; no hay entrevistas ni disposición de pago comprobadas. Buscamos ayudar a comparar antes de comprometer capital y entender qué dato cambiaría la decisión.

## Interfaz, login y perfil de la parcela

Dashboard sencillo, en español y **solo con tema claro**. El mapa será público: Perú → departamento → provincia → distrito → parcela, acercándose a cada selección. El botón «Usar mi ubicación» será opcional; ubica al usuario, pero el terreno debe delimitarse o declarar su área. La demo agronómica se concentrará en **Majes I, Arequipa**; explorar otras zonas no significará tener recomendaciones locales validadas para ellas.

**Sí habrá registro y login.** Sin iniciar sesión se podrán consultar el mapa, las fuentes y un caso de demostración público. Para generar recomendaciones personalizadas, guardar parcelas, consultar su historial y usar el asistente con sus datos será necesario iniciar sesión. El login recupera el último perfil guardado; no detecta automáticamente qué se ha sembrado ni el estado real del suelo.

El formulario inicial pedirá el cultivo actual o anterior, si ya se cosechó o su fecha prevista de cosecha, disponibilidad de riego —admitiendo «no sé»— y prioridad: dinero, agua o suelo. Ubicación y área procederán de la selección del terreno. Análisis de suelo, costos, abonos e historia adicional se completarán progresivamente; su ausencia limitará qué se puede recomendar. Cada usuario accederá únicamente a sus parcelas, resultados y conversaciones.

## Estrategias del prototipo

Una estrategia incluirá **secuencia de cultivos + asociaciones simultáneas, cuando correspondan + manejo de residuos y fertilización**. Adoptamos tres estrategias como meta de diseño, siguiendo la sugerencia de [reto.md](/home/totora/Documents/PROFESIONAL/C.E.R.E.S/reto.md):

| Estrategia | Ejemplo para configurar | Estado |
|---|---|---|
| A. Continuar el plan | Secuencia declarada; maíz → maíz solo como ejemplo ficticio | Referencia; no se afirma que sea la práctica típica de Majes. |
| B. Introducir una leguminosa | Maíz → frejol → maíz | Secuencia estudiada localmente; faltan variedad, destino comercial, calendario y parámetros del lote. |
| C. Diversificar comercialmente | Maíz → cebolla → maíz | Hipótesis exploratoria, bloqueada como recomendación hasta validación agronómica y comercial. |

Una tesis UNSA de 2019 documenta cuatro campañas maíz–frejol en Majes. Comparó labranzas dentro de esa secuencia; **no demuestra superioridad de la rotación, ahorro de agua ni mayores ingresos**. [Registro del ensayo](https://alicia.concytec.gob.pe/vufind/Record/UNSA_fda2ef5dce9e732d8e8e3a84449b008e).

Todas compartirán superficie, estado inicial y horizonte. Se propone explorar 24 meses, ajustándolo para todas si los ciclos reales no encajan; mostrar cosechas, transiciones y descansos. La alfalfa establecida queda para una ampliación que incluya instalación, cortes y obligaciones forrajeras.

La línea de tiempo comenzará después de liberar el terreno y respetará ventanas de siembra, duración de etapas y preparación entre campañas. Cada paso explicará su relación con el cultivo anterior, el patrón climático histórico, el agua, el suelo y la prioridad elegida, con fuentes y supuestos. Las fechas serán orientativas, no una predicción meteorológica ni una garantía de cosecha.

## Policultivos, fertilidad, nutrientes y abonos

**Policultivos:** se incorporan como un tipo de estrategia evaluable. La rotación cambia cultivos entre campañas; el policultivo los asocia simultáneamente y puede formar parte de una rotación. Por ejemplo, `(maíz + frejol) → siguiente cultivo` representa una estructura ilustrativa, no una asociación ya validada para Majes. El ensayo de rotación citado arriba no valida esa asociación simultánea.

Para el MVP prepararemos una ficha de asociación acotada: especies, densidades, fechas, duración, demanda hídrica, rendimientos y manejo conjunto. Sus parámetros requieren revisión local; mientras falten datos críticos se mostrará como exploratoria, sin recomendarla. No sumaremos consumos o rendimientos de monocultivos para simular una asociación ni asumiremos ahorro de agua o abonos.

**Fertilidad y nutrientes:** serán un eje central. Para cada estrategia distinguiremos:

- **Estado inicial del suelo:** nutrientes analizados, materia orgánica, pH y salinidad, con fecha, profundidad y método del análisis. NASA no sustituye estas mediciones.
- **Necesidades del cultivo:** requerimientos nutricionales y extracción estimada por cosecha, con parámetros documentados por cultivo y manejo.
- **Aportes y cuidado del suelo:** residuos conservados o retirados, cobertura, abonos verdes, compost y fertilizantes orgánicos o minerales, según corresponda. Se registrarán cantidad, composición, disponibilidad estimada de nutrientes, momento y costo de aplicación; el aporte total no se considerará automáticamente disponible para la siguiente campaña.

Con análisis y parámetros revisados se podrá comparar la necesidad estimada de fertilización y su costo. Si faltan, se mostrarán los datos requeridos e indicadores cualitativos, sin inventar un balance de NPK ni dosis de abono. SENASA recomienda partir del análisis de suelo para elaborar el plan de fertilización. [Guía de buenas prácticas para frijol](https://www.senasa.gob.pe/senasa/descargasarchivos/2020/07/Guia-BPA-FRIJOL.pdf).

**Corrección del ejemplo:** el trigo no se registrará como fijador de nitrógeno. Leguminosas como frejol y alfalfa pueden fijar nitrógeno atmosférico mediante su asociación con bacterias; el aporte que queda para otros cultivos depende de las condiciones, la cosecha y los residuos. No se asignará un crédito fijo por sembrarlas. [Manual de rizobios del INIA](https://repositorio.inia.gob.pe/items/f3fb4396-3a7f-4abd-907e-4503d1e1af2e), [explicación de la Universidad de Minnesota](https://extension.umn.edu/agriculture/crop-production/forages/legume-life-cycles-and-characteristics).

## Cómo se evaluarán

**Primero, viabilidad:** calendario, cultivo anterior, restricciones sanitarias, suelo/salinidad relevantes, agua mensual, capital, maquinaria, comprador y forraje mínimo. Una incompatibilidad descarta la opción. Un dato crítico desconocido produce «requiere verificación», sin recomendación automática. Las tres opciones pueden mostrarse aunque no todas resulten viables.

**Después, resultados comparables:**

- **Agua:** `ETc = Kc × ET0`, por cultivo y etapa con coeficientes documentados. ET0 representa demanda atmosférica y ETc demanda del cultivo bajo condiciones estándar. El riego neto requiere precipitación efectiva y balance explícito; el bruto incorpora eficiencia. Una simplificación deberá declarar que omite reservas del suelo, ascenso capilar o lavado de sales. [FAO 56](https://www.fao.org/4/X0490E/x0490e0a.htm), [riego neto y bruto](https://www.fao.org/4/u5835e/u5835e02.htm).
- **Economía:** sumar `rendimiento comercializable × precio en chacra − costos variables` de todos los ciclos, incluyendo transiciones, abonos, fertilizantes y labores de aplicación. Mostrar margen bruto estimado, costos excluidos, capital necesario y escenarios de precio/rendimiento. No llamarlo ganancia neta ni conservar el rendimiento automáticamente cuando falta agua. Para forraje propio, evitar contar venta y sustitución de compra simultáneamente.
- **Suelo y fertilidad:** comparar necesidades nutricionales y aportes de manejo cuando existan datos suficientes, junto con diversidad de familias, cobertura y residuos. Distinguir mediciones, estimaciones e indicadores cualitativos; no equivalen a cambios de nutrientes o carbono ya demostrados.

La dotación será confirmada localmente, con unidad y punto de entrega. Turnos u horas solo se convierten a volumen con caudal verificado; si falta, quedará pendiente. NASA no revela el agua entregable por el canal.

Entre opciones viables, el usuario elegirá prioridades de agua, margen y suelo. Si se agrega puntuación, pesos y normalización serán públicos; las métricas seguirán visibles. Usaremos los mismos años y escenarios para todas, mostrando cuándo cambia el orden. Si ET0 no puede calcularse y verificarse correctamente, mostraremos exposición climática relativa y dejaremos volúmenes pendientes.

## Datos y aporte de NASA

| Fuente | Uso | Estado de acceso en esta revisión |
|---|---|---|
| [NASA POWER](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) | Temperatura y precipitación históricas; radiación, humedad y viento para ET0 | Documentación/API identificadas; serie del piloto y método de lluvia efectiva pendientes. |
| [SENAMHI, Pampa de Majes](https://www.senamhi.gob.pe/site/descarga-datos/map_hist_data.php) | Contraste local y calendario | Estación listada; cobertura, acceso y exportación pendientes. |
| [AUTODEMA / Junta / ALA](https://www.gob.pe/institucion/autodema/noticias/1427049-gobierno-regional-de-arequipa-impulsara-parcela-demostrativa-para-fortalecer-la-adaptacion-agricola-frente-al-fenomeno-el-nino) | Planes de cultivo, riego y disponibilidad | Fuentes identificadas; dotación vigente del caso pendiente. |
| [MIDAGRI / SIEA](https://www.gob.pe/institucion/midagri/informes-publicaciones/2730325-compendio-anual-de-produccion-agricola) | Rendimientos y precios en chacra históricos | Publicaciones identificadas; archivos y detalle local por comprobar. |
| [INIA](https://repositorio.inia.gob.pe/items/f3fb4396-3a7f-4abd-907e-4503d1e1af2e), [SENASA](https://www.senasa.gob.pe/senasa/descargasarchivos/2020/07/Guia-BPA-FRIJOL.pdf) y FAO | Fichas agronómicas, fijación biológica y criterios de fertilización | Documentación identificada; parámetros y asociación aplicables a Majes pendientes de revisión. |
| Agricultor, asesor y laboratorio | Historia, análisis de suelo, agua, abonos utilizados, costos y mercado | Entradas necesarias; no se recogieron datos de una parcela real. |

POWER modificará indicadores según fecha y etapa: exposición térmica histórica y ET0 cuando su cálculo esté validado. Su meteorología representa celdas de **0,5° × 0,625°**, contexto regional que no es medición parcelaria. El histórico tampoco pronostica la próxima campaña. [Resolución POWER](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/).

HLS, a 30 m, sería opcional para cobertura/NDVI tras validar Earthdata Login, escenas locales y calidad. No diagnosticaría NPK ni causas de estrés. [HLS y acceso](https://hls.gsfc.nasa.gov/data-access-and-tools/).

**NASA POWER será obligatorio y tendrá efecto en el cálculo**, no solamente en una capa del mapa: permitirá comparar exposición térmica y, con el método validado, demanda hídrica por etapa y fecha. El inventario completo de datos, servicios, documentación técnica y estado de acceso está en [recursos.md](/home/totora/Documents/PROFESIONAL/C.E.R.E.S/recursos.md).

SISAP ofrece precios mayoristas; no sustituye el precio en chacra. Usaremos referencias históricas y datos editables del productor con fecha y ámbito. [Descripción MIDAGRI](https://www.gob.pe/institucion/midagri/campa%C3%B1as/3432-precios-de-productos-a-tu-alcance). Cada entrada distinguirá fuente, declaración, supuesto e inferencia. En esta investigación no se descargaron series locales ni se probó una integración operativa.

## Experiencia y demostración

1. Explorar el mapa público y seleccionar el terreno o un caso de demostración.
2. Registrarse o iniciar sesión para guardar la parcela y recuperar su perfil.
3. Completar los datos mínimos y elegir una prioridad; ampliar suelo, costos y manejo cuando existan.
4. Comparar tres ciclos con siembras, cosechas, transiciones, agua mensual, rangos de margen y cuidado del suelo. Identificar policultivos y sus datos pendientes.
5. Abrir «por qué aparece esta opción»: fuentes, reglas, supuestos y faltantes de cada etapa.
6. Preguntar al asistente, por ejemplo: «¿Por qué sugieres frejol después del maíz?» o «¿Qué cambiaría con menos agua?».
7. Cambiar dotación, fecha o prioridad, generar una nueva comparación y conservar la anterior en el historial.

La demo usará datos NASA reales precargados y entradas locales documentadas o etiquetadas como supuestos. Mostrará una decisión afectada por el dato ambiental, una alternativa descartada o pendiente, su ciclo justificado y una respuesta IA respaldada por fuentes. No se enviarán mensajes externos; WhatsApp queda fuera del MVP.

## Asistente virtual IA

Será una función central de la aplicación. Consultará el perfil autorizado de la parcela, su historial, la comparación seleccionada y fichas agronómicas con procedencia. Responderá en español sencillo, distinguirá datos de supuestos y enlazará las fuentes usadas. Si falta información, explicará qué se necesita y cómo afecta la conclusión.

El motor agronómico calculará agua, costos, restricciones y orden de alternativas. El asistente **explicará esos resultados** y podrá solicitar una nueva simulación mediante el mismo motor; no inventará cifras, calendarios, nutrientes o fuentes. En el MVP el chat será de consulta: cualquier cambio del perfil o nueva comparación se confirmará desde los controles de la aplicación.

Se usará un adaptador de LLM del backend, inicialmente para la API Responses de OpenAI, con modelo y credenciales configurables. El contexto incluirá únicamente datos necesarios y fuentes permitidas. Sin credenciales, la interfaz indicará «IA no conectada» y podrá mostrar fichas, sin presentar respuestas simuladas como IA operativa. Los detalles están en [specs/diseno.md](/home/totora/Documents/PROFESIONAL/C.E.R.E.S/specs/diseno.md).

## Información nutricional complementaria

Una ficha breve podrá mostrar composición alimentaria según las Tablas Peruanas del INS: porción de referencia, estado crudo/cocido y nutrientes disponibles. No intervendrá como filtro obligatorio de viabilidad ni se traducirá en promesas de reducir anemia o tratar enfermedades. No se confundirá nutrición del alimento con fertilidad del suelo. [Consulta INS](https://tablasperuanas.ins.gob.pe/lista-alimentos).

## Desarrollo y arquitectura

Se trabajará con **Spec Driven Development y Clean Architecture**, usando **Next.js con TypeScript**, **Python con FastAPI** y **PostgreSQL**. El frontend mostrará mapa, perfil, ciclos y chat; el backend será responsable de autorización, reglas, cálculos y acceso a fuentes. El dominio no dependerá del framework ni del proveedor de IA.

La entrada para el agente será [main.md](/home/totora/Documents/PROFESIONAL/C.E.R.E.S/main.md), acompañada de [requisitos](/home/totora/Documents/PROFESIONAL/C.E.R.E.S/specs/requisitos.md), [diseño](/home/totora/Documents/PROFESIONAL/C.E.R.E.S/specs/diseno.md), [tareas](/home/totora/Documents/PROFESIONAL/C.E.R.E.S/specs/tareas.md) y [recursos](/home/totora/Documents/PROFESIONAL/C.E.R.E.S/recursos.md).

## Alcance y próximos pasos

Plan orientativo de **48 horas**, supuesto ajustable al equipo y tiempo real disponible:

| Tramo | Resultado |
|---|---|
| 0–8 h | Revisar especificaciones, delimitar caso, probar NASA y preparar fichas con procedencia. |
| 8–24 h | Construir login, perfil, persistencia y motor de ciclos, filtros e indicadores. |
| 24–40 h | Integrar mapa, comparación y asistente IA con fuentes. |
| 40–48 h | Verificar autorización, cálculos, citas e historial; ensayar demo. |

Imprescindible: mapa, login y perfil persistente; tres secuencias comparables con ciclo justificado; fertilidad y abonos explícitos; una ficha de policultivo con estado de validación; NASA POWER real y trazable; asistente IA con fuentes; filtros respetados e historial reproducible. La evaluación cuantitativa del policultivo depende de sus parámetros; si faltan, permanecerá exploratoria. HLS y el detalle nutricional son complementarios. Se excluyen **detección de malezas, macheteo y recomendaciones de herbicidas**, simulador genérico de asociaciones, pronóstico propio, clasificación automática, precios futuros y recomendaciones clínicas.

Antes del uso en campo: validar reglas y calendarios con un agrónomo local, conseguir dotación y análisis del lote, actualizar presupuestos y comprobar comprensión con productores. Son tareas pendientes.

**Pitch:** «CERES te ayuda a elegir qué cultivar después según tu parcela, el agua y tus prioridades. Propone ciclos de cultivo y un asistente IA explica cada recomendación con datos NASA, información local y fuentes claras».

El texto de trabajo es `reto.md`. No pudo abrirse Resources; el [reto oficial con slug alternativo](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/) solo se verificó mediante su resumen indexado. Consulte el [sustento de investigación](</home/totora/Documents/PROFESIONAL/C.E.R.E.S/reports/Rotaciones agrícolas para Majes.md>) y la [propuesta original conservada](</home/totora/Documents/PROFESIONAL/C.E.R.E.S/research_notes/Rotaciones agrícolas para Majes/propuesta_original.md>).
