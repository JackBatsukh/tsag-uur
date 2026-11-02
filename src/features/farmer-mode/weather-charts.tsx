import type { AgriculturalForecastDay } from "./types";

interface WeatherChartsProps {
  readonly days: readonly AgriculturalForecastDay[];
}

function shortDate(value: string): string {
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
}

function linePoints(values: readonly number[], minimum: number, maximum: number): string {
  const span = Math.max(1, maximum - minimum);
  return values
    .map((value, index) => {
      const x = 28 + (index * 304) / Math.max(1, values.length - 1);
      const y = 108 - ((value - minimum) / span) * 82;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function WeatherCharts({ days }: WeatherChartsProps) {
  const minimums = days.map((day) => day.minimumTemperatureC);
  const maximums = days.map((day) => day.maximumTemperatureC);
  const temperatureMinimum = Math.floor(Math.min(...minimums, 0) - 2);
  const temperatureMaximum = Math.ceil(Math.max(...maximums, 1) + 2);
  const rainMaximum = Math.max(1, ...days.map((day) => day.precipitationMm));

  return (
    <div className="farmer-charts">
      <figure className="farmer-chart">
        <figcaption>
          <strong>Температурын хүрээ</strong>
          <span>Өдрийн минимум ба максимум · °C</span>
        </figcaption>
        <svg viewBox="0 0 360 145" role="img" aria-label="Долоон өдрийн minimum болон maximum температурын шугаман график">
          <path d="M28 26V108H332" className="chart-axis" />
          <polyline points={linePoints(maximums, temperatureMinimum, temperatureMaximum)} className="chart-line chart-line--maximum" />
          <polyline points={linePoints(minimums, temperatureMinimum, temperatureMaximum)} className="chart-line chart-line--minimum" />
          {days.map((day, index) => {
            const x = 28 + (index * 304) / Math.max(1, days.length - 1);
            return <text key={day.id} x={x} y="132" textAnchor="middle">{shortDate(day.validDate)}</text>;
          })}
        </svg>
        <p className="chart-legend"><span className="chart-key chart-key--maximum" /> Максимум <span className="chart-key chart-key--minimum" /> Минимум</p>
      </figure>

      <figure className="farmer-chart">
        <figcaption>
          <strong>7 хоногийн хур тунадас</strong>
          <span>Өдөр тутмын interval хэмжээ · мм</span>
        </figcaption>
        <svg viewBox="0 0 360 145" role="img" aria-label="Долоон өдрийн хур тунадасны баганан график">
          <path d="M28 26V108H332" className="chart-axis" />
          {days.map((day, index) => {
            const slot = 304 / Math.max(1, days.length);
            const height = (day.precipitationMm / rainMaximum) * 76;
            const x = 31 + index * slot;
            return (
              <g key={day.id}>
                <rect x={x} y={108 - height} width={Math.max(10, slot - 9)} height={height} rx="3" className="chart-rain-bar" />
                <text x={x + Math.max(10, slot - 9) / 2} y="132" textAnchor="middle">{shortDate(day.validDate)}</text>
              </g>
            );
          })}
        </svg>
        <p className="chart-note">Магадлал биш; өдөр тутмын deterministic demo хэмжээнүүдийн нийлбэрийг ашиглана.</p>
      </figure>

      <table className="sr-only">
        <caption>Долоон өдрийн температур ба хур тунадасны хүснэгтэн хувилбар</caption>
        <thead><tr><th>Огноо</th><th>Минимум °C</th><th>Максимум °C</th><th>Хур тунадас мм</th></tr></thead>
        <tbody>{days.map((day) => <tr key={day.id}><td>{day.validDate}</td><td>{day.minimumTemperatureC}</td><td>{day.maximumTemperatureC}</td><td>{day.precipitationMm}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
