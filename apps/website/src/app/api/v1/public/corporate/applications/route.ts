import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolvePublicApiContext, isErrorResponse, corsHeaders, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';
import { hashCorporateApplicationToken } from '@/lib/booking-engine/corporate-public-auth';

const schema = z.object({ companyName: z.string().trim().min(2).max(160), contactPerson: z.string().trim().min(2).max(120), contactEmail: z.string().email().max(320), contactPhone: z.string().trim().max(50).optional(), companyAddress: z.string().trim().min(5).max(240), companyCity: z.string().trim().min(2).max(100), companyCountry: z.string().trim().min(2).max(100), currency: z.string().regex(/^[A-Za-z]{3}$/).optional(), paymentMode: z.enum(['FULL', 'DEPOSIT', 'PREPAID', 'PAY_LATER']).default('PAY_LATER') });

export async function POST(req: NextRequest) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-application'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  const config = await prisma.bookingEngineConfig.findUnique({ where: { propertyId: ctx.propertyId }, select: { enabled: true } });
  if (!config?.enabled) return errorResponse('SERVICE_UNAVAILABLE', 'Online booking is not enabled for this property', 503);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid corporate application', 400, parsed.error.flatten());
  const property = await prisma.property.findUnique({ where: { id: ctx.propertyId }, select: { baseCurrency: true, supportedCurrencies: true } });
  const currency = (parsed.data.currency || property?.baseCurrency || 'NGN').toUpperCase();
  if (!property || ![property.baseCurrency, ...(property.supportedCurrencies || [])].map(value => value.toUpperCase()).includes(currency)) return errorResponse('BAD_REQUEST', 'Currency is not supported by this property', 400);
  const existingAccount = await prisma.corporateAccount.findFirst({ where: { organizationId: ctx.organizationId, propertyId: ctx.propertyId, isActive: true, contactEmail: { equals: parsed.data.contactEmail.toLowerCase(), mode: 'insensitive' } }, select: { id: true, name: true } });
  if (existingAccount) return errorResponse('ACCOUNT_EXISTS', 'A corporate account already exists for this contact at this property. Use the corporate portal login to make another reservation.', 409, { corporateAccountId: existingAccount.id, accountName: existingAccount.name, loginPath: '/corporate/login' });
  const token = crypto.randomBytes(32).toString('base64url');
  const application = await prisma.corporateBookingApplication.create({ data: { organizationId: ctx.organizationId, propertyId: ctx.propertyId, companyName: parsed.data.companyName, contactPerson: parsed.data.contactPerson, contactEmail: parsed.data.contactEmail.toLowerCase(), contactPhone: parsed.data.contactPhone || null, companyAddress: parsed.data.companyAddress, companyCity: parsed.data.companyCity, companyCountry: parsed.data.companyCountry, paymentMode: parsed.data.paymentMode, requestedCurrency: currency, sourceChannel: 'STANDALONE_CORPORATE_WEBSITE', principalId: `PUBLIC_CORPORATE:${crypto.randomUUID()}`, accessTokenHash: hashCorporateApplicationToken(token), status: 'PENDING', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }, select: { id: true, status: true, expiresAt: true } });
  const response = successResponse({ applicationId: application.id, applicationToken: token, status: application.status, expiresAt: application.expiresAt }, 201);
  Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
