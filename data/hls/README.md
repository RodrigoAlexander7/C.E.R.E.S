# HLS real de las parcelas demo

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
