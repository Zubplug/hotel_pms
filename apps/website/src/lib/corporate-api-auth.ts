import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import prisma from '@hotel-pms/db';
import { hasEntitlement } from './auth/entitlement';
import { resolveCorporatePortalSession } from './corporate-portal-auth';

export const CORPORATE_API_SCOPES = [
  'properties:read', 'availability:read', 'quotes:create', 'quotes:read',
  'bookings:create', 'bookings:read', 'bookings:cancel',
  'rates:negotiate', 'account:read', 'invoices:read', 'invoices:pay',
] as const;
export type CorporateApiScope = typeof CORPORATE_API_SCOPES[number];

// Corporate API access is granted only by its dedicated, recurring add-on.
// Standalone website development and Booking Engine products are separate offerings.
export const CORPORATE_API_ENTITLEMENT_CODES = ['ADDON_CORPORATE_API'] as const;

export class CorporateApiAuthError extends Error {
  constructor(public readonly status: 401 | 403 | 413 | 429, message: string) {
    super(message);
    this.name = 'CorporateApiAuthError';
  }
}

export interface CorporateApiPrincipal {
  partnerId: string;
  credentialId: string;
  organizationId: string;
  environment: string;
  scopes: readonly CorporateApiScope[];
  propertyIds: readonly string[];
  rateLimitPerMinute: number;
  requestSizeLimitBytes: number;
  corporateAccountId?: string;
}

export interface IssueCredentialResult {
  id: string;
  prefix: string;
  token: string;
  environment: string;
  scopes: CorporateApiScope[];
  expiresAt: Date | null;
}

const GENERIC_AUTH_MESSAGE = 'Invalid corporate API credentials';
const GENERIC_SCOPE_MESSAGE = 'Insufficient corporate API scope';

function validScopes(scopes: readonly string[]): CorporateApiScope[] {
  return [...new Set(scopes)].filter((scope): scope is CorporateApiScope =>
    (CORPORATE_API_SCOPES as readonly string[]).includes(scope),
  );
}

export function parseCorporateBearerToken(value: string | null | undefined): { prefix: string; secret: string } | null {
  if (!value) return null;
  const match = value.match(/^Bearer\s+([^\s.]+)\.([^\s]+)$/i);
  if (!match || !match[1] || !match[2]) return null;
  return { prefix: match[1], secret: match[2] };
}

export function hasCorporateApiScope(principal: Pick<CorporateApiPrincipal, 'scopes'>, scope: CorporateApiScope): boolean {
  return principal.scopes.includes(scope);
}

export function assertCorporateApiScope(principal: CorporateApiPrincipal, scope: CorporateApiScope, propertyId?: string): void {
  if (!hasCorporateApiScope(principal, scope)) throw new CorporateApiAuthError(403, GENERIC_SCOPE_MESSAGE);
  if (propertyId && !principal.propertyIds.includes(propertyId)) {
    throw new CorporateApiAuthError(403, 'Corporate resource is not available');
  }
}

export function assertCorporateRequestSize(contentLength: string | null | undefined, limitBytes: number): void {
  if (!contentLength) return;
  const length = Number(contentLength);
  if (!Number.isFinite(length) || length < 0 || length > limitBytes) {
    throw new CorporateApiAuthError(413, 'Corporate API request is too large');
  }
}

export async function hasCorporateApiEntitlement(organizationId: string, propertyId: string): Promise<boolean> {
  for (const code of CORPORATE_API_ENTITLEMENT_CODES) {
    if (await hasEntitlement(organizationId, code, propertyId)) return true;
  }
  return false;
}

function credentialPrefix(environment: string): string {
  return `lc_corp_${environment.toLowerCase()}_${randomBytes(8).toString('hex')}`;
}

export async function issueCorporateApiCredential(
  db: any,
  input: { partnerId: string; environment: 'TEST' | 'LIVE'; scopes: readonly string[]; expiresAt?: Date | null },
): Promise<IssueCredentialResult> {
  const scopes = validScopes(input.scopes);
  const prefix = credentialPrefix(input.environment);
  const secret = randomBytes(32).toString('base64url');
  const token = `${prefix}.${secret}`;
  const row = await db.apiCredential.create({
    data: {
      partnerId: input.partnerId,
      prefix,
      secretHash: await bcrypt.hash(secret, 12),
      environment: input.environment,
      scopes,
      expiresAt: input.expiresAt ?? null,
    },
    select: { id: true, environment: true, scopes: true, expiresAt: true },
  });
  return { id: row.id, prefix, token, environment: row.environment, scopes, expiresAt: row.expiresAt };
}

export async function revokeCorporateApiCredential(db: any, credentialId: string, now = new Date()): Promise<void> {
  await db.apiCredential.update({
    where: { id: credentialId },
    data: { status: 'REVOKED', revokedAt: now },
  });
}

export async function rotateCorporateApiCredential(
  db: any,
  input: { credentialId: string; partnerId: string; environment: 'TEST' | 'LIVE'; scopes: readonly string[]; expiresAt?: Date | null },
): Promise<IssueCredentialResult> {
  const run = async (tx: any) => {
    await tx.apiCredential.updateMany({
      where: { id: input.credentialId, partnerId: input.partnerId, status: 'ACTIVE' },
      data: { status: 'ROTATED', revokedAt: new Date(), rotatedAt: new Date() },
    });
    return issueCorporateApiCredential(tx, input);
  };
  return db.$transaction ? db.$transaction(run) : run(db);
}

