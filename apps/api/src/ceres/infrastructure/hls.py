"""HLS v2 real de Planetary Computer. COG por ventana, memoria acotada, sin guardar SAS.

NASA HLS User Guide v2: B04/B05 en L30 y B04/B8A en S30; Fmask bits 1–5.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date
from urllib.parse import urlparse

import httpx
import numpy as np

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTIONS = ("hls2-l30", "hls2-s30")
METHOD = "HLSv2-NDVI-Fmask-1.0"


def retryable_error(exc: Exception) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in {408, 429, 500, 502, 503, 504}
    if isinstance(exc, httpx.TransportError):
        return True
    from rasterio.errors import RasterioIOError
    return isinstance(exc, RasterioIOError)


def geometry_hash(geometry: dict) -> str:
    return hashlib.sha256(json.dumps(geometry, sort_keys=True).encode()).hexdigest()


def ndvi_stats(red, nir, quality, inside) -> dict:
    """Centros de píxel dentro del polígono. Ausente o nublado produce null, nunca cero."""
    valid = inside & (quality != 255) & ((quality & 62) == 0)
    valid &= ((quality >> 6) != 3) & (red != -9999) & (nir != -9999)
    valid &= (red >= 0) & (nir >= 0) & (red <= 10000) & (nir <= 10000)
    denominator = nir.astype(float) + red.astype(float)
    valid &= denominator > 0
    total, n = int(inside.sum()), int(valid.sum())
    values = (nir[valid].astype(float) - red[valid]) / denominator[valid]
    return {"ndvi": round(float(np.median(values)), 4) if n else None,
            "valid_pixels": n, "parcel_pixels": total,
            "valid_pct": round(n / total * 100, 1) if total else None}


def scenes(geometry: dict, start: date, end: date) -> list[dict]:
    from shapely.geometry import shape
    bbox = ",".join(str(v) for v in shape(geometry).bounds)
    with httpx.Client(timeout=30) as client:
        r = client.get(STAC + "/search", params={"collections": ",".join(COLLECTIONS), "bbox": bbox,
            "datetime": f"{start}T00:00:00Z/{end}T23:59:59Z", "limit": 1000})
        r.raise_for_status()
        payload = r.json()
    # Selección reproducible de hasta dos escenas completas por mes, menos nubosas.
    grouped: dict[str, list] = {}
    for item in payload.get("features", []):
        if item.get("collection") not in COLLECTIONS or not shape(item["geometry"]).covers(shape(geometry)):
            continue
        p = item["properties"]
        grouped.setdefault(p["datetime"][:7], []).append(item)
    return [i for key in sorted(grouped) for i in sorted(grouped[key], key=lambda x:
        (x["properties"].get("eo:cloud_cover", 100), x["id"]))[:2]]


def observe(item: dict, geometry: dict) -> dict:
    import rasterio
    from rasterio.features import geometry_mask, geometry_window
    from rasterio.warp import transform_geom

    collection = item["collection"]
    if collection not in COLLECTIONS:
        raise ValueError("Colección HLS desconocida")
    bands = ["B04", "B05" if collection == "hls2-l30" else "B8A", "Fmask"]
    with httpx.Client(timeout=20) as client:
        r = client.get("https://planetarycomputer.microsoft.com/api/sas/v1/token/" + collection)
        r.raise_for_status()
        token = r.json()["token"]
    arrays, urls = [], []
    # 16 MiB de caché, una escena cada vez, máximo 100k píxeles de ventana.
    with rasterio.Env(GDAL_CACHEMAX=16 * 1024 * 1024, GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
                      GDAL_HTTP_TIMEOUT="30", GDAL_HTTP_MAX_RETRY="1", VSI_CACHE=False):
        reference = None
        for band in bands:
            url = item["assets"][band]["href"]
            parsed = urlparse(url)
            if parsed.scheme != "https" or parsed.hostname != "hls2euwest.blob.core.windows.net" or parsed.query:
                raise ValueError("Recurso HLS fuera del proveedor permitido")
            urls.append(url)
            with rasterio.open(url + "?" + token) as src:
                projected = transform_geom("EPSG:4326", src.crs, geometry)
                window = geometry_window(src, [projected])
                if window.width * window.height > 100_000:
                    raise ValueError("Parcela demasiado grande para esta lectura HLS")
                transform = src.window_transform(window)
                grid = (str(src.crs), transform, int(window.height), int(window.width))
                if reference is not None and grid != reference:
                    raise ValueError("Bandas HLS no alineadas")
                reference = grid
                arrays.append(src.read(1, window=window))
                inside = geometry_mask([projected], out_shape=arrays[-1].shape, transform=transform, invert=True)
    stats = ndvi_stats(*arrays, inside)
    digest = hashlib.sha256(b"".join(a.tobytes() for a in arrays) + inside.tobytes()).hexdigest()
    return {**stats, "scene_id": item["id"], "collection": collection,
        "observed_on": item["properties"]["datetime"][:10],
        "cloud_pct": item["properties"].get("eo:cloud_cover"), "resolution_m": 30,
        "assets": urls, "sample_sha256": digest, "method": METHOD,
        "source": "NASA HLS v2, redistribuido por Microsoft Planetary Computer",
        "source_url": STAC + "/collections/" + collection + "/items/" + item["id"],
        "note": "Mediana de píxeles válidos; excluye nube, adyacencia, sombra, nieve, agua y aerosol alto. No diagnostica nutrientes ni causas."}
