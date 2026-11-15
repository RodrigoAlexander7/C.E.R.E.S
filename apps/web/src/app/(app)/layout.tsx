import { TopBar } from "@/components/TopBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main id="contenido">{children}</main>
      <footer className="footer">
        CERES Majes — prototipo de apoyo a decisiones para la hackatón NASA Space Apps. No garantiza rendimientos, precios
        ni ahorro; la decisión final es del agricultor. Clima histórico NASA POWER (no pronóstico). Mapa © colaboradores
        de OpenStreetMap; límites referenciales SERFOR/INEI.
      </footer>
    </>
  );
}
