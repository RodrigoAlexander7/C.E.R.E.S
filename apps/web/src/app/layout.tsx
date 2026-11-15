import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { SourcesProvider } from "@/components/Sources";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  title: "CERES Majes — decide qué sembrar con datos de la NASA",
  description:
    "Compara qué sembrar después en tu chacra de Majes con clima histórico de la NASA, agua, suelo y tus propias cuentas. Opciones claras primero, el porqué después. La decisión es tuya.",
};

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#1f4d2b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <SessionProvider>
          <SourcesProvider>{children}</SourcesProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
