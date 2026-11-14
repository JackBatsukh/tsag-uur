import type { Metadata } from "next";

import { HerderMode } from "@/features/herder-mode/herder-mode";

import "../../features/herder-mode/herder.css";

export const metadata: Metadata = {
  title: "Малчин горим 2.0 — тусламж ба сэрэмжлүүлэг",
  description:
    "Монгол малчдад зориулсан SOS, хүн ба мал хайх тусламж, гал, цаг агаар, замын сэрэмжлүүлгийн нууцлалтай хэрэгсэл.",
};

export default function HerderPage() {
  return <HerderMode />;
}
