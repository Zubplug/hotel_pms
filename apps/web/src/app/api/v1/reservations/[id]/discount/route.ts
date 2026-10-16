import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import crypto from 'crypto';

const ALLOWED_ROLES = new Set([
  'GENERAL_MANAGER',
  'HOTEL_MANAGER',
  'ADMIN',
  'SUPER_ADMIN',
  'MANAGER',
  'CEO',
  'DIRECTOR',
]);

/**
 * DELETE /api/v1/reservations/[id]/discount
 *
 * Cancels / revokes the approved discount on a corporate reservation.
 * Restricted to General Manager and above.
 *
 * What it does:
 *  1. Clears discountType / discountAmount / discountPercent / discountReason /
 *     discountApprovalId on every ReservationRoom that has an active discount.
 *  2. Voids (soft-deletes via voidedAt) every DISCOUNT-type FolioItem on the
 *     reservation's folio(s) that was created by an approval, and credits the
 *     folio balance back.
 *  3. Marks the originating ApprovalRequest as CANCELLED (if still present).
 *  4. Writes an immutable AuditLog entry.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const userRole = String((session.user as any).role || '').toUpperCase();
    const isSuperAdmin = !!(session.user as any).isSuperAdmin;
    if (!ALLOWED_ROLES.has(userRole) && !isSuperAdmin) {
      return errorResponse(
        'FORBIDDEN',
        'Only a General Manager or Administrator can cancel an approved discount.',
        403,
      );
    }

    const { id: reservationId } = await params;

    // ── 1. Load reservation ────────────────────────────────────────────────
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        property: { select: { id: true, organizationId: true } },
        reservationRooms: {
          select: {
            id: true,
            discountType: true,
            discountAmount: true,
            discountPercent: true,
            discountApprovalId: true,
          },
        },
        folios: {
          include: {
            items: {
              where: { type: 'DISCOUNT', voidedAt: null },
            },
          },
        },
      },
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);

    // ── 2. Must NOT be a corporate reservation ────────────────────────────
    // Corporate accounts use a shared city-ledger folio with their own billing
    // flow. This action is only for standard (non-corporate) reservations.
    if (reservation.corporateAccountId) {
      return errorResponse(
        'BAD_REQUEST',
        'Corporate reservations use a shared city-ledger folio. Manage discounts through the corporate account instead.',
        400,
      );
    }

    // ── 3. Property access guard ───────────────────────────────────────────
    await assertPropertyAccess(session.user.id, reservation.propertyId);

    // ── 4. Night-audit lock guard ──────────────────────────────────────────
    if (await isNightAuditTransactionLocked(reservation.propertyId)) {
      return errorResponse(
        'NIGHT_AUDIT_IN_PROGRESS',
        'Night audit cutover is in progress. Try again after the new business date is active.',
        409,
      );
    }

    // ── 5. Detect whether there is actually a discount to cancel ───────────
    const discountedRooms = reservation.reservationRooms.filter((r) => r.discountType);
    const discountFolioItems = reservation.folios.flatMap((f) => f.items);

    if (discountedRooms.length === 0 && discountFolioItems.length === 0) {
      return errorResponse('BAD_REQUEST', 'No active approved discount found on this reservation.', 400);
    }

    // Collect all unique approval IDs referenced by either the room rows or
    // the folio items so we can mark those approval requests as CANCELLED.
    const approvalIds = new Set<string>([
      ...discountedRooms.map((r) => r.discountApprovalId).filter(Boolean) as string[],
      ...discountFolioItems
        .map((i: any) => i.discountApprovalId)
        .filter(Boolean) as string[],
    ]);

    const now = new Date();
    const requestId = crypto.randomUUID();

    // ── 6. Atomic transaction ──────────────────────────────────────────────
    await prisma.$transaction(async (tx: any) => {
      // 6a. Clear discount fields on every discounted room
      if (discountedRooms.length > 0) {
        await tx.reservationRoom.updateMany({
          where: { id: { in: discountedRooms.map((r) => r.id) } },
          data: {
            discountType: null,
            discountAmount: null,
            discountPercent: null,
            discountReason: null,
            discountApprovalId: null,
          },
        });

        // Touch Reservation.updatedAt so the offline sync pull (which filters
        // reservations by updatedAt > cursor) picks up the discount removal on
        // the next incremental pull. ReservationRoom changes do NOT cascade to
        // the parent Reservation timestamp in Prisma automatically.
        await tx.reservation.update({
          where: { id: reservationId },
          data: { updatedAt: now },
        });
      }

      // 6b. Void each discount folio item and credit the folio balance back
      for (const item of discountFolioItems) {
        await tx.folioItem.update({
          where: { id: item.id },
          data: { voidedAt: now, voidedBy: session.user.id },
        });

        // item.amount is negative for a discount; we reverse it (add the
        // absolute value back) to restore the folio charges/balance.
        const reversal = Math.abs(Number(item.amount));
        await tx.folio.update({
          where: { id: item.folioId },
          data: {
            totalCharges: { increment: reversal },
            balance: { increment: reversal },
          },
        });
      }

      // 6c. Mark originating approval requests as CANCELLED
      if (approvalIds.size > 0) {
        await tx.approvalRequest.updateMany({
          where: {
            id: { in: [...approvalIds] },
            status: { in: ['APPROVED', 'PENDING'] },
          },
          data: {
            status: 'CANCELLED',
            reviewedBy: session.user.id,
            reviewedAt: now,
          },
        });
      }

      // 6d. Audit log
      await tx.auditLog.create({
        data: {
          organizationId: reservation.property.organizationId,
          propertyId: reservation.propertyId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole,
          action: 'DISCOUNT_CANCELLED',
          resource: 'Reservation',
          resourceId: reservationId,
          previousValue: {
            discountedRooms: discountedRooms.map((r) => ({
              id: r.id,
              discountType: r.discountType,
              discountAmount: r.discountAmount,
              discountPercent: r.discountPercent,
            })),
            discountFolioItems: discountFolioItems.map((i: any) => ({
              id: i.id,
              amount: i.amount,
              description: i.description,
            })),
          },
          newValue: { status: 'CANCELLED', cancelledBy: session.user.id },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
          requestId,
        },
      });
    });

    return successResponse(
      { message: 'Approved discount has been cancelled and the reservation restored to its original rate.' },
      200,
    );
  } catch (err: any) {
    console.error('[Reservation Discount DELETE]', err);
    if (err?.code === 'FORBIDDEN') return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse(
      'INTERNAL_ERROR',
      err instanceof Error ? err.message : String(err),
      500,
    );
  }
}
