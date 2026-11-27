/**
 * Commerce Notification Service
 *
 * Sends multi-channel notifications for Commerce order events.
 *
 * Email: Resend API — same provider used by all other LodgeCore emails
 *   (send-password-reset.ts, send-customer-invitation.ts, etc.)
 *   Uses: RESEND_API_KEY + LODGECORE_FROM_EMAIL env vars.
 *
 * SMS: Termii API — first SMS integration in the codebase.
 *   Uses: TERMII_API_KEY env var.
 *
 * Delivery policy:
 *   SMS and email are delivered independently when enabled. SMS retries up
 *   to three times; email remains an independent delivery record rather than
 *   being delayed behind SMS failure.
 *   WhatsApp fails → silent (supplementary only)
 *
 * Every send attempt is logged to CommerceNotificationLog.
 */

import prisma from '@hotel-pms/db';

export type CommerceNotificationEvent =
  | 'ORDER_PLACED'
  | 'PAYMENT_CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'SYNC_DELAYED';

interface NotificationInput {
  orderId: string;
  storeId: string;
  event: CommerceNotificationEvent;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  store: {
    notifySmsEnabled: boolean;
    notifyEmailEnabled: boolean;
    notifyWhatsappEnabled?: boolean;
    termiiSenderName?: string | null;
  };
}

const EVENT_MESSAGES: Record<CommerceNotificationEvent, (name: string) => string> = {
  ORDER_PLACED:       (n) => `Hi ${n}, your order has been received! We'll notify you when it's being prepared.`,
  PAYMENT_CONFIRMED:  (n) => `Hi ${n}, payment confirmed! Your order is queued for our kitchen and bar teams.`,
  PREPARING:          (n) => `Hi ${n}, great news! Your order is now being prepared.`,
  READY:              (n) => `Hi ${n}, your order is ready and awaiting final service arrangements.`,
  READY_FOR_PICKUP:   (n) => `Hi ${n}, your order is ready for pickup! Please come collect it.`,
  OUT_FOR_DELIVERY:   (n) => `Hi ${n}, your order is on its way! Our driver is heading to you.`,
  DELIVERED:          (n) => `Hi ${n}, your order has been delivered. Enjoy your meal! 🍽️`,
  CANCELLED:          (n) => `Hi ${n}, your order has been cancelled. Contact the restaurant for assistance.`,
  SYNC_DELAYED:       (n) => `Hi ${n}, we're experiencing a brief delay. We'll update you shortly.`,
};

const EVENT_SUBJECTS: Record<CommerceNotificationEvent, string> = {
  ORDER_PLACED:      'Order received — we got it!',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  PREPARING:         'Your order is being prepared',
  READY:             'Your order is ready',
  READY_FOR_PICKUP:  'Ready for pickup!',
  OUT_FOR_DELIVERY:  'Your order is on its way',
  DELIVERED:         'Order delivered — enjoy!',
  CANCELLED:         'Order cancelled',
  SYNC_DELAYED:      'Order update',
};

/**
 * Sends order notifications across configured channels.
 * All attempts are logged to CommerceNotificationLog.
 */
export async function sendOrderNotification(input: NotificationInput): Promise<void> {
  const { storeId, orderId, event, customer, store } = input;
  const message = EVENT_MESSAGES[event](customer.name);

  // SMS and email are independent customer preferences. When both are
  // enabled, deliver through both channels; email is not merely an SMS
  // fallback. This gives customers a reliable status trail on every update.
  if (store.notifySmsEnabled) {
    await attemptSms({
      orderId, storeId, event,
      phone: customer.phone,
      message,
      senderName: store.termiiSenderName ?? 'LodgeCore',
      attempt: 1,
      fallbackEmail: undefined,
      customerName: customer.name,
    });
  }
  if (store.notifyEmailEnabled && customer.email) {
    await attemptEmail({ orderId, storeId, event, email: customer.email, name: customer.name, message });
  }
}

// ---------------------------------------------------------------------------
// SMS via Termii
// ---------------------------------------------------------------------------

