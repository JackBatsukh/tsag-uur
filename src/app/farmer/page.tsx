import type { Metadata } from "next";

import { FarmerMode } from "@/features/farmer-mode/farmer-mode";

import "../../features/farmer-mode/farmer.css";

export const metadata: Metadata = {
  title: "Тариаланч горим",
  description: "Усалгаа, ургац хураалт, хяруу, талбайн ажлын 7 хоногийн deterministic demo шийдвэрийн туслах.",
};

export default function FarmerPage() {
  return <FarmerMode />;
}
