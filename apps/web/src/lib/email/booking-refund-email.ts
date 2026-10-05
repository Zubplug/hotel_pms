function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] ?? c));
}

export async function sendBookingRefundCompletedEmail(input: {
  to: string;
  propertyName: string;
  confirmationNumber: string;
  amount: number;
  currency: string;
  method: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[BookingRefundEmail] RESEND_API_KEY is not configured');
    return;
  }
  const subject = `Refund completed — ${input.confirmationNumber}`;
  const html = `<main style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2>${esc(subject)}</h2><p>Your refund for booking <strong>${esc(input.confirmationNumber)}</strong> at ${esc(input.propertyName)} has been completed.</p><p>Refund amount: <strong>${esc(input.currency)} ${input.amount.toFixed(2)}</strong></p><p>Method: ${esc(input.method.replaceAll('_', ' '))}</p></main>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL ?? 'no-reply@lodgecore.com', to: [input.to], subject, html }),
  });
  if (!response.ok) throw new Error(`Resend failed: ${response.status}`);
}
