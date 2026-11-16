# Contexto nutricional humano de Arequipa y aportes alimentarios

El XLSX `8780903-indicadores-estado-nutricional-adolescentes-agosto-2026-base-datos-his.xlsx` aportado por el usuario es una publicación agregada SIEN-HIS sobre adolescentes de 12 a 17 años que accedieron a establecimientos de salud. El periodo es **enero a agosto de 2026**, acumulado. No contiene composición de alimentos, consumo, producción agrícola ni evidencia de cambios clínicos atribuibles a sembrar un cultivo. El segundo XLSX es una base de referencia CERES distinta, evaluada por separado abajo.

## Extracción y procedencia

Se extraen exclusivamente la fila **AREQUIPA** de `EN 12-17a x REGION!B11:R11` y la fila **AREQUIPA** de `Anemia 12-17a x REGION!B10:M10`. La geografía es la región del establecimiento de salud, sin inferir residencia de los evaluados. No representa necesariamente a toda la población departamental, y no permite atribuir estos porcentajes a Majes, Chilina, una parcela o una familia.

| Grupo | Evaluados | Celda del denominador | Categorías, casos y porcentaje original aproximado |
| --- | ---: | --- | --- |
| Talla/edad | 34 328 | `EN 12-17a x REGION!C11` | Normal 31 424 (91,5404 %); talla baja 2 742 (7,9876 %); talla alta 162 (0,4719 %) |
| Peso/talla, rótulo original | 34 328 | `EN 12-17a x REGION!J11` | Normal 19 672 (57,3060 %); delgadez 334 (0,9730 %); sobrepeso 9 530 (27,7616 %); obesidad 4 792 (13,9595 %) |
| Anemia | 23 538 | `Anemia 12-17a x REGION!C10` | Total 5 146 (21,8625 %); sin anemia 18 392 (78,1375 %); leve 3 780 (16,0591 %); moderada 1 326 (5,6334 %); severa 40 (0,1699 %) |

Las severidades están incluidas en anemia total. Los denominadores de antropometría y anemia son distintos y pueden solaparse; no se suman. La hoja DIRESA reproduce para Arequipa los mismos valores de REGION y se excluye. Las hojas DISTRITO, otras regiones y el total MINSA no se agregan ni se incluyen en la instantánea.

`arequipa_context.json` guarda los 12 indicadores con sus recuentos, porcentajes en escala **0–100**, denominadores, unidades, hojas y celdas. `sheets[].cells` conserva la representación decimal original del XML sin redondear; los números JSON de `indicators` sirven para consumo del backend. `headers`, `notes`, `period_cell` y `cover_cells` conservan los metadatos inspeccionados. El encabezado **PESO / TALLA** se transcribe literalmente: la nota dice indicadores OMS, pero no documenta aquí el algoritmo; no se renombra como IMC/edad. La nota de anemia cita los puntos de corte OMS 2024; esta extracción no recalcula diagnósticos.

Archivo de origen: `8780903-indicadores-estado-nutricional-adolescentes-agosto-2026-base-datos-his.xlsx`, **702152 bytes**.

SHA256: `72a8aab1f3b8dc7c25f8a474e73a53bb9ec02504aa9f8ef9a54320e9d8623b40`.

La portada identifica MINSA/INS y el Centro Nacional de Alimentación, Nutrición y Vida Saludable. No se verificó una URL pública exacta de esta edición; se registra `url: null` en lugar de inventarla. El hash identifica la copia recibida, sin demostrar por sí mismo su autenticidad institucional.

El HIS refleja personas evaluadas en servicios de salud y está sujeto a selección, cobertura y calidad del registro. El libro no aporta microdatos ni una auditoría de deduplicación, faltantes o cobertura. Sus proporciones no son una encuesta poblacional ni evidencia causal de efectos de la agricultura. Talla baja y delgadez se conservan como categorías distintas, sin convertirlas en una cifra general de “desnutrición”.

## Referencias alimentarias independientes

