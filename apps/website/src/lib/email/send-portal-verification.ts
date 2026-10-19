type PortalVerificationEmail = { to: string; verificationUrl: string; expiresAt: Date };

export async function sendPortalVerificationEmail(input: PortalVerificationEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Transactional email is not configured.');
  const expires = input.expiresAt.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [input.to], subject: 'Verify your LodgeCore portal email', html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#172033"><h2>Welcome to LodgeCore</h2><p>Verify your email address to continue to your customer portal and start your 7-day trial.</p><p><a href="${escapeHtml(input.verificationUrl)}" style="display:inline-block;background:#00d4e8;color:#06251d;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Verify email</a></p><p>This link expires ${escapeHtml(expires)} and can only be used once.</p></div>` }),
  });
  if (!response.ok) throw new Error(`Verification email delivery failed (${response.status})`);
}

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character); }
