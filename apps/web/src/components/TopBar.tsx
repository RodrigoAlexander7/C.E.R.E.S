"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./SessionProvider";

const LINKS = [
  { href: "/avanzado", label: "Modo avanzado" },
  { href: "/demo", label: "Caso demo" },
  { href: "/parcelas", label: "Mis parcelas", private: true },
  { href: "/fuentes", label: "Fuentes" },
];

export function TopBar() {
  const path = usePathname();
  const { user, loading, logout } = useSession();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          CERES <small>Majes</small>
        </Link>
        <nav className="nav" aria-label="Principal">
          {LINKS.filter((l) => !l.private || user).map((l) => (
            <Link key={l.href} href={l.href} aria-current={path === l.href || (l.href !== "/" && path.startsWith(l.href)) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
          {loading ? null : user ? (
            <>
              <span className="small muted" title="Sesión iniciada">
                {user.email}
              </span>
              <button className="btn-secondary" onClick={logout}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <Link href="/ingresar" className="btn btn-primary" style={{ color: "#fff" }}>
              Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
