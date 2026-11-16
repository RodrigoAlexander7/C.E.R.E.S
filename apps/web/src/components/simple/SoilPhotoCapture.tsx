"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import s from "./simple.module.css";

export interface SoilPhotoAssessment {
  salinity_signs: "con_signos" | "sin_signos" | "no_concluyente";
  description: string;
  limitations: string;
  source: "gemini_visual";
}

export interface SoilPhotoCaptureProps {
  onApply: (analysis: SoilPhotoAssessment) => void;
  disabled?: boolean;
}

interface PreparedPhoto { id: number; blob: Blob; url: string }
const MAX_SEND_BYTES = 5_000_000;
const MAX_PHOTO_BYTES = 850_000; // cuatro fotos + base64 + JSON caben en 5 MB
const MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const LABELS = {
  con_signos: "Se ven indicios compatibles con sales",
  sin_signos: "No se aprecian signos claros en estas fotos",
  no_concluyente: "No se puede concluir con estas fotos",
};

async function compress(file: File): Promise<Blob> {
  if (!MIMES.has(file.type)) throw new Error("Elige fotos JPEG, PNG o WebP.");
  if (!file.size || file.size > 20_000_000) throw new Error("Cada foto original debe ocupar como máximo 20 MB.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo abrir una foto. Prueba otra o indica los signos manualmente."));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50_000_000) {
      throw new Error("La foto es demasiado grande. Recórtala antes de elegirla.");
    }
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la foto en este navegador.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Canvas codifica solo píxeles: no copia EXIF, GPS, nombre ni miniaturas.
    try {
      for (const quality of [0.82, 0.68, 0.5, 0.35]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= MAX_PHOTO_BYTES) return blob;
      }
      throw new Error("La foto sigue siendo muy grande. Prueba un recorte o indica los signos manualmente.");
    } finally {
      canvas.width = canvas.height = 1;
    }
  } finally {
    image.src = "";
    URL.revokeObjectURL(url);
  }
}

async function encode(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("No se pudo preparar el envío. Tus fotos siguen disponibles."));
    reader.readAsDataURL(blob);
  });
}

function validAssessment(value: unknown): value is SoilPhotoAssessment {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 4 && typeof v.salinity_signs === "string" && Object.hasOwn(LABELS, v.salinity_signs)
    && typeof v.description === "string" && v.description.trim().length > 0 && v.description.length <= 320
    && typeof v.limitations === "string" && v.limitations.trim().length > 0 && v.limitations.length <= 600
    && v.source === "gemini_visual";
}

