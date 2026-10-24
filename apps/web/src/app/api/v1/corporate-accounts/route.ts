import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';
import { hasAnyPropertyModuleEntitlement, hasPropertyModuleEntitlement } from '@/lib/auth/service-entitlement';

function codeToken(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'CORP';
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

async function generateCorporateCode(tx: any, propertyId: string, name: string) {
  const prefix = codeToken(name);
  for (let index = 1; index <= 99; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const candidate = `${prefix.slice(0, 10 - suffix.length)}${suffix}`;
    const existing = await tx.corporateAccount.findFirst({
      where: { propertyId, code: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `CORP${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const entitled = propertyId
      ? await hasPropertyModuleEntitlement(session.user.id, propertyId, 'MODULE_OPERATIONS')
      : await hasAnyPropertyModuleEntitlement(session.user.id, propertyIds, 'MODULE_OPERATIONS');
    if (!entitled) return errorResponse('PAYMENT_REQUIRED', 'An active Operations entitlement is required for Corporate Accounts.', 402);
    
    const visiblePropertyIds = propertyId
      ? (await hasPermission(session.user.id, propertyId, 'corporate_account:view') ? [propertyId] : [])
      : (await Promise.all(propertyIds.map(async id => (
          await hasPermission(session.user.id, id, 'corporate_account:view') ? id : null
        )))).filter((id): id is string => Boolean(id));

    if (propertyId) {
      if (!propertyIds.includes(propertyId)) {
        return errorResponse('FORBIDDEN', 'Forbidden property access', 403);
      }
      if (!visiblePropertyIds.includes(propertyId)) {
        return errorResponse('FORBIDDEN', 'Missing required permission: corporate_account:view', 403);
      }
    } else if (visiblePropertyIds.length === 0) {
      return errorResponse('FORBIDDEN', 'Missing required permission: corporate_account:view', 403);
    }

    const status = searchParams.get('status');
    const depositPolicy = searchParams.get('depositPolicy');
    const credit = searchParams.get('credit');
    const search = searchParams.get('search')?.trim();
    const where: any = {
      propertyId: { in: visiblePropertyIds },
      ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
      ...(depositPolicy ? { depositPolicy } : {}),
      ...(credit === 'with_limit' ? { creditLimit: { gt: 0 } } : credit === 'no_limit' ? { creditLimit: { lte: 0 } } : {}),
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };

    const accounts = await prisma.corporateAccount.findMany({ 
        where, 
        orderBy: { name: 'asc' },
        include: { ratePlan: { include: { rates: true } }, cityLedgerAccount: true }
    });
    
    return successResponse(accounts);
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const body = await req.json();
    
    if (!body.propertyId || !propertyIds.includes(body.propertyId)) {
        return errorResponse('FORBIDDEN', 'Forbidden property access', 403);
    }
    if (!(await hasPropertyModuleEntitlement(session.user.id, body.propertyId, 'MODULE_OPERATIONS'))) {
        return errorResponse('PAYMENT_REQUIRED', 'An active Operations entitlement is required for Corporate Accounts.', 402);
    }

    const canCreate = await hasPermission(session.user.id, body.propertyId, 'corporate_account:create');
    if (!canCreate) {
        return errorResponse('FORBIDDEN', 'Missing required permission: corporate_account:create', 403);
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const requestedCode = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const creditLimit = Number(body.creditLimit ?? 0);
    // Corporate accounts are direct-billed by default. Keep creation safe from
    // accidentally applying guest deposit rules; an existing account's policy
    // can still be changed through the audited edit workflow.
    const depositPolicy = 'WAIVED';
    if (name.length < 2 || name.length > 200 || (requestedCode && !/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(requestedCode)) || (body.contactEmail != null && (typeof body.contactEmail !== 'string' || !/^\S+@\S+\.\S+$/.test(body.contactEmail.trim()))) || !Number.isFinite(creditLimit) || creditLimit < 0 || !['WAIVED', 'STANDARD'].includes(depositPolicy)) {
      return errorResponse('BAD_REQUEST', 'Invalid corporate account details', 400);
    }

    const result = await prisma.$transaction(async tx => {
      const property = await tx.property.findFirst({
        where: { id: body.propertyId, organizationId },
        select: { baseCurrency: true, supportedCurrencies: true },
      });
      if (!property) throw Object.assign(new Error('Invalid property'), { code: 'INVALID_PROPERTY' });

      const requestedCurrency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : property.baseCurrency;
      const supportedCurrencies = new Set((property.supportedCurrencies ?? []).map((currency: string) => currency.toUpperCase()));
      supportedCurrencies.add(property.baseCurrency.toUpperCase());
      if (!/^[A-Z]{3}$/.test(requestedCurrency) || !supportedCurrencies.has(requestedCurrency)) {
        throw Object.assign(new Error('Currency is not supported by this property'), { code: 'INVALID_CURRENCY' });
      }

      let ratePlanId = body.ratePlanId ? String(body.ratePlanId) : null;
      if (ratePlanId) {
        const ratePlan = await tx.ratePlan.findFirst({
          where: {
            id: ratePlanId,
            propertyId: body.propertyId,
            isActive: true,
            deletedAt: null,
            property: { organizationId },
          },
          select: { id: true },
        });
        if (!ratePlan) throw Object.assign(new Error('Rate plan is not active for this property'), { code: 'INVALID_RATE_PLAN' });
      }

      const code = requestedCode || await generateCorporateCode(tx, body.propertyId, name);
      let cityLedgerAccountId = body.cityLedgerAccountId as string | undefined;
      if (cityLedgerAccountId) {
        const ledger = await tx.cityLedgerAccount.findFirst({
          where: { id: cityLedgerAccountId, propertyId: body.propertyId, organizationId, type: 'CORPORATE', status: 'ACTIVE' },
          select: { id: true, currency: true },
        });
        if (!ledger) throw Object.assign(new Error('Invalid City Ledger account'), { code: 'INVALID_LEDGER' });
        if (ledger.currency.toUpperCase() !== requestedCurrency) {
          throw Object.assign(new Error('City Ledger currency does not match the property booking currency'), { code: 'CURRENCY_MISMATCH' });
        }
      } else {
        // Serialize same-name ledger resolution inside the transaction. The
        // CityLedgerAccount table intentionally remains compatible with old
        // data and has no global name uniqueness constraint.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`corporate-ledger:${body.propertyId}:${name.toLowerCase()}`}))`;
        const ledger = await tx.cityLedgerAccount.findFirst({
          where: { propertyId: body.propertyId, organizationId, type: 'CORPORATE', name },
          select: { id: true, currency: true },
        });
        if (ledger) {
          if (ledger.currency.toUpperCase() !== requestedCurrency) {
            throw Object.assign(new Error('Existing City Ledger currency does not match the property booking currency'), { code: 'CURRENCY_MISMATCH' });
          }
          cityLedgerAccountId = ledger.id;
        } else {
          cityLedgerAccountId = (await tx.cityLedgerAccount.create({
            data: { organizationId, propertyId: body.propertyId, name, type: 'CORPORATE', status: 'ACTIVE', currency: requestedCurrency },
            select: { id: true },
          })).id;
        }
      }

      await tx.$queryRaw`SELECT id FROM "CityLedgerAccount" WHERE id = ${cityLedgerAccountId}::uuid FOR UPDATE`;

      const ledgerOwner = await tx.corporateAccount.findFirst({
        where: { cityLedgerAccountId },
        select: { id: true },
      });
      if (ledgerOwner) throw Object.assign(new Error('City Ledger account is already linked to a corporate account'), { code: 'LEDGER_IN_USE' });

      const account = await tx.corporateAccount.create({ data: {
            organizationId,
            propertyId: body.propertyId,
            name, code,
            contactPerson: typeof body.contactPerson === 'string' ? body.contactPerson.trim() || null : null,
            contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail.trim() || null : null,
            contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone.trim() || null : null,
            creditLimit,
            exemptFromHighBalance: parseBoolean(body.exemptFromHighBalance),
            depositPolicy,
            ratePlanId,
            cityLedgerAccountId,
          } });
      await tx.auditLog.create({ data: {
        organizationId, propertyId: body.propertyId, userId: session.user.id,
        action: 'CREATE', resource: 'corporate_account', resourceId: account.id,
        newValue: JSON.parse(JSON.stringify(account)), requestId: crypto.randomUUID(),
      } });
      return account;
    });
    
    return successResponse(result, 201);
  } catch (err: any) {
    if (err.code === 'P2002') {
        return errorResponse('CONFLICT', 'A corporate account with this code already exists for this property.', 409);
    }
    if (['INVALID_PROPERTY', 'INVALID_RATE_PLAN', 'INVALID_LEDGER', 'CURRENCY_MISMATCH', 'LEDGER_IN_USE', 'INVALID_CURRENCY'].includes(err.code)) return errorResponse('BAD_REQUEST', err.message, 400);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
