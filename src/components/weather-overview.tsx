import type { ReactNode } from "react";

import {
  ClockIcon,
  DropletIcon,
  HumidityIcon,
  LocationIcon,
  WeatherGlyph,
  WindIcon,
} from "@/components/icons";
import type { DashboardForecast, ForecastMetric } from "@/types/weather";

interface WeatherOverviewProps {
  readonly forecast: DashboardForecast;
}

const metricIcons: readonly ReactNode[] = [
  <WindIcon key="wind" />,
  <DropletIcon key="precipitation" />,
  <HumidityIcon key="humidity" />,
];

function MetricCard({ metric, icon }: { readonly metric: ForecastMetric; readonly icon: ReactNode }) {
  return (
    <article className="metric-card">
      <div className="metric-card__icon">{icon}</div>
      <div>
        <p className="metric-card__label">{metric.label}</p>
        <p className="metric-card__value">
          {metric.value}
          {metric.unit ? <span>{metric.unit}</span> : null}
        </p>
        <p className="metric-card__detail">{metric.detail}</p>
      </div>
    </article>
  );
}

export function WeatherOverview({ forecast }: WeatherOverviewProps) {
  const { current, location, metadata } = forecast;

  return (
    <section className="overview-section" id="overview" aria-labelledby="overview-title">
      <div className="section-heading section-heading--hero">
        <div>
          <p className="eyebrow">Хяналтын самбар</p>
          <h1 id="overview-title">Цаг агаарын тойм</h1>
          <p className="section-heading__description">
            Сонгосон загварын цэгийн төлөв, ойрын цагуудын өөрчлөлтийг нэг дороос харна.
          </p>
        </div>
        <p className="updated-time">
          <ClockIcon />
          Шинэчилсэн: <time dateTime="2026-10-18T21:45:00+08:00">{forecast.generatedLabel}</time>
        </p>
      </div>

      <div className="overview-grid">
        <article className="current-weather-card">
          <div className="current-weather-card__topline">
            <div className="location-block">
              <LocationIcon />
              <div>
                <p className="location-block__name">{location.name}</p>
                <p>{location.administrativeArea}</p>
              </div>
            </div>
            <span className="demo-chip">Зохиомол жишээ</span>
          </div>

          <div className="current-weather-card__main">
            <div>
              <div className="temperature-reading">
                <span className="temperature-reading__value">{current.temperature}</span>
                <span className="temperature-reading__unit">°C</span>
              </div>
              <p className="condition-label">{current.condition}</p>
              <p className="feels-like">Мэдрэгдэх нь {current.apparentTemperature}°</p>
            </div>
            <div className="current-weather-card__visual">
              <WeatherGlyph symbol={current.symbol} />
              <p>
                <span>Их {current.high}°</span>
                <span className="temperature-divider" aria-hidden="true" />
                <span>Бага {current.low}°</span>
              </p>
            </div>
          </div>

          <div className="validity-strip">
            <ClockIcon />
            <p>
              <span>Хүчинтэй хугацаа</span>
              <time dateTime={metadata.validFrom}>{metadata.validPeriodLabel}</time>
            </p>
          </div>
        </article>

        <div className="metrics-grid" aria-label="Цаг агаарын үндсэн үзүүлэлтүүд">
          {forecast.metrics.map((metric, index) => (
            <MetricCard key={metric.label} metric={metric} icon={metricIcons[index]} />
          ))}
        </div>
      </div>
    </section>
  );
}
