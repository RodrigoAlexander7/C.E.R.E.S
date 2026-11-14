# CERES Majes: comparar rotaciones antes de sembrar

Propuesta para la hackatón, revisada el 14 de noviembre de 2026. Diseño pendiente de validación local; la aplicación todavía no se ha construido.

## Problema y propuesta de valor

El agricultor necesita decidir qué sembrar después de su cultivo actual, considerando agua, capital, comprador y condiciones del lote. Elegir por el precio de una cosecha deja fuera los costos y efectos de las campañas siguientes.

**CERES Majes comparará la secuencia prevista por el agricultor con dos alternativas, explicando diferencias de demanda de agua, margen bruto estimado y prácticas de cuidado del suelo.** Combinará datos históricos NASA, información agronómica y restricciones del usuario para apoyar una decisión con su asesor.

El piloto será la **Irrigación Pampa de Majes / Majes I, distrito de Majes, Caylloma, Arequipa**. AUTODEMA distingue esta primera etapa de las pampas de Siguas y describe su trasvase desde el Colca: la disponibilidad de riego debe ser una entrada local, separada de la lluvia. [Contexto AUTODEMA](https://www.autodema.gob.pe/generalidades-pemsii/).

Usuario inicial, como hipótesis: agricultor con un lote destinado a anuales, acompañado por un asesor. Cooperativas, asociaciones o asistencia técnica serían posibles facilitadores o clientes; no hay entrevistas ni disposición de pago comprobadas. Buscamos ayudar a comparar antes de comprometer capital y entender qué dato cambiaría la decisión.

## Estrategias del prototipo

Adoptamos tres estrategias como meta de diseño, siguiendo la sugerencia de [reto.md](/home/totora/Documents/PROFESIONAL/C.E.R.E.S/reto.md):

| Estrategia | Ejemplo para configurar | Estado |
|---|---|---|
| A. Continuar el plan | Secuencia declarada; maíz → maíz solo como ejemplo ficticio | Referencia; no se afirma que sea la práctica típica de Majes. |
| B. Introducir una leguminosa | Maíz → frejol → maíz | Secuencia estudiada localmente; faltan variedad, destino comercial, calendario y parámetros del lote. |
| C. Diversificar comercialmente | Maíz → cebolla → maíz | Hipótesis exploratoria, bloqueada como recomendación hasta validación agronómica y comercial. |

Una tesis UNSA de 2019 documenta cuatro campañas maíz–frejol en Majes. Comparó labranzas dentro de esa secuencia; **no demuestra superioridad de la rotación, ahorro de agua ni mayores ingresos**. [Registro del ensayo](https://alicia.concytec.gob.pe/vufind/Record/UNSA_fda2ef5dce9e732d8e8e3a84449b008e).

Todas compartirán superficie, estado inicial y horizonte. Se propone explorar 24 meses, ajustándolo para todas si los ciclos reales no encajan; mostrar cosechas, transiciones y descansos. La alfalfa establecida queda para una ampliación que incluya instalación, cortes y obligaciones forrajeras.

**¿Policultivo?** La rotación cambia cultivos a lo largo del tiempo; la asociación o policultivo incorpora especies simultáneamente. Mantendremos rotaciones en el MVP. Una futura asociación necesita parámetros de competencia, calendario y manejo específicos; no se modela sumando Kc ni atribuyendo beneficios automáticos. Se puede registrar una asociación existente como antecedente sin simularla todavía.

## Cómo se evaluarán

**Primero, viabilidad:** calendario, cultivo anterior, restricciones sanitarias, suelo/salinidad relevantes, agua mensual, capital, maquinaria, comprador y forraje mínimo. Una incompatibilidad descarta la opción. Un dato crítico desconocido produce «requiere verificación», sin recomendación automática. Las tres opciones pueden mostrarse aunque no todas resulten viables.

**Después, resultados comparables:**

- **Agua:** `ETc = Kc × ET0`, por cultivo y etapa con coeficientes documentados. ET0 representa demanda atmosférica y ETc demanda del cultivo bajo condiciones estándar. El riego neto requiere precipitación efectiva y balance explícito; el bruto incorpora eficiencia. Una simplificación deberá declarar que omite reservas del suelo, ascenso capilar o lavado de sales. [FAO 56](https://www.fao.org/4/X0490E/x0490e0a.htm), [riego neto y bruto](https://www.fao.org/4/u5835e/u5835e02.htm).
- **Economía:** sumar `rendimiento comercializable × precio en chacra − costos variables` de todos los ciclos, incluyendo transiciones. Mostrar margen bruto estimado, costos excluidos, capital necesario y escenarios de precio/rendimiento. No llamarlo ganancia neta ni conservar el rendimiento automáticamente cuando falta agua. Para forraje propio, evitar contar venta y sustitución de compra simultáneamente.
- **Suelo:** diversidad de familias, cobertura, leguminosas y manejo de residuos como indicadores de diseño; no equivalen a nutrientes o carbono medidos. El beneficio de una leguminosa depende del manejo; no asignaremos nitrógeno automático.

La dotación será confirmada localmente, con unidad y punto de entrega. Turnos u horas solo se convierten a volumen con caudal verificado; si falta, quedará pendiente. NASA no revela el agua entregable por el canal.

Entre opciones viables, el usuario elegirá prioridades de agua, margen y suelo. Si se agrega puntuación, pesos y normalización serán públicos; las métricas seguirán visibles. Usaremos los mismos años y escenarios para todas, mostrando cuándo cambia el orden. Si ET0 no puede calcularse y verificarse correctamente, mostraremos exposición climática relativa y dejaremos volúmenes pendientes.

## Datos y aporte de NASA

| Fuente | Uso | Estado de acceso en esta revisión |
|---|---|---|
| [NASA POWER](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) | Temperatura y precipitación históricas; radiación, humedad y viento para ET0 | Documentación/API identificadas; serie del piloto y método de lluvia efectiva pendientes. |
| [SENAMHI, Pampa de Majes](https://www.senamhi.gob.pe/site/descarga-datos/map_hist_data.php) | Contraste local y calendario | Estación listada; cobertura, acceso y exportación pendientes. |
| [AUTODEMA / Junta / ALA](https://www.gob.pe/institucion/autodema/noticias/1427049-gobierno-regional-de-arequipa-impulsara-parcela-demostrativa-para-fortalecer-la-adaptacion-agricola-frente-al-fenomeno-el-nino) | Planes de cultivo, riego y disponibilidad | Fuentes identificadas; dotación vigente del caso pendiente. |
| [MIDAGRI / SIEA](https://www.gob.pe/institucion/midagri/informes-publicaciones/2730325-compendio-anual-de-produccion-agricola) | Rendimientos y precios en chacra históricos | Publicaciones identificadas; archivos y detalle local por comprobar. |
| Agricultor, asesor y laboratorio | Historia, suelo, agua, costos y mercado | Entradas necesarias; no se recogieron datos de una parcela real. |

POWER modificará indicadores según fecha y etapa: exposición térmica histórica y ET0 cuando su cálculo esté validado. Su meteorología representa celdas de **0,5° × 0,625°**, contexto regional que no es medición parcelaria. El histórico tampoco pronostica la próxima campaña. [Resolución POWER](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/).

HLS, a 30 m, sería opcional para cobertura/NDVI tras validar Earthdata Login, escenas locales y calidad. No diagnosticaría NPK ni causas de estrés. [HLS y acceso](https://hls.gsfc.nasa.gov/data-access-and-tools/).

SISAP ofrece precios mayoristas; no sustituye el precio en chacra. Usaremos referencias históricas y datos editables del productor con fecha y ámbito. [Descripción MIDAGRI](https://www.gob.pe/institucion/midagri/campa%C3%B1as/3432-precios-de-productos-a-tu-alcance). Cada entrada distinguirá fuente, declaración, supuesto e inferencia. En esta investigación no se descargaron series locales ni se probó una integración operativa.

## Experiencia y demostración

1. Abrir un caso precargado o indicar ubicación, área y cultivo anterior.
2. Completar un formulario breve con «no sé» y apoyo del asesor para información técnica.
3. Comparar tres líneas de tiempo, agua mensual, rangos de margen y criterios de suelo.
4. Abrir «por qué aparece esta opción»: fuentes, reglas, supuestos y faltantes.
5. Cambiar dotación, fecha o prioridades, observar el recálculo y copiar un resumen.

La demo usará datos NASA reales precargados y entradas locales documentadas o etiquetadas como supuestos. Mostrará una decisión afectada por el dato ambiental, una alternativa descartada o pendiente y cambios entre opciones viables. WhatsApp puede representarse mediante resumen copiable; la integración real queda para después.

## Alcance y próximos pasos

Plan orientativo de **48 horas**, supuesto ajustable al equipo y tiempo real disponible:

| Tramo | Resultado |
|---|---|
| 0–8 h | Delimitar caso, probar descarga NASA y revisar tres fichas y calendarios. |
| 8–24 h | Preparar archivos trazables y motor de filtros, indicadores y escenarios. |
| 24–40 h | Construir comparación, explicación y resumen. |
| 40–48 h | Revisar unidades, faltantes y recálculo; ensayar demo y pitch. |

Imprescindible: tres secuencias comparables, aporte NASA trazable, filtros respetados y resultados reproducibles. Opcional: mapa/HLS. Posponer pronóstico propio, clasificación automática, precios futuros y componente nutricional/anemia para concentrarnos en la decisión agrícola.

Antes del uso en campo: validar reglas y calendarios con un agrónomo local, conseguir dotación y análisis del lote, actualizar presupuestos y comprobar comprensión con productores. Son tareas pendientes.

**Pitch:** «CERES Majes ayuda a comparar qué sembrar después, cruzando datos históricos NASA con el agua, los costos y el suelo del agricultor. Explica qué cambia entre alternativas y qué necesita confirmar antes de decidir».

El texto de trabajo es `reto.md`. No pudo abrirse Resources; el [reto oficial con slug alternativo](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/) solo se verificó mediante su resumen indexado. Consulte el [sustento de investigación](</home/totora/Documents/PROFESIONAL/C.E.R.E.S/reports/Rotaciones agrícolas para Majes.md>) y la [propuesta original conservada](</home/totora/Documents/PROFESIONAL/C.E.R.E.S/research_notes/Rotaciones agrícolas para Majes/propuesta_original.md>).
