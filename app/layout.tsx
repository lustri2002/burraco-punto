import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Burraco Punto — segnapunti per il tuo tavolo",
  description:
    "Conta carte, bonus e penalità. Il punteggio della partita di Burraco si aggiorna da solo.",
  applicationName: "Burraco Punto",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Burraco Punto",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#153f32",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
