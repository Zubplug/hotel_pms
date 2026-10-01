type CustomerInvitationEmail = { to: string; inviteUrl: string; expiresAt: Date; organizationName: string };

export async function sendCustomerInvitationEmail(input: CustomerInvitationEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Transactional email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL before sending customer invitations.');
  const expires = input.expiresAt.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [input.to], subject: 'Your LodgeCore customer portal invitation', html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#172033"><h2>Welcome to LodgeCore</h2><p>Your customer portal workspace for <strong>${escapeHtml(input.organizationName)}</strong> is ready.</p><p><a href="${input.inviteUrl}" style="display:inline-block;background:#00d4e8;color:#06251d;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Set your password</a></p><p>This invitation expires ${expires} and can only be used once.</p><p>If you were not expecting this invitation, you can safely ignore this email.</p></div>` }) });
  if (!response.ok) throw new Error(`Customer invitation email delivery failed (${response.status})`);
}

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character); }
