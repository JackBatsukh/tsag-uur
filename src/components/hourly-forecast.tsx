import { ClockIcon, WeatherGlyph } from "@/components/icons";
import type { HourlyForecastEntry } from "@/types/weather";

interface HourlyForecastProps {
  readonly entries: readonly HourlyForecastEntry[];
}

export function HourlyForecast({ entries }: HourlyForecastProps) {
  return (
    <section className="panel-section" id="hourly" aria-labelledby="hourly-title">
      <div className="section-heading section-heading--panel">
        <div>
          <p className="eyebrow">Ойрын 6 цаг</p>
          <h2 id="hourly-title">Цаг тутмын төлөв</h2>
        </div>
        <p className="section-note">
          <ClockIcon />
          Улаанбаатарын цагаар
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="data-state data-state--empty" role="status">
          <p className="data-state__title">Цаг тутмын өгөгдөл алга</p>
          <p>Сонгосон хугацаанд харуулах утга одоогоор байхгүй байна.</p>
        </div>
      ) : (
        <div
          className="table-scroll"
          role="region"
          aria-label="Цаг тутмын төлөвийн хүснэгт, хэвтээ чиглэлд гүйлгэх боломжтой"
          tabIndex={0}
        >
          <table className="forecast-table">
            <caption className="sr-only">
              Зохиомол цаг тутмын температур, салхи болон хур тунадасны жишээ
            </caption>
            <thead>
              <tr>
                <th scope="col">Цаг</th>
                <th scope="col">Төлөв</th>
                <th scope="col">Температур</th>
                <th scope="col">Мэдрэгдэх</th>
                <th scope="col">Салхи</th>
                <th scope="col">Хур тунадас</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.dateTime}>
                  <th scope="row">
                    <time dateTime={entry.dateTime}>{entry.timeLabel}</time>
                  </th>
                  <td>
                    <span className="condition-cell">
                      <WeatherGlyph symbol={entry.symbol} />
                      {entry.condition}
                    </span>
                  </td>
                  <td className="numeric-cell">{entry.temperature}°</td>
                  <td className="muted-cell">{entry.apparentTemperature}°</td>
                  <td>
                    <span className="stacked-value">
                      <strong>{entry.windSpeed} м/с</strong>
                      <span>{entry.windDirection}</span>
                    </span>
                  </td>
                  <td>
                    <span className="stacked-value">
                      <strong>{entry.precipitation} мм</strong>
                      <span>{entry.precipitationProbability}% магадлал</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
