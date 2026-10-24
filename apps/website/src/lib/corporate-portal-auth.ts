import crypto from 'node:crypto';
import prisma from '@hotel-pms/db';

const LOGIN_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export const CORPORATE_PORTAL_SCOPES = [
  'properties:read', 'availability:read', 'quotes:create', 'quotes:read',
  'bookings:create', 'bookings:read', 'bookings:cancel', 'account:read',
  'invoices:read', 'invoices:pay', 'rates:negotiate',
] as const;

function rawToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
}

export function hashCorporatePortalToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createCorporatePortalLoginRequest(input: { organizationId: string; propertyId: string; email: string }) {
  const email = input.email.trim().toLowerCase();
  const accounts = await prisma.corporateAccount.findMany({
    where: { organizationId: input.organizationId, propertyId: input.propertyId, isActive: true, contactEmail: email },
    select: { id: true, name: true, contactPerson: true, contactEmail: true },
  });
  const generic = { accepted: true, expiresAt: new Date(Date.now() + LOGIN_TTL_MS) };
  // Never guess when one contact email is attached to multiple active PMS
  // accounts at the same property. Staff must resolve that exception first.
  if (accounts.length !== 1 || !accounts[0]?.contactEmail) return { ...generic, loginToken: null, account: null };
  const account = accounts[0];

  const identity = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`corporate-portal-identity:${account.id}`}))`;
    return tx.corporatePortalIdentity.upsert({
      where: { corporateAccountId: account.id },
      create: { organizationId: input.organizationId, propertyId: input.propertyId, corporateAccountId: account.id, email, status: 'ACTIVE' },
      update: { email, propertyId: input.propertyId, status: 'ACTIVE' },
      select: { id: true },
    });
  });
  const token = rawToken('lc_portal_login');
  const expiresAt = new Date(Date.now() + LOGIN_TTL_MS);
  await prisma.corporatePortalLoginToken.create({ data: { identityId: identity.id, tokenHash: hashCorporatePortalToken(token), expiresAt } });
  return { accepted: true, expiresAt, loginToken: token, account: { name: account.name, contactPerson: account.contactPerson } };
}

export async function consumeCorporatePortalLoginToken(token: string) {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const login = await tx.corporatePortalLoginToken.findFirst({
      where: { tokenHash: hashCorporatePortalToken(token), usedAt: null, expiresAt: { gt: now }, identity: { status: 'ACTIVE', corporateAccount: { isActive: true } } },
      include: { identity: { include: { corporateAccount: { select: { id: true, organizationId: true, propertyId: true, name: true, code: true, contactPerson: true, contactEmail: true } } } } },
    });
    if (!login) return null;
    await tx.corporatePortalLoginToken.update({ where: { id: login.id }, data: { usedAt: now } });
    const sessionToken = rawToken('lc_portal_session');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await tx.corporatePortalSession.create({ data: { identityId: login.identityId, tokenHash: hashCorporatePortalToken(sessionToken), expiresAt } });
    await tx.corporatePortalIdentity.update({ where: { id: login.identityId }, data: { lastLoginAt: now } });
    return { sessionToken, expiresAt, sessionId: session.id, identity: login.identity };
  });
  return result;
}

export async function resolveCorporatePortalSession(token: string) {
  const now = new Date();
  const session = await prisma.corporatePortalSession.findFirst({
    where: { tokenHash: hashCorporatePortalToken(token), revokedAt: null, expiresAt: { gt: now }, identity: { status: 'ACTIVE', corporateAccount: { isActive: true } } },
    include: { identity: { select: { id: true, organizationId: true, propertyId: true, corporateAccountId: true } } },
  });
  if (!session) return null;
  void prisma.corporatePortalSession.update({ where: { id: session.id }, data: { lastUsedAt: now } }).catch(() => undefined);
  return session;
}
