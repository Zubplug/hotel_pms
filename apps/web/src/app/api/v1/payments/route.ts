import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';
import { NotificationEngine } from '@/lib/notification-engine';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { folioId, amount, currency, method, idempotencyKey, notes, providerTransactionId } = body;

    if (!folioId || !amount || !currency || !method || !idempotencyKey) {
      return errorResponse('BAD_REQUEST', 'Missing required fields (folioId, amount, currency, method, idempotencyKey)', 400);
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return errorResponse('BAD_REQUEST', 'Amount must be greater than zero', 400);
    }

    // Validate enum
    const validMethods = ['CASH', 'POS', 'BANK_TRANSFER', 'CARD'];
    if (!validMethods.includes(method)) {
      return errorResponse('BAD_REQUEST', `Invalid payment method. Allowed: ${validMethods.join(', ')}`, 400);
    }

    // 1. Database-Level Idempotency Check
    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey }
    });

    if (existingPayment) {
      // If we've already processed this exact request, return success immediately.
      return successResponse(existingPayment, 200);
    }

    // 2. Load Folio and Validate
    const folio = await prisma.folio.findUnique({
      where: { id: folioId },
      include: { property: true }
    });

    if (!folio) {
      return errorResponse('NOT_FOUND', 'Folio not found', 404);
    }

    // --- 7D.6 FINANCIAL GUARD ---
    if (folio.status === 'CLOSED') {
      return errorResponse('BAD_REQUEST', 'Cannot post payments to a CLOSED folio. Please use post-stay adjustment workflows.', 400);
    }
    // ----------------------------

    // Ensure staff has property access
    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (!allowedPropertyIds.includes(folio.propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    if (currency !== folio.currency) {
      return errorResponse('BAD_REQUEST', `Currency mismatch. Expected ${folio.currency}`, 400);
    }

    const currentBalance = Number(folio.balance);
    if (numericAmount > currentBalance) {
      return errorResponse('BAD_REQUEST', 'Payment amount exceeds outstanding balance. Overpayments are not currently permitted.', 400);
    }

    // 3. Atomic Transaction for Financial Integrity
    const result = await prisma.$transaction(async (tx: any) => {
      // A. Optimistic Concurrency Control update on Folio
      const updatedFolio = await tx.folio.update({
        where: { 
          id: folio.id, 
          version: folio.version // Ensure no one else modified it
        },
        data: {
          version: { increment: 1 },
          totalPayments: { increment: numericAmount },
          balance: { decrement: numericAmount }
        }
      });

      // B. Create the FolioItem (Financial Event)
      const folioItem = await tx.folioItem.create({
        data: {
          folioId: folio.id,
          businessDate: new Date(),
          type: 'PAYMENT',
          source: method === 'POS' ? 'POS' : 'MANUAL',
          description: `Payment - ${method}`,
          quantity: 1,
          unitAmount: -numericAmount, // Payments reduce the balance
          amount: -numericAmount,
          currency: currency,
          baseAmount: -numericAmount,
          postedBy: session.user.id
        }
      });

      // Generate Receipt Number: RCPT-YYYY-XXXXXX
      const year = new Date().getFullYear();
      const randomPart = globalThis.crypto.randomUUID().split('-')[0].toUpperCase().slice(0, 6);
      const receiptNumber = `RCPT-${year}-${randomPart}`;

      // C. Create the actual Payment record
      const payment = await tx.payment.create({
        data: {
          folioId: folio.id,
          reservationId: folio.reservationId,
          propertyId: folio.propertyId,
          method: method as any,
          amount: numericAmount,
          currency: currency,
          baseAmount: numericAmount,
          status: 'COMPLETED',
          idempotencyKey,
          receiptNumber: receiptNumber as any,
          providerTransactionId,
          receivedBy: session.user.id,
          notes
        } as any
      });

      // D. Write Atomic Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: folio.property.organizationId,
          propertyId: folio.propertyId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: (session.user as any).role || 'STAFF',
          action: 'PAYMENT_COMPLETED',
          resource: 'Folio',
          resourceId: folio.id,
          previousValue: {
            balance: currentBalance,
            totalPayments: Number(folio.totalPayments)
          },
          newValue: {
            balance: Number(updatedFolio.balance),
            totalPayments: Number(updatedFolio.totalPayments),
            paymentId: payment.id,
            amount: numericAmount,
            method
          },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        }
      });

      return { payment, updatedFolio };
    });

    // Fire notification for the payment (fire and forget)
    NotificationEngine.emit({
      type: 'PAYMENT_LARGE',
      organizationId: folio.property.organizationId,
      propertyId: folio.propertyId,
      entityType: 'payment',
      entityId: result.payment.id,
      idempotencyKey: `payment_large_${result.payment.id}`,
    }).catch(err => console.error('[NotificationEngine] Failed to emit payment notification:', err));

    return successResponse(result, 201);
  } catch (err: any) {
    console.error('[Payments POST]', err);
    // Handle Prisma concurrency failure
    if (err.code === 'P2025') {
      return errorResponse('CONFLICT', 'The folio was modified by another transaction. Please refresh and try again.', 409);
    }
    // Handle Unique Constraint (Idempotency) if hit concurrently during transaction
    if (err.code === 'P2002') {
      return errorResponse('CONFLICT', 'A payment with this idempotency key is already processing.', 409);
    }
    return errorResponse('INTERNAL_ERROR', 'Unexpected error processing payment', 500);
  }
}
