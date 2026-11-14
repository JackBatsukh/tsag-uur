import { manualSmsHref } from "./safety.ts";
import type { DeliveryStatus } from "./types.ts";

export interface NotificationResult {
  readonly status: DeliveryStatus;
  readonly messageMn: string;
}

export interface NotificationProvider {
  readonly id: string;
  readonly configured: boolean;
  prepare(message: string): NotificationResult;
}

export class ManualSmsShareProvider implements NotificationProvider {
  readonly id = "manual-sms";
  readonly configured = true;

  prepare(message: string): NotificationResult & { readonly href: string } {
    return {
      status: "ready",
      href: manualSmsHref(message),
      messageMn: "SMS апп нээгдэхэд та хүлээн авагчийг сонгож, Илгээх товчийг өөрөө дарна.",
    };
  }
}

export class BrowserNotificationProvider implements NotificationProvider {
  readonly id = "browser-notification";
  readonly configured = false;

  prepare(): NotificationResult {
    return {
      status: "unknown",
      messageMn: "Серверийн мэдэгдлийн backend тохируулаагүй. Хуурамч илгээлтийн төлөв үзүүлэхгүй.",
    };
  }
}

export class MockPhoneVerificationProvider {
  readonly id = "verify-mn-disabled";
  readonly configured = false;

  start(): NotificationResult {
    return {
      status: "unknown",
      messageMn: "Verify.mn API түлхүүр ба серверийн баталгаажуулалт тохируулаагүй тул бодит SMS үүсгэхгүй.",
    };
  }
}

export class FutureOutboundSmsProvider implements NotificationProvider {
  readonly id = "outbound-sms-unconfigured";
  readonly configured = false;

  prepare(): NotificationResult {
    return {
      status: "unknown",
      messageMn: "Гадагш SMS илгээх үйлчилгээ холбогдоогүй.",
    };
  }
}
