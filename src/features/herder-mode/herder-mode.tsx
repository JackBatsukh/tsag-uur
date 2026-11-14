"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { SpriteIcon } from "@/components/sprite-icon";

import { HerderHome } from "./herder-home";
import type { HerderView } from "./types";

const SosView = dynamic(() => import("./herder-sos-view").then((module) => module.SosView), { ssr: false });
const SearchViews = dynamic(() => import("./herder-search-views").then((module) => module.SearchViews), { ssr: false });
const ConditionsViews = dynamic(() => import("./herder-conditions-views").then((module) => module.ConditionsViews), { ssr: false });
const CommunityViews = dynamic(() => import("./herder-community-views").then((module) => module.CommunityViews), { ssr: false });

export const HERDER_STORAGE_PREFIX = "tsag-uur-herder-v2";
export const CONTACTS_KEY = `${HERDER_STORAGE_PREFIX}-trusted-contacts`;

export function HerderMode() {
  const [view, setView] = useState<HerderView>("home");
  const [online, setOnline] = useState(true);
  const [contacts, setContacts] = useState("");

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      setOnline(navigator.onLine);
      setContacts(window.localStorage.getItem(CONTACTS_KEY) ?? "");
    }, 0);
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => { window.clearTimeout(restoreTimer); window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline); };
  }, []);

  const openView = (next: HerderView) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => openView("home");

  return <div className="herder-app">
    <a className="skip-link" href="#herder-main">Үндсэн хэсэг рүү очих</a>
    <header className="herder-header"><button className="brand-button" type="button" onClick={() => openView("home")} aria-label="Малчин горимын нүүр"><span className="brand-mark"><SpriteIcon name="brand" /></span><span><strong>Tsag-uur</strong><small>Малчин</small></span></button><div className={`header-network ${online ? "is-online" : "is-offline"}`}><span />{online ? "Сүлжээтэй" : "Офлайн"}</div><Link className="explorer-link" href="/"><SpriteIcon name="map" />Ерөнхий зураг</Link></header>
    <main id="herder-main" className="herder-main">
      {view === "home" ? <HerderHome online={online} openView={openView} /> : null}
      {view === "sos" ? <SosView contacts={contacts} onBack={back} /> : null}
      {view === "livestock" || view === "person" ? <SearchViews view={view} contacts={contacts} onBack={back} /> : null}
      {view === "fire" || view === "weather" || view === "road" ? <ConditionsViews view={view} onBack={back} /> : null}
      {view === "report" || view === "notifications" || view === "profile" ? <CommunityViews view={view} contacts={contacts} setContacts={setContacts} onBack={back} /> : null}
    </main>
    <nav className="herder-bottom-nav" aria-label="Үндсэн цэс"><button className={view === "home" ? "active" : ""} type="button" onClick={() => openView("home")}><SpriteIcon name="home" /><span>Нүүр</span></button><Link href="/"><SpriteIcon name="map" /><span>Газрын зураг</span></Link><button className={view === "notifications" ? "active" : ""} type="button" onClick={() => openView("notifications")}><SpriteIcon name="bell" /><span>Мэдэгдэл</span></button><button className={view === "profile" ? "active" : ""} type="button" onClick={() => openView("profile")}><SpriteIcon name="person" /><span>Миний хэсэг</span></button></nav>
  </div>;
}
