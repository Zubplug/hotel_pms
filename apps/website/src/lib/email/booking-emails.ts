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
  manageUrl: string;
}) {
  await send(input.to, `Booking confirmed — ${input.confirmationNumber}`, `<p>Hi ${esc(input.firstName)}, your booking at <strong>${esc(input.propertyName)}</strong> is confirmed.</p><p>Confirmation: <strong>${esc(input.confirmationNumber)}</strong></p><p>${esc(input.roomTypeName)} · ${input.checkIn.toISOString().slice(0, 10)} to ${input.checkOut.toISOString().slice(0, 10)}</p><p>Total: ${esc(input.currency)} ${input.total.toFixed(2)}</p><p><a href="${esc(input.manageUrl)}">Manage booking</a></p>`);
}

export async function sendPaymentReceiptEmail(input: { to: string; propertyName: string; confirmationNumber: string; amount: number; currency: string }) {
  await send(input.to, `Payment received — ${input.confirmationNumber}`, `<p>Payment received for booking <strong>${esc(input.confirmationNumber)}</strong> at ${esc(input.propertyName)}.</p><p>Amount paid: ${esc(input.currency)} ${input.amount.toFixed(2)}</p>`);
}

export async function sendBookingCancellationEmail(input: { to: string; propertyName: string; confirmationNumber: string; penaltyAmount: number; currency: string }) {
  await send(input.to, `Booking cancelled — ${input.confirmationNumber}`, `<p>Your booking <strong>${esc(input.confirmationNumber)}</strong> at ${esc(input.propertyName)} has been cancelled.</p><p>Cancellation charge: ${esc(input.currency)} ${input.penaltyAmount.toFixed(2)}</p>`);
}

