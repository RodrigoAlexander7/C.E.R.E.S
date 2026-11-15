"use client";

// Íconos simples (trazo, heredan color) y «Tip»: el ícono va primero y su significado aparece al pasar el
// mouse o al tocarlo (foco), sin llenar la pantalla de texto. Lo demás se abre con «?» bajo demanda.

import s from "./simple.module.css";

const P: Record<string, string> = {
  money: "M3 7h18v10H3V7Zm9 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6 10v4m12-4v4",
  water: "M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z",
  calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  shield: "M12 3 5 6v6c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-3Z",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z",
  check: "m5 12.5 4.2 4.2L19 7",
  question: "M9.1 9a3 3 0 1 1 4.4 2.6c-.9.5-1.5 1.2-1.5 2.2v.4M12 17.5h.01",
  explore: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z",
  cross: "M6 6l12 12M18 6 6 18",
  dots: "M6 12h.01M12 12h.01M18 12h.01",
  info: "M12 8h.01M11 12h1v5h1",
  trendUp: "m4 16 6-6 4 4 6-7m0 0h-5m5 0v5",
  trendDown: "m4 8 6 6 4-4 6 7m0 0h-5m5 0v-5",
  flat: "M4 12h16m-4-4 4 4-4 4",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12m0-12 4 4m-4-4L8 7",
  print: "M7 9V3h10v6M6 18H4v-7h16v7h-2M7 14h10v7H7v-7Z",
  sat: "M10 10l4 4M7 4 4 7l4 4 3-3-4-4Zm10 9-3 3 4 4 3-3-4-4ZM15 3a6 6 0 0 1 6 6",
  sprout: "M12 21V10m0 3c-3.5 0-5.5-2.2-5.5-5.5C10 7.5 12 9.7 12 13Zm0-1c3.5 0 5.5-2.2 5.5-5.5-3.5 0-5.5 2.2-5.5 5.5Z",
  thermo: "M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z",
  salt: "M5 19h14M7 19l2-8h6l2 8M10 7h4M12 3v4",
};

export function Icon({ name, size = 18, className }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={P[name] ?? P.info} />
    </svg>
  );
}

/** Ícono + valor con su explicación al pasar el mouse o al tocar (foco). */
export function Tip({ tip, children, className }: { tip: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={`${s.tip} ${className ?? ""}`} tabIndex={0} data-tip={tip} aria-label={tip} role="note">
      {children}
    </span>
  );
}

/** Botón redondo «?» que abre más información bajo demanda. */
export function MoreButton({ onClick, label = "Ver más" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className={s.moreBtn} onClick={onClick} aria-label={label} title={label}>
      <Icon name="question" size={18} /><span>{label}</span>
    </button>
  );
}

const CROP: Record<string, { c: string; l: string }> = {
  maiz_grano: { c: "#d9a53a", l: "M" }, frejol_grano: { c: "#5b9a45", l: "F" }, cebolla_roja: { c: "#a2456f", l: "C" }, cebolla: { c: "#a2456f", l: "C" },
  papa: { c: "#8a6a3f", l: "P" }, ajo: { c: "#7d6aa8", l: "A" }, arveja_verde: { c: "#3f8f6a", l: "Ar" }, zanahoria: { c: "#d9772f", l: "Z" },
  alfalfa: { c: "#6b9a3a", l: "Al" }, maiz_chala: { c: "#b8932f", l: "Mc" },
};

export function cropColor(id: string): string {
  return CROP[id]?.c ?? "#888";
}

/** Secuencia de cultivos como fichas de color (se leen de un vistazo, sin frases). */
export function CropSeq({ ids, label }: { ids: string[]; label: (id: string) => string }) {
  return (
    <span className={s.cropSeq} aria-hidden="true">
      {ids.map((id, i) => (
        <span key={i} className={s.cropSeqItem}>
          {i > 0 && <span className={s.cropArrow}>›</span>}
          <span className={s.cropDot} style={{ background: cropColor(id) }} title={label(id)}>{CROP[id]?.l ?? label(id).slice(0, 1).toUpperCase()}</span>
        </span>
      ))}
    </span>
  );
}
