type DemoCredentialsEmail = {
  to: string;
  firstName: string;
  roleName: string;
  organizationName: string;
  propertyName: string;
  password: string;
  pin: string;
  expiresAt: Date;
};

export async function sendDemoCredentialsEmail(input: DemoCredentialsEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Transactional email is not configured.');

  const managementLoginUrl = `${process.env.MANAGEMENT_APP_URL || 'https://lodgecore.vercel.app'}/login`;
  const playStoreUrl = process.env.PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.lodgecore.management';
  const expires = input.expiresAt.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });
  const roleTitle = input.roleName.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: 'Your LodgeCore demo access is ready',
      html: `<main style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:640px;margin:auto">
        <h2>Welcome to your LodgeCore demo</h2>
        <p>Hello <strong>${escapeHtml(input.firstName)}</strong>, your temporary <strong>${escapeHtml(roleTitle)}</strong> account for <strong>${escapeHtml(input.propertyName)}</strong> is ready.</p>
        <p>This access is linked to ${escapeHtml(input.organizationName)} and expires on <strong>${escapeHtml(expires)}</strong>.</p>
        <h3>Web access</h3>
        <p><a href="${escapeHtml(managementLoginUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Open web management portal</a></p>
        <p><strong>Email:</strong> ${escapeHtml(input.to)}<br><strong>Password:</strong> ${escapeHtml(input.password)}</p>
        <h3>Mobile access</h3>
        <p><a href="${escapeHtml(playStoreUrl)}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Install LodgeCore Mobile from Google Play</a></p>
        <p>Use the same email address and this mobile PIN: <strong>${escapeHtml(input.pin)}</strong></p>
        <p style="color:#64748b;font-size:13px">This is a temporary demo account. Keep these credentials private. Access is automatically disabled after 24 hours.</p>
      </main>`,
    }),
  });
  if (!response.ok) throw new Error(`Demo credentials email delivery failed (${response.status})`);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}
