import type { Metadata, Viewport } from "next";

import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "../features/weather-explorer/explorer.css";
import "../features/herder-mode/herder.css";

export const metadata: Metadata = {
  title: {
    default: "Tsag-uur — Монголын цаг агаарын интерактив зураг",
    template: "%s | Tsag-uur",
  },
  description:
    "Монгол орны synthetic цаг агаарын өгөгдлийг интерактив газрын зураг дээр шинжлэх Tsag-uur платформын хөгжүүлэлтийн demo.",
  applicationName: "Tsag-uur",
  keywords: [
    "Монгол цаг агаар",
    "цаг уур",
    "weather intelligence",
    "Tsag-uur",
  ],
  authors: [{ name: "Tsag-uur" }],
  creator: "Tsag-uur",
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#102633",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
