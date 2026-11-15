// Productos NASA que usa CERES: un solo lugar para nombre, período, resolución y uso.
// Regla de marca: solo texto (sin logo ni emblema de la NASA, que no puede implicar respaldo).
// NOAA ONI (El Niño) y MIDAGRI-SISAP NO son NASA y no se rotulan así.

export type NasaProduct = "power" | "hls" | "gibs" | "srtm";

export interface NasaInfo {
  id: NasaProduct;
  sourceId: string;
  name: string;
  /** Período y resolución, en pocas palabras. */
  detail: string;
  /** Qué hace CERES con este dato. */
  use: string;
  url: string;
}

export const NASA: Record<NasaProduct, NasaInfo> = {
  power: {
    id: "power",
    sourceId: "NASA-POWER",
    name: "NASA POWER",
    detail: "clima diario 2015–2025 · celda ≈ 50 km",
    use: "Evapotranspiración (FAO-56), lluvia y temperatura: el agua que pide cada cultivo mes a mes y el riesgo de frío o calor.",
    url: "https://power.larc.nasa.gov/",
  },
  hls: {
    id: "hls",
    sourceId: "NASA-HLS",
    name: "NASA HLS",
    detail: "NDVI a 30 m · Landsat + Sentinel-2",
    use: "Verdor de tu lote mes a mes. Muestra vegetación; no mide nutrientes ni la causa de un cambio.",
    url: "https://hls.gsfc.nasa.gov/",
  },
  gibs: {
    id: "gibs",
    sourceId: "NASA-GIBS",
    name: "NASA GIBS",
    detail: "imagen HLS 30 m · 25 oct 2026",
    use: "Imagen satelital de fondo para ubicar y dibujar tu chacra. No entra en los cálculos.",
    url: "https://nasa-gibs.github.io/gibs-api-docs/",
  },
  srtm: {
    id: "srtm",
    sourceId: "SRTM-ELEVACION",
    name: "NASA SRTM",
    detail: "elevación 30 m",
    use: "Altura real del valle de Chilina, para no confundirla con la de la celda de clima.",
    url: "https://www.earthdata.nasa.gov/data/instruments/srtm",
  },
};

/** Capa GIBS del mapa: escena HLS despejada comprobada sobre Majes I y Chilina. */
export const GIBS_BASEMAP = {
  layer: "HLS_S30_Nadir_BRDF_Adjusted_Reflectance",
  date: "2026-10-25",
  maxzoom: 12,
};
