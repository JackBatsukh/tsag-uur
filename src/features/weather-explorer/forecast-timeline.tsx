import type { WeatherTimeStep } from "@/features/weather-data";

import {
  ChevronIcon,
  PauseIcon,
  PlayIcon,
} from "./explorer-icons";

interface ForecastTimelineProps {
  readonly timeSteps: readonly WeatherTimeStep[];
  readonly activeIndex: number;
  readonly isPlaying: boolean;
  readonly onActiveIndexChange: (index: number) => void;
  readonly onPlayingChange: (playing: boolean) => void;
}

export function ForecastTimeline({
  timeSteps,
  activeIndex,
  isPlaying,
  onActiveIndexChange,
  onPlayingChange,
}: ForecastTimelineProps) {
  const active = timeSteps[activeIndex];
  const maximum = Math.max(0, timeSteps.length - 1);

  return (
    <section className="forecast-timeline" aria-labelledby="timeline-title">
      <div className="timeline-now">
        <span id="timeline-title">Хүчинтэй цаг</span>
        <strong>{active?.labelMn ?? "—"}</strong>
        <small>ULAT · Зохиомол</small>
      </div>

      <div className="timeline-controls">
        <button
          type="button"
          onClick={() => onPlayingChange(!isPlaying)}
          aria-label={isPlaying ? "Цагийн хөдөлгөөнийг түр зогсоох" : "Цагийн хөдөлгөөнийг тоглуулах"}
          aria-pressed={isPlaying}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          onClick={() => onActiveIndexChange(Math.max(0, activeIndex - 1))}
          disabled={activeIndex === 0}
          aria-label="Өмнөх цаг"
        >
          <ChevronIcon className="timeline-chevron--back" />
        </button>
      </div>

      <div className="timeline-slider">
        <label className="sr-only" htmlFor="forecast-time-range">
          Forecast demo цаг сонгох
        </label>
        <input
          id="forecast-time-range"
          type="range"
          min={0}
          max={maximum}
          step={1}
          value={activeIndex}
          onChange={(event) => onActiveIndexChange(Number(event.target.value))}
          aria-valuetext={active?.labelMn}
          style={{ "--timeline-progress": `${maximum === 0 ? 0 : (activeIndex / maximum) * 100}%` } as React.CSSProperties}
        />
        <div className="timeline-labels" aria-hidden="true">
          {timeSteps.filter((_, index) => index % 6 === 0).map((step) => (
            <span key={step.id}>{step.labelMn.split(" · ")[1]}</span>
          ))}
        </div>
      </div>

      <button
        className="timeline-next"
        type="button"
        onClick={() => onActiveIndexChange(Math.min(maximum, activeIndex + 1))}
        disabled={activeIndex === maximum}
        aria-label="Дараагийн цаг"
      >
        <ChevronIcon />
      </button>
    </section>
  );
}
