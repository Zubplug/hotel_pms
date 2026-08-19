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
  significantCancellationThreshold?: number;
  significantBookingThreshold?: number;
  creditLimitThreshold?: number;
  notifyOnCheckIn?: boolean;
  notifyOnCheckOut?: boolean;
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

      // 5. Firebase Push Dispatch
      try {
        const { sendPushNotification } = await import('@/lib/firebase-admin');
        const tokens = await prisma.deviceToken.findMany({
          where: { userId: { in: recipientIds } }
        });
        
        for (const t of tokens) {
          // Fire and forget (don't block the engine)
          sendPushNotification(t.token, payload.subject, payload.body, {
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            actionUrl: `/${event.entityType}/${event.entityId}`
          }).catch(err => console.error('[FCM] Push failed:', err));
        }
      } catch (err) {
         console.error('[NotificationEngine] Failed to dispatch FCM:', err);
      }

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
    significantCancellationThreshold: settings.notificationPolicy.significantCancellationThreshold,
    significantBookingThreshold: settings.notificationPolicy.significantBookingThreshold,
    creditLimitThreshold: settings.notificationPolicy.creditLimitThreshold,
    notifyOnCheckIn: settings.notificationPolicy.notifyOnCheckIn,
    notifyOnCheckOut: settings.notificationPolicy.notifyOnCheckOut,
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

    case 'SIGNIFICANT_CANCELLATION': {
      if (!policy.significantCancellationThreshold && !event.metadata?.isVip) return null;
      
      const amount = event.metadata?.bookingValue || 0;
      const isVip = event.metadata?.isVip === true;

      if (amount < (policy.significantCancellationThreshold || Infinity) && !isVip) return null;

      return {
        subject: isVip ? 'VIP Cancellation' : 'Significant Cancellation',
        body: `A booking valued at ₦${amount.toLocaleString()} has been cancelled.`,
        category: 'Operations',
        priority: 'High',
      };
    }

    case 'SIGNIFICANT_BOOKING': {
      if (!policy.significantBookingThreshold && !event.metadata?.isVip) return null;
      
      const amount = event.metadata?.bookingValue || 0;
      const isVip = event.metadata?.isVip === true;

      if (amount < (policy.significantBookingThreshold || Infinity) && !isVip) return null;

      return {
        subject: isVip ? 'VIP Booking Received' : 'High-Value Booking Received',
        body: `A new booking valued at ₦${amount.toLocaleString()} was just created.`,
        category: 'Operations',
        priority: 'Normal',
      };
    }

    case 'CRITICAL_STOCKOUT': {
      const stockItem = await prisma.stockItem.findUnique({ where: { id: event.entityId } });
      if (!stockItem) return null;

      return {
        subject: 'Critical Stockout Alert',
        body: `Inventory for ${stockItem.name} has dropped to ${stockItem.quantityOnHand}, triggering a critical stockout alert.`,
        category: 'Operations',
        priority: 'High',
      };
    }

    case 'SECURITY_EXCEPTION': {
      return {
        subject: event.metadata?.alertTitle || 'Security Exception',
        body: event.metadata?.alertDescription || 'A sensitive security or audit event occurred.',
        category: 'Critical',
        priority: 'Critical',
      };
    }

    case 'CHECK_IN': {
      if (!policy.notifyOnCheckIn && !event.metadata?.isVip) return null;
      
      const resIn = await prisma.reservation.findUnique({
        where: { id: event.entityId },
        include: { guest: true, reservationRooms: { include: { room: true } } }
      });
      const guestNameIn = resIn?.guest?.firstName ? `${resIn.guest.firstName} ${resIn.guest.lastName}` : 'A guest';
      const roomNumIn = resIn?.reservationRooms?.[0]?.room?.number || 'their room';

      return {
        subject: event.metadata?.isVip ? 'VIP Checked In' : 'Guest Checked In',
        body: `${guestNameIn} (Conf: ${resIn?.confirmationNumber || event.entityId}) has checked into Room ${roomNumIn}.`,
        category: 'Operations',
        priority: event.metadata?.isVip ? 'High' : 'Normal',
      };
    }

    case 'CHECK_OUT': {
      if (!policy.notifyOnCheckOut && !event.metadata?.isVip) return null;
      
      const resOut = await prisma.reservation.findUnique({
        where: { id: event.entityId },
        include: { guest: true, reservationRooms: { include: { room: true } } }
      });
      const guestNameOut = resOut?.guest?.firstName ? `${resOut.guest.firstName} ${resOut.guest.lastName}` : 'A guest';
      const roomNumOut = resOut?.reservationRooms?.[0]?.room?.number || 'their room';

      return {
        subject: event.metadata?.isVip ? 'VIP Checked Out' : 'Guest Checked Out',
        body: `${guestNameOut} (Conf: ${resOut?.confirmationNumber || event.entityId}) has checked out of Room ${roomNumOut}.`,
        category: 'Operations',
        priority: event.metadata?.isVip ? 'High' : 'Normal',
      };
    }

    case 'NIGHT_AUDIT_COMPLETED': {
      return {
        subject: 'Night Audit Completed Successfully',
        body: `Business day closed. Processed ${event.metadata?.tasksCreated} stayover tasks.`,
        category: 'Operations',
        priority: 'Normal', // Optional / low-priority
      };
    }

    case 'NIGHT_AUDIT_DISCREPANCY': {
      return {
        subject: 'Night Audit Completed with Discrepancies',
        body: `Business day closed but ${event.metadata?.errors} errors occurred.`,
        category: 'Critical',
        priority: 'Critical',
      };
    }

    case 'NIGHT_AUDIT_FAILED': {
      return {
        subject: 'Night Audit Failed!',
        body: `CRITICAL: The property day could not close. Error: ${event.metadata?.error}`,
        category: 'Critical',
        priority: 'Critical',
      };
    }

    case 'APPROVAL_REQUESTED': {
      return {
        subject: 'Approval Required',
        body: event.metadata?.requestReason || `A staff member requested an override requiring your approval.`,
        category: 'Approvals',
        priority: 'High',
      };
    }

    case 'CREDIT_LIMIT_BREACH': {
      return {
        subject: 'Credit Limit Breached',
        body: `Folio balance has crossed the credit limit threshold. Current Balance: ₦${event.metadata?.newBalance}.`,
        category: 'Finance',
        priority: 'Critical',
      };
    }

    // Default fallback - if not handled, don't notify
    default:
      return null;
  }
}
