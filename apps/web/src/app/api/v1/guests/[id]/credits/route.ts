import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    
    // Validate guest exists
    const guest = await prisma.guest.findUnique({
      where: { id },
      select: { propertyId: true }
    });
    if (!guest) return errorResponse('NOT_FOUND', 'Guest not found', 404);

    // Sum all open REFUND_OWED and PAYMENT entries for this guest
    const entries = await prisma.cityLedgerEntry.findMany({
      where: {
        guestId: id,
        status: 'OPEN',
        type: { in: ['REFUND_OWED', 'PAYMENT'] }
      },
      include: { allocations: true }
    });

    let availableCredit = 0;
    for (const entry of entries) {
      const allocated = entry.allocations.reduce((sum, alloc) => sum + Number(alloc.amount), 0);
      availableCredit += (Number(entry.amount) - allocated);
    }

    return successResponse({
      availableCredit,
      entryCount: entries.length
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Get Guest Credits]', err);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}
