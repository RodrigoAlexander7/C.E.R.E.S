export type Geometry = { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };

export interface RegionNode {
  id: string;
  level: "departamento" | "provincia" | "distrito";
  code: string;
  name: string;
  parent_id: string | null;
  pilot: boolean;
  geometry: Geometry | null;
  provenance: { provider: string; source_update: string | null; fetched_at: string; note: string };
}

export type Status = "viable_con_supuestos" | "no_viable" | "requiere_datos" | "exploratoria";

export interface Metric {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  kind: string;
  method: string;
  source_ids: string[];
  detail: string;
}

export interface Reason {
  rule_id: string;
  state: "cumple" | "no_cumple" | "falta_dato" | "advertencia" | "informacion";
  message: string;
  metric_ids: string[];
  source_ids: string[];
  assumptions: string[];
  missing: string[];
}

export interface TimelineBlock {
  kind: "preparacion" | "espera" | "cultivo" | "descanso";
  start: string;
  end: string;
  crop_id: string | null;
  label: string;
  stages: { name: string; start: string; end: string }[];
  why: string[];
}

export interface MonthlyWater {
  year: number;
  month: number;
  label: string;
  days: number;
  etc_mm: number;
  pe_mm: number;
  net_mm: number;
  gross_mm: number | null;
  gross_m3: number | null;
}

export interface Strategy {
  strategy_id: string;
  name: string;
  short: string;
  status: Status;
  sequence: string[];
  timeline: TimelineBlock[];
  metrics: Record<string, Metric>;
  reasons: Reason[];
  assumptions: string[];
  missing: string[];
  monthly_water: MonthlyWater[];
  soil: {
    analysis?: Record<string, string | number | null>;
    needs?: string;
    contributions?: { residues: string; legume_note: string };
    per_crop?: { crop: string; residue: string; nutrition: string }[];
    indicators?: { families: number; legume_cycles: number };
    advice?: string;
    source_ids?: string[];
  };
  summary: string;
  rank: number | null;
  simple?: SimpleLayer;
  decisive?: Decisive[];
}

export type SimpleLevel = "buena" | "posible" | "explorar" | "no_conviene";

export interface SimpleLayer {
  level: SimpleLevel;
  label: string;
  names: string;
  headline: string;
  tags: string[];
  facts: { margin_soles: number | null; margin_kind: string | null; water_m3: number | null; first_sowing: string | null; cycles: number };
}

export interface Decisive {
  id: "agua" | "riego" | "sal" | string;
  label: string;
  question: string;
  detail: string;
  critical_value?: number;
  unit?: string;
  answers: { label: string; patch: Record<string, string | number> }[];
  source_ids: string[];
}

export interface Association {
  id: string;
  name: string;
  structure: string;
  status: string;
  known: string[];
  missing: string[];
  source_ids: string[];
  warning: string;
}

export interface ComparisonResult {
  engine_version: string;
  catalog_version: string;
  climate_snapshot_id: string | null;
  priority: "dinero" | "agua" | "suelo" | "equilibrada";
  horizon_start: string;
  horizon_end: string;
  strategies: Strategy[];
  ordering: {
    priority: string;
    rule: string;
    ranked: string[];
    excluded: { strategy_id: string; reason: string }[];
    ties: string[];
    tradeoffs: { criterio: string; opcion: string | null }[];
  };
  associations: Association[];
  notes: string[];
  blocking: string[];
  simple_order?: string[];
  assumed?: string[];
}

export interface Run {
  id: string;
  parcel_id: string;
  revision_id: string;
  scenario_label: string | null;
  priority: string;
  statuses: Record<string, Status>;
  engine_version: string;
  catalog_version: string;
  dataset_snapshot_id: string | null;
  dataset_sha256?: string | null;
  created_at: string;
  inputs?: { profile: Profile; effective_profile?: Profile; assumed?: string[]; zone_id?: string | null; zone_version?: string | null; area_ha: number; in_pilot_zone: boolean; reference_date: string };
  result?: ComparisonResult;
  profile_changed?: boolean;
}

