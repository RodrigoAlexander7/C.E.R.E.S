"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DRAFT_KEY, useSession } from "@/components/SessionProvider";
import { ApiError, api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const back = params.get("volver");
  const safeBack = back && back.startsWith("/") && !back.startsWith("//") ? back : "/app";
  let hasDraft = false;
  try {
    hasDraft = typeof window !== "undefined" && !!sessionStorage.getItem(DRAFT_KEY);
  } catch {}

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(mode === "login" ? "/auth/login" : "/auth/register", { method: "POST", json: { email, password } });
      await refresh();
      router.push(hasDraft ? "/avanzado" : safeBack);
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setError(err.details.map((d) => (d.field === "password" ? "La contraseña debe tener al menos 8 caracteres" : d.field === "email" ? "Email no válido" : d.message)).join(". "));
      else setError(err instanceof ApiError ? err.message : "No se pudo continuar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "2rem auto" }} className="card">
      <h1>{mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}</h1>
      <p className="muted">Con una cuenta guardas tus parcelas, su historial, tus comparaciones y tus preguntas al asistente. Nadie más puede verlas.</p>
      {hasDraft && <div className="notice notice-info" style={{ marginBottom: "1rem" }}>Tu terreno y respuestas se conservan; al entrar podrás guardarlos.</div>}
      <form onSubmit={submit} className="stack" noValidate>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password">Contraseña <span className="hint">Mínimo 8 caracteres</span></label>
          <input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="notice notice-bad" role="alert">{error}</div>}
        <button className="btn-primary" type="submit" disabled={busy}>{busy ? "Un momento…" : mode === "login" ? "Ingresar" : "Crear cuenta"}</button>
      </form>
      <p style={{ marginTop: "1rem" }}>
        {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
        <button className="linklike" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
          {mode === "login" ? "Regístrate" : "Inicia sesión"}
        </button>
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
