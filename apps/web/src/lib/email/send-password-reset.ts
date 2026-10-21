type PasswordResetEmail = { to: string; resetUrl: string; expiresAt: Date };

export async function sendPasswordResetEmail(input: PasswordResetEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Transactional email is not configured.');
  const expires = input.expiresAt.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: 'Reset your LodgeCore PMS password',
      html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#172033"><h2>Password reset</h2><p>We received a request to update your LodgeCore PMS password.</p><p><a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Update password</a></p><p>This secure link expires ${escapeHtml(expires)} and can only be used once.</p><p>If you did not request this, you can safely ignore this email.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Password reset email delivery failed (${response.status})`);
}

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character); }
