import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import {
  authenticateCorporateApiRequest,
  assertCorporateApiScope,
  assertCorporateRequestSize,
  CorporateApiAuthError,
  type CorporateApiPrincipal,
  type CorporateApiScope,
} from './corporate-api-auth';
import { CorporateQuoteError, type CorporatePrincipal } from './booking-engine/corporate-quote-service';
import { CorporateBookingError } from './booking-engine/corporate-booking-service';
import { CorporateCancellationError } from './booking-engine/corporate-cancellation-service';
import { BookingPolicyError } from './booking-engine/booking-policy-service';

export function requestId(req: NextRequest): string {
  return req.headers.get('x-request-id')?.slice(0, 128) || crypto.randomUUID();
}

function environment(): 'TEST' | 'LIVE' {
  return process.env.CORPORATE_API_ENVIRONMENT === 'TEST' || process.env.NODE_ENV !== 'production' ? 'TEST' : 'LIVE';
}

export async function requireCorporateApi(req: NextRequest, scope: CorporateApiScope): Promise<
  { principal: CorporateApiPrincipal; requestId: string } | NextResponse
> {
  const id = requestId(req);
  if (process.env.NODE_ENV === 'production' && process.env.CORPORATE_API_ENABLED !== 'true') {
    return withRequestId(errorResponse('SERVICE_UNAVAILABLE', 'Corporate API is not enabled', 503), id);
  }
  try {
    const principal = await authenticateCorporateApiRequest(req, { requiredEnvironment: environment(), ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() });
    assertCorporateApiScope(principal, scope);
    assertCorporateRequestSize(req.headers.get('content-length'), principal.requestSizeLimitBytes);
    return { principal, requestId: id };
  } catch (error) {
    if (error instanceof CorporateApiAuthError) {
      return withRequestId(errorResponse(error.status === 429 ? 'TOO_MANY_REQUESTS' : error.status === 413 ? 'PAYLOAD_TOO_LARGE' : error.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED', error.message, error.status), id);
    }
    console.error('[Corporate API] authentication failure', { requestId: id });
    return withRequestId(errorResponse('UNAUTHORIZED', 'Invalid corporate API credentials', 401), id);
  }
}

export function withRequestId(response: NextResponse, id: string): NextResponse {
  response.headers.set('x-request-id', id);
  return response;
}

export class CorporateRequestBodyError extends Error {
  readonly code = 'PAYLOAD_TOO_LARGE';
}

export function corporateError(error: unknown, id: string): NextResponse {
  if (error instanceof CorporateQuoteError) {
    const map: Record<string, { code: string; status: number }> = {
      CORPORATE_SCOPE_DENIED: { code: 'FORBIDDEN', status: 403 },
      CORPORATE_ACCOUNT_UNAVAILABLE: { code: 'CORPORATE_ACCOUNT_UNAVAILABLE', status: 409 },
      CORPORATE_RATE_UNAVAILABLE: { code: 'CORPORATE_RATE_UNAVAILABLE', status: 409 },
      CORPORATE_RATE_AMBIGUOUS: { code: 'CORPORATE_RATE_AMBIGUOUS', status: 409 },
      CORPORATE_OCCUPANCY_INVALID: { code: 'BAD_REQUEST', status: 400 },
      QUOTE_EXPIRED: { code: 'QUOTE_EXPIRED', status: 409 },
      QUOTE_NOT_FOUND: { code: 'NOT_FOUND', status: 404 },
      QUOTE_TAMPERED: { code: 'QUOTE_TAMPERED', status: 409 },
      QUOTE_PRICE_CHANGED: { code: 'QUOTE_PRICE_CHANGED', status: 409 },
    };
    const mapped = map[error.code] ?? { code: 'CONFLICT', status: 409 };
    return withRequestId(errorResponse(mapped.code, error.message, mapped.status, error.details), id);
  }
  if (error instanceof CorporateBookingError) {
    const status = error.code === 'BOOKING_INPUT_INVALID' ? 400 : error.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 409;
    return withRequestId(errorResponse(error.code, error.message, status), id);
  }
  if (error instanceof CorporateCancellationError) {
    const status = error.code === 'NOT_FOUND' ? 404 : 409;
    return withRequestId(errorResponse(error.code, error.message, status), id);
  }
  if (error instanceof CorporateRequestBodyError) return withRequestId(errorResponse('PAYLOAD_TOO_LARGE', error.message, 413), id);
  if (error instanceof BookingPolicyError) return withRequestId(errorResponse(error.code, error.message, 400), id);
  console.error('[Corporate API] request failure', { requestId: id, error });
  return withRequestId(errorResponse('INTERNAL_ERROR', 'The corporate API request could not be completed', 500), id);
}

export async function jsonBody(req: NextRequest, limitBytes: number): Promise<unknown> {
  const contentLength = req.headers.get('content-length');
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > limitBytes)) throw new CorporateRequestBodyError('Corporate API request is too large');
  let bytes: ArrayBuffer;
  try { bytes = await req.arrayBuffer(); } catch { throw new CorporateQuoteError('QUOTE_TAMPERED', 'Invalid request body'); }
  if (bytes.byteLength > limitBytes) throw new CorporateRequestBodyError('Corporate API request is too large');
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new CorporateQuoteError('QUOTE_TAMPERED', 'Invalid JSON body'); }
}

