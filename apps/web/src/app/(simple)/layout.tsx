"use client";

// Una sola aplicación, sencilla por defecto y por módulos. El detalle técnico se abre con «Ver más»
// dentro de cada módulo; ya no hay un «modo avanzado» aparte (decisión del 15-nov-2026).

import Link from "next/link";
import { usePathname } from "next/navigation";
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

const ICONS: Record<string, string> = {
  sembrar: "M12 21V9m0 3c-3.5 0-5.5-2.2-5.5-5.5C10 6.5 12 8.7 12 12Zm0 3c3.5 0 5.5-2.2 5.5-5.5C14 9.5 12 11.7 12 15Z",
  cuando: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4 9 2 2 4-4",
  chacra: "M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7Zm6-3v13m6-10v13",
};

const MODULES = [
  { href: "/app", label: "Qué sembrar", icon: "sembrar" },
  { href: "/app/cuando", label: "Cuándo sembrar", icon: "cuando" },
  { href: "/app/chacra", label: "Mi chacra", icon: "chacra" },
];

export default function SimpleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useSession();
  const path = usePathname();
  const inApp = path === "/app" || path.startsWith("/app/");
  return (
    <div className={s.shell}>
      <header className={s.top}>
        <div className={s.topInner}>
          <Link href="/" className={s.brand}><Mark /> CERES</Link>
          {inApp && (
            <nav className={s.modTop} aria-label="Módulos">
              {MODULES.map((m) => (
                <Link key={m.href} href={m.href} className={s.modTopLink} aria-current={path === m.href ? "page" : undefined}>{m.label}</Link>
              ))}
            </nav>
          )}
          <nav className={s.topLinks} aria-label="Cuenta">
            {!inApp && <Link href="/app" className={s.topLink}>Abrir CERES</Link>}
            {!loading && (user ? <button className={`${s.topLink} ${s.linkBtn}`} style={{ textDecoration: "none" }} onClick={logout}>Salir</button> : <Link href={`/ingresar?volver=${inApp ? path : "/app"}`} className={s.topLink}>Ingresar</Link>)}
          </nav>
        </div>
      </header>
      <main id="contenido" className={s.main}>{children}</main>
      {inApp && (
        <nav className={s.modBottom} aria-label="Módulos">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className={s.modBottomLink} aria-current={path === m.href ? "page" : undefined}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[m.icon]} /></svg>
              {m.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
