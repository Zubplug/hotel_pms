import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess } from '@/lib/property-access';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ folioId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { folioId } = await params;
    const body = await req.json().catch(() => ({}));
    const applyAmount = Number(body.amount);
    const offlineOperationId: string | undefined = body.offlineOperationId;
    const creditEntryId: string | undefined = body.creditEntryId;

    if (!applyAmount || applyAmount <= 0) {
      return errorResponse('BAD_REQUEST', 'Amount must be greater than zero.', 400);
    }

    const folio = await prisma.folio.findUnique({
      where: { id: folioId },
      include: { reservation: true }
    });

    if (!folio) return errorResponse('NOT_FOUND', 'Folio not found', 404);
    if (!folio.reservation) return errorResponse('BAD_REQUEST', 'Folio must belong to a reservation to apply guest credit', 400);
    if (folio.status !== 'OPEN') return errorResponse('BAD_REQUEST', 'Cannot apply credit to a closed folio', 400);

    await assertPropertyAccess(session.user.id, folio.propertyId);

    const canApplyCredit = await hasPermission(session.user.id, 'folio', 'apply_guest_credit', folio.propertyId);
    if (!canApplyCredit) {
      const userRole = String((session.user as any).role || 'STAFF').toUpperCase();
      if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'].includes(userRole)) {
        return errorResponse('FORBIDDEN', 'You do not have permission to apply guest credit (FOLIO_APPLY_GUEST_CREDIT).', 403);
      }
    }

    const guestId = folio.reservation.primaryGuestId;
    if (!guestId) return errorResponse('BAD_REQUEST', 'Reservation has no primary guest.', 400);

    const txResult = await prisma.$transaction(async (tx: any) => {
      // ── Idempotency guard: check if this offline operation was already applied ──
      if (offlineOperationId) {
        const priorAudit = await tx.auditLog.findFirst({
          where: {
            resourceId: folio.id,
            action: 'GUEST_CREDIT_APPLIED',
            newValue: { path: ['offlineOperationId'], equals: offlineOperationId }
          }
        });
        if (priorAudit) {
          return { appliedAmount: applyAmount, idempotent: true };
        }
      }

      // ── Lock and fetch REFUND_OWED entries for this guest ──────────────────
      const whereClause = creditEntryId
        ? `AND cle.id = '${creditEntryId}'::uuid`
        : `AND cle."type" = 'REFUND_OWED'`;

      const entries = await tx.$queryRawUnsafe(`
        SELECT cle.id, cle.amount, cle."accountId", cle.type, cle.status
        FROM "CityLedgerEntry" cle
        WHERE cle."guestId" = '${guestId}'::uuid
          AND cle."status" = 'OPEN'
          ${whereClause}
        ORDER BY cle."createdAt" ASC
        FOR UPDATE
      `) as any[];

      if (entries.length === 0) throw new Error('NO_CREDIT_AVAILABLE');

      let remainingToApply = applyAmount;
      const appliedEntries: any[] = [];

      for (const entry of entries) {
        if (remainingToApply <= 0) break;

        // Available = entry.amount - SUM(existing allocations)
        const allocations = await tx.cityLedgerAllocation.findMany({
          where: { paymentId: entry.id }
        });
        const allocated = allocations.reduce((s: number, a: any) => s + Number(a.amount), 0);
        const available = Number(entry.amount) - allocated;

        if (available <= 0.01) {
          await tx.cityLedgerEntry.update({ where: { id: entry.id }, data: { status: 'SETTLED' } });
          continue;
        }

        const applyNow = Math.min(available, remainingToApply);

        // ── Create allocation (does NOT mutate REFUND_OWED amount) ───────────
        const allocation = await tx.cityLedgerAllocation.create({
          data: {
            paymentId: entry.id,
            folioId: folio.id,
            amount: applyNow,
            currency: folio.currency || 'NGN',
            createdBy: session.user.id
          }
        });

        // Update the city ledger account running balance
        await tx.cityLedgerAccount.update({
          where: { id: entry.accountId },
          data: { balance: { decrement: applyNow } }
        });

        // Mark entry settled if fully consumed
        if (applyNow >= available - 0.01) {
          await tx.cityLedgerEntry.update({
            where: { id: entry.id },
            data: { status: 'SETTLED' }
          });
        }

        appliedEntries.push({ entryId: entry.id, allocationId: allocation.id, amount: applyNow });
        remainingToApply -= applyNow;
      }

      // ── Conflict: less credit available than requested ───────────────────
      if (remainingToApply > 0.01) throw new Error('INSUFFICIENT_CREDIT');

      // ── Post folio PAYMENT item ──────────────────────────────────────────
      await tx.folioItem.create({
        data: {
          folioId: folio.id,
          businessDate: new Date(),
          type: 'PAYMENT',
          source: 'CITY_LEDGER',
          description: 'Applied guest credit',
          quantity: 1,
          unitAmount: -applyAmount,
          amount: -applyAmount,
          currency: folio.currency || 'NGN',
          baseAmount: -applyAmount,
          postedBy: session.user.id,
        },
      });

      // ── Update folio balance ─────────────────────────────────────────────
      await tx.folio.update({
        where: { id: folio.id },
        data: {
          balance: { decrement: applyAmount },
          totalPayments: { increment: applyAmount },
          version: { increment: 1 }
        }
      });

      // ── Audit log ────────────────────────────────────────────────────────
      const property = await tx.property.findUnique({ where: { id: folio.propertyId } });
      await tx.auditLog.create({
        data: {
          organizationId: property.organizationId,
          propertyId: folio.propertyId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: (session.user as any).role || 'STAFF',
          action: 'GUEST_CREDIT_APPLIED',
          resource: 'Folio',
          resourceId: folio.id,
          newValue: { amount: applyAmount, guestId, appliedEntries, offlineOperationId: offlineOperationId ?? null },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
        }
      });

      return { appliedAmount: applyAmount, appliedEntries };
    });

    return successResponse(txResult);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Apply Guest Credit POST]', err);

    if (message === 'NO_CREDIT_AVAILABLE') {
      return errorResponse('BAD_REQUEST', 'Guest has no available credit.', 400);
    }
    if (message === 'INSUFFICIENT_CREDIT') {
      // Return 409 CONFLICT so the offline SyncEngine can identify and persist this as a conflict
      return errorResponse('CONFLICT', 'Guest does not have enough available credit. The credit may have been used on another terminal.', 409);
    }
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}
