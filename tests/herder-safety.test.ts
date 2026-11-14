import assert from "node:assert/strict";
import test from "node:test";

import {
  BrowserNotificationProvider,
  FutureOutboundSmsProvider,
  ManualSmsShareProvider,
  MockPhoneVerificationProvider,
} from "../src/features/herder-mode/notification-providers.ts";
import {
  buildEmergencyMessage,
  manualSmsHref,
  normalizeFirmsCsv,
  validateCommunityReport,
  validateLivestockShare,
  validateMissingPersonDraft,
} from "../src/features/herder-mode/safety.ts";
import type { MissingLivestockDraft } from "../src/features/herder-mode/types.ts";

test("emergency preview is pure text and never claims automatic dispatch", () => {
  const message = buildEmergencyMessage({
    category: "vehicle",
    description: "Машин асахгүй, хоёр хүн байна",
    contactName: "Бат",
    latitude: "47.9184",
    longitude: "106.9177",
  });
  assert.match(message, /SOS/);
  assert.match(message, /47\.91840, 106\.91770/);
  assert.match(message, /автоматаар илгээгээгүй/);
  assert.equal(manualSmsHref(message).startsWith("sms:?body="), true);
});

test("emergency preview never turns an empty or invalid location into a real coordinate", () => {
  const base = {
    category: "stranded" as const,
    description: "",
    contactName: "",
  };
  assert.match(buildEmergencyMessage({ ...base, latitude: "", longitude: "" }), /Байршил: оруулаагүй/);
  assert.match(buildEmergencyMessage({ ...base, latitude: "91", longitude: "106" }), /Байршил: оруулаагүй/);
  assert.doesNotMatch(buildEmergencyMessage({ ...base, latitude: "", longitude: "" }), /0\.00000/);
});

test("livestock sharing requires explicit trusted contacts and essential details", () => {
  const draft: MissingLivestockDraft = {
    species: "Адуу",
    count: "5",
    lastSeenTime: "2026-11-11T10:30",
    lastSeenPlace: "Хар-Ус баг",
    directionNote: "Баруун хойш",
    lastSeenLatitude: "47.9",
    lastSeenLongitude: "106.9",
    observedDirectionDegrees: "315",
    maxSearchKm: "20",
  };
  assert.deepEqual(validateLivestockShare(draft, 1), []);
  assert.match(validateLivestockShare(draft, 0).join(" "), /итгэлтэй хүн/);
});

test("missing-person local planner blocks unauthorized drafts", () => {
  const base = {
    identifyingDescription: "Бат нэртэй хүн",
    lastKnownPlace: "Хар-Ус баг",
    lastSeenTime: "2026-11-11T10:30",
    weatherNote: "Салхитай",
    coordinatorContact: "102",
    vulnerablePerson: false,
  };
  assert.match(validateMissingPersonDraft({ ...base, authorizationConfirmed: false }).join(" "), /зөвшөөрөл/);
  assert.deepEqual(validateMissingPersonDraft({ ...base, authorizationConfirmed: true }), []);
});

test("notification adapters never fabricate sent or delivered states", () => {
  assert.equal(new ManualSmsShareProvider().prepare("test").status, "ready");
  assert.equal(new BrowserNotificationProvider().prepare().status, "unknown");
  assert.equal(new FutureOutboundSmsProvider().prepare().status, "unknown");
  assert.equal(new MockPhoneVerificationProvider().start().status, "unknown");
});

test("NASA FIRMS CSV normalization preserves satellite provenance and UTC time", () => {
  const csv = [
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence",
    "47.1234,105.5678,330.1,0.4,0.5,2026-11-11,0425,N,VIIRS,n",
  ].join("\n");
  const [hotspot] = normalizeFirmsCsv(csv);
  assert.ok(hotspot);
  assert.equal(hotspot.source, "NASA FIRMS");
  assert.equal(hotspot.detectedAt, "2026-11-11T04:25:00.000Z");
  assert.equal(hotspot.latitude, 47.1234);
});

test("community report validation keeps unreviewed content in draft workflow", () => {
  assert.deepEqual(validateCommunityReport({
    category: "Замын аюултай нөхцөл",
    description: "Замын мөс ихтэй, болгоомжтой явна уу",
    eventTime: "2026-11-11T09:00",
    locationNote: "Сумын зүүн тал",
    correctionOf: "",
  }), []);
  assert.equal(validateCommunityReport({ category: "", description: "богино", eventTime: "", locationNote: "", correctionOf: "" }).length, 3);
});
