import type {
  CommunityReportDraft,
  EmergencyDraft,
  FireHotspot,
  MissingLivestockDraft,
  MissingPersonDraft,
} from "./types";

const CATEGORY_LABELS: Record<EmergencyDraft["category"], string> = {
  stranded: "Хүн төөрсөн / саатсан",
  medical: "Эмнэлгийн яаралтай тусламж",
  vehicle: "Тээврийн хэрэгсэл эвдэрсэн",
  livestock: "Малтай холбоотой тусламж",
  snowstorm: "Цасан шуурга / зуд",
  other: "Бусад яаралтай тусламж",
};

function parseCoordinate(value: string, minimum: number, maximum: number): number | null {
  if (!value.trim()) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null;
}

export function buildEmergencyMessage(draft: EmergencyDraft): string {
  const lines = [
    "SOS — ТУСЛАМЖ ХЭРЭГТЭЙ",
    `Төрөл: ${CATEGORY_LABELS[draft.category]}`,
  ];
  if (draft.description.trim()) lines.push(`Тайлбар: ${draft.description.trim()}`);
  if (draft.contactName.trim()) lines.push(`Холбогдох хүн: ${draft.contactName.trim()}`);
  const latitude = parseCoordinate(draft.latitude, -90, 90);
  const longitude = parseCoordinate(draft.longitude, -180, 180);
  if (latitude !== null && longitude !== null) {
    lines.push(`Байршил: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    lines.push(`Газрын зураг: https://www.openstreetmap.org/?mlat=${latitude.toFixed(5)}&mlon=${longitude.toFixed(5)}#map=12/${latitude.toFixed(5)}/${longitude.toFixed(5)}`);
  } else {
    lines.push("Байршил: оруулаагүй");
  }
  lines.push("Энэ мессежийг Tsag-uur автоматаар илгээгээгүй. Илгээгч өөрөө хуваалцсан.");
  return lines.join("\n");
}

export function manualSmsHref(message: string, phone = ""): string {
  return `sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(message)}`;
}

export function validateMissingPersonDraft(draft: MissingPersonDraft): readonly string[] {
  const errors: string[] = [];
  if (!draft.authorizationConfirmed) errors.push("Мэдээллийг ашиглах зөвшөөрөл, эрхээ баталгаажуулна уу.");
  if (draft.identifyingDescription.trim().length < 3) errors.push("Нэр эсвэл таних тайлбарыг оруулна уу.");
  if (!draft.lastKnownPlace.trim()) errors.push("Сүүлд байсан газрыг оруулна уу.");
  if (!Number.isFinite(Date.parse(draft.lastSeenTime))) errors.push("Сүүлд харсан огноо, цагийг оруулна уу.");
  if (!draft.coordinatorContact.trim()) errors.push("Хайлтыг зохицуулах хүний холбоо барих мэдээллийг оруулна уу.");
  return errors;
}

export function validateLivestockShare(
  draft: MissingLivestockDraft,
  trustedContactCount: number,
): readonly string[] {
  const errors: string[] = [];
  const count = Number(draft.count);
  if (!Number.isInteger(count) || count < 1) errors.push("Алга болсон малын тоог оруулна уу.");
  if (!draft.lastSeenPlace.trim()) errors.push("Сүүлд харсан газрыг оруулна уу.");
  if (!Number.isFinite(Date.parse(draft.lastSeenTime))) errors.push("Сүүлд харсан огноо, цагийг оруулна уу.");
  if (trustedContactCount < 1) errors.push("Дор хаяж нэг итгэлтэй хүнээ сонгоно уу.");
  return errors;
}

export function buildLivestockMessage(draft: MissingLivestockDraft): string {
  const count = Number(draft.count);
  const lines = [
    "АЛГА БОЛСОН МАЛ — ХАЙХАД ТУСЛААРАЙ",
    `${draft.species}: ${Number.isFinite(count) ? count : draft.count} толгой`,
    `Сүүлд харсан газар: ${draft.lastSeenPlace || "оруулаагүй"}`,
    `Сүүлд харсан цаг: ${draft.lastSeenTime || "оруулаагүй"}`,
  ];
  if (draft.directionNote.trim()) lines.push(`Чиглэл / таних тэмдэг: ${draft.directionNote.trim()}`);
  lines.push("Байршлыг нийтэд бус, зөвхөн сонгосон итгэлтэй хүмүүст хуваалцана уу.");
  return lines.join("\n");
}

export function validateCommunityReport(draft: CommunityReportDraft): readonly string[] {
  const errors: string[] = [];
  if (!draft.category) errors.push("Мэдээллийн төрлийг сонгоно уу.");
  if (draft.description.trim().length < 10) errors.push("Нөхцөл байдлыг 10-аас дээш тэмдэгтээр тайлбарлана уу.");
  if (!Number.isFinite(Date.parse(draft.eventTime))) errors.push("Үйл явдал болсон цагийг оруулна уу.");
  return errors;
}

function csvRow(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(current);
      current = "";
    } else current += character;
  }
  values.push(current);
  return values;
}

export function normalizeFirmsCsv(csv: string): readonly FireHotspot[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = csvRow(lines[0]!).map((value) => value.trim().toLowerCase());
  const position = (name: string) => headers.indexOf(name);
  const latitudeIndex = position("latitude");
  const longitudeIndex = position("longitude");
  const dateIndex = position("acq_date");
  const timeIndex = position("acq_time");
  if ([latitudeIndex, longitudeIndex, dateIndex, timeIndex].some((index) => index < 0)) return [];

  return lines.slice(1).flatMap((line, rowIndex) => {
    const values = csvRow(line);
    const latitude = Number(values[latitudeIndex]);
    const longitude = Number(values[longitudeIndex]);
    const date = values[dateIndex];
    const time = (values[timeIndex] ?? "").padStart(4, "0");
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !date || !/^\d{4}$/.test(time)) return [];
    const detectedAt = new Date(`${date}T${time.slice(0, 2)}:${time.slice(2)}:00Z`);
    if (Number.isNaN(detectedAt.getTime())) return [];
    return [{
      id: `${date}-${time}-${latitude.toFixed(4)}-${longitude.toFixed(4)}-${rowIndex}`,
      latitude,
      longitude,
      detectedAt: detectedAt.toISOString(),
      confidence: values[position("confidence")] || "unknown",
      satellite: values[position("satellite")] || "unknown",
      instrument: values[position("instrument")] || "VIIRS",
      source: "NASA FIRMS" as const,
    }];
  });
}