export interface Water {
  mode: "conozco" | "no_se";
  allocation_m3?: number | null;
  allocation_period?: "mensual" | "anual";
  efficiency?: number | null;
  delivery_point?: string | null;
  origin?: "declarado" | "supuesto_demo";
  allocation_min_m3?: number | null;
  allocation_max_m3?: number | null;
  method?: "goteo" | "aspersion" | "gravedad" | null;
}

export interface Soil {
  ece_ds_m?: number | null;
  ph?: number | null;
  organic_matter_pct?: number | null;
  analysis_date?: string | null;
  depth_cm?: string | null;
  method?: string | null;
  kind?: "observado" | "declarado" | "supuesto_demo";
  salinity_signs?: "sin_signos" | "con_signos" | null;
}

export interface Profile {
  current_crop_id: string;
  current_status: "en_campo" | "cosechado";
  expected_harvest?: string | null;
  planned_next_crop_id?: string | null;
  water: Water;
  soil: Soil;
  priority: "dinero" | "agua" | "suelo" | "equilibrada";
  budget_soles?: number | null;
  residue_management: "incorporar" | "retirar" | "no_se";
  economic_overrides?: { crop_id: string; yield_t_ha?: number | null; price_soles_kg?: number | null; variable_cost_soles_ha?: number | null }[];
  use_zone_defaults?: boolean;
}

export interface Parcel {
  id: string;
  name: string | null;
  geometry: Geometry | null;
  point: { lat: number; lon: number } | null;
  area_ha: number;
  area_origin: "geodesica" | "declarada" | "supuesto_demo";
  region_codes: { district_code?: string; district_name?: string; provider?: string; source_update?: string; note?: string };
  in_pilot_zone: boolean;
  zone_id?: string | null;
  active_revision_id: string | null;
  is_active: boolean;
  is_public_demo: boolean;
  created_at: string;
}

export interface Revision {
  id: string;
  number: number;
  profile: Profile;
  note: string | null;
  created_at: string;
}

export interface CropEvent {
  id: string;
  crop_id: string;
  status: string;
  sowing_date: string | null;
  expected_harvest: string | null;
  actual_harvest: string | null;
  variety: string | null;
  origin: string;
  created_at: string;
}

export interface SourceRec {
  id: string;
  institution: string;
  title: string;
  url: string | null;
  section: string | null;
  scope: string | null;
  kind: string;
  status: string | null;
  registry_version?: string;
  fragments?: { id: string; title: string; text: string }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider_status: string | null;
  created_at: string;
  payload: {
    detail?: string;
    metric_ids?: string[];
    sources?: SourceRec[];
    assumptions?: string[];
    missing_data?: string[];
    model?: string | null;
    validation_problems?: string[];
    fragments?: { id: string; source_id: string; title: string; text: string }[];
    profile_changed?: boolean;
    run_id?: string;
  };
}

export const CROP_LABELS: Record<string, string> = {
  maiz_grano: "Maíz amarillo duro (grano)",
  frejol_grano: "Frejol canario (grano seco)",
  cebolla_roja: "Cebolla roja",
  cebolla: "Cebolla (bulbo seco)",
  ajo: "Ajo",
  papa: "Papa",
  alfalfa: "Alfalfa",
  maiz_chala: "Maíz chala (forraje)",
  otro: "Otro cultivo",
};

export const STATUS_LABELS: Record<Status, string> = {
  viable_con_supuestos: "Viable con supuestos",
  no_viable: "No viable",
  requiere_datos: "Requiere datos",
  exploratoria: "Exploratoria",
};

export const PRIORITY_LABELS: Record<string, string> = {
  equilibrada: "Equilibrada",
  dinero: "Dinero",
  agua: "Agua",
  suelo: "Cuidado del suelo",
};

export const KIND_LABELS: Record<string, string> = {
  observado: "Observado",
  declarado: "Declarado por ti",
  derivado: "Calculado por CERES",
  referencia_bibliografica: "Referencia bibliográfica",
  supuesto_demo: "Supuesto de demostración",
  supuesto_zona: "Supuesto de zona (Majes I)",
  sin_verificar: "Sin verificar",
};
