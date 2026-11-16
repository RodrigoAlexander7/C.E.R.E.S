# Revisión de parámetros agronómicos y calendarios — 14 de noviembre de 2026

Validación 2 del plan (`specs/tareas.md`). Revisión documental hecha por el agente de desarrollo. **No sustituye la revisión de un agrónomo local**: ningún parámetro tiene estado `revisado_local`.

## Comprobado contra la fuente original

| Parámetro | Valores del catálogo | Fuente consultada | Resultado |
|---|---|---|---|
| Kc maíz grano | 0,30 / 1,20 / 0,35 | FAO-56, tabla 12 (cereales: Kc ini 0,3; maíz grano 1,20 y 0,60–0,35) | Coincide. Kc final 0,35 = grano secado en campo. |
| Kc frejol seco | 0,40 / 1,15 / 0,35 | FAO-56, tabla 12 («Beans, dry and Pulses») | Coincide. |
| Kc cebolla seca | 0,70 / 1,05 / 0,75 | FAO-56, tabla 12 (hortalizas pequeñas: ini 0,7; «Onions – dry» 1,05 y 0,75) | Coincide. |
| Etapas maíz grano | 25/40/45/30 = 140 d | FAO-56, tabla 11, «Arid Climate» | Coincide. |
| Etapas frejol seco | 15/25/35/20 = 95 d | FAO-56, tabla 11, «Pakistan, Calif.» | Coincide (clima árido). |
| Etapas cebolla seca | 15/25/70/40 = 150 d | FAO-56, tabla 11, «Mediterranean» | Coincide; la fila «Arid Region» da 210 d (siembra directa). Elegida la de 150 d como trasplante; **pendiente** confirmar con calendario local. |
| Salinidad (CEe 100 % / 50 %) | maíz 1,7/5,9; frejol 1,0/3,6; cebolla 1,2/4,3 dS/m | FAO 29, tabla 4 | Coincide. |
| ET0 | FAO-56 Penman–Monteith diaria | FAO-56, ejemplo 18 | Reproducido en `tests/domain/test_climate.py` (ET0 = 3,9 mm/día). |
| Lluvia efectiva | 0,8P−25 / 0,6P−10 | FAO Training Manual 3, §4.2 | Fórmula y ejemplo reproducidos en pruebas. |

## No verificable en esta revisión

- **Umbrales térmicos** (frejol: media diaria 10–27 °C; cebolla: < 14 °C favorece floración; maíz: media < 10 °C en establecimiento). Las fichas FAO «Crop information» devolvieron 404 el 14-nov-2026; los valores proceden de la versión indexada (frejol, cebolla) o de un supuesto general (maíz). Estado `sin_verificar`: solo producen advertencias, nunca descartan una opción.
- **Ventanas de siembra** (maíz ago–dic, frejol mar–jul, cebolla mar–ago) y **15 días de preparación**: `supuesto_demo`. No hay calendario local verificado (Agencia Agraria/AUTODEMA). Se muestran como supuesto en cada resultado.
- **Rendimientos, precios en chacra y costos**: `supuesto_demo`; no provienen de SIEA ni de productores.
- **Ajuste climático del Kc medio** (FAO-56 ec. 62) no aplicado: en el clima árido de Majes tendería a subirlo; se declara como supuesto.

## Alfalfa, haba, tomate y trigo (15-nov-2026)

Cuatro fichas nuevas, todas `exploratory: true` (nunca pasan de «Por explorar»). Kc, etapas y sales vienen de FAO-56 (tablas 11 y 12) y FAO 29 (tabla 4), consultadas el 15-nov-2026; ventanas, rendimientos, precios y costos son `supuesto_demo`.

