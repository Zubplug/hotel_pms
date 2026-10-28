import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'account:read');
  if (auth instanceof Response) return auth;
  const propertyId = new URL(req.url).searchParams.get('propertyId');
  if (!propertyId) return withRequestId(errorResponse('BAD_REQUEST', 'propertyId is required', 400), auth.requestId);
  if (!(await checkCorporateRateLimit(auth.principal, 'events'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);

  try {
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'account:read');
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const [events, leases, halls, corporateAccount] = await Promise.all([
      prisma.event.findMany({
        where: { propertyId, corporateAccountId: principal.corporateAccountId, endDate: { gte: now }, status: { not: 'CANCELLED' } },
        orderBy: { startDate: 'asc' },
        take: 50,
        select: {
          id: true, name: true, status: true, financialStatus: true, startDate: true, endDate: true, expectedGuests: true,
          bookings: { where: { status: { not: 'CANCELLED' } }, orderBy: { startTime: 'asc' }, select: { id: true, startTime: true, endTime: true, hall: { select: { id: true, name: true, code: true, capacity: true } } } },
          invoices: { where: { status: { not: 'VOID' } }, select: { id: true, totalAmount: true, paidAmount: true, currency: true, status: true } },
        },
      }),
      prisma.leaseContract.findMany({
        where: { propertyId, corporateAccountId: principal.corporateAccountId, isActive: true, endDate: { gte: today } },
        orderBy: { startDate: 'asc' },
        take: 50,
        select: {
          id: true, contactName: true, startDate: true, endDate: true, usageFrequency: true, billingFrequency: true, startTime: true, endTime: true, currency: true, rate: true, depositAmount: true,
          hall: { select: { id: true, name: true, code: true, capacity: true } },
          schedules: { where: { status: { not: 'VOID' }, dueDate: { gte: today } }, orderBy: { dueDate: 'asc' }, take: 3, select: { id: true, periodStart: true, periodEnd: true, dueDate: true, amount: true, status: true, invoiceId: true } },
        },
      }),
      prisma.hall.findMany({
        where: { propertyId, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, capacity: true, squareMeters: true, amenities: true, rate: true },
      }),
      prisma.corporateAccount.findFirst({
        where: { id: principal.corporateAccountId || '', propertyId, organizationId: auth.principal.organizationId, isActive: true },
        select: { name: true, code: true, contactPerson: true, contactEmail: true, contactPhone: true, companyAddress: true, companyCity: true, companyCountry: true, portalIdentity: { select: { email: true } }, cityLedgerAccount: { select: { currency: true } } },
      }),
    ]);

    return withRequestId(successResponse({
      events: events.map((event) => ({
        ...event,
        invoices: event.invoices.map((invoice) => ({ ...invoice, totalAmount: Number(invoice.totalAmount), paidAmount: Number(invoice.paidAmount) })),
      })),
      leases: leases.map((lease) => ({
        ...lease,
        rate: Number(lease.rate),
        depositAmount: Number(lease.depositAmount),
        schedules: lease.schedules.map((schedule) => ({ ...schedule, amount: Number(schedule.amount) })),
      })),
      halls: halls.map((hall) => ({ ...hall, squareMeters: hall.squareMeters == null ? null : Number(hall.squareMeters), rate: hall.rate == null ? null : Number(hall.rate) })),
      corporateAccount,
    }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
