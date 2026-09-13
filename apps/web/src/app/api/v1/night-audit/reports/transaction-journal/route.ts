import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDateStr = searchParams.get('businessDate');

    if (!propertyId || !businessDateStr) return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const businessDate = new Date(businessDateStr);

    const nightAudit = await prisma.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });

    const property = await prisma.property.findUnique({ where: { id: propertyId } });

    // Fetch all FolioItems (which represent transactions for the business date)
    const items = await prisma.folioItem.findMany({
      where: { 
        folio: { propertyId },
        businessDate 
      },
      include: {
        folio: {
          include: {
            guest: true,
            reservation: {
              include: {
                reservationRooms: {
                  include: {
                    room: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    let totalCharges = 0;
    let totalPayments = 0;
    let totalExceptions = 0;

    const transactions = items.map(item => {
      const amt = Number(item.amount);
      const isDebit = item.type === 'CHARGE' || item.type === 'TAX';
      const isCredit = item.type === 'PAYMENT';
      const isException = item.type === 'REFUND' || item.type === 'DISCOUNT' || item.type === 'ADJUSTMENT' || item.type === 'COMPLIMENTARY';

      if (isDebit && !item.voidedAt) totalCharges += amt;
      if (isCredit && !item.voidedAt) totalPayments += amt;
      if (isException && !item.voidedAt) totalExceptions += Math.abs(amt);

      return {
        id: item.id,
        timestamp: item.createdAt,
        folioId: item.folio?.folioNumber || item.folio?.id.slice(0, 8) || 'N/A',
        guestName: item.folio?.guest ? `${item.folio.guest.firstName} ${item.folio.guest.lastName}` : 'System',
        roomNumber: item.folio?.reservation?.reservationRooms?.[0]?.room?.number || 'N/A',
        type: item.type,
        source: item.source,
        description: item.description,
        amount: amt,
        isDebit,
        isCredit,
        isException,
        isVoided: !!item.voidedAt
      };
    });

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      transactions,
      totals: {
        charges: totalCharges,
        payments: totalPayments,
        exceptions: totalExceptions,
        netMovement: totalPayments - totalCharges // Simplified ledger movement view
      }
    });

  } catch (err: any) {
    console.error('[Transaction Journal GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
