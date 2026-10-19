export type WeatherSymbol =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "light-snow";

export interface ForecastLocation {
  readonly name: string;
  readonly administrativeArea: string;
  readonly country: string;
  readonly gridPoint: string;
  readonly coordinates: string;
}

export interface ForecastMetric {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly unit?: string;
}

export interface CurrentConditions {
  readonly temperature: number;
  readonly apparentTemperature: number;
  readonly condition: string;
  readonly symbol: WeatherSymbol;
  readonly high: number;
  readonly low: number;
  readonly windSpeed: number;
  readonly windDirection: string;
  readonly precipitation: number;
  readonly precipitationProbability: number;
  readonly humidity: number;
}

export interface HourlyForecastEntry {
  readonly dateTime: string;
  readonly timeLabel: string;
  readonly condition: string;
  readonly symbol: WeatherSymbol;
  readonly temperature: number;
  readonly apparentTemperature: number;
  readonly windSpeed: number;
  readonly windDirection: string;
  readonly precipitation: number;
  readonly precipitationProbability: number;
}

export interface ModelMetadata {
  readonly model: string;
  readonly source: string;
  readonly runTime: string;
  readonly runTimeLabel: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly validPeriodLabel: string;
  readonly gridResolution: string;
  readonly processingVersion: string;
  readonly status: "demo";
}

export interface DashboardForecast {
  readonly location: ForecastLocation;
  readonly current: CurrentConditions;
  readonly metrics: readonly ForecastMetric[];
  readonly hourly: readonly HourlyForecastEntry[];
  readonly metadata: ModelMetadata;
  readonly generatedLabel: string;
  readonly disclaimer: string;
}