export async function authenticateCorporateApiRequest(
  request: { headers: { get(name: string): string | null } },
  options: { requiredEnvironment: 'TEST' | 'LIVE'; now?: Date; db?: any; ip?: string },
): Promise<CorporateApiPrincipal> {
  const parsed = parseCorporateBearerToken(request.headers.get('authorization'));
  if (!parsed) throw new CorporateApiAuthError(401, GENERIC_AUTH_MESSAGE);
  if (parsed.prefix === 'lc_portal_session') {
    const session = await resolveCorporatePortalSession(`${parsed.prefix}.${parsed.secret}`);
    if (!session) throw new CorporateApiAuthError(401, GENERIC_AUTH_MESSAGE);
    const account = session.identity.corporateAccountId;
    if (!(await hasCorporateApiEntitlement(session.identity.organizationId, session.identity.propertyId))) {
      throw new CorporateApiAuthError(401, GENERIC_AUTH_MESSAGE);
    }
    return {
      partnerId: `portal:${session.identity.id}`,
      credentialId: session.id,
      organizationId: session.identity.organizationId,
      environment: 'LIVE',
      scopes: CORPORATE_API_SCOPES,
      propertyIds: [session.identity.propertyId],
      rateLimitPerMinute: 60,
      requestSizeLimitBytes: 1048576,
      corporateAccountId: account,
    };
  }
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  const credential = await db.apiCredential.findUnique({
    where: { prefix: parsed.prefix },
    select: {
      id: true, secretHash: true, environment: true, scopes: true, status: true,
      expiresAt: true, revokedAt: true, partner: {
        select: {
          id: true, organizationId: true, status: true, environment: true,
          expiresAt: true, scopes: true, rateLimitPerMinute: true, requestSizeLimitBytes: true,
          properties: { select: { propertyId: true, property: { select: { organizationId: true, isActive: true, suspendedAt: true } } } },
        },
      },
    },
  });
  const invalid = !credential || credential.status !== 'ACTIVE' || credential.environment !== options.requiredEnvironment ||
    !credential.partner || credential.partner.status !== 'ACTIVE' || credential.partner.environment !== options.requiredEnvironment ||
    Boolean(credential.revokedAt) || Boolean(credential.expiresAt && credential.expiresAt <= now) ||
    Boolean(credential.partner.expiresAt && credential.partner.expiresAt <= now);
  if (invalid || !credential || !(await bcrypt.compare(parsed.secret, credential.secretHash))) {
    throw new CorporateApiAuthError(401, GENERIC_AUTH_MESSAGE);
  }

  const properties = credential.partner.properties.filter((entry: any) =>
    entry.property?.organizationId === credential.partner.organizationId && entry.property.isActive && !entry.property.suspendedAt,
  );
  const entitled = await Promise.all(properties.map((entry: any) => hasCorporateApiEntitlement(credential.partner.organizationId, entry.propertyId)));
  const entitledProperties = properties.filter((_entry: any, index: number) => entitled[index]);
  if (!entitledProperties.length) throw new CorporateApiAuthError(401, GENERIC_AUTH_MESSAGE);

  const scopes = validScopes((credential.scopes ?? []).filter((scope: string) => (credential.partner.scopes ?? []).includes(scope)));
  void db.apiCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: now, ...(options.ip ? { lastUsedIp: options.ip } : {}) },
  }).catch(() => undefined);
  return {
    partnerId: credential.partner.id,
    credentialId: credential.id,
    organizationId: credential.partner.organizationId,
    environment: credential.environment,
    scopes,
    propertyIds: entitledProperties.map((entry: any) => entry.propertyId),
    rateLimitPerMinute: credential.partner.rateLimitPerMinute,
    requestSizeLimitBytes: credential.partner.requestSizeLimitBytes,
  };
}

const localRateBuckets = new Map<string, { window: number; count: number }>();

export function consumeCorporateRateLimit(key: string, limit: number, now = Date.now()): boolean {
  const window = Math.floor(now / 60_000);
  const current = localRateBuckets.get(key);
  if (!current || current.window !== window) {
    localRateBuckets.set(key, { window, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export async function checkCorporateRateLimit(principal: Pick<CorporateApiPrincipal, 'partnerId' | 'rateLimitPerMinute'>, scope = 'api'): Promise<boolean> {
  const bucket = `lodgecore:rate:corporate:${principal.partnerId}:${scope}:${Math.floor(Date.now() / 60_000)}`;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') return false;
    return consumeCorporateRateLimit(bucket, principal.rateLimitPerMinute);
  }
  try {
    const response = await fetch(`${url}/incr/${encodeURIComponent(bucket)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return false;
    const result = Number((await response.json() as { result?: number }).result ?? 0);
    if (result === 1) void fetch(`${url}/expire/${encodeURIComponent(bucket)}/60`, { headers: { Authorization: `Bearer ${token}` } });
    return result > 0 && result <= principal.rateLimitPerMinute;
  } catch {
    return false;
  }
}