async function attemptSms(opts: {
  orderId: string;
  storeId: string;
  event: CommerceNotificationEvent;
  phone: string;
  message: string;
  senderName: string;
  attempt: number;
  fallbackEmail?: string;
  customerName: string;
}) {
  const { orderId, storeId, event, phone, message, senderName, attempt, fallbackEmail, customerName } = opts;

  const log = await prisma.commerceNotificationLog.create({
    data: {
      storeId, orderId,
      channel: 'SMS',
      event,
      recipient: phone,
      status: 'PENDING',
      attemptCount: attempt,
      lastAttemptAt: new Date(),
    },
  });

  try {
    const termiiKey = process.env.TERMII_API_KEY;
    if (!termiiKey) throw new Error('TERMII_API_KEY not configured');

    const res = await fetch('https://v3.api.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone,
        from: senderName,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: termiiKey,
      }),
    });

    const data = await res.json() as { code?: string; message_id?: string; pinId?: string; status?: string };
    const success = res.ok && (data.code === 'ok' || !!data.message_id);

    await prisma.commerceNotificationLog.update({
      where: { id: log.id },
      data: {
        status: success ? 'SENT' : 'FAILED',
        providerRef: data.message_id ?? data.pinId ?? null,
        providerStatus: String(data.code ?? data.status ?? ''),
        failureReason: success ? null : JSON.stringify(data),
        deliveredAt: success ? new Date() : null,
      },
    });

    if (!success && attempt < 3) {
      // Retry — Decision 01 fallback chain: retry ×2 before email
      setTimeout(() => attemptSms({ ...opts, attempt: attempt + 1 }), attempt * 2000);
    } else if (!success && attempt >= 3 && fallbackEmail) {
      // Exhausted SMS retries — fall back to email
      console.warn(`[CommerceNotifications] SMS exhausted for order ${orderId}, falling back to email`);
      await attemptEmail({ orderId, storeId, event, email: fallbackEmail, name: customerName, message, fallbackFromSms: true, originalLogId: log.id });
    }
  } catch (err) {
    await prisma.commerceNotificationLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        failureReason: err instanceof Error ? err.message : 'Unknown error',
      },
    });

    if (attempt >= 3 && fallbackEmail) {
      await attemptEmail({ orderId, storeId, event, email: fallbackEmail, name: customerName, message, fallbackFromSms: true, originalLogId: log.id });
    }
  }
}

// ---------------------------------------------------------------------------
// Email via Resend — same provider used throughout LodgeCore
// (see lib/email/send-password-reset.ts, send-customer-invitation.ts, etc.)
// ---------------------------------------------------------------------------

async function attemptEmail(opts: {
  orderId: string;
  storeId: string;
  event: CommerceNotificationEvent;
  email: string;
  name: string;
  message: string;
  fallbackFromSms?: boolean;
  originalLogId?: string;
}) {
  const { orderId, storeId, event, email, message, fallbackFromSms, originalLogId } = opts;

  const log = await prisma.commerceNotificationLog.create({
    data: {
      storeId, orderId,
      channel: 'EMAIL',
      event,
      recipient: email,
      status: 'PENDING',
      attemptCount: 1,
      lastAttemptAt: new Date(),
      fallbackChannel: fallbackFromSms ? 'SMS' : null,
      fallbackLogId: originalLogId ?? null,
    },
  });

  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.LODGECORE_FROM_EMAIL;
    if (!apiKey || !from) throw new Error('RESEND_API_KEY or LODGECORE_FROM_EMAIL not configured');

    const subject = EVENT_SUBJECTS[event];

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#172033;max-width:480px">
            <h2 style="font-size:20px;margin-bottom:8px">${subject}</h2>
            <p style="font-size:16px">${escapeHtml(message)}</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
            <p style="font-size:12px;color:#9ca3af">Powered by LodgeCore Food Commerce</p>
          </div>`,
      }),
    });

    if (!res.ok) throw new Error(`Resend delivery failed (${res.status})`);

    await prisma.commerceNotificationLog.update({
      where: { id: log.id },
      data: { status: 'SENT', deliveredAt: new Date() },
    });
  } catch (err) {
    await prisma.commerceNotificationLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        failureReason: err instanceof Error ? err.message : 'Unknown error',
      },
    });
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"/]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '/': '&#x2F;' })[c] ?? c,
  );
}
