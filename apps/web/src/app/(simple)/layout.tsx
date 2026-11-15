"use client";

import Link from "next/link";
import { useSession } from "@/components/SessionProvider";
import s from "@/components/simple/simple.module.css";

function Mark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#1f4d2b" />
      <path d="M16 25V12" stroke="#f6f1e6" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 15c-4 0-6-2.5-6-6 4 0 6 2.5 6 6Zm0 4c4 0 6-2.5 6-6-4 0-6 2.5-6 6Z" fill="#d9a53a" />
    </svg>
  );
}

export default function SimpleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useSession();
  return (
    <div className={s.shell}>
      <header className={s.top}>
        <div className={s.topInner}>
          <Link href="/" className={s.brand}><Mark /> CERES</Link>
          <nav className={s.topLinks} aria-label="Modo">
            <Link href="/avanzado" className={s.topLink}>Modo avanzado</Link>
            {!loading && (user ? <button className={`${s.topLink} ${s.linkBtn}`} style={{ textDecoration: "none" }} onClick={logout}>Salir</button> : <Link href="/ingresar?volver=/app" className={s.topLink}>Ingresar</Link>)}
          </nav>
        </div>
      </header>
      <main id="contenido" className={s.main}>{children}</main>
    </div>
  );
}
