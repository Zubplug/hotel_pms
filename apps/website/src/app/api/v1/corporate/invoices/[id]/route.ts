import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCorporateApi(req, 'invoices:read');
  if (auth instanceof Response) return auth;
  const propertyId = new URL(req.url).searchParams.get('propertyId');
  if (!propertyId) return withRequestId(errorResponse('BAD_REQUEST', 'propertyId is required', 400), auth.requestId);
  if (!(await checkCorporateRateLimit(auth.principal, 'invoices'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'invoices:read');
    const invoice = await prisma.cityLedgerInvoice.findFirst({
      where: { id: (await context.params).id, propertyId, account: { CorporateAccount: { some: { id: principal.corporateAccountId, organizationId: auth.principal.organizationId, propertyId } } } },
      select: {
        id: true, invoiceNumber: true, issueDate: true, dueDate: true,
        description: true, amount: true, paidAmount: true, outstandingAmount: true,
        currency: true, status: true,
        account: { select: { id: true, name: true, currency: true } },
        entries: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, amount: true, currency: true, type: true, status: true,
            reference: true, reason: true, createdAt: true,
            guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            reservation: {
              select: {
                id: true, confirmationNumber: true, checkIn: true, checkOut: true,
                status: true, adults: true, children: true,
                primaryGuest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
                reservationRooms: {
                  orderBy: { checkIn: 'asc' },
                  select: { room: { select: { number: true, roomType: { select: { name: true } } } } },
                },
              },
            },
            folio: {
              select: {
                id: true, folioNumber: true, currency: true,
                items: {
                  where: { voidedAt: null, type: { in: ['CHARGE', 'TAX', 'DISCOUNT', 'ADJUSTMENT'] } },
                  orderBy: [{ businessDate: 'asc' }, { createdAt: 'asc' }],
                  select: { id: true, reservationId: true, guestId: true, businessDate: true, type: true, source: true, description: true, quantity: true, unitAmount: true, amount: true, currency: true },
                },
              },
            },
          },
        },
        allocations: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, amount: true, currency: true, createdAt: true, payment: { select: { id: true, reference: true, type: true, status: true, createdAt: true } } },
        },
      },
    });
    if (!invoice) return withRequestId(errorResponse('NOT_FOUND', 'Corporate invoice not found', 404), auth.requestId);
    return withRequestId(successResponse({ invoice }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
