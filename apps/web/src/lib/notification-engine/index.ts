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
  notifyOnReservationCreated?: boolean;
  notifyOnReservationCancelled?: boolean;
  notifyOnStayExtended?: boolean;
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
        organizationId: event.organizationId,
        propertyId: event.propertyId,
        recipientType: 'staff',
        recipientId,
        status: 'sent',
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
  const targetRoles = ['Executive', 'Manager', 'General Manager', 'DIRECTOR'];

  const whereClause: any = {
    role: {
      name: { in: targetRoles },
      organizationId,
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

  const settings = (property?.settings as any) || {};
  const np = settings.notificationPolicy || {};

  return {
    largePaymentThreshold: np.largePaymentThreshold,
    highValueRefundThreshold: np.highValueRefundThreshold,
    cashVarianceThreshold: np.cashVarianceThreshold,
    significantCancellationThreshold: np.significantCancellationThreshold,
    significantBookingThreshold: np.significantBookingThreshold,
    creditLimitThreshold: np.creditLimitThreshold,
    notifyOnCheckIn: np.notifyOnCheckIn ?? true,
    notifyOnCheckOut: np.notifyOnCheckOut ?? true,
    notifyOnReservationCreated: np.notifyOnReservationCreated ?? true,
    notifyOnReservationCancelled: np.notifyOnReservationCancelled ?? true,
    notifyOnStayExtended: np.notifyOnStayExtended ?? true,
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
        include: { primaryGuest: true, reservationRooms: { include: { room: { include: { roomType: true } } } } }
      });
      if (!resIn) return null;
      const guestNameIn = resIn.primaryGuest?.firstName ? `${resIn.primaryGuest.firstName} ${resIn.primaryGuest.lastName}` : 'A guest';
      const rawRoomIn = resIn.reservationRooms?.[0]?.room?.number;
      const roomNumIn = rawRoomIn ? rawRoomIn.split('.').pop() : 'N/A';
      const roomTypeIn = resIn.reservationRooms?.[0]?.room?.roomType?.name || 'Room';
      const phoneIn = resIn.primaryGuest?.phone || 'N/A';
      const checkOutIn = resIn.checkOut.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const nightsIn = Math.ceil((resIn.checkOut.getTime() - resIn.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const adultsIn = resIn.adults || 1;
      const balanceIn = resIn.totalAmount ? `₦${Number(resIn.totalAmount).toLocaleString()}` : 'N/A';

      return {
        subject: event.metadata?.isVip ? `⭐ VIP Checked In — ${guestNameIn}` : `✅ Guest Checked In — ${guestNameIn}`,
        body: `${event.metadata?.isVip ? '⭐ VIP ' : ''}📋 Conf: ${resIn.confirmationNumber || event.entityId}\n👤 Guest: ${guestNameIn} | 📞 ${phoneIn}\n🏠 Room ${roomNumIn} (${roomTypeIn})\n📅 Check-out: ${checkOutIn} (${nightsIn} night${nightsIn !== 1 ? 's' : ''})\n👥 Adults: ${adultsIn}\n💰 Booking Value: ${balanceIn}`,
        category: 'Operations',
        priority: event.metadata?.isVip ? 'High' : 'Normal',
      };
    }

    case 'CHECK_OUT': {
      if (!policy.notifyOnCheckOut && !event.metadata?.isVip) return null;
      
      const resOut = await prisma.reservation.findUnique({
        where: { id: event.entityId },
        include: { primaryGuest: true, reservationRooms: { include: { room: { include: { roomType: true } } } } }
      });
      if (!resOut) return null;
      const guestNameOut = resOut.primaryGuest?.firstName ? `${resOut.primaryGuest.firstName} ${resOut.primaryGuest.lastName}` : 'A guest';
      const rawRoomOut = resOut.reservationRooms?.[0]?.room?.number;
      const roomNumOut = rawRoomOut ? rawRoomOut.split('.').pop() : 'N/A';
      const roomTypeOut = resOut.reservationRooms?.[0]?.room?.roomType?.name || 'Room';
      const phoneOut = resOut.primaryGuest?.phone || 'N/A';
      const checkInOut = resOut.checkIn.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const nightsOut = Math.ceil((resOut.checkOut.getTime() - resOut.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const totalOut = resOut.totalAmount ? `₦${Number(resOut.totalAmount).toLocaleString()}` : 'N/A';
      const balanceDue = (resOut as any).balanceDue;
      const balanceOut = balanceDue != null ? `₦${Number(balanceDue).toLocaleString()}` : 'Settled';

      return {
        subject: event.metadata?.isVip ? `⭐ VIP Checked Out — ${guestNameOut}` : `🚪 Guest Checked Out — ${guestNameOut}`,
        body: `${event.metadata?.isVip ? '⭐ VIP ' : ''}📋 Conf: ${resOut.confirmationNumber || event.entityId}\n👤 Guest: ${guestNameOut} | 📞 ${phoneOut}\n🏠 Room ${roomNumOut} (${roomTypeOut})\n📅 Stayed: ${checkInOut} (${nightsOut} night${nightsOut !== 1 ? 's' : ''})\n💰 Total Charged: ${totalOut}\n🧾 Balance: ${balanceOut}`,
        category: 'Operations',
        priority: event.metadata?.isVip ? 'High' : 'Normal',
      };
    }

    case 'RESERVATION_CREATED': {
      if (!policy.notifyOnReservationCreated) return null;
      const res = await prisma.reservation.findUnique({
        where: { id: event.entityId },
        include: {
          primaryGuest: true,
          reservationRooms: { include: { room: { include: { roomType: true } } } },
        }
      });
      if (!res) return null;
      const guestName = res.primaryGuest?.firstName ? `${res.primaryGuest.firstName} ${res.primaryGuest.lastName}` : 'A guest';
      const checkIn = res.checkIn.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const checkOut = res.checkOut.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const nights = Math.ceil((res.checkOut.getTime() - res.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const roomDetails = res.reservationRooms.map(rr => {
        const roomNum = rr.room.number.split('.').pop();
        const type = rr.room.roomType?.name || 'Room';
        return `Room ${roomNum} (${type})`;
      }).join(', ');
      const totalAmount = res.totalAmount ? `₦${Number(res.totalAmount).toLocaleString()}` : 'N/A';
      const adults = res.adults || 1;
      const phone = res.primaryGuest?.phone || 'N/A';
      
      return {
        subject: `New Reservation — ${guestName}`,
        body: `📋 Conf: ${res.confirmationNumber || event.entityId}\n👤 Guest: ${guestName} | 📞 ${phone}\n🏠 ${roomDetails}\n📅 Check-in: ${checkIn} → Check-out: ${checkOut} (${nights} night${nights !== 1 ? 's' : ''})\n👥 Adults: ${adults}\n💰 Total: ${totalAmount}`,
        category: 'Operations',
        priority: 'Normal',
      };
    }

    case 'RESERVATION_CANCELLED': {
      if (!policy.notifyOnReservationCancelled) return null;
      const res = await prisma.reservation.findUnique({
        where: { id: event.entityId },
        include: {
          primaryGuest: true,
          reservationRooms: { include: { room: { include: { roomType: true } } } },
        }
      });
      if (!res) return null;
      const guestName = res.primaryGuest?.firstName ? `${res.primaryGuest.firstName} ${res.primaryGuest.lastName}` : 'A guest';
      const checkIn = res.checkIn.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const checkOut = res.checkOut.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const nights = Math.ceil((res.checkOut.getTime() - res.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const roomDetails = res.reservationRooms.map(rr => {
        const roomNum = rr.room.number.split('.').pop();
        const type = rr.room.roomType?.name || 'Room';
        return `Room ${roomNum} (${type})`;
      }).join(', ');
      const totalAmount = res.totalAmount ? `₦${Number(res.totalAmount).toLocaleString()}` : 'N/A';
      const phone = res.primaryGuest?.phone || 'N/A';
      const cancelReason = (event.metadata?.reason as string) || (res as any).cancellationReason || 'No reason provided';
      
      return {
        subject: `Reservation Cancelled — ${guestName}`,
        body: `❌ Conf: ${res.confirmationNumber || event.entityId}\n👤 Guest: ${guestName} | 📞 ${phone}\n🏠 ${roomDetails || 'N/A'}\n📅 Was: ${checkIn} → ${checkOut} (${nights} night${nights !== 1 ? 's' : ''})\n💰 Value: ${totalAmount}\n📝 Reason: ${cancelReason}`,
        category: 'Operations',
        priority: 'High',
      };
    }

    case 'STAY_EXTENDED': {
      if (!policy.notifyOnStayExtended) return null;
      const res = await prisma.reservation.findUnique({
        where: { id: event.entityId },
        include: { primaryGuest: true, reservationRooms: { include: { room: { include: { roomType: true } } } } }
      });
      if (!res) return null;
      const guestName = res.primaryGuest?.firstName ? `${res.primaryGuest.firstName} ${res.primaryGuest.lastName}` : 'A guest';
      const rawRoom = res.reservationRooms?.[0]?.room?.number;
      const roomNum = rawRoom ? rawRoom.split('.').pop() : 'N/A';
      const roomType = res.reservationRooms?.[0]?.room?.roomType?.name || 'Room';
      const phone = res.primaryGuest?.phone || 'N/A';
      const prevCheckOut = event.metadata?.previousCheckOut
        ? new Date(event.metadata.previousCheckOut as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'N/A';
      const newCheckOut = res.checkOut.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const totalNights = Math.ceil((res.checkOut.getTime() - res.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const totalAmount = res.totalAmount ? `₦${Number(res.totalAmount).toLocaleString()}` : 'N/A';
      
      return {
        subject: `📆 Stay Extended — ${guestName}`,
        body: `📋 Conf: ${res.confirmationNumber || event.entityId}\n👤 Guest: ${guestName} | 📞 ${phone}\n🏠 Room ${roomNum} (${roomType})\n📅 Previous Check-out: ${prevCheckOut}\n📅 New Check-out: ${newCheckOut} (${totalNights} night${totalNights !== 1 ? 's' : ''} total)\n💰 Updated Total: ${totalAmount}`,
        category: 'Operations',
        priority: 'Normal',
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
