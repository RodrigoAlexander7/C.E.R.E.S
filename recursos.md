# Recursos y procedencia de datos de CERES

Inventario para implementación, revisado el 14 de noviembre de 2026. «Documentado» no significa «descargado» ni «integrado». No se ejecutaron llamadas de pago al proveedor de IA. Las series del piloto siguen pendientes: la consulta web de POWER no se completó y el entorno de terminal no resolvió su dominio; esto no prueba una caída del servicio.

## 1. Decisiones de uso

- **Obligatorio:** NASA POWER real, catálogo agronómico con fuentes, datos declarados de la parcela y procedencia de cada resultado.
- **Núcleo de producto:** mapa, límites administrativos, login/perfil, historial, comparación de ciclos y asistente IA.
- **Referencia local:** SENAMHI, AUTODEMA/ANA/Junta, SIEA, INIA, SENASA y ensayo UNSA. Donde no haya extracción comprobada se prepararán archivos curados; no se inventará una API.
- **Complementario:** HLS/NDVI, precios mayoristas y composición alimentaria. Su ausencia no impedirá construir el núcleo; se mostrará su disponibilidad real.
- **Excluido:** malezas, macheteo, herbicidas, diagnóstico de NPK por imagen, predicciones propias y promesas clínicas.

## 2. Datos NASA

### NASA-POWER — insumo ambiental obligatorio

[Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) y [metodología meteorológica](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/).

Extracción prevista: API puntual `https://power.larc.nasa.gov/api/temporal/daily/point`, comunidad `AG`, JSON. Parámetros iniciales:

| Variable | Uso previsto | Unidad a comprobar en la respuesta |
|---|---|---|
| `T2M`, `T2M_MIN`, `T2M_MAX` | Temperatura y exposición térmica por etapa | °C |
| `PRECTOTCORR` | Precipitación; método de lluvia efectiva separado | mm/día |
| `RH2M` | Humedad relativa para ET0 | % |
| `WS2M` | Viento a 2 m para ET0 | m/s |
| `ALLSKY_SFC_SW_DWN` | Radiación solar para ET0 | Leer metadatos; convertir a la unidad exigida por FAO 56 |

Enviar latitud/longitud de consulta, inicio/fin, `format=JSON` y estándar temporal explícito. Periodo inicial propuesto: **2015–2025**, años completos; es una referencia histórica de diseño, no una normal climatológica ni pronóstico. Verificar disponibilidad y calidad antes de fijarlo.

Meteorología: escala regional aproximada de 0,5° × 0,625°; comprobar la resolución de cada producto, incluida radiación. Conservar metadatos originales, unidades, valores ausentes y coordenadas solicitadas. No crear resolución parcelaria mediante interpolación visual. Descargar con caché, consultas deduplicadas y límites del servicio; nunca consultar de nuevo toda la historia por cada mensaje del chat.

**Estado:** documentación consultada; descarga útil para Majes e integración pendientes. Para aceptar la demo se exige un archivo NASA real y reproducible; un dato sintético no cumple este requisito.

### NASA-HLS — imágenes complementarias

