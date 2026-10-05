function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] ?? c));
}

async function send(to: string, subject: string, body: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn('[BookingEmail] RESEND_API_KEY is not configured'); return; }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL ?? 'no-reply@lodgecore.com', to: [to], subject, html: `<main style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2>${esc(subject)}</h2>${body}</main>` }),
  });
  if (!response.ok) throw new Error(`Resend failed: ${response.status}`);
}

export async function sendBookingConfirmationEmail(input: {
  to: string; firstName: string; propertyName: string; confirmationNumber: string;
  checkIn: Date; checkOut: Date; roomTypeName: string; total: number; currency: string;
  manageUrl: string; roomNumber?: string | null; paymentRequired?: boolean;
}) {
  const pending = input.paymentRequired === true;
  const subject = pending ? `Payment required — ${input.confirmationNumber}` : `Booking confirmed — ${input.confirmationNumber}`;
  const room = input.roomNumber ? `<p>Assigned room: <strong>${esc(input.roomNumber)}</strong></p>` : '';
  const paymentMessage = pending
    ? `<p>Your reservation is being held pending payment. Use the link below to complete payment.</p>`
    : `<p>Your reservation is confirmed.</p>`;
  await send(input.to, subject, `<p>Hi ${esc(input.firstName)},</p>${paymentMessage}<p>Property: <strong>${esc(input.propertyName)}</strong></p><p>Confirmation: <strong>${esc(input.confirmationNumber)}</strong></p><p>${esc(input.roomTypeName)} · ${input.checkIn.toISOString().slice(0, 10)} to ${input.checkOut.toISOString().slice(0, 10)}</p>${room}<p>Total: ${esc(input.currency)} ${input.total.toFixed(2)}</p><p><a href="${esc(input.manageUrl)}">${pending ? 'Complete payment / manage booking' : 'Manage booking'}</a></p>`);
}

export async function sendPaymentReceiptEmail(input: { to: string; propertyName: string; confirmationNumber: string; amount: number; currency: string; roomNumber?: string | null }) {
  const room = input.roomNumber ? `<p>Assigned room: <strong>${esc(input.roomNumber)}</strong></p>` : '';
  await send(input.to, `Payment received — ${input.confirmationNumber}`, `<p>Payment received for booking <strong>${esc(input.confirmationNumber)}</strong> at ${esc(input.propertyName)}.</p><p>Amount paid: ${esc(input.currency)} ${input.amount.toFixed(2)}</p>${room}<p>Your reservation is now confirmed.</p>`);
}

export async function sendBookingPaymentFailedEmail(input: { to: string; propertyName: string; confirmationNumber: string; amount: number; currency: string; manageUrl?: string }) {
  const retry = input.manageUrl ? `<p><a href="${esc(input.manageUrl)}">Retry payment</a></p>` : '<p>Please return to the booking page or contact the property to retry payment.</p>';
  await send(input.to, `Payment could not be completed — ${input.confirmationNumber}`, `<p>We could not complete payment for booking <strong>${esc(input.confirmationNumber)}</strong> at ${esc(input.propertyName)}.</p><p>Amount due: ${esc(input.currency)} ${input.amount.toFixed(2)}</p><p>Your reservation has not been cancelled.</p>${retry}`);
}

export async function sendBookingCancellationEmail(input: { to: string; propertyName: string; confirmationNumber: string; penaltyAmount: number; currency: string; refundAmount?: number; refundPending?: boolean }) {
  const refund = input.refundAmount && input.refundAmount > 0
    ? `<p>Refund requested: <strong>${esc(input.currency)} ${input.refundAmount.toFixed(2)}</strong>. It is awaiting property approval and processing.</p>`
    : '';
  await send(input.to, `Booking cancelled — ${input.confirmationNumber}`, `<p>Your booking <strong>${esc(input.confirmationNumber)}</strong> at ${esc(input.propertyName)} has been cancelled.</p><p>Cancellation charge: ${esc(input.currency)} ${input.penaltyAmount.toFixed(2)}</p>${refund}`);
}

export async function sendBookingRefundCompletedEmail(input: { to: string; propertyName: string; confirmationNumber: string; amount: number; currency: string; method: string }) {
  await send(input.to, `Refund completed — ${input.confirmationNumber}`, `<p>Your refund for booking <strong>${esc(input.confirmationNumber)}</strong> at ${esc(input.propertyName)} has been completed.</p><p>Refund amount: <strong>${esc(input.currency)} ${input.amount.toFixed(2)}</strong></p><p>Method: ${esc(input.method.replaceAll('_', ' '))}</p>`);
}
