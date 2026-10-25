import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

type TxClient = Prisma.TransactionClient | PrismaClient | any;

export class CorporateApplicationError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'CorporateApplicationError'; }
}

function codeFor(name: string, id: string): string {
  const prefix = name.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '').slice(0, 12).toUpperCase() || 'CORPORATE';
  return `WEB-${prefix}-${crypto.createHash('sha256').update(id).digest('hex').slice(0, 8).toUpperCase()}`.slice(0, 32);
}

/** Single PMS conversion boundary for website/API applications. */
export async function materializeCorporateAccountForApplication(tx: TxClient, input: { applicationId: string; organizationId: string; propertyId: string; ratePlanId?: string | null; actorId?: string | null }) {
  await tx.$queryRaw`SELECT id FROM "CorporateBookingApplication" WHERE id = ${input.applicationId}::uuid FOR UPDATE`;
  const app = await tx.corporateBookingApplication.findUnique({ where: { id: input.applicationId }, select: { id: true, organizationId: true, propertyId: true, companyName: true, contactPerson: true, contactEmail: true, contactPhone: true, companyAddress: true, companyCity: true, companyCountry: true, status: true, requestedCurrency: true, expiresAt: true, corporateAccountId: true } });
  if (!app) throw new CorporateApplicationError('APPLICATION_NOT_FOUND', 'Corporate booking application was not found');
  if (app.organizationId !== input.organizationId || app.propertyId !== input.propertyId) throw new CorporateApplicationError('APPLICATION_SCOPE_DENIED', 'Corporate booking application is outside the settlement scope');
  if (app.status === 'CONVERTED' && app.corporateAccountId) return tx.corporateAccount.findUnique({ where: { id: app.corporateAccountId } });
  if (app.status !== 'PENDING') throw new CorporateApplicationError('APPLICATION_NOT_PENDING', 'Corporate booking application is no longer pending');
  if (app.expiresAt <= new Date()) { await tx.corporateBookingApplication.update({ where: { id: app.id }, data: { status: 'EXPIRED' } }); throw new CorporateApplicationError('APPLICATION_EXPIRED', 'Corporate booking application has expired'); }

  const property = await tx.property.findUnique({ where: { id: app.propertyId }, select: { organizationId: true, baseCurrency: true, supportedCurrencies: true } });
  const currency = app.requestedCurrency.toUpperCase();
  const supported = new Set([property?.baseCurrency, ...(property?.supportedCurrencies || [])].filter(Boolean).map((value: string) => value.toUpperCase()));
  if (!property || property.organizationId !== app.organizationId || !supported.has(currency)) throw new CorporateApplicationError('APPLICATION_CURRENCY_MISMATCH', 'Application currency or property scope is invalid');

  const existing = await tx.corporateAccount.findFirst({ where: { organizationId: app.organizationId, propertyId: app.propertyId, isActive: true, name: { equals: app.companyName, mode: 'insensitive' }, contactEmail: { equals: app.contactEmail, mode: 'insensitive' } }, select: { id: true, cityLedgerAccountId: true } });
  if (existing) {
    if (!existing.cityLedgerAccountId) throw new CorporateApplicationError('APPLICATION_LEDGER_CONFLICT', 'Existing corporate account has no City Ledger account');
    await tx.$queryRaw`SELECT id FROM "CityLedgerAccount" WHERE id = ${existing.cityLedgerAccountId}::uuid FOR UPDATE`;
    const ledger = await tx.cityLedgerAccount.findUnique({ where: { id: existing.cityLedgerAccountId }, select: { type: true, status: true, currency: true } });
    if (!ledger || ledger.type !== 'CORPORATE' || ledger.status !== 'ACTIVE' || ledger.currency.toUpperCase() !== currency) throw new CorporateApplicationError('APPLICATION_LEDGER_CONFLICT', 'Existing corporate City Ledger account cannot be reused');
    await tx.corporateBookingApplication.update({ where: { id: app.id }, data: { status: 'CONVERTED', corporateAccountId: existing.id } });
    return tx.corporateAccount.findUnique({ where: { id: existing.id } });
  }

  const ledgerName = app.companyName.trim();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`corporate-ledger:${app.propertyId}:${ledgerName.toLowerCase()}`}))`;
  let ledger = await tx.cityLedgerAccount.findFirst({ where: { organizationId: app.organizationId, propertyId: app.propertyId, type: 'CORPORATE', name: ledgerName }, select: { id: true, currency: true, status: true } });
  if (ledger) {
    if (ledger.status !== 'ACTIVE' || ledger.currency.toUpperCase() !== currency) throw new CorporateApplicationError('APPLICATION_LEDGER_CONFLICT', 'Corporate City Ledger terms conflict with the application');
    await tx.$queryRaw`SELECT id FROM "CityLedgerAccount" WHERE id = ${ledger.id}::uuid FOR UPDATE`;
    if (await tx.corporateAccount.findFirst({ where: { cityLedgerAccountId: ledger.id }, select: { id: true } })) throw new CorporateApplicationError('APPLICATION_LEDGER_CONFLICT', 'Corporate City Ledger account is already owned');
  } else ledger = await tx.cityLedgerAccount.create({ data: { organizationId: app.organizationId, propertyId: app.propertyId, name: ledgerName, type: 'CORPORATE', status: 'ACTIVE', currency }, select: { id: true, currency: true, status: true } });

  if (input.ratePlanId) {
    const ratePlan = await tx.ratePlan.findFirst({ where: { id: input.ratePlanId, propertyId: app.propertyId, type: { in: ['STANDARD', 'CORPORATE'] }, isActive: true, deletedAt: null, property: { organizationId: app.organizationId } }, select: { id: true } });
    if (!ratePlan) throw new CorporateApplicationError('APPLICATION_RATE_PLAN_INVALID', 'The settlement rate-plan anchor is not an active normal or corporate plan for this property');
  }
  const account = await tx.corporateAccount.create({ data: { organizationId: app.organizationId, propertyId: app.propertyId, name: app.companyName, code: codeFor(app.companyName, app.id), contactPerson: app.contactPerson, contactEmail: app.contactEmail, contactPhone: app.contactPhone, companyAddress: app.companyAddress, companyCity: app.companyCity, companyCountry: app.companyCountry, creditLimit: 0, exemptFromHighBalance: false, depositPolicy: 'WAIVED', ratePlanId: input.ratePlanId || null, cityLedgerAccountId: ledger.id } });
  await tx.corporateBookingApplication.update({ where: { id: app.id }, data: { status: 'CONVERTED', corporateAccountId: account.id } });
  await tx.auditLog.create({ data: { organizationId: app.organizationId, propertyId: app.propertyId, userId: input.actorId || null, userRole: 'SYSTEM', action: 'CORPORATE_APPLICATION_CONVERTED', resource: 'CorporateAccount', resourceId: account.id, newValue: { applicationId: app.id, accountId: account.id, cityLedgerAccountId: ledger.id }, requestId: `corporate-application:${app.id}` } });
  return account;
}

/**
 * Promotes the temporary application folio to the account-level City Ledger
 * folio used by normal PMS corporate reservations. Pending application
 * reservations cannot have posted charges yet, so an already-existing shared
 * folio can safely replace the temporary empty folio.
 */
export async function attachReservationToCorporateFolio(tx: TxClient, input: { reservationId: string; propertyId: string; corporateAccountId: string }) {
  const reservationFolio = await tx.folio.findFirst({
    where: { reservationId: input.reservationId, propertyId: input.propertyId, type: 'CITY_LEDGER', status: 'OPEN' },
    select: { id: true },
  });
  if (!reservationFolio) return null;

  const sharedFolio = await tx.folio.findFirst({
    where: { propertyId: input.propertyId, corporateAccountId: input.corporateAccountId, type: 'CITY_LEDGER', status: 'OPEN', id: { not: reservationFolio.id } },
    select: { id: true },
  });
  if (sharedFolio) {
    await tx.folio.update({ where: { id: reservationFolio.id }, data: { status: 'VOID', reservationId: null, guestId: null } });
    return sharedFolio.id;
  }

  await tx.folio.update({ where: { id: reservationFolio.id }, data: { corporateAccountId: input.corporateAccountId, reservationId: null, guestId: null } });
  return reservationFolio.id;
}