export function SoilPhotoCapture({ onApply, disabled = false }: SoilPhotoCaptureProps) {
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [busy, setBusy] = useState<"preparing" | "sending" | null>(null);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<SoilPhotoAssessment | null>(null);
  const [applied, setApplied] = useState(false);
  const current = useRef<PreparedPhoto[]>([]);
  const generation = useRef(0);
  const working = useRef(false);
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);
  const resultTitle = useRef<HTMLHeadingElement>(null);
  const id = useId();

  useEffect(() => () => {
    generation.current += 1;
    request.current?.abort();
    current.current.forEach(photo => URL.revokeObjectURL(photo.url));
  }, []);
  useEffect(() => { if (analysis) resultTitle.current?.focus(); }, [analysis]);
  useEffect(() => {
    if (disabled) {
      generation.current += 1;
      request.current?.abort();
      working.current = false;
      setBusy(null);
    }
  }, [disabled]);

  const choose = async (files: FileList | null) => {
    if (!files?.length || disabled || working.current) return;
    if (files.length + current.current.length > 4) {
      setError("Puedes elegir hasta cuatro fotos. Quita alguna antes de agregar más.");
      return;
    }
    const token = ++generation.current;
    working.current = true;
    setBusy("preparing"); setError(""); setAnalysis(null); setApplied(false);
    const prepared: PreparedPhoto[] = [];
    try {
      for (const file of Array.from(files)) {
        const blob = await compress(file);
        if (token !== generation.current) return;
        prepared.push({ id: sequence.current++, blob, url: URL.createObjectURL(blob) });
      }
      current.current = [...current.current, ...prepared];
      setPhotos(current.current);
    } catch (e) {
      if (token === generation.current) setError(e instanceof Error ? e.message : "No se pudieron preparar las fotos.");
    } finally {
      // Si se cancela o falla, liberar también los previews parcialmente preparados.
      prepared.filter(photo => !current.current.includes(photo)).forEach(photo => URL.revokeObjectURL(photo.url));
      if (token === generation.current) { working.current = false; setBusy(null); }
    }
  };

  const remove = (photo: PreparedPhoto) => {
    if (disabled || working.current) return;
    URL.revokeObjectURL(photo.url);
    current.current = current.current.filter(p => p.id !== photo.id);
    setPhotos(current.current); setAnalysis(null); setApplied(false); setError("");
  };

  const send = async () => {
    if (disabled || working.current || !current.current.length) return;
    const token = ++generation.current;
    working.current = true;
    setBusy("sending"); setError(""); setAnalysis(null); setApplied(false);
    const controller = new AbortController();
    request.current = controller;
    // Incluye el reintento/respaldo del SDK sin dejar una espera indefinida en la UI.
    const timer = setTimeout(() => controller.abort(), 70_000);
    try {
      const images = [];
      for (const photo of current.current) images.push({ mime: "image/jpeg", data_base64: await encode(photo.blob) });
      if (token !== generation.current) return;
      const body = JSON.stringify({ images });
      if (new Blob([body]).size > MAX_SEND_BYTES) throw new Error("El envío supera 5 MB. Quita una foto y vuelve a intentar.");
      const result = await api<unknown>("/public/soil-photos", {
        method: "POST", headers: { "Content-Type": "application/json" }, body, signal: controller.signal,
      });
      if (!validAssessment(result)) throw new Error("La IA devolvió un resultado incompleto. Puedes indicar los signos manualmente.");
      if (token === generation.current) setAnalysis(result);
    } catch (e) {
      if (token === generation.current) setError(controller.signal.aborted
        ? "La consulta tardó demasiado. Tus fotos se conservan para reintentar; también puedes indicar los signos manualmente."
        : e instanceof ApiError || e instanceof Error ? e.message : "No se pudo observar las fotos. Puedes seguir manualmente.");
    } finally {
      clearTimeout(timer);
      if (token === generation.current) { working.current = false; setBusy(null); request.current = null; }
    }
  };

  return <section aria-labelledby={`${id}-title`} aria-busy={busy !== null} className={s.photoCapture}>
    <h3 id={`${id}-title`}>Observar el suelo con fotos (opcional)</h3>
    <p id={`${id}-help`}>Elige de una a cuatro fotos del suelo, con luz y enfoque: una vista general y detalles. JPEG, PNG o WebP; original hasta 20 MB por foto. Se reducen a 1280 píxeles y el envío ocupa hasta 5 MB.</p>
    <p>Es observación visual por IA, <strong>no un análisis de suelo</strong>. Una foto no confirma ni descarta salinidad ni mide nutrientes. Se envían a Gemini sin metadatos; CERES no guarda las fotos.</p>
    <fieldset disabled={disabled || busy !== null} className={s.photoInputs}>
      <legend className={s.srOnly}>Elegir fotos del suelo</legend>
      <label><span>Elegir fotos</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-describedby={`${id}-help`} onChange={e => { const files = e.currentTarget.files; void choose(files); e.currentTarget.value = ""; }} /></label>
      <label><span>Tomar una foto con la cámara</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-describedby={`${id}-help`} onChange={e => { const files = e.currentTarget.files; void choose(files); e.currentTarget.value = ""; }} /></label>
    </fieldset>
    {photos.length > 0 && <ul aria-label="Fotos preparadas para observar" className={s.photoPreviews}>
      {photos.map((photo, index) => <li key={photo.id}>
        {/* Previews locales efímeros: no pasan por optimizadores ni cachés de imágenes. */}
        <img src={photo.url} alt={`Foto de campo ${index + 1} preparada para observar`} width={160} height={120} />
        <button type="button" className={`${s.btn} ${s.btnGhost}`} aria-label={`Quitar foto ${index + 1}`} disabled={disabled || busy !== null} onClick={() => remove(photo)}>Quitar foto {index + 1}</button>
      </li>)}
    </ul>}
    <p role="status" aria-live="polite">{busy === "preparing" ? "Preparando fotos sin metadatos…" : busy === "sending" ? "La IA está observando las fotos…" : photos.length ? `${photos.length} de 4 fotos listas.` : "Todavía no elegiste fotos."}</p>
    {error && <p role="alert" className={s.photoError}>{error}</p>}
    <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={disabled || busy !== null || !photos.length} onClick={() => void send()}>Observar fotos con IA</button>
    {analysis && <div className={s.photoObservation}>
      <h4 ref={resultTitle} tabIndex={-1}>{LABELS[analysis.salinity_signs]}</h4>
      <p>{analysis.description}</p>
      <p>{analysis.limitations}</p>
      <p>Observación visual por IA. No confirma ni descarta salinidad. Revisa el resultado antes de usarlo.</p>
      <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={disabled || applied || busy !== null} onClick={() => { if (!disabled && !applied) { onApply(analysis); setApplied(true); } }}>Usar observación</button>
      {applied && <p role="status">Observación elegida.</p>}
    </div>}
    <p>También puedes indicar los signos de sal manualmente o elegir “No sé”. Si la foto no permite concluir, conserva esa incertidumbre.</p>
  </section>;
}

export default SoilPhotoCapture;