- **Alfalfa (forraje)**: Kc «averaged cutting effects» 0,40/0,95/0,90; FAO-29: 2,0 y 8,8 dS/m. **La Tabla 11 solo fija 10 y 30 días para las dos primeras etapas; el resto es variable.** Se modela UN año de campaña (10/30/270/55 = 365 d) como supuesto de CERES, `supuesto_demo`: no representa un alfalfar de varios años ni calendario de cortes. «Seguir con la alfalfa ya instalada» sigue sin compararse (`PERENNIAL_CROP_ID` en el motor); solo se compara sembrarla como cultivo nuevo. SISAP no publica alfalfa: precio fijo supuesto (S/ 0,22/kg de forraje verde, 80 t/ha).
- **Haba verde**: Tabla 11 «Faba bean, broad bean» Mediterráneo 20/30/35/15 (100 d); Kc de «fresh» 0,50/1,15/1,10; FAO-29: 1,5 y 6,8 dS/m. Precio = SISAP «Haba verde serrana» (Arequipa) × 0,5 (supuesto).
- **Tomate**: Tabla 11 «Arid Region» enero 30/40/40/25 (135 d); Kc medio 1,15 y final 0,70–0,90 (se usa 0,80); FAO-29: 2,5 y 7,6 dS/m. **El Kc inicial 0,60 no pudo comprobarse** (la columna es una imagen en la página FAO): `sin_verificar`. Precio = SISAP «Tomate» × 0,5 (supuesto).
- **Trigo (grano)**: Tabla 11 «Barley/Oats/Wheat» Calif. Desert 20/50/60/30 (160 d); Kc medio 1,15 y final 0,25–0,40 (se usa 0,30); FAO-29: 6,0 y 13 dS/m. **El Kc inicial 0,30 no pudo comprobarse** (misma causa). SISAP no publica trigo en grano para Arequipa: precio supuesto (S/ 1,60/kg, 4 t/ha).
- Se sacó la alfalfa de `non_catalog_crops`. Con estas fichas el optimizador sigue sugiriendo frejol (plan D) y papa/frejol (plan E): ninguno de los cuatro nuevos domina.

## Precios MIDAGRI-SISAP y cultivos agregados (15-nov-2026, catálogo .2)

- **Precio en chacra = mayorista MIDAGRI-SISAP de Arequipa (mediana diaria 2–13 nov 2026) × factor chacra/mayorista.** El factor es `supuesto_demo`: para frejol (0,712) y cebolla (0,378) se eligió para conservar los precios previos de la demo (S/ 5,50 y 0,70/kg); para los cultivos nuevos es un genérico de 0,5 (verificar con acopiadores de Majes). Maíz amarillo duro no figura en SISAP en esas dos semanas: su precio sigue siendo supuesto.
- **Volatilidad de precio (`price_sigma`)**: σ de un log-normal usado solo en el análisis de riesgo (maíz 0,15; frejol 0,20; ajo y arveja 0,30; papa 0,35; cebolla y zanahoria 0,40). Supuesto de demostración; reemplazar con la serie histórica SISAP.
- **Cultivos agregados por explorar** (`exploratory: true`, nunca mejor que «Por explorar»):
  - **Papa**: FAO-56 Tabla 11 «(Semi) Arid Climate» 25/30/45/30 (130 d); Kc 0,50/1,15/0,75 (Tabla 12); FAO-29 Tabla 4: ECe 1,7 (100 %) y 5,9 dS/m (50 %). Comprobado el 15-nov-2026.
  - **Zanahoria**: Tabla 11 «Arid climate» 20/30/50/20 (120 d); Kc 0,70/1,05/0,95; FAO-29: 1,0 y 4,6 dS/m. Comprobado.
  - **Arveja verde**: Tabla 11 «Mediterranean» 20/30/35/15 (100 d); Kc arveja fresca 0,50/1,15/1,10. FAO-29 no la incluye: sin umbral de sal.
  - **Ajo morado**: Kc 0,70/1,00/0,70 (Tabla 12). **La Tabla 11 no trae duración para ajo**: se aproxima con la cebolla (150 d) y queda `sin_verificar`. FAO-29 no lo incluye.
  - Ventanas de siembra, rendimientos y costos de los cuatro: `supuesto_demo`. Ningún cultivo nuevo tiene umbral térmico verificado.

## Observación sobre la serie NASA

La celda NASA POWER consultada tiene 835 m de elevación; la Pampa de Majes está cerca de 1 400 m. Las mínimas de la celda (13–19 °C de media mensual) son probablemente más templadas que en el lote, por lo que los indicadores de frío pueden subestimar riesgos. El contraste con la estación SENAMHI «Pampa de Majes» sigue pendiente.

## Qué debe revisar un agrónomo antes del uso en campo

1. Calendario de siembra por cultivo y variedad en Majes I; duración real de los ciclos.
2. Kc ajustados o medidos localmente (riego por goteo/aspersión).
3. Umbrales térmicos por variedad (frejol canario, cebolla roja arequipeña).
4. Precios en chacra, rendimientos comercializables y costos actuales.
5. Ficha de asociación maíz + frejol (densidades, fechas, rendimientos relativos).
