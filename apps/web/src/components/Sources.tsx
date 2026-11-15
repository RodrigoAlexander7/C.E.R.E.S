"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { KIND_LABELS, type SourceRec } from "@/lib/types";

const Ctx = createContext<(id: string) => void>(() => {});

export function useOpenSource() {
  return useContext(Ctx);
}

export function SourcesProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [src, setSrc] = useState<SourceRec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (id: string) => {
    setError(null);
    setSrc(null);
    setLoading(true);
    ref.current?.showModal();
    try {
      setSrc(await api<SourceRec>(`/sources/${encodeURIComponent(id)}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo abrir la fuente");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Ctx.Provider value={open}>
      {children}
      <dialog ref={ref} aria-labelledby="src-title" onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="dialog-body stack">
          <div className="dialog-head">
            <h2 id="src-title">{src ? src.title : "Fuente"}</h2>
            <button className="btn-secondary" onClick={() => ref.current?.close()} aria-label="Cerrar">Cerrar</button>
          </div>
          {loading && <p className="muted">Cargando…</p>}
          {error && <div className="notice notice-bad">{error}</div>}
          {src && <SourceBody src={src} />}
        </div>
      </dialog>
    </Ctx.Provider>
  );
}

export function SourceBody({ src }: { src: SourceRec }) {
  return (
    <div className="stack">
      <dl className="kv">
        <dt>ID</dt><dd><code>{src.id}</code></dd>
        <dt>Institución</dt><dd>{src.institution}</dd>
        <dt>Tipo</dt><dd><span className={`tag tag-${src.kind}`}>{KIND_LABELS[src.kind] ?? src.kind}</span></dd>
        {src.section && <><dt>Sección</dt><dd>{src.section}</dd></>}
        {src.scope && <><dt>Ámbito</dt><dd>{src.scope}</dd></>}
        {src.status && <><dt>Estado</dt><dd>{src.status}</dd></>}
        {src.registry_version && <><dt>Registro</dt><dd>{src.registry_version}</dd></>}
      </dl>
      {src.url && (
        <p>
          <a href={src.url} target="_blank" rel="noreferrer noopener">Abrir documento original ↗</a>
        </p>
      )}
      {src.fragments && src.fragments.length > 0 && (
        <div>
          <h3>Fichas de la aplicación basadas en esta fuente</h3>
          {src.fragments.map((f) => (
            <details key={f.id}>
              <summary>{f.title}</summary>
              <p>{f.text}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

export function SourceChips({ ids }: { ids: string[] }) {
  const open = useOpenSource();
  if (!ids?.length) return null;
  return (
    <span>
      {Array.from(new Set(ids)).map((id) => (
        <button key={id} className="source-chip" onClick={() => open(id)} title="Ver fuente">
          {id}
        </button>
      ))}
    </span>
  );
}

export function useNasaContext() {
  const [ctx, setCtx] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api<Record<string, unknown>>("/public/context").then(setCtx).catch(() => setCtx(null));
  }, []);
  return ctx;
}
