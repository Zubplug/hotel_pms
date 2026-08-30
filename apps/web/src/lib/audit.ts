/**
 * AUDIT LOG DECISION RULE — READ BEFORE USING THIS MODULE
 *
 * There are TWO audit patterns in this codebase. Always use the correct one:
 *
 * ─── Pattern A: Use `createAuditLog()` (this function) for: ───────────────────
 *   ✅ Configuration / admin CRUD that runs OUTSIDE a financial transaction
 *      e.g. property settings, rooms, room types, buildings, staff management
 *   ✅ Approval lifecycle events (requested, approved, rejected)
 *   ✅ Any audit write that is NOT inside a `prisma.$transaction()` block
 *
 *   Behaviour: fire-and-forget, silent failure, never crashes the caller.
 *   Tradeoff: if the main operation succeeds but the audit write fails, the
 *             audit log row will be missing — acceptable for non-financial events.
 *
 * ─── Pattern B: Inline `await tx.auditLog.create({...})` for: ────────────────
 *   ✅ Payments, refunds, room charges, night audit runs
 *   ✅ Shift submissions, approvals, returns, handovers, bank deposits
 *   ✅ Any operation INSIDE a `prisma.$transaction()` that mutates financial state
 *
 *   Why: the audit record MUST be atomic — it must roll back if the transaction
 *   fails. A non-atomic audit log that reads "PAYMENT_COMPLETED" when the payment
 *   itself rolled back is a compliance failure and a lie in the audit trail.
 *
 * Rule of thumb:
 *   Financial mutation       → Pattern B (inline, atomic)
 *   Admin / config operation → Pattern A (this function, fire-and-forget)
 */
import prisma from '@hotel-pms/db';

import { NotificationEngine } from '@/lib/notification-engine';

export interface AuditLogParams {
  organizationId: string;
  propertyId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        propertyId: params.propertyId,
        userId: params.userId,
        userEmail: params.userEmail,
        userRole: params.userRole,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        previousValue: params.previousValue ? JSON.parse(JSON.stringify(params.previousValue)) : undefined,
        newValue: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId ?? crypto.randomUUID(),
      },
    });

    // Check for Security Exceptions
    const SENSITIVE_ACTIONS = [
      'ROLE_CHANGED', 
      'PERMISSION_CHANGED', 
      'FINANCIAL_OVERRIDE', 
      'UNAUTHORIZED_DISCOUNT', 
      'USER_DEACTIVATED'
    ];

    if (SENSITIVE_ACTIONS.includes(params.action)) {
      await NotificationEngine.emit({
        type: 'SECURITY_EXCEPTION',
        organizationId: params.organizationId,
        propertyId: params.propertyId,
        entityType: 'auditLog',
        entityId: params.resourceId,
        idempotencyKey: `security_${params.requestId || Date.now()}`,
        metadata: {
           alertTitle: `Sensitive Action: ${params.action.replace(/_/g, ' ')}`,
           alertDescription: `User ${params.userEmail || params.userId || 'System'} performed a highly sensitive action: ${params.action} on ${params.resource}.`
        }
      });
    }
  } catch (err) {
    // Audit failures must never crash the main request
    console.error('[Audit] Failed to write audit log:', err);
  }
}
