import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const userRole = (session.user as any).role;
    const ALLOWED_ROLES = ['NIGHT_AUDITOR', 'MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'SUPER_ADMIN'];
    if (!ALLOWED_ROLES.includes(userRole)) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions to resolve cash handovers', 403);
    }

    const body = await req.json();
    const { propertyId, handoverId, actualAmount, notes, reasonCode } = body;

    if (!propertyId || !handoverId || actualAmount === undefined) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    const staff = await prisma.staff.findFirst({
      where: { userId: session.user.id },
      select: { id: true }
    });
    
    if (!staff) {
      return errorResponse('FORBIDDEN', 'User is not a staff member', 403);
    }

    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Load and lock the handover within a transaction
    await prisma.$transaction(async (tx) => {
      // Postgres raw query to lock the row
      const [handover] = await tx.$queryRaw<any[]>`
        SELECT * FROM "CashHandover"
        WHERE id = ${handoverId}::uuid AND "propertyId" = ${propertyId}::uuid
        FOR UPDATE
      `;

      if (!handover) {
        throw new Error('NOT_FOUND: Handover not found or access denied');
      }

      if (handover.status !== 'PENDING') {
        throw new Error('CONFLICT: This cash handover has already been processed');
      }

      // Convert Decimal to Number for calculation
      const expectedAmount = Number(handover.amount);
      const receivedAmount = Number(actualAmount);
      const variance = receivedAmount - expectedAmount;

      if (variance !== 0 && !reasonCode) {
        throw new Error('BAD_REQUEST: A reason code is required when there is a variance');
      }

      // Determine final status
      // We'll use COMPLETED even with variance, since there's no APPROVED_WITH_VARIANCE for HandoverStatus
      const finalStatus = 'COMPLETED'; 

      // Update the handover record
      await tx.cashHandover.update({
        where: { id: handoverId },
        data: {
          status: finalStatus,
          actualAmount: receivedAmount,
          variance: variance,
          reasonCode: variance !== 0 ? reasonCode : null,
          notes: notes || null,
          receivedById: staff.id,
          receivedAt: new Date(),
        }
      });
    });

    return successResponse({ message: 'Cash handover received successfully' });
  } catch (error: any) {
    if (error.message.startsWith('NOT_FOUND:')) return errorResponse('NOT_FOUND', error.message.split(':')[1].trim(), 404);
    if (error.message.startsWith('CONFLICT:')) return errorResponse('CONFLICT', error.message.split(':')[1].trim(), 409);
    if (error.message.startsWith('BAD_REQUEST:')) return errorResponse('BAD_REQUEST', error.message.split(':')[1].trim(), 400);
    console.error('Failed to resolve cash handover:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to resolve cash handover', 500);
  }
}
