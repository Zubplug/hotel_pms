import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ folioId: string }> }) {
  const session = await auth();
  if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const { folioId } = await params;
  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    include: {
      guest: true,
      reservation: { include: { reservationRooms: { include: { room: true } } } },
      items: { orderBy: { businessDate: 'asc' } },
      // Fetch ALL credits regardless of status so the UI can show total deposits
      // received (including EXHAUSTED ones) in the Payments summary card.
      credits: {
        select: { id: true, amount: true, remainingAmount: true, currency: true, method: true, status: true, reference: true, businessDate: true, createdAt: true, notes: true, idempotencyKey: true },
        orderBy: { createdAt: 'asc' },
      },
      payments: { orderBy: { createdAt: 'desc' }, select: { id: true, amount: true, currency: true, method: true, status: true, receiptNumber: true, reference: true, collectionSource: true, receivedBy: true, createdAt: true, idempotencyKey: true } }
    }
  });
  if (!folio) return errorResponse('NOT_FOUND', 'Folio not found', 404);
  try { if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(folio.propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); } catch { return errorResponse('FORBIDDEN', 'No access to this folio', 403); }
  // Include both local folio vouchers and unused guest-level refund credit.
  const folioVoucherCredit = folio.credits
    .filter((c) => c.status === 'AVAILABLE' || c.status === 'PARTIALLY_APPLIED')
    .reduce((sum, credit) => sum + Number(credit.remainingAmount), 0);
  const guestCreditEntries = folio.reservation?.primaryGuestId
    ? await prisma.cityLedgerEntry.findMany({
        where: { guestId: folio.reservation.primaryGuestId, type: 'REFUND_OWED', status: 'OPEN' },
        include: { allocations: { select: { amount: true } } },
      })
    : [];
  const guestCreditAvailable = guestCreditEntries.reduce((sum, entry) => {
    const allocated = entry.allocations.reduce((entrySum, allocation) => entrySum + Number(allocation.amount), 0);
    return sum + Math.max(0, Number(entry.amount) - allocated);
  }, 0);
  const availableCredit = folioVoucherCredit + guestCreditAvailable;
  // totalCreditsReceived: ALL credits ever recorded (including EXHAUSTED), used to
  // show the correct "Payments received" total even after deposits are fully applied.
  const totalCreditsReceived = folio.credits.reduce((sum, c) => sum + Number(c.amount), 0);
  return successResponse({
    ...folio,
    totalCharges: Number(folio.totalCharges),
    totalPayments: Number(folio.totalPayments),
    balance: Number(folio.balance),
    availableCredit,
    totalCreditsReceived,
    credits: folio.credits.map((credit) => ({ ...credit, amount: Number(credit.amount), remainingAmount: Number(credit.remainingAmount) })),
    items: folio.items.map((item) => ({ ...item, amount: Number(item.amount), unitAmount: Number(item.unitAmount) })),
    payments: folio.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
  });
}
