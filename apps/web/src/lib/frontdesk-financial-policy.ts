/**
 * The synchronization policy for front-desk financial events.
 *
 * Keep this classification in one place. The cloud sync route, recovery-shift
 * handling, and attention queue must agree on which operations are financial,
 * which require a cashier session, and which may be submitted without a
 * physical-tender declaration.
 */

export const FRONTDESK_SESSION_EVENTS = new Set([
  "ROOM_CHARGE",
  "POST_CHARGE",
  "POST_PAYMENT",
  "PAYMENT_CORRECTION_REQUESTED",
  "ADVANCE_DEPOSIT",
  "ADVANCE_DEPOSIT_REQUEST",
  "CREDIT_ADJUSTMENT_REQUEST",
  "ROOM_CREDIT",
  "REFUND_REQUESTED",
  "CITY_LEDGER_SETTLEMENT",
  "CITY_LEDGER_PAYMENT",
  "EXTEND_STAY",
]);

export const FRONTDESK_TENDER_EVENTS = new Set([
  "POST_PAYMENT",
  "PAYMENT_CORRECTION_REQUESTED",
  "ADVANCE_DEPOSIT",
  "ADVANCE_DEPOSIT_REQUEST",
  "REFUND_REQUESTED",
  "CITY_LEDGER_SETTLEMENT",
  "CITY_LEDGER_PAYMENT",
]);

export const FRONTDESK_AUTO_SUBMIT_RECOVERY_EVENTS = new Set([
  "EXTEND_STAY",
  "ROOM_CHARGE",
  "POST_CHARGE",
  "ROOM_CREDIT",
]);

/**
 * These operations only change the operational projection. If the cloud has
 * already accepted a newer state, the offline mutation is superseded and the
 * next pull must replace the terminal projection. Never put financial or
 * arrival/departure mutations in this set.
 */
export const CLOUD_AUTHORITATIVE_OPERATIONAL_EVENTS = new Set([
  "EDIT_GUEST",
  "LATE_ARRIVAL",
  "NO_SHOW",
  "REINSTATE",
  "REASSIGN_ROOM",
  "ROOM_STATUS_UPDATE",
  "UPDATE_STATUS",
  "KEYCARD_ENCODE",
]);

export function requiresFrontdeskSession(eventType: string, frontdeskTransaction: unknown): boolean {
  return FRONTDESK_SESSION_EVENTS.has(eventType) && frontdeskTransaction !== false;
}

export function shouldAutoSubmitRecoveryShift(eventType: string): boolean {
  return FRONTDESK_AUTO_SUBMIT_RECOVERY_EVENTS.has(eventType);
}

export function isTenderEvent(eventType: string): boolean {
  return FRONTDESK_TENDER_EVENTS.has(eventType);
}

export function cloudWinsOperationalConflict(eventType: string): boolean {
  return CLOUD_AUTHORITATIVE_OPERATIONAL_EVENTS.has(eventType);
}
