import type { WeatherCoordinates } from "@/features/weather-data";

export interface DemoLocation {
  readonly id: string;
  readonly name: string;
  readonly administrativeArea: string;
  readonly coordinates: WeatherCoordinates;
}

export const DEMO_LOCATIONS: readonly DemoLocation[] = [
  {
    id: "ulaanbaatar",
    name: "Улаанбаатар",
    administrativeArea: "Нийслэл",
    coordinates: { latitude: 47.9188, longitude: 106.9176 },
  },
  {
    id: "darkhan",
    name: "Дархан",
    administrativeArea: "Дархан-Уул аймаг",
    coordinates: { latitude: 49.4867, longitude: 105.9228 },
  },
  {
    id: "erdenet",
    name: "Эрдэнэт",
    administrativeArea: "Орхон аймаг",
    coordinates: { latitude: 49.0278, longitude: 104.0444 },
  },
  {
    id: "khovd",
    name: "Ховд",
    administrativeArea: "Ховд аймаг",
    coordinates: { latitude: 48.0042, longitude: 91.6409 },
  },
  {
    id: "choibalsan",
    name: "Чойбалсан",
    administrativeArea: "Дорнод аймаг",
    coordinates: { latitude: 48.0726, longitude: 114.5326 },
  },
  {
    id: "dalanzadgad",
    name: "Даланзадгад",
    administrativeArea: "Өмнөговь аймаг",
    coordinates: { latitude: 43.5708, longitude: 104.425 },
  },
  {
    id: "murun",
    name: "Мөрөн",
    administrativeArea: "Хөвсгөл аймаг",
    coordinates: { latitude: 49.6342, longitude: 100.1625 },
  },
] as const;

export const DEFAULT_DEMO_LOCATION = DEMO_LOCATIONS[0];

export function findDemoLocation(query: string): DemoLocation | undefined {
  const normalized = query.trim().toLocaleLowerCase("mn-MN");
  return DEMO_LOCATIONS.find(
    (location) =>
      location.name.toLocaleLowerCase("mn-MN") === normalized ||
      location.administrativeArea.toLocaleLowerCase("mn-MN") === normalized,
  );
}

export function locationNameForCoordinates(
  coordinates: WeatherCoordinates,
): string {
  const match = DEMO_LOCATIONS.find((location) => {
    const latitudeDistance = Math.abs(
      location.coordinates.latitude - coordinates.latitude,
    );
    const longitudeDistance = Math.abs(
      location.coordinates.longitude - coordinates.longitude,
    );
    return latitudeDistance < 0.03 && longitudeDistance < 0.03;
  });
  return match?.name ?? "Сонгосон demo цэг";
}
