# Agricultura y rotaciones en Majes

Notas de investigación, consulta del 14 de noviembre de 2026. Alcance: condiciones locales, fuentes peruanas y alternativas agronómicas. Las propuestas del apartado «Inferencias» son decisiones de diseño para el prototipo, no recomendaciones de siembra validadas.

## 1. ¿Qué Majes y qué problema agrícola representan el piloto?

### Takeaway

Delimitar el caso a la **Irrigación Pampa de Majes, primera etapa del proyecto Majes Siguas, distrito de Majes, provincia de Caylloma**. El problema debe tratar la elección de secuencias agrícolas bajo riego y sus restricciones de agua, suelo y mercado; no partir de un calendario nacional de lluvias.

### Cited Findings

- AUTODEMA distingue la primera etapa, irrigación de Majes, de la segunda en las pampas de Siguas. La descripción institucional informa que la primera habilitó 15 900 ha brutas y explica el trasvase del río Colca mediante infraestructura de canales y túneles. Es contexto institucional; la página incluye descripciones históricas del proyecto que no deben usarse para afirmar el estado operativo actual de todas sus obras. [AUTODEMA, Aspectos generales](https://www.autodema.gob.pe/generalidades-pemsii/).
- AUTODEMA describe la trayectoria forrajera de Majes I y su diversificación posterior hacia otros cultivos en una nota de 2022 sobre investigación de riego. Esto respalda incluir el valor del forraje y las restricciones del sistema productivo en las decisiones. No ofrece una distribución actualizada de cultivos. [AUTODEMA, investigación para mejorar el riego](https://www.autodema.gob.pe/autodema-realiza-investigacion-para-mejorar-el-riego-en-la-pampa-de-majes/).
- Un informe del MINAM de 2016 caracteriza la irrigación con clima desértico, escasez de lluvias, alta luminosidad y producción de alfalfa vinculada a ganadería lechera. Registra rotación de alfalfa con maíz forrajero, cebolla, kiwicha, papa, ajo y quinua, entre otros, e informa permanencia media de alfalfa de unos dos años y medio. **Verificación limitada:** el buscador expuso texto del informe; la apertura directa del PDF dio 403. Su fecha y su naturaleza histórica impiden presentar sus superficies o proporciones como datos de 2026. [MINAM, informe de vigilancia en Arequipa, 2016](https://bioseguridad.minam.gob.pe/wp-content/uploads/2016/10/inf_vig_arequipa_16.pdf).
- En febrero de 2024 el Gobierno Regional informó acompañamiento de AUTODEMA a 14 parcelas de Majes con riego automatizado, apoyado en estaciones agroclimáticas, coeficiente de cultivo y estadio de desarrollo. Confirma utilidad de datos locales para decisiones hídricas; no equivale a acceso abierto a esas estaciones ni prueba ahorro generalizable. [GRA, riego automatizado en Majes](https://www.gob.pe/institucion/regionarequipa/noticias/911174-autodema-impulsa-uso-de-equipos-automatizados-para-riego-por-goteo).
- Una nota oficial del 7 de agosto de 2026 propone una parcela demostrativa de cinco hectáreas y articula AUTODEMA, Junta de Usuarios, SENAMHI, SENASA, ALA y Oficina Agraria. Señala como insumos el Plan de Cultivo y Riego, el Plan de Aprovechamiento y Disponibilidad Hídrica y reportes meteorológicos. Documenta una propuesta y necesidad local, no su ejecución ni resultados. [AUTODEMA, adaptación agrícola en Majes](https://www.gob.pe/institucion/autodema/noticias/1427049-gobierno-regional-de-arequipa-impulsara-parcela-demostrativa-para-fortalecer-la-adaptacion-agricola-frente-al-fenomeno-el-nino).

### Inferences

- La pregunta del agricultor puede formularse como: «Con mi cultivo anterior, el agua que podré recibir y mis costos, ¿qué secuencia me conviene comparar para las próximas campañas y por qué?».
- Elegir un productor de cultivos anuales o uno que ya decidió renovar su alfalfar permite una demostración manejable. Un productor con alfalfa recién establecida enfrenta una decisión distinta; no debe inducirse su eliminación automática por una comparación anual.
- Guardar el polígono del piloto y su denominación explícita. No confundir los cultivos del **valle de Majes** con los de la **Pampa de Majes**, ni trasladar evidencia de comunidades de Majes Siguas II a la irrigación piloto.
- El volumen de agua asignado o esperado debe ser un dato local del usuario o del operador. La lluvia local y la humedad superficial satelital no describen por sí solas el agua entregable por la infraestructura.

### Gaps

- No se obtuvo una distribución de cultivos de Pampa de Majes actualizada a 2026 ni una muestra representativa de agricultores entrevistados. Evitar porcentajes actuales de alfalfa o supuestos sobre la secuencia «típica».
- No se verificó disponibilidad pública de un análisis reciente de suelos por parcela, ni diagnósticos locales de pH, materia orgánica, salinidad o nutrientes. No afirmar que todas las parcelas son franco arenosas o tienen el mismo problema.
- No se verificaron turnos de riego, restricciones ni dotaciones vigentes por parcela. Tampoco resultados publicados de la iniciativa demostrativa anunciada en agosto de 2026.

## 2. ¿Qué fuentes locales pueden convertirse en insumos del prototipo?

### Takeaway

Hay fuentes oficiales útiles, pero **portal consultable, boletín PDF, serie descargada y API comprobada son estados diferentes**. El MVP puede usar archivos preparados con procedencia y fecha, más entradas del agricultor; no debe depender de integraciones cuya extracción todavía no se ha probado.

### Cited Findings

| Fuente | Qué se comprobó | Acceso y límites para el MVP |
|---|---|---|
| SENAMHI, estación Pampa de Majes | El mapa de datos históricos lista «PAMPA DE MAJES» en Arequipa. [Mapa de descarga](https://www.senamhi.gob.pe/site/descarga-datos/map_hist_data.php) | Portal de estaciones identificado; no se descargó una serie ni se comprobó rango de fechas, vacíos o variables. No se verificó API. |
| SENAMHI, servicio de descarga | La ficha oficial indica registro y contraseña enviados por SENAMHI para descargar. [Servicio de descarga](https://www.gob.pe/9312-conocer-los-datos-hidrometeorologicos-del-peru-descargar-los-datos-meteorologicos) | Preparar acceso antes del evento y documentar condiciones. No asumir que todos los endpoints son anónimos. La apertura de la ficha fue bloqueada, pero el requisito aparece en su indexación. |
| SENAMHI, servicios agroclimáticos | Ofrece información fenológica, boletines y pronósticos agroclimáticos; dispone de formulario de solicitud. [Servicio agroclimático](https://www.gob.pe/9947) | Fuente de conocimiento, alertas y validación de calendario. La existencia del servicio no demuestra un calendario descargable ya disponible para Majes. |
| AUTODEMA / Junta de Usuarios / ALA | Nota oficial 2026 identifica los planes de cultivo, riego y disponibilidad hídrica como insumos para Majes. [Nota de coordinación](https://www.gob.pe/institucion/autodema/noticias/1427049-gobierno-regional-de-arequipa-impulsara-parcela-demostrativa-para-fortalecer-la-adaptacion-agricola-frente-al-fenomeno-el-nino) | Solicitar el documento vigente o cargar manualmente la dotación confirmada. No se verificó una API ni un archivo descargable a escala de parcela. |
| ANA, PADH 2024–2025 | Se localizó PDF oficial del Plan de Aprovechamiento de Disponibilidad Hídrica 2024–2025. [RD 1140-2024, documento ANA](https://www.ana.gob.pe/sites/default/files/normatividad/files/28-RD-1140-2024-220.pdf) | Documento histórico identificado por indexación; apertura falló. No se extrajeron sus tablas ni se comprobó el detalle para el polígono piloto. No usarlo como disponibilidad vigente en 2026. |
| MIDAGRI / SIEA | Una nota oficial de enero de 2025 describe tableros de avance de campaña, costos, precios y perfiles productivos. [MIDAGRI, herramientas SIEA](https://www.gob.pe/institucion/midagri/noticias/1090721-servicios-y-plataformas-del-midagri-mantienen-informados-a-productores-sobre-intenciones-de-siembra-y-precios-en-mercados) | Recurso candidato para rendimientos/costos y estadísticas regionales; no se probó exportación distrital ni API. Un costo regional no representa necesariamente la parcela. |
| INEI, índice agropecuario | Lista series de producción, superficies sembradas y cosechadas y precios promedio en chacra. [INEI, Agropecuario](https://www.inei.gob.pe/estadisticas/indice-tematico/agricultural/) | Portal de tablas identificado. Confirmar geografía, unidad y antigüedad de la tabla antes de usarla; no se verificó desagregación Majes. |

- **Recurso adicional especialmente útil:** PISCOeo_pm de SENAMHI y colaboradores es una base de evapotranspiración de referencia para el territorio continental peruano, 1981–2016, aproximadamente 1 km (0,01°), publicada en 2022. Contiene valores diarios y normales mensuales en NetCDF. Su documentación la vincula con una colección Figshare. No es pronóstico ni evapotranspiración medida del cultivo actual. El artículo original confirma resolución y periodo; algunas herramientas de terceros muestran erróneamente 0,1°, por lo que se debe conservar la especificación del artículo y revisar el archivo usado. [Artículo original, Huerta et al., 2022](https://doi.org/10.1038/s41597-022-01373-8); [colección de datos enlazada por SENAMHI](https://figshare.com/collections/A_reference_evapotranspiration_gridded_database_based_on_FAO_Penman-Monteith_in_Peru_during_1981-2016/5633182/3). Se verificó documentación, no descarga de NetCDF; Figshare devolvió 403.

### Inferences

- Primer paquete local mínimo: historial declarado de cultivos, disponibilidad de riego confirmada, características de suelo medidas/declaradas, calendario y parámetros agronómicos revisados, costos y precio en chacra con fecha.
- PISCOeo_pm puede complementar o contrastar una climatología NASA, pero usar únicamente el promedio histórico no representa la próxima campaña. Es un recurso secundario por su descarga y recorte pendientes; no hace falta integrar todo el catálogo en 48 horas.
- Para cada dato conservar: institución, URL, periodo, geografía, variable, unidad, resolución, fecha de consulta, estado de descarga y si es observado, interpolado o declarado. El prototipo debe hacer visibles faltantes relevantes.

### Gaps

- No hay descarga probada de datos de estación, costos, rendimientos o agua por parcela en estas notas. Los portales identificados no deben etiquetarse como integraciones implementadas.
- No se obtuvo un calendario vigente de siembra/cosecha de la Oficina Agraria Majes o la Junta de Usuarios. Existen copias de documentos en agregadores, pero no se tomaron como respaldo oficial de fechas.
- No se confirmó una capa de análisis químico de suelo con resolución de parcela. El MVP necesita entrada manual o análisis real y no debe traducir un índice de vegetación directamente a N, P o K.

## 3. ¿Qué tres estrategias son comparables y qué evidencia las sostiene?

### Takeaway

Comparar primero la estrategia **declarada por el agricultor**, y luego dos alternativas explícitas sobre el mismo horizonte, superficie y restricción hídrica. La secuencia **maíz–frejol** tiene evidencia experimental localizada en Majes, pero esa evidencia no demuestra que sea la opción más rentable ni que ahorre un porcentaje de agua respecto de otras rotaciones.

### Cited Findings

- **Ensayo local:** Jhonatan Rodriguez Parra Alfaro, tesis de grado UNSA, publicada en 2019, «Evaluación del efecto de tres sistemas de labranza sobre las pérdidas de agua desde el suelo, en la irrigación Majes - Arequipa». El registro oficial describe una parcela experimental del CIEPA–UNSA en Majes, cuatro campañas maíz–frejol durante casi dos años y un suelo franco arenoso. Comparó no labranza, labranza vertical y tradicional, con tres repeticiones en bloques al azar. Registró humedad y temperatura del suelo, estrés hídrico foliar y rendimiento. El resumen informa diferencias en humedad/estrés y ausencia de diferencias significativas de rendimiento entre tratamientos. **El contraste es entre labranzas dentro de la secuencia**, no entre rotación y monocultivo. El resumen no identifica destino del maíz, variedad del frijol ni fechas exactas; no afirmar «maíz forrajero» a partir de esta tesis. Se consultaron registro y metadatos, no el PDF completo. [Registro ALICIA/CONCYTEC](https://alicia.concytec.gob.pe/vufind/Record/UNSA_fda2ef5dce9e732d8e8e3a84449b008e); [metadatos con enlaces a bitstreams](https://alicia.concytec.gob.pe/vufind/Record/UNSA_fda2ef5dce9e732d8e8e3a84449b008e/Details); [identificador institucional UNSA](http://repositorio.unsa.edu.pe/handle/UNSA/9499).
- SENASA explica que la rotación puede reducir incidencia de plagas/enfermedades persistentes y que la elección varietal debe considerar ambiente y resistencia. Es respaldo general para reglas agronómicas, no validación de una secuencia o calendario específico de Majes. [Guía BPA para frijol, sección 3.5 y selección de semilla](https://www.senasa.gob.pe/senasa/descargasarchivos/2020/07/Guia-BPA-FRIJOL.pdf).
- FAO caracteriza frijol y cebolla como sensibles a salinidad y explica que su manejo depende del agua, el suelo, drenaje y lavado de sales. Por ello, disminuir lámina aplicada indiscriminadamente no es equivalente a mejorar sostenibilidad. [FAO, efectos de salinidad y manejo del agua](https://www.fao.org/4/w7224e/w7224e08.htm).
- La alfalfa es perenne y su manejo de residuos afecta el destino del nitrógeno; la literatura técnica distingue la fijación biológica de la entrega efectiva al cultivo siguiente. [Feedipedia, ficha alfalfa](https://feedipedia.review.fao.org/node/275). Para manejo sanitario, la extensión de UC recomienda rotar alfalfa con cultivos no leguminosos y evitar su resiembra inmediata; es evidencia de otro contexto, no un intervalo universal para Majes. [UC IPM, selección del sitio y antecedentes de cultivo](https://ipm.ucanr.edu/agriculture/alfalfa/site-selection-to-avoid-pest-problems/).
- Las necesidades hídricas varían con clima, humedad, viento y duración del ciclo; las tablas genéricas FAO son aproximaciones por cultivo/ciclo. No bastan para asignar consumo real local ni comparar una cosecha anual con un cultivo perenne de varios cortes. [FAO, requerimientos de agua y suelo](https://www.fao.org/4/U3160E/u3160e04.htm).
- **Avena/cebada:** la nota oficial hallada se refiere a siembras en Pusa Pusa y Tarucamarca, vinculadas al proyecto Majes Siguas II y a lluvias de esas localidades. No demuestra adecuación en la irrigación Pampa de Majes. [GRA, siembra en Pusa Pusa y Tarucamarca, diciembre de 2024](https://www.gob.pe/institucion/regionarequipa/noticias/1069836-autodema-continua-labrado-y-siembra-de-tierras-en-pusa-pusa-y-tarucamarca).

### Inferences

**Configuración sugerida para la demo, sujeta a validación:**

| Estrategia | Secuencia ilustrativa | Estado de evidencia y evaluación |
|---|---|---|
| A. Continuidad | La secuencia y fechas que el agricultor planea; ejemplo simulado: maíz → maíz | El ejemplo no representa automáticamente la práctica local. Solicitar cultivo, destino comercial y fechas; si es alfalfa establecida, evaluar continuidad con sus cortes y obligaciones forrajeras. |
| B. Diversificación con leguminosa | Maíz → frejol → maíz, repetida si cabe en el horizonte validado | Hay evidencia local de la secuencia maíz–frejol; confirmar variedad, destino del maíz, calendario, agua, enfermedades, manejo de residuos y comprador. No prometer ahorro de fertilizante o agua sin balance/calibración. |
| C. Diversificación comercial | Maíz → cebolla → maíz, o cultivo anual alternativo confirmado por técnico | La presencia regional de cebolla consta en fuentes históricas; la secuencia completa es una **hipótesis de diseño**, no rotación validada. Mantenerla bloqueada como recomendación hasta confirmar calendario, mercado, salinidad, presupuesto, maquinaria y revisión fitosanitaria. Puede mostrarse como exploración con esos faltantes visibles. |

- Estas secuencias son plantillas, no un calendario listo para sembrar. Elegir horizonte común de **24 meses** para el prototipo de anuales solo después de comprobar duración de ciclos y ventanas de preparación. En la demostración simular el mismo estado inicial para todas y mostrar periodos sin cultivo o de establecimiento.
- Si se incluye renovación de alfalfa, comparar **todas** las estrategias sobre un horizonte plurianual que abarque establecimiento y producción; incluir costo de arranque, ingresos/forraje y condición final de la parcela. No enfrentar un año de alfalfa nueva con varias cosechas anuales sin reconocer el sesgo. Para el MVP, es más sencillo focalizar el flujo en parcelas ya destinadas a cultivos anuales.
- Cambiar fechas puede reducir coincidencia de etapas sensibles con calor o alta demanda evaporativa histórica. Mostrar ese mecanismo como evidencia para explorar, sin convertirlo en pronóstico de la próxima cosecha.
- Reglas mínimas: especie/familia y cultivo anterior; restricciones sanitarias; duración y ventana local; disponibilidad mensual y calidad del agua; análisis de suelo y drenaje; destino de residuos; necesidad mínima de forraje; costos de transición y destino comercial.
- La fijación de N por una leguminosa no implica una transferencia fija al cultivo siguiente; el MVP puede mostrar «potencial condicionado a manejo» y solicitar revisión, en lugar de inventar balances de nutrientes.
- Separar los resultados: agua estimada con método y supuestos, margen económico con rangos y costos, criterios de suelo cualitativos y evidencia faltante. Una opción sin suelo/agua/mercado confirmado debe quedar «requiere datos», no recibir un ranking preciso por defecto.

### Gaps

- Falta validación agronómica local de la estrategia C y de los calendarios de B. No hay respaldo suficiente para declarar avena/cebada como tercera rotación adecuada para el piloto con las fuentes consultadas.
- El ensayo UNSA respalda que maíz–frejol fue estudiado localmente; no respalda rendimientos transferibles, mejor rotación, demanda comercial, ni porcentaje de ahorro. No generalizar el suelo de la parcela experimental a toda la irrigación.
- No se verificó evidencia local que cuantifique cambios de materia orgánica, fijación/residual de N, plagas o salinidad de estas tres alternativas comparadas. Presentarlos como criterios agronómicos y riesgos, no como resultados medidos del prototipo.
