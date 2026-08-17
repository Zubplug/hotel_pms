import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';
import { PaystackProvider } from '@/lib/payment-providers/paystack';
import crypto from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    const body = await req.json();
    const { amount, reason, idempotencyKey } = body;

    if (!amount || !reason || !idempotencyKey) {
      return errorResponse('BAD_REQUEST', 'Missing required fields (amount, reason, idempotencyKey)', 400);
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return errorResponse('BAD_REQUEST', 'Refund amount must be greater than zero', 400);
    }

    // 1. Role-based authorization limit
    const capabilities = (session.user as any).capabilities || [];
    
    if (!capabilities.includes('ACCESS_REFUNDS')) {
      return errorResponse('FORBIDDEN', 'You do not have the capability to perform refunds.', 403);
    }

    let maxRefundLimit = 0;
    if (capabilities.includes('LIMIT_REFUND_UNLIMITED')) {
      maxRefundLimit = Infinity;
    } else if (capabilities.includes('LIMIT_REFUND_250K')) {
      maxRefundLimit = 250000;
    } else if (capabilities.includes('LIMIT_REFUND_50K')) {
      maxRefundLimit = 50000;
    }

    if (numericAmount > maxRefundLimit) {
      return errorResponse('FORBIDDEN', `Your capability limit prevents refunding amounts above ${maxRefundLimit}.`, 403);
    }

    // 2. Idempotency Check
    const existingRefund = await prisma.refund.findUnique({
      where: { idempotencyKey }
    });

    if (existingRefund) {
      return successResponse(existingRefund, 200);
    }

    // 3. Fetch Payment and Validate Constraints
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        folio: { include: { property: true } },
        refunds: true
      }
    });

    if (!payment) return errorResponse('NOT_FOUND', 'Payment not found', 404);
    if (payment.status !== 'COMPLETED') {
      return errorResponse('BAD_REQUEST', 'Only COMPLETED payments can be refunded', 400);
    }

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (!allowedPropertyIds.includes(payment.propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    // Check maximum refund age (e.g. 180 days)
    const MAX_REFUND_AGE_DAYS = 180;
    const paymentAgeDays = (Date.now() - payment.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (paymentAgeDays > MAX_REFUND_AGE_DAYS) {
      return errorResponse('BAD_REQUEST', `Payment is too old to be refunded. Maximum age is ${MAX_REFUND_AGE_DAYS} days.`, 400);
    }

    // 4. Concurrency & Mathematical Validation
    // To protect against concurrent refunds on the same payment, we will use a transaction 
    // that aggregates existing refunds dynamically via SUM, ensuring atomic math.
    
    let gatewayRefundStatus: 'COMPLETED' | 'PROCESSING' | 'FAILED' = 'COMPLETED';
    let providerRefundId: string | undefined;

    // 5. Gateway Processing (if applicable)
    if (payment.method === 'PAYMENT_GATEWAY' && payment.providerTransactionId) {
      const provider = new PaystackProvider();
      
      try {
        const gatewayRes = await provider.refundTransaction(
          payment.providerTransactionId,
          numericAmount,
          payment.currency,
          reason
        );
        gatewayRefundStatus = gatewayRes.status;
        providerRefundId = gatewayRes.providerRefundId;
        
        if (gatewayRefundStatus === 'FAILED') {
          return errorResponse('BAD_GATEWAY', `Gateway refund failed: ${gatewayRes.message}`, 502);
        }
      } catch (err: any) {
        return errorResponse('BAD_GATEWAY', `Failed to process gateway refund: ${err.message}`, 502);
      }
    }

    // 6. Atomic Ledger Update
    const result = await prisma.$transaction(async (tx) => {
      // Re-sum existing refunds in transaction to prevent concurrency attacks
      const aggregates = await tx.refund.aggregate({
        where: { paymentId: payment.id, status: { not: 'FAILED' } },
        _sum: { amount: true }
      });
      const totalRefundedSoFar = Number(aggregates._sum.amount || 0);

      if ((totalRefundedSoFar + numericAmount) > Number(payment.amount)) {
        throw new Error('Refund amount exceeds original payment total.');
      }

      // Determine new payment status
      const isFullRefund = (totalRefundedSoFar + numericAmount) === Number(payment.amount);
      const newPaymentStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      // Create immutable Refund record
      const refund = await tx.refund.create({
        data: {
          paymentId: payment.id,
          folioId: payment.folioId,
          propertyId: payment.propertyId,
          amount: numericAmount,
          currency: payment.currency,
          reason,
          authorizedBy: session.user.id,
          providerRefundId,
          status: gatewayRefundStatus,
          idempotencyKey
        }
      });

      let updatedFolio = null;

      // Only affect Folio ledger if the refund was successfully processed/completed locally 
      // (For gateway PROCESSING states, we might defer ledger updates to a webhook, but for simplicity here we assume if it's not FAILED, we record the financial event and let reconciliation catch discrepancies, OR we only update folio if COMPLETED)
      if (gatewayRefundStatus === 'COMPLETED') {
        const folio = payment.folio;
        updatedFolio = await tx.folio.update({
          where: { id: folio.id, version: folio.version },
          data: {
            version: { increment: 1 },
            totalPayments: { decrement: numericAmount },
            balance: { increment: numericAmount }
          }
        });

        // FolioItem for the Refund
        await tx.folioItem.create({
          data: {
            folioId: folio.id,
            businessDate: new Date(),
            type: 'REFUND',
            source: 'MANUAL', // or GATEWAY depending on logic
            description: `Refund for Payment ${payment.id.split('-')[0]} - ${reason}`,
            quantity: 1,
            unitAmount: numericAmount, // Positive amount adds back to balance
            amount: numericAmount,
            currency: payment.currency,
            baseAmount: numericAmount,
            postedBy: session.user.id,
          }
        });
      }

      // Update original payment
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: newPaymentStatus }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: payment.folio.property.organizationId,
          propertyId: payment.propertyId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: userRole,
          action: 'PAYMENT_REFUNDED',
          resource: 'Payment',
          resourceId: payment.id,
          newValue: {
            refundId: refund.id,
            amount: numericAmount,
            status: gatewayRefundStatus,
            newPaymentStatus
          },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        }
      });

      return { refund, updatedFolio };
    });

    return successResponse(result, 201);

  } catch (err: any) {
    console.error('[Payment Refund POST]', err);
    if (err.message === 'Refund amount exceeds original payment total.') {
      return errorResponse('BAD_REQUEST', err.message, 400);
    }
    if (err.code === 'P2002') {
      return errorResponse('CONFLICT', 'A refund with this idempotency key is already processing.', 409);
    }
    if (err.code === 'P2025') {
      return errorResponse('CONFLICT', 'The folio was modified by another transaction. Please try again.', 409);
    }
    return errorResponse('INTERNAL_ERROR', 'Unexpected error processing refund', 500);
  }
}
