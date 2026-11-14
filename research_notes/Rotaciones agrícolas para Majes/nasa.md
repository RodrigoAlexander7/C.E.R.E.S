# NASA y viabilidad de datos para Majes

## ¿Qué se verificó del reto y de sus recursos?

### Takeaway
El resumen oficial indexado identifica el reto 2026 «Field Shift: Adapting Farms with NASA Data» y confirma el foco en rotaciones. No se pudo abrir el contenido completo de la página oficial ni su pestaña Resources; no debe presentarse su inventario como verificado.

### Cited Findings
- La búsqueda devolvió una página oficial de 2026 con el slug `field-shift-adapting-farms-with-nasa-data`. Su resumen indexado describe una herramienta de apoyo que combine observaciones NASA, información local del suelo, características de cultivos y prioridades del agricultor. **Verificación: resultado indexado, no lectura completa.** — [Reto oficial encontrado](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/).
- El enlace proporcionado por el usuario falló al abrirse con la herramienta web; el slug alternativo también falló, con un error 502 en un intento. Esto describe el acceso durante esta investigación, no demuestra que el sitio haya desaparecido. — [Enlace proporcionado](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/?tab=resources).
- El texto entregado en `reto.md` plantea explorar rotaciones, comparar al menos tres estrategias incluida la actual y explicar evidencia, beneficios, incertidumbre y revisión local. Esta es la **fuente de trabajo aportada por el equipo**, sin reconfirmación integral en la página oficial. — [Texto local](/home/totora/Documents/PROFESIONAL/C.E.R.E.S/reto.md).
- La sede HackAthlone publica una reproducción accesible del reto con apartado de recursos, donde aparece NASA POWER. Se abrió completa, pero es una reproducción del organizador local; no sustituye comprobar Resources en la página oficial antes de presentar el proyecto. — [Reproducción de HackAthlone](https://hackathlone.com/challenges/adapting-farms-with-nasa-data).

### Inferences
- La propuesta debe centrarse en **secuencias de cultivos y sus compromisos**, incorporando la estrategia actual como comparación. Un recomendador de cultivo aislado basado en precio y clima queda menos alineado con el texto aportado.
- POWER y Landsat/HLS permiten un núcleo NASA acotado. Confirmar que el recurso elegido figura en Resources y citar producto, variables, periodo y procesamiento al preparar la entrega.

### Gaps
- No se verificó directamente el inventario de la pestaña oficial Resources ni se verificaron sus condiciones completas de participación. No afirmar que se revisaron sus 24 recursos o requisitos globales.

## ¿Qué pequeño conjunto de datos NASA es viable para el prototipo?

### Takeaway
Priorizar NASA POWER para contexto agroclimático histórico regional; añadir HLS únicamente si el equipo consigue acceso y escenas válidas al inicio. La documentación acredita productos y vías de acceso, pero esta investigación no descargó una serie de Majes ni probó credenciales, recortes o cobertura útil de parcelas.

### Cited Findings
| Producto | Verificado en documentación primaria | Implicación para el prototipo |
| --- | --- | --- |
| NASA POWER Daily API | Series diarias desde 1981 hasta tiempo casi real; salida JSON/CSV; comunidad agroclimática `AG`; hasta 20 parámetros en una petición puntual. [Documentación Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) | Descargar y conservar un periodo histórico común, por ejemplo 2015–2025, con temperatura, lluvia y, si se calcula evapotranspiración de referencia, radiación, humedad y viento. El periodo es una decisión propuesta. |
| Resolución POWER | La fuente meteorológica primaria tiene celdas de 0,5° de latitud × 0,625° de longitud; los parámetros representan promedios espaciales. Se recomienda terminar dos meses antes del tiempo casi real para analizar tendencias climáticas. [Fuentes meteorológicas POWER](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/) | Contexto de decenas de kilómetros, sin diagnóstico parcelario. Consultar muchos puntos cercanos puede devolver la misma información. |
| Actualización POWER | Meteorología con latencia habitual de 2–3 días; variables solares 5–7 días. En terreno complejo, la elevación promedio de celda puede diferir de la estación local. [Preguntas sobre datos POWER](https://power.larc.nasa.gov/docs/faqs/data/) | Mostrar fecha de corte, escala espacial y contraste pendiente con SENAMHI. El archivo diario histórico no es un pronóstico de la campaña siguiente. |
| HLS L30/S30 y HLS-VI | Imágenes de reflectancia superficial que armonizan Landsat NASA/USGS y Sentinel-2 ESA; rejilla común de 30 m. Las páginas técnicas indican observaciones globales nominales cada 2–3 días. [Proyecto HLS](https://hls.gsfc.nasa.gov/) y [guía rápida HLS](https://lpdaac.usgs.gov/documents/1117/HLS_Quick_Guide_v02.pdf) | Posible NDVI por parcela o sector, si quedan suficientes píxeles válidos. La revisita nominal no garantiza observaciones sin nubes. |
| Acceso HLS | L30, S30 y HLS-VI se distribuyen como Cloud Optimized GeoTIFF; descarga NASA con Earthdata Login. Latencia orientativa 2–3 días, condicionada por insumos. [Acceso y herramientas HLS](https://hls.gsfc.nasa.gov/data-access-and-tools/) | Preparar cuenta, recorte y caché antes de comprometer la capa en la demo. El equipo aún no tiene acceso validado por esta investigación. |
| Histórico y calidad HLS | Archivo L30 desde abril de 2013 y S30 desde noviembre de 2015. [Archivo HLS](https://hls.gsfc.nasa.gov/hls-data/). La banda QA identifica nubes, sombras, agua, nieve y adyacencia; incluye información de aerosoles. [Algoritmos HLS](https://hls.gsfc.nasa.gov/algorithms/) | Aplicar QA, conservar fechas, contar observaciones útiles y no rellenar silenciosamente vacíos. Elegir escenas comunes o agregaciones mensuales. |
| Interpretación NDVI | NASA define NDVI con las bandas roja e infrarroja cercana como indicador de vegetación; HLS-VI incluye también índices especializados. Una página divulgativa reciente indica revisita 1–2 días, frente a 2–3 días en las páginas técnicas. [Guía NASA de HLS-VI](https://science.nasa.gov/mission/landsat/hls-vegetation-indices/) | Evitar prometer una frecuencia exacta local: mostrar la fecha real de cada observación. La serie no determina por sí sola nutrientes, enfermedad o causa del estrés. |

### Inferences
- **MVP mínimo:** POWER histórico real, catálogo agronómico documentado, suelo y agua declarados por el usuario, comparación de tres rotaciones y explicaciones. Mantener HLS como mejora si no se validan escenas y descarga temprano.
- **MVP ampliado:** mapa de ubicación y cobertura/NDVI HLS con fechas y observaciones válidas; pedir al agricultor confirmar cultivo y cortes/cosechas. Un descenso de NDVI puede motivar una pregunta, no diagnosticar automáticamente escasez de nitrógeno o falta de agua.
- Evitar integrar simultáneamente SMAP, GPM, MODIS, GRACE y ECOSTRESS durante 48 horas. La decisión de alcance busca que NASA modifique un cálculo útil, con menos riesgos de procesamiento.
- No remuestrear POWER a 30 m para llamarlo dato parcelario; vincular cada parcela con su celda climática y mantener separados escala de entrada y escala de presentación.

### Gaps
- No se ejecutó una descarga utilizable de POWER para Majes: la apertura web de una petición de ejemplo falló. Esto no demuestra que la API esté caída. No presentar endpoint, CORS o disponibilidad del servicio como probados.
- No se buscaron granules concretos HLS sobre una parcela proporcionada por el equipo, porque no se dispone de sus límites. La cobertura global documentada no equivale a una escena local reciente válida.
- No se dispone de validación contra estación SENAMHI local, mediciones de suelo o aforo/turnos de riego.

## ¿Cómo puede NASA afectar la comparación de rotaciones de forma explicable?

### Takeaway
La contribución más defendible es comparar la exposición climática y demanda de agua de las secuencias según fechas y etapas; combinar esto con un presupuesto de riego declarado y reglas agronómicas. La salud del suelo debe basarse en información local y efectos agronómicos documentados, sin inferir nutrientes a partir de imágenes.

### Cited Findings
- FAO recomienda Penman–Monteith como método estándar para la evapotranspiración de referencia; requiere temperatura del aire, humedad, radiación y viento, con atención a unidades y altura de medición. — [FAO 56, ecuación Penman–Monteith](https://www.fao.org/4/x0490e/x0490e06.htm).
- La evapotranspiración potencial de un cultivo se aproxima como `ETc = Kc × ETo`, donde el coeficiente depende del cultivo y de su etapa. No es por sí sola una medida de agua entregada por el sistema de riego. — [FAO AQUASTAT, requerimientos de agua de riego](https://www.fao.org/aquastat/ar/data-analysis/irrig-water-use/irrig-water-requirement/).
- HLS proporciona medidas espectrales de vegetación y banderas de calidad, no un análisis de laboratorio de N/P/K. La inferencia prudente es conservar laboratorio o declaración local como origen de esos campos, y dejar desconocidos los datos ausentes. — [Guía de producto HLS-VI](https://lpdaac.usgs.gov/documents/2088/HLS_VI_User_Guide_V2.pdf).

### Inferences
Diseño propuesto, aún sin implementación ni validación:

1. Para cada secuencia, registrar fechas, etapas, duración y coeficientes/tolerancias del catálogo local con sus fuentes. Usar el mismo horizonte, superficie y supuestos económicos para todas.
2. Tomar años históricos completos POWER y calcular exposición al calor en etapas sensibles con umbrales documentados del cultivo. Mostrar frecuencia histórica y rango, sin presentarlos como probabilidad calibrada de la campaña futura.
3. Si el equipo puede calcular ETo correctamente, estimar ETc por etapa para cada año histórico. Convertir demanda neta a volumen con área y considerar lluvia efectiva, eficiencia de riego y reservas de suelo solo cuando exista una hipótesis explícita o dato local. Sin estos datos, mostrar demanda comparativa o intervalos, no una dosis de riego.
4. Comparar la demanda con la disponibilidad ingresada por el agricultor o asesor. Una secuencia puede superar una restricción de agua y dejar de ser elegible; el cambio debe mostrarse junto con sus datos y supuestos. Si falta disponibilidad, declarar «viabilidad hídrica pendiente».
5. Evaluar salud del suelo por diversidad de familias, intervalos, cobertura, manejo de residuos y presencia de leguminosas según bibliografía local. No otorgar kg de nitrógeno ni cambios de materia orgánica sin medición o modelo validado.
6. Comparar margen económico con precio, rendimiento y costos explícitos, más escenarios de sensibilidad; NASA no observa precio ni garantiza rendimiento. Separar «demanda potencial de agua» de «ahorro real demostrado».
7. En la demo, cambiar un supuesto identificable —presupuesto de agua o fecha de siembra— y mostrar el recálculo y razón de cambio entre las tres alternativas. Esta es una contribución NASA sustantiva si las series reales cambian los indicadores utilizados.

### Gaps
- Faltan coeficientes, duraciones, umbrales y disponibilidad de agua específicos de las opciones de Majes. No inventar cifras ni ahorros porcentuales.
- El motor descrito es una propuesta de implementación; su ranking requiere revisión agronómica y contraste con datos locales antes de ofrecer recomendaciones de campo.
