import { describe, expect, it } from "vitest";
import {
  FRONTDESK_SESSION_EVENTS,
  cloudWinsOperationalConflict,
  isTenderEvent,
  requiresFrontdeskSession,
  shouldAutoSubmitRecoveryShift,
} from "./frontdesk-financial-policy";

describe("front-desk financial recovery policy", () => {
  it("requires a cashier session for every financial event", () => {
    expect(FRONTDESK_SESSION_EVENTS.has("EXTEND_STAY")).toBe(true);
    expect(requiresFrontdeskSession("POST_PAYMENT", undefined)).toBe(true);
    expect(requiresFrontdeskSession("CHECK_OUT", undefined)).toBe(false);
    expect(requiresFrontdeskSession("POST_PAYMENT", false)).toBe(false);
  });

  it("never auto-submits a tender operation", () => {
    expect(isTenderEvent("POST_PAYMENT")).toBe(true);
    expect(isTenderEvent("REFUND_REQUESTED")).toBe(true);
    expect(shouldAutoSubmitRecoveryShift("POST_PAYMENT")).toBe(false);
    expect(shouldAutoSubmitRecoveryShift("EXTEND_STAY")).toBe(true);
  });

  it("lets the cloud win stale operational projections only", () => {
    expect(cloudWinsOperationalConflict("ROOM_STATUS_UPDATE")).toBe(true);
    expect(cloudWinsOperationalConflict("EDIT_GUEST")).toBe(true);
    expect(cloudWinsOperationalConflict("POST_PAYMENT")).toBe(false);
    expect(cloudWinsOperationalConflict("CHECK_OUT")).toBe(false);
  });
});
