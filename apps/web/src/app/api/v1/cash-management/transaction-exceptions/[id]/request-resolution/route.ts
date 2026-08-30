import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { proposedResolution, resolutionNotes, requestedById } = body;

    if (!proposedResolution || !requestedById) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Missing required fields' } }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find exception
      const exception = await tx.transactionException.findUnique({
        where: { id },
        include: { payment: true, posPayment: true }
      });

      if (!exception) {
        throw new Error('Exception not found');
      }

      if (exception.status !== 'OPEN' && exception.status !== 'REJECTED') {
        throw new Error(`Cannot request resolution for exception in status ${exception.status}`);
      }

      // 2. Update Exception
      const updatedException = await tx.transactionException.update({
        where: { id },
        data: {
          status: 'PENDING_APPROVAL',
          proposedResolution,
          resolutionNotes,
          requestedById,
          requestedAt: new Date()
        }
      });

      // 3. Update the associated Payment / PosPayment verificationStatus
      if (exception.paymentId) {
        await tx.payment.update({
          where: { id: exception.paymentId },
          data: { verificationStatus: 'RESOLUTION_REQUESTED' }
        });
      } else if (exception.posPaymentId) {
        await tx.posPayment.update({
          where: { id: exception.posPaymentId },
          data: { verificationStatus: 'RESOLUTION_REQUESTED' }
        });
      }

      return updatedException;
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Error requesting resolution:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } }, { status: 500 });
  }
}