export async function corporatePrincipalForProperty(auth: CorporateApiPrincipal, propertyId: string, requiredMappingScope: CorporateApiScope = 'quotes:create', db: any = prisma): Promise<CorporatePrincipal> {
  if (!auth.propertyIds.includes(propertyId)) throw new CorporateQuoteError('CORPORATE_SCOPE_DENIED', 'The corporate principal is not authorized for this property');
  if (auth.corporateAccountId) {
    const account = await db.corporateAccount.findFirst({ where: { id: auth.corporateAccountId, organizationId: auth.organizationId, propertyId, isActive: true }, select: { id: true } });
    if (!account) throw new CorporateQuoteError('CORPORATE_ACCOUNT_UNAVAILABLE', 'The corporate account is inactive or outside the authorized property scope');
    return { id: auth.partnerId, organizationId: auth.organizationId, propertyIds: auth.propertyIds, corporateAccountId: account.id };
  }
  const today = new Date();
  const mappings = await db.apiPartnerCorporateAccount.findMany({
    where: {
      partnerId: auth.partnerId,
      organizationId: auth.organizationId,
      propertyId,
      status: 'ACTIVE',
      effectiveFrom: { lte: today },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      corporateAccount: { isActive: true, organizationId: auth.organizationId, propertyId },
    },
    select: { corporateAccountId: true, scopes: true },
  });
  const eligible = mappings.filter((mapping: any) => mapping.scopes.includes(requiredMappingScope) || mapping.scopes.includes('*'));
  if (eligible.length === 0) throw new CorporateQuoteError('CORPORATE_ACCOUNT_UNAVAILABLE', 'No active corporate account mapping exists for this API partner and property');
  if (eligible.length > 1) throw new CorporateQuoteError('CORPORATE_RATE_AMBIGUOUS', 'Multiple active corporate account mappings exist for this API partner and property');
  return { id: auth.partnerId, organizationId: auth.organizationId, propertyIds: auth.propertyIds, corporateAccountId: eligible[0].corporateAccountId };
}

export async function corporatePrincipalForQuote(auth: CorporateApiPrincipal, quoteId: string, db: any = prisma): Promise<CorporatePrincipal> {
  const quote = await db.bookingQuote.findFirst({
    where: { id: quoteId, organizationId: auth.organizationId, principalId: auth.partnerId, propertyId: { in: [...auth.propertyIds] } },
    select: { propertyId: true, corporateAccountId: true, corporateBookingApplicationId: true },
  });
  if (!quote) throw new CorporateQuoteError('QUOTE_NOT_FOUND', 'Quote not found');
  return { id: auth.partnerId, organizationId: auth.organizationId, propertyIds: auth.propertyIds, corporateAccountId: quote.corporateAccountId || undefined, corporateApplicationId: quote.corporateBookingApplicationId || undefined };
}

export async function corporatePrincipalForApplication(auth: CorporateApiPrincipal, applicationId: string, db: any = prisma): Promise<CorporatePrincipal> {
  const application = await db.corporateBookingApplication.findFirst({
    where: { id: applicationId, organizationId: auth.organizationId, principalId: auth.partnerId, propertyId: { in: [...auth.propertyIds] }, status: 'PENDING', expiresAt: { gt: new Date() } },
    select: { propertyId: true },
  });
  if (!application) throw new CorporateQuoteError('CORPORATE_ACCOUNT_UNAVAILABLE', 'Corporate booking application is not active');
  return { id: auth.partnerId, organizationId: auth.organizationId, propertyIds: auth.propertyIds, corporateApplicationId: applicationId };
}

export function requiredScope(principal: CorporateApiPrincipal, scope: CorporateApiScope, propertyId?: string): void {
  assertCorporateApiScope(principal, scope, propertyId);
}

export { prisma };
