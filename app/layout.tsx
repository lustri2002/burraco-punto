import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Punti Burraco",
  description:
    "Segnapunti Burraco locale o condiviso tra più telefoni.",
  applicationName: "Punti Burraco",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Punti Burraco",
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
