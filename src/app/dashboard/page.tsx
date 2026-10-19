import type { Metadata } from "next";

import { AppHeader } from "@/components/app-header";
import { DataTransparency } from "@/components/data-transparency";
import { DemoNotice } from "@/components/demo-notice";
import { HourlyForecast } from "@/components/hourly-forecast";
import { ModelMetadataPanel } from "@/components/model-metadata";
import { SiteFooter } from "@/components/site-footer";
import { WeatherOverview } from "@/components/weather-overview";
import { demoForecast } from "@/lib/demo-forecast";

export const metadata: Metadata = {
  title: "Текстэн хяналтын самбар",
  description: "Tsag-uur-ийн хүртээмжтэй текстэн demo цаг агаарын хяналтын самбар.",
};

export default function DashboardPage() {
  return (
    <div className="app-frame" id="top">
      <a className="skip-link" href="#main-content">
        Үндсэн агуулга руу алгасах
      </a>
      <AppHeader />

      <main className="page-shell dashboard-main" id="main-content">
        <DemoNotice disclaimer={demoForecast.disclaimer} />
        <WeatherOverview forecast={demoForecast} />
        <HourlyForecast entries={demoForecast.hourly} />
        <ModelMetadataPanel
          metadata={demoForecast.metadata}
          location={demoForecast.location}
        />
        <DataTransparency />
      </main>

      <SiteFooter />
    </div>
  );
}
