type EmployeeInvitationEmail = { to: string; inviteUrl: string; expiresAt: Date; employeeName: string; organizationName: string; roleTitle?: string };

export async function sendEmployeeInvitationEmail(input: EmployeeInvitationEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Transactional email is not configured.');
  const expires = input.expiresAt.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });
  const roleTitle = input.roleTitle || 'employee';
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [input.to], subject: `Activate your LodgeCore ${roleTitle} account`, html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#172033"><h2>Welcome to LodgeCore</h2><p>Hello <strong>${escapeHtml(input.employeeName)}</strong>, your ${escapeHtml(roleTitle)} account for <strong>${escapeHtml(input.organizationName)}</strong> is ready.</p><p><a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;background:#00d4e8;color:#06251d;padding:12px 18px;border-radius:8px;font-weight:700">Activate account</a></p><p>This secure link expires ${expires} and can only be used once.</p></div>` }) });
  if (!response.ok) throw new Error(`Employee invitation email delivery failed (${response.status})`);
}

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character); }
