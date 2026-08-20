import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { PaystackProvider } from '@/lib/payment-providers/paystack';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      return NextResponse.json({ message: 'Missing signature' }, { status: 400 });
    }

    const bodyText = await req.text();
    const provider = new PaystackProvider();

    if (!provider.validateWebhookSignature(bodyText, signature)) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(bodyText);

    if (event.event === 'charge.success') {
      return await handleChargeSuccess(req, event, provider);
    } else if (event.event === 'refund.processed') {
      return await handleRefundProcessed(req, event);
    } else if (event.event === 'refund.failed') {
      return await handleRefundFailed(req, event);
    } else {
      return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
    }
  } catch (err) {
    console.error('[Paystack Webhook]', err);
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}

async function handleChargeSuccess(req: NextRequest, event: any, provider: PaystackProvider) {
  try {
    const { reference, id: providerTxId } = event.data;

    // 1. Find the PENDING payment
    const payment = await prisma.payment.findFirst({
      where: { providerRef: reference }
    });

    if (!payment) {
      return NextResponse.json({ message: 'Payment not found' }, { status: 404 });
    }

    // 2. Application-Level Idempotency
    if (payment.status === 'COMPLETED') {
      return NextResponse.json({ message: 'Payment already processed' }, { status: 200 });
    }

    // 3. Independently verify the transaction with Paystack API
    const verifyData = await provider.verifyTransaction(reference);

    if (!verifyData.isSuccessful) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' }
      });
      return NextResponse.json({ message: 'Verification failed' }, { status: 400 });
    }

    // 4. Ensure amount and currency match
    if (verifyData.currency !== payment.currency || verifyData.amount !== Number(payment.amount)) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', notes: 'Amount or currency mismatch during verification' }
      });
      return NextResponse.json({ message: 'Mismatch' }, { status: 400 });
    }

    // 5. Atomic Financial Transaction
    await prisma.$transaction(async (tx: any) => {
      // Lock and re-read the Folio
      const folio = await tx.folio.findUnique({
        where: { id: payment.folioId }
      });

      if (!folio) throw new Error('Folio not found');

      const currentBalance = Number(folio.balance);

      // Race condition check: Did they already settle it manually?
      if (currentBalance < verifyData.amount) {
        // Balance already settled or partially settled. 
        // We do NOT apply this to the folio balance to prevent a negative folio.
        // Instead, we mark it for manual review.
        await tx.payment.update({
          where: { id: payment.id },
          data: { 
            status: 'REVIEW_REQUIRED',
            providerTransactionId: verifyData.providerTransactionId,
            notes: 'Payment succeeded but folio balance was already lower than payment amount (race condition).'
          }
        });
        
        // Still audit the event
        await tx.auditLog.create({
          data: {
            organizationId: (await tx.property.findUnique({ where: { id: folio.propertyId } }))?.organizationId || '',
            propertyId: folio.propertyId,
            userId: payment.receivedBy,
            userEmail: 'system@lodgecore.local',
            userRole: 'SYSTEM',
            action: 'PAYMENT_REVIEW_REQUIRED',
            resource: 'Payment',
            resourceId: payment.id,
            newValue: { reason: 'Folio overpayment race condition', amount: verifyData.amount },
            ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
            userAgent: 'Paystack Webhook',
            requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
          }
        });

        return; // Exit transaction block early
      }

      // Safe to apply the payment
      const updatedFolio = await tx.folio.update({
        where: { id: folio.id, version: folio.version },
        data: {
          version: { increment: 1 },
          totalPayments: { increment: verifyData.amount },
          balance: { decrement: verifyData.amount }
        }
      });

      // Create FolioItem
      await tx.folioItem.create({
        data: {
          folioId: folio.id,
          businessDate: new Date(),
          type: 'PAYMENT',
          source: 'OTHER', // or a specific gateway source if added to enum later
          description: `Online Payment (Paystack) - ${reference}`,
          quantity: 1,
          unitAmount: -verifyData.amount,
          amount: -verifyData.amount,
          currency: verifyData.currency,
          baseAmount: -verifyData.amount,
          postedBy: payment.receivedBy, // Uses the initiator's UUID
        }
      });

      // Update Payment
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          providerTransactionId: verifyData.providerTransactionId
        }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: (await tx.property.findUnique({ where: { id: folio.propertyId } }))?.organizationId || '',
          propertyId: folio.propertyId,
          userId: payment.receivedBy,
          userEmail: 'system@lodgecore.local',
          userRole: 'SYSTEM',
          action: 'PAYMENT_COMPLETED',
          resource: 'Folio',
          resourceId: folio.id,
          previousValue: { balance: currentBalance },
          newValue: {
            balance: Number(updatedFolio.balance),
            paymentId: payment.id,
            amount: verifyData.amount,
            method: 'PAYMENT_GATEWAY'
          },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: 'Paystack Webhook',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        }
      });
    });

    return NextResponse.json({ message: 'Processed successfully' }, { status: 200 });
  } catch (err) {
    console.error('[Paystack Webhook]', err);
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}

