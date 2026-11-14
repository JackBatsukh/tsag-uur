import type { Metadata, Viewport } from "next";

import "./globals.css";

import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";

export const metadata: Metadata = {
  title: {
    default: "Tsag-uur — Монголын цаг агаарын интерактив зураг",
    template: "%s | Tsag-uur",
  },
  description:
    "Монгол орны NOAA GFS урьдчилсан төлөв, салхи, хур тунадас, цасыг интерактив газрын зураг дээр үзүүлэх Tsag-uur платформ.",
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
  const webVitalsEndpoint = process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT;

  return (
    <html lang="mn">
      <body>
        {children}
        <ServiceWorkerRegistration />
        {webVitalsEndpoint?.startsWith("/") ? (
          <WebVitalsReporter endpoint={webVitalsEndpoint} />
        ) : null}
      </body>
    </html>
  );
}
