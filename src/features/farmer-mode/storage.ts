import { DEFAULT_FARM_FIELD } from "./config.ts";
import type {
  CropGrowthStage,
  CropMaturityObservation,
  CropType,
  FarmerLocalState,
  FieldNote,
  FieldNoteKind,
  IrrigationMethod,
  SoilType,
} from "./types.ts";

export const FARMER_LOCAL_STORAGE_KEY = "tsag-uur-farmer-local-state-v1";

const CROP_TYPES: readonly CropType[] = ["wheat", "potato", "carrot", "cabbage", "onion", "greenhouse-vegetables"];
const GROWTH_STAGES: readonly CropGrowthStage[] = ["unknown", "preparation", "planting", "emergence", "vegetative", "flowering", "yield-formation", "maturity", "harvest-ready"];
const SOIL_TYPES: readonly SoilType[] = ["unknown", "sandy", "loam", "clay", "organic"];
const IRRIGATION_METHODS: readonly IrrigationMethod[] = ["unknown", "none", "drip", "sprinkler", "furrow"];
const MATURITY_VALUES: readonly CropMaturityObservation[] = ["unknown", "not-ready", "approaching", "ready"];
const NOTE_KINDS: readonly FieldNoteKind[] = ["irrigation", "rainfall", "planting", "crop-condition", "harvest"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalFiniteNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : undefined;
}

function optionalDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    ? value
    : undefined;
}

function includesValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function validateNote(value: unknown): FieldNote | null {
  if (!isRecord(value)) return null;
  const noteDate = optionalDate(value.date);
  if (
    typeof value.id !== "string" ||
    value.id.length < 1 ||
    value.id.length > 100 ||
    !includesValue(NOTE_KINDS, value.kind) ||
    noteDate === undefined ||
    noteDate === null ||
    typeof value.text !== "string" ||
    value.text.trim().length < 1 ||
    value.text.length > 2_000
  ) {
    return null;
  }
  return { id: value.id, kind: value.kind, date: noteDate, text: value.text.trim() };
}

export function createDefaultFarmerLocalState(): FarmerLocalState {
  return {
    version: 1,
    field: {
      ...DEFAULT_FARM_FIELD,
      location: DEFAULT_FARM_FIELD.location ? { ...DEFAULT_FARM_FIELD.location } : null,
    },
    notes: [],
  };
}

export interface FarmerStorageParseResult {
  readonly state: FarmerLocalState;
  readonly recovered: boolean;
  readonly messageMn: string;
}

export function parseFarmerLocalState(raw: string | null): FarmerStorageParseResult {
  const fallback = createDefaultFarmerLocalState();
  if (raw === null) {
    return { state: fallback, recovered: false, messageMn: "Хадгалсан талбайн мэдээлэл байхгүй." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: fallback, recovered: true, messageMn: "Хадгалсан мэдээлэл гэмтсэн тул demo утгаар сэргээв." };
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.field) || !Array.isArray(parsed.notes)) {
    return { state: fallback, recovered: true, messageMn: "Хадгалсан мэдээллийн бүтэц тохирохгүй тул demo утгаар сэргээв." };
  }

  const field = parsed.field;
  const areaHa = optionalFiniteNumber(field.areaHa, 0.01, 1_000_000);
  const measuredSoilMoisturePercent = optionalFiniteNumber(field.measuredSoilMoisturePercent, 0, 100);
  const measuredRainfallMm = optionalFiniteNumber(field.measuredRainfallMm, 0, 5_000);
  const plantingDate = optionalDate(field.plantingDate);
  const lastIrrigationDate = optionalDate(field.lastIrrigationDate);
  let location: FarmerLocalState["field"]["location"] | undefined;
  if (field.location === null) {
    location = null;
  } else if (isRecord(field.location)) {
    const latitude = optionalFiniteNumber(field.location.latitude, 41.3, 52.2);
    const longitude = optionalFiniteNumber(field.location.longitude, 87.5, 120);
    if (typeof latitude === "number" && typeof longitude === "number") {
      location = { latitude, longitude };
    }
  }

  if (
    typeof field.name !== "string" ||
    field.name.trim().length < 1 ||
    field.name.length > 120 ||
    location === undefined ||
    areaHa === undefined ||
    plantingDate === undefined ||
    !includesValue(CROP_TYPES, field.cropType) ||
    !includesValue(GROWTH_STAGES, field.growthStage) ||
    !includesValue(SOIL_TYPES, field.soilType) ||
    !includesValue(IRRIGATION_METHODS, field.irrigationMethod) ||
    lastIrrigationDate === undefined ||
    measuredSoilMoisturePercent === undefined ||
    measuredRainfallMm === undefined ||
    !includesValue(MATURITY_VALUES, field.maturityObservation)
  ) {
    return { state: fallback, recovered: true, messageMn: "Талбайн мэдээллийн утга буруу тул demo утгаар сэргээв." };
  }

  const notes = parsed.notes.map(validateNote);
  if (notes.some((note) => note === null)) {
    return { state: fallback, recovered: true, messageMn: "Тэмдэглэлийн мэдээлэл буруу тул demo утгаар сэргээв." };
  }

  return {
    state: {
      version: 1,
      field: {
        name: field.name.trim(),
        location,
        areaHa,
        cropType: field.cropType,
        plantingDate,
        growthStage: field.growthStage,
        soilType: field.soilType,
        irrigationMethod: field.irrigationMethod,
        lastIrrigationDate,
        measuredSoilMoisturePercent,
        measuredRainfallMm,
        maturityObservation: field.maturityObservation,
      },
      notes: notes as FieldNote[],
    },
    recovered: false,
    messageMn: "Энэ browser-д хадгалсан талбайн мэдээллийг нээлээ.",
  };
}

export function serializeFarmerLocalState(state: FarmerLocalState): string {
  return JSON.stringify(state);
}
