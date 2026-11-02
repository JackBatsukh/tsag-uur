import type {
  WeatherCoordinates,
  WindDirectionCardinal,
} from "@/features/weather-data";

export type CropType =
  | "wheat"
  | "potato"
  | "carrot"
  | "cabbage"
  | "onion"
  | "greenhouse-vegetables";

export type CropGrowthStage =
  | "unknown"
  | "preparation"
  | "planting"
  | "emergence"
  | "vegetative"
  | "flowering"
  | "yield-formation"
  | "maturity"
  | "harvest-ready";

export type SoilType = "unknown" | "sandy" | "loam" | "clay" | "organic";

export type IrrigationMethod =
  | "unknown"
  | "none"
  | "drip"
  | "sprinkler"
  | "furrow";

export type CropMaturityObservation =
  | "unknown"
  | "not-ready"
  | "approaching"
  | "ready";

export type FarmerScenarioKind =
  | "dry-week"
  | "rainy-week"
  | "frost-period"
  | "strong-wind"
  | "harvest-window";

export type AdvisoryCategory =
  | "irrigation"
  | "harvest"
  | "planting"
  | "fieldwork";

export type AdvisoryLevel = "favorable" | "watch" | "avoid" | "insufficient";

export type AgriculturalRiskKind =
  | "frost"
  | "strong-wind"
  | "heavy-rain"
  | "dry-hot"
  | "snow-cold"
  | "fieldwork";

export interface DataProvenance {
  readonly datasetId: string;
  readonly dataKind: "synthetic" | "forecast" | "observation";
  readonly sourceMn: string;
  readonly modelMn: string;
  readonly generatedAt: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly nominalResolutionKm: number | null;
  readonly isSynthetic: boolean;
  readonly isScientificallyValidated: boolean;
  readonly limitationsMn: readonly string[];
}

export interface CropConfiguration {
  readonly id: CropType;
  readonly labelMn: string;
  readonly descriptionMn: string;
  readonly supportedStages: readonly CropGrowthStage[];
  readonly harvestMaturityNoteMn: string;
  readonly irrigationNoteMn: string;
}

export interface FarmField {
  readonly name: string;
  readonly location: WeatherCoordinates | null;
  readonly areaHa: number | null;
  readonly cropType: CropType;
  readonly plantingDate: string | null;
  readonly growthStage: CropGrowthStage;
  readonly soilType: SoilType;
  readonly irrigationMethod: IrrigationMethod;
  readonly lastIrrigationDate: string | null;
  readonly measuredSoilMoisturePercent: number | null;
  readonly measuredRainfallMm: number | null;
  readonly maturityObservation: CropMaturityObservation;
}

export interface AgriculturalForecastDay {
  readonly id: string;
  readonly validDate: string;
  readonly minimumTemperatureC: number;
  readonly maximumTemperatureC: number;
  /** Daily interval amount, never a cumulative-since-run field. */
  readonly precipitationMm: number;
  /** Null because the deterministic demo has no calibrated probability. */
  readonly precipitationProbabilityPercent: number | null;
  readonly maximumWindSpeedMps: number;
  readonly windDirectionDegrees: number;
  readonly windDirectionCardinal: WindDirectionCardinal;
  readonly minimumRelativeHumidityPercent: number;
  readonly maximumRelativeHumidityPercent: number;
  readonly condition: "clear" | "cloudy" | "rain" | "snow" | "dusty";
}

export interface FarmerDemoScenario {
  readonly id: string;
  readonly kind: FarmerScenarioKind;
  readonly labelMn: string;
  readonly summaryMn: string;
  readonly locationNameMn: string;
  readonly location: WeatherCoordinates;
  readonly days: readonly AgriculturalForecastDay[];
  readonly provenance: DataProvenance;
}

export interface AdvisoryResult {
  readonly category: AdvisoryCategory;
  readonly level: AdvisoryLevel;
  readonly titleMn: string;
  readonly summaryMn: string;
  readonly explanationMn: readonly string[];
  readonly supportingMeasurementsMn: readonly string[];
  readonly missingInputsMn: readonly string[];
  readonly validityPeriod: Readonly<{ from: string; until: string }>;
  readonly sourceMn: string;
  readonly uncertaintyMn: readonly string[];
  readonly isIllustrative: true;
}

export interface WeatherWindow {
  readonly date: string;
  readonly score: number;
  readonly level: AdvisoryLevel;
  readonly advantagesMn: readonly string[];
  readonly concernsMn: readonly string[];
  readonly maturityConfirmed: boolean;
}

export interface AgriculturalRisk {
  readonly kind: AgriculturalRiskKind;
  readonly level: AdvisoryLevel;
  readonly labelMn: string;
  readonly valueMn: string;
  readonly explanationMn: string;
  readonly affectedDates: readonly string[];
  readonly sourceMn: string;
  readonly limitationMn: string;
}

export type FieldNoteKind =
  | "irrigation"
  | "rainfall"
  | "planting"
  | "crop-condition"
  | "harvest";

export interface FieldNote {
  readonly id: string;
  readonly kind: FieldNoteKind;
  readonly date: string;
  readonly text: string;
}

export interface FarmerLocalState {
  readonly version: 1;
  readonly field: FarmField;
  readonly notes: readonly FieldNote[];
}
