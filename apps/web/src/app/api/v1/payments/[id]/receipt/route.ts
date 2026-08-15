import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        property: true,
        folio: true,
        reservation: {
          include: {
            primaryGuest: true
          }
        }
      }
    });

    if (!payment) {
      return errorResponse('NOT_FOUND', 'Payment not found', 404);
    }

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (!allowedPropertyIds.includes(payment.propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    // Assemble the definitive, server-calculated receipt
    const receiptData = {
      receiptId: `RCPT-${payment.id.split('-')[0].toUpperCase()}`,
      property: {
        name: payment.property.name,
        address: payment.property.address || 'Address on file',
        city: payment.property.city,
        email: payment.property.email,
        phone: payment.property.phone
      },
      guest: payment.reservation?.primaryGuest ? {
        name: `${payment.reservation.primaryGuest.firstName} ${payment.reservation.primaryGuest.lastName}`,
        email: payment.reservation.primaryGuest.email,
      } : null,
      reservation: payment.reservation ? {
        confirmationNumber: payment.reservation.confirmationNumber,
        checkIn: payment.reservation.checkIn,
        checkOut: payment.reservation.checkOut,
      } : null,
      folio: {
        folioNumber: payment.folio.folioNumber,
      },
      payment: {
        id: payment.id,
        date: payment.createdAt,
        amount: Number(payment.amount),
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        provider: payment.provider,
        providerReference: payment.providerRef,
        providerTransactionId: payment.providerTransactionId,
        receivedBy: payment.receivedBy // UUID of the staff member
      }
    };

    return successResponse(receiptData, 200);

  } catch (err) {
    console.error('[Payment Receipt GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating receipt', 500);
  }
}
