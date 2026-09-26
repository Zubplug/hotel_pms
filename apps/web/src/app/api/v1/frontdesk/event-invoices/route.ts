import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const propertyId = req.nextUrl.searchParams.get('propertyId');
    const search = req.nextUrl.searchParams.get('search')?.trim() || '';
    if (!propertyId) return errorResponse('BAD_REQUEST', 'propertyId is required', 400);

    const context = await requireOrganizationContext(session.user.id);
    if (!context.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);

    const invoices = await prisma.eventInvoice.findMany({
      where: {
        AND: [
          { OR: [{ propertyId }, { event: { propertyId } }] },
          { status: { in: ['ISSUED', 'UNPAID', 'PARTIAL'] } },
          ...(search ? [{ OR: [
            { event: { name: { contains: search, mode: 'insensitive' } } },
            { event: { contactName: { contains: search, mode: 'insensitive' } } },
            { event: { contactPhone: { contains: search, mode: 'insensitive' } } },
            { event: { contactEmail: { contains: search, mode: 'insensitive' } } },
            { event: { guest: { OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ] } } },
            { event: { corporateAccount: { name: { contains: search, mode: 'insensitive' } } } },
            { leaseBillingSchedule: { leaseContract: { contactName: { contains: search, mode: 'insensitive' } } } },
            { leaseBillingSchedule: { leaseContract: { corporateAccount: { name: { contains: search, mode: 'insensitive' } } } } },
          ] }] : []),
        ],
      } as any,
      include: {
        event: { include: { guest: true, corporateAccount: true } },
        folio: true,
        cityLedgerAccount: true,
        cityLedgerInvoice: { include: { entries: true } },
        leaseBillingSchedule: { include: { leaseContract: { include: { hall: true, corporateAccount: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return successResponse(invoices.map((invoice: any) => ({
      ...invoice,
      clientName: invoice.event?.guest
        ? `${invoice.event.guest.firstName || ''} ${invoice.event.guest.lastName || ''}`.trim()
        : invoice.event?.corporateAccount?.name
          || invoice.event?.contactName
          || invoice.leaseBillingSchedule?.leaseContract?.corporateAccount?.name
          || invoice.leaseBillingSchedule?.leaseContract?.contactName
          || invoice.cityLedgerAccount?.name
          || '—',
      eventName: invoice.event?.name || `${invoice.leaseBillingSchedule?.leaseContract?.hall?.name || 'Hall'} recurring use`,
      cityLedgerEntryId: invoice.cityLedgerInvoice?.entries?.find((entry: any) => entry.type === 'TRANSFER_IN')?.id || null,
      cityLedgerInvoiceId: invoice.cityLedgerInvoice?.id || null,
      cityLedgerAccountId: invoice.cityLedgerAccountId || invoice.cityLedgerInvoice?.accountId || null,
    })));
  } catch (error) {
    console.error('[Frontdesk Event Invoices GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to load event invoices', 500);
  }
}
