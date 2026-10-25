import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'invoices:read');
  if (auth instanceof Response) return auth;
  const propertyId = new URL(req.url).searchParams.get('propertyId');
  if (!propertyId) return withRequestId(errorResponse('BAD_REQUEST', 'propertyId is required', 400), auth.requestId);
  if (!(await checkCorporateRateLimit(auth.principal, 'invoices'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'invoices:read');
    const invoices = await prisma.cityLedgerInvoice.findMany({
      where: { account: { CorporateAccount: { some: { id: principal.corporateAccountId, organizationId: auth.principal.organizationId, propertyId } } }, propertyId },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      select: {
        id: true, invoiceNumber: true, issueDate: true, dueDate: true,
        description: true, amount: true, paidAmount: true, outstandingAmount: true,
        currency: true, status: true,
        entries: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            guest: { select: { firstName: true, lastName: true } },
            reservation: {
              select: {
                confirmationNumber: true,
                primaryGuest: { select: { firstName: true, lastName: true } },
                reservationRooms: { select: { room: { select: { number: true } } } },
              },
            },
          },
        },
      },
    });
    const presentationInvoices = invoices.map((invoice) => {
      const entry = invoice.entries[0];
      const guest = entry?.guest || entry?.reservation?.primaryGuest;
      const guestName = guest ? `${guest.firstName} ${guest.lastName}`.trim() : null;
      const roomNumbers = entry?.reservation?.reservationRooms.map((room) => room.room?.number).filter(Boolean) || [];
      return {
        ...invoice,
        entries: undefined,
        displayTitle: guestName ? `Corporate stay for ${guestName}` : 'Corporate accommodation stay',
        displayContext: entry?.reservation
          ? `Reservation ${entry.reservation.confirmationNumber}${roomNumbers.length ? ` · Room ${roomNumbers.join(', ')}` : ''}`
          : 'Corporate account charge',
      };
    });
    return withRequestId(successResponse({ invoices: presentationInvoices }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
