import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';

const scopeValues = ['properties:read', 'availability:read', 'quotes:create', 'quotes:read', 'bookings:create', 'bookings:read', 'bookings:cancel', 'rates:negotiate', 'account:read', 'invoices:read', 'invoices:pay'] as const;
const mappingSchema = z.object({ corporateAccountId: z.string().uuid(), scopes: z.array(z.enum(scopeValues)).min(1), effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() });
const schema = z.object({ name: z.string().trim().min(2).max(160), environment: z.enum(['TEST', 'LIVE']).default('TEST'), scopes: z.array(z.enum(scopeValues)).min(1), propertyIds: z.array(z.string().uuid()).min(1), mappings: z.array(mappingSchema).min(1), expiresAt: z.string().datetime().nullable().optional() });

function prefix(environment: string) { return `lc_corp_${environment.toLowerCase()}_${crypto.randomBytes(8).toString('hex')}`; }

export async function GET() {
  const session = await auth();
  if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const { organizationId, propertyIds } = await requireOrganizationContext((session.user as any).id);
  const visible = (await Promise.all(propertyIds.map(async (propertyId) => (await hasPermission(session.user.id, propertyId, 'corporate_account:view')) ? propertyId : null))).filter(Boolean) as string[];
  if (!visible.length) return errorResponse('FORBIDDEN', 'Missing corporate account permission', 403);
  const partners = await prisma.apiPartner.findMany({ where: { organizationId, properties: { some: { propertyId: { in: visible } } } }, include: { properties: { where: { propertyId: { in: visible } }, select: { propertyId: true } }, corporateAccounts: { where: { propertyId: { in: visible } }, select: { corporateAccountId: true, propertyId: true, status: true, scopes: true, effectiveFrom: true, effectiveTo: true } } }, orderBy: { createdAt: 'desc' } });
  return successResponse(partners);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const { organizationId, propertyIds } = await requireOrganizationContext((session.user as any).id);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid corporate API partner', 400, parsed.error.flatten());
  const body = parsed.data;
  if (body.propertyIds.some((id) => !propertyIds.includes(id))) return errorResponse('FORBIDDEN', 'Partner property scope is outside your organization', 403);
  for (const propertyId of body.propertyIds) if (!(await hasPermission(session.user.id, propertyId, 'corporate_account:edit'))) return errorResponse('FORBIDDEN', 'Missing corporate account permission', 403);
  if (body.mappings.some((mapping) => mapping.scopes.some((scope) => !body.scopes.includes(scope)))) return errorResponse('BAD_REQUEST', 'Account mapping scopes cannot exceed partner scopes', 400);
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (expiresAt && expiresAt <= new Date()) return errorResponse('BAD_REQUEST', 'Credential expiry must be in the future', 400);
  try {
    const secret = crypto.randomBytes(32).toString('base64url');
    const tokenPrefix = prefix(body.environment);
    const token = `${tokenPrefix}.${secret}`;
    const result = await prisma.$transaction(async (tx) => {
      const accounts = await tx.corporateAccount.findMany({ where: { id: { in: body.mappings.map((mapping) => mapping.corporateAccountId) }, organizationId, propertyId: { in: body.propertyIds }, isActive: true }, select: { id: true, propertyId: true } });
      const accountById = new Map(accounts.map((account) => [account.id, account]));
      if (accounts.length !== new Set(body.mappings.map((mapping) => mapping.corporateAccountId)).size) throw Object.assign(new Error('Every mapped account must be active and belong to a selected property'), { code: 'INVALID_MAPPING' });
      const partner = await tx.apiPartner.create({ data: { organizationId, name: body.name, environment: body.environment, scopes: body.scopes, properties: { create: body.propertyIds.map((propertyId) => ({ propertyId })) }, corporateAccounts: { create: body.mappings.map((mapping) => ({ corporateAccountId: mapping.corporateAccountId, organizationId, propertyId: accountById.get(mapping.corporateAccountId)!.propertyId, scopes: mapping.scopes, effectiveFrom: new Date(`${mapping.effectiveFrom}T00:00:00.000Z`), effectiveTo: mapping.effectiveTo ? new Date(`${mapping.effectiveTo}T00:00:00.000Z`) : null })) } }, select: { id: true, name: true, environment: true } });
      const credential = await tx.apiCredential.create({ data: { partnerId: partner.id, prefix: tokenPrefix, secretHash: await bcrypt.hash(secret, 12), environment: body.environment, scopes: body.scopes, expiresAt }, select: { id: true, expiresAt: true } });
      await tx.auditLog.create({ data: { organizationId, propertyId: body.propertyIds[0], userId: session.user.id, action: 'CREATE', resource: 'corporate_api_partner', resourceId: partner.id, newValue: { partnerId: partner.id, credentialId: credential.id, propertyIds: body.propertyIds, mappingCount: body.mappings.length }, requestId: crypto.randomUUID() } });
      return { partner, credential };
    });
    return successResponse({ ...result.partner, credentialId: result.credential.id, token, expiresAt: result.credential.expiresAt, warning: 'Store this credential now. The secret is not shown again.' }, 201);
  } catch (error: any) {
    if (error?.code === 'INVALID_MAPPING') return errorResponse('BAD_REQUEST', error.message, 400);
    if (error?.code === 'P2002') return errorResponse('CONFLICT', 'A corporate API credential or partner mapping already exists', 409);
    return errorResponse('INTERNAL_ERROR', 'Unable to create corporate API partner', 500);
  }
}
