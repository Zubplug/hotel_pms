import crypto from 'crypto';

function secret() {
  const value = process.env.CMS_PREVIEW_SECRET;
  if (!value || value.length < 32) throw new Error('CMS_PREVIEW_SECRET must be configured with at least 32 characters');
  return value;
}

export function verifyPreviewToken(token: string, projectId: string, revisionId: string): boolean {
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return false;
    const expected = crypto.createHmac('sha256', secret()).update(encoded).digest('base64url');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { projectId: string; revisionId: string; exp: number };
    return payload.projectId === projectId && payload.revisionId === revisionId && payload.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
