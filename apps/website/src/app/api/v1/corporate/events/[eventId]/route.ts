import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';
import { getCorporateEventBooking } from '@/lib/booking-engine/corporate-event-service';

export async function GET(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const auth = await requireCorporateApi(req, 'bookings:read');
  if (auth instanceof Response) return auth;
  const propertyId = req.nextUrl.searchParams.get('propertyId');
  if (!propertyId) return withRequestId(errorResponse('BAD_REQUEST', 'propertyId is required', 400), auth.requestId);
  try {
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'bookings:read');
    if (!principal.corporateAccountId) return withRequestId(errorResponse('NOT_FOUND', 'Event booking not found', 404), auth.requestId);
    const event = await getCorporateEventBooking(prisma as any, { eventId: (await context.params).eventId, propertyId, corporateAccountId: principal.corporateAccountId });
    if (!event) return withRequestId(errorResponse('NOT_FOUND', 'Event booking not found', 404), auth.requestId);
    const invoice: any = event.invoices[0];
    const approval = invoice ? await prisma.approvalRequest.findFirst({ where: { propertyId, type: 'CORPORATE_CREDIT', details: { path: ['eventId'], equals: event.id } }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, reviewedAt: true, reason: true } }) : null;
    return withRequestId(successResponse({ eventId: event.id, name: event.name, status: event.status, financialStatus: event.financialStatus, startDate: event.startDate, endDate: event.endDate, expectedGuests: event.expectedGuests, bookings: event.bookings, invoice: invoice ? { id: invoice.id, status: invoice.status, workflowStatus: invoice.workflowStatus, totalAmount: invoice.totalAmount, paidAmount: invoice.paidAmount, currency: invoice.currency, cityLedgerInvoiceId: invoice.cityLedgerInvoice?.id } : null, approval }), auth.requestId);
  } catch { return withRequestId(errorResponse('INTERNAL_ERROR', 'Unable to load event booking', 500), auth.requestId); }
}
