import type { Metadata } from "next";

import { HerderMode } from "@/features/herder-mode/herder-mode";

export const metadata: Metadata = {
  title: "Малчны цаг агаар",
  description:
    "Бэлчээрийн зүг сонгох, огцом өөрчлөлтийг анзаарах, малын тэмдэглэл хөтлөхөд зориулсан малчны цаг агаар.",
};

export default function HerderPage() {
  return <HerderMode />;
}
