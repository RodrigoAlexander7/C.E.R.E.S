# Producto y economía para rotaciones en Majes

Revisión: 14 de noviembre de 2026. Alcance: diseño de un prototipo para la irrigación Majes–El Pedregal, pendiente de confirmar con el equipo. Un plazo de 48 horas es un supuesto de planificación, no una duración indicada por el usuario. `reto.md` y `propuesta.md` son material proporcionado por el usuario. Las recomendaciones de producto siguientes son propuestas de diseño, no resultados de validación de campo.

## ¿Qué datos económicos oficiales se pueden aprovechar?

### Takeaway

Conviene usar precios en chacra, rendimientos y presupuestos editables, con referencias oficiales históricas. SISAP puede aportar contexto de mercado, pero no debe convertirse automáticamente en el ingreso que recibirá el agricultor de Majes.

### Cited Findings

- El compendio agrícola del MIDAGRI anuncia superficie sembrada y cosechada, producción, rendimiento y precio en chacra de cultivos transitorios y permanentes; su ficha indexada ofrece cuadros Excel, incluidos los de 2023 y 2022. Es una fuente de archivos históricos, sin que esta revisión haya demostrado una API pública estable o el detalle distrital de sus cuadros. La ficha muestra fecha 4 de marzo de 2026. — [Compendio anual de producción agrícola](https://www.gob.pe/institucion/midagri/informes-publicaciones/2730325-compendio-anual-de-produccion-agricola).
- La metodología SIEA define el precio en chacra como la primera transacción en la unidad agropecuaria, ponderada por volúmenes y valores vendidos, con atención a variedad y calidad. Esto respalda separar precio de productor de precio de mercado mayorista. — [Lineamientos metodológicos SIEA](https://siea.midagri.gob.pe/portal/media/attachments/nosotros/gestion/Lineamientos_Metodologicos_SIEA.pdf).
- MIDAGRI describe SISAP como consulta de volúmenes, precios y procedencia de productos en mercados mayoristas del país. La página presenta AgroChatea como consulta conversacional de precios; una noticia de 2019 especifica mercados mayoristas de Lima Metropolitana para ese servicio. Son evidencias de alcance publicado, no prueba de funcionamiento actual de una integración. — [Herramientas de precios del MIDAGRI](https://www.gob.pe/institucion/midagri/campa%C3%B1as/3432-precios-de-productos-a-tu-alcance), [Descripción de AgroChatea de 2019](https://www.gob.pe/institucion/midagri/noticias/49994-minagri-presenta-nuevas-herramientas-de-informacion-agraria).
- MIDAGRI anuncia un portal SIEA con avance de campaña, costos, precios y perfil regional. La consulta del portal no pudo completarse en esta revisión; no se comprobó exportación automatizada ni granularidad de Majes. — [Anuncio oficial de herramientas SIEA](https://www.gob.pe/institucion/midagri/noticias/1090721-servicios-y-plataformas-del-midagri-mantienen-informados-a-productores-sobre-intenciones-de-siembra-y-precios-en-mercados), [Portal SIEA](https://siea.midagri.gob.pe/siea_bi/).
- La portada de AgroArequipa sí pudo leerse y mostró explícitamente un aviso de mantenimiento durante esta revisión. Esto afecta la disponibilidad observada de la portada; no prueba que todos sus archivos estén inaccesibles. — [Gerencia Regional de Agricultura de Arequipa](https://agroarequipa.gob.pe/).
- Hay un informe oficial indexado de costos de alfalfa de la región Arequipa para 2024–2025. Debe tratarse como referencia regional y de cultivo permanente; el PDF completo devolvió 403 en la herramienta, por lo que no se adoptan aquí cifras particulares. — [ESCO de alfalfa en Arequipa](https://cdn.www.gob.pe/uploads/document/file/9922544/8096722-publicacion-de-resultados-esco-cultivo-de-alfalfa-de-arequipa.pdf?v=1778087774).
- Atención geográfica: una publicación del INEI identifica su presupuesto de arroz con el **valle de Majes, provincia de Castilla**, mientras que el piloto propuesto es la irrigación/distrito Majes en Caylloma. No se deben mezclar fichas por compartir el nombre Majes. — [Costos de producción con base en ENA 2018, sección de ejemplo de arroz](https://cdn.www.gob.pe/uploads/document/file/3287324/Costos%20de%20Producci%C3%B3n%20para%20la%20Actividad%3A%20Agricultura%2C%20Ganader%C3%ADa%2C%20Caza%20y%20Silvicultura%20en%20Base%20a%20la%20Encuesta%20Nacional%20Agraria%20-%20ENA%202018%E2%80%9D..pdf).

### Inferences

- Propuesta: tabla curada y versionada para pocos cultivos, con `fuente`, `fecha del dato`, `fecha de consulta`, `ámbito`, `unidad`, `variedad`, `manejo` y `tipo de precio`. Cada dato debe poder editarse con información del agricultor.
- Jerarquía propuesta para precios: registro reciente del agricultor/comprador; ficha local verificable; referencia regional en chacra; referencia mayorista claramente separada. No aplicar un descuento universal a SISAP para inventar un precio en chacra.
- Para la demostración, congelar las entradas consultadas y guardar su procedencia evita depender de disponibilidad de portales. Un valor sintético puede demostrar interacción si lleva una etiqueta persistente y no se presenta como observación real.
- Cotizaciones para la próxima campaña deben ser escenarios o acuerdos declarados, no pronósticos de precio.

### Gaps

- No se comprobó una API oficial operativa con precios en chacra, costos y rendimientos actuales específicamente para irrigación Majes. La ficha indexada del anuario confirma variables y archivos, pero la descarga y sus desgloses deben probarse antes de implementarlos.
- Algunos portales gob.pe devolvieron 418 y SIEA devolvió timeout en la herramienta. Son fallos de acceso de esta revisión, no evidencia suficiente de una caída general.
- Falta obtener costos actuales de cada anual candidato, diferenciando semilla, labores, fertilizantes, riego, cosecha y comercialización; y entrevistas sobre comprador, calidad, rechazos y capital disponible.

## ¿Cómo comparar rotaciones completas sin falsa precisión?

### Takeaway

La unidad de decisión debe ser una secuencia de cultivos, con calendario, sobre la misma superficie y horizonte. Primero se comprueba la viabilidad; luego se comparan compromisos entre demanda de agua, margen por escenarios y prácticas de cuidado del suelo.

### Cited Findings

- FAO distingue evapotranspiración de referencia y evapotranspiración del cultivo: bajo condiciones estándar, `ETc = Kc × ET0`; `Kc` cambia con cultivo y etapa de desarrollo. El cálculo estándar asume buenas condiciones y requiere ajustes cuando hay limitaciones. — [FAO 56, capítulo 5](https://www.fao.org/4/X0490E/x0490e0a.htm).
- FAO explica que el requerimiento de riego se relaciona con la demanda del cultivo menos precipitación efectiva, y puede incluir necesidades adicionales por sales y falta de uniformidad. También documenta que 1 mm sobre 1 ha equivale a 10 m³. — [FAO 56, capítulo 1](https://www.fao.org/4/X0490E/x0490e04.htm).
- El requerimiento bruto incorpora pérdidas: `riego bruto = riego neto / eficiencia`, expresada como fracción; la eficiencia debe corresponder al punto de entrega considerado. — [FAO, definiciones de requerimiento neto, bruto y operativo](https://www.fao.org/4/u5835e/u5835e02.htm).

### Inferences

Diseño propuesto, con parámetros documentados y revisión agronómica:

1. **Referencia R0:** secuencia actual declarada por el agricultor, con siembras, cosechas y descansos; si es ficticia para la demo, nombrarla explícitamente como tal. No llamarla rotación típica de Majes.
2. **Alternativa R1:** secuencia de anuales que introduzca una familia diferente y una leguminosa validada localmente, si es compatible con suelo, mercado y calendario. No asignar beneficio de nitrógeno automático: depende de fijación, manejo y extracción de residuos/cosecha.
3. **Alternativa R2:** secuencia anual que cambie cultivos o fechas para reducir picos de demanda y/o intervalos de suelo descubierto. Su menor demanda se demuestra con cálculo; no se presupone por nombre del cultivo. Puede coincidir parcialmente con R1.

Para el piloto, elegir fechas inicial y final comunes, por ejemplo 24 meses, y una hectárea de referencia. Ajustar ciclos completos y labores entre campañas; no truncar una cosecha pendiente para favorecer otra opción. Si no caben bien en ese plazo, cambiar el horizonte para todas. Mostrar además resultados por año y superficie real. La alfalfa se reserva para una ampliación, o se modela con instalación, edad del cultivo, cortes, persistencia y restricción de forraje en el mismo horizonte.

**Agua:** por mes o decena, estimar `ETc` por etapa y una aproximación de planificación `NIR ≈ max(0, ETc − lluvia efectiva)` si se explicita que no modela almacenamiento del suelo, ascenso capilar ni lavado de sales. No usar lluvia total como lluvia efectiva sin método. Convertir neto a bruto con eficiencia editable y rango; multiplicar mm por 10 y por ha. No presentar esto como una orden de riego diaria. Si salinidad o drenaje importan y faltan datos, marcar revisión requerida, no necesidad total resuelta. Comparar demanda mensual y estacional con dotación declarada en el mismo punto de entrega; lluvia local y demanda atmosférica no revelan la dotación del canal ni reservas de cuenca.

**Economía:** para cada ciclo, `ingreso = rendimiento comercializable × precio en chacra`. Sumarlos sobre todo el horizonte y restar costos variables por ciclo, incluidos establecimiento y transición cuando correspondan. Nombrar el resultado **margen bruto estimado** si no incluye todos los costos; no llamarlo ganancia neta. Mostrar qué costos se excluyen. Para forraje propio, elegir valoración por costo de reemplazo o venta y evitar contabilizar ambos. Agregar máximo capital requerido y meses hasta primer cobro, si hay entradas suficientes. No predecir que menor riego produce el mismo rendimiento cuando hay estrés.

**Suelo:** indicadores interpretables de diseño: repetición de familias, presencia de leguminosas, meses de cobertura y destino de residuos. Son aproximaciones de manejo, no mediciones de NPK, carbono o enfermedad. El laboratorio y la historia del lote deben ser entradas independientes.

**Viabilidad antes de puntuación:** calendario, incompatibilidades del cultivo previo, suelo/salinidad si se conocen, agua mensual disponible, capital, maquinaria, comprador y forraje mínimo. Si faltan datos críticos, mostrar «requiere verificación»; no asumir que cumple.

**Puntuación opcional:** ponderar margen, demanda de agua e indicadores de suelo con pesos que sumen 1 y elija el agricultor. Publicar fórmula, valores y normalización. Usar umbrales fijos documentados o mostrar que min–max depende de candidatos; cuando un criterio no tiene variación, darle aporte neutro. Presentar métricas junto al orden para evitar que la puntuación oculte intercambios. Excluir escenarios inviables antes de ordenar; los de viabilidad desconocida quedan separados.

**Incertidumbre:** escenarios bajo/central/alto para precio, rendimiento, Kc y eficiencia, con razones de los rangos. No denominarlos intervalos estadísticos si no lo son. Evaluar mismo conjunto de años meteorológicos históricos para todos los candidatos y mostrar estabilidad del orden; eso es sensibilidad histórica, no pronóstico climático. Un escenario «20 % menos dotación» sería una hipótesis de demostración, no una predicción de NASA.

### Gaps

- Faltan calendarios locales por variedad, Kc adaptados, eficiencia observada, dotaciones mensuales y análisis de suelo del lote.
- No se han validado aún secuencias específicas con un agrónomo de Majes. No debe prometerse ahorro, mejora del suelo o aumento del margen antes de completar y validar esos insumos.

## ¿Qué producto y demostración convienen para la hackatón?

### Takeaway

Recomiendo un comparador de tres rotaciones de anuales para un lote y un agricultor de Majes, con cálculo explicable y datos trazables. Es una hipótesis de producto más ajustada al reto proporcionado que un recomendador nacional de cultivos o un tablero de riego aislado.

### Cited Findings

- MIDAGRI ya publica un servicio gratuito de consulta de precios mayoristas por mensajes de texto; su ficha también describe acceso a información de clima y agua. Esto documenta un precedente de interacción sencilla, sin demostrar preferencia local por WhatsApp ni necesidad de repetir un servicio de precios. — [El Datero Agrario](https://www.gob.pe/551-herramientas-para-consultar-precios-de-alimentos-el-datero-agrario).

### Inferences

Comparación de enfoques, como juicio de diseño basado en el `reto.md` del usuario:

| Enfoque | Utilidad | Dificultad para este caso |
|---|---|---|
| Recomendador de cultivo rentable para todo Perú | Entrada sencilla | Desatiende secuencia, antecedente y continuidad del suelo; requiere mucha más validación regional y económica. |
| Tablero de riego/estrés | Evidencia NASA visible | Monitorea condiciones pero por sí solo no ayuda a escoger rotaciones. |
| Comparador de rotaciones para Majes | Une antecedentes, agua, suelo y prioridades con consecuencias visibles | Requiere acotar cultivos y explicitar los datos que faltan. Es la opción recomendada. |

Flujo propuesto:

1. Seleccionar un lote de demostración o ingresar área y ubicación; mostrar fecha y escala de los datos NASA.
2. Declarar últimos cultivos, siguiente campaña prevista, meses disponibles, suelo conocido, riego/dotación, destino del producto y restricciones. Admitir «no sé» sin inventar mediciones.
3. Elegir prioridad: conservar agua, margen o cuidado del suelo; mantener visibles las restricciones obligatorias.
4. Comparar R0/R1/R2 en una línea de tiempo común, demanda mensual, rangos de margen e indicadores de manejo del suelo.
5. Abrir «por qué aparece esta opción»: evidencia NASA utilizada, reglas locales, supuestos y dato que podría cambiar la decisión.
6. Modificar dotación o un precio editable y demostrar recálculo. Si quedan menos de tres viables, explicar descartes y permitir revisar supuestos; no fabricar alternativas factibles.
7. Obtener una ficha compartible o copiar resumen para el asesor. WhatsApp puede ser una simulación de interfaz o un texto copiable; la API, automatización de mensajes y multicanal quedan fuera del núcleo.

Alcance orientativo para 48 horas: una zona, un caso con datos reales de ubicación y climatología, 3–5 fichas de anuales con calendarios y fuentes, tres secuencias configuradas, datos NASA precargados/versionados, reglas deterministas, calculadora y cuatro vistas como máximo. Usar un mapa solo si ayuda a seleccionar el lote o explicar escala. No incluir clasificación automática de cultivos, pronóstico meteorológico propio, diagnóstico de nutrientes por imagen, precios futuros ni módulo de enfermedades humanas. La explicación puede generarse con plantillas; un LLM no es requisito del motor.

Demostración propuesta: agricultor con secuencia y presupuesto declarados; comparación inicial; ajuste de dotación que descarta o penaliza una alternativa; ajuste de prioridad que modifica el orden entre opciones viables; apertura de evidencia y carencias. Todo ahorro o margen que aparezca será resultado de las entradas de ese ejemplo y se etiquetará como estimación, sin extrapolarlo a Majes.

Criterios de aceptación del prototipo: tres secuencias completas comparables incluida la referencia; datos NASA con fuente, fecha y resolución; al menos una decisión afectada materialmente por el dato ambiental; filtros obligatorios respetados; recálculo de pesos/supuestos; ausencia de recomendación cuando falta un dato crítico; separación visible de observación, dato del agricultor, supuesto e inferencia. La validación siguiente consiste en revisar reglas con un agrónomo y probar comprensión con productores, sin presentarla como completada.

### Gaps

- No hay entrevistas que validen usuario inicial, disposición de pago, canal preferido ni adopción. Proponer inicialmente agricultor con cultivos anuales y asesor como apoyo es una hipótesis que debe probarse.
- No conocemos tamaño del equipo ni tiempo disponible. El alcance de 48 horas es ajustable; no debe convertirse en compromiso ni restricción atribuida al usuario.
