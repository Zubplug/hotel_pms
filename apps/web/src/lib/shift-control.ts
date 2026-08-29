/**
 * Enterprise shift-control vocabulary.
 *
 * The legacy POS/Front Desk `status` columns remain in use during migration;
 * these values are stored in `controlStatus` and are advanced only by server
 * routes after authorization and financial validation.
 */
export const SHIFT_CONTROL_STATUSES = [
  'OPEN',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'APPROVED_WITH_VARIANCE',
  'RETURNED',
  'HANDOVER_PENDING',
  'HANDED_OVER',
  'DEPOSITED',
  'RECONCILED',
] as const;

export const VARIANCE_STATUSES = [
  'OPEN',
  'INVESTIGATING',
  'ACCEPTED',
  'RESOLVED',
  'ESCALATED',
] as const;

export type ShiftControlStatus = (typeof SHIFT_CONTROL_STATUSES)[number];
export type VarianceStatus = (typeof VARIANCE_STATUSES)[number];

export function legacyControlStatus(status: string, settlementStatus?: string | null): ShiftControlStatus {
  if (settlementStatus === 'PENDING_HANDOVER') return 'SUBMITTED';
  if (status === 'RECONCILIATION_REQUIRED') return 'SUBMITTED';
  if (status === 'UNDER_REVIEW') return 'UNDER_REVIEW';
  if (status === 'RECONCILED') return 'RECONCILED';
  if (status === 'CLOSED') return 'RECONCILED';
  return 'OPEN';
}

export function assertShiftTransition(from: string, to: ShiftControlStatus): void {
  const allowed: Record<string, ShiftControlStatus[]> = {
    OPEN: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'APPROVED_WITH_VARIANCE', 'RETURNED'],
    UNDER_REVIEW: ['APPROVED', 'APPROVED_WITH_VARIANCE', 'RETURNED'],
    RETURNED: ['SUBMITTED'],
    APPROVED: ['HANDOVER_PENDING', 'DEPOSITED', 'RECONCILED'],
    APPROVED_WITH_VARIANCE: ['HANDOVER_PENDING', 'DEPOSITED', 'RECONCILED'],
    HANDOVER_PENDING: ['HANDED_OVER'],
    HANDED_OVER: ['DEPOSITED', 'RECONCILED'],
    DEPOSITED: ['RECONCILED'],
    RECONCILED: [],
  };

  if (!allowed[from]?.includes(to)) {
    throw new Error(`Invalid shift control transition: ${from} -> ${to}`);
  }
}

export function varianceStatusFor(variance: number | null | undefined): VarianceStatus | null {
  if (variance == null || variance === 0) return null;
  return 'OPEN';
}
