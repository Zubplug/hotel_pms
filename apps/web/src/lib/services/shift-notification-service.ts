import { NotificationEngine } from '@/lib/notification-engine';

export type ShiftDecision = 'APPROVED' | 'RETURNED' | 'APPROVED_WITH_VARIANCE';
export type ShiftType = 'POS' | 'FRONT_DESK';

export async function emitShiftDecisionNotification(input: {
  organizationId: string;
  propertyId: string;
  shiftId: string;
  shiftType: ShiftType;
  decision: ShiftDecision;
  shiftReference?: string | null;
  variance?: number | null;
  notes?: string | null;
  idempotencyKey: string;
}) {
  await NotificationEngine.emit({
    type: input.decision === 'APPROVED_WITH_VARIANCE'
      ? 'SHIFT_APPROVED_WITH_VARIANCE'
      : input.decision === 'RETURNED'
        ? 'SHIFT_RETURNED'
        : 'SHIFT_APPROVED',
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    entityType: input.shiftType === 'POS' ? 'pos-session' : 'frontdesk-session',
    entityId: input.shiftId,
    idempotencyKey: input.idempotencyKey,
    metadata: {
      notificationType: input.decision === 'APPROVED_WITH_VARIANCE'
        ? 'SHIFT_APPROVED_WITH_VARIANCE'
        : input.decision === 'RETURNED' ? 'SHIFT_RETURNED' : 'SHIFT_APPROVED',
      shiftType: input.shiftType,
      shiftReference: input.shiftReference || input.shiftId,
      variance: input.variance ?? 0,
      notes: input.notes || null,
    },
  });
}