Las fichas cualitativas se verificaron el 15-nov-2026 en las [Tablas Peruanas de Composición de Alimentos del INS](https://tablasperuanas.ins.gob.pe/). Los códigos hacen explícita la parte o forma del alimento de referencia:

| Cultivo del catálogo | Referencia INS | Aporte cualitativo descrito |
| --- | --- | --- |
| `maiz_grano` | A29, maíz amarillo | Carbohidratos y proteína vegetal; condicionado al destino humano y aptitud alimentaria del grano |
| `frejol_grano` | T15/T16, frejol canario seco/cocido | Proteína vegetal, fibra y hierro; la composición del seco no se presenta como la del cocido |
| `cebolla`, `cebolla_roja` | B29, cebolla de cabeza | Fibra y vitamina C; referencia genérica, sin inferir composición de una variedad local |
| `papa` | U19, papa blanca | Carbohidratos y vitamina C; referencia de tubérculo, preparación y variedad variables |
| `ajo` | B13, ajo sin cáscara | Carbohidratos y fibra; sin atribuir un aporte importante a una ración de condimento |
| `arveja_verde` | T2, arveja fresca sin vaina | Proteína vegetal, fibra y vitamina C de la parte comestible |
| `haba_verde` | T47, habas frescas sin cáscara ni vaina | Proteína vegetal, fibra y vitamina C de la parte comestible |
| `tomate` | B79, tomate | Vitamina C y fibra |
| `zanahoria` | B85, zanahoria | Betacaroteno, precursor de vitamina A, y fibra |
| `trigo` | A73, trigo | Carbohidratos, proteína vegetal y fibra del grano; no representa harina refinada o fortificada |
| `maiz_choclo` | [A34, grano fresco](https://tablasperuanas.ins.gob.pe/index.php/node/458) | Carbohidratos, proteína y fibra; diferente del maíz amarillo seco y de la mazorca completa |
| `zapallo_macre` | [B89, zapallo macre](https://tablasperuanas.ins.gob.pe/node/711) | Betacaroteno y fibra; sin extrapolar a todas las variedades |
| `aji_amarillo` | [B3, ají amarillo fresco](https://tablasperuanas.ins.gob.pe/node/625) | Vitamina C, dependiente de porción y preparación; fibra no reportada |
| `alfalfa` | Catálogo: forraje | Sin nutrientes humanos calculados; no se convierte forraje en leche o carne |

Localización verificable: [A29/A73](https://tablasperuanas.ins.gob.pe/), [B13/B29/B79/B85](https://tablasperuanas.ins.gob.pe/?page=2), [U19/T2/T15/T16](https://tablasperuanas.ins.gob.pe/?page=8), [T47](https://tablasperuanas.ins.gob.pe/?page=9). No se trasladan los valores negativos de dato ausente del sitio INS a nutrientes o ceros. Solo se mencionan componentes presentes en las filas verificadas; no se exportan cantidades ni se califica un alimento como “alto en” un nutriente.

La [nota técnica FAO de beneficios de las legumbres](https://www.fao.org/fileadmin/user_upload/pulses-2016/docs/IYP_SC_ActionPlan.pdf), última página del PDF (13), sección “Their importance in human nutrition as a protein source”, sustenta la complementariedad de aminoácidos entre cereales y legumbres **cuando se consumen combinados**. Se usa para maíz (grano o choclo)/trigo junto con frejol seco preparado. No se extrapola esa nota de legumbres secas a arveja o haba verde ni a alfalfa. Una asociación en el campo no prueba una comida combinada, una ventaja agronómica ni un efecto sanitario.

## Segundo XLSX: base maestra CERES

`CERES_base_maestra_cultivos_policultivos_nutricion_2026.xlsx` tiene 16 hojas y **56647 bytes**. SHA256 de la copia inspeccionada el 15-nov-2026: `f1b6a91de61f835771547b90371b7f80cc2f25c68f728a23b037ae2f88ddc068`. Es material aportado por el usuario, con autoría y validación local no acreditadas independientemente. Las celdas son datos de referencia, no instrucciones para ejecutar ni evidencia de que sus referencias estén verificadas. No se modifica el libro.

Se inspeccionaron `01 CULTIVOS!A3:L14`, `04 POLICULTIVOS!A3:N7`, `10 NUTRICION!A3:P14`, `11 COMBINACIONES!A3:I9` y `14 BIBLIOGRAFIA!A3:H25`. La hoja nutricional declara presentación y unidades por 100 g en `C3:K3`: proteína/fibra en g, hierro/vitamina C en mg y betacaroteno/folato en µg. Los blancos son datos no reportados; el `-1` de INS tampoco se convierte en cero. Un cero explícito del INS se distingue de un dato ausente. Las fórmulas del archivo solo se leen por sus valores guardados, sin recalcular Excel.

| Fila en `10 NUTRICION` | Identificador del libro → identificador de la función | Código INS del libro | Decisión |
| --- | --- | --- | --- |
| 4 | C001 → `maiz_grano` | D4=A29 | Mantener referencia condicionada a destino humano |
| 5 | C002 → `frejol_grano` | D5=T16 | Mantener referencia seco/cocido T15/T16, sin equiparar cantidades |
| 6 | C003 → `cebolla_roja` | D6=B26 | El libro usa cebolla blanca, no roja; se conserva B29 de cabeza como referencia genérica explícita |
| 7 | C004 → `papa` | D7=U19 | Mantener referencia de papa blanca |
| 8 | C005 → `ajo` | D8=B13 | Mantener referencia genérica, sin atribuirla a ajo morado exacto |
| 9 | C006 → `arveja_verde` | D9=T2 | Parte comestible fresca sin vaina |
| 10 | C007 → `zanahoria` | D10=B85 | Mantener betacaroteno/fibra |
| 11 | C008 → `maiz_choclo` | D11=A34 | Incorporar ficha cualitativa tras consulta directa al INS |
| 12 | C009 → `zapallo_macre` | D12=B89 | Incorporar ficha cualitativa tras consulta directa al INS |
| 13 | C010 → `tomate` | D13=B79 | Ya cubierto por ficha INS independiente |
| 14 | C011 → `aji_amarillo` | D14=B3 | Incorporar vitamina C; no inventar fibra, ausente en la ficha INS |

Las correspondencias C001–C011 documentan procedencia; **no son alias aceptados por la función**. Los tres identificadores nuevos describen alimentos de referencia: no activan cultivos en los catálogos de Majes/Chilina ni acreditan aptitud parcelaria. Los valores nutricionales del maestro se contrastaron en las fichas INS indicadas para las incorporaciones, pero se mantiene el contrato cualitativo, sin cantidades por hectárea o por ración. No se importa automáticamente su bibliografía ni su estado “verificado”.

La discrepancia B26/B29 es una diferencia de alimento de referencia, no evidencia de la composición específica de cebolla roja. La [ficha B26 del INS](https://tablasperuanas.ins.gob.pe/node/648) confirma que el alimento del maestro es cebolla blanca.

`04 POLICULTIVOS!A4:N7` contiene P001 choclo+frejol, P002 choclo+frejol+zapallo, P003 choclo+zapallo y P004 maíz+leguminosa sin identificar. `C4=C008` identifica choclo, no el `maiz_grano` seco de la asociación existente. `L4:L6` dice “Por evaluar en Majes”; P004 no está cerrado. Se conservan como candidatos documentados, sin expansión automática de P001–P004, sin nuevas reglas de compatibilidad y sin sumar rendimientos de monocultivos. No se validó externamente su bibliografía agronómica ni un ensayo local. Las combinaciones N001–N006 de `11 COMBINACIONES!A4:I9` describen comidas: no son asociaciones agrícolas. No se incorporan como promesas de absorción o de reducción de anemia sin evaluar sus fuentes primarias específicas.

La procedencia de esta revisión queda en este README y en el registro propuesto del maestro. `arequipa_context.json` sigue siendo exclusivamente SIEN-HIS regional: no mezcla composición de alimentos, candidatos agronómicos ni hipótesis del maestro con sus indicadores.

## Contrato de integración

`ceres.infrastructure.nutrition.load_nutrition(path: Path) -> dict`

- Lee exclusivamente JSON mediante biblioteca estándar, sin red ni dependencia de `openpyxl`.
- Valida versión 1, Arequipa/04, fuente, SHA256 declarado, periodo, dos hojas REGION, celdas, categorías, denominadores, porcentajes y unidades. Rechaza campos ajenos al esquema agregado, claves JSON duplicadas, números no finitos y tipos incorrectos. Los campos desconocidos o inválidos de un indicador provocan `NutritionDataError`, nunca su reemplazo por cero. Un archivo ausente también provoca ese error; el parent decide mostrar contexto no disponible.
- Si el XLSX acompaña al JSON, verifica hash y tamaño antes de devolverlo. Puede desplegarse solo el JSON: la verificación del XLSX queda explícitamente en `false`.
- Devuelve el JSON completo más `integrity: {"json_sha256": str, "workbook_sha256_verified": bool}`. El primer hash corresponde a los bytes originales del JSON y permite identificar la instantánea congelada. No es firma ni comprobación remota de autenticidad.
- No usa caché ni devuelve objetos mutables compartidos entre llamadas. Una edición legítima de periodo/hojas exige una nueva versión de esquema y revisión del contrato v1.

`ceres.domain.nutrition.nutrition_impact(crop_ids: list[str], regional_context: dict | None) -> dict`

Función pura. No llama LLM ni lee disco. El parent pasa el resultado validado del loader, o `None`. Si se aporta contexto debe tener `region == "Arequipa"` y `region_code == "04"`; su `source_ids`, si está presente, debe ser una lista de identificadores no vacíos. La lista de cultivos requiere identificadores no vacíos; entradas inválidas provocan `ValueError`. Se expande exclusivamente `maiz_frejol_asociado` a `maiz_grano`/`frejol_grano`, conservando el orden y eliminando duplicados exactos de identificador. `cebolla_roja` utiliza la referencia de `cebolla` y conserva su identificador original.

La respuesta tiene exactamente estas cuatro claves:

```text
foods: list[{
  crop_id: str,
  food: str | None,
  status: "referencia_alimentaria" | "potencial_condicionado" | "forraje" | "sin_evidencia",
  nutrients: list[str] | None,
  explanation: str,
  source_ids: list[str],
  reference: {source_id: str, food_code: str} | None
}]
explanation: str
source_ids: list[str]  # únicos y ordenados; unión de referencias usadas y contexto
regional_context: dict | None  # copia profunda del argumento, incluida integrity
```

Para la interfaz web, `regional_context.population` es `string` y `regional_context.limitations` es `string[]`; no existen `population`/`limitations` en la raíz de `NutritionImpact`. Cuando no hay contexto, `regional_context` es `null`. Las cuatro claves de la raíz se mantienen también al evaluar los alimentos propuestos del maestro.

`foods` incluye una ficha por cultivo único expandido. En alfalfa y cultivos sin ficha, `food`, `nutrients` y `reference` son `None`, con explicación y fuentes vacías. En maíz, `potencial_condicionado` hace explícito que el destino humano está por confirmar. Una lista vacía produce `foods: []`; contexto ausente conserva `regional_context: None`. No hay puntuación nutricional, predicción clínica, cálculo de raciones, nutrientes por hectárea ni suma de cosechas de monocultivos.

El parent debe congelar el **contexto validado completo y su SHA JSON** en los inputs del run, y consumir esa instantánea en consultas posteriores; no recargar “el contexto más reciente” para reinterpretar un run histórico. Puede congelar también la salida de la función. El HIS no se incorpora a puntuaciones económicas ni de salud individual. Estos módulos no modifican modelos, bootstrap ni registro de fuentes.

## Entradas propuestas para `sources.json` (integración por el parent)

Las cuatro entradas siguientes usan las claves existentes del registro. Son propuestas; no se ha editado ese archivo. Las tres primeras son las referencias usadas en `source_ids` de la función. La cuarta acredita la copia del material de usuario revisado en este README; no sustituye la referencia INS de cada alimento ni se añade automáticamente a la salida del dominio.

```json
[
  {
    "id": "INS-SIEN-HIS-ADOLESCENTES-AREQUIPA-2026-08",
    "institution": "Instituto Nacional de Salud / Centro Nacional de Alimentación, Nutrición y Vida Saludable",
    "title": "MINSA: indicadores nutricionales en adolescentes de 12 a 17 años, SIEN-HIS, enero-agosto 2026: Arequipa",
    "url": null,
    "section": "data/nutricion/arequipa_context.json; EN 12-17a x REGION!B11:R11; Anemia 12-17a x REGION!B10:M10",
    "scope": "Adolescentes evaluados en establecimientos de salud de Arequipa; enero-agosto 2026",
    "kind": "observado",
    "status": "Copia XLSX del usuario leída el 15-nov-2026; SHA256 72a8aab1f3b8dc7c25f8a474e73a53bb9ec02504aa9f8ef9a54320e9d8623b40. URL pública exacta no verificada. Contexto HIS no poblacional ni causal."
  },
  {
    "id": "INS-TPCA-ALIMENTOS",
    "institution": "Instituto Nacional de Salud",
    "title": "Tablas Peruanas de Composición de Alimentos: referencias alimentarias cualitativas",
    "url": "https://tablasperuanas.ins.gob.pe/",
    "section": "A29/A73 en portada; B13/B29/B79/B85 en ?page=2; U19/T2/T15/T16 en ?page=8; T47 en ?page=9; A34 node/458; B89 node/711; B3 node/625",
    "scope": "Alimentos y partes comestibles de referencia; no análisis de productos de una parcela",
    "kind": "referencia_bibliografica",
    "status": "Filas y componentes consultados el 15-nov-2026; uso cualitativo, sin cantidades ni calificación de alto contenido. No evidencia causal de salud."
  },
  {
    "id": "FAO-LEGUMBRES-ALIMENTACION",
    "institution": "FAO",
    "title": "Action plan for the International Year of Pulses: Technical Note, Benefits of Pulses",
    "url": "https://www.fao.org/fileadmin/user_upload/pulses-2016/docs/IYP_SC_ActionPlan.pdf",
    "section": "Página 13 del PDF, Technical Note: Benefits of Pulses; Their importance in human nutrition as a protein source",
    "scope": "Complementariedad de aminoácidos al consumir cereales con legumbres secas",
    "kind": "referencia_bibliografica",
    "status": "Texto consultado el 15-nov-2026. Sustenta complementariedad de la comida; no demuestra ventajas de asociación en campo ni reducción de anemia o desnutrición."
  },
  {
    "id": "CERES-BASE-MAESTRA-NUTRICION-2026",
    "institution": "Material aportado por el usuario; autoría no verificada independientemente",
    "title": "CERES base maestra de cultivos, policultivos y nutrición 2026",
    "url": null,
    "section": "data/nutricion/CERES_base_maestra_cultivos_policultivos_nutricion_2026.xlsx; 01 CULTIVOS!A3:L14; 04 POLICULTIVOS!A3:N7; 10 NUTRICION!A3:P14; 11 COMBINACIONES!A3:I9; 14 BIBLIOGRAFIA!A3:H25",
    "scope": "Referencia de alimentos y propuestas para Majes; sin ensayo local ni observaciones de parcelas acreditados",
    "kind": "declarado",
    "status": "Copia del usuario inspeccionada el 15-nov-2026; 56647 bytes; SHA256 f1b6a91de61f835771547b90371b7f80cc2f25c68f728a23b037ae2f88ddc068. Incorporaciones cualitativas A34/B89/B3 contrastadas directamente con INS; bibliografía agronómica y etiquetas de verificación del libro no validadas externamente. Policultivos candidatos no activados."
  }
]
```

## Reproducción y comprobación local

Prueba aislada, desde `apps/api`:

```sh
.venv/bin/pytest --confcutdir=tests/domain tests/domain/test_nutrition.py
```

No carga las fixtures DB de `tests/conftest.py`. El propio test usa `zipfile`/XML estándar para comparar las celdas declaradas del HIS, portada, encabezados, notas y periodo con el libro original; no depende de scripts auxiliares. Comprueba ambos hashes XLSX, denominadores distintos, errores de procedencia y porcentajes, JSON inválido, contexto ausente, desconocidos, forraje, asociación, candidatos del maestro y ausencia de mutación compartida. No requiere red, DB, LLM ni paquetes de Excel. Los libros originales son necesarios para la auditoría, pero no para desplegar el loader con solo JSON.
