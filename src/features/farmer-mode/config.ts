import type {
  CropConfiguration,
  CropGrowthStage,
  CropMaturityObservation,
  CropType,
  FarmField,
  FieldNoteKind,
  IrrigationMethod,
  SoilType,
} from "./types.ts";

const ALL_STAGES: readonly CropGrowthStage[] = [
  "unknown",
  "preparation",
  "planting",
  "emergence",
  "vegetative",
  "flowering",
  "yield-formation",
  "maturity",
  "harvest-ready",
];

export const CROP_CONFIG: Readonly<Record<CropType, CropConfiguration>> = {
  wheat: {
    id: "wheat",
    labelMn: "Улаанбуудай",
    descriptionMn: "Богино ургалтын хугацаатай үр тарианы жишиг тохиргоо.",
    supportedStages: ALL_STAGES,
    harvestMaturityNoteMn: "Үрийн чийг, болц, сортын шаардлагыг талбай дээр баталгаажуулна.",
    irrigationNoteMn: "Үе шат, үндэсний бүс, хөрсний ус барих чадваргүйгээр усны хэмжээг тооцохгүй.",
  },
  potato: {
    id: "potato",
    labelMn: "Төмс",
    descriptionMn: "Булцуу үүсэлт ба хөрсний чийгийн бодит хэмжилт чухал.",
    supportedStages: ALL_STAGES,
    harvestMaturityNoteMn: "Иш навчны хөгшрөлт, булцууны хальсны бэхжилтийг газар дээр шалгана.",
    irrigationNoteMn: "Булцуу үүсэлтэд усны дутагдал эрсдэлтэй боловч мэдрэгчгүй үед хэмжээг санал болгохгүй.",
  },
  carrot: {
    id: "carrot",
    labelMn: "Лууван",
    descriptionMn: "Үндэсний хөгжил ба жигд чийгийн мэдээлэл шаарддаг.",
    supportedStages: ALL_STAGES,
    harvestMaturityNoteMn: "Үндэсний хэмжээ, чанарыг талбайн сорьцоор баталгаажуулна.",
    irrigationNoteMn: "Өнгөн хөрсний хаталтыг хэмжилт эсвэл газар дээрх ажиглалтаар шалгана.",
  },
  cabbage: {
    id: "cabbage",
    labelMn: "Байцаа",
    descriptionMn: "Навч, толгой үүсэх үеийн чийгийн бодит төлөв чухал.",
    supportedStages: ALL_STAGES,
    harvestMaturityNoteMn: "Толгойн нягтрал, сортын боловсролтыг талбай дээр баталгаажуулна.",
    irrigationNoteMn: "Хөрсний чийг ба үндэсний бүс тодорхойгүй бол зөвхөн цаг агаарын төлөв өгнө.",
  },
  onion: {
    id: "onion",
    labelMn: "Сонгино",
    descriptionMn: "Булцуу томролт ба боловсролтын ажиглалт шаарддаг.",
    supportedStages: ALL_STAGES,
    harvestMaturityNoteMn: "Навч налалт, булцууны боловсролтыг талбай дээр шалгана.",
    irrigationNoteMn: "Хураалтын өмнөх усалгааг болц, хөрсний чийгтэй хамт шийднэ.",
  },
  "greenhouse-vegetables": {
    id: "greenhouse-vegetables",
    labelMn: "Хүлэмжийн ногоо",
    descriptionMn: "Хүлэмж доторх температур, чийг, агааржуулалт тусдаа хэмжилт шаарддаг.",
    supportedStages: ALL_STAGES,
    harvestMaturityNoteMn: "Таримлын төрөл ба бүтээгдэхүүний болцыг хэрэглэгч өөрөө баталгаажуулна.",
    irrigationNoteMn: "Гаднах цаг агаар дангаараа хүлэмжийн усалгааг тодорхойлохгүй.",
  },
};

export const GROWTH_STAGE_LABELS_MN: Readonly<Record<CropGrowthStage, string>> = {
  unknown: "Мэдэхгүй",
  preparation: "Талбай бэлтгэл",
  planting: "Тариалалт",
  emergence: "Соёололт",
  vegetative: "Навч, ишний өсөлт",
  flowering: "Цэцэглэлт",
  "yield-formation": "Ургац бүрэлдэх",
  maturity: "Боловсролт",
  "harvest-ready": "Хураалтад бэлэн гэж ажигласан",
};

export const SOIL_TYPE_LABELS_MN: Readonly<Record<SoilType, string>> = {
  unknown: "Мэдэхгүй",
  sandy: "Элсэрхэг",
  loam: "Шавранцар",
  clay: "Шаварлаг",
  organic: "Органик ихтэй",
};

export const IRRIGATION_METHOD_LABELS_MN: Readonly<Record<IrrigationMethod, string>> = {
  unknown: "Мэдэхгүй",
  none: "Усалгаагүй",
  drip: "Дуслын",
  sprinkler: "Бороожуулах",
  furrow: "Сувгаар",
};

export const MATURITY_LABELS_MN: Readonly<Record<CropMaturityObservation, string>> = {
  unknown: "Ургацын боловсролт баталгаажаагүй",
  "not-ready": "Болоогүй гэж ажигласан",
  approaching: "Боловсролт ойртсон",
  ready: "Бэлэн гэж талбай дээр ажигласан",
};

export const NOTE_KIND_LABELS_MN: Readonly<Record<FieldNoteKind, string>> = {
  irrigation: "Усалгаа",
  rainfall: "Борооны ажиглалт",
  planting: "Тариалалт",
  "crop-condition": "Ургамлын төлөв",
  harvest: "Ургац хураалт",
};

export const DEFAULT_FARM_FIELD: FarmField = {
  name: "Демо талбай",
  location: { latitude: 49.48, longitude: 106.92 },
  areaHa: null,
  cropType: "wheat",
  plantingDate: null,
  growthStage: "unknown",
  soilType: "unknown",
  irrigationMethod: "unknown",
  lastIrrigationDate: null,
  measuredSoilMoisturePercent: null,
  measuredRainfallMm: null,
  maturityObservation: "unknown",
};