async function handleRefundProcessed(req: NextRequest, event: any) {
  try {
    const { transaction_reference, id: providerRefundId, amount } = event.data;
    
    // Find the processing refund
    const refund = await prisma.refund.findFirst({
      where: { 
        providerRefundId: providerRefundId.toString(),
        status: 'PROCESSING'
      },
      include: { payment: true }
    });

    if (!refund) return NextResponse.json({ message: 'Refund not found or not processing' }, { status: 200 });

    const numericAmount = amount / 100; // Paystack sends in kobo

    await prisma.$transaction(async (tx: any) => {
      // 1. Mark Refund as COMPLETED
      await tx.refund.update({
        where: { id: refund.id },
        data: { status: 'COMPLETED' }
      });

      // 2. Update Folio
      const folio = await tx.folio.findUnique({ where: { id: refund.folioId }});
      if (!folio) throw new Error('Folio not found');

      await tx.folio.update({
        where: { id: folio.id, version: folio.version },
        data: {
          version: { increment: 1 },
          totalPayments: { decrement: numericAmount },
          balance: { increment: numericAmount }
        }
      });

      // 3. Create FolioItem
      await tx.folioItem.create({
        data: {
          folioId: folio.id,
          businessDate: new Date(),
          type: 'REFUND',
          source: 'OTHER',
          description: `Gateway Refund - ${transaction_reference}`,
          quantity: 1,
          unitAmount: numericAmount,
          amount: numericAmount,
          currency: refund.currency,
          baseAmount: numericAmount,
          postedBy: refund.authorizedBy,
        }
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: (await tx.property.findUnique({ where: { id: refund.propertyId } }))?.organizationId || '',
          propertyId: refund.propertyId,
          userId: 'SYSTEM',
          userEmail: 'system@lodgecore.local',
          userRole: 'SYSTEM',
          action: 'PAYMENT_REFUNDED',
          resource: 'Refund',
          resourceId: refund.id,
          newValue: { status: 'COMPLETED', amount: numericAmount },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: 'Paystack Webhook',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        }
      });
    });

    return NextResponse.json({ message: 'Refund processed' }, { status: 200 });
  } catch (err) {
    console.error('[Refund Webhook Error]', err);
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}

async function handleRefundFailed(req: NextRequest, event: any) {
  try {
    const { id: providerRefundId } = event.data;
    
    const refund = await prisma.refund.findFirst({
      where: { 
        providerRefundId: providerRefundId.toString(),
        status: 'PROCESSING'
      },
      include: { payment: true }
    });

    if (!refund) return NextResponse.json({ message: 'Refund not found or not processing' }, { status: 200 });

    await prisma.$transaction(async (tx: any) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: { status: 'FAILED' }
      });

      await tx.auditLog.create({
        data: {
          organizationId: (await tx.property.findUnique({ where: { id: refund.propertyId } }))?.organizationId || '',
          propertyId: refund.propertyId,
          userId: 'SYSTEM',
          userEmail: 'system@lodgecore.local',
          userRole: 'SYSTEM',
          action: 'PAYMENT_REFUND_FAILED',
          resource: 'Refund',
          resourceId: refund.id,
          newValue: { status: 'FAILED' },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: 'Paystack Webhook',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        }
      });
    });

    return NextResponse.json({ message: 'Refund failure logged' }, { status: 200 });
  } catch (err) {
    console.error('[Refund Failed Webhook Error]', err);
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}
