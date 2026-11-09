import type { Metadata } from "next";

import { HerderMode } from "@/features/herder-mode/herder-mode";

import "../../features/herder-mode/herder.css";

export const metadata: Metadata = {
  title: "Малчны цаг агаар",
  description:
    "Бэлчээрийн зүг сонгох, огцом өөрчлөлтийг анзаарах, малын тэмдэглэл хөтлөхөд зориулсан малчны цаг агаар.",
};

export default function HerderPage() {
  return <HerderMode />;
}
