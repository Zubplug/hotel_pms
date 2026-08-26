import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';
import { PaystackProvider } from '@/lib/payment-providers/paystack';
import crypto from 'crypto';
import { findActiveFrontdeskSession, isFrontdeskCashierRole } from '@/lib/frontdesk/active-session';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { folioId, amount, currency, terminalId, frontdeskSessionId } = body;

    if (!folioId || !amount || !currency) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return errorResponse('BAD_REQUEST', 'Amount must be greater than zero', 400);
    }

    const folio = await prisma.folio.findUnique({
      where: { id: folioId },
      include: { property: true, guest: true }
    });

    if (!folio) return errorResponse('NOT_FOUND', 'Folio not found', 404);

    // --- 7D.6 FINANCIAL GUARD ---
    if (folio.status === 'CLOSED') {
      return errorResponse('BAD_REQUEST', 'Cannot initialize payments for a CLOSED folio.', 400);
    }
    // ----------------------------

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (!allowedPropertyIds.includes(folio.propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const { staff, session: activeFrontdeskSession } = await findActiveFrontdeskSession(session.user.id, folio.propertyId, frontdeskSessionId);
    const role = String((session.user as any).role || '');
    if ((staff || isFrontdeskCashierRole(role)) && !activeFrontdeskSession) {
      return errorResponse('CONFLICT', 'Open a front desk cashier session before starting a payment.', 409);
    }

    if (currency !== folio.currency) {
      return errorResponse('BAD_REQUEST', `Currency mismatch. Expected ${folio.currency}`, 400);
    }

    const currentBalance = Number(folio.balance);
    if (numericAmount > currentBalance) {
      return errorResponse('BAD_REQUEST', 'Payment amount exceeds outstanding balance.', 400);
    }

    // Generate unique reference
    const providerRef = `PAY-${folioId.substring(0,8)}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payments/callback`;

    // Create the Paystack transaction
    const provider = new PaystackProvider();
    
    // We create the payment record FIRST in our DB as PENDING, to ensure we have a record 
    // even if the user drops off before checking out.
    const payment = await prisma.$transaction(async (tx: any) => {
      const p = await tx.payment.create({
        data: {
          folioId: folio.id,
          reservationId: folio.reservationId,
          propertyId: folio.propertyId,
          method: 'PAYMENT_GATEWAY',
          provider: 'PAYSTACK',
          providerRef: providerRef,
          amount: numericAmount,
          currency: currency,
          baseAmount: numericAmount,
          status: 'PENDING',
          idempotencyKey: providerRef, // Using providerRef as the idempotency key here
          terminalId,
          frontdeskSessionId: activeFrontdeskSession?.id,
          receivedBy: session.user.id, // Who initiated the link
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: folio.property.organizationId,
          propertyId: folio.propertyId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: (session.user as any).role || 'STAFF',
          action: 'PAYMENT_CREATED',
          resource: 'Payment',
          resourceId: p.id,
          newValue: { amount: numericAmount, currency, method: 'PAYMENT_GATEWAY', provider: 'PAYSTACK', providerRef },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        }
      });

      return p;
    });

    // Now call Paystack
    try {
      const initResponse = await provider.initializeTransaction({
        amount: numericAmount,
        currency,
        email: folio.guest?.email || 'guest@example.com',
        reference: providerRef,
        callbackUrl,
      });

      return successResponse({
        paymentId: payment.id,
        authorizationUrl: initResponse.authorizationUrl,
        providerRef: initResponse.providerRef
      }, 200);
    } catch (gatewayError: any) {
      // If gateway fails, we might want to mark the payment as FAILED
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', notes: `Initialization failed: ${gatewayError.message}` }
      });
      return errorResponse('BAD_GATEWAY', 'Failed to initialize payment with provider', 502);
    }

  } catch (err: any) {
    console.error('[Payment Init POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error initializing payment', 500);
  }
}
