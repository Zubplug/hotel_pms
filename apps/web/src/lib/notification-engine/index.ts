import { prisma } from '@hotel-pms/db';

export interface NotificationEvent {
  type: string;
  organizationId: string;
  propertyId?: string;
  entityType: string;
  entityId: string;
  incidentKey?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

// Notification threshold policies should be configured per-property in Property.settings.
// For live production, we dynamically fetch these and do not use hardcoded fallbacks.
export interface NotificationPolicy {
  largePaymentThreshold?: number;
  highValueRefundThreshold?: number;
  cashVarianceThreshold?: number;
}

export const NotificationEngine = {
  async emit(event: NotificationEvent) {
    try {
      if (!event.propertyId) {
         // If no property scope, skip policy evaluation for now (or fetch org policy)
         return;
      }

      const policy = await fetchPolicy(event.propertyId);
      if (!policy) return;

      // 1. Evaluate Policy and format notification payload
      const payload = await evaluateEvent(event, policy);
      if (!payload) return; // Event did not meet threshold or criteria

      // 2. Resolve Recipients
      const recipientIds = await resolveRecipients(event.organizationId, event.propertyId);
      if (recipientIds.length === 0) return;

      // 3. Deduplicate
      if (event.incidentKey || event.idempotencyKey) {
        const isDuplicate = await checkDuplicate(recipientIds, event);
        if (isDuplicate) return;
      }

      // 4. Persist
      const notificationRecords = recipientIds.map(recipientId => ({
        recipientId,
        channel: 'in_app',
        subject: payload.subject,
        body: payload.body,
        category: payload.category,
        priority: payload.priority,
        action: `/${event.entityType}/${event.entityId}`, // Generic deep link format
        metadata: event.metadata || {},
      }));

      await prisma.notification.createMany({
        data: notificationRecords,
      });

    } catch (error) {
      console.error('[NotificationEngine] Failed to process event:', error);
    }
  }
};

/**
 * Resolves which users should receive this notification based on RBAC.
 */
async function resolveRecipients(organizationId: string, propertyId?: string): Promise<string[]> {
  const targetRoles = ['Executive', 'Manager', 'General Manager'];

  const whereClause: any = {
    role: {
      name: { in: targetRoles }
    },
    user: {
      organizationId,
      isActive: true,
    }
  };

  if (propertyId) {
    whereClause.OR = [
      { propertyId: propertyId },
      { propertyId: null } // Org-wide executives
    ];
  } else {
    whereClause.propertyId = null;
  }

  const userRoles = await prisma.userRole.findMany({
    where: whereClause,
    select: { userId: true }
  });

  // Unique list of user IDs
  return Array.from(new Set(userRoles.map(ur => ur.userId)));
}

/**
 * Checks if a notification already exists based on incident or idempotency keys.
 */
async function checkDuplicate(recipientIds: string[], event: NotificationEvent): Promise<boolean> {
  const key = event.idempotencyKey || event.incidentKey;
  if (!key) return false;

  // If it's an incidentKey, we might want to check if there's an unread notification with that metadata.
  // We'll use the JSON metadata field to store the keys for lookup.
  const existing = await prisma.notification.findFirst({
    where: {
      recipientId: { in: recipientIds },
      channel: 'in_app',
      readAt: null,
      metadata: {
        path: [event.idempotencyKey ? 'idempotencyKey' : 'incidentKey'],
        equals: key
      }
    }
  });

  return !!existing;
}

/**
 * Fetches the notification policy thresholds directly from the Property settings.
 */
async function fetchPolicy(propertyId: string): Promise<NotificationPolicy | null> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { settings: true }
  });

  if (!property || !property.settings) return null;

  const settings = property.settings as any;
  if (!settings.notificationPolicy) return null;

  return {
    largePaymentThreshold: settings.notificationPolicy.largePaymentThreshold,
    highValueRefundThreshold: settings.notificationPolicy.highValueRefundThreshold,
    cashVarianceThreshold: settings.notificationPolicy.cashVarianceThreshold,
  };
}

/**
 * Evaluates the event against policies to determine if a notification should be sent,
 * and formats the subject/body/category/priority.
 */
async function evaluateEvent(event: NotificationEvent, policy: NotificationPolicy) {
  // Enhance event metadata with keys for deduplication storage
  event.metadata = {
    ...event.metadata,
    ...(event.idempotencyKey && { idempotencyKey: event.idempotencyKey }),
    ...(event.incidentKey && { incidentKey: event.incidentKey }),
  };

  switch (event.type) {
    case 'PAYMENT_LARGE': {
      if (!policy.largePaymentThreshold) return null;
      const payment = await prisma.payment.findUnique({ where: { id: event.entityId } });
      if (!payment || Number(payment.amount) < policy.largePaymentThreshold) return null;
      
      return {
        subject: 'Large Payment Received',
        body: `A payment of ${payment.currency} ${Number(payment.amount).toLocaleString()} was received via ${payment.method}.`,
        category: 'Finance',
        priority: 'Normal',
      };
    }
    
    case 'REFUND_HIGH_VALUE': {
      if (!policy.highValueRefundThreshold) return null;
      const refund = await prisma.refund.findUnique({ where: { id: event.entityId } });
      if (!refund) return null;

      const amount = Number(refund.amount);
      const isOverride = event.metadata?.isManagerOverride === true;

      // Only notify if above threshold OR if it was an override
      if (amount < policy.highValueRefundThreshold && !isOverride) return null;

      return {
        subject: isOverride ? 'Unusual Refund / Manager Override' : 'High-Value Refund',
        body: `A refund of ${refund.currency} ${amount.toLocaleString()} was processed. Reason: ${refund.reason || 'Not specified'}.`,
        category: 'Finance',
        priority: 'Critical',
      };
    }

    case 'CASH_VARIANCE': {
      if (!policy.cashVarianceThreshold) return null;
      const amount = event.metadata?.varianceAmount;
      if (!amount || Math.abs(amount) < policy.cashVarianceThreshold) return null;

      return {
        subject: 'Cash Variance Detected',
        body: `A cash variance of ₦${Math.abs(amount).toLocaleString()} was detected at POS Shift close.`,
        category: 'Finance',
        priority: 'Critical',
      };
    }

    case 'SYSTEM_INCIDENT': {
      return {
        subject: event.metadata?.incidentTitle || 'System Incident',
        body: event.metadata?.incidentDescription || 'A critical system integration is offline.',
        category: 'Critical',
        priority: 'Critical',
      };
    }
    
    case 'ROOM_OOO_CRITICAL': {
      const room = await prisma.room.findUnique({ where: { id: event.entityId } });
      if (!room) return null;

      return {
        subject: `Room ${room.number} Out of Order`,
        body: `Operationally significant room ${room.number} was placed Out of Order.`,
        category: 'Operations',
        priority: 'Normal', // Or Critical depending on occupancy
      };
    }

    // Default fallback - if not handled, don't notify
    default:
      return null;
  }
}
