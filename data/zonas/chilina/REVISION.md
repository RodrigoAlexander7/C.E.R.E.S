# Revisión documental — Valle de Chilina

Estado al 15-nov-2026. Resume las fuentes y decisiones registradas por la sesión anterior; no certifica calibración agronómica local.

- Ámbito: distritos de Cayma y Alto Selva Alegre según los límites referenciales SERFOR/INEI. Reconocer el distrito no demuestra que toda su superficie sea campiña agrícola.
- NASA POWER: consulta propia (-16,362; -71,535), 2015–2025, 4 018 días y ningún ausente. Hash y fecha en `nasa_power_daily_2015_2025.meta.json`.
- Elevación de la celda: 3 330 m frente a unos 2 400 m del valle. La diferencia puede sesgar temperatura y demanda de agua. No hay corrección por altura ni contraste local con estación SENAMHI.
- Agua: 1,7268 hm³ de la RA 0097-2022 ANA y 75,08 ha de la RA 0258-2025 ANA sustentan la aproximación de 23 000 m³/ha/año. Son ámbitos y años distintos: se etiqueta `supuesto_zona`, se reparte uniformemente y nunca equivale a la dotación de una parcela. La margen de Cayma sigue sin comisión de riego verificada.
- Riego por gravedad y eficiencia 0,60: supuesto de zona y referencia general FAO, reemplazables por declaración del agricultor.
- Catálogo FAO-56: cebolla 20/35/110/45 días (210); papa 25/30/45/30 (130); maíz 30/50/60/40 (180). Kc y tolerancia a sales conservan sus referencias FAO-56 y FAO 29. Son ejemplos bibliográficos de otras regiones, sin calibración varietal local.
- Calendarios: cebolla junio–julio inferida de SENAMHI, `sin_verificar`; papa y maíz `sin_calendario`. La ventana anual permite calcular escenarios, no afirma que cualquier mes sea adecuado.
- Helada: mínima menor de 0 °C como señal general, `sin_verificar`; no es un umbral de daño calibrado para cada cultivo.
- Ajo: se acepta como antecedente sin ficha de evaluación. Economía local: desconocida; rendimiento, precio y costos permanecen nulos, sin margen fabricado.

- Alfalfa, haba verde, tomate y trigo (15-nov-2026): fichas `exploratory: true` con Kc, etapas y sales de FAO-56/FAO 29 (mismas filas que en Majes; ver `data/zonas/majes/REVISION.md`), sin calendario (`sin_calendario`) y **sin economía** (`sin_dato`): no se copió nada de Majes. La alfalfa modela un año de campaña como supuesto (la Tabla 11 no fija la duración de las etapas media y final) y mantener un alfalfar instalado sigue sin compararse. Los Kc iniciales de tomate (0,60) y trigo (0,30) no pudieron comprobarse en la página FAO (columna en imagen): `sin_verificar`. Se aplica la helada general (`sin_verificar`) a haba, tomate y trigo.

Fuentes con institución, URL y ámbito en `data/sources/sources.json`. Antes del uso en campo faltan revisión local de ciclos/calendario, contraste meteorológico, dotación por turno y datos propios económicos.

Catálogo `.2`: ficha de policultivo maíz + haba verde como **hipótesis CERES**, no práctica observada ni asociación validada. Usa solo identificadores del catálogo de Chilina y no importa datos de Majes. Economía, agua, densidad y ventajas conjuntas siguen desconocidas. La finalidad es permitir comparar el concepto de diversificación simultánea con monocultivo/rotación, solicitando revisión local antes de recomendarlo.
