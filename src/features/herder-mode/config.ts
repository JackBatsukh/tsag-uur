import type {
  AnimalSpecies,
  SpeciesSearchConfiguration,
  TerrainContext,
} from "./types.ts";

export const SPECIES_CONFIG: Readonly<Record<AnimalSpecies, SpeciesSearchConfiguration>> =
  Object.freeze({
    sheep: {
      species: "sheep",
      labelMn: "Хонь",
      baseInspectionKm: 7,
      inspectionNoteMn: "Ойрын бэлчээр, хот айлын мэдээлэл, хоргодох боломжтой газрыг эхэлж шалгах жишиг.",
    },
    goat: {
      species: "goat",
      labelMn: "Ямаа",
      baseInspectionKm: 8,
      inspectionNoteMn: "Хад асга, бартаатай хэсгийг зөвхөн нутгийн мэдлэг ба бодит замын мэдээллээр шалгана.",
    },
    horse: {
      species: "horse",
      labelMn: "Адуу",
      baseInspectionKm: 22,
      inspectionNoteMn: "Өргөн хүрээний хувилбар харуулах боловч энэ нь туулсан замын тооцоо биш.",
    },
    cattle: {
      species: "cattle",
      labelMn: "Үхэр",
      baseInspectionKm: 12,
      inspectionNoteMn: "Ус, бэлчээр, айл саахалтын ажиглалтыг малчны мэдлэгээр давхар шалгана.",
    },
    yak: {
      species: "yak",
      labelMn: "Сарлаг",
      baseInspectionKm: 10,
      inspectionNoteMn: "Уулархаг газрын саад, давааг өгөгдөлгүй үед систем таамаглахгүй.",
    },
    camel: {
      species: "camel",
      labelMn: "Тэмээ",
      baseInspectionKm: 26,
      inspectionNoteMn: "Говийн хол зайг хамрах өргөн хайлтын жишиг; бодит хөдөлгөөний баталгаа биш.",
    },
  });

export const TERRAIN_LABELS_MN: Readonly<Record<TerrainContext, string>> =
  Object.freeze({
    steppe: "Хээр",
    mountain: "Уулархаг",
    "forest-steppe": "Ойт хээр",
    gobi: "Говь",
  });

/** UI-only thresholds. These are not official warnings or validated livestock limits. */
export const ILLUSTRATIVE_RISK_THRESHOLDS = Object.freeze({
  strongWindMps: 10.8,
  veryStrongWindMps: 17.2,
  extremeColdC: -30,
  extremeHeatC: 32,
  heavySixHourPrecipitationMm: 10,
  visibilityWindMps: 8,
});
