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

## Observación sobre la serie NASA

La celda NASA POWER consultada tiene 835 m de elevación; la Pampa de Majes está cerca de 1 400 m. Las mínimas de la celda (13–19 °C de media mensual) son probablemente más templadas que en el lote, por lo que los indicadores de frío pueden subestimar riesgos. El contraste con la estación SENAMHI «Pampa de Majes» sigue pendiente.

## Qué debe revisar un agrónomo antes del uso en campo

1. Calendario de siembra por cultivo y variedad en Majes I; duración real de los ciclos.
2. Kc ajustados o medidos localmente (riego por goteo/aspersión).
3. Umbrales térmicos por variedad (frejol canario, cebolla roja arequipeña).
4. Precios en chacra, rendimientos comercializables y costos actuales.
5. Ficha de asociación maíz + frejol (densidades, fechas, rendimientos relativos).
