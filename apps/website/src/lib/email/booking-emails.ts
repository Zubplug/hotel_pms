import { displayRoomNumber } from '@/lib/booking-engine/room-number';

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] ?? c));
}

async function send(to: string, subject: string, body: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  if (!from) throw new Error('RESEND_FROM_EMAIL is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html: `<main style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2>${esc(subject)}</h2>${body}</main>` }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Resend failed: ${response.status}${details ? ` — ${details.slice(0, 500)}` : ''}`);
  }
}

export async function sendBookingConfirmationEmail(input: {
  to: string; firstName: string; propertyName: string; confirmationNumber: string;
  checkIn: Date; checkOut: Date; roomTypeName: string; total: number; currency: string;
  manageUrl: string; cancellationUrl?: string; cancellationToken?: string;
  roomNumber?: string | null; paymentRequired?: boolean;
}) {
  const pending = input.paymentRequired === true;
  const subject = pending ? `Payment required — ${input.confirmationNumber}` : `Booking confirmed — ${input.confirmationNumber}`;
  const roomNumber = displayRoomNumber(input.roomNumber);
  const room = roomNumber ? `<p>Assigned room: <strong>${esc(roomNumber)}</strong></p>` : '';
  const paymentMessage = pending
    ? `<p>Your reservation is being held pending payment. Use the link below to complete payment.</p>`
    : `<p>Your reservation is confirmed.</p>`;
  const cancellation = input.cancellationUrl
    ? `<p><a href="${esc(input.cancellationUrl)}">Manage or cancel this booking</a></p>`
    : '';
  const token = input.cancellationToken
    ? `<p style="font-size:12px;color:#666">Cancellation token: <code>${esc(input.cancellationToken)}</code></p>`
    : '';
  await send(input.to, subject, `<p>Hi ${esc(input.firstName)},</p>${paymentMessage}<p>Property: <strong>${esc(input.propertyName)}</strong></p><p>Confirmation: <strong>${esc(input.confirmationNumber)}</strong></p><p>${esc(input.roomTypeName)} · ${input.checkIn.toISOString().slice(0, 10)} to ${input.checkOut.toISOString().slice(0, 10)}</p>${room}<p>Total: ${esc(input.currency)} ${input.total.toFixed(2)}</p><p><a href="${esc(input.manageUrl)}">${pending ? 'Complete payment / manage booking' : 'View booking'}</a></p>${cancellation}${token}`);
}

export async function sendPaymentReceiptEmail(input: { to: string; propertyName: string; confirmationNumber: string; amount: number; currency: string; roomNumber?: string | null }) {
  const roomNumber = displayRoomNumber(input.roomNumber);
  const room = roomNumber ? `<p>Assigned room: <strong>${esc(roomNumber)}</strong></p>` : '';
  await send(input.to, `Payment receipt — ${input.confirmationNumber}`, `<p>Your payment for booking <strong>${esc(input.confirmationNumber)}</strong> at ${esc(input.propertyName)} was received successfully.</p><p>Amount paid: ${esc(input.currency)} ${input.amount.toFixed(2)}</p>${room}<p>Please keep this receipt for your records.</p>`);
}

export async function sendBookingConfirmedEmail(input: {
  to: string;
  firstName: string;
  propertyName: string;
  confirmationNumber: string;
  checkIn: Date;
  checkOut: Date;
  roomTypeName: string;
  roomNumber?: string | null;
  adults: number;
  children: number;
  currency: string;
  total: number;
}) {
  const roomNumber = displayRoomNumber(input.roomNumber);
  const room = roomNumber ? `<p>Assigned room: <strong>${esc(roomNumber)}</strong></p>` : '';
  const nights = Math.max(1, Math.ceil((input.checkOut.getTime() - input.checkIn.getTime()) / 86_400_000));
  await send(
    input.to,
    `Reservation confirmed — ${input.confirmationNumber}`,
    `<p>Dear ${esc(input.firstName)},</p><p>We are pleased to confirm your reservation at <strong>${esc(input.propertyName)}</strong>.</p><div style="background:#f6f7f7;border-radius:8px;padding:16px;margin:20px 0"><p><strong>Booking reference:</strong> ${esc(input.confirmationNumber)}</p><p><strong>Stay:</strong> ${input.checkIn.toISOString().slice(0, 10)} to ${input.checkOut.toISOString().slice(0, 10)} (${nights} night${nights === 1 ? '' : 's'})</p><p><strong>Room:</strong> ${esc(input.roomTypeName)}</p>${room}<p><strong>Guests:</strong> ${input.adults} adult${input.adults === 1 ? '' : 's'}${input.children ? `, ${input.children} child${input.children === 1 ? '' : 'ren'}` : ''}</p><p><strong>Total:</strong> ${esc(input.currency)} ${input.total.toFixed(2)}</p></div><p>We look forward to welcoming you. Please keep your booking reference for check-in.</p><p>If you need assistance, please contact the property directly.</p>`,
  );
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

export async function sendBookingExpiredEmail(input: { to: string; propertyName: string; confirmationNumber: string }) {
  await send(input.to, `Reservation expired — ${input.confirmationNumber}`, `<p>Your reservation <strong>${esc(input.confirmationNumber)}</strong> at <strong>${esc(input.propertyName)}</strong> expired because payment was not completed within the payment window.</p><p>No payment was captured and the room hold has been released. Please make a new reservation if you would still like to stay with us.</p>`);
}

export async function sendBookingRefundCompletedEmail(input: { to: string; propertyName: string; confirmationNumber: string; amount: number; currency: string; method: string }) {
  await send(input.to, `Refund completed — ${input.confirmationNumber}`, `<p>Your refund for booking <strong>${esc(input.confirmationNumber)}</strong> at ${esc(input.propertyName)} has been completed.</p><p>Refund amount: <strong>${esc(input.currency)} ${input.amount.toFixed(2)}</strong></p><p>Method: ${esc(input.method.replaceAll('_', ' '))}</p>`);
}
