import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Burraco Punto Online",
  description:
    "Crea una sessione di Burraco, invita gli amici e sincronizza i punteggi tra più telefoni.",
  applicationName: "Burraco Punto Online",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Burraco Online",
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
