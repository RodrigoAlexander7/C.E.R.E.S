# C.E.R.E.S — Propuesta v2 (Majes, Arequipa)

> Borrador mejorado a partir de `propuesta.md` y `reto.md`. Todo lo marcado **(verificar)** es una hipótesis mía que el equipo debe confirmar antes de presentarlo como hecho.
> Nota: en la traducción al español del reto, "SI" significa "IA" (inteligencia artificial).

---

## 1. Problema (una frase para el jurado)

El agricultor de Majes decide qué sembrar con intuición y con el precio del año pasado, mientras tiene un recurso crítico (agua) cada vez más caro, suelos desérticos pobres en materia orgánica **(verificar)** y un cultivo dominante, la alfalfa, que consume mucha agua.

**Datos de contexto ya encontrados (con fuente):**
- Cerca del 60 % del área cultivada en la Irrigación Majes es forraje (alfalfa y maíz forrajero) — [informe de vigilancia, MINAM 2016](https://bioseguridad.minam.gob.pe/wp-content/uploads/2016/10/inf_vig_arequipa_16.pdf).
- Un agrónomo de la zona cita una demanda de más de 27 000 m³ de agua por hectárea y año para alfalfa y propone rotarla con cultivos agroindustriales de menor consumo — [Agraria.pe, 2015](https://agraria.pe/noticias/concientizan-a-agricultores-de-majes-que-opten-por-productos-7821).
- Autoridades han dicho que Majes-Siguas II no permitirá forraje en sus pampas — [Agraria.pe, 2022](https://agraria.pe/noticias/potencial-agroexportador-se-afianzara-con-majes-siguas-ii-30022). Esto es un argumento fuerte de **por qué diversificar ahora**.

## 2. Qué hace la herramienta

Un asistente que, dado un campo en Majes y las prioridades del agricultor, **compara al menos 3 estrategias de rotación (la actual + 2 alternativas)** y para cada una explica: por qué se sugiere, qué evidencia la respalda, beneficios esperados, riesgos, y **qué no sabemos** (exigencia explícita del reto).

No decide por el agricultor: ordena opciones y marca dónde hace falta criterio de un agrónomo.

## 3. Cambios clave respecto a la v1

| v1 | v2 | Por qué |
|---|---|---|
| "Enfoque solo en Perú" | **Caso de uso Majes**, escalable a Perú | El reto pide un caso concreto; Majes es defendible |
| Predicción meteorológica propia | **Climatología histórica + escenarios** (sliders), no un modelo de predicción | Un predictor propio es costoso y poco creíble en un hackathon; la rotación es una decisión de largo plazo |
| 3 filtros sueltos (clima, economía, nutrición) | **Un puntaje multicriterio con pesos por perfil de agricultor** | Es explicable y es lo que el reto llama "prioridades del agricultor" |
| Nutrición como filtro | Nutrición como **bonus opcional** (anemia) | Coincide con tu nota: es colateral, el dinero manda |
| WhatsApp | WhatsApp para el agricultor + **panel web con mapa** para el demo y para instituciones | El reto premia mapas/visualización; WhatsApp resuelve el acceso |

## 4. Hallazgo importante sobre los datos

- La página de recursos del reto lista sobre todo datos **de EE. UU.** (Web Soil Survey, CropScape, PRISM, SSURGO, NAIP, NWIS, AMS Market News, OpenET…). **No cubren Perú.** Hay que sustituirlos por equivalentes peruanos/globales (tabla abajo). Esto también es un punto a favor: explicarlo en la presentación muestra que entendimos el reto, no que copiamos el ejemplo.
- Majes es **hiperárido y regado** **(verificar)**: casi no llueve en la pampa y el agua viene de canales alimentados por la cuenca alta del Colca/Condoroma **(verificar)**. Consecuencias:
  - La lluvia **local** (GPM) importa poco; la lluvia **en la cuenca alta** sí importa (disponibilidad de agua de riego).
  - **SMAP** (resolución ~9–36 km) es muy grueso para un campo regado; su valor aquí es débil. Úsenlo solo como contexto de cuenca, y díganlo.
  - Lo más informativo para un campo regado: **NDVI** (Sentinel-2/Landsat/MODIS), **temperatura** y **evapotranspiración** (ET₀ calculada con NASA POWER + coeficientes de cultivo FAO-56).

## 5. Fuentes de datos

### 5.1 NASA / globales (de la lista del reto, [pestaña Recursos](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/?tab=resources))

| Fuente | Uso en C.E.R.E.S | Utilidad en Majes |
|---|---|---|
| [NASA POWER](https://power.larc.nasa.gov/) (API diaria, desde 1981) | Temperatura, radiación, humedad, viento → **ET₀ y demanda de agua por cultivo**, ventanas de helada y calor | **Alta** (base del modelo; resolución gruesa ~0.5°, declararlo) |
| [MODIS / VIIRS](https://lpdaac.usgs.gov/products/) y [Landsat](https://earthexplorer.usgs.gov/) | NDVI histórico → **fenología, campos en barbecho, estrés** | **Alta** |
| [GPM / IMERG](https://gpm.nasa.gov/data) | Lluvia en la **cuenca alta** y años secos/húmedos | Media-alta |
| [SRTM](https://www.earthdata.nasa.gov/data/instruments/srtm) | Pendiente, exposición → riesgo de erosión, drenaje | Media |
| [ECOSTRESS](https://ecostress.jpl.nasa.gov/data) | Temperatura superficial y ET en alta resolución | Media (pasadas esporádicas; usar como validación puntual, no como serie) |
| [SMAP](https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap) | Contexto de humedad de la cuenca | Baja en el campo regado |
| [GEDI](https://gedi.umd.edu/data) | Biomasa | Baja (no es clave para el MVP) |

### 5.2 Complementos globales no-NASA (también sugeridos en el reto)
- [Copernicus Sentinel-2](https://dataspace.copernicus.eu/) — NDVI a 10 m: mejor resolución para campos de Majes que Landsat/MODIS.
- [ERA5](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview) — respaldo/contraste de clima.
- [FAO GAEZ](https://gaez.fao.org/) — aptitud agroecológica por cultivo (sustituye a CropScape como referencia de "qué crece dónde").

### 5.3 Peruanas (a confirmar acceso y formato)
| Fuente | Qué aporta | Estado |
|---|---|---|
| **SENAMHI** | Estaciones in situ de Arequipa: validar el satélite con tierra (el reto lo pide explícitamente) | Hay descarga web por estación; **no encontré una API oficial documentada**. Hay un paquete de R no oficial, usarlo con cautela. [Tutorial SENAMHI](https://www.senamhi.gob.pe/mapas/descarga-datos/pdf/tutorial-para-la-descarga-de-datos.pdf) |
| **MIDAGRI — SIEA / SISAP / FrutiData** | Precios en chacra, mayoristas y de exportación — [portal de precios](https://siea.midagri.gob.pe/portal/precios) | Existe; **no encontré precios de chacra de Majes/Arequipa publicados** para ajo, cebolla o alfalfa. Confirmar cobertura en el portal |
| **Autodema, Junta de Usuarios Majes-Siguas, Dirección Regional Agraria de Arequipa** | Cultivos reales por sector, turnos de riego, costos | Sugerencia mía: contacto directo / entrevistas. Es la mejor fuente para costos y rotaciones reales |
| **INIA, SENASA** | Fichas de cultivo, plagas, calendarios | Pendiente de revisar |
| **ISRIC SoilGrids** (global, 250 m) | Textura y carbono orgánico del suelo, como sustituto de WSS/SSURGO | Pendiente de revisar (es mi sugerencia; baja precisión en zonas áridas) |
| Datos de **anemia** (ENDES / INS / MINSA) | Contexto nutricional regional | Pendiente de confirmar la cifra de Arequipa antes de citarla |

**Brecha honesta que hay que declarar:** costos de producción por cultivo en Majes y la ficha de suelo por lote. Sin esto el margen económico será una estimación con rangos amplios; mostrarlo como tal.

## 6. Cómo funciona el modelo (simple y explicable)

1. **Armonizar** todo a una grilla común (p. ej. 1 km para clima, 10–30 m para NDVI) y a paso mensual/decadal, 2000–hoy.
2. **Calendario del lugar:** a partir del NDVI histórico detectar cuándo hay campos activos vs. en barbecho, y a partir de POWER las ventanas de calor/helada.
3. **Demanda de agua por cultivo:** ET₀ (POWER) × Kc (FAO-56) → m³/ha por ciclo, comparado con la alfalfa. *(Cálculo determinista y auditable.)*
4. **Puntaje por estrategia** con 5 criterios, ponderados por el agricultor:
   - Margen económico esperado (precio histórico estacional × rendimiento − costo)
   - Uso de agua
   - Salud del suelo (fijación de N, materia orgánica, cobertura/erosión, ruptura de ciclos de plagas)
   - Riesgo climático (calor, helada, año seco aguas arriba)
   - Aporte nutricional (bonus; hierro, proteína)
5. **Incertidumbre:** correr el puntaje sobre cada año histórico (2000–hoy) y mostrar el rango, no un número único. Las celdas con pocos datos se marcan "requiere validación local".
6. **Rol de la IA:** (a) explicar el resultado en lenguaje llano por WhatsApp, (b) opcionalmente clasificar fenología/barbecho con NDVI. No usar caja negra para decidir el ranking: la explicabilidad es parte de lo que pide el reto.

## 7. Tres estrategias de ejemplo para el demo (hipótesis a validar con agrónomos)

| | Estrategia | Idea | Qué mostraría |
|---|---|---|---|
| **A (actual)** | Alfalfa continua / alfalfa + maíz forrajero | Lo que hace ~60 % del área | Línea base de agua, ingreso y desgaste del suelo |
| **B (agua + ingreso)** | Alfalfa 3–4 años → hortalizas de bulbo (ajo/cebolla) → leguminosa **(verificar cultivos y calendario)** | Menos agua por ha y ingreso en ventana de buen precio | Ahorro de m³/ha, ventana de precio, riesgo de mercado |
| **C (suelo + nutrición)** | Alfalfa → cultivo de grano andino/leguminosa (quinua, haba, tarwi) **(verificar adaptación a 1 400 m y al riego de Majes)** | Fijación de N, más materia orgánica, aporte de hierro | Beneficio en suelo y anemia, con menor margen o mayor riesgo |

Cada tarjeta debe terminar con: **"Qué no sabemos"** y **"Consulte con un agrónomo sobre…"**.

## 8. Usuarios, interfaz y a quién se le vende

- **Agricultor** (mediano/pequeño de la pampa, ajustar con entrevistas): WhatsApp. Flujo: ubicación del lote (pin) → "¿qué priorizas? agua / dinero / suelo" → 3 opciones en una tarjeta corta con semáforo → "¿por qué?" abre la evidencia. Sin jerga: explicar "NDVI" como "qué tan verde está el campo".
- **Junta de Usuarios / Autodema / gobierno regional:** panel web con mapa, serie temporal y sliders de escenario (menos agua en la cuenca, +2 °C). **Probablemente son quienes pagan** (visión de zona, ahorro de agua, preparación para Majes-Siguas II); el agricultor es el usuario, no necesariamente el cliente **(validar)**.
- **Agroindustria / cooperativas / proveedores de insumos:** tercer segmento, a evaluar.
- Quién se beneficia: ingreso estable del agricultor, menos presión sobre el agua del Colca, suelo más sano.

## 9. ODS

ODS 2 (hambre cero / agricultura sostenible), **ODS 6** (agua), **ODS 13** (acción climática), ODS 15 (suelo), ODS 3 (anemia, colateral), ODS 1 y 8 (ingresos).

## 10. Alcance del MVP (qué sí y qué no)

**Sí (demo):** un mapa de Majes con NDVI histórico y calendario de barbecho; cálculo de demanda de agua por cultivo; comparación de 3 estrategias con puntaje, rango y sección "qué no sabemos"; sliders de escenario; maqueta/bot de WhatsApp con 1–2 conversaciones de ejemplo.

**No (declarar como trabajo futuro):** predicción meteorológica propia, datos de suelo por lote reales, precios de chacra en vivo, entrenamiento de modelos complejos.

## 11. Riesgos y cosas a resolver ya

1. Confirmar que los precios y costos de Majes existen en alguna fuente (si no, entrevistar a 2–3 productores o a la Junta de Usuarios).
2. Confirmar con un agrónomo (INIA / Autodema / universidad en Arequipa) que B y C son rotaciones viables en Majes.
3. Decidir el idioma del entregable (reto en inglés, caso en español) y si el demo va por WhatsApp real o simulado.
4. Revisar las fuentes marcadas **(verificar)**; no presentar hipótesis como hechos.
