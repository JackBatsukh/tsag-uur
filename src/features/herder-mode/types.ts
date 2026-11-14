export type PasturePriority = "wind" | "precipitation" | "cold";
export type PastureDirectionId = "north" | "east" | "south" | "west";

export interface HerderCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface HerderCurrentWeather {
  readonly time: string;
  readonly temperatureC: number;
  readonly apparentTemperatureC: number;
  readonly precipitationMm: number;
  readonly weatherCode: number;
  readonly windSpeedMps: number;
  readonly windDirectionDegrees: number;
  readonly windGustMps: number;
}

export interface HerderHourlyWeather extends HerderCurrentWeather {
  readonly precipitationProbabilityPercent: number;
  readonly snowfallCm: number;
  readonly visibilityM: number;
}

export interface PastureDirectionSummary {
  readonly id: PastureDirectionId;
  readonly labelMn: string;
  readonly bearingDegrees: number;
  readonly coordinates: HerderCoordinates;
  readonly distanceKm: number;
  readonly precipitationTotalMm: number;
  readonly precipitationProbabilityMaxPercent: number;
  readonly maxWindGustMps: number;
  readonly minApparentTemperatureC: number;
  readonly maxTemperatureC: number;
  readonly minVisibilityM: number;
  readonly weatherCode: number;
}

export interface HerderForecastPayload {
  readonly fetchedAt: string;
  readonly timezone: string;
  readonly timezoneAbbreviation: string;
  readonly elevationM: number;
  readonly location: HerderCoordinates;
  readonly current: HerderCurrentWeather;
  readonly hourly: readonly HerderHourlyWeather[];
  readonly directions: readonly PastureDirectionSummary[];
  readonly source: {
    readonly name: string;
    readonly url: string;
    readonly model: string;
  };
  readonly limitationsMn: readonly string[];
}

export interface MissingLivestockDraft {
  readonly species: string;
  readonly count: string;
  readonly lastSeenTime: string;
  readonly lastSeenPlace: string;
  readonly directionNote: string;
  readonly lastSeenLatitude: string;
  readonly lastSeenLongitude: string;
  readonly observedDirectionDegrees: string;
  readonly maxSearchKm: string;
}

export interface LivestockWeatherAnalysis {
  readonly startTime: string;
  readonly endTime: string;
  readonly hoursConsidered: number;
  readonly weatherInfluenceBearingDegrees: number | null;
  readonly strongestWindMps: number;
  readonly strongestWindTime: string;
  readonly totalPrecipitationMm: number;
  readonly totalSnowfallCm: number;
  readonly minimumVisibilityM: number;
  readonly significantWeatherCodes: readonly number[];
  readonly notesMn: readonly string[];
}

export interface LivestockSearchArea {
  readonly id: "reported" | "weather" | "nearby" | "alternative";
  readonly order: number;
  readonly labelMn: string;
  readonly color: string;
  readonly bearingDegrees: number | null;
  readonly distanceKm: number;
  readonly polygon: readonly [number, number][];
  readonly reasonMn: string;
}

export interface LivestockSearchPayload {
  readonly fetchedAt: string;
  readonly timezone: string;
  readonly location: HerderCoordinates;
  readonly hourly: readonly HerderHourlyWeather[];
  readonly analysis: LivestockWeatherAnalysis;
  readonly source: {
    readonly name: string;
    readonly url: string;
    readonly model: string;
  };
  readonly limitationsMn: readonly string[];
}

export type HerderView =
  | "home"
  | "livestock"
  | "sos"
  | "person"
  | "fire"
  | "weather"
  | "road"
  | "report"
  | "notifications"
  | "profile";

export type DeliveryStatus = "draft" | "ready" | "opened" | "sent" | "delivered" | "failed" | "unknown";
export type ReportStatus = "draft" | "submitted" | "awaiting-review" | "verified" | "disputed" | "rejected" | "resolved";
export type DataProvenance = "official" | "satellite" | "community" | "forecast" | "demo";

export interface EmergencyDraft {
  readonly category: "stranded" | "medical" | "vehicle" | "livestock" | "snowstorm" | "other";
  readonly description: string;
  readonly contactName: string;
  readonly latitude: string;
  readonly longitude: string;
}

export interface MissingPersonDraft {
  readonly identifyingDescription: string;
  readonly lastKnownPlace: string;
  readonly lastSeenTime: string;
  readonly weatherNote: string;
  readonly coordinatorContact: string;
  readonly authorizationConfirmed: boolean;
  readonly vulnerablePerson: boolean;
}

export interface CommunityReportDraft {
  readonly category: string;
  readonly description: string;
  readonly eventTime: string;
  readonly locationNote: string;
  readonly correctionOf: string;
}

export interface FireHotspot {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly detectedAt: string;
  readonly confidence: string;
  readonly satellite: string;
  readonly instrument: string;
  readonly source: "NASA FIRMS";
}

export interface FireHotspotPayload {
  readonly configured: boolean;
  readonly fetchedAt: string;
  readonly source: {
    readonly name: "NASA FIRMS";
    readonly url: string;
    readonly product: string;
    readonly provenance: "satellite";
  };
  readonly hotspots: readonly FireHotspot[];
  readonly messageMn: string;
}