[Proyecto HLS](https://hls.gsfc.nasa.gov/), [acceso](https://hls.gsfc.nasa.gov/data-access-and-tools/) y [calidad](https://hls.gsfc.nasa.gov/algorithms/).

Uso: cobertura/NDVI con imágenes de 30 m, fechas y píxeles válidos. Requiere validar Earthdata Login, escenas útiles y máscaras de nubes/sombras. No identifica por sí solo nutrientes, enfermedad, malezas ni causa del estrés. **Estado:** documentación consultada; acceso y escenas del piloto no probados. No es dependencia obligatoria del MVP.

## 3. Datos peruanos y conocimiento agronómico

| ID | Fuente y enlace | Datos o evidencia | Extracción prevista y estado |
|---|---|---|---|
| `SENAMHI` | [Estaciones históricas](https://www.senamhi.gob.pe/site/descarga-datos/map_hist_data.php) | Serie de Pampa de Majes para contraste local | Portal de descarga; comprobar registro, variables, periodo y vacíos. Estación identificada, serie no descargada. |
| `AGUA-LOCAL` | [AUTODEMA y coordinación local](https://www.gob.pe/institucion/autodema/noticias/1427049-gobierno-regional-de-arequipa-impulsara-parcela-demostrativa-para-fortalecer-la-adaptacion-agricola-frente-al-fenomeno-el-nino), [contexto del proyecto](https://www.autodema.gob.pe/generalidades-pemsii/) | Dotación, turnos, planes de cultivo/riego y disponibilidad | Documento vigente o declaración confirmada con Junta/ALA/asesor. No hay API parcelaria probada. Lluvia NASA no equivale a agua del canal. |
| `SIEA` | [Compendio agrícola MIDAGRI](https://www.gob.pe/institucion/midagri/informes-publicaciones/2730325-compendio-anual-de-produccion-agricola), [metodología](https://siea.midagri.gob.pe/portal/media/attachments/nosotros/gestion/Lineamientos_Metodologicos_SIEA.pdf) | Rendimiento y precio en chacra históricos | Archivos publicados; comprobar año, unidad, variedad y ámbito. Descarga y detalle específico de Majes pendientes. Costos recientes se completan con productor/asesor. |
| `SISAP` | [Herramientas de precios MIDAGRI](https://www.gob.pe/institucion/midagri/campa%C3%B1as/3432-precios-de-productos-a-tu-alcance) | Precios mayoristas como contexto | Complementario; no sustituir precio en chacra ni convertirlo con un descuento arbitrario. Integración no probada. |
| `FAO56` | [ET0, Penman–Monteith](https://www.fao.org/4/x0490e/x0490e06.htm), [etapas y Kc](https://www.fao.org/4/X0490E/x0490e0b.htm), [riego neto/bruto](https://www.fao.org/4/u5835e/u5835e02.htm) | Método hídrico, coeficientes y supuestos | Curar fichas con tabla/sección y contexto del parámetro. Documentación consultada; no se ha calibrado un modelo para Majes. |
| `INIA` | [Manual de rizobios en leguminosas](https://repositorio.inia.gob.pe/items/f3fb4396-3a7f-4abd-907e-4503d1e1af2e) | Fijación biológica y manejo de leguminosas | Registro y resumen consultados. Curación de parámetros locales pendiente. No asignar automáticamente kg de N ni registrar trigo como fijador. |
| `SENASA` | [Guía BPA para frijol](https://www.senasa.gob.pe/senasa/descargasarchivos/2020/07/Guia-BPA-FRIJOL.pdf) | Historial, rotación, fertilización y manejo | Documento consultado; trasladar reglas con contexto y revisión local. Un calendario regional no valida cualquier variedad en Majes. |
| `UNSA-MAJES` | [Ensayo local, registro ALICIA](https://alicia.concytec.gob.pe/vufind/Record/UNSA_fda2ef5dce9e732d8e8e3a84449b008e) | Secuencia maíz–frejol estudiada en Majes | Registro/metadatos consultados; PDF completo no revisado. Compara labranzas: no demuestra ahorro, mayor rentabilidad ni policultivo simultáneo. |
| `INS-TPCA` | [Tablas Peruanas de Composición de Alimentos](https://tablasperuanas.ins.gob.pe/lista-alimentos), [publicación INS](https://www.gob.pe/institucion/ins/informes-publicaciones/4231115-tablas-peruanas-de-composicion-de-alimentos) | Información nutricional complementaria | Tabla web consultada; curar únicamente alimentos pertinentes con código, versión, unidad y estado crudo/cocido. No se probó API; valores ausentes como `-1` no son cantidades negativas ni cero. |
| `PARCELA` | Agricultor, laboratorio, asesor y comprador | Área, cultivo, cosecha, agua, suelo, costos, abonos, comprador y preferencias | Datos privados declarados o medidos, con fecha y origen. Login permite recuperarlos; no verifica su exactitud ni mide el terreno. |

Otros documentos que orientan el caso, sin convertirse en integraciones: [MINAM 2016](https://bioseguridad.minam.gob.pe/wp-content/uploads/2016/10/inf_vig_arequipa_16.pdf), fuente histórica sobre cultivos cuya consulta completa estuvo limitada; [PISCOeo_pm](https://doi.org/10.1038/s41597-022-01373-8), ETo histórica complementaria cuya descarga no se comprobó; [explicación de leguminosas y residuos](https://extension.umn.edu/agriculture/crop-production/forages/legume-life-cycles-and-characteristics). No trasladar cifras históricas a 2026 ni reglas de otra región como validación local.

## 4. Mapa, ubicación y geometría

### LIMITES-PE — primera opción para límites administrativos

[Servicio SERFOR, capas de límites INEI](https://geo.serfor.gob.pe/geoservicios/rest/services/Visor/Limites_Politicos_Administrativos/MapServer/layers) y [capa distrital](https://geo.serfor.gob.pe/geoservicios/rest/services/Visor/Limites_Politicos_Administrativos/MapServer/2).

Servicio REST ArcGIS: `https://geo.serfor.gob.pe/geoservicios/rest/services/Visor/Limites_Politicos_Administrativos/MapServer`, capas 0/1/2 para departamentos/provincias/distritos. La capa distrital documenta polígonos en EPSG:4326 y consultas GeoJSON. Campos observados: `IDDPTO`, `NOMBDEP`, `IDPROV`, `NOMBPROV`, `IDDIST`, `NOMBDIST`.

Consultar `/query` con campos explícitos, filtro territorial, `outSR=4326`, geometría y `f=geojson`, comprobando paginación y metadatos por capa. Preservar códigos como texto y validar relaciones padre/hijo; no suponer que identificadores de proveedores diferentes coinciden. Descargar/versionar un subconjunto para la demo. **Estado:** metadatos consultados; extracción de geometrías, actualidad, atribución y condiciones de reutilización por verificar. Son límites referenciales, no un catastro de propiedad.

### GEOBOUNDARIES — respaldo parcial

[Documentación](https://www.geoboundaries.org/api.html), [PER ADM1](https://www.geoboundaries.org/api/current/gbOpen/PER/ADM1/) y [PER ADM2](https://www.geoboundaries.org/api/current/gbOpen/PER/ADM2/).

Los metadatos ADM1/ADM2 respondieron e incluyen enlaces de descarga y licencia por capa. **No se verificó ADM3**: no prometer distritos desde este proveedor. Respetar atribución/licencia específica y año representado; no mezclar versiones o jerarquías silenciosamente. Descargar las geometrías sigue pendiente.

### OSM y ubicación del navegador

- Base cartográfica de demostración: OpenStreetMap mediante `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, con atribución visible. Cumplir [política de teselas](https://operations.osmfoundation.org/policies/tiles/): sin descarga masiva ni precarga offline. Si el fondo falla, conservar selector, límites locales y parcela.
- El dibujo y zoom se harán con [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/), herramienta de visualización, no fuente agronómica.
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API): botón voluntario, permiso del navegador y selección manual alternativa. Un punto GPS no delimita una parcela.
- Área: cálculo geodésico WGS84 en backend con [pyproj](https://pyproj4.github.io/pyproj/stable/api/geod.html); no calcular hectáreas tratando grados como metros. Validar polígonos con Shapely.

## 5. IA, software y recursos técnicos

| Recurso elegido | Uso y configuración |
|---|---|
| [Next.js App Router](https://nextjs.org/docs/app) + React + TypeScript | Dashboard claro, formularios, mapa, perfil, comparación y chat. Verificar versiones estables compatibles al iniciar y fijarlas en lockfile. |
| [FastAPI](https://fastapi.tiangolo.com/) + Pydantic | API y validación; reglas del negocio en dominio independiente. |
| [PostgreSQL](https://www.postgresql.org/docs/current/) | Usuarios, sesiones, parcelas, historial, catálogos, fuentes y resultados. GeoJSON en JSONB basta inicialmente; PostGIS no es obligatorio. |
| [SQLAlchemy](https://docs.sqlalchemy.org/en/20/) + [Alembic](https://alembic.sqlalchemy.org/en/latest/) | Persistencia y migraciones en Python; frontend sin acceso directo a la base. Usar una combinación compatible y fijarla. |
| [pwdlib/Argon2](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) | Hash de contraseñas. La referencia sirve para hashing; este diseño usa sesiones opacas revocables, no exige JWT. |
| [API Responses de OpenAI](https://developers.openai.com/api/reference/python/resources/responses/methods/create) | Adaptador inicial del asistente, desde backend. Requiere `OPENAI_API_KEY` y `OPENAI_MODEL`; modelo configurable, sin credenciales existentes ni llamadas reales verificadas. No se necesita un servicio vectorial: comenzar con recuperación en PostgreSQL y fichas curadas. |
| pytest, Playwright, Docker Compose | Pruebas relevantes de motor/autorización/citas, recorrido principal y entorno local reproducible. Son herramientas de desarrollo, no fuentes de evidencia agronómica. |

El equipo deberá configurar una clave y un modelo accesible para validar IA real. No se presupone saldo, suscripción ni proveedor ya contratado. El puerto de IA permitirá sustituir el adaptador sin alterar el motor. No exponer claves en variables `NEXT_PUBLIC_*`, navegador o repositorio.

## 6. Contrato de procedencia común

Cada dato o parámetro tendrá: `source_id`, institución/título, URL o referencia privada autorizada, sección/página, ámbito geográfico, variable, unidad, periodo del dato, fecha de obtención, versión/hash, método de transformación y estado de validación. Distinguir `observado`, `declarado`, `derivado`, `referencia_bibliografica` y `supuesto_demo`.

Los resultados conservarán copias de entradas, versión del motor, fuentes y parámetros. Una cita de la IA debe resolver a una fuente presente en su contexto; no se aceptarán enlaces generados libremente. Los datos privados no aparecerán en el mapa público ni en la búsqueda de otro usuario. Un cambio de fuente no reescribirá resultados históricos.

## 7. Recurso del reto y comprobaciones pendientes

Fuente de trabajo: [reto.md](/home/totora/Documents/PROFESIONAL/C.E.R.E.S/reto.md). La pestaña Resources del enlace original no pudo abrirse; el [slug alternativo del reto](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/) solo se verificó por su resumen indexado. No se auditó todo el inventario ni las condiciones del concurso.

Antes de aceptar la demo: obtener un paquete NASA real, extraer geometrías trazables, revisar fichas/calendarios/Kc y preparar agua/costos/suelo declarados o etiquetados. Completar permisos y credenciales donde correspondan. No bloquear el desarrollo independiente por un portal inaccesible, pero tampoco declarar sus datos integrados ni sustituir NASA silenciosamente por datos inventados.
