function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] || c)); }

export async function sendCorporatePortalLoginEmail(input: { to: string; accountName: string; loginToken: string; expiresAt: Date }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const origin = (process.env.CORPORATE_PORTAL_ORIGIN || '').replace(/\/$/, '');
  if (!apiKey || !from || !origin) throw new Error('Corporate portal email is not configured.');
  const loginUrl = `${origin}/corporate/verify?token=${encodeURIComponent(input.loginToken)}`;
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [input.to], subject: 'Your Stanzel corporate portal sign-in link', html: `<main style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2>Stanzel Grand Resort corporate portal</h2><p>Sign in to <strong>${escapeHtml(input.accountName)}</strong>.</p><p><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#143d35;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Open corporate portal</a></p><p>This secure link expires at ${escapeHtml(input.expiresAt.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }))} and can be used once.</p><p>If you did not request this email, you can safely ignore it.</p></main>` }) });
  if (!response.ok) throw new Error(`Corporate portal email delivery failed (${response.status})`);
}
