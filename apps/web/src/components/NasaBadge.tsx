// Sello «con datos de la NASA»: dice qué producto, qué período y qué resolución, y enlaza a /fuentes.
// Solo texto y un ícono propio de satélite: nunca el logo de la NASA.

import Link from "next/link";
import { NASA, type NasaProduct } from "@/lib/nasa";
import n from "./nasa.module.css";

export function SatIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="rotate(-45 12 12)">
        <rect x="9.5" y="8.5" width="5" height="7" rx="1" />
        <rect x="2.5" y="10" width="5" height="4" rx="0.5" />
        <rect x="16.5" y="10" width="5" height="4" rx="0.5" />
        <path d="M7.5 12h2M14.5 12h2" />
      </g>
      <path d="M16 3.5a4.5 4.5 0 0 1 4.5 4.5" />
    </svg>
  );
}

export function NasaBadge({ product, variant = "chip", detail, className }: { product: NasaProduct; variant?: "chip" | "block" | "micro"; detail?: string; className?: string }) {
  const p = NASA[product];
  const href = `/fuentes#nasa-${p.id}`;
  if (variant === "micro") {
    return (
      <Link href={href} className={`${n.micro} ${className ?? ""}`} title={`${p.name} · ${detail ?? p.detail}`}>
        <SatIcon size={11} />{p.name}
      </Link>
    );
  }
  if (variant === "block") {
    return (
      <Link href={href} className={`${n.block} ${className ?? ""}`}>
        <span className={n.blockIcon}><SatIcon size={18} /></span>
        <span>
          <b>Con datos de {p.name}</b>
          <small>{detail ?? p.detail}</small>
          <span className={n.use}>{p.use}</span>
        </span>
      </Link>
    );
  }
  return (
    <Link href={href} className={`${n.chip} ${className ?? ""}`}>
      <SatIcon />
      <b>{p.name}</b>
      <span>{detail ?? p.detail}</span>
    </Link>
  );
}

/** Pie común: qué datos usa CERES (NASA y no NASA, cada uno con su nombre). */
export function DataFooter() {
  return (
    <p className={n.footer}>
      Datos: <Link href="/fuentes#nasa-power">NASA POWER</Link> · <Link href="/fuentes#nasa-hls">NASA HLS</Link> · <Link href="/fuentes#nasa-gibs">NASA GIBS</Link> · <Link href="/fuentes">MIDAGRI-SISAP</Link> · <Link href="/fuentes">FAO</Link> · <Link href="/fuentes">NOAA</Link>.
      {" "}CERES no está respaldado por la NASA; usa sus datos abiertos.
    </p>
  );
}
