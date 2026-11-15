# HLS real de las parcelas demo

**15-nov-2026 (actualización):** los contornos demo anteriores estaban sobre suelo sin cultivo (NDVI ≈ 0,05–0,09), lo que en la app parecía un dato roto. Se eligieron lotes con cultivo así:
1. Imagen NASA GIBS `HLS_S30_Nadir_BRDF_Adjusted_Reflectance` del 2026-10-25 (z12; teselas x=1226 Majes y x=1234 Chilina, y=2236). Se ordenaron ventanas de 4×4 píxeles (≈ 150 m) por verdor en color verdadero `(G−R)/(G+R)`.
2. Para los 4 mejores candidatos de cada zona se leyó HLS v2 real (jun–oct 2025, mismo método y máscara de abajo) y se eligió el que tenía NDVI mensual > 0,3 en más meses y que cae en un distrito de la zona piloto.
   - **Majes I** (distrito Majes): `[-72.22464, -16.33777]–[-72.22361, -16.33678]`, 10 escenas, 100 % de píxeles válidos, NDVI mensual 0,56–0,87.
   - **Valle de Chilina** (distrito Cayma): `[-71.54005, -16.37664]–[-71.53902, -16.37565]`, 9 escenas (dos con 21 % y 64 % de píxeles válidos), NDVI mensual 0,38–0,73.
   - Candidatos descartados: uno sin escenas que cubran el polígono; otros con menos meses sobre 0,3 o fuera de los distritos piloto.
3. `seed.py` actualiza el contorno del lote demo existente cuando cambia en `zona.json`; las observaciones antiguas quedan en la base filtradas por su hash de contorno.

`demo_ndvi.json` contiene observaciones calculadas en esta sesión sobre los contornos públicos de Majes I y Chilina. Se descargaron las ventanas de bandas HLS v2 y Fmask mediante Planetary Computer; no se simularon valores.

- Fórmula: (NIR − rojo)/(NIR + rojo), mediana de centros de píxel dentro del polígono.
- L30: B05 y B04. S30: B8A y B04. Escala 0,0001 común; se cancela en el cociente.
- Fmask: excluye bits 1–5, fill 255 y aerosol alto (bits 6–7 = 3). También excluye reflectancias ausentes, negativas/fuera de rango y denominadores nulos.
- Conserva fecha de adquisición, ID/colección, URLs públicas sin SAS, nubosidad de escena, porcentaje y conteo de píxeles válidos, hash SHA-256 de las ventanas y máscara y hash del contorno.
- Periodo: junio–octubre de 2025 en Majes (la primera ejecución conservó escenas antes de un error transitorio); junio–agosto de 2025 en Chilina. Son series históricas, sin garantía de actualidad. Un NDVI bajo no diagnostica la causa.
- Selección: hasta dos escenas por mes que cubren el polígono, priorizadas por nubosidad de escena. No constituye una serie exhaustiva. Las parcelas pequeñas pueden contener pocos centros de píxel; consultar la tabla de calidad.
- El seed solo carga observaciones cuyo hash de contorno coincide con la demo. Reejecutar `ceres.cli ndvi --parcel ID --start FECHA --end FECHA` permite reproducir la lectura. NASA puede reprocesar productos; el hash registra la versión efectivamente leída.
- Medición con `/usr/bin/time`: Majes 137 264 KiB / 3,4 s y Chilina 185 008 KiB / 22 s para las ejecuciones completadas de tres meses. No es una prueba de capacidad concurrente.

Fuentes: [NASA HLS](https://hls.gsfc.nasa.gov/algorithms/), [catálogo HLS de Microsoft](https://github.com/microsoft/planetary-computer-tasks/tree/main/datasets/hls2).
