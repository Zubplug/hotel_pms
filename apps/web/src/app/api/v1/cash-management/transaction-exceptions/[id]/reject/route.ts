import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { rejectedById, rejectionReason } = body;

    if (!rejectedById || !rejectionReason) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'rejectedById and rejectionReason are required' } }, { status: 400 });
    }
    
    // Role check logic would normally be handled by a middleware/service based on the auth token,
    // ensuring the user has the 'TRANSACTION_EXCEPTION_APPROVE' permission.

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find exception
      const exception = await tx.transactionException.findUnique({
        where: { id },
        include: { payment: true, posPayment: true }
      });

      if (!exception) {
        throw new Error('Exception not found');
      }

      if (exception.status !== 'PENDING_APPROVAL') {
        throw new Error(`Cannot reject exception in status ${exception.status}`);
      }

      // 2. Update Exception
      const updatedException = await tx.transactionException.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedById,
          rejectionReason,
          rejectedAt: new Date()
        }
      });

      // 3. Update the associated Payment / PosPayment verificationStatus
      if (exception.paymentId) {
        await tx.payment.update({
          where: { id: exception.paymentId },
          data: { verificationStatus: 'QUESTIONED' } // Returns back to questioned
        });
      } else if (exception.posPaymentId) {
        await tx.posPayment.update({
          where: { id: exception.posPaymentId },
          data: { verificationStatus: 'QUESTIONED' }
        });
      }

      return updatedException;
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Error rejecting resolution:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } }, { status: 500 });
  }
}
