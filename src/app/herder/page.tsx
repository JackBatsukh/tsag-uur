import type { Metadata } from "next";

import { HerderMode } from "@/features/herder-mode/herder-mode";

export const metadata: Metadata = {
  title: "Малчин горим",
  description:
    "Алга болсон малын хайлтыг цаг агаарын түүх, ил тод туршилтын хувилбараар төлөвлөх Tsag-uur DEMO.",
};

export default function HerderPage() {
  return <HerderMode />;
}
