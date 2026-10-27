import { ILLUSTRATIVE_RISK_THRESHOLDS } from "./config.ts";
import type { HerderWeatherStep, WeatherRiskItem } from "./types.ts";

export function assessWeatherRisks(
  step: HerderWeatherStep | null,
): readonly WeatherRiskItem[] {
  if (!step) {
    return Object.freeze([
      {
        id: "weather-missing",
        labelMn: "Цаг агаарын эрсдэл",
        level: "unavailable",
        rawValueMn: "Өгөгдөлгүй",
        explanationMn: "Сонгосон хугацаанд тооцоолох алхам алга.",
      },
    ]);
  }

  const thresholds = ILLUSTRATIVE_RISK_THRESHOLDS;
  const windLevel = step.windSpeedMps >= thresholds.veryStrongWindMps
    ? "high"
    : step.windSpeedMps >= thresholds.strongWindMps
      ? "watch"
      : "info";
  const temperatureLevel =
    step.temperatureC <= thresholds.extremeColdC ||
    step.temperatureC >= thresholds.extremeHeatC
      ? "high"
      : "info";
  const precipitationLevel =
    step.precipitationMm >= thresholds.heavySixHourPrecipitationMm
      ? "watch"
      : "info";
  const visibilityLevel = step.visibilityConcern === "none" ? "info" : "watch";
  const precipitationTypeMn =
    step.precipitationType === "snow"
      ? "цас"
      : step.precipitationType === "rain"
        ? "бороо"
        : "тунадасгүй";

  return Object.freeze([
    {
      id: "wind",
      labelMn: "Хүчтэй салхи",
      level: windLevel,
      rawValueMn: `${step.windSpeedMps.toFixed(1)} м/с · ${Math.round(step.windDirectionDegrees)}°-оос`,
      explanationMn:
        windLevel === "info"
          ? "Туршилтын босгоос доогуур. Орон нутгийн бодит нөхцөлийг шалгана уу."
          : "Явган болон тээврийн хайлт хүндрэх боломжтой. Энэ нь албан сэрэмжлүүлэг биш.",
    },
    {
      id: "visibility",
      labelMn: "Үзэгдэх орчин",
      level: visibilityLevel,
      rawValueMn:
        step.visibilityConcern === "none"
          ? "Тусгай DEMO дохио алга"
          : `${step.visibilityConcern.toUpperCase()} DEMO нөхцөл`,
      explanationMn:
        step.visibilityConcern === "none"
          ? "Манан, ажиглалтын харагдац, тоосонцрын бодит өгөгдөл байхгүй."
          : "Салхи, тунадас давхацсан дүрмийн дохио; харагдацын хэмжилт биш.",
    },
    {
      id: "temperature",
      labelMn: "Хүйтэн / халуун",
      level: temperatureLevel,
      rawValueMn: `${step.temperatureC.toFixed(1)} °C`,
      explanationMn:
        temperatureLevel === "high"
          ? "Туршилтын туйлын температурын босгыг давсан. Албан мэдээг заавал шалгана уу."
          : "Түүхий температурыг харуулав; малын аюулгүй байдлын баталгаажсан ангилал биш.",
    },
    {
      id: "precipitation",
      labelMn: "Хур тунадас",
      level: precipitationLevel,
      rawValueMn: `${step.precipitationMm.toFixed(1)} мм / 6 цаг · ${precipitationTypeMn}`,
      explanationMn:
        precipitationLevel === "watch"
          ? "Туршилтын их тунадасны босгыг давсан; гарц, замын бодит мэдээлэл алга."
          : "Цагийн алхмын нийлбэр; газрын гадаргын нөлөөг тооцоогүй.",
    },
    {
      id: "pasture",
      labelMn: "Бэлчээрийн хүртээмж",
      level: "unavailable",
      rawValueMn: "Өгөгдөлгүй",
      explanationMn:
        "Цасны зузаан, мөстөлт, ургамалжилт, даацын бодит давхарга холбогдоогүй.",
    },
  ] satisfies readonly WeatherRiskItem[]);
}
