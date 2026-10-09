import crypto from 'crypto';

function secret() {
  const value = process.env.CMS_PREVIEW_SECRET;
  if (!value || value.length < 32) throw new Error('CMS_PREVIEW_SECRET must be configured with at least 32 characters');
  return value;
}

export function createPreviewToken(projectId: string, revisionId: string, ttlSeconds = 3600) {
  const payload = Buffer.from(JSON.stringify({ projectId, revisionId, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', secret()).update(payload).digest('base64url')}`;
}
