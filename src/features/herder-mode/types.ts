import type { WeatherCoordinates } from "@/features/weather-data";

export type AnimalSpecies =
  | "sheep"
  | "goat"
  | "horse"
  | "cattle"
  | "yak"
  | "camel";

export type TerrainContext = "steppe" | "mountain" | "forest-steppe" | "gobi";
export type WeatherPeriod = "historical" | "forecast";
export type DemoScenarioKind = "snowstorm" | "dust-storm" | "heavy-rain";
export type VisibilityConcern = "none" | "snow" | "dust" | "rain";

export interface HerderWeatherStep {
  readonly id: string;
  readonly validTime: string;
  readonly period: WeatherPeriod;
  readonly temperatureC: number;
  readonly windUMps: number;
  readonly windVMps: number;
  readonly windSpeedMps: number;
  readonly windDirectionDegrees: number;
  readonly precipitationMm: number;
  readonly precipitationType: "none" | "rain" | "snow";
  readonly visibilityConcern: VisibilityConcern;
}

export interface HerderDemoScenario {
  readonly id: string;
  readonly nameMn: string;
  readonly summaryMn: string;
  readonly kind: DemoScenarioKind;
  readonly defaultSpecies: AnimalSpecies;
  readonly defaultCount: number;
  readonly terrain: TerrainContext;
  readonly location: WeatherCoordinates;
  readonly lastSeenTime: string;
  readonly weather: readonly HerderWeatherStep[];
}

export interface MissingLivestockReport {
  readonly species: AnimalSpecies;
  readonly count: number;
  readonly lastKnownLocation: WeatherCoordinates | null;
  readonly lastSeenTime: string;
  readonly observedDirectionDegrees: number | null;
  readonly possibleDirectionDegrees: number | null;
  readonly terrain: TerrainContext;
  readonly shelterContext: string;
  readonly notes: string;
}

export interface SpeciesSearchConfiguration {
  readonly species: AnimalSpecies;
  readonly labelMn: string;
  /** Illustrative search extent, not an animal travel-distance claim. */
  readonly baseInspectionKm: number;
  readonly inspectionNoteMn: string;
}

export interface HistoricalWeatherAnalysis {
  readonly stepsConsidered: number;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly strongestWindMps: number | null;
  readonly strongestWindTime: string | null;
  readonly totalPrecipitationMm: number | null;
  readonly meanWindFlowDirectionDegrees: number | null;
  readonly eventNotesMn: readonly string[];
  readonly missingInputsMn: readonly string[];
}

export type SearchAreaKind = "observation" | "weather" | "alternative";

export interface SearchAreaSuggestion {
  readonly id: string;
  readonly kind: SearchAreaKind;
  readonly titleMn: string;
  readonly color: string;
  readonly bearingDegrees: number;
  readonly distanceKm: number;
  readonly polygon: readonly [number, number][];
  readonly reasonsMn: readonly string[];
  readonly limitationsMn: readonly string[];
}

export interface SearchAdjustment {
  readonly distanceMultiplier: number;
  readonly bearingShiftDegrees: number;
}

export type RiskLevel = "info" | "watch" | "high" | "unavailable";

export interface WeatherRiskItem {
  readonly id: string;
  readonly labelMn: string;
  readonly level: RiskLevel;
  readonly rawValueMn: string;
  readonly explanationMn: string;
}
