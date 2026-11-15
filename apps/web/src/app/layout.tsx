import type { Metadata, Viewport } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { SourcesProvider } from "@/components/Sources";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "CERES Majes — ¿qué cultivar después?",
  description: "Compara ciclos de cultivo para tu parcela en Majes I con datos NASA, agua, costos y suelo. La decisión es tuya.",
};

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#2f6b3a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE">
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <SessionProvider>
          <TopBar />
          <SourcesProvider>
            <main id="contenido">{children}</main>
          </SourcesProvider>
          <footer className="footer">
            CERES Majes — prototipo de apoyo a decisiones para la hackatón NASA Space Apps. No garantiza rendimientos,
            precios ni ahorro; la decisión final es del agricultor. Clima histórico NASA POWER (no pronóstico). Mapa ©
            colaboradores de OpenStreetMap; límites referenciales SERFOR/INEI.
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
